"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

import { errorTextClass, inputClass, labelClass, primaryButtonClass } from "@/lib/ui";

const DOCUMENT_TYPES = [
  { value: "ID_DOCUMENT", label: "Documento de identidade" },
  { value: "BACKGROUND_CHECK", label: "Antecedentes criminais" },
  { value: "CERTIFICATE", label: "Certificado/curso" },
] as const;

export function DocumentUploadForm() {
  const router = useRouter();
  const [type, setType] = useState<string>(DOCUMENT_TYPES[0].value);
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (!file) {
      setError("Selecione um arquivo.");
      return;
    }

    setLoading(true);

    try {
      const formData = new FormData();
      formData.append("type", type);
      formData.append("file", file);

      const response = await fetch("/api/documents", {
        method: "POST",
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error ?? "Não foi possível enviar o documento.");
        setLoading(false);
        return;
      }

      setFile(null);
      setLoading(false);
      router.refresh();
    } catch {
      setError("Erro de conexão. Tente novamente.");
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label htmlFor="type" className={labelClass}>
          Tipo de documento
        </label>
        <select
          id="type"
          value={type}
          onChange={(event) => setType(event.target.value)}
          className={inputClass}
        >
          {DOCUMENT_TYPES.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label htmlFor="file" className={labelClass}>
          Arquivo (PDF, JPG ou PNG, até 5MB)
        </label>
        <input
          id="file"
          type="file"
          accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"
          onChange={(event) => setFile(event.target.files?.[0] ?? null)}
          className={inputClass}
        />
      </div>

      {error && <p className={errorTextClass}>{error}</p>}

      <button type="submit" disabled={loading} className={primaryButtonClass}>
        {loading ? "Enviando..." : "Enviar documento"}
      </button>
    </form>
  );
}
