import { HireStatus } from "@prisma/client";

export const HIRE_STATUS_LABELS: Record<HireStatus, string> = {
  PENDING: "Pendente",
  ACCEPTED: "Aceita",
  REJECTED: "Recusada",
  COMPLETED: "Concluída",
  CANCELLED: "Cancelada",
};

// Keyed by the TARGET status of the action, e.g. clicking the button
// labeled "Aceitar" issues a PATCH moving the Hire to ACCEPTED.
export const HIRE_ACTION_LABELS: Partial<Record<HireStatus, string>> = {
  ACCEPTED: "Aceitar",
  REJECTED: "Recusar",
  COMPLETED: "Marcar como concluído",
  CANCELLED: "Cancelar",
};
