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

  if (session.user.role !== Role.CAREGIVER) {
    return NextResponse.json(
      { error: "Acesso restrito a cuidadores" },
      { status: 403 }
    );
  }

  // Same O(all families x all caregivers)-per-request caveat as the
  // family-side route (app/api/matching/stable-match/route.ts) -- see the
  // note there.
  const matchesByCaregiver = await runStableMatchingForAllFamilies();

  // Unlike the family side (which gets at most one matched caregiver back),
  // a caregiver can hold up to matchingConfig.caregiverCapacity families at
  // once (the hospital-residents variant of Gale-Shapley -- see CLAUDE.md
  // "Algoritmo de matching"), so this can be anywhere from 0 to that many
  // entries.
  const matchedFamilyUserIds = matchesByCaregiver.get(session.user.id) ?? [];

  if (matchedFamilyUserIds.length === 0) {
    return NextResponse.json({ families: [] });
  }

  const familyProfiles = await prisma.familyProfile.findMany({
    where: { userId: { in: matchedFamilyUserIds } },
    include: { user: { select: { name: true } } },
  });

  // Same privacy-limited shape as GET /api/search/families -- no
  // `address`, and (like the family-side stable-match route) no fabricated
  // distance/matchScore either, since Gale-Shapley doesn't produce those
  // for its result the way the weighted search does.
  const families = familyProfiles.map((profile) => ({
    familyId: profile.userId,
    name: profile.user.name,
    city: profile.city,
    state: profile.state,
    neededCareTypes: profile.neededCareTypes,
  }));

  return NextResponse.json({ families });
}
