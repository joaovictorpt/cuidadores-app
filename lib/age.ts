// Single source of truth for the 18+ registration rule, shared by the Zod
// schema in app/api/register/route.ts (authoritative check) and the cadastro
// forms (client-side pre-submit check, for instant feedback) -- see
// CLAUDE.md for why both exist.
export const MIN_REGISTRATION_AGE = 18;

// Whole-years age as of `now` -- a naive `now.getFullYear() -
// birthDate.getFullYear()` overcounts by one until this year's birthday has
// actually happened.
export function calculateAge(birthDate: Date, now: Date = new Date()): number {
  let age = now.getFullYear() - birthDate.getFullYear();

  const hasHadBirthdayThisYear =
    now.getMonth() > birthDate.getMonth() ||
    (now.getMonth() === birthDate.getMonth() && now.getDate() >= birthDate.getDate());

  if (!hasHadBirthdayThisYear) {
    age -= 1;
  }

  return age;
}

export function isAdult(birthDate: Date, now: Date = new Date()): boolean {
  return calculateAge(birthDate, now) >= MIN_REGISTRATION_AGE;
}
