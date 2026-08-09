"use client";

import { CareType } from "@prisma/client";
import { useRouter } from "next/navigation";

import {
  CreateHireResult,
  HireActionWithCareType,
} from "@/app/dashboard/_components/hire-action-with-care-type";

// Caregiver-side mirror of app/dashboard/familia/_components/contratar-button.tsx --
// same POST /api/hires call, but the caregiver is the one initiating here
// (body carries `familyId`, not `caregiverId`), so the copy is "Tenho
// interesse" rather than "Contratar": the caregiver is offering, not being
// hired. Both delegate the "which care type is this Hire for" picker to
// the same HireActionWithCareType.
export function InteresseButton({
  familyUserId,
  sharedCareTypes,
}: {
  familyUserId: string;
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
