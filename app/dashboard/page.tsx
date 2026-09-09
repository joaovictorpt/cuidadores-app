import { Role } from "@prisma/client";
import { getServerSession } from "next-auth/next";
import { redirect } from "next/navigation";

import { authOptions } from "@/lib/auth";

// Despachante agnóstico de role: dá a qualquer coisa que não saiba de
// antemão o role do usuário logado (o menu de conta do header, links em
// emails, etc.) uma única URL estável para apontar, em vez de precisar
// ramificar no cliente. Requisições sem sessão nunca chegam a este
// componente -- o matcher do middleware.ts inclui a rota "/dashboard" pura
// especificamente para que o redirecionamento de login aconteça antes
// disso rodar.
export default async function DashboardDispatcherPage() {
  const session = await getServerSession(authOptions);

  if (session?.user?.role === Role.FAMILY) {
    redirect("/dashboard/familia");
  }

  if (session?.user?.role === Role.CAREGIVER) {
    redirect("/dashboard/cuidador");
  }

  redirect("/");
}
