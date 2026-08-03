"use client";

import { signIn } from "next-auth/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

import {
  cardClass,
  errorTextClass,
  inputClass,
  labelClass,
  primaryButtonClass,
} from "@/lib/ui";

export function LoginForm({ callbackUrl }: { callbackUrl?: string }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setLoading(true);

    const result = await signIn("credentials", {
      email,
      password,
      redirect: false,
    });

    if (!result || result.error) {
      setError("Email ou senha inválidos.");
      setLoading(false);
      return;
    }

    router.push(callbackUrl || "/dashboard");
    router.refresh();
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className={cardClass}>
        <h1 className="mb-6 font-display text-3xl font-semibold text-ink">
          Entrar
        </h1>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="email" className={labelClass}>
              Email
            </label>
            <input
              id="email"
              type="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
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
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className={inputClass}
            />
          </div>

          {error && <p className={errorTextClass}>{error}</p>}

          <button type="submit" disabled={loading} className={primaryButtonClass}>
            {loading ? "Entrando..." : "Entrar"}
          </button>
        </form>

        <p className="mt-4 text-center text-sm text-muted">
          Não tem conta?{" "}
          <Link href="/cadastro" className="font-medium text-primary hover:underline">
            Cadastre-se
          </Link>
        </p>
      </div>
    </main>
  );
}
