"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

import {
  errorTextClass,
  inputClass,
  labelClass,
  secondaryButtonClass,
  successTextClass,
} from "@/lib/ui";

const RATING_OPTIONS = [5, 4, 3, 2, 1];

export function ReviewForm({ hireId }: { hireId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/reviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          hireId,
          rating,
          comment: comment || undefined,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error ?? "Não foi possível enviar a avaliação.");
        setLoading(false);
        return;
      }

      setSubmitted(true);
      router.refresh();
    } catch {
      setError("Erro de conexão. Tente novamente.");
      setLoading(false);
    }
  }

  if (submitted) {
    return <p className={successTextClass}>Avaliação enviada!</p>;
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={secondaryButtonClass}
      >
        Avaliar
      </button>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-3 rounded-lg border border-muted/20 p-3"
    >
      <div>
        <label htmlFor={`rating-${hireId}`} className={labelClass}>
          Nota
        </label>
        <select
          id={`rating-${hireId}`}
          value={rating}
          onChange={(event) => setRating(Number(event.target.value))}
          className={inputClass}
        >
          {RATING_OPTIONS.map((value) => (
            <option key={value} value={value}>
              {value} {value === 1 ? "estrela" : "estrelas"}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label htmlFor={`comment-${hireId}`} className={labelClass}>
          Comentário (opcional)
        </label>
        <textarea
          id={`comment-${hireId}`}
          value={comment}
          onChange={(event) => setComment(event.target.value)}
          rows={2}
          className={inputClass}
        />
      </div>

      {error && <p className={errorTextClass}>{error}</p>}

      <button type="submit" disabled={loading} className={secondaryButtonClass}>
        {loading ? "Enviando..." : "Enviar avaliação"}
      </button>
    </form>
  );
}
