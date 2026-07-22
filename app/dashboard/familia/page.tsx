import { getServerSession } from "next-auth/next";
import Link from "next/link";

import { authOptions } from "@/lib/auth";
import { LogoutButton } from "@/app/dashboard/_components/logout-button";
import { cardClass } from "@/lib/ui";

export default async function DashboardFamiliaPage() {
  const session = await getServerSession(authOptions);

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-background px-4">
      <div className={`${cardClass} text-center`}>
        <h1 className="mb-2 font-display text-2xl font-semibold text-ink">
          Bem-vindo, {session?.user?.name || session?.user?.email}
        </h1>
        <p className="mb-6 text-sm text-muted">
          Dashboard da família (em construção)
        </p>
        <Link
          href="/dashboard/familia/perfil"
          className="mb-2 block text-sm font-medium text-primary hover:underline"
        >
          Editar perfil
        </Link>
        <Link
          href="/dashboard/familia/buscar"
          className="mb-2 block text-sm font-medium text-primary hover:underline"
        >
          Buscar cuidadores
        </Link>
        <Link
          href="/dashboard/familia/match-recomendado"
          className="mb-2 block text-sm font-medium text-primary hover:underline"
        >
          Match recomendado
        </Link>
        <Link
          href="/dashboard/familia/contratacoes"
          className="mb-4 block text-sm font-medium text-primary hover:underline"
        >
          Minhas contratações
        </Link>
        <LogoutButton />
      </div>
    </main>
  );
}
