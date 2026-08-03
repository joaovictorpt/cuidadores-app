export type AverageRatingResult = {
  average: number | null;
  total: number;
};

// Single source of truth for "average rating from a list of ratings" --
// previously computed inline (and identically) in both GET /api/reviews and
// lib/matching.ts's caregiver scoring. `average` is null (not 0) when there
// are no ratings yet, so callers never have to guess whether a 0 means "bad
// rating" or "no reviews at all".
export function calculateAverageRating(ratings: number[]): AverageRatingResult {
  const total = ratings.length;
  const average =
    total > 0 ? ratings.reduce((sum, rating) => sum + rating, 0) / total : null;

  return { average, total };
}
