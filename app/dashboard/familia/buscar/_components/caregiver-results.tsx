"use client";

import { CareType } from "@prisma/client";
import Link from "next/link";
import { useMemo, useState } from "react";

import { AvailabilityBadge } from "@/app/components/availability-badge";
import { AvatarPlaceholder } from "@/app/dashboard/familia/_components/avatar-placeholder";
import { MatchScoreRing } from "@/app/dashboard/familia/_components/match-score-ring";
import { ContratarButton } from "@/app/dashboard/familia/_components/contratar-button";
import { getSharedCareTypes } from "@/lib/care-types";
import type { RankedCaregiver } from "@/lib/matching";

const CARE_TYPE_LABELS: Record<string, string> = {
  ELDERLY: "Idosos",
  CHILD: "Crianças",
  SPECIAL_NEEDS: "Necessidades especiais",
};

type SortKey = "matchScore" | "distance" | "rating";

const SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: "distance", label: "Mais próximo" },
  { key: "rating", label: "Melhor avaliação" },
  { key: "matchScore", label: "Mais compatível" },
];

// Reordena a lista já carregada no lado do cliente -- distância/avaliação/
// matchScore já vêm em cada item retornado por rankCaregiversForFamily,
// então nenhuma chamada nova à API é necessária só para mudar a ordenação.
function sortResults(results: RankedCaregiver[], sortKey: SortKey): RankedCaregiver[] {
  const sorted = [...results];

  switch (sortKey) {
    case "distance":
      sorted.sort((a, b) => a.distanceKm - b.distanceKm);
      break;
    case "rating":
      // Cuidadores sem nenhuma review ainda (averageRating === null) ficam
      // por último na ordenação, não primeiro -- tratar "sem dado" como
      // "pior nota" seria enganoso.
      sorted.sort(
        (a, b) =>
          (b.caregiver.averageRating ?? -1) - (a.caregiver.averageRating ?? -1)
      );
      break;
    case "matchScore":
      sorted.sort((a, b) => b.matchScore - a.matchScore);
      break;
  }

  return sorted;
}

export function CaregiverResults({
  results,
  familyNeededCareTypes,
}: {
  results: RankedCaregiver[];
  familyNeededCareTypes: CareType[];
}) {
  const [sortKey, setSortKey] = useState<SortKey>("matchScore");
  const sorted = useMemo(() => sortResults(results, sortKey), [results, sortKey]);

  return (
    <div>
      <div className="mb-5 flex flex-wrap gap-2">
        {SORT_OPTIONS.map((option) => (
          <button
            key={option.key}
            type="button"
            onClick={() => setSortKey(option.key)}
            aria-pressed={sortKey === option.key}
            className={`rounded-full px-3 py-1.5 text-sm font-medium transition motion-reduce:transition-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${
              sortKey === option.key
                ? "bg-accent-light text-accent"
                : "border border-muted/40 bg-white text-muted hover:text-ink"
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>

      <div className="space-y-5">
        {sorted.map(({ caregiver, distanceKm, matchScore }) => (
          <div
            key={caregiver.id}
            className="rounded-card border border-muted/20 bg-white p-6 shadow-sm sm:p-8"
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-4">
                <AvatarPlaceholder name={caregiver.name} />
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="font-display text-xl font-semibold text-ink">
                      <Link
                        href={`/dashboard/profile/caregiver/${caregiver.userId}`}
                        className="hover:underline"
                      >
                        {caregiver.name ?? "Cuidador"}
                      </Link>
                    </h2>
                    <AvailabilityBadge status={caregiver.availabilityStatus} />
                  </div>
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
              <MatchScoreRing matchScore={matchScore} />
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

            <div className="mt-5 flex justify-end">
              <ContratarButton
                caregiverUserId={caregiver.userId}
                sharedCareTypes={getSharedCareTypes(
                  caregiver.careTypes,
                  familyNeededCareTypes
                )}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
