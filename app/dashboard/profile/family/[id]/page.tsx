import { getServerSession } from "next-auth/next";
import { notFound, redirect } from "next/navigation";

import { BackLink } from "@/app/dashboard/_components/back-link";
import { AvatarPlaceholder } from "@/app/dashboard/familia/_components/avatar-placeholder";
import { authOptions } from "@/lib/auth";
import { formatCareTypes } from "@/lib/care-types";
import { prisma } from "@/lib/prisma";

// Read-only "who is this family" page -- any logged-in user (either role)
// can view it, no prior Hire required, since it only surfaces the same
// info already shown on the search/match cards, just reorganized as its
// own page. Deliberately never shows `address` or `phone`: those stay
// exclusive to /dashboard/hires/[id], gated by Hire status (see CLAUDE.md
// "Tela de detalhe de um Hire" and "Exposição condicional de telefone") --
// this page is "who is this person", not "how do I contact them".
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

  // Explicit `select` (not `include`) so `phone`/`address` never even reach
  // this Server Component's memory, let alone risk being rendered by a
  // future edit -- same structural-safety approach as FamilyForDisplay in
  // lib/matching.ts (see CLAUDE.md "Busca de famílias pelo cuidador").
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
