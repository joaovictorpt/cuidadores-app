type ApiErrorBody = {
  error?: string;
  issues?: { fieldErrors?: Record<string, string[]>; formErrors?: string[] };
};

// The register API always returns the generic "Dados inválidos" as `error`,
// with the actual per-field Zod messages (e.g. the 18+ rule, a missing
// required field) nested under `issues.fieldErrors`/`formErrors`. Without
// this, the UI would only ever show the generic string and the "clear
// message" required fields/age-check messages would never reach the user.
export function firstApiErrorMessage(body: ApiErrorBody, fallback: string): string {
  const fieldErrors = body.issues?.fieldErrors;
  const firstFieldError = fieldErrors && Object.values(fieldErrors).flat()[0];

  return firstFieldError ?? body.issues?.formErrors?.[0] ?? body.error ?? fallback;
}
