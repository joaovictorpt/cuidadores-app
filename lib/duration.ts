const MINUTE = 60;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
const WEEK = 7 * DAY;
const MONTH = 30 * DAY;
const YEAR = 365 * DAY;

// Formata um intervalo de tempo fixo (Hire.acceptedAt -> Hire.completedAt)
// como uma frase de unidade única maior ("3 dias", "5 horas") -- mesma
// abordagem de faixas do "há X" de lib/relative-time.ts, mas sem o prefixo
// "há" (isso descreve um intervalo, não há quanto tempo algo aconteceu) e
// arredondando em vez de truncar: o intervalo já é fixo quando calculado,
// então arredondar para a unidade mais próxima soa mais natural do que
// sempre truncar para baixo.
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
