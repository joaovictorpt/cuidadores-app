"use client";

import { useState } from "react";

import { secondaryButtonClass } from "@/lib/ui";

// Por quanto tempo a confirmação "Copiado!" fica visível antes de reverter
// para o texto padrão -- tempo suficiente para registrar como feedback,
// curto o bastante para não deixar uma confirmação obsoleta aparecendo se
// o usuário olhar de novo mais tarde.
const CONFIRMATION_DURATION_MS = 2000;

export function CopyPhoneButton({ phone }: { phone: string }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    await navigator.clipboard.writeText(phone);
    setCopied(true);
    setTimeout(() => setCopied(false), CONFIRMATION_DURATION_MS);
  }

  return (
    <button type="button" onClick={handleCopy} className={secondaryButtonClass}>
      {copied ? "Copiado!" : "Copiar número"}
    </button>
  );
}
