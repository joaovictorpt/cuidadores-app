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

  // NOTA: isso recalcula o matching estável para TODA família e cuidador do
  // sistema a cada requisição, mesmo que só o resultado da família logada
  // seja usado abaixo. Isso é aceitável na escala de MVP/TCC, mas não
  // escala: conforme a base de usuários cresce, isso vira um cálculo
  // O(todas as famílias x todos os cuidadores) por requisição. Se o uso
  // crescer, este é um bom candidato a ser pré-computado numa agenda (ex.:
  // um cron job) ou ter o resultado cacheado (recalcular a cada N minutos,
  // ou invalidar quando um perfil muda) em vez de rodar de forma síncrona
  // a cada requisição.
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
