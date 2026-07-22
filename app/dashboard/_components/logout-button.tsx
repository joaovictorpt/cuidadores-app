"use client";

import { signOut } from "next-auth/react";

import { primaryButtonClass } from "@/lib/ui";

export function LogoutButton() {
  return (
    <button
      type="button"
      onClick={() => signOut({ callbackUrl: "/login" })}
      className={primaryButtonClass}
    >
      Sair
    </button>
  );
}
