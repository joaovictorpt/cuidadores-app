import { getServerSession } from "next-auth/next";
import { notFound, redirect } from "next/navigation";

import { AvailabilityBadge } from "@/app/components/availability-badge";
import { BackLink } from "@/app/dashboard/_components/back-link";
import { AvatarPlaceholder } from "@/app/dashboard/familia/_components/avatar-placeholder";
import { authOptions } from "@/lib/auth";
import { formatCareTypes } from "@/lib/care-types";
import { prisma } from "@/lib/prisma";
import { calculateAverageRating } from "@/lib/reviews";

// Read-only "who is this caregiver" page -- mirrors
// app/dashboard/profile/family/[id]/page.tsx on the other side of the
// marketplace. Same privacy rule applies: never `phone`, that's exclusive
// to /dashboard/hires/[id] gated by Hire status.
export default async function CaregiverProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    redirect("/login");
  }

  const { id } = await params;

  // Explicit `select` (not `include`) so `phone` never even reaches this
  // Server Component's memory -- same structural-safety approach as
  // FamilyForDisplay in lib/matching.ts (see CLAUDE.md "Busca de famílias
  // pelo cuidador").
  const caregiverProfile = await prisma.caregiverProfile.findUnique({
    where: { userId: id },
    select: {
      city: true,
      state: true,
      bio: true,
      careTypes: true,
      availabilityStatus: true,
      user: {
        select: { name: true, reviewsReceived: { select: { rating: true } } },
      },
    },
  });

  if (!caregiverProfile) {
    notFound();
  }

  const ratings = caregiverProfile.user.reviewsReceived.map((r) => r.rating);
  const { average: averageRating, total: ratingCount } =
    calculateAverageRating(ratings);

  return (
    <main className="min-h-screen bg-background px-4 py-12">
      <div className="mx-auto max-w-2xl">
        <BackLink href="/dashboard" />

        <div className="rounded-card border border-muted/20 bg-white p-6 shadow-sm sm:p-8">
          <div className="flex items-start gap-4">
            <AvatarPlaceholder name={caregiverProfile.user.name} />
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="font-display text-2xl font-semibold text-ink">
                  {caregiverProfile.user.name ?? "Cuidador"}
                </h1>
                <AvailabilityBadge status={caregiverProfile.availabilityStatus} />
              </div>
              <p className="mt-1 text-sm text-muted">
                {[caregiverProfile.city, caregiverProfile.state]
                  .filter(Boolean)
                  .join(", ") || "Localização não informada"}
              </p>
            </div>
          </div>

          {caregiverProfile.bio && (
            <p className="mt-6 text-sm text-ink/80">{caregiverProfile.bio}</p>
          )}

          <div className="mt-6 grid grid-cols-2 gap-4">
            <div>
              <h2 className="text-xs font-medium uppercase text-muted">
                Tipos de cuidado atendidos
              </h2>
              <p className="mt-1 text-sm text-ink/80">
                {caregiverProfile.careTypes.length > 0
                  ? formatCareTypes(caregiverProfile.careTypes)
                  : "Não informado"}
              </p>
            </div>
            <div>
              <h2 className="text-xs font-medium uppercase text-muted">
                Avaliação
              </h2>
              <p className="mt-1 font-mono text-sm text-ink/80">
                {averageRating !== null
                  ? `${averageRating.toFixed(1)}/5 (${ratingCount})`
                  : "Sem avaliações ainda"}
              </p>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
