import { HireInitiator, HireStatus, Role } from "@prisma/client";

// Single source of truth for the Hire state machine, shared by the PATCH
// API route (enforcement) and the dashboard pages (deciding which action
// buttons to render) so the two can never drift apart.
//
// Which role can act on a PENDING Hire depends on who initiated it: the
// side that reached out first is "proposing" (they're the only one who can
// withdraw it before it's answered) and the other side is "responding"
// (they're the only one who can accept/reject it) -- see CLAUDE.md
// "Fluxo de contratação (Hire)" for the full table.
//
//   Initiated by FAMILY:
//     PENDING  -> ACCEPTED   (only the caregiver, responding)
//     PENDING  -> REJECTED   (only the caregiver, responding)
//     PENDING  -> CANCELLED  (only the family, proposer withdrawing)
//   Initiated by CAREGIVER:
//     PENDING  -> ACCEPTED   (only the family, responding)
//     PENDING  -> REJECTED   (only the family, responding)
//     PENDING  -> CANCELLED  (only the caregiver, proposer withdrawing)
//   Either way, once ACCEPTED:
//     ACCEPTED -> COMPLETED  (only the caregiver -- they're the one
//                             providing care, regardless of who initiated)
//     ACCEPTED -> CANCELLED  (only the family -- they're the one receiving
//                             care, regardless of who initiated)
// Every other transition is invalid.
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

// Statuses from which a Hire can never transition again. Reaching one of
// these releases the activeHireKey lock (see prisma/schema.prisma), which
// is what allows the same family-caregiver pair to start a new Hire later.
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

// Which target statuses the given role is allowed to move this Hire to
// from its current status -- used by the dashboard pages to decide which
// action buttons to show.
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
