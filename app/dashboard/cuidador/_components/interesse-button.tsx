"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { accentButtonClass, errorTextClass } from "@/lib/ui";

// Caregiver-side mirror of app/dashboard/familia/_components/contratar-button.tsx --
// same POST /api/hires call, but the caregiver is the one initiating here
// (body carries `familyId`, not `caregiverId`), so the copy is "Tenho
// interesse" rather than "Contratar": the caregiver is offering, not being
// hired.
export function InteresseButton({ familyUserId }: { familyUserId: string }) {
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
        body: JSON.stringify({ familyId: familyUserId }),
      });

      const data = await response.json();

      if (!response.ok) {
        setStatus("error");
        setMessage(
          response.status === 409
            ? "Você já tem uma solicitação em andamento com essa família."
            : (data.error ?? "Não foi possível enviar seu interesse.")
        );
        return;
      }

      setStatus("success");
      setMessage("Interesse enviado!");
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
        {status === "loading" ? "Enviando..." : "Tenho interesse"}
      </button>
      {status === "error" && message && (
        <p className={`${errorTextClass} mt-1`}>{message}</p>
      )}
    </div>
  );
}
