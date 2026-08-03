import { CareType, FamilyProfile } from "@prisma/client";

import { stableMatching } from "@/lib/gale-shapley";
import { haversineDistanceKm } from "@/lib/haversine";
import { matchingConfig } from "@/lib/matching-config";
import { prisma } from "@/lib/prisma";
import { calculateAverageRating } from "@/lib/reviews";

export type CaregiverForMatching = {
  id: string;
  userId: string;
  name: string | null;
  bio: string | null;
  hourlyRate: number | null;
  careTypes: CareType[];
  latitude: number | null;
  longitude: number | null;
  averageRating: number | null;
  reviewCount: number;
};

export type FamilyForMatching = {
  latitude: number | null;
  longitude: number | null;
  neededCareTypes: CareType[];
};

// Same as FamilyForMatching, but carrying an identity (the User id) so it
// can be used as a proposer/receiver-preference key. rankCaregiversForFamily
// doesn't need this (it only ever handles one family at a time), but the
// preference-building functions below rank many families against each
// other, so they need something to tell them apart.
export type FamilyCandidate = FamilyForMatching & {
  userId: string;
};

export type RankedCaregiver = {
  caregiver: CaregiverForMatching;
  distanceKm: number;
  matchScore: number;
};

// Shared eligibility rule, used both when a family is looking for
// caregivers and when a caregiver is looking for families: both directions
// of the bipartite graph must agree on which edges exist at all, otherwise
// the two sides' preference lists wouldn't even be talking about the same
// set of possible pairs.
function isEligiblePair(
  familyProfile: FamilyForMatching,
  caregiver: CaregiverForMatching
): boolean {
  if (
    familyProfile.latitude === null ||
    familyProfile.longitude === null ||
    caregiver.latitude === null ||
    caregiver.longitude === null
  ) {
    return false;
  }

  const distanceKm = haversineDistanceKm(
    familyProfile.latitude,
    familyProfile.longitude,
    caregiver.latitude,
    caregiver.longitude
  );

  if (distanceKm > matchingConfig.maxDistanceKm) {
    return false;
  }

  return caregiver.careTypes.some((type) =>
    familyProfile.neededCareTypes.includes(type)
  );
}

export function findCandidateCaregivers(
  familyProfile: FamilyForMatching,
  allCaregivers: CaregiverForMatching[]
): CaregiverForMatching[] {
  return allCaregivers.filter((caregiver) =>
    isEligiblePair(familyProfile, caregiver)
  );
}

export function findCandidateFamilies(
  caregiver: CaregiverForMatching,
  allFamilies: FamilyCandidate[]
): FamilyCandidate[] {
  return allFamilies.filter((familyProfile) =>
    isEligiblePair(familyProfile, caregiver)
  );
}

function computePriceScore(
  caregiver: CaregiverForMatching,
  allCandidates: CaregiverForMatching[]
): number {
  if (caregiver.hourlyRate === null) {
    return 0.5;
  }

  const rates = allCandidates
    .map((candidate) => candidate.hourlyRate)
    .filter((rate): rate is number => rate !== null);

  if (rates.length <= 1) {
    return 0.5;
  }

  const min = Math.min(...rates);
  const max = Math.max(...rates);

  if (max === min) {
    return 0.5;
  }

  return 1 - (caregiver.hourlyRate - min) / (max - min);
}

export function computeMatchScore(
  familyProfile: FamilyForMatching,
  caregiver: CaregiverForMatching,
  allCandidates: CaregiverForMatching[]
): number {
  const distanceKm = haversineDistanceKm(
    familyProfile.latitude!,
    familyProfile.longitude!,
    caregiver.latitude!,
    caregiver.longitude!
  );
  const distanceScore = Math.max(
    0,
    1 - distanceKm / matchingConfig.maxDistanceKm
  );

  const sharedCareTypes = caregiver.careTypes.filter((type) =>
    familyProfile.neededCareTypes.includes(type)
  ).length;
  const careTypeScore =
    familyProfile.neededCareTypes.length > 0
      ? sharedCareTypes / familyProfile.neededCareTypes.length
      : 0;

  const ratingScore =
    caregiver.averageRating !== null
      ? caregiver.averageRating / 5
      : matchingConfig.defaultRatingWhenNoReviews;

  const priceScore = computePriceScore(caregiver, allCandidates);

  const { weights } = matchingConfig;

  return (
    weights.distance * distanceScore +
    weights.careTypeCompatibility * careTypeScore +
    weights.rating * ratingScore +
    weights.price * priceScore
  );
}

// Pure, synchronous core shared by rankCaregiversForFamily (single family,
// fetches its own data from Prisma) and buildFamilyPreferences (many
// families, caregivers already fetched once by the caller).
function rankCaregiversAgainstList(
  familyProfile: FamilyForMatching,
  allCaregivers: CaregiverForMatching[]
): RankedCaregiver[] {
  const candidates = findCandidateCaregivers(familyProfile, allCaregivers);

  const ranked = candidates.map((caregiver) => {
    const distanceKm = haversineDistanceKm(
      familyProfile.latitude!,
      familyProfile.longitude!,
      caregiver.latitude!,
      caregiver.longitude!
    );
    const matchScore = computeMatchScore(familyProfile, caregiver, candidates);

    return { caregiver, distanceKm, matchScore };
  });

  ranked.sort((a, b) => b.matchScore - a.matchScore);

  return ranked;
}

function toCaregiverForMatching(profile: {
  id: string;
  userId: string;
  bio: string | null;
  hourlyRate: unknown;
  careTypes: CareType[];
  latitude: number | null;
  longitude: number | null;
  user: { name: string | null; reviewsReceived: { rating: number }[] };
}): CaregiverForMatching {
  const ratings = profile.user.reviewsReceived.map((review) => review.rating);
  const { average: averageRating, total: reviewCount } =
    calculateAverageRating(ratings);

  return {
    id: profile.id,
    userId: profile.userId,
    name: profile.user.name,
    bio: profile.bio,
    hourlyRate: profile.hourlyRate ? Number(profile.hourlyRate) : null,
    careTypes: profile.careTypes,
    latitude: profile.latitude,
    longitude: profile.longitude,
    averageRating,
    reviewCount,
  };
}

async function fetchAllCaregiversForMatching(): Promise<CaregiverForMatching[]> {
  const caregiverProfiles = await prisma.caregiverProfile.findMany({
    include: {
      user: {
        select: {
          name: true,
          reviewsReceived: { select: { rating: true } },
        },
      },
    },
  });

  return caregiverProfiles.map(toCaregiverForMatching);
}

export async function rankCaregiversForFamily(
  familyProfile: FamilyProfile
): Promise<RankedCaregiver[]> {
  const family: FamilyForMatching = {
    latitude: familyProfile.latitude,
    longitude: familyProfile.longitude,
    neededCareTypes: familyProfile.neededCareTypes,
  };

  const allCaregivers = await fetchAllCaregiversForMatching();

  return rankCaregiversAgainstList(family, allCaregivers);
}

// For each family, the caregivers eligible for them ranked by
// computeMatchScore -- this is exactly what rankCaregiversForFamily
// computes for one family, reused here (as a synchronous helper, since the
// caregiver list is already fetched once for all families instead of
// re-querying Prisma per family).
export function buildFamilyPreferences(
  families: FamilyCandidate[],
  caregivers: CaregiverForMatching[]
): Map<string, string[]> {
  const preferences = new Map<string, string[]>();

  for (const family of families) {
    const ranked = rankCaregiversAgainstList(family, caregivers);
    preferences.set(
      family.userId,
      ranked.map((entry) => entry.caregiver.userId)
    );
  }

  return preferences;
}

// For each caregiver, the families eligible for them ranked by the SAME
// computeMatchScore formula, just with the roles of "which side varies"
// swapped. Note: since the caregiver is fixed while looping over families,
// the rating and price components of the score are constant across all of
// that caregiver's candidate families (they don't depend on the family at
// all) -- only distance and care-type compatibility actually vary and
// drive the ranking. That's a direct, honest consequence of reusing the
// same edge-weight formula from both directions rather than inventing a
// separate caregiver-side formula, exactly as specified.
export function buildCaregiverPreferences(
  caregivers: CaregiverForMatching[],
  families: FamilyCandidate[]
): Map<string, string[]> {
  const preferences = new Map<string, string[]>();

  for (const caregiver of caregivers) {
    const eligibleFamilies = findCandidateFamilies(caregiver, families);

    const scored = eligibleFamilies.map((family) => {
      // Reuse that family's own eligible-caregiver pool for price
      // normalization, so the price component means the same thing here
      // as it would in that family's own search -- computeMatchScore's
      // `allCandidates` argument only ever affects the price score.
      const candidatesForThisFamily = findCandidateCaregivers(
        family,
        caregivers
      );
      const score = computeMatchScore(family, caregiver, candidatesForThisFamily);
      return { familyUserId: family.userId, score };
    });

    scored.sort((a, b) => b.score - a.score);

    preferences.set(
      caregiver.userId,
      scored.map((entry) => entry.familyUserId)
    );
  }

  return preferences;
}

export async function runStableMatchingForAllFamilies(): Promise<
  Map<string, string[]>
> {
  const [familyProfiles, caregivers] = await Promise.all([
    prisma.familyProfile.findMany(),
    fetchAllCaregiversForMatching(),
  ]);

  // There's no "active" flag on User/FamilyProfile/CaregiverProfile in the
  // schema today, so "active families and caregivers" is interpreted here
  // as simply every profile that currently exists.
  const families: FamilyCandidate[] = familyProfiles.map((profile) => ({
    userId: profile.userId,
    latitude: profile.latitude,
    longitude: profile.longitude,
    neededCareTypes: profile.neededCareTypes,
  }));

  const proposerPreferences = buildFamilyPreferences(families, caregivers);
  const receiverPreferences = buildCaregiverPreferences(caregivers, families);

  return stableMatching({
    proposers: families.map((family) => family.userId),
    receivers: caregivers.map((caregiver) => caregiver.userId),
    proposerPreferences,
    receiverPreferences,
    receiverCapacity: matchingConfig.caregiverCapacity,
  });
}

// Runs the global stable matching and picks out just the one result a
// single family cares about -- shared by /dashboard/familia/match-recomendado
// and the family dashboard's summary card, so the "which caregiver did I get
// matched with" lookup only lives in one place.
export async function findMatchedCaregiverForFamily(
  familyUserId: string
): Promise<string | null> {
  const matchesByCaregiver = await runStableMatchingForAllFamilies();

  for (const [caregiverUserId, familyUserIds] of matchesByCaregiver) {
    if (familyUserIds.includes(familyUserId)) {
      return caregiverUserId;
    }
  }

  return null;
}
