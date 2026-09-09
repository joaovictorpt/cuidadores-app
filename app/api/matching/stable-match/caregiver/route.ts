import { Role } from "@prisma/client";
import { getServerSession } from "next-auth/next";
import { NextResponse } from "next/server";

import { authOptions } from "@/lib/auth";
import { findMatchedFamiliesForCaregiver } from "@/lib/matching";

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

  // Mesma ressalva de custo O(todas as famílias x todos os cuidadores) por
  // requisição da rota do lado família (app/api/matching/stable-match/route.ts)
  // -- ver a nota lá.
  const families = await findMatchedFamiliesForCaregiver(session.user.id);

  return NextResponse.json({ families });
}
