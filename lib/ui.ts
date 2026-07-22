// Shared Tailwind class strings for the app's design system. Keeping these
// centralized means every screen that imports from here stays in sync when
// the system evolves, instead of each page hand-rolling its own colors.
// See CLAUDE.md "Sistema de design" for the full palette/typography spec.

const focusRing =
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary";

export const cardClass =
  "w-full max-w-md rounded-card border border-muted/20 bg-white p-8 shadow-sm";

// General-purpose content card (grid/list items) -- same visual language as
// cardClass but without the fixed max-width, since it's meant to sit inside
// a grid rather than be a standalone centered form card.
export const contentCardClass =
  "rounded-card border border-muted/20 bg-white p-6 shadow-sm";

export const labelClass = "mb-1 block text-sm font-medium text-muted";

export const inputClass =
  `w-full rounded-lg border border-muted/40 bg-white px-3 py-2 text-sm text-ink placeholder:text-muted/60 ${focusRing}`;

export const primaryButtonClass =
  `w-full rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white transition hover:bg-primary-dark motion-reduce:transition-none disabled:cursor-not-allowed disabled:opacity-60 ${focusRing}`;

export const secondaryButtonClass =
  `rounded-lg border border-muted/40 bg-white px-3 py-1.5 text-sm font-medium text-ink transition hover:bg-primary-light motion-reduce:transition-none disabled:cursor-not-allowed disabled:opacity-60 ${focusRing}`;

// Reserved for the standout calls-to-action the design spec singles out
// (e.g. "Contratar", "Aceitar") -- not a general-purpose button variant.
export const accentButtonClass =
  `rounded-lg bg-accent px-3 py-1.5 text-sm font-medium text-ink transition hover:bg-accent-dark motion-reduce:transition-none disabled:cursor-not-allowed disabled:opacity-60 ${focusRing}`;

// Large marketing CTA (hero/final-CTA sections) -- primaryButtonClass is
// sized for form submit buttons, too small for a landing page's main calls
// to action. Full-width on mobile, auto-width side-by-side on larger
// screens, per the "empilhados em mobile" requirement.
export const heroButtonClass =
  `inline-flex w-full items-center justify-center rounded-lg bg-primary px-8 py-4 text-base font-semibold text-white transition hover:bg-primary-dark motion-reduce:transition-none sm:w-auto sm:text-lg ${focusRing}`;

export const errorTextClass = "rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700";

export const successTextClass = "rounded-lg bg-green-50 px-3 py-2 text-sm text-green-700";
