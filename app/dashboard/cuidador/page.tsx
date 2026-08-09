import { HireStatus } from "@prisma/client";
import { getServerSession } from "next-auth/next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { LogoutButton } from "@/app/dashboard/_components/logout-button";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { calculateAverageRating } from "@/lib/reviews";
import { contentCardClass, heroAccentButtonClass, heroOutlineButtonClass } from "@/lib/ui";

export default async function DashboardCuidadorPage() {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    redirect("/login");
  }

  const [caregiverProfile, pendingCount, ratings] = await Promise.all([
    prisma.caregiverProfile.findUnique({ where: { userId: session.user.id } }),
    prisma.hire.count({
      where: { caregiverId: session.user.id, status: HireStatus.PENDING },
    }),
    prisma.review.findMany({
      where: { targetId: session.user.id },
      select: { rating: true },
    }),
  ]);

  const { average: averageRating, total: reviewCount } = calculateAverageRating(
    ratings.map((review) => review.rating)
  );

  const documentCount = caregiverProfile
    ? await prisma.document.count({
        where: { caregiverId: caregiverProfile.id },
      })
    : 0;

  return (
    <main className="min-h-screen bg-background px-4 py-12">
      <div className="mx-auto max-w-2xl">
        <h1 className="mb-1 font-display text-3xl font-semibold text-ink">
          Bem-vindo(a), {session.user.name || session.user.email}
        </h1>
        <p className="mb-6 text-sm text-muted">Painel de controle do cuidador</p>

        <div className="mb-6 flex flex-col gap-3 sm:flex-row">
          <Link href="/dashboard/cuidador/buscar" className={heroAccentButtonClass}>
            Buscar famílias
          </Link>
          <Link
            href="/dashboard/cuidador/match-perfeito"
            className={heroOutlineButtonClass}
          >
            Match perfeito
          </Link>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Link
            href="/dashboard/cuidador/solicitacoes"
            className={
              pendingCount > 0
                ? "block rounded-card border border-accent/40 bg-accent-light p-6 shadow-sm transition hover:border-accent motion-reduce:transition-none"
                : `${contentCardClass} block transition hover:border-primary motion-reduce:transition-none`
            }
          >
            <h2 className="font-display text-lg font-semibold text-ink">
              Solicitações
            </h2>
            <p className="mt-1 text-sm text-ink/80">
              {pendingCount === 0
                ? "Nenhuma solicitação pendente"
                : `${pendingCount} aguardando sua resposta`}
            </p>
          </Link>

          <Link
            href="/dashboard/cuidador/avaliacoes"
            className={`${contentCardClass} block transition hover:border-primary motion-reduce:transition-none`}
          >
            <h2 className="font-display text-lg font-semibold text-ink">
              Sua avaliação
            </h2>
            <p className="mt-1 font-mono text-sm text-muted">
              {averageRating !== null
                ? `${averageRating.toFixed(1)}/5 (${reviewCount} avaliação${reviewCount === 1 ? "" : "ões"})`
                : "Sem avaliações ainda"}
            </p>
          </Link>

          <Link
            href="/dashboard/cuidador/documentos"
            className={`${contentCardClass} block transition hover:border-primary motion-reduce:transition-none sm:col-span-2`}
          >
            <h2 className="font-display text-lg font-semibold text-ink">
              Documentos
            </h2>
            <p className="mt-1 text-sm text-muted">
              {documentCount === 0
                ? "Nenhum documento enviado ainda -- envie para começar a ser verificado(a)"
                : `${documentCount} documento${documentCount === 1 ? "" : "s"} enviado${documentCount === 1 ? "" : "s"}`}
            </p>
          </Link>
        </div>

        <div className="mt-8 space-y-2">
          <Link
            href="/dashboard/cuidador/perfil"
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
