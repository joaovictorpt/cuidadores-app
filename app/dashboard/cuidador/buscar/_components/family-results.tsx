"use client";

import { CareType } from "@prisma/client";
import Link from "next/link";
import { useMemo, useState } from "react";

import { CareTypeTags } from "@/app/components/care-type-tags";
import { AvatarPlaceholder } from "@/app/dashboard/familia/_components/avatar-placeholder";
import { MatchScoreRing } from "@/app/dashboard/familia/_components/match-score-ring";
import { InteresseButton } from "@/app/dashboard/cuidador/_components/interesse-button";
import { getSharedCareTypes } from "@/lib/care-types";
import type { FamilyForDisplay, RankedFamily } from "@/lib/matching";

// Same length used for any other card-level bio truncation in the app
// (there's no prior precedent to match -- this is the first card that
// shows a bio -- so this is a fresh choice, not a reused constant): long
// enough to give a real sense of what the family is looking for, short
// enough that the card doesn't grow taller than its neighbors. Full text
// is always one click away on the family's profile page.
const BIO_PREVIEW_LENGTH = 120;

function truncateBio(bio: string): string {
  if (bio.length <= BIO_PREVIEW_LENGTH) {
    return bio;
  }

  return `${bio.slice(0, BIO_PREVIEW_LENGTH).trimEnd()}…`;
}

function formatHourlyBudget(hourlyBudget: number | null): string {
  return hourlyBudget !== null
    ? `Até R$ ${hourlyBudget.toFixed(2)}/h`
    : "Orçamento não informado";
}

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
  caregiverCareTypes,
}: {
  results: RankedFamily<FamilyForDisplay>[];
  caregiverCareTypes: CareType[];
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
                    <Link
                      href={`/dashboard/profile/family/${family.userId}`}
                      className="hover:underline"
                    >
                      {family.name ?? "Família"}
                    </Link>
                  </h2>
                  <p className="mt-1 text-sm text-muted">
                    {[family.city, family.state].filter(Boolean).join(", ")}
                  </p>
                  <CareTypeTags careTypes={family.neededCareTypes} />
                  {family.bio && (
                    <div className="mt-2">
                      <p className="text-xs font-medium uppercase text-muted">
                        O que a família procura
                      </p>
                      <p className="mt-1 text-sm text-ink/80">
                        {truncateBio(family.bio)}
                      </p>
                    </div>
                  )}
                </div>
              </div>
              <MatchScoreRing matchScore={matchScore} />
            </div>

            <dl className="mt-5 grid grid-cols-2 gap-4">
              <div>
                <dt className="text-xs text-muted">Distância</dt>
                <dd className="font-mono text-sm text-ink/80">
                  {distanceKm.toFixed(1)} km
                </dd>
              </div>
              <div>
                <dt className="text-xs text-muted">Orçamento</dt>
                <dd className="font-mono text-sm text-ink/80">
                  {formatHourlyBudget(family.hourlyBudget)}
                </dd>
              </div>
            </dl>

            <div className="mt-5 flex justify-end">
              <InteresseButton
                familyUserId={family.userId}
                sharedCareTypes={getSharedCareTypes(
                  caregiverCareTypes,
                  family.neededCareTypes
                )}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
