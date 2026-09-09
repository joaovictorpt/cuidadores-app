// Anel de progresso circular mostrando um score de compatibilidade real
// 0-1 como porcentagem. Diferente de ConnectionLine (puramente decorativo,
// usado onde não existe um score real -- ver CLAUDE.md "Sistema de
// design"), este componente representa dado real: só deve ser usado em
// telas respaldadas por um resultado real de computeMatchScore
// (atualmente só /dashboard/familia/buscar).
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
