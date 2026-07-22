import { HireStatus, Role } from "@prisma/client";

// Single source of truth for the Hire state machine, shared by the PATCH
// API route (enforcement) and the dashboard pages (deciding which action
// buttons to render) so the two can never drift apart.
//
//   PENDING  -> ACCEPTED   (only the caregiver)
//   PENDING  -> REJECTED   (only the caregiver)
//   PENDING  -> CANCELLED  (only the family)
//   ACCEPTED -> COMPLETED  (only the caregiver)
//   ACCEPTED -> CANCELLED  (only the family)
// Every other transition is invalid.
export const VALID_HIRE_TRANSITIONS: Record<
  HireStatus,
  Partial<Record<HireStatus, Role[]>>
> = {
  [HireStatus.PENDING]: {
    [HireStatus.ACCEPTED]: [Role.CAREGIVER],
    [HireStatus.REJECTED]: [Role.CAREGIVER],
    [HireStatus.CANCELLED]: [Role.FAMILY],
  },
  [HireStatus.ACCEPTED]: {
    [HireStatus.COMPLETED]: [Role.CAREGIVER],
    [HireStatus.CANCELLED]: [Role.FAMILY],
  },
  [HireStatus.REJECTED]: {},
  [HireStatus.COMPLETED]: {},
  [HireStatus.CANCELLED]: {},
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
  role: Role
): boolean {
  const allowedRoles = VALID_HIRE_TRANSITIONS[currentStatus]?.[nextStatus];
  return Boolean(allowedRoles && allowedRoles.includes(role));
}

// Which target statuses the given role is allowed to move this Hire to
// from its current status -- used by the dashboard pages to decide which
// action buttons to show.
export function getAvailableActions(
  currentStatus: HireStatus,
  role: Role
): HireStatus[] {
  const transitions = VALID_HIRE_TRANSITIONS[currentStatus] ?? {};

  return (Object.keys(transitions) as HireStatus[]).filter((nextStatus) =>
    transitions[nextStatus]?.includes(role)
  );
}
