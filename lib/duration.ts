const MINUTE = 60;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
const WEEK = 7 * DAY;
const MONTH = 30 * DAY;
const YEAR = 365 * DAY;

// Formats a fixed time span (Hire.acceptedAt -> Hire.completedAt) as a
// single largest-unit phrase ("3 dias", "5 horas") -- same bucket approach
// as lib/relative-time.ts's "há X" phrasing, but without the "há" prefix
// (this describes a span, not how long ago something happened) and
// rounding instead of flooring: the span is fixed once computed, so
// rounding to the nearest unit reads more naturally than always rounding
// down.
export function formatDuration(milliseconds: number): string {
  const totalSeconds = Math.round(milliseconds / 1000);

  if (totalSeconds < MINUTE) {
    return "menos de um minuto";
  }
  if (totalSeconds < HOUR) {
    const minutes = Math.round(totalSeconds / MINUTE);
    return `${minutes} minuto${minutes === 1 ? "" : "s"}`;
  }
  if (totalSeconds < DAY) {
    const hours = Math.round(totalSeconds / HOUR);
    return `${hours} hora${hours === 1 ? "" : "s"}`;
  }
  if (totalSeconds < WEEK) {
    const days = Math.round(totalSeconds / DAY);
    return `${days} dia${days === 1 ? "" : "s"}`;
  }
  if (totalSeconds < MONTH) {
    const weeks = Math.round(totalSeconds / WEEK);
    return `${weeks} semana${weeks === 1 ? "" : "s"}`;
  }
  if (totalSeconds < YEAR) {
    const months = Math.round(totalSeconds / MONTH);
    return `${months} mês${months === 1 ? "" : "es"}`;
  }

  const years = Math.round(totalSeconds / YEAR);
  return `${years} ano${years === 1 ? "" : "s"}`;
}
