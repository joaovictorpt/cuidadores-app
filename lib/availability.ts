import { CaregiverAvailability } from "@prisma/client";

// Fonte única de CaregiverAvailability -> rótulo em português, mesmo
// padrão de CARE_TYPE_LABELS em lib/care-types.ts. Compartilhado pelo
// selo somente-leitura (app/components/availability-badge.tsx) e pelo
// controle rápido de status do próprio cuidador no dashboard.
export const AVAILABILITY_LABELS: Record<CaregiverAvailability, string> = {
  AVAILABLE: "Disponível",
  BUSY: "Atendendo no momento",
  UNAVAILABLE: "Indisponível",
};

// Ordem do enum usada em todo lugar onde as três opções são listadas juntas
// (o controle de status do dashboard) -- não necessariamente a mesma ordem
// declarada em prisma/schema.prisma, só a ordem que soa mais natural para
// um cuidador escolhendo o próprio status.
export const AVAILABILITY_OPTIONS: CaregiverAvailability[] = [
  "AVAILABLE",
  "BUSY",
  "UNAVAILABLE",
];
