// Single source of truth for "is this a complete Brazilian mobile phone",
// shared by the Zod schemas in app/api/register, app/api/family-profile,
// and app/api/caregiver-profile (authoritative check) and the 4 forms that
// collect a phone via PhoneInput (client-side pre-submit check, same
// pattern as lib/age.ts for birth date). PhoneInput's onChange already
// hands back digits only (react-number-format's values.value), so this
// only needs to check length -- 2-digit DDD + 9-digit number, the format a
// Brazilian mobile number has.
export const PHONE_DIGIT_LENGTH = 11;

export const PHONE_REGEX = new RegExp(`^\\d{${PHONE_DIGIT_LENGTH}}$`);

export const PHONE_INVALID_MESSAGE =
  "Telefone inválido — informe DDD + 9 dígitos";

export function isCompletePhone(digits: string): boolean {
  return PHONE_REGEX.test(digits);
}
