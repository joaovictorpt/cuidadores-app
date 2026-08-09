import { CaregiverAvailability } from "@prisma/client";

// Single source of truth for CaregiverAvailability -> Portuguese label,
// same pattern as CARE_TYPE_LABELS in lib/care-types.ts. Shared by the
// read-only badge (app/components/availability-badge.tsx) and the
// caregiver's own quick status control on the dashboard.
export const AVAILABILITY_LABELS: Record<CaregiverAvailability, string> = {
  AVAILABLE: "Disponível",
  BUSY: "Atendendo no momento",
  UNAVAILABLE: "Indisponível",
};

// Enum order used everywhere the three options are listed together (the
// dashboard's status control) -- not necessarily the same order as declared
// in prisma/schema.prisma, just the order that reads naturally to a
// caregiver picking their own status.
export const AVAILABILITY_OPTIONS: CaregiverAvailability[] = [
  "AVAILABLE",
  "BUSY",
  "UNAVAILABLE",
];
