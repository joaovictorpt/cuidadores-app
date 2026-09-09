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
  address: string;
  bio: string;
  hourlyBudget: string;
  neededCareTypes: string[];
  visibleToCaregivers: boolean;
};

export function ProfileForm({ initialProfile }: { initialProfile: InitialProfile }) {
  const [form, setForm] = useState({
    phone: initialProfile.phone,
    city: initialProfile.city,
    state: initialProfile.state,
    address: initialProfile.address,
    bio: initialProfile.bio,
    hourlyBudget: initialProfile.hourlyBudget,
  });
  const [neededCareTypes, setNeededCareTypes] = useState<string[]>(
    initialProfile.neededCareTypes
  );
  const [visibleToCaregivers, setVisibleToCaregivers] = useState(
    initialProfile.visibleToCaregivers
  );
  const [status, setStatus] = useState<"idle" | "success" | "error">("idle");
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  function update<K extends keyof typeof form>(key: K, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function toggleNeededCareType(value: string) {
    setNeededCareTypes((prev) =>
      prev.includes(value) ? prev.filter((item) => item !== value) : [...prev, value]
    );
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("idle");
    setMessage(null);

    // Mesma checagem de completude dos formulários de cadastro (lib/phone.ts)
    // -- só quando um telefone foi realmente digitado aqui, já que esse
    // campo é opcional na edição (um valor vazio significa "não alterar",
    // ver o `form.phone || undefined` abaixo).
    if (form.phone && !isCompletePhone(form.phone)) {
      setStatus("error");
      setMessage(PHONE_INVALID_MESSAGE);
      return;
    }

    setLoading(true);

    try {
      const response = await fetch("/api/family-profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone: form.phone || undefined,
          city: form.city || undefined,
          state: form.state || undefined,
          address: form.address || undefined,
          bio: form.bio || undefined,
          hourlyBudget: form.hourlyBudget ? Number(form.hourlyBudget) : undefined,
          neededCareTypes,
          visibleToCaregivers,
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
        Atualize suas informações de família.
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
        <div>
          <label htmlFor="address" className={labelClass}>
            Endereço
          </label>
          <input
            id="address"
            type="text"
            value={form.address}
            onChange={(event) => update("address", event.target.value)}
            className={inputClass}
          />
        </div>
        <fieldset>
          <legend className={labelClass}>Que tipo de cuidado você procura?</legend>
          <div className="space-y-2">
            {CARE_TYPES.map((type) => (
              <label key={type.value} className="flex items-center gap-2 text-sm text-ink">
                <input
                  type="checkbox"
                  checked={neededCareTypes.includes(type.value)}
                  onChange={() => toggleNeededCareType(type.value)}
                  className="h-4 w-4 rounded border-muted/40 text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                />
                {type.label}
              </label>
            ))}
          </div>
        </fieldset>
        <div>
          <label htmlFor="hourlyBudget" className={labelClass}>
            Quanto você pode pagar por hora (R$)
          </label>
          <input
            id="hourlyBudget"
            type="number"
            min="0"
            step="0.01"
            value={form.hourlyBudget}
            onChange={(event) => update("hourlyBudget", event.target.value)}
            onWheel={blurOnWheel}
            className={inputClass}
          />
        </div>
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
              checked={visibleToCaregivers}
              onChange={(event) => setVisibleToCaregivers(event.target.checked)}
              className="h-4 w-4 rounded border-muted/40 text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            />
            Permitir que cuidadores me encontrem e demonstrem interesse
          </label>
          <p className="mt-1 text-xs text-muted">
            Se desativado, seu perfil não aparece nas buscas nem no match
            perfeito de nenhum cuidador -- você ainda pode buscar e
            contratar cuidadores normalmente.
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
