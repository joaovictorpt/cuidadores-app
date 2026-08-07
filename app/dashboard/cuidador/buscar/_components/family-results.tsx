"use client";

import { useMemo, useState } from "react";

import { AvatarPlaceholder } from "@/app/dashboard/familia/_components/avatar-placeholder";
import { MatchScoreRing } from "@/app/dashboard/familia/_components/match-score-ring";
import { InteresseButton } from "@/app/dashboard/cuidador/_components/interesse-button";
import type { FamilyForDisplay, RankedFamily } from "@/lib/matching";

const CARE_TYPE_LABELS: Record<string, string> = {
  ELDERLY: "Idosos",
  CHILD: "Crianças",
  SPECIAL_NEEDS: "Necessidades especiais",
};

// Only two sort options, not three like CaregiverResults -- FamilyForDisplay
// carries no rating (families aren't reviewed), so a "Melhor avaliação"
// pill would have nothing real to sort by. Fabricating one would break the
// project's "never invent a number that looks real" rule (see CLAUDE.md
// "Sistema de design").
type SortKey = "matchScore" | "distance";

const SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: "distance", label: "Mais próximo" },
  { key: "matchScore", label: "Mais compatível" },
];

function sortResults(
  results: RankedFamily<FamilyForDisplay>[],
  sortKey: SortKey
): RankedFamily<FamilyForDisplay>[] {
  const sorted = [...results];

  switch (sortKey) {
    case "distance":
      sorted.sort((a, b) => a.distanceKm - b.distanceKm);
      break;
    case "matchScore":
      sorted.sort((a, b) => b.matchScore - a.matchScore);
      break;
  }

  return sorted;
}

export function FamilyResults({
  results,
}: {
  results: RankedFamily<FamilyForDisplay>[];
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
        {sorted.map(({ family, distanceKm, matchScore }) => (
          <div
            key={family.userId}
            className="rounded-card border border-muted/20 bg-white p-6 shadow-sm sm:p-8"
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-4">
                <AvatarPlaceholder name={family.name} />
                <div>
                  <h2 className="font-display text-xl font-semibold text-ink">
                    {family.name ?? "Família"}
                  </h2>
                  <p className="mt-1 text-sm text-muted">
                    {[family.city, family.state].filter(Boolean).join(", ")}
                  </p>
                  <p className="mt-2 text-xs text-muted">
                    {family.neededCareTypes
                      .map((type) => CARE_TYPE_LABELS[type] ?? type)
                      .join(", ")}
                  </p>
                </div>
              </div>
              <MatchScoreRing matchScore={matchScore} />
            </div>

            <dl className="mt-5">
              <div>
                <dt className="text-xs text-muted">Distância</dt>
                <dd className="font-mono text-sm text-ink/80">
                  {distanceKm.toFixed(1)} km
                </dd>
              </div>
            </dl>

            <div className="mt-5 flex justify-end">
              <InteresseButton familyUserId={family.userId} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
