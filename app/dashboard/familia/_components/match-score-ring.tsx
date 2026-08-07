// Circular progress ring showing a real 0-1 compatibility score as a
// percentage. Unlike ConnectionLine (purely decorative, used where no real
// score exists -- see CLAUDE.md "Sistema de design"), this component reads
// as data: it's only meant for screens backed by an actual computeMatchScore
// result (currently just /dashboard/familia/buscar).
export function MatchScoreRing({ matchScore }: { matchScore: number }) {
  const clampedScore = Math.min(1, Math.max(0, matchScore));
  const percentage = Math.round(clampedScore * 100);

  const radius = 20;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference * (1 - clampedScore);

  return (
    <svg
      width="52"
      height="52"
      viewBox="0 0 52 52"
      role="img"
      aria-label={`Compatibilidade: ${percentage}%`}
      className="shrink-0"
    >
      <circle
        cx="26"
        cy="26"
        r={radius}
        fill="none"
        stroke="currentColor"
        strokeWidth="4"
        className="text-accent-light"
      />
      <circle
        cx="26"
        cy="26"
        r={radius}
        fill="none"
        stroke="currentColor"
        strokeWidth="4"
        strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={dashOffset}
        transform="rotate(-90 26 26)"
        className="text-accent transition-[stroke-dashoffset] motion-reduce:transition-none"
      />
      <text
        x="26"
        y="26"
        textAnchor="middle"
        dominantBaseline="central"
        fill="currentColor"
        className="text-ink font-mono text-xs font-semibold"
      >
        {percentage}%
      </text>
    </svg>
  );
}
