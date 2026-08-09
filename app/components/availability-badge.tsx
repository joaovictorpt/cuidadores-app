import { CaregiverAvailability } from "@prisma/client";

import { AVAILABILITY_LABELS } from "@/lib/availability";

// Discreet pill, not an alert -- BUSY reuses the same border-accent/
// bg-accent-light treatment the app already uses elsewhere to draw a little
// extra attention (e.g. the "Solicitações" dashboard card when something is
// pending, see app/dashboard/cuidador/page.tsx), rather than introducing a
// new warning color the monochromatic palette doesn't have (see CLAUDE.md
// "Sistema de design"). AVAILABLE reuses the same bg-primary-light/
// text-primary pill as CareTypeTags/status pills elsewhere. UNAVAILABLE
// mirrors the muted "Recebido" direction pill (lib/hire-labels.ts callers).
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
