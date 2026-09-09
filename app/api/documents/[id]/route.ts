import { Role, VerificationStatus } from "@prisma/client";
import { getServerSession } from "next-auth/next";
import { NextResponse } from "next/server";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { CAREGIVER_DOCUMENTS_BUCKET, supabaseAdmin } from "@/lib/supabase-admin";

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
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

  const { id } = await params;

  const document = await prisma.document.findUnique({ where: { id } });

  if (!document) {
    return NextResponse.json(
      { error: "Documento não encontrado" },
      { status: 404 }
    );
  }

  const caregiverProfile = await prisma.caregiverProfile.findUnique({
    where: { userId: session.user.id },
  });

  if (!caregiverProfile || document.caregiverId !== caregiverProfile.id) {
    return NextResponse.json(
      { error: "Você não pode remover este documento" },
      { status: 403 }
    );
  }

  if (document.status !== VerificationStatus.PENDING) {
    // Ainda não existe fluxo de aprovação (ver CLAUDE.md "Verificação de
    // documentos"), então na prática todo documento está PENDING hoje -- essa
    // checagem está aqui para que a remoção seja corretamente bloqueada
    // quando esse fluxo existir.
    return NextResponse.json(
      { error: "Este documento já foi analisado e não pode mais ser removido" },
      { status: 400 }
    );
  }

  const { error: removeError } = await supabaseAdmin.storage
    .from(CAREGIVER_DOCUMENTS_BUCKET)
    .remove([document.fileUrl]);

  if (removeError) {
    return NextResponse.json(
      { error: "Não foi possível remover o arquivo. Tente novamente." },
      { status: 500 }
    );
  }

  await prisma.document.delete({ where: { id } });

  return NextResponse.json({ success: true });
}
