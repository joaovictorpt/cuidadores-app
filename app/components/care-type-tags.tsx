import { CareType } from "@prisma/client";

import { CARE_TYPE_LABELS } from "@/lib/care-types";

// Tags compactas para uma lista de tipos de cuidado -- introduzidas para
// substituir a frase redundante "Busca cuidado para {tipos}" no card de
// busca de famílias (app/dashboard/cuidador/buscar/_components/family-results.tsx),
// que repetia informação que a bio logo abaixo dela frequentemente já dizia
// em prosa. Reaproveita a mesma pílula bg-primary-light/text-primary já
// usada por badges de status/recomendação em outros lugares (ver CLAUDE.md
// "Sistema de design") em vez de introduzir uma combinação de cor nova só
// para isso.
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
