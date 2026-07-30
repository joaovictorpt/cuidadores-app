import { getServerSession } from "next-auth/next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { BackLink } from "@/app/dashboard/_components/back-link";
import { ConnectionLine } from "@/app/dashboard/familia/_components/connection-line";
import { ContratarButton } from "@/app/dashboard/familia/_components/contratar-button";
import { authOptions } from "@/lib/auth";
import { rankCaregiversForFamily } from "@/lib/matching";
import { matchingConfig } from "@/lib/matching-config";
import { prisma } from "@/lib/prisma";
import { errorTextClass, primaryButtonClass } from "@/lib/ui";

const CARE_TYPE_LABELS: Record<string, string> = {
  ELDERLY: "Idosos",
  CHILD: "Crianças",
  SPECIAL_NEEDS: "Necessidades especiais",
};

export default async function BuscarCuidadoresPage() {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    redirect("/login");
  }

  const familyProfile = await prisma.familyProfile.findUnique({
    where: { userId: session.user.id },
  });

  const missingLocation =
    !familyProfile ||
    familyProfile.latitude === null ||
    familyProfile.longitude === null;

  const missingCareTypes =
    familyProfile !== null &&
    !missingLocation &&
    familyProfile.neededCareTypes.length === 0;

  const ranked =
    !missingLocation && !missingCareTypes
      ? await rankCaregiversForFamily(familyProfile)
      : [];

  return (
    <main className="min-h-screen bg-background px-4 py-12">
      <div className="mx-auto max-w-2xl">
        <BackLink href="/dashboard/familia" />

        <h1 className="mb-6 font-display text-3xl font-semibold text-ink">
          Buscar cuidadores
        </h1>

        {missingLocation && (
          <p className={errorTextClass}>
            Complete seu endereço no perfil para buscar cuidadores próximos.
          </p>
        )}

        {missingCareTypes && (
          <div className="rounded-card border border-primary/20 bg-primary-light p-6 text-center">
            <p className="text-sm text-ink">
              Complete seu perfil com os tipos de cuidado que você procura
              antes de buscar cuidadores.
            </p>
            <Link
              href="/dashboard/familia/perfil"
              className={`${primaryButtonClass} mt-4 inline-block w-auto px-6`}
            >
              Completar perfil
            </Link>
          </div>
        )}

        {!missingLocation && !missingCareTypes && ranked.length === 0 && (
          <p className="text-sm text-muted">
            Nenhum cuidador encontrado a até {matchingConfig.maxDistanceKm}km
            com os tipos de cuidado que você procura.
          </p>
        )}

        <div className="space-y-5">
          {ranked.map(({ caregiver, distanceKm, matchScore }) => (
            <div
              key={caregiver.id}
              className="rounded-card border border-muted/20 bg-white p-6 shadow-sm sm:p-8"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-4">
                  <div
                    aria-hidden="true"
                    className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-primary-light font-display text-lg font-semibold text-primary"
                  >
                    {(caregiver.name ?? "C").charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <h2 className="font-display text-xl font-semibold text-ink">
                      {caregiver.name ?? "Cuidador"}
                    </h2>
                    {caregiver.bio && (
                      <p className="mt-1 text-sm text-muted">{caregiver.bio}</p>
                    )}
                    <p className="mt-2 text-xs text-muted">
                      {caregiver.careTypes
                        .map((type) => CARE_TYPE_LABELS[type] ?? type)
                        .join(", ")}
                    </p>
                  </div>
                </div>
                <span className="shrink-0 rounded-full bg-primary-light px-3 py-1 font-mono text-sm font-medium text-primary">
                  {Math.round(matchScore * 100)}%
                </span>
              </div>

              <dl className="mt-5 grid grid-cols-3 gap-4">
                <div>
                  <dt className="text-xs text-muted">Distância</dt>
                  <dd className="font-mono text-sm text-ink/80">
                    {distanceKm.toFixed(1)} km
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-muted">Avaliação</dt>
                  <dd className="font-mono text-sm text-ink/80">
                    {caregiver.averageRating !== null
                      ? `${caregiver.averageRating.toFixed(1)}/5 (${caregiver.reviewCount})`
                      : "—"}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-muted">Valor/hora</dt>
                  <dd className="font-mono text-sm text-ink/80">
                    {caregiver.hourlyRate !== null
                      ? `R$ ${caregiver.hourlyRate.toFixed(2)}`
                      : "—"}
                  </dd>
                </div>
              </dl>

              <div className="mt-5 flex items-center justify-between">
                <ConnectionLine matchScore={matchScore} />
                <ContratarButton caregiverUserId={caregiver.userId} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
