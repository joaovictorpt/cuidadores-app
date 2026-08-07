import { HireStatus } from "@prisma/client";
import { getServerSession } from "next-auth/next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { LogoutButton } from "@/app/dashboard/_components/logout-button";
import { authOptions } from "@/lib/auth";
import { findMatchedCaregiverForFamily } from "@/lib/matching";
import { prisma } from "@/lib/prisma";
import { contentCardClass, heroAccentButtonClass, primaryButtonClass } from "@/lib/ui";

export default async function DashboardFamiliaPage() {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    redirect("/login");
  }

  const [familyProfile, pendingCount, acceptedCount, matchedCaregiverUserId] =
    await Promise.all([
      prisma.familyProfile.findUnique({ where: { userId: session.user.id } }),
      prisma.hire.count({
        where: { familyId: session.user.id, status: HireStatus.PENDING },
      }),
      prisma.hire.count({
        where: { familyId: session.user.id, status: HireStatus.ACCEPTED },
      }),
      findMatchedCaregiverForFamily(session.user.id),
    ]);

  const matchedCaregiver = matchedCaregiverUserId
    ? await prisma.caregiverProfile.findUnique({
        where: { userId: matchedCaregiverUserId },
        select: { user: { select: { name: true } } },
      })
    : null;

  const missingCareTypes =
    familyProfile !== null && familyProfile.neededCareTypes.length === 0;

  return (
    <main className="min-h-screen bg-background px-4 py-12">
      <div className="mx-auto max-w-2xl">
        <h1 className="mb-1 font-display text-3xl font-semibold text-ink">
          Bem-vindo(a), {session.user.name || session.user.email}
        </h1>
        <p className="mb-6 text-sm text-muted">Painel de controle da família</p>

        <Link
          href="/dashboard/familia/buscar"
          className={`${heroAccentButtonClass} mb-6`}
        >
          Buscar cuidadores
        </Link>

        {missingCareTypes && (
          <div className="mb-6 rounded-card border border-primary/20 bg-primary-light p-6 text-center">
            <p className="text-sm text-ink">
              Complete seu perfil com os tipos de cuidado que você procura --
              sem isso, a busca de cuidadores não funciona.
            </p>
            <Link
              href="/dashboard/familia/perfil"
              className={`${primaryButtonClass} mt-4 inline-block w-auto px-6`}
            >
              Completar perfil
            </Link>
          </div>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <Link
            href="/dashboard/familia/contratacoes"
            className={`${contentCardClass} block transition hover:border-primary motion-reduce:transition-none`}
          >
            <h2 className="font-display text-lg font-semibold text-ink">
              Contratações
            </h2>
            <p className="mt-1 text-sm text-muted">
              {pendingCount === 0 && acceptedCount === 0
                ? "Nenhuma solicitação em andamento"
                : `${pendingCount} pendente${pendingCount === 1 ? "" : "s"}, ${acceptedCount} aceita${acceptedCount === 1 ? "" : "s"}`}
            </p>
          </Link>

          <Link
            href="/dashboard/familia/match-recomendado"
            className={`${contentCardClass} block transition hover:border-primary motion-reduce:transition-none`}
          >
            <h2 className="font-display text-lg font-semibold text-ink">
              Match recomendado
            </h2>
            <p className="mt-1 text-sm text-muted">
              {matchedCaregiver?.user.name ?? "Nenhum match ainda"}
            </p>
          </Link>
        </div>

        <div className="mt-8 space-y-2">
          <Link
            href="/dashboard/familia/perfil"
            className="block text-sm font-medium text-primary hover:underline"
          >
            Editar perfil
          </Link>
        </div>

        <div className="mt-6">
          <LogoutButton />
        </div>
      </div>
    </main>
  );
}
