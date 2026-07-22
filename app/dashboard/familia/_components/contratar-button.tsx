"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { accentButtonClass, errorTextClass } from "@/lib/ui";

export function ContratarButton({ caregiverUserId }: { caregiverUserId: string }) {
  const router = useRouter();
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">(
    "idle"
  );
  const [message, setMessage] = useState<string | null>(null);

  async function handleClick() {
    setStatus("loading");
    setMessage(null);

    try {
      const response = await fetch("/api/hires", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ caregiverId: caregiverUserId }),
      });

      const data = await response.json();

      if (!response.ok) {
        setStatus("error");
        setMessage(
          response.status === 409
            ? "Você já tem uma solicitação em andamento com esse cuidador."
            : (data.error ?? "Não foi possível enviar a solicitação.")
        );
        return;
      }

      setStatus("success");
      setMessage("Solicitação enviada!");
      router.refresh();
    } catch {
      setStatus("error");
      setMessage("Erro de conexão. Tente novamente.");
    }
  }

  if (status === "success") {
    return <p className="text-sm font-medium text-primary">{message}</p>;
  }

  return (
    <div>
      <button
        type="button"
        onClick={handleClick}
        disabled={status === "loading"}
        className={accentButtonClass}
      >
        {status === "loading" ? "Enviando..." : "Contratar"}
      </button>
      {status === "error" && message && (
        <p className={`${errorTextClass} mt-1`}>{message}</p>
      )}
    </div>
  );
}
