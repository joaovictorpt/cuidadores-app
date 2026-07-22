import type { DocumentType, VerificationStatus } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { CAREGIVER_DOCUMENTS_BUCKET, supabaseAdmin } from "@/lib/supabase-admin";

// Server-only (transitively, via supabase-admin) -- see lib/supabase-admin.ts.

const SIGNED_URL_EXPIRES_IN_SECONDS = 5 * 60;

export type DocumentWithSignedUrl = {
  id: string;
  type: DocumentType;
  status: VerificationStatus;
  uploadedAt: Date;
  reviewedAt: Date | null;
  signedUrl: string | null;
};

// Shared by GET /api/documents and app/dashboard/cuidador/documentos/page.tsx
// so the signed-URL batching logic lives in exactly one place.
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

  // The bucket is private (documents are sensitive), so we never store or
  // return a public URL -- only short-lived signed URLs generated on demand.
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
