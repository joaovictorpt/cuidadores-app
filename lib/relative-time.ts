const MINUTE = 60;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
const WEEK = 7 * DAY;
const MONTH = 30 * DAY;
const YEAR = 365 * DAY;

// Frase discreta "há X" para Hire.createdAt nas listas de contratações/
// solicitações -- metadado secundário, não deve competir com o conteúdo
// principal do card, então uma frase relativa se lê mais rápido que uma data
// completa. Recebe `now` como parâmetro (padrão é o relógio real) para
// continuar testável sem mockar o Date global.
export function formatRelativeTime(date: Date, now: Date = new Date()): string {
  const diffSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (diffSeconds < MINUTE) {
    return "agora mesmo";
  }
  if (diffSeconds < HOUR) {
    const minutes = Math.floor(diffSeconds / MINUTE);
    return `há ${minutes} minuto${minutes === 1 ? "" : "s"}`;
  }
  if (diffSeconds < DAY) {
    const hours = Math.floor(diffSeconds / HOUR);
    return `há ${hours} hora${hours === 1 ? "" : "s"}`;
  }
  if (diffSeconds < WEEK) {
    const days = Math.floor(diffSeconds / DAY);
    return `há ${days} dia${days === 1 ? "" : "s"}`;
  }
  if (diffSeconds < MONTH) {
    const weeks = Math.floor(diffSeconds / WEEK);
    return `há ${weeks} semana${weeks === 1 ? "" : "s"}`;
  }
  if (diffSeconds < YEAR) {
    const months = Math.floor(diffSeconds / MONTH);
    return `há ${months} mês${months === 1 ? "" : "es"}`;
  }

  const years = Math.floor(diffSeconds / YEAR);
  return `há ${years} ano${years === 1 ? "" : "s"}`;
}
