import { Role } from "@prisma/client";
import { getServerSession } from "next-auth/next";
import { NextResponse } from "next/server";

import { authOptions } from "@/lib/auth";
import { rankCaregiversForFamily } from "@/lib/matching";
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

  const familyProfile = await prisma.familyProfile.findUnique({
    where: { userId: session.user.id },
  });

  if (!familyProfile) {
    return NextResponse.json(
      { error: "Perfil não encontrado" },
      { status: 404 }
    );
  }

  if (familyProfile.latitude === null || familyProfile.longitude === null) {
    return NextResponse.json(
      {
        error:
          "Complete seu endereço no perfil para buscar cuidadores próximos.",
      },
      { status: 400 }
    );
  }

  if (familyProfile.neededCareTypes.length === 0) {
    // Not a request-validation error (nothing was wrong with what the
    // client sent) -- the family's own profile is missing data the search
    // needs. `reason` lets callers tell this apart from other 400s (e.g.
    // to show a "complete your profile" CTA instead of a generic message).
    return NextResponse.json(
      {
        error:
          "Complete seu perfil com os tipos de cuidado que você procura antes de buscar cuidadores.",
        reason: "incomplete_profile",
      },
      { status: 400 }
    );
  }

  const ranked = await rankCaregiversForFamily(familyProfile);

  const results = ranked.map(({ caregiver, distanceKm, matchScore }) => ({
    name: caregiver.name,
    bio: caregiver.bio,
    hourlyRate: caregiver.hourlyRate,
    careTypes: caregiver.careTypes,
    averageRating: caregiver.averageRating,
    reviewCount: caregiver.reviewCount,
    distanceKm: Math.round(distanceKm * 10) / 10,
    matchScore: Math.round(matchScore * 1000) / 1000,
  }));

  return NextResponse.json({ results });
}
