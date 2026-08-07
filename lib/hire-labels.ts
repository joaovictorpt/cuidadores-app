import { HireInitiator, HireStatus, Role } from "@prisma/client";

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

// Now that either side can initiate a Hire (see CLAUDE.md "Fluxo de
// contratação"), a single dashboard list can mix requests the viewer sent
// with ones they received -- this label disambiguates each card from the
// current viewer's point of view, independent of which role always plays
// "family" or "caregiver" in the underlying data.
export function getHireDirectionLabel(
  initiatedBy: HireInitiator,
  viewerRole: Role
): "Você enviou" | "Recebido" {
  const viewerInitiated =
    (initiatedBy === HireInitiator.FAMILY && viewerRole === Role.FAMILY) ||
    (initiatedBy === HireInitiator.CAREGIVER && viewerRole === Role.CAREGIVER);

  return viewerInitiated ? "Você enviou" : "Recebido";
}
