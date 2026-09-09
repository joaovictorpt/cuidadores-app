import { HireInitiator, HireStatus, Role } from "@prisma/client";

export const HIRE_STATUS_LABELS: Record<HireStatus, string> = {
  PENDING: "Pendente",
  ACCEPTED: "Aceita",
  REJECTED: "Recusada",
  COMPLETED: "Concluída",
  CANCELLED: "Cancelada",
};

// Indexado pelo status DE DESTINO da ação, ex.: clicar no botão rotulado
// "Aceitar" dispara um PATCH movendo o Hire para ACCEPTED.
export const HIRE_ACTION_LABELS: Partial<Record<HireStatus, string>> = {
  ACCEPTED: "Aceitar",
  REJECTED: "Recusar",
  COMPLETED: "Marcar como concluído",
  CANCELLED: "Cancelar",
};

// Agora que qualquer um dos dois lados pode iniciar um Hire (ver CLAUDE.md
// "Fluxo de contratação"), uma única lista do dashboard pode misturar
// solicitações que quem está vendo enviou com as que recebeu -- esse rótulo
// desambigua cada card do ponto de vista de quem está vendo, independente
// de qual role sempre exerce o papel de "família" ou "cuidador" nos dados
// subjacentes.
export function getHireDirectionLabel(
  initiatedBy: HireInitiator,
  viewerRole: Role
): "Você enviou" | "Recebido" {
  const viewerInitiated =
    (initiatedBy === HireInitiator.FAMILY && viewerRole === Role.FAMILY) ||
    (initiatedBy === HireInitiator.CAREGIVER && viewerRole === Role.CAREGIVER);

  return viewerInitiated ? "Você enviou" : "Recebido";
}
