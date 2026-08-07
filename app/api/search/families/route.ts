import { Role } from "@prisma/client";
import { getServerSession } from "next-auth/next";
import { NextResponse } from "next/server";

import { authOptions } from "@/lib/auth";
import { rankFamiliesForCaregiver } from "@/lib/matching";
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

  const caregiverProfile = await prisma.caregiverProfile.findUnique({
    where: { userId: session.user.id },
  });

  if (!caregiverProfile) {
    return NextResponse.json(
      { error: "Perfil não encontrado" },
      { status: 404 }
    );
  }

  if (caregiverProfile.latitude === null || caregiverProfile.longitude === null) {
    return NextResponse.json(
      {
        error:
          "Complete seu endereço no perfil para buscar famílias próximas.",
      },
      { status: 400 }
    );
  }

  if (caregiverProfile.careTypes.length === 0) {
    // Same "profile incomplete, not a request problem" distinction as
    // GET /api/search/caregivers -- `reason` lets a future UI show a
    // "complete your profile" CTA instead of a generic message.
    return NextResponse.json(
      {
        error:
          "Complete seu perfil com os tipos de cuidado que você oferece antes de buscar famílias.",
        reason: "incomplete_profile",
      },
      { status: 400 }
    );
  }

  const ranked = await rankFamiliesForCaregiver(caregiverProfile);

  // No `address` here by design -- see FamilyForDisplay in lib/matching.ts.
  const results = ranked.map(({ family, distanceKm, matchScore }) => ({
    familyId: family.userId,
    name: family.name,
    city: family.city,
    state: family.state,
    neededCareTypes: family.neededCareTypes,
    distanceKm: Math.round(distanceKm * 10) / 10,
    matchScore: Math.round(matchScore * 1000) / 1000,
  }));

  return NextResponse.json({ results });
}
