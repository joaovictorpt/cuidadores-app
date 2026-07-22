// Brand signature: a simple curved line joining two points, standing in
// for família <-> cuidador. Purely decorative (aria-hidden) and deliberately
// understated -- it should read as a small detail, not compete with the
// card's actual content. The curve loosens or tightens with matchScore: a
// stronger match pulls the line closer to straight ("tenser"), a weaker
// match lets it sag more, as a light visual metaphor for connection
// strength. No motion/animation here, so there's nothing that needs a
// prefers-reduced-motion override.
export function ConnectionLine({ matchScore }: { matchScore: number }) {
  const clampedScore = Math.min(1, Math.max(0, matchScore));
  // At score 1 the control point sits almost on the straight line between
  // the two dots; at score 0 it's pulled well above it.
  const sag = 10 * (1 - clampedScore);
  const controlY = 16 - sag;

  return (
    <svg
      width="72"
      height="24"
      viewBox="0 0 72 24"
      fill="none"
      aria-hidden="true"
      className="text-muted/50"
    >
      <path
        d={`M6 20 Q 36 ${controlY} 66 20`}
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <circle cx="6" cy="20" r="2.5" fill="currentColor" />
      <circle cx="66" cy="20" r="2.5" fill="currentColor" />
    </svg>
  );
}
