type ApiErrorBody = {
  error?: string;
  issues?: { fieldErrors?: Record<string, string[]>; formErrors?: string[] };
};

// A API de cadastro sempre retorna o genérico "Dados inválidos" como
// `error`, com as mensagens reais do Zod por campo (ex.: a regra de 18+,
// um campo obrigatório faltando) aninhadas em
// `issues.fieldErrors`/`formErrors`. Sem isso, a UI sempre mostraria só a
// string genérica e as mensagens "claras" de campos obrigatórios/checagem
// de idade nunca chegariam ao usuário.
export function firstApiErrorMessage(body: ApiErrorBody, fallback: string): string {
  const fieldErrors = body.issues?.fieldErrors;
  const firstFieldError = fieldErrors && Object.values(fieldErrors).flat()[0];

  return firstFieldError ?? body.issues?.formErrors?.[0] ?? body.error ?? fallback;
}
