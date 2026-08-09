import { CareType } from "@prisma/client";

// Single source of truth for CareType -> Portuguese label. Was previously
// duplicated as a local const in every page/component that displayed care
// types (buscar pages, match pages, their results components) -- extracted
// here because the new profile/list-card work below adds several more call
// sites, which would otherwise push the duplicate count into double digits.
export const CARE_TYPE_LABELS: Record<CareType, string> = {
  ELDERLY: "Idosos",
  CHILD: "Crianças",
  SPECIAL_NEEDS: "Necessidades especiais",
};

export function formatCareTypes(types: CareType[]): string {
  return types.map((type) => CARE_TYPE_LABELS[type] ?? type).join(", ");
}

// The real overlap between what a caregiver offers and what a family
// needs -- single source of truth, previously duplicated inline as
// `caregiver.careTypes.filter((type) => family.neededCareTypes.includes(type))`
// (or the reverse) in several places across lib/matching.ts and, as of the
// Hire.careType feature, the "which type is this Hire for" picker
// (ContratarButton/InteresseButton) and its POST /api/hires server-side
// validation.
export function getSharedCareTypes(
  caregiverCareTypes: CareType[],
  familyNeededCareTypes: CareType[]
): CareType[] {
  return caregiverCareTypes.filter((type) =>
    familyNeededCareTypes.includes(type)
  );
}
