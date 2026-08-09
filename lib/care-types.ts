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
