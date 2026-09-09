import type { DocumentType, VerificationStatus } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { CAREGIVER_DOCUMENTS_BUCKET, supabaseAdmin } from "@/lib/supabase-admin";

// Só server-side (transitivamente, via supabase-admin) -- ver lib/supabase-admin.ts.

const SIGNED_URL_EXPIRES_IN_SECONDS = 5 * 60;

export type DocumentWithSignedUrl = {
  id: string;
  type: DocumentType;
  status: VerificationStatus;
  uploadedAt: Date;
  reviewedAt: Date | null;
  signedUrl: string | null;
};

// Compartilhado por GET /api/documents e
// app/dashboard/cuidador/documentos/page.tsx para que a lógica de geração
// em lote de signed URLs viva em um único lugar.
export async function listCaregiverDocumentsWithSignedUrls(
  caregiverProfileId: string
): Promise<DocumentWithSignedUrl[]> {
  const documents = await prisma.document.findMany({
    where: { caregiverId: caregiverProfileId },
    orderBy: { uploadedAt: "desc" },
  });

  if (documents.length === 0) {
    return [];
  }

  // O bucket é privado (documentos são dados sensíveis), então nunca
  // armazenamos nem retornamos uma URL pública -- só signed URLs de curta
  // duração geradas sob demanda.
  const { data: signedUrls } = await supabaseAdmin.storage
    .from(CAREGIVER_DOCUMENTS_BUCKET)
    .createSignedUrls(
      documents.map((doc) => doc.fileUrl),
      SIGNED_URL_EXPIRES_IN_SECONDS
    );

  const signedUrlByPath = new Map(
    (signedUrls ?? []).map((entry) => [entry.path, entry.signedUrl])
  );

  return documents.map((doc) => ({
    id: doc.id,
    type: doc.type,
    status: doc.status,
    uploadedAt: doc.uploadedAt,
    reviewedAt: doc.reviewedAt,
    signedUrl: signedUrlByPath.get(doc.fileUrl) ?? null,
  }));
}
