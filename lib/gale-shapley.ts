/**
 * Implementação genérica do algoritmo Gale-Shapley, variante
 * hospital-residents: matching estável muitos-para-um, em que cada
 * receptor (hospital/cuidador) pode reter mais de um proponente
 * (residente/família) até uma capacidade fixa, enquanto cada proponente é
 * associado a no máximo um receptor.
 *
 * Isso é deliberadamente genérico (ids string + listas de preferência) em
 * vez de amarrado aos tipos Family/Caregiver, para poder ser testado de
 * forma isolada, sem depender do Prisma nem do resto do modelo de domínio.
 *
 * O resultado é PROPOSER-OPTIMAL: todo proponente termina com o melhor
 * receptor que poderia obter em QUALQUER matching estável, ao custo de os
 * receptores obterem o pior resultado possível dentre os matchings
 * estáveis. Essa é a garantia clássica do lado que propõe no Gale-Shapley.
 */

export type StableMatchingInput = {
  /** Ids do lado proponente (famílias). */
  proposers: string[];
  /** Ids do lado receptor (cuidadores). */
  receivers: string[];
  /** proposerId -> receiverIds, ordenados do mais para o menos preferido. */
  proposerPreferences: Map<string, string[]>;
  /** receiverId -> proposerIds, ordenados do mais para o menos preferido. */
  receiverPreferences: Map<string, string[]>;
  /** Número máximo de proponentes que um único receptor pode reter ao mesmo tempo. */
  receiverCapacity: number;
};

export function stableMatching({
  proposers,
  receivers,
  proposerPreferences,
  receiverPreferences,
  receiverCapacity,
}: StableMatchingInput): Map<string, string[]> {
  // Resultado final: receiverId -> proposerIds atualmente retidos. Todo
  // receptor começa vazio, mesmo aqueles a quem ninguém nunca propõe, para
  // que o Map retornado sempre tenha uma entrada por receptor.
  const matches = new Map<string, string[]>();
  receivers.forEach((receiverId) => matches.set(receiverId, []));

  // Cada proponente percorre sua própria lista de preferências da esquerda
  // para a direita, um passo de cada vez, nunca revisitando um receptor já
  // tentado. Esse índice é o que garante que o algoritmo termina: ele só
  // aumenta, nunca diminui.
  const nextProposalIndex = new Map<string, number>();
  proposers.forEach((proposerId) => nextProposalIndex.set(proposerId, 0));

  // Fila de proponentes que ainda precisam fazer uma proposta nesta rodada
  // -- seja porque ainda não foram associados a ninguém, seja porque
  // acabaram de ser rejeitados/substituídos e precisam tentar a próxima
  // opção.
  const freeProposers: string[] = [...proposers];

  // Pré-computa, para cada receptor, uma tabela de busca proposerId -> rank
  // a partir de sua lista de preferências (rank 0 = mais preferido). Isso
  // transforma "esse receptor prefere o proponente A ao proponente B" numa
  // comparação O(1), em vez de duas buscas indexOf() por comparação.
  const receiverRank = new Map<string, Map<string, number>>();
  for (const receiverId of receivers) {
    const prefs = receiverPreferences.get(receiverId) ?? [];
    const rankMap = new Map<string, number>();
    prefs.forEach((proposerId, index) => rankMap.set(proposerId, index));
    receiverRank.set(receiverId, rankMap);
  }

  while (freeProposers.length > 0) {
    const proposerId = freeProposers.shift()!;
    const proposerPrefs = proposerPreferences.get(proposerId) ?? [];
    const proposeIndex = nextProposalIndex.get(proposerId)!;

    // Este proponente já propôs a todos em sua lista e foi recusado por
    // todos -- ele permanece sem par. Este é um resultado normal e válido
    // do Gale-Shapley (ex.: nenhum cuidador elegível tinha vaga ou
    // interesse), não um erro.
    if (proposeIndex >= proposerPrefs.length) {
      continue;
    }

    const receiverId = proposerPrefs[proposeIndex];
    // Independentemente do que acontecer a seguir (aceito, substituído
    // depois, ou rejeitado), este proponente já "consumiu" essa opção --
    // na próxima vez que estiver livre, ele avança para a próxima entrada
    // da lista.
    nextProposalIndex.set(proposerId, proposeIndex + 1);

    const rankMap = receiverRank.get(receiverId);

    // O receptor nunca classificou este proponente, ou seja, ele é
    // inaceitável para o receptor (ex.: fora dos critérios de
    // elegibilidade da própria etapa de construção de preferências do
    // receptor). Pela convenção padrão do Gale-Shapley, um proponente não
    // classificado é auto-rejeitado -- volta direto para a fila para
    // tentar a próxima opção.
    if (!rankMap || !rankMap.has(proposerId)) {
      freeProposers.push(proposerId);
      continue;
    }

    const held = matches.get(receiverId)!;

    if (held.length < receiverCapacity) {
      // O receptor ainda tem uma vaga aberta: aceita provisoriamente. Isso
      // é sempre apenas provisório -- um proponente melhor classificado
      // chegando depois ainda pode substituir este quando o receptor
      // estiver cheio.
      held.push(proposerId);
      continue;
    }

    // O receptor já está na capacidade máxima. Encontra, entre os
    // proponentes atualmente retidos, o que este receptor gosta MENOS
    // (maior número de rank = menos preferido), já que é o único que vale
    // a pena comparar com a nova proposta.
    let worstHeldIndex = 0;
    let worstHeldRank = -1;
    held.forEach((heldProposerId, index) => {
      const rank = rankMap.get(heldProposerId) ?? Number.POSITIVE_INFINITY;
      if (rank > worstHeldRank) {
        worstHeldRank = rank;
        worstHeldIndex = index;
      }
    });

    const newProposerRank = rankMap.get(proposerId)!;

    if (newProposerRank < worstHeldRank) {
      // O receptor prefere o novo proponente ao seu pior par atual: troca
      // os dois. O proponente substituído fica livre novamente e tentará
      // sua próxima preferência numa iteração futura -- ele NÃO é
      // descartado, apenas deslocado, o que é exatamente o que mantém o
      // algoritmo convergindo para a estabilidade em vez de se acomodar
      // numa associação subótima.
      const bumpedProposerId = held[worstHeldIndex];
      held[worstHeldIndex] = proposerId;
      freeProposers.push(bumpedProposerId);
    } else {
      // O receptor já retém proponentes que gosta pelo menos tanto quanto
      // este e não tem mais vaga: rejeita esta proposta de imediato. O
      // proponente volta para a fila para tentar a próxima opção.
      freeProposers.push(proposerId);
    }
  }

  return matches;
}
