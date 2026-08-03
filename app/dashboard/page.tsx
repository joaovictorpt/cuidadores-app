import { Role } from "@prisma/client";
import { getServerSession } from "next-auth/next";
import { redirect } from "next/navigation";

import { authOptions } from "@/lib/auth";

// Role-agnostic dispatcher: gives anything that doesn't know the logged-in
// user's role ahead of time (the header's account menu, links in emails,
// etc.) a single stable URL to point at, instead of having to branch
// client-side. Unauthenticated requests never reach this component --
// middleware.ts's matcher includes the bare "/dashboard" route specifically
// so the login redirect happens before this runs.
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
