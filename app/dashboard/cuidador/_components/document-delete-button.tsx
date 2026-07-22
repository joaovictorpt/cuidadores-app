"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { errorTextClass, secondaryButtonClass } from "@/lib/ui";

export function DocumentDeleteButton({ documentId }: { documentId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleClick() {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/documents/${documentId}`, {
        method: "DELETE",
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error ?? "Não foi possível remover o documento.");
        setLoading(false);
        return;
      }

      router.refresh();
    } catch {
      setError("Erro de conexão. Tente novamente.");
      setLoading(false);
    }
  }

  return (
    <div>
      <button
        type="button"
        onClick={handleClick}
        disabled={loading}
        className={secondaryButtonClass}
      >
        {loading ? "Removendo..." : "Remover"}
      </button>
      {error && <p className={`${errorTextClass} mt-1`}>{error}</p>}
    </div>
  );
}
