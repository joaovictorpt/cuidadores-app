"use client";

import { CaregiverAvailability } from "@prisma/client";
import { useState } from "react";

import { AVAILABILITY_LABELS, AVAILABILITY_OPTIONS } from "@/lib/availability";

// Alternador rápido de status para o dashboard do cuidador -- de propósito
// NÃO faz parte do formulário completo de edição de perfil
// (profile-form.tsx), já que a intenção é que isso seja alterado com
// frequência e em um clique, não escondido atrás de "Editar perfil".
// Mesmo padrão de 3 pílulas das pílulas de ordenação em
// CaregiverResults/FamilyResults (ativa: bg-accent-light/text-accent,
// inativa: border-muted/40 bg-white) -- reaproveitado em vez de inventar um
// novo estilo de toggle. Salva via PATCH /api/caregiver-profile, o mesmo
// endpoint que o formulário completo de perfil usa.
export function AvailabilityControl({
  initialStatus,
}: {
  initialStatus: CaregiverAvailability;
}) {
  const [status, setStatus] = useState(initialStatus);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleChange(next: CaregiverAvailability) {
    if (next === status || saving) {
      return;
    }

    const previous = status;
    setStatus(next);
    setSaving(true);
    setError(null);

    try {
      const response = await fetch("/api/caregiver-profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ availabilityStatus: next }),
      });

      if (!response.ok) {
        setStatus(previous);
        setError("Não foi possível atualizar seu status. Tente novamente.");
      }
    } catch {
      setStatus(previous);
      setError("Erro de conexão. Tente novamente.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mb-6">
      <p className="mb-2 text-sm font-medium text-muted">Seu status</p>
      <div className="flex flex-wrap gap-2">
        {AVAILABILITY_OPTIONS.map((option) => (
          <button
            key={option}
            type="button"
            onClick={() => handleChange(option)}
            disabled={saving}
            aria-pressed={status === option}
            className={`rounded-full px-3 py-1.5 text-sm font-medium transition motion-reduce:transition-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:cursor-not-allowed disabled:opacity-60 ${
              status === option
                ? "bg-accent-light text-accent"
                : "border border-muted/40 bg-white text-muted hover:text-ink"
            }`}
          >
            {AVAILABILITY_LABELS[option]}
          </button>
        ))}
      </div>
      {error && <p className="mt-2 text-xs text-red-700">{error}</p>}
    </div>
  );
}
