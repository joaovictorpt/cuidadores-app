import { getServerSession } from "next-auth/next";
import Link from "next/link";

import { AccountMenu } from "@/app/components/account-menu";
import { TrevoLogo } from "@/app/components/trevo-logo";
import { authOptions } from "@/lib/auth";
import { siteConfig } from "@/lib/site-config";
import { accentButtonClass } from "@/lib/ui";

const NAV_LINKS = [
  { href: "/cadastro/familia", label: "Para famílias" },
  { href: "/cadastro/cuidador", label: "Para cuidadores" },
  { href: "/#como-funciona", label: "Como funciona" },
];

// Persistent top bar with the logo (linking back to "/") plus a
// session-aware account affordance on the right -- present on every page,
// including the home page itself now (see CLAUDE.md "Navegação" for why
// this used to exclude "/" and no longer does).
//
// Stays a Server Component: `getServerSession` here just decodes the JWT
// from cookies (no DB round-trip, per the JWT session strategy documented
// in CLAUDE.md "Autenticação"), so resolving the session server-side avoids
// the client-side fetch-then-flash-of-"Entrar" that `useSession()` would
// cause on first paint. Only the interactive dropdown itself
// (open/close, click-outside, Escape) needs client state, so that part
// alone is split out into app/components/account-menu.tsx.
export async function SiteHeader() {
  const session = await getServerSession(authOptions);

  return (
    <header className="border-b border-muted/20 bg-white px-4 py-3">
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-4">
        <Link
          href="/"
          className="inline-flex items-center gap-2 rounded-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        >
          <TrevoLogo className="h-6 w-6 text-primary" />
          <span className="font-display text-base font-semibold text-ink">
            {siteConfig.name}
          </span>
        </Link>

        <nav className="hidden items-center gap-6 md:flex">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="rounded-lg text-sm font-medium text-ink transition hover:text-accent motion-reduce:transition-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            >
              {link.label}
            </Link>
          ))}
        </nav>

        {session?.user ? (
          <AccountMenu />
        ) : (
          <Link href="/login" className={accentButtonClass}>
            Entrar
          </Link>
        )}
      </div>
    </header>
  );
}
