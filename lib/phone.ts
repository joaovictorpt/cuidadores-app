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

// Strips anything but digits -- defensive belt for the two helpers below:
// the app only ever stores digits-only phones (see PhoneInput), but these
// build user-facing strings/URIs, so a stray formatting character slipping
// through shouldn't produce a broken display value or wa.me link.
function sanitizePhoneDigits(phone: string): string {
  return phone.replace(/\D/g, "");
}

// Read-only display formatting ("(XX) XXXXX-XXXX") -- mirrors the mask
// app/components/phone-input.tsx applies while typing, but for contexts
// (Hire contact info) that only ever show an already-saved number, so
// react-number-format's live-editing behavior isn't needed. Falls back to
// the raw digits for anything that doesn't look like a complete phone,
// rather than showing a malformed partial mask.
export function formatPhoneForDisplay(phone: string): string {
  const digits = sanitizePhoneDigits(phone);

  if (!isCompletePhone(digits)) {
    return digits;
  }

  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
}

// wa.me deep link -- same +55<digits> shape WhatsApp's own link format
// requires, no punctuation.
export function buildWhatsAppUrl(phone: string): string {
  return `https://wa.me/55${sanitizePhoneDigits(phone)}`;
}
