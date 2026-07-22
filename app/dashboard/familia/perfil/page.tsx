import { getServerSession } from "next-auth/next";
import { redirect } from "next/navigation";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

import { ProfileForm } from "./profile-form";

export default async function EditarPerfilFamiliaPage() {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    redirect("/login");
  }

  const profile = await prisma.familyProfile.findUnique({
    where: { userId: session.user.id },
  });

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4 py-12">
      <ProfileForm
        initialProfile={{
          phone: profile?.phone ?? "",
          city: profile?.city ?? "",
          state: profile?.state ?? "",
          address: profile?.address ?? "",
          bio: profile?.bio ?? "",
          neededCareTypes: profile?.neededCareTypes ?? [],
        }}
      />
    </main>
  );
}
