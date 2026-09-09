import Link from "next/link";

import { secondaryButtonClass } from "@/lib/ui";

type BackLinkProps = {
  href: string;
  label?: string;
};

// Link discreto "voltar ao dashboard" -- o padrão oficial para retornar
// de qualquer subpágina do dashboard (ver CLAUDE.md "Navegação de volta").
// Toda página de dashboard já sabe o role do usuário logado no servidor
// (via getServerSession), então `href` é passado explicitamente pelo
// chamador em vez deste componente redescobri-lo a partir de um hook de
// sessão no cliente.
//
// Deve ficar como o primeiro elemento do conteúdo de uma página, acima do
// <h1> -- mesmo peso visual do link "← Voltar" nas páginas de cadastro,
// estilizado propositalmente com secondaryButtonClass (não
// primaryButtonClass) para nunca competir com o botão de ação principal de
// uma tela (Salvar, Contratar, etc.).
export function BackLink({ href, label = "← Voltar" }: BackLinkProps) {
  return (
    <Link href={href} className={`${secondaryButtonClass} mb-6 inline-block`}>
      {label}
    </Link>
  );
}
