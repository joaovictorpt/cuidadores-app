"use client";

import { CareType } from "@prisma/client";
import { useId, useState } from "react";

import { CARE_TYPE_LABELS } from "@/lib/care-types";
import {
  accentButtonClass,
  errorTextClass,
  labelClass,
  secondaryButtonClass,
} from "@/lib/ui";

export type CreateHireResult =
  | { ok: true }
  | { ok: false; status?: number; error?: string };

// Compartilhado por ContratarButton (família iniciando) e InteresseButton
// (cuidador iniciando) -- os dois são, fora isso, espelhos quase idênticos
// um do outro (ver seus próprios arquivos), então a UI de "escolher qual
// tipo de cuidado em comum é esse Hire" vive aqui uma vez só, em vez de ser
// escrita duas vezes.
//
// Comportamento: `sharedCareTypes` é sempre a interseção real entre os dois
// perfis envolvidos (calculada pelo chamador, que já tem os tipos de
// cuidado dos dois lados em escopo -- ver getSharedCareTypes em
// lib/care-types.ts).
//  - Exatamente 1 tipo em comum: nada a perguntar, clicar no botão envia
//    imediatamente com esse tipo.
//  - Mais de 1: clicar expande um seletor de radio inline + "Confirmar";
//    o POST só é disparado depois que um tipo é escolhido e confirmado.
//  - 0: não deveria acontecer com nenhum chamador real (o isEligiblePair do
//    matching já exige overlap para um par sequer ser mostrado), mas o
//    botão fica desabilitado com uma mensagem explicativa em vez de supor
//    que isso não pode ocorrer.
export function HireActionWithCareType({
  label,
  sharedCareTypes,
  onConfirm,
  successMessage,
  conflictMessage,
  genericErrorMessage,
}: {
  label: string;
  sharedCareTypes: CareType[];
  onConfirm: (careType: CareType) => Promise<CreateHireResult>;
  successMessage: string;
  conflictMessage: string;
  genericErrorMessage: string;
}) {
  const groupName = useId();
  const [status, setStatus] = useState<
    "idle" | "selecting" | "loading" | "success" | "error"
  >("idle");
  const [message, setMessage] = useState<string | null>(null);
  const [selectedType, setSelectedType] = useState<CareType | null>(
    sharedCareTypes.length === 1 ? sharedCareTypes[0] : null
  );

  async function submit(careType: CareType) {
    setStatus("loading");
    setMessage(null);

    try {
      const result = await onConfirm(careType);

      if (!result.ok) {
        setStatus("error");
        setMessage(
          result.status === 409 ? conflictMessage : (result.error ?? genericErrorMessage)
        );
        return;
      }

      setStatus("success");
      setMessage(successMessage);
    } catch {
      setStatus("error");
      setMessage("Erro de conexão. Tente novamente.");
    }
  }

  function handleClick() {
    if (sharedCareTypes.length === 1) {
      submit(sharedCareTypes[0]);
      return;
    }

    setStatus("selecting");
  }

  if (status === "success") {
    return <p className="text-sm font-medium text-primary">{message}</p>;
  }

  if (status === "selecting") {
    return (
      <div className="rounded-lg border border-muted/30 bg-white p-3">
        <p className={labelClass}>Para qual tipo de cuidado?</p>
        <div role="radiogroup" aria-label="Tipo de cuidado" className="mt-2 space-y-1.5">
          {sharedCareTypes.map((type) => (
            <label key={type} className="flex items-center gap-2 text-sm text-ink">
              <input
                type="radio"
                name={groupName}
                checked={selectedType === type}
                onChange={() => setSelectedType(type)}
                className="h-4 w-4 border-muted/40 text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
              />
              {CARE_TYPE_LABELS[type] ?? type}
            </label>
          ))}
        </div>
        <div className="mt-3 flex gap-2">
          <button
            type="button"
            onClick={() => selectedType && submit(selectedType)}
            disabled={!selectedType}
            className={accentButtonClass}
          >
            Confirmar
          </button>
          <button
            type="button"
            onClick={() => setStatus("idle")}
            className={secondaryButtonClass}
          >
            Cancelar
          </button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <button
        type="button"
        onClick={handleClick}
        disabled={status === "loading" || sharedCareTypes.length === 0}
        className={accentButtonClass}
      >
        {status === "loading" ? "Enviando..." : label}
      </button>
      {sharedCareTypes.length === 0 && (
        <p className={`${errorTextClass} mt-1`}>
          Nenhum tipo de cuidado em comum encontrado.
        </p>
      )}
      {status === "error" && message && (
        <p className={`${errorTextClass} mt-1`}>{message}</p>
      )}
    </div>
  );
}
