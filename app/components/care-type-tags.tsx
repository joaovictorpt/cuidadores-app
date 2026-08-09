import { CareType } from "@prisma/client";

import { CARE_TYPE_LABELS } from "@/lib/care-types";

// Compact tags for a list of care types -- introduced to replace a redundant
// "Busca cuidado para {tipos}" sentence on the family-search card
// (app/dashboard/cuidador/buscar/_components/family-results.tsx), which
// repeated information the bio right below it often already said in prose.
// Reuses the same bg-primary-light/text-primary pill already used for
// status/recommendation badges elsewhere (see CLAUDE.md "Sistema de
// design") rather than introducing a new color pairing just for this.
export function CareTypeTags({ careTypes }: { careTypes: CareType[] }) {
  if (careTypes.length === 0) {
    return null;
  }

  return (
    <div className="mt-2 flex flex-wrap gap-1.5">
      {careTypes.map((type) => (
        <span
          key={type}
          className="rounded-full bg-primary-light px-2.5 py-0.5 text-xs font-medium text-primary"
        >
          {CARE_TYPE_LABELS[type] ?? type}
        </span>
      ))}
    </div>
  );
}
