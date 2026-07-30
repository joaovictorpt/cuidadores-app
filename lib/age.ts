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

// Sanity bounds for birthDate, independent of the 18+ rule above -- without
// these, the plain <input type="date"> lets someone type an unbounded year
// (e.g. "18888"), which still parses to a valid (if absurd) Date and could
// slip past the adult check. Shared by the date input's min/max attributes,
// the client-side pre-submit check, and the authoritative Zod refinement in
// app/api/register/route.ts.
export const MIN_BIRTH_YEAR = 1900;
export const MIN_BIRTH_DATE = new Date(MIN_BIRTH_YEAR, 0, 1);

export function isBirthDateInFuture(birthDate: Date, now: Date = new Date()): boolean {
  return birthDate.getTime() > now.getTime();
}

export function isBirthDateTooOld(birthDate: Date): boolean {
  return birthDate.getTime() < MIN_BIRTH_DATE.getTime();
}

// Formats a Date as the "YYYY-MM-DD" string <input type="date"> expects for
// its value/min/max attributes, using local date components (not
// `toISOString()`, which is UTC-based and can land on the wrong day
// depending on the browser's timezone).
export function formatDateInputValue(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}
