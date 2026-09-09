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

  // "Aceitar" é a única ação que o spec de design destaca como um CTA de
  // destaque (como "Contratar") -- todas as outras (Recusar/Cancelar/
  // Marcar como concluído) ficam no estilo secundário neutro.
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
