export const matchingConfig = {
  weights: {
    distance: 0.4,
    careTypeCompatibility: 0.2,
    rating: 0.2,
    price: 0.2,
  },
  maxDistanceKm: 50,
  defaultRatingWhenNoReviews: 0.5,
  // Quantas famílias um único cuidador pode ter simultaneamente no matching
  // estável (variante hospital-residents do Gale-Shapley).
  caregiverCapacity: 3,
};
