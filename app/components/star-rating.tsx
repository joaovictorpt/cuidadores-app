"use client";

import { Star } from "lucide-react";
import { useRef, useState, type KeyboardEvent } from "react";

const STAR_VALUES = [1, 2, 3, 4, 5];

type StarRatingProps = {
  value: number;
  onChange: (value: number) => void;
  label?: string;
};

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
export function StarRating({ value, onChange, label = "Avaliação" }: StarRatingProps) {
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
