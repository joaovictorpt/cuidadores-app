"use client";

import { CircleUserRound } from "lucide-react";
import { signOut } from "next-auth/react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";

// Botão de ícone de conta que abre um pequeno dropdown ("Painel de controle",
// "Sair") -- a única parte interativa de site-header.tsx, separada em seu
// próprio Client Component para que o header em si possa continuar sendo um
// Server Component (ele só checa `session ? <AccountMenu /> : <Link>Entrar</Link>`).
export function AccountMenu() {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!isOpen) return;

    function handlePointerDown(event: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsOpen(false);
        buttonRef.current?.focus();
      }
    }

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  return (
    <div className="relative" ref={containerRef}>
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        aria-haspopup="menu"
        aria-expanded={isOpen}
        className="flex h-9 w-9 items-center justify-center rounded-full text-primary transition hover:bg-primary-light motion-reduce:transition-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
      >
        <CircleUserRound aria-hidden="true" className="h-6 w-6" />
        <span className="sr-only">Menu da conta</span>
      </button>

      {isOpen && (
        <div
          role="menu"
          className="absolute right-0 z-20 mt-2 w-48 rounded-lg border border-muted/40 bg-white py-1 shadow-sm"
        >
          <Link
            href="/dashboard"
            role="menuitem"
            onClick={() => setIsOpen(false)}
            className="block px-4 py-2 text-sm text-ink hover:bg-primary-light focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary"
          >
            Painel de controle
          </Link>
          <button
            type="button"
            role="menuitem"
            onClick={() => signOut({ callbackUrl: "/login" })}
            className="block w-full px-4 py-2 text-left text-sm text-ink hover:bg-primary-light focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary"
          >
            Sair
          </button>
        </div>
      )}
    </div>
  );
}
