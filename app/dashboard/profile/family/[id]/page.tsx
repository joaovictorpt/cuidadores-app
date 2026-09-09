import { getServerSession } from "next-auth/next";
import { notFound, redirect } from "next/navigation";

import { BackLink } from "@/app/dashboard/_components/back-link";
import { AvatarPlaceholder } from "@/app/dashboard/familia/_components/avatar-placeholder";
import { authOptions } from "@/lib/auth";
import { formatCareTypes } from "@/lib/care-types";
import { prisma } from "@/lib/prisma";

// Página somente-leitura "quem é essa família" -- qualquer usuário logado
// (de qualquer role) pode vê-la, sem exigir um Hire prévio, já que ela só
// mostra a mesma informação já exibida nos cards de busca/match, apenas
// reorganizada como uma página própria. Deliberadamente nunca mostra
// `address` nem `phone`: esses ficam exclusivos a /dashboard/hires/[id],
// condicionados ao status do Hire (ver CLAUDE.md "Tela de detalhe de um
// Hire" e "Exposição condicional de telefone") -- esta página responde
// "quem é essa pessoa", não "como eu a contato".
export default async function FamilyProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    redirect("/login");
  }

  const { id } = await params;

  // `select` explícito (não `include`) para que `phone`/`address` nunca
  // sequer cheguem à memória deste Server Component, nem corram o risco de
  // serem renderizados por uma edição futura -- mesma abordagem de
  // segurança estrutural usada por FamilyForDisplay em lib/matching.ts
  // (ver CLAUDE.md "Busca de famílias pelo cuidador").
  const familyProfile = await prisma.familyProfile.findUnique({
    where: { userId: id },
    select: {
      city: true,
      state: true,
      bio: true,
      hourlyBudget: true,
      neededCareTypes: true,
      user: { select: { name: true } },
    },
  });

  if (!familyProfile) {
    notFound();
  }

  return (
    <main className="min-h-screen bg-background px-4 py-12">
      <div className="mx-auto max-w-2xl">
        <BackLink href="/dashboard" />

        <div className="rounded-card border border-muted/20 bg-white p-6 shadow-sm sm:p-8">
          <div className="flex items-start gap-4">
            <AvatarPlaceholder name={familyProfile.user.name} />
            <div>
              <h1 className="font-display text-2xl font-semibold text-ink">
                {familyProfile.user.name ?? "Família"}
              </h1>
              <p className="mt-1 text-sm text-muted">
                {[familyProfile.city, familyProfile.state]
                  .filter(Boolean)
                  .join(", ") || "Localização não informada"}
              </p>
            </div>
          </div>

          {familyProfile.bio && (
            <p className="mt-6 text-sm text-ink/80">{familyProfile.bio}</p>
          )}

          <div className="mt-6 grid grid-cols-2 gap-4">
            <div>
              <h2 className="text-xs font-medium uppercase text-muted">
                Tipos de cuidado procurados
              </h2>
              <p className="mt-1 text-sm text-ink/80">
                {familyProfile.neededCareTypes.length > 0
                  ? formatCareTypes(familyProfile.neededCareTypes)
                  : "Não informado"}
              </p>
            </div>
            <div>
              <h2 className="text-xs font-medium uppercase text-muted">
                Orçamento
              </h2>
              <p className="mt-1 font-mono text-sm text-ink/80">
                {familyProfile.hourlyBudget !== null
                  ? `Até R$ ${Number(familyProfile.hourlyBudget).toFixed(2)}/h`
                  : "Orçamento não informado"}
              </p>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
