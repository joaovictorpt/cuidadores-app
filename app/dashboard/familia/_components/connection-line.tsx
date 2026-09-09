// Elemento de assinatura da marca: uma linha curva simples ligando dois
// pontos, representando família <-> cuidador. Puramente decorativo
// (aria-hidden) e deliberadamente discreto -- deve parecer um pequeno
// detalhe, não competir com o conteúdo real do card. A curva afrouxa ou
// aperta conforme o matchScore: um match mais forte puxa a linha pra mais
// perto de uma reta ("mais tensa"), um match mais fraco deixa ela "cair"
// mais, como uma metáfora visual leve de força de conexão. Sem
// movimento/animação aqui, então não há nada que precise de um override de
// prefers-reduced-motion.
export function ConnectionLine({ matchScore }: { matchScore: number }) {
  const clampedScore = Math.min(1, Math.max(0, matchScore));
  // No score 1 o ponto de controle fica quase na linha reta entre os dois
  // pontos; no score 0 ele é puxado bem acima dela.
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
