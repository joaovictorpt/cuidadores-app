import { Role } from "@prisma/client";
import { getServerSession } from "next-auth/next";
import { NextResponse } from "next/server";

import { authOptions } from "@/lib/auth";
import { runStableMatchingForAllFamilies } from "@/lib/matching";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }

  if (session.user.role !== Role.FAMILY) {
    return NextResponse.json(
      { error: "Acesso restrito a famílias" },
      { status: 403 }
    );
  }

  // NOTE: this recomputes the stable matching for EVERY family and
  // caregiver in the system on every request, even though only the
  // logged-in family's result is used below. That's fine at MVP/TCC scale
  // but doesn't scale: as the user base grows this becomes an
  // O(all families x all caregivers) computation per request. If usage
  // grows, this is a good candidate to precompute on a schedule (e.g. a
  // cron job) or cache the result (recompute every N minutes, or
  // invalidate on profile changes) instead of running it synchronously on
  // every single request.
  const matchesByCaregiver = await runStableMatchingForAllFamilies();

  let matchedCaregiverUserId: string | null = null;

  for (const [caregiverUserId, familyUserIds] of matchesByCaregiver) {
    if (familyUserIds.includes(session.user.id)) {
      matchedCaregiverUserId = caregiverUserId;
      break;
    }
  }

  if (!matchedCaregiverUserId) {
    return NextResponse.json({ caregiver: null });
  }

  const caregiverProfile = await prisma.caregiverProfile.findUnique({
    where: { userId: matchedCaregiverUserId },
    include: { user: { select: { name: true } } },
  });

  return NextResponse.json({
    caregiver: caregiverProfile
      ? {
          name: caregiverProfile.user.name,
          bio: caregiverProfile.bio,
          hourlyRate: caregiverProfile.hourlyRate
            ? Number(caregiverProfile.hourlyRate)
            : null,
          careTypes: caregiverProfile.careTypes,
        }
      : null,
  });
}
