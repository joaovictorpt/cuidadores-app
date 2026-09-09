// Avatar placeholder para um card de cuidador -- listras diagonais sutis (em
// accent-light) em vez de um círculo preenchido chapado, com a inicial do
// nome ainda sobreposta no centro, pra manter os cards visualmente
// distinguíveis entre si à primeira vista. Usado em /buscar e /match-recomendado.
export function AvatarPlaceholder({ name }: { name: string | null }) {
  const initial = (name ?? "C").charAt(0).toUpperCase();

  return (
    <div
      aria-hidden="true"
      style={{
        backgroundImage:
          "repeating-linear-gradient(45deg, var(--color-accent-light) 0px, var(--color-accent-light) 6px, transparent 6px, transparent 12px)",
      }}
      className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-accent/20 bg-white font-display text-lg font-semibold text-primary"
    >
      {initial}
    </div>
  );
}
