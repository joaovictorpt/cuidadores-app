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

// Formats a Date as the "YYYY-MM-DD" string the API's Zod schema expects
// (and, previously, what <input type="date"> used for its value/min/max
// attributes), using local date components (not `toISOString()`, which is
// UTC-based and can land on the wrong day depending on the browser's
// timezone).
export function formatDateInputValue(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

// Parses a "DD/MM/AAAA" birth date (or its raw "DDMMAAAA" digits, as typed
// through BirthDateInput's mask) into a Date. Returns null for anything
// incomplete (fewer than 8 digits) or calendar-impossible (e.g. 31/02) --
// `new Date(year, month, day)` never throws, it silently rolls an invalid
// day/month over into a *different*, wrong date instead, so the only
// reliable check is round-tripping the constructed Date's fields back
// against what was typed.
export function parseBirthDateInput(value: string): Date | null {
  const digits = value.replace(/\D/g, "");
  if (digits.length !== 8) return null;

  const day = Number(digits.slice(0, 2));
  const month = Number(digits.slice(2, 4));
  const year = Number(digits.slice(4, 8));

  const date = new Date(year, month - 1, day);

  const roundTrips =
    date.getFullYear() === year &&
    date.getMonth() === month - 1 &&
    date.getDate() === day;

  return roundTrips ? date : null;
}
