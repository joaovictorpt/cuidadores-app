import { HireStatus, Role } from "@prisma/client";
import { getServerSession } from "next-auth/next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { BackLink } from "@/app/dashboard/_components/back-link";
import { authOptions } from "@/lib/auth";
import { formatCareTypes } from "@/lib/care-types";
import { getHireDirectionLabel } from "@/lib/hire-labels";
import { prisma } from "@/lib/prisma";
import { formatRelativeTime } from "@/lib/relative-time";
import { metaTextClass } from "@/lib/ui";

// Filtered view of /dashboard/cuidador/solicitacoes showing only the
// currently-in-progress relationships (status ACCEPTED) -- mirrors
// /dashboard/familia/trabalhos-ativos on the other side of the graph.
export default async function TrabalhosAtivosPage() {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    redirect("/login");
  }

  const hires = await prisma.hire.findMany({
    where: { caregiverId: session.user.id, status: HireStatus.ACCEPTED },
    include: {
      family: {
        select: {
          name: true,
          email: true,
          familyProfile: {
            select: { neededCareTypes: true, city: true, state: true },
          },
        },
      },
    },
    orderBy: { acceptedAt: "desc" },
  });

  return (
    <main className="min-h-screen bg-background px-4 py-12">
      <div className="mx-auto max-w-2xl">
        <BackLink href="/dashboard/cuidador" />

        <h1 className="mb-6 font-display text-3xl font-semibold text-ink">
          Trabalhos ativos
        </h1>

        {hires.length === 0 && (
          <p className="text-sm text-muted">
            Nenhum trabalho ativo no momento.
          </p>
        )}

        <div className="space-y-4">
          {hires.map((hire) => {
            const neededCareTypes = hire.family.familyProfile?.neededCareTypes ?? [];
            const location = [
              hire.family.familyProfile?.city,
              hire.family.familyProfile?.state,
            ]
              .filter(Boolean)
              .join(", ");

            return (
              <div
                key={hire.id}
                className="rounded-card border border-muted/20 bg-white p-6 shadow-sm"
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h2 className="font-display text-lg font-semibold text-ink">
                      <Link
                        href={`/dashboard/profile/family/${hire.familyId}`}
                        className="hover:underline"
                      >
                        {hire.family.name ?? hire.family.email}
                      </Link>
                    </h2>
                    <p className="mt-1 text-xs text-muted">
                      {neededCareTypes.length > 0
                        ? formatCareTypes(neededCareTypes)
                        : "Tipos de cuidado não informados"}
                      {location && ` · ${location}`}
                    </p>
                    <div className="mt-1 flex items-center gap-2">
                      <span className="rounded-full border border-muted/30 px-2 py-0.5 text-xs text-muted">
                        {getHireDirectionLabel(hire.initiatedBy, Role.CAREGIVER)}
                      </span>
                      {hire.acceptedAt && (
                        <span
                          className={metaTextClass}
                          title={hire.acceptedAt.toLocaleString("pt-BR")}
                        >
                          Aceito {formatRelativeTime(hire.acceptedAt)}
                        </span>
                      )}
                    </div>
                    <Link
                      href={`/dashboard/hires/${hire.id}`}
                      className="mt-2 inline-block text-sm font-medium text-primary hover:underline"
                    >
                      Ver detalhes
                    </Link>
                  </div>
                  <span className="shrink-0 rounded-full bg-primary-light px-3 py-1 text-sm font-medium text-primary">
                    Em andamento
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </main>
  );
}
