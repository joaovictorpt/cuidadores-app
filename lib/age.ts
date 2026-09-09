// Fonte única da regra de cadastro 18+, compartilhada pelo schema Zod
// em app/api/register/route.ts (checagem autoritativa) e pelos formulários
// de cadastro (checagem client-side antes do submit, para feedback
// instantâneo) -- ver CLAUDE.md para o porquê dos dois existirem.
export const MIN_REGISTRATION_AGE = 18;

// Idade em anos completos na data `now` -- um cálculo ingênuo de
// `now.getFullYear() - birthDate.getFullYear()` conta um ano a mais até o
// aniversário deste ano realmente acontecer.
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

// Limites de sanidade para birthDate, independentes da regra de maioridade
// acima -- sem eles, o <input type="date"> nativo permite digitar um ano
// sem limite (ex.: "18888"), que ainda assim vira uma Date válida (embora
// absurda) e poderia passar despercebido pela checagem de maioridade.
// Compartilhado pelos atributos min/max do input de data, pela checagem
// client-side antes do submit, e pelo refinamento Zod autoritativo em
// app/api/register/route.ts.
export const MIN_BIRTH_YEAR = 1900;
export const MIN_BIRTH_DATE = new Date(MIN_BIRTH_YEAR, 0, 1);

export function isBirthDateInFuture(birthDate: Date, now: Date = new Date()): boolean {
  return birthDate.getTime() > now.getTime();
}

export function isBirthDateTooOld(birthDate: Date): boolean {
  return birthDate.getTime() < MIN_BIRTH_DATE.getTime();
}

// Formata uma Date como a string "YYYY-MM-DD" que o schema Zod da API
// espera (e que, antigamente, o <input type="date"> usava para seus
// atributos value/min/max), usando componentes de data locais (não
// `toISOString()`, que é baseado em UTC e pode cair no dia errado
// dependendo do fuso horário do navegador).
export function formatDateInputValue(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

// Converte uma data de nascimento "DD/MM/AAAA" (ou seus dígitos brutos
// "DDMMAAAA", como digitados através da máscara do BirthDateInput) em uma
// Date. Retorna null para qualquer coisa incompleta (menos de 8 dígitos) ou
// impossível no calendário (ex.: 31/02) -- `new Date(ano, mes, dia)` nunca
// lança erro, em vez disso "rola" silenciosamente um dia/mês inválido para
// uma data *diferente* e errada, então a única checagem confiável é fazer o
// round-trip dos campos da Date construída de volta contra o que foi
// digitado.
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
