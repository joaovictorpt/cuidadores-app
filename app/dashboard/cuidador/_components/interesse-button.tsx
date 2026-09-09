"use client";

import { CareType } from "@prisma/client";
import { useRouter } from "next/navigation";

import {
  CreateHireResult,
  HireActionWithCareType,
} from "@/app/dashboard/_components/hire-action-with-care-type";

// Espelho, do lado do cuidador, de
// app/dashboard/familia/_components/contratar-button.tsx -- mesma chamada
// POST /api/hires, mas aqui é o cuidador quem inicia (o corpo carrega
// `familyId`, não `caregiverId`), então o texto é "Tenho interesse" em vez
// de "Contratar": o cuidador está se oferecendo, não sendo contratado. Os
// dois delegam o seletor de "para qual tipo de cuidado é esse Hire" ao
// mesmo HireActionWithCareType.
export function InteresseButton({
  familyUserId,
  sharedCareTypes,
}: {
  familyUserId: string;
  sharedCareTypes: CareType[];
}) {
  const router = useRouter();

  // Erros de rede/parse são deixados para lançar (throw) -- o submit() do
  // HireActionWithCareType já envolve essa chamada em try/catch e cai para
  // uma mensagem genérica de erro de conexão, então não há necessidade de
  // duplicar esse tratamento aqui.
  async function handleConfirm(careType: CareType): Promise<CreateHireResult> {
    const response = await fetch("/api/hires", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ familyId: familyUserId, careType }),
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
      label="Tenho interesse"
      sharedCareTypes={sharedCareTypes}
      onConfirm={handleConfirm}
      successMessage="Interesse enviado!"
      conflictMessage="Você já tem uma solicitação em andamento com essa família."
      genericErrorMessage="Não foi possível enviar seu interesse."
    />
  );
}
