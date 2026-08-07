import { Role } from "@prisma/client";
import { getServerSession } from "next-auth/next";
import { redirect } from "next/navigation";

import { BackLink } from "@/app/dashboard/_components/back-link";
import { HireActionButton } from "@/app/dashboard/_components/hire-action-button";
import { authOptions } from "@/lib/auth";
import { getAvailableActions } from "@/lib/hire-transitions";
import {
  getHireDirectionLabel,
  HIRE_ACTION_LABELS,
  HIRE_STATUS_LABELS,
} from "@/lib/hire-labels";
import { prisma } from "@/lib/prisma";
import { formatRelativeTime } from "@/lib/relative-time";
import { metaTextClass } from "@/lib/ui";

export default async function SolicitacoesPage() {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    redirect("/login");
  }

  const hires = await prisma.hire.findMany({
    where: { caregiverId: session.user.id },
    include: { family: { select: { name: true, email: true } } },
    orderBy: { createdAt: "desc" },
  });

  return (
    <main className="min-h-screen bg-background px-4 py-12">
      <div className="mx-auto max-w-2xl">
        <BackLink href="/dashboard/cuidador" />

        <h1 className="mb-6 font-display text-3xl font-semibold text-ink">
          Minhas solicitações
        </h1>

        {hires.length === 0 && (
          <p className="text-sm text-muted">
            Você ainda não tem nenhuma solicitação.
          </p>
        )}

        <div className="space-y-4">
          {hires.map((hire) => {
            const actions = getAvailableActions(
              hire.status,
              Role.CAREGIVER,
              hire.initiatedBy
            );

            return (
              <div
                key={hire.id}
                className="rounded-card border border-muted/20 bg-white p-6 shadow-sm"
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h2 className="font-display text-lg font-semibold text-ink">
                      {hire.family.name ?? hire.family.email}
                    </h2>
                    {hire.message && (
                      <p className="mt-1 text-sm text-muted">{hire.message}</p>
                    )}
                    <div className="mt-1 flex items-center gap-2">
                      <span className="rounded-full border border-muted/30 px-2 py-0.5 text-xs text-muted">
                        {getHireDirectionLabel(hire.initiatedBy, Role.CAREGIVER)}
                      </span>
                      <span
                        className={metaTextClass}
                        title={hire.createdAt.toLocaleString("pt-BR")}
                      >
                        {formatRelativeTime(hire.createdAt)}
                      </span>
                    </div>
                  </div>
                  <span className="shrink-0 rounded-full bg-primary-light px-3 py-1 text-sm font-medium text-primary">
                    {HIRE_STATUS_LABELS[hire.status]}
                  </span>
                </div>

                {actions.length > 0 && (
                  <div className="mt-4 flex gap-2">
                    {actions.map((action) => (
                      <HireActionButton
                        key={action}
                        hireId={hire.id}
                        targetStatus={action}
                        label={HIRE_ACTION_LABELS[action] ?? action}
                      />
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </main>
  );
}
