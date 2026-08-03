"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { TrevoLogo } from "@/app/components/trevo-logo";
import { siteConfig } from "@/lib/site-config";

// Persistent top bar with the logo, linking back to "/" -- present on every
// page except the home page itself (which already has a large logo in its
// hero; repeating it in a header right above would just be visual noise).
//
// Why a client-side pathname check instead of excluding "/" via route
// groups: this app's routes (cadastro/, login/, dashboard/) all live
// directly under app/ with no route groups today, and dozens of files
// already import from them via paths like "@/app/dashboard/_components/...".
// Moving every one of those folders into a group (e.g. app/(app)/dashboard)
// would mean rewriting every such import just to hide a header on a single
// route. Next.js layouts also have no server-side access to the current
// pathname, so the standard escape hatch -- and the one used here -- is to
// push the one bit of route-awareness into a small Client Component via
// `usePathname()`, leaving the folder structure and every existing import
// untouched.
export function SiteHeader() {
  const pathname = usePathname();

  if (pathname === "/") {
    return null;
  }

  return (
    <header className="border-b border-muted/20 bg-white px-4 py-3">
      <div className="mx-auto max-w-5xl">
        <Link
          href="/"
          className="inline-flex items-center gap-2 rounded-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        >
          <TrevoLogo className="h-6 w-6 text-primary" />
          <span className="font-display text-base font-semibold text-ink">
            {siteConfig.name}
          </span>
        </Link>
      </div>
    </header>
  );
}
