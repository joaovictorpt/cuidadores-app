"use client";

import { useState, type FormEvent } from "react";

import { LocationFields } from "@/app/components/location-fields";
import { PhoneInput } from "@/app/components/phone-input";
import { isCompletePhone, PHONE_INVALID_MESSAGE } from "@/lib/phone";
import {
  blurOnWheel,
  cardClass,
  errorTextClass,
  inputClass,
  labelClass,
  primaryButtonClass,
  sanitizeDigitsOnly,
  successTextClass,
} from "@/lib/ui";

const CARE_TYPES = [
  { value: "ELDERLY", label: "Idosos" },
  { value: "CHILD", label: "Crianças" },
  { value: "SPECIAL_NEEDS", label: "Pessoas com necessidades especiais" },
] as const;

type InitialProfile = {
  phone: string;
  city: string;
  state: string;
  bio: string;
  hourlyRate: string;
  experienceYears: string;
  careTypes: string[];
  visibleToFamilies: boolean;
};

export function ProfileForm({ initialProfile }: { initialProfile: InitialProfile }) {
  const [form, setForm] = useState({
    phone: initialProfile.phone,
    city: initialProfile.city,
    state: initialProfile.state,
    bio: initialProfile.bio,
    hourlyRate: initialProfile.hourlyRate,
    experienceYears: initialProfile.experienceYears,
  });
  const [careTypes, setCareTypes] = useState<string[]>(initialProfile.careTypes);
  const [visibleToFamilies, setVisibleToFamilies] = useState(
    initialProfile.visibleToFamilies
  );
  const [status, setStatus] = useState<"idle" | "success" | "error">("idle");
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  function update<K extends keyof typeof form>(key: K, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function toggleCareType(value: string) {
    setCareTypes((prev) =>
      prev.includes(value) ? prev.filter((item) => item !== value) : [...prev, value]
    );
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("idle");
    setMessage(null);

    // Same completeness check as the registration forms (lib/phone.ts) --
    // only when a phone was actually typed here, since this field is
    // optional on edit (an empty value means "don't change it", see the
    // `form.phone || undefined` below).
    if (form.phone && !isCompletePhone(form.phone)) {
      setStatus("error");
      setMessage(PHONE_INVALID_MESSAGE);
      return;
    }

    setLoading(true);

    try {
      const response = await fetch("/api/caregiver-profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone: form.phone || undefined,
          city: form.city || undefined,
          state: form.state || undefined,
          bio: form.bio || undefined,
          hourlyRate: form.hourlyRate ? Number(form.hourlyRate) : undefined,
          experienceYears: form.experienceYears ? Number(form.experienceYears) : undefined,
          careTypes,
          visibleToFamilies,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setStatus("error");
        setMessage(data.error ?? "Não foi possível salvar as alterações.");
        setLoading(false);
        return;
      }

      setStatus("success");
      setMessage("Perfil atualizado com sucesso.");
      setLoading(false);
    } catch {
      setStatus("error");
      setMessage("Erro de conexão. Tente novamente.");
      setLoading(false);
    }
  }

  return (
    <div className={cardClass}>
      <h1 className="mb-1 font-display text-2xl font-semibold text-ink">
        Editar perfil
      </h1>
      <p className="mb-6 text-sm text-muted">
        Atualize suas informações de cuidador.
      </p>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="phone" className={labelClass}>
            Telefone
          </label>
          <PhoneInput
            id="phone"
            value={form.phone}
            onChange={(value) => update("phone", value)}
          />
        </div>
        <LocationFields
          state={form.state}
          city={form.city}
          onStateChange={(value) =>
            setForm((prev) => ({ ...prev, state: value, city: "" }))
          }
          onCityChange={(value) => update("city", value)}
          required={false}
        />
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label htmlFor="hourlyRate" className={labelClass}>
              Valor por hora (R$)
            </label>
            <input
              id="hourlyRate"
              type="number"
              min="0"
              step="0.01"
              value={form.hourlyRate}
              onChange={(event) => update("hourlyRate", event.target.value)}
              onWheel={blurOnWheel}
              className={inputClass}
            />
          </div>
          <div>
            <label htmlFor="experienceYears" className={labelClass}>
              Anos de experiência
            </label>
            <input
              id="experienceYears"
              type="number"
              min="0"
              step="1"
              value={form.experienceYears}
              onChange={(event) =>
                update("experienceYears", sanitizeDigitsOnly(event.target.value))
              }
              onWheel={blurOnWheel}
              className={inputClass}
            />
          </div>
        </div>
        <fieldset>
          <legend className={labelClass}>Tipos de cuidado</legend>
          <div className="space-y-2">
            {CARE_TYPES.map((type) => (
              <label key={type.value} className="flex items-center gap-2 text-sm text-ink">
                <input
                  type="checkbox"
                  checked={careTypes.includes(type.value)}
                  onChange={() => toggleCareType(type.value)}
                  className="h-4 w-4 rounded border-muted/40 text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                />
                {type.label}
              </label>
            ))}
          </div>
        </fieldset>
        <div>
          <label htmlFor="bio" className={labelClass}>
            Sobre você
          </label>
          <textarea
            id="bio"
            rows={3}
            value={form.bio}
            onChange={(event) => update("bio", event.target.value)}
            className={inputClass}
          />
        </div>
        <div>
          <label className="flex items-center gap-2 text-sm text-ink">
            <input
              type="checkbox"
              checked={visibleToFamilies}
              onChange={(event) => setVisibleToFamilies(event.target.checked)}
              className="h-4 w-4 rounded border-muted/40 text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            />
            Permitir que famílias me encontrem
          </label>
          <p className="mt-1 text-xs text-muted">
            Se desativado, seu perfil não aparece nas buscas nem no match
            perfeito de nenhuma família -- você ainda pode buscar e
            demonstrar interesse em famílias normalmente.
          </p>
        </div>

        {status === "error" && message && <p className={errorTextClass}>{message}</p>}
        {status === "success" && message && <p className={successTextClass}>{message}</p>}

        <button type="submit" disabled={loading} className={primaryButtonClass}>
          {loading ? "Salvando..." : "Salvar alterações"}
        </button>
      </form>
    </div>
  );
}
