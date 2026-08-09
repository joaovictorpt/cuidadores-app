import { getServerSession } from "next-auth/next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { BackLink } from "@/app/dashboard/_components/back-link";
import { AvatarPlaceholder } from "@/app/dashboard/familia/_components/avatar-placeholder";
import { ConnectionLine } from "@/app/dashboard/familia/_components/connection-line";
import { ContratarButton } from "@/app/dashboard/familia/_components/contratar-button";
import { authOptions } from "@/lib/auth";
import { CARE_TYPE_LABELS, formatCareTypes } from "@/lib/care-types";
import { findMatchedCaregiverForFamily } from "@/lib/matching";
import { prisma } from "@/lib/prisma";
import { calculateAverageRating } from "@/lib/reviews";

// The Gale-Shapley stable match doesn't produce a 0-1 compatibility score
// like the weighted search does (see lib/matching.ts) -- it's a categorical
// "this is your matched caregiver" outcome. For the connection line's
// curvature (which only exists to vary with a score) we use a fixed,
// fairly taut value rather than computing a new score just for display:
// a stable match is by construction the best available pairing for this
// family, so a near-straight line fits without inventing new logic.
const STABLE_MATCH_VISUAL_SCORE = 0.9;

export default async function MatchRecomendadoPage() {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    redirect("/login");
  }

  const matchedCaregiver = await findMatchedCaregiverForFamily(session.user.id);

  const caregiverProfile = matchedCaregiver
    ? await prisma.caregiverProfile.findUnique({
        where: { userId: matchedCaregiver.caregiverUserId },
        include: {
          user: {
            select: { name: true, reviewsReceived: { select: { rating: true } } },
          },
        },
      })
    : null;

  const ratings = caregiverProfile?.user.reviewsReceived.map((r) => r.rating) ?? [];
  const { average: averageRating, total: ratingCount } = calculateAverageRating(ratings);

  return (
    <main className="min-h-screen bg-background px-4 py-12">
      <div className="mx-auto max-w-2xl">
        <BackLink href="/dashboard/familia" />

        <h1 className="mb-1 font-display text-3xl font-semibold text-ink">
          Match recomendado
        </h1>
        <p className="mb-6 text-sm text-muted">
          O cuidador mais compatível com o seu perfil, considerando todas as
          famílias e cuidadores disponíveis no momento.
        </p>

        {!caregiverProfile && (
          <p className="text-sm text-muted">
            Nenhum cuidador foi designado a você nesta rodada de matching.
          </p>
        )}

        {caregiverProfile && matchedCaregiver && (
          <div className="rounded-card border border-muted/20 bg-white p-6 shadow-sm sm:p-8">
            <div className="flex items-start gap-4">
              <AvatarPlaceholder name={caregiverProfile.user.name} />
              <div>
                <h2 className="font-display text-xl font-semibold text-ink">
                  <Link
                    href={`/dashboard/profile/caregiver/${matchedCaregiver.caregiverUserId}`}
                    className="hover:underline"
                  >
                    {caregiverProfile.user.name ?? "Cuidador"}
                  </Link>
                </h2>
                {caregiverProfile.bio && (
                  <p className="mt-1 text-sm text-muted">{caregiverProfile.bio}</p>
                )}
                <p className="mt-2 text-xs text-muted">
                  {caregiverProfile.careTypes
                    .map((type) => CARE_TYPE_LABELS[type] ?? type)
                    .join(", ")}
                </p>
                <p className="mt-2 font-mono text-xs text-ink/80">
                  {matchedCaregiver.distanceKm !== null
                    ? `${matchedCaregiver.distanceKm.toFixed(1)} km de distância`
                    : "Distância não disponível"}
                  {matchedCaregiver.sharedCareTypes.length > 0 &&
                    ` · Atende ${formatCareTypes(matchedCaregiver.sharedCareTypes)}`}
                </p>
              </div>
            </div>

            <dl className="mt-5 grid grid-cols-2 gap-4">
              <div>
                <dt className="text-xs text-muted">Avaliação</dt>
                <dd className="font-mono text-sm text-ink/80">
                  {averageRating !== null
                    ? `${averageRating.toFixed(1)}/5 (${ratingCount})`
                    : "—"}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-muted">Valor/hora</dt>
                <dd className="font-mono text-sm text-ink/80">
                  {caregiverProfile.hourlyRate
                    ? `R$ ${Number(caregiverProfile.hourlyRate).toFixed(2)}`
                    : "—"}
                </dd>
              </div>
            </dl>

            <div className="mt-5 flex items-center justify-between">
              <ConnectionLine matchScore={STABLE_MATCH_VISUAL_SCORE} />
              <ContratarButton caregiverUserId={matchedCaregiver.caregiverUserId} />
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
