import { getServerSession } from "next-auth/next";
import { redirect } from "next/navigation";

import { BackLink } from "@/app/dashboard/_components/back-link";
import { DocumentDeleteButton } from "@/app/dashboard/cuidador/_components/document-delete-button";
import { DocumentUploadForm } from "@/app/dashboard/cuidador/_components/document-upload-form";
import { authOptions } from "@/lib/auth";
import { listCaregiverDocumentsWithSignedUrls } from "@/lib/documents";
import { prisma } from "@/lib/prisma";
import { cardClass } from "@/lib/ui";

const DOCUMENT_TYPE_LABELS: Record<string, string> = {
  ID_DOCUMENT: "Documento de identidade",
  BACKGROUND_CHECK: "Antecedentes criminais",
  CERTIFICATE: "Certificado/curso",
};

const STATUS_LABELS: Record<string, string> = {
  PENDING: "Pendente",
  APPROVED: "Aprovado",
  REJECTED: "Rejeitado",
};

export default async function DocumentosPage() {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    redirect("/login");
  }

  const caregiverProfile = await prisma.caregiverProfile.findUnique({
    where: { userId: session.user.id },
  });

  const documents = caregiverProfile
    ? await listCaregiverDocumentsWithSignedUrls(caregiverProfile.id)
    : [];

  return (
    <main className="min-h-screen bg-background px-4 py-12">
      <div className="mx-auto max-w-2xl space-y-8">
        <div>
          <BackLink href="/dashboard/cuidador" />

          <h1 className="font-display text-3xl font-semibold text-ink">
            Meus documentos
          </h1>
        </div>

        <div className={`${cardClass} mx-auto`}>
          <h2 className="mb-4 font-display text-lg font-semibold text-ink">
            Enviar novo documento
          </h2>
          <DocumentUploadForm />
        </div>

        <div>
          <h2 className="mb-4 font-display text-xl font-semibold text-ink">
            Documentos enviados
          </h2>

          {documents.length === 0 && (
            <p className="text-sm text-muted">
              Você ainda não enviou nenhum documento.
            </p>
          )}

          <div className="space-y-4">
            {documents.map((doc) => (
              <div
                key={doc.id}
                className="rounded-card border border-muted/20 bg-white p-6 shadow-sm"
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h3 className="font-display text-base font-semibold text-ink">
                      {DOCUMENT_TYPE_LABELS[doc.type] ?? doc.type}
                    </h3>
                    <p className="mt-1 font-mono text-xs text-muted">
                      Enviado em {doc.uploadedAt.toLocaleDateString("pt-BR")}
                    </p>
                    {doc.signedUrl && (
                      <a
                        href={doc.signedUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="mt-2 inline-block text-sm font-medium text-primary hover:underline"
                      >
                        Visualizar
                      </a>
                    )}
                  </div>
                  <span className="shrink-0 rounded-full bg-primary-light px-3 py-1 text-sm font-medium text-primary">
                    {STATUS_LABELS[doc.status] ?? doc.status}
                  </span>
                </div>

                {doc.status === "PENDING" && (
                  <div className="mt-4">
                    <DocumentDeleteButton documentId={doc.id} />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </main>
  );
}
