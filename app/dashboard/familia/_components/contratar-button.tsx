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

  // Network/parse errors are left to throw -- HireActionWithCareType's
  // submit() already wraps this call in try/catch and falls back to a
  // generic connection-error message, so there's no need to duplicate that
  // handling here.
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
