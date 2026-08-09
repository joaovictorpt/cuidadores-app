"use client";

import { Star } from "lucide-react";
import { useRef, useState, type KeyboardEvent } from "react";

const STAR_VALUES = [1, 2, 3, 4, 5];

// Discriminated union so the compiler enforces the pairing: interactive
// usage must pass `onChange`, read-only usage (e.g. displaying someone
// else's past review) must not -- there's nothing to commit a change to.
type StarRatingProps =
  | { value: number; onChange: (value: number) => void; label?: string; readOnly?: false }
  | { value: number; onChange?: undefined; label?: string; readOnly: true };

// Static, non-interactive readout -- role="img" (not role="radiogroup"
// with disabled radios), since that would tell a screen reader there's an
// input here to operate, which there isn't.
function ReadOnlyStarRating({ value, label = "Avaliação" }: { value: number; label?: string }) {
  return (
    <div
      role="img"
      aria-label={`${label}: ${value} de 5 estrelas`}
      className="flex items-center gap-1"
    >
      {STAR_VALUES.map((starValue) => (
        <Star
          key={starValue}
          aria-hidden="true"
          fill={starValue <= value ? "currentColor" : "none"}
          className={`h-5 w-5 ${starValue <= value ? "text-primary" : "text-muted/40"}`}
        />
      ))}
    </div>
  );
}

// Accessible 5-star rating input, following the ARIA "radio group" pattern
// (https://www.w3.org/WAI/ARIA/apg/patterns/radio/): each star is a
// role="radio" <button>, arrow keys move focus AND select (roving
// tabindex -- only the checked star is tabbable), and Enter/Space select
// the focused star for free, since that's native <button> behavior. Hover
// only *previews* the fill up to the pointed-at star (via local
// `hoverValue`) without calling `onChange` -- the committed `value` (from
// a click or arrow key) is what persists once the pointer leaves, same
// mental model as fill="currentColor" + `stroke`/`fill` icon coloring
// already used by ConnectionLine/MatchScoreRing elsewhere in the app.
function InteractiveStarRating({
  value,
  onChange,
  label = "Avaliação",
}: {
  value: number;
  onChange: (value: number) => void;
  label?: string;
}) {
  const [hoverValue, setHoverValue] = useState<number | null>(null);
  const buttonRefs = useRef<(HTMLButtonElement | null)[]>([]);

  const displayValue = hoverValue ?? value;

  function selectAndFocus(nextValue: number) {
    onChange(nextValue);
    buttonRefs.current[nextValue - 1]?.focus();
  }

  function handleKeyDown(event: KeyboardEvent<HTMLButtonElement>, current: number) {
    if (event.key === "ArrowRight" || event.key === "ArrowUp") {
      event.preventDefault();
      selectAndFocus(Math.min(5, current + 1));
    } else if (event.key === "ArrowLeft" || event.key === "ArrowDown") {
      event.preventDefault();
      selectAndFocus(Math.max(1, current - 1));
    }
  }

  return (
    <div
      role="radiogroup"
      aria-label={label}
      className="flex items-center gap-1"
      onMouseLeave={() => setHoverValue(null)}
    >
      {STAR_VALUES.map((starValue) => {
        const filled = starValue <= displayValue;

        return (
          <button
            key={starValue}
            ref={(el) => {
              buttonRefs.current[starValue - 1] = el;
            }}
            type="button"
            role="radio"
            aria-checked={value === starValue}
            aria-label={`Avaliar com ${starValue} estrela${starValue === 1 ? "" : "s"}`}
            tabIndex={value === starValue ? 0 : -1}
            onClick={() => onChange(starValue)}
            onMouseEnter={() => setHoverValue(starValue)}
            onKeyDown={(event) => handleKeyDown(event, starValue)}
            className="rounded p-0.5 transition-colors motion-reduce:transition-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          >
            <Star
              aria-hidden="true"
              fill={filled ? "currentColor" : "none"}
              className={`h-6 w-6 transition-colors motion-reduce:transition-none ${
                filled ? "text-primary" : "text-muted/40"
              }`}
            />
          </button>
        );
      })}
    </div>
  );
}

// Dispatches on `readOnly` -- deliberately NOT a single component branching
// internally on a hook-free early return, since InteractiveStarRating's
// useState/useRef would then be called conditionally (a Rules-of-Hooks
// violation). Each branch is its own component instead, so whichever one
// renders always calls its own hooks unconditionally.
export function StarRating(props: StarRatingProps) {
  if (props.readOnly) {
    return <ReadOnlyStarRating value={props.value} label={props.label} />;
  }

  return (
    <InteractiveStarRating value={props.value} onChange={props.onChange} label={props.label} />
  );
}
