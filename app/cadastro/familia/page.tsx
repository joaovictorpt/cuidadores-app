"use client";

import { signIn } from "next-auth/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

import { PhoneInput } from "@/app/components/phone-input";
import {
  cardClass,
  errorTextClass,
  inputClass,
  labelClass,
  primaryButtonClass,
  secondaryButtonClass,
} from "@/lib/ui";

const CARE_TYPES = [
  { value: "ELDERLY", label: "Idosos" },
  { value: "CHILD", label: "Crianças" },
  { value: "SPECIAL_NEEDS", label: "Pessoas com necessidades especiais" },
] as const;

const INITIAL_FORM = {
  email: "",
  password: "",
  phone: "",
  city: "",
  state: "",
  address: "",
  bio: "",
};

export default function CadastroFamiliaPage() {
  const router = useRouter();
  const [form, setForm] = useState(INITIAL_FORM);
  const [neededCareTypes, setNeededCareTypes] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
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
    setError(null);
    setLoading(true);

    try {
      const response = await fetch("/api/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: form.email,
          password: form.password,
          role: "FAMILY",
          phone: form.phone || undefined,
          city: form.city || undefined,
          state: form.state || undefined,
          address: form.address || undefined,
          bio: form.bio || undefined,
          neededCareTypes,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error ?? "Não foi possível concluir o cadastro.");
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

      router.push("/dashboard/familia");
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
          Cadastro de família
        </h1>
        <p className="mb-6 text-sm text-muted">
          Crie sua conta para encontrar um cuidador.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="email" className={labelClass}>
              Email
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
            </label>
            <PhoneInput
              id="phone"
              value={form.phone}
              onChange={(value) => update("phone", value)}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="city" className={labelClass}>
                Cidade
              </label>
              <input
                id="city"
                type="text"
                value={form.city}
                onChange={(event) => update("city", event.target.value)}
                className={inputClass}
              />
            </div>
            <div>
              <label htmlFor="state" className={labelClass}>
                Estado
              </label>
              <input
                id="state"
                type="text"
                value={form.state}
                onChange={(event) => update("state", event.target.value)}
                className={inputClass}
              />
            </div>
          </div>
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
