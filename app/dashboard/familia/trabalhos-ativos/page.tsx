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
import { calculateAverageRating } from "@/lib/reviews";
import { metaTextClass } from "@/lib/ui";

// Filtered view of /dashboard/familia/contratacoes showing only the
// currently-in-progress relationships (status ACCEPTED) -- everything
// beyond a card's summary (actions, contact, review) already lives on
// /dashboard/hires/[id], so cards here just link there instead of
// duplicating that logic.
export default async function TrabalhosAtivosPage() {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    redirect("/login");
  }

  const hires = await prisma.hire.findMany({
    where: { familyId: session.user.id, status: HireStatus.ACCEPTED },
    include: {
      caregiver: {
        select: {
          name: true,
          email: true,
          caregiverProfile: { select: { careTypes: true } },
          reviewsReceived: { select: { rating: true } },
        },
      },
    },
    orderBy: { acceptedAt: "desc" },
  });

  return (
    <main className="min-h-screen bg-background px-4 py-12">
      <div className="mx-auto max-w-2xl">
        <BackLink href="/dashboard/familia" />

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
            const careTypes = hire.caregiver.caregiverProfile?.careTypes ?? [];
            const { average: averageRating, total: ratingCount } =
              calculateAverageRating(
                hire.caregiver.reviewsReceived.map((r) => r.rating)
              );

            return (
              <div
                key={hire.id}
                className="rounded-card border border-muted/20 bg-white p-6 shadow-sm"
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h2 className="font-display text-lg font-semibold text-ink">
                      <Link
                        href={`/dashboard/profile/caregiver/${hire.caregiverId}`}
                        className="hover:underline"
                      >
                        {hire.caregiver.name ?? hire.caregiver.email}
                      </Link>
                    </h2>
                    <p className="mt-1 text-xs text-muted">
                      {averageRating !== null
                        ? `${averageRating.toFixed(1)}/5 (${ratingCount})`
                        : "Sem avaliações"}
                      {careTypes.length > 0 && ` · ${formatCareTypes(careTypes)}`}
                    </p>
                    <div className="mt-1 flex items-center gap-2">
                      <span className="rounded-full border border-muted/30 px-2 py-0.5 text-xs text-muted">
                        {getHireDirectionLabel(hire.initiatedBy, Role.FAMILY)}
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
