import { CaregiverAvailability } from "@prisma/client";

import { AVAILABILITY_LABELS } from "@/lib/availability";

// Pílula discreta, não um alerta -- BUSY reaproveita o mesmo tratamento
// border-accent/bg-accent-light que o app já usa em outros lugares para
// chamar um pouco mais de atenção (ex.: o card "Solicitações" do dashboard
// quando há algo pendente, ver app/dashboard/cuidador/page.tsx), em vez de
// introduzir uma nova cor de aviso que a paleta monocromática não tem (ver
// CLAUDE.md "Sistema de design"). AVAILABLE reaproveita a mesma pílula
// bg-primary-light/text-primary de CareTypeTags/pílulas de status em outros
// lugares. UNAVAILABLE espelha a pílula apagada "Recebido" (chamadores de
// lib/hire-labels.ts).
const AVAILABILITY_STYLES: Record<CaregiverAvailability, string> = {
  AVAILABLE: "bg-primary-light text-primary",
  BUSY: "border border-accent/40 bg-accent-light text-accent",
  UNAVAILABLE: "border border-muted/30 bg-white text-muted",
};

export function AvailabilityBadge({
  status,
}: {
  status: CaregiverAvailability;
}) {
  return (
    <span
      className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${AVAILABILITY_STYLES[status]}`}
    >
      {AVAILABILITY_LABELS[status]}
    </span>
  );
}
