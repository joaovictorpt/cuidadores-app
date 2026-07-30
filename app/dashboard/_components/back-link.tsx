import Link from "next/link";

import { secondaryButtonClass } from "@/lib/ui";

type BackLinkProps = {
  href: string;
  label?: string;
};

// Discreet "back to dashboard" link -- the official pattern for returning
// from any dashboard sub-page (see CLAUDE.md "Navegação de volta"). Every
// dashboard page already knows the logged-in user's role server-side (via
// getServerSession), so `href` is passed explicitly by the caller rather
// than this component re-deriving it from a client-side session hook.
//
// Meant to sit as the very first element of a page's content, above the
// <h1> -- same visual weight as the "← Voltar" link on the cadastro pages,
// deliberately styled with secondaryButtonClass (not primaryButtonClass) so
// it never competes with a screen's primary action button (Salvar,
// Contratar, etc.).
export function BackLink({ href, label = "← Voltar" }: BackLinkProps) {
  return (
    <Link href={href} className={`${secondaryButtonClass} mb-6 inline-block`}>
      {label}
    </Link>
  );
}
