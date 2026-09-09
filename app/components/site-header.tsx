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

// Barra fina persistente no topo com a logo (linkando de volta para "/")
// mais um recurso de conta sensível à sessão à direita -- presente em toda
// página, incluindo a home page em si agora (ver CLAUDE.md "Navegação" para
// o porquê disso antes excluir "/" e não excluir mais).
//
// Continua sendo um Server Component: `getServerSession` aqui só decodifica
// o JWT a partir dos cookies (sem round-trip ao banco, conforme a
// estratégia de sessão JWT documentada em CLAUDE.md "Autenticação"), então
// resolver a sessão no servidor evita o fetch-e-depois-flash-de-"Entrar" no
// cliente que `useSession()` causaria na primeira renderização. Só o
// dropdown interativo em si (abrir/fechar, clique fora, Escape) precisa de
// estado de cliente, então só essa parte foi separada em
// app/components/account-menu.tsx.
export async function SiteHeader() {
  const session = await getServerSession(authOptions);

  return (
    <header className="border-b border-muted/20 bg-white px-4 py-3">
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-4">
        <Link
          href="/"
          className="inline-flex items-center gap-2 rounded-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        >
          <TrevoLogo className="h-9 w-9" />
          <span className="font-display text-xl font-semibold text-ink">
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
