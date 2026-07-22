import { randomUUID } from "crypto";

import { DocumentType, Role } from "@prisma/client";
import { getServerSession } from "next-auth/next";
import { NextResponse } from "next/server";

import { authOptions } from "@/lib/auth";
import { listCaregiverDocumentsWithSignedUrls } from "@/lib/documents";
import { prisma } from "@/lib/prisma";
import { CAREGIVER_DOCUMENTS_BUCKET, supabaseAdmin } from "@/lib/supabase-admin";

const ALLOWED_MIME_TYPES = ["application/pdf", "image/jpeg", "image/png"];
const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024;

function sanitizeFileName(name: string): string {
  return name.replace(/[^a-zA-Z0-9.\-_]/g, "_");
}

export async function POST(request: Request) {
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

  const formData = await request.formData();
  const file = formData.get("file");
  const type = formData.get("type");

  if (!(file instanceof File)) {
    return NextResponse.json(
      { error: "Arquivo não enviado" },
      { status: 400 }
    );
  }

  if (typeof type !== "string" || !Object.values(DocumentType).includes(type as DocumentType)) {
    return NextResponse.json(
      { error: "Tipo de documento inválido" },
      { status: 400 }
    );
  }

  if (!ALLOWED_MIME_TYPES.includes(file.type)) {
    return NextResponse.json(
      { error: "Formato de arquivo não permitido. Envie um PDF, JPG ou PNG." },
      { status: 400 }
    );
  }

  if (file.size > MAX_FILE_SIZE_BYTES) {
    return NextResponse.json(
      { error: "Arquivo muito grande. O tamanho máximo é 5MB." },
      { status: 400 }
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

  const storagePath = `${caregiverProfile.id}/${randomUUID()}-${sanitizeFileName(file.name)}`;

  const { error: uploadError } = await supabaseAdmin.storage
    .from(CAREGIVER_DOCUMENTS_BUCKET)
    .upload(storagePath, file, { contentType: file.type });

  if (uploadError) {
    return NextResponse.json(
      { error: "Não foi possível enviar o arquivo. Tente novamente." },
      { status: 500 }
    );
  }

  try {
    const document = await prisma.document.create({
      data: {
        caregiverId: caregiverProfile.id,
        type: type as DocumentType,
        fileUrl: storagePath,
      },
    });

    return NextResponse.json({ document }, { status: 201 });
  } catch (error) {
    // Don't leave an orphaned file in storage if the DB insert failed.
    await supabaseAdmin.storage.from(CAREGIVER_DOCUMENTS_BUCKET).remove([storagePath]);
    throw error;
  }
}

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

  const documents = await listCaregiverDocumentsWithSignedUrls(caregiverProfile.id);

  return NextResponse.json({ documents });
}
