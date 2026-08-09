import { getServerSession } from "next-auth/next";
import { notFound, redirect } from "next/navigation";

import { StarRating } from "@/app/components/star-rating";
import { BackLink } from "@/app/dashboard/_components/back-link";
import { authOptions } from "@/lib/auth";
import { formatDuration } from "@/lib/duration";
import { getHireDirectionLabel, HIRE_STATUS_LABELS } from "@/lib/hire-labels";
import { prisma } from "@/lib/prisma";
import { formatRelativeTime } from "@/lib/relative-time";

function formatTimelineEntry(date: Date): string {
  return `${date.toLocaleString("pt-BR")} (${formatRelativeTime(date)})`;
}

// Shared by both sides of a Hire (family and caregiver) -- unlike
// /dashboard/familia/contratacoes and /dashboard/cuidador/solicitacoes,
// which each only ever query the logged-in user's own Hires, this page
// takes an arbitrary id from the URL and must verify participation itself.
export default async function HireDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    redirect("/login");
  }

  const { id } = await params;

  const hire = await prisma.hire.findUnique({
    where: { id },
    include: {
      family: { select: { name: true, email: true } },
      caregiver: { select: { name: true, email: true } },
      review: { include: { author: { select: { name: true } } } },
    },
  });

  const isFamily = hire?.familyId === session.user.id;
  const isCaregiver = hire?.caregiverId === session.user.id;

  // Collapsed into a single 404 for both "doesn't exist" and "not a
  // participant" -- distinguishing them (403 vs 404) would leak to a
  // logged-in stranger that a given Hire id exists at all, even if they
  // can't see its contents.
  if (!hire || (!isFamily && !isCaregiver)) {
    notFound();
  }

  const otherParty = isFamily ? hire.caregiver : hire.family;
  const backHref = isFamily
    ? "/dashboard/familia/contratacoes"
    : "/dashboard/cuidador/solicitacoes";

  const durationLabel =
    hire.acceptedAt && hire.completedAt
      ? formatDuration(hire.completedAt.getTime() - hire.acceptedAt.getTime())
      : "Duração não disponível";

  return (
    <main className="min-h-screen bg-background px-4 py-12">
      <div className="mx-auto max-w-2xl">
        <BackLink href={backHref} />

        <div className="rounded-card border border-muted/20 bg-white p-6 shadow-sm sm:p-8">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="font-display text-2xl font-semibold text-ink">
                {otherParty.name ?? otherParty.email}
              </h1>
              <span className="mt-1 inline-block rounded-full border border-muted/30 px-2 py-0.5 text-xs text-muted">
                {getHireDirectionLabel(hire.initiatedBy, session.user.role)}
              </span>
            </div>
            <span className="shrink-0 rounded-full bg-primary-light px-3 py-1 text-sm font-medium text-primary">
              {HIRE_STATUS_LABELS[hire.status]}
            </span>
          </div>

          {hire.message && (
            <div className="mt-6">
              <h2 className="text-xs font-medium uppercase text-muted">
                Mensagem original
              </h2>
              <p className="mt-1 text-sm text-ink/80">{hire.message}</p>
            </div>
          )}

          <div className="mt-6">
            <h2 className="text-xs font-medium uppercase text-muted">
              Linha do tempo
            </h2>
            <dl className="mt-2 space-y-2">
              <div>
                <dt className="text-xs text-muted">Criado em</dt>
                <dd className="text-sm text-ink/80">
                  {formatTimelineEntry(hire.createdAt)}
                </dd>
              </div>
              {hire.acceptedAt && (
                <div>
                  <dt className="text-xs text-muted">Aceito em</dt>
                  <dd className="text-sm text-ink/80">
                    {formatTimelineEntry(hire.acceptedAt)}
                  </dd>
                </div>
              )}
              {hire.completedAt && (
                <div>
                  <dt className="text-xs text-muted">Concluído em</dt>
                  <dd className="text-sm text-ink/80">
                    {formatTimelineEntry(hire.completedAt)}
                  </dd>
                </div>
              )}
            </dl>
          </div>

          <div className="mt-6">
            <h2 className="text-xs font-medium uppercase text-muted">
              Duração do serviço
            </h2>
            <p className="mt-1 text-sm text-ink/80">{durationLabel}</p>
          </div>

          {hire.review && (
            <div className="mt-6 border-t border-muted/20 pt-6">
              <h2 className="text-xs font-medium uppercase text-muted">
                Avaliação
              </h2>
              <div className="mt-2 flex items-center justify-between gap-4">
                <p className="text-sm text-ink/80">
                  {hire.review.author.name ?? "Família"}
                </p>
                <StarRating value={hire.review.rating} readOnly />
              </div>
              {hire.review.comment && (
                <p className="mt-2 text-sm text-ink/80">{hire.review.comment}</p>
              )}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
