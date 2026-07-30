"use client";

import { signIn } from "next-auth/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

import { LocationFields } from "@/app/components/location-fields";
import { PhoneInput } from "@/app/components/phone-input";
import { RequiredMark } from "@/app/components/required-mark";
import {
  formatDateInputValue,
  isAdult,
  isBirthDateInFuture,
  isBirthDateTooOld,
  MIN_BIRTH_DATE,
  MIN_REGISTRATION_AGE,
} from "@/lib/age";
import { firstApiErrorMessage } from "@/lib/api-error";
import {
  cardClass,
  errorTextClass,
  inputClass,
  labelClass,
  primaryButtonClass,
  sanitizeDigitsOnly,
  secondaryButtonClass,
} from "@/lib/ui";

const CARE_TYPES = [
  { value: "ELDERLY", label: "Idosos" },
  { value: "CHILD", label: "Crianças" },
  { value: "SPECIAL_NEEDS", label: "Pessoas com necessidades especiais" },
] as const;

const INITIAL_FORM = {
  name: "",
  email: "",
  password: "",
  phone: "",
  birthDate: "",
  city: "",
  state: "",
  bio: "",
  hourlyRate: "",
  experienceYears: "",
};

export default function CadastroCuidadorPage() {
  const router = useRouter();
  const [form, setForm] = useState(INITIAL_FORM);
  const [careTypes, setCareTypes] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
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
    setError(null);

    // Client-side checks for instant feedback -- the server (app/api
    // /register/route.ts) re-validates all of this authoritatively via the
    // same lib/age.ts helpers, so none of it can be bypassed by skipping the
    // UI (the date input's min/max only stop the browser's own picker, not
    // a hand-crafted request).
    const birthDateValue = form.birthDate ? new Date(form.birthDate) : null;
    if (!birthDateValue || isBirthDateInFuture(birthDateValue)) {
      setError("Data de nascimento não pode ser no futuro.");
      return;
    }
    if (isBirthDateTooOld(birthDateValue)) {
      setError(`Data de nascimento não pode ser anterior a ${MIN_BIRTH_DATE.getFullYear()}.`);
      return;
    }
    if (!isAdult(birthDateValue)) {
      setError(
        `Você precisa ter pelo menos ${MIN_REGISTRATION_AGE} anos para se cadastrar.`
      );
      return;
    }

    setLoading(true);

    try {
      const response = await fetch("/api/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name,
          email: form.email,
          password: form.password,
          role: "CAREGIVER",
          phone: form.phone,
          birthDate: form.birthDate,
          city: form.city,
          state: form.state,
          bio: form.bio || undefined,
          hourlyRate: form.hourlyRate ? Number(form.hourlyRate) : undefined,
          experienceYears: form.experienceYears ? Number(form.experienceYears) : undefined,
          careTypes,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(firstApiErrorMessage(data, "Não foi possível concluir o cadastro."));
        setLoading(false);
        return;
      }

      const result = await signIn("credentials", {
        email: form.email,
        password: form.password,
        redirect: false,
      });

      if (!result || result.error) {
        setError(
          "Cadastro concluído, mas não foi possível entrar automaticamente. Tente fazer login."
        );
        setLoading(false);
        return;
      }

      router.push("/dashboard/cuidador");
      router.refresh();
    } catch {
      setError("Erro de conexão. Tente novamente.");
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4 py-12">
      <div className={cardClass}>
        <Link
          href="/cadastro"
          className={`${secondaryButtonClass} mb-6 inline-block`}
        >
          ← Voltar
        </Link>

        <h1 className="mb-1 font-display text-2xl font-semibold text-ink">
          Cadastro de cuidador
        </h1>
        <p className="mb-6 text-sm text-muted">
          Crie sua conta para oferecer seus serviços.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="name" className={labelClass}>
              Nome completo
              <RequiredMark />
            </label>
            <input
              id="name"
              type="text"
              required
              value={form.name}
              onChange={(event) => update("name", event.target.value)}
              className={inputClass}
            />
          </div>
          <div>
            <label htmlFor="email" className={labelClass}>
              Email
              <RequiredMark />
            </label>
            <input
              id="email"
              type="email"
              required
              value={form.email}
              onChange={(event) => update("email", event.target.value)}
              className={inputClass}
            />
          </div>
          <div>
            <label htmlFor="password" className={labelClass}>
              Senha
              <RequiredMark />
            </label>
            <input
              id="password"
              type="password"
              required
              minLength={8}
              value={form.password}
              onChange={(event) => update("password", event.target.value)}
              className={inputClass}
            />
          </div>
          <div>
            <label htmlFor="phone" className={labelClass}>
              Telefone
              <RequiredMark />
            </label>
            <PhoneInput
              id="phone"
              value={form.phone}
              onChange={(value) => update("phone", value)}
            />
          </div>
          <div>
            <label htmlFor="birthDate" className={labelClass}>
              Data de nascimento
              <RequiredMark />
            </label>
            <input
              id="birthDate"
              type="date"
              required
              min={formatDateInputValue(MIN_BIRTH_DATE)}
              max={formatDateInputValue(new Date())}
              value={form.birthDate}
              onChange={(event) => update("birthDate", event.target.value)}
              className={inputClass}
            />
          </div>
          <LocationFields
            state={form.state}
            city={form.city}
            onStateChange={(value) =>
              setForm((prev) => ({ ...prev, state: value, city: "" }))
            }
            onCityChange={(value) => update("city", value)}
            required
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

          {error && <p className={errorTextClass}>{error}</p>}

          <button type="submit" disabled={loading} className={primaryButtonClass}>
            {loading ? "Criando conta..." : "Criar conta"}
          </button>
        </form>

        <p className="mt-4 text-center text-sm text-muted">
          Já tem conta?{" "}
          <Link href="/login" className="font-medium text-primary hover:underline">
            Entrar
          </Link>
        </p>
      </div>
    </main>
  );
}
