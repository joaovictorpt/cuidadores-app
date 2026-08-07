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

  // Same O(all families x all caregivers)-per-request caveat as the
  // family-side route (app/api/matching/stable-match/route.ts) -- see the
  // note there.
  const families = await findMatchedFamiliesForCaregiver(session.user.id);

  return NextResponse.json({ families });
}
