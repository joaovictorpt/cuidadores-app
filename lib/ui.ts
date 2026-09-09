import type { WheelEvent } from "react";

// Strings de classe Tailwind compartilhadas para o sistema de design do app.
// Centralizar isso faz com que toda tela que importa daqui fique em sincronia
// quando o sistema evolui, em vez de cada página criar suas próprias cores.
// Ver CLAUDE.md "Sistema de design" para a especificação completa de
// paleta/tipografia.

const focusRing =
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary";

export const cardClass =
  "w-full max-w-md rounded-card border border-muted/20 bg-white p-8 shadow-sm";

// Card de conteúdo de propósito geral (itens de grid/lista) -- mesma
// linguagem visual do cardClass mas sem a largura máxima fixa, já que é
// feito para ficar dentro de um grid em vez de ser um card de formulário
// centralizado independente.
export const contentCardClass =
  "rounded-card border border-muted/20 bg-white p-6 shadow-sm";

export const labelClass = "mb-1 block text-sm font-medium text-muted";

export const inputClass =
  `w-full rounded-lg border border-muted/40 bg-white px-3 py-2 text-sm text-ink placeholder:text-muted/60 disabled:cursor-not-allowed disabled:opacity-60 ${focusRing}`;

export const primaryButtonClass =
  `w-full rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white transition hover:bg-primary-dark motion-reduce:transition-none disabled:cursor-not-allowed disabled:opacity-60 ${focusRing}`;

export const secondaryButtonClass =
  `rounded-lg border border-muted/40 bg-white px-3 py-1.5 text-sm font-medium text-ink transition hover:bg-primary-light motion-reduce:transition-none disabled:cursor-not-allowed disabled:opacity-60 ${focusRing}`;

// Reservado para as calls-to-action de destaque que a especificação de
// design isola (ex.: "Contratar", "Aceitar") -- não é uma variante de botão
// de propósito geral. text-white (não text-ink): sob a paleta "Editorial de
// Confiança", accent é um bordô escuro (~27% de lightness), então texto ink
// escuro em cima dele falha no contraste (~1.6:1) -- isso era text-ink sob o
// accent âmbar anterior, bem mais claro, onde texto escuro era a escolha
// correta.
export const accentButtonClass =
  `rounded-lg bg-accent px-3 py-1.5 text-sm font-medium text-white transition hover:bg-accent-dark motion-reduce:transition-none disabled:cursor-not-allowed disabled:opacity-60 ${focusRing}`;

// CTA grande de marketing (seções de hero/CTA final) -- primaryButtonClass é
// dimensionado para botões de submit de formulário, pequeno demais para as
// chamadas principais de uma landing page. Full-width no mobile, largura
// automática lado a lado em telas maiores, conforme o requisito "empilhados
// em mobile".
export const heroButtonClass =
  `inline-flex w-full items-center justify-center rounded-lg bg-primary px-8 py-4 text-base font-semibold text-white transition hover:bg-primary-dark motion-reduce:transition-none sm:w-auto sm:text-lg ${focusRing}`;

// Mesmo tamanho/forma de heroButtonClass mas contornado em vez de
// preenchido -- para o CTA secundário do hero. Reverte a decisão anterior de
// "mesmo peso visual entre família/cuidador" (ver CLAUDE.md "Identidade do
// site" / "Sistema de design" para a nota da reversão): a direção "Editorial
// de Confiança" quer uma ação primária clara por hero, não dois botões
// preenchidos competindo.
// hover:bg-ink/5 (não bg-primary-light): este botão renderiza tanto sobre o
// fundo simples da página quanto dentro da seção "CTA final" que já é
// primary-light -- um hover primary-light ficaria invisível nesse segundo
// fundo, então um tint escuro independente de fundo é usado no lugar.
export const heroOutlineButtonClass =
  `inline-flex w-full items-center justify-center rounded-lg border-2 border-ink bg-transparent px-8 py-4 text-base font-semibold text-ink transition hover:bg-ink/5 motion-reduce:transition-none sm:w-auto sm:text-lg ${focusRing}`;

// Mesmo tamanho de heroButtonClass, cor accent em vez de primary -- para a
// única ação de uma tela que deve visualmente se destacar de tudo mais
// (ex.: "Buscar cuidadores" no dashboard da família, a coisa mais importante
// que uma família pode fazer ali). `text-white` segue a mesma escolha de
// contraste de accentButtonClass para o mesmo fundo (bordô escuro).
export const heroAccentButtonClass =
  `inline-flex w-full items-center justify-center rounded-lg bg-accent px-8 py-4 text-base font-semibold text-white transition hover:bg-accent-dark motion-reduce:transition-none sm:w-auto sm:text-lg ${focusRing}`;

// Metadado secundário discreto num card (timestamps relativos, badges de
// direção) -- pequeno e muted de propósito, para nunca competir com o
// conteúdo principal do card (nome, status, preço). Não é font-mono:
// diferente de um dado numérico verificado (preço, distância, nota), uma
// frase de tempo relativo ("há 5 minutos") se lê como prosa, não como dado.
export const metaTextClass = "text-xs text-muted";

export const errorTextClass = "rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700";

export const successTextClass = "rounded-lg bg-green-50 px-3 py-2 text-sm text-green-700";

// Remove tudo que não for 0-9 -- usado no campo "Anos de experiência" para
// que usuários não possam digitar "." ou "," (um <input type="number"> ainda
// permite isso, além de "e"/"+"/"-", já que notação científica é tecnicamente
// válida ali). Isso é só UX: a validação real é o schema Zod no servidor.
export function sanitizeDigitsOnly(value: string): string {
  return value.replace(/\D/g, "");
}

// Navegadores deixam o scroll do mouse mudar silenciosamente o valor de um
// <input type="number"> focado -- um comportamento nativo separado das
// setinhas de incremento/decremento (já escondidas via CSS em
// app/globals.css), e `preventDefault()` sozinho no evento wheel não
// suprime isso de forma confiável em todos os navegadores. Tirar o foco do
// input no wheel é a correção padrão e confiável: passe isso como `onWheel`
// em todo input numérico (hourlyRate, experienceYears, etc.) em vez de
// repetir o handler inline.
export function blurOnWheel(event: WheelEvent<HTMLInputElement>): void {
  event.currentTarget.blur();
}
