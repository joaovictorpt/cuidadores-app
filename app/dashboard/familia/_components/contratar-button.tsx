"use client";

import { CareType } from "@prisma/client";
import { useRouter } from "next/navigation";

import {
  CreateHireResult,
  HireActionWithCareType,
} from "@/app/dashboard/_components/hire-action-with-care-type";

export function ContratarButton({
  caregiverUserId,
  sharedCareTypes,
}: {
  caregiverUserId: string;
  sharedCareTypes: CareType[];
}) {
  const router = useRouter();

  // Erros de rede/parse são deixados para propagar (throw) -- o submit()
  // de HireActionWithCareType já envolve essa chamada em try/catch e cai
  // para uma mensagem genérica de erro de conexão, então não há
  // necessidade de duplicar esse tratamento aqui.
  async function handleConfirm(careType: CareType): Promise<CreateHireResult> {
    const response = await fetch("/api/hires", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ caregiverId: caregiverUserId, careType }),
    });

    const data = await response.json();

    if (!response.ok) {
      return { ok: false, status: response.status, error: data.error };
    }

    router.refresh();
    return { ok: true };
  }

  return (
    <HireActionWithCareType
      label="Contratar"
      sharedCareTypes={sharedCareTypes}
      onConfirm={handleConfirm}
      successMessage="Solicitação enviada!"
      conflictMessage="Você já tem uma solicitação em andamento com esse cuidador."
      genericErrorMessage="Não foi possível enviar a solicitação."
    />
  );
}
