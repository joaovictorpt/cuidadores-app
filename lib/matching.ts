import { CareType, CaregiverProfile, FamilyProfile } from "@prisma/client";

import { getSharedCareTypes } from "@/lib/care-types";
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
  hourlyBudget: number | null;
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

// FamilyCandidate plus the fields needed to actually show a family to a
// caregiver (rankFamiliesForCaregiver / GET /api/search/families). Notably
// missing: `address` -- full street address is never exposed to a
// caregiver browsing/matched-with families, only city/state (see CLAUDE.md
// "Busca de famílias pelo cuidador").
export type FamilyForDisplay = FamilyCandidate & {
  name: string | null;
  city: string | null;
  state: string | null;
  bio: string | null;
};

export type RankedFamily<F extends FamilyCandidate = FamilyCandidate> = {
  family: F;
  distanceKm: number;
  matchScore: number;
};

// Null-safe Haversine wrapper -- coordinates are always optional (Float?)
// on both profile models, so any caller working with a raw Prisma record
// (rather than an already-validated matching candidate) needs this guard.
// Used by the "matched pair" lookups below, whose distanceKm is display-only
// and thus allowed to be "not available" instead of throwing.
function distanceKmOrNull(
  aLat: number | null | undefined,
  aLon: number | null | undefined,
  bLat: number | null | undefined,
  bLon: number | null | undefined
): number | null {
  if (aLat == null || aLon == null || bLat == null || bLon == null) {
    return null;
  }

  return haversineDistanceKm(aLat, aLon, bLat, bLon);
}

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

// Generic over F so it works both with the minimal FamilyCandidate (Gale-
// Shapley preference building, which only needs the userId back) and with
// richer display-oriented shapes like FamilyForDisplay (rankFamiliesForCaregiver,
// which also needs name/city/state to show) -- the filter preserves
// whatever shape it's given.
export function findCandidateFamilies<F extends FamilyForMatching>(
  caregiver: CaregiverForMatching,
  allFamilies: F[]
): F[] {
  return allFamilies.filter((familyProfile) =>
    isEligiblePair(familyProfile, caregiver)
  );
}

// Three-layer fallback, in priority order:
//  1. The family declared a real `hourlyBudget` -- compare the caregiver's
//     actual rate against it. At or under budget scores a perfect 1.0;
//     over budget decays linearly and floors at 0 once the rate is double
//     the budget (rate - budget >= budget). This is the only layer that
//     reflects what the family actually said they can afford.
//  2. No budget declared, but the caller supplied a pool of other
//     candidates' rates -- fall back to the previous behavior (relative
//     min/max normalization within that pool), so a caregiver's price
//     score still says *something* ("cheap relative to the alternatives")
//     even without a stated budget.
//  3. Neither -- nothing to compare against, so the price component can't
//     discriminate at all. Reuses matchingConfig.defaultRatingWhenNoReviews
//     rather than a separate magic constant, since it means the same thing
//     structurally: "no data, so don't penalize or reward, stay neutral."
export function computePriceScore(
  caregiverRate: number | null,
  familyBudget: number | null,
  candidateRatesForFallback?: number[]
): number {
  if (caregiverRate === null) {
    return matchingConfig.defaultRatingWhenNoReviews;
  }

  if (familyBudget !== null) {
    if (caregiverRate <= familyBudget) {
      return 1;
    }

    return Math.max(0, 1 - (caregiverRate - familyBudget) / familyBudget);
  }

  if (candidateRatesForFallback !== undefined) {
    const rates = candidateRatesForFallback;

    if (rates.length <= 1) {
      return matchingConfig.defaultRatingWhenNoReviews;
    }

    const min = Math.min(...rates);
    const max = Math.max(...rates);

    if (max === min) {
      return matchingConfig.defaultRatingWhenNoReviews;
    }

    return 1 - (caregiverRate - min) / (max - min);
  }

  return matchingConfig.defaultRatingWhenNoReviews;
}

// `allCandidates` is optional and, when provided, only ever feeds
// computePriceScore's layer-2 fallback (relative rate normalization) --
// see that function's comment for when each layer applies. Whether to pass
// it is a per-caller decision: rankCaregiversAgainstList (family searching
// caregivers) does, rankFamiliesAgainstList (caregiver searching families)
// deliberately doesn't, so the two sides of the graph can have different
// fallback behavior when no budget is declared.
export function computeMatchScore(
  familyProfile: FamilyForMatching,
  caregiver: CaregiverForMatching,
  allCandidates?: CaregiverForMatching[]
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

  const sharedCareTypeCount = getSharedCareTypes(
    caregiver.careTypes,
    familyProfile.neededCareTypes
  ).length;
  const careTypeScore =
    familyProfile.neededCareTypes.length > 0
      ? sharedCareTypeCount / familyProfile.neededCareTypes.length
      : 0;

  const ratingScore =
    caregiver.averageRating !== null
      ? caregiver.averageRating / 5
      : matchingConfig.defaultRatingWhenNoReviews;

  const candidateRates = allCandidates
    ?.map((candidate) => candidate.hourlyRate)
    .filter((rate): rate is number => rate !== null);

  const priceScore = computePriceScore(
    caregiver.hourlyRate,
    familyProfile.hourlyBudget,
    candidateRates
  );

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

// Mirrors rankCaregiversAgainstList's role, but for the other direction of
// the bipartite graph: pure, synchronous core shared by
// buildCaregiverPreferences (many caregivers, ranking each against all
// families for Gale-Shapley preference lists) and rankFamiliesForCaregiver
// (single caregiver, fetches its own data from Prisma). Generic over F so
// callers can pass either the minimal FamilyCandidate (Gale-Shapley only
// needs userId back) or the richer FamilyForDisplay (search needs
// name/city/state too) and get that same shape back on `family`.
function rankFamiliesAgainstList<F extends FamilyCandidate>(
  caregiver: CaregiverForMatching,
  allFamilies: F[]
): RankedFamily<F>[] {
  const eligibleFamilies = findCandidateFamilies(caregiver, allFamilies);

  const ranked = eligibleFamilies.map((family) => {
    const distanceKm = haversineDistanceKm(
      family.latitude!,
      family.longitude!,
      caregiver.latitude!,
      caregiver.longitude!
    );
    // No candidateRatesForFallback passed here on purpose -- unlike the
    // family side (rankCaregiversAgainstList), this direction never falls
    // back to relative rate normalization against other caregivers when a
    // family hasn't declared a budget; it just goes neutral. See
    // computePriceScore's comment for the full fallback order.
    const matchScore = computeMatchScore(family, caregiver);

    return { family, distanceKm, matchScore };
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
    hourlyBudget: familyProfile.hourlyBudget
      ? Number(familyProfile.hourlyBudget)
      : null,
  };

  const allCaregivers = await fetchAllCaregiversForMatching();

  return rankCaregiversAgainstList(family, allCaregivers);
}

async function fetchAllFamiliesForDisplay(): Promise<FamilyForDisplay[]> {
  const familyProfiles = await prisma.familyProfile.findMany({
    include: { user: { select: { name: true } } },
  });

  return familyProfiles.map((profile) => ({
    userId: profile.userId,
    name: profile.user.name,
    city: profile.city,
    state: profile.state,
    bio: profile.bio,
    latitude: profile.latitude,
    longitude: profile.longitude,
    neededCareTypes: profile.neededCareTypes,
    hourlyBudget: profile.hourlyBudget ? Number(profile.hourlyBudget) : null,
  }));
}

// Mirrors rankCaregiversForFamily on the other side of the graph: the
// search used by GET /api/search/families. Returns FamilyForDisplay (no
// `address`, see that type's comment) -- a caregiver browsing families
// never gets a family's full street address, only city/state, distance,
// and what they're looking for.
export async function rankFamiliesForCaregiver(
  caregiverProfile: CaregiverProfile
): Promise<RankedFamily<FamilyForDisplay>[]> {
  const user = await prisma.user.findUnique({
    where: { id: caregiverProfile.userId },
    select: { name: true, reviewsReceived: { select: { rating: true } } },
  });

  const ratings = user?.reviewsReceived.map((review) => review.rating) ?? [];
  const { average: averageRating, total: reviewCount } =
    calculateAverageRating(ratings);

  const caregiver: CaregiverForMatching = {
    id: caregiverProfile.id,
    userId: caregiverProfile.userId,
    name: user?.name ?? null,
    bio: caregiverProfile.bio,
    hourlyRate: caregiverProfile.hourlyRate
      ? Number(caregiverProfile.hourlyRate)
      : null,
    careTypes: caregiverProfile.careTypes,
    latitude: caregiverProfile.latitude,
    longitude: caregiverProfile.longitude,
    averageRating,
    reviewCount,
  };

  const allFamilies = await fetchAllFamiliesForDisplay();

  return rankFamiliesAgainstList(caregiver, allFamilies);
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
// the rating component of the score is constant across all of that
// caregiver's candidate families (it's a property of the caregiver, not the
// family). Price, since hourlyBudget was added, is no longer always
// constant here: a family with a declared budget produces a real
// budget-vs-rate comparison that varies per family, while a family without
// one falls back to the neutral score (see computePriceScore) -- so price
// only stays constant across candidates when none of them declared a
// budget. Distance and care-type compatibility always vary and drive the
// ranking regardless. That's a direct, honest consequence of reusing the
// same edge-weight formula from both directions rather than inventing a
// separate caregiver-side formula, exactly as specified.
export function buildCaregiverPreferences(
  caregivers: CaregiverForMatching[],
  families: FamilyCandidate[]
): Map<string, string[]> {
  const preferences = new Map<string, string[]>();

  for (const caregiver of caregivers) {
    const ranked = rankFamiliesAgainstList(caregiver, families);

    preferences.set(
      caregiver.userId,
      ranked.map((entry) => entry.family.userId)
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
    hourlyBudget: profile.hourlyBudget ? Number(profile.hourlyBudget) : null,
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
//
// distanceKm/sharedCareTypes are display-only extras (not used by the
// matching algorithm itself, which already ran by the time this is
// computed) -- added so match-recomendado can show a real fact instead of a
// fabricated "Recomendado" badge. Both are effectively guaranteed
// non-null/non-empty for an actual stable match (isEligiblePair already
// required non-null coordinates and overlapping care types for this pair to
// be eligible in the first place), but typed loosely since this reads the
// profiles fresh rather than reusing that guarantee.
export type MatchedCaregiverForFamily = {
  caregiverUserId: string;
  distanceKm: number | null;
  sharedCareTypes: CareType[];
};

export async function findMatchedCaregiverForFamily(
  familyUserId: string
): Promise<MatchedCaregiverForFamily | null> {
  const matchesByCaregiver = await runStableMatchingForAllFamilies();

  let matchedCaregiverUserId: string | null = null;
  for (const [caregiverUserId, familyUserIds] of matchesByCaregiver) {
    if (familyUserIds.includes(familyUserId)) {
      matchedCaregiverUserId = caregiverUserId;
      break;
    }
  }

  if (!matchedCaregiverUserId) {
    return null;
  }

  const [familyProfile, caregiverProfile] = await Promise.all([
    prisma.familyProfile.findUnique({
      where: { userId: familyUserId },
      select: { latitude: true, longitude: true, neededCareTypes: true },
    }),
    prisma.caregiverProfile.findUnique({
      where: { userId: matchedCaregiverUserId },
      select: { latitude: true, longitude: true, careTypes: true },
    }),
  ]);

  const distanceKm = distanceKmOrNull(
    familyProfile?.latitude,
    familyProfile?.longitude,
    caregiverProfile?.latitude,
    caregiverProfile?.longitude
  );

  const sharedCareTypes =
    familyProfile && caregiverProfile
      ? getSharedCareTypes(caregiverProfile.careTypes, familyProfile.neededCareTypes)
      : [];

  return { caregiverUserId: matchedCaregiverUserId, distanceKm, sharedCareTypes };
}

// Privacy-limited shape for a family matched to a caregiver via stable
// matching -- same field set as GET /api/search/families (no `address`,
// see FamilyForDisplay), but without a 0-1 `matchScore` since Gale-Shapley
// doesn't produce one the way the weighted search does (same reasoning as
// the family-side stable-match route). distanceKm/sharedCareTypes are the
// same display-only extras as MatchedCaregiverForFamily above.
export type MatchedFamilyForCaregiver = {
  familyId: string;
  name: string | null;
  city: string | null;
  state: string | null;
  neededCareTypes: CareType[];
  distanceKm: number | null;
  sharedCareTypes: CareType[];
};

// Mirrors findMatchedCaregiverForFamily on the other side of the graph --
// shared by GET /api/matching/stable-match/caregiver and
// /dashboard/cuidador/match-perfeito, so the "which families did I get
// matched with" lookup only lives in one place. Unlike the family side
// (capacity 1), a caregiver can hold up to matchingConfig.caregiverCapacity
// families at once, so this returns 0 to that many entries.
export async function findMatchedFamiliesForCaregiver(
  caregiverUserId: string
): Promise<MatchedFamilyForCaregiver[]> {
  const matchesByCaregiver = await runStableMatchingForAllFamilies();
  const matchedFamilyUserIds = matchesByCaregiver.get(caregiverUserId) ?? [];

  if (matchedFamilyUserIds.length === 0) {
    return [];
  }

  const [caregiverProfile, familyProfiles] = await Promise.all([
    prisma.caregiverProfile.findUnique({
      where: { userId: caregiverUserId },
      select: { latitude: true, longitude: true, careTypes: true },
    }),
    prisma.familyProfile.findMany({
      where: { userId: { in: matchedFamilyUserIds } },
      include: { user: { select: { name: true } } },
    }),
  ]);

  return familyProfiles.map((profile) => {
    const distanceKm = distanceKmOrNull(
      profile.latitude,
      profile.longitude,
      caregiverProfile?.latitude,
      caregiverProfile?.longitude
    );

    const sharedCareTypes = caregiverProfile
      ? getSharedCareTypes(caregiverProfile.careTypes, profile.neededCareTypes)
      : [];

    return {
      familyId: profile.userId,
      name: profile.user.name,
      city: profile.city,
      state: profile.state,
      neededCareTypes: profile.neededCareTypes,
      distanceKm,
      sharedCareTypes,
    };
  });
}
