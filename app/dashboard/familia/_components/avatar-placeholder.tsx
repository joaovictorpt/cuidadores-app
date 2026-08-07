// Placeholder avatar for a caregiver card -- subtle diagonal stripes (in
// accent-light) instead of a flat filled circle, with the name's initial
// still overlaid on top so cards stay visually distinguishable from each
// other at a glance. Used in /buscar and /match-recomendado.
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
