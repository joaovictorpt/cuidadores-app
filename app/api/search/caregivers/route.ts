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
    // Não é um erro de validação da requisição (não há nada de errado com
    // o que o cliente enviou) -- é o próprio perfil da família que está
    // sem um dado que a busca precisa. `reason` permite que quem chama
    // diferencie isso de outros 400s (ex.: para mostrar um CTA "complete
    // seu perfil" em vez de uma mensagem genérica).
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
    // Puramente informativo -- nunca usado para filtrar/reordenar, ver
    // CaregiverForMatching em lib/matching.ts.
    availabilityStatus: caregiver.availabilityStatus,
    distanceKm: Math.round(distanceKm * 10) / 10,
    matchScore: Math.round(matchScore * 1000) / 1000,
  }));

  return NextResponse.json({ results });
}
