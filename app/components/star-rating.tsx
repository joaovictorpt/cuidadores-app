"use client";

import { Star } from "lucide-react";
import { useRef, useState, type KeyboardEvent } from "react";

const STAR_VALUES = [1, 2, 3, 4, 5];

// União discriminada para que o compilador force o pareamento: uso
// interativo precisa passar `onChange`, uso somente-leitura (ex.: exibindo
// uma review antiga de outra pessoa) não pode -- não há nada para commitar
// uma mudança.
type StarRatingProps =
  | { value: number; onChange: (value: number) => void; label?: string; readOnly?: false }
  | { value: number; onChange?: undefined; label?: string; readOnly: true };

// Leitura estática e não interativa -- role="img" (não role="radiogroup"
// com radios desabilitados), já que isso diria a um leitor de tela que há
// um input aqui para operar, o que não é o caso.
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

// Input de avaliação de 5 estrelas acessível, seguindo o padrão ARIA "radio
// group" (https://www.w3.org/WAI/ARIA/apg/patterns/radio/): cada estrela é
// um <button role="radio">, as setas movem o foco E selecionam (roving
// tabindex -- só a estrela marcada é alcançável por Tab), e Enter/Espaço
// selecionam a estrela focada de graça, já que esse é o comportamento
// nativo de um <button>. O hover só *pré-visualiza* o preenchimento até a
// estrela apontada (via `hoverValue` local) sem chamar `onChange` -- o
// `value` commitado (de um clique ou seta) é o que persiste quando o
// ponteiro sai, o mesmo modelo mental da coloração de ícone via
// fill="currentColor" + `stroke`/`fill` já usado por
// ConnectionLine/MatchScoreRing em outros lugares do app.
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

// Decide com base em `readOnly` -- deliberadamente NÃO um único componente
// que ramifica internamente com um early return sem hooks, já que os
// useState/useRef de InteractiveStarRating seriam então chamados
// condicionalmente (uma violação das Rules of Hooks). Cada ramo é seu
// próprio componente em vez disso, então qualquer um que renderize sempre
// chama seus próprios hooks incondicionalmente.
export function StarRating(props: StarRatingProps) {
  if (props.readOnly) {
    return <ReadOnlyStarRating value={props.value} label={props.label} />;
  }

  return (
    <InteractiveStarRating value={props.value} onChange={props.onChange} label={props.label} />
  );
}
