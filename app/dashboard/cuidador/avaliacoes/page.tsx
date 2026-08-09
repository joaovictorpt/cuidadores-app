import { getServerSession } from "next-auth/next";
import { redirect } from "next/navigation";

import { StarRating } from "@/app/components/star-rating";
import { BackLink } from "@/app/dashboard/_components/back-link";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { formatRelativeTime } from "@/lib/relative-time";
import { calculateAverageRating } from "@/lib/reviews";
import { metaTextClass } from "@/lib/ui";

export default async function AvaliacoesPage() {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    redirect("/login");
  }

  const reviews = await prisma.review.findMany({
    where: { targetId: session.user.id },
    include: { author: { select: { name: true } } },
    orderBy: { createdAt: "desc" },
  });

  const { average, total } = calculateAverageRating(
    reviews.map((review) => review.rating)
  );

  return (
    <main className="min-h-screen bg-background px-4 py-12">
      <div className="mx-auto max-w-2xl">
        <BackLink href="/dashboard/cuidador" />

        <h1 className="mb-1 font-display text-3xl font-semibold text-ink">
          Avaliações recebidas
        </h1>
        <p className="mb-6 text-sm text-muted">
          {average !== null
            ? `Média de ${average.toFixed(1)}/5 em ${total} avaliação${total === 1 ? "" : "ões"}`
            : "Você ainda não recebeu avaliações."}
        </p>

        <div className="space-y-4">
          {reviews.map((review) => (
            <div
              key={review.id}
              className="rounded-card border border-muted/20 bg-white p-6 shadow-sm"
            >
              <div className="flex items-start justify-between gap-4">
                <h2 className="font-display text-lg font-semibold text-ink">
                  {review.author.name ?? "Família"}
                </h2>
                <StarRating value={review.rating} readOnly />
              </div>
              <p className="mt-2 text-sm text-ink/80">
                {review.comment || "Sem comentário"}
              </p>
              <span
                className={`mt-2 inline-block ${metaTextClass}`}
                title={review.createdAt.toLocaleString("pt-BR")}
              >
                {formatRelativeTime(review.createdAt)}
              </span>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
