"use client";

import { HireStatus } from "@prisma/client";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { accentButtonClass, errorTextClass, secondaryButtonClass } from "@/lib/ui";

export function HireActionButton({
  hireId,
  targetStatus,
  label,
}: {
  hireId: string;
  targetStatus: HireStatus;
  label: string;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleClick() {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/hires/${hireId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: targetStatus }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error ?? "Não foi possível concluir a ação.");
        setLoading(false);
        return;
      }

      router.refresh();
    } catch {
      setError("Erro de conexão. Tente novamente.");
      setLoading(false);
    }
  }

  // "Aceitar" is the one action the design spec singles out as a CTA de
  // destaque (like "Contratar") -- everything else (Recusar/Cancelar/
  // Marcar como concluído) stays on the neutral secondary style.
  const buttonClass =
    targetStatus === HireStatus.ACCEPTED ? accentButtonClass : secondaryButtonClass;

  return (
    <div>
      <button type="button" onClick={handleClick} disabled={loading} className={buttonClass}>
        {loading ? "..." : label}
      </button>
      {error && <p className={`${errorTextClass} mt-1`}>{error}</p>}
    </div>
  );
}
