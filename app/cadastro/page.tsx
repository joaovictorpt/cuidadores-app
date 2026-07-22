import Link from "next/link";

export default function CadastroPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-background px-4">
      <h1 className="mb-8 font-display text-3xl font-semibold text-ink">
        Como você quer se cadastrar?
      </h1>

      <div className="grid w-full max-w-2xl gap-6 sm:grid-cols-2">
        <Link
          href="/cadastro/familia"
          className="flex flex-col items-center rounded-card border border-muted/20 bg-white p-8 text-center shadow-sm transition hover:border-primary hover:shadow-md motion-reduce:transition-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        >
          <span className="font-display text-lg font-semibold text-ink">
            Sou família
          </span>
          <span className="mt-2 text-sm text-muted">
            Estou buscando um cuidador
          </span>
        </Link>

        <Link
          href="/cadastro/cuidador"
          className="flex flex-col items-center rounded-card border border-muted/20 bg-white p-8 text-center shadow-sm transition hover:border-primary hover:shadow-md motion-reduce:transition-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        >
          <span className="font-display text-lg font-semibold text-ink">
            Sou cuidador
          </span>
          <span className="mt-2 text-sm text-muted">
            Quero oferecer meus serviços
          </span>
        </Link>
      </div>

      <p className="mt-8 text-sm text-muted">
        Já tem conta?{" "}
        <Link href="/login" className="font-medium text-primary hover:underline">
          Entrar
        </Link>
      </p>
    </main>
  );
}
