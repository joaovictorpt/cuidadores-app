import type { WheelEvent } from "react";

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
  `w-full rounded-lg border border-muted/40 bg-white px-3 py-2 text-sm text-ink placeholder:text-muted/60 disabled:cursor-not-allowed disabled:opacity-60 ${focusRing}`;

export const primaryButtonClass =
  `w-full rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white transition hover:bg-primary-dark motion-reduce:transition-none disabled:cursor-not-allowed disabled:opacity-60 ${focusRing}`;

export const secondaryButtonClass =
  `rounded-lg border border-muted/40 bg-white px-3 py-1.5 text-sm font-medium text-ink transition hover:bg-primary-light motion-reduce:transition-none disabled:cursor-not-allowed disabled:opacity-60 ${focusRing}`;

// Reserved for the standout calls-to-action the design spec singles out
// (e.g. "Contratar", "Aceitar") -- not a general-purpose button variant.
// text-white (not text-ink): under the "Editorial de Confiança" palette,
// accent is a dark bordeaux (~27% lightness), so dark ink text on top of it
// fails contrast (~1.6:1) -- this was text-ink under the previous, much
// lighter amber accent, where dark text was the correct choice.
export const accentButtonClass =
  `rounded-lg bg-accent px-3 py-1.5 text-sm font-medium text-white transition hover:bg-accent-dark motion-reduce:transition-none disabled:cursor-not-allowed disabled:opacity-60 ${focusRing}`;

// Large marketing CTA (hero/final-CTA sections) -- primaryButtonClass is
// sized for form submit buttons, too small for a landing page's main calls
// to action. Full-width on mobile, auto-width side-by-side on larger
// screens, per the "empilhados em mobile" requirement.
export const heroButtonClass =
  `inline-flex w-full items-center justify-center rounded-lg bg-primary px-8 py-4 text-base font-semibold text-white transition hover:bg-primary-dark motion-reduce:transition-none sm:w-auto sm:text-lg ${focusRing}`;

// Same size/shape as heroButtonClass but outlined instead of filled -- for
// the hero's secondary CTA. Reverses the earlier "equal visual weight
// between família/cuidador" decision (see CLAUDE.md "Identidade do site" /
// "Sistema de design" for the reversal note): the "Editorial de Confiança"
// direction wants one clear primary action per hero, not two competing
// filled buttons.
// hover:bg-ink/5 (not bg-primary-light): this button renders both on the
// plain page background and inside the primary-light "CTA final" section --
// a primary-light hover would be invisible on that second background, so a
// background-independent dark tint is used instead.
export const heroOutlineButtonClass =
  `inline-flex w-full items-center justify-center rounded-lg border-2 border-ink bg-transparent px-8 py-4 text-base font-semibold text-ink transition hover:bg-ink/5 motion-reduce:transition-none sm:w-auto sm:text-lg ${focusRing}`;

// Same size as heroButtonClass, accent color instead of primary -- for the
// one action on a screen that should visually outrank everything else
// (e.g. "Buscar cuidadores" on the family dashboard, the single most
// important thing a family can do there). `text-white` matches
// accentButtonClass's contrast choice for the same (dark bordeaux) background.
export const heroAccentButtonClass =
  `inline-flex w-full items-center justify-center rounded-lg bg-accent px-8 py-4 text-base font-semibold text-white transition hover:bg-accent-dark motion-reduce:transition-none sm:w-auto sm:text-lg ${focusRing}`;

export const errorTextClass = "rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700";

export const successTextClass = "rounded-lg bg-green-50 px-3 py-2 text-sm text-green-700";

// Strips everything but 0-9 -- used on the "Anos de experiência" field so
// users can't type "." or "," (a <input type="number"> still allows those,
// plus "e"/"+"/"-", since scientific notation is technically valid there).
// This is UX only: the real validation is the Zod schema on the server.
export function sanitizeDigitsOnly(value: string): string {
  return value.replace(/\D/g, "");
}

// Browsers let the mouse wheel silently change a focused <input
// type="number">'s value -- a separate native behavior from the spin-button
// arrows (already hidden via CSS in app/globals.css), and `preventDefault()`
// on the wheel event alone doesn't reliably suppress it across browsers.
// Blurring the input on wheel is the standard, reliable fix: pass this as
// `onWheel` on every numeric input (hourlyRate, experienceYears, etc.)
// instead of repeating the handler inline.
export function blurOnWheel(event: WheelEvent<HTMLInputElement>): void {
  event.currentTarget.blur();
}
