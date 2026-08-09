"use client";

import { useState } from "react";

import { secondaryButtonClass } from "@/lib/ui";

// How long the "Copiado!" confirmation stays up before reverting to the
// idle label -- long enough to register as feedback, short enough not to
// leave a stale confirmation showing if the user glances back later.
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
