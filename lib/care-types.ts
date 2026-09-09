import { CareType } from "@prisma/client";

// Fonte única de CareType -> rótulo em português. Antes era duplicado como
// uma const local em cada página/componente que exibia tipos de cuidado
// (páginas de busca, páginas de match, seus componentes de resultado) --
// extraído para cá porque o novo trabalho de perfil/card de lista abaixo
// adiciona vários outros pontos de uso, o que empurraria a contagem de
// duplicatas para dois dígitos.
export const CARE_TYPE_LABELS: Record<CareType, string> = {
  ELDERLY: "Idosos",
  CHILD: "Crianças",
  SPECIAL_NEEDS: "Necessidades especiais",
};

export function formatCareTypes(types: CareType[]): string {
  return types.map((type) => CARE_TYPE_LABELS[type] ?? type).join(", ");
}

// A interseção real entre o que um cuidador oferece e o que uma família
// precisa -- fonte única, antes duplicada inline como
// `caregiver.careTypes.filter((type) => family.neededCareTypes.includes(type))`
// (ou o inverso) em vários lugares dentro de lib/matching.ts e, desde a
// funcionalidade Hire.careType, o seletor "para qual tipo é esse Hire"
// (ContratarButton/InteresseButton) e sua validação server-side em
// POST /api/hires.
export function getSharedCareTypes(
  caregiverCareTypes: CareType[],
  familyNeededCareTypes: CareType[]
): CareType[] {
  return caregiverCareTypes.filter((type) =>
    familyNeededCareTypes.includes(type)
  );
}
