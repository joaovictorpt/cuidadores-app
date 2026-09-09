import { HireInitiator, HireStatus, Role } from "@prisma/client";

// Fonte única de verdade para a máquina de estados do Hire, compartilhada pela
// rota de API PATCH (aplicação das regras) e pelas páginas do dashboard
// (decidindo quais botões de ação renderizar), para que as duas nunca divirjam.
//
// Qual papel pode agir sobre um Hire PENDING depende de quem o iniciou: o
// lado que entrou em contato primeiro está "propondo" (é o único que pode
// desistir antes de ser respondido) e o outro lado está "respondendo"
// (é o único que pode aceitar/recusar) -- ver CLAUDE.md
// "Fluxo de contratação (Hire)" para a tabela completa.
//
//   Iniciado pela FAMÍLIA:
//     PENDING  -> ACCEPTED   (só o cuidador, respondendo)
//     PENDING  -> REJECTED   (só o cuidador, respondendo)
//     PENDING  -> CANCELLED  (só a família, propositora desistindo)
//   Iniciado pelo CUIDADOR:
//     PENDING  -> ACCEPTED   (só a família, respondendo)
//     PENDING  -> REJECTED   (só a família, respondendo)
//     PENDING  -> CANCELLED  (só o cuidador, propositor desistindo)
//   De qualquer forma, uma vez ACCEPTED:
//     ACCEPTED -> COMPLETED  (só o cuidador -- é ele quem presta o
//                             cuidado, independente de quem iniciou)
//     ACCEPTED -> CANCELLED  (só a família -- é ela quem recebe o
//                             cuidado, independente de quem iniciou)
// Qualquer outra transição é inválida.
const ACCEPTED_TRANSITIONS: Partial<Record<HireStatus, Role[]>> = {
  [HireStatus.COMPLETED]: [Role.CAREGIVER],
  [HireStatus.CANCELLED]: [Role.FAMILY],
};

const TERMINAL_TRANSITIONS: Partial<Record<HireStatus, Role[]>> = {};

export const VALID_HIRE_TRANSITIONS: Record<
  HireInitiator,
  Record<HireStatus, Partial<Record<HireStatus, Role[]>>>
> = {
  [HireInitiator.FAMILY]: {
    [HireStatus.PENDING]: {
      [HireStatus.ACCEPTED]: [Role.CAREGIVER],
      [HireStatus.REJECTED]: [Role.CAREGIVER],
      [HireStatus.CANCELLED]: [Role.FAMILY],
    },
    [HireStatus.ACCEPTED]: ACCEPTED_TRANSITIONS,
    [HireStatus.REJECTED]: TERMINAL_TRANSITIONS,
    [HireStatus.COMPLETED]: TERMINAL_TRANSITIONS,
    [HireStatus.CANCELLED]: TERMINAL_TRANSITIONS,
  },
  [HireInitiator.CAREGIVER]: {
    [HireStatus.PENDING]: {
      [HireStatus.ACCEPTED]: [Role.FAMILY],
      [HireStatus.REJECTED]: [Role.FAMILY],
      [HireStatus.CANCELLED]: [Role.CAREGIVER],
    },
    [HireStatus.ACCEPTED]: ACCEPTED_TRANSITIONS,
    [HireStatus.REJECTED]: TERMINAL_TRANSITIONS,
    [HireStatus.COMPLETED]: TERMINAL_TRANSITIONS,
    [HireStatus.CANCELLED]: TERMINAL_TRANSITIONS,
  },
};

// Status a partir dos quais um Hire nunca mais pode transicionar. Alcançar
// um deles libera o lock do activeHireKey (ver prisma/schema.prisma), que é
// o que permite ao mesmo par família-cuidador iniciar um novo Hire depois.
export const TERMINAL_HIRE_STATUSES: HireStatus[] = [
  HireStatus.REJECTED,
  HireStatus.COMPLETED,
  HireStatus.CANCELLED,
];

export function isValidHireTransition(
  currentStatus: HireStatus,
  nextStatus: HireStatus,
  role: Role,
  initiatedBy: HireInitiator
): boolean {
  const allowedRoles =
    VALID_HIRE_TRANSITIONS[initiatedBy][currentStatus]?.[nextStatus];
  return Boolean(allowedRoles && allowedRoles.includes(role));
}

// Para quais status de destino o papel informado pode mover este Hire a
// partir do status atual -- usado pelas páginas do dashboard para decidir
// quais botões de ação mostrar.
export function getAvailableActions(
  currentStatus: HireStatus,
  role: Role,
  initiatedBy: HireInitiator
): HireStatus[] {
  const transitions = VALID_HIRE_TRANSITIONS[initiatedBy][currentStatus] ?? {};

  return (Object.keys(transitions) as HireStatus[]).filter((nextStatus) =>
    transitions[nextStatus]?.includes(role)
  );
}
