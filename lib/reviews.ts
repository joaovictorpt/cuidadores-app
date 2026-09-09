export type AverageRatingResult = {
  average: number | null;
  total: number;
};

// Fonte única de verdade para "nota média a partir de uma lista de notas" --
// antes calculado inline (e de forma idêntica) tanto em GET /api/reviews
// quanto na pontuação de cuidador de lib/matching.ts. `average` é null (não
// 0) quando ainda não há notas, então os chamadores nunca precisam adivinhar
// se um 0 significa "nota ruim" ou "nenhuma avaliação ainda".
export function calculateAverageRating(ratings: number[]): AverageRatingResult {
  const total = ratings.length;
  const average =
    total > 0 ? ratings.reduce((sum, rating) => sum + rating, 0) / total : null;

  return { average, total };
}
