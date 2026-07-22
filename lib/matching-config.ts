export const matchingConfig = {
  weights: {
    distance: 0.4,
    careTypeCompatibility: 0.2,
    rating: 0.2,
    price: 0.2,
  },
  maxDistanceKm: 50,
  defaultRatingWhenNoReviews: 0.5,
  // How many families a single caregiver can be simultaneously matched with
  // in the stable matching (hospital-residents variant of Gale-Shapley).
  caregiverCapacity: 3,
};
