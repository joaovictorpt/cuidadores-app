import { CareType, Role } from "@prisma/client";

import {
  buildCaregiverPreferences,
  buildFamilyPreferences,
  runStableMatchingForAllFamilies,
} from "@/lib/matching";
import { matchingConfig } from "@/lib/matching-config";
import { prisma } from "@/lib/prisma";

const EMAIL_PREFIX = "gale-shapley-test-";

// Todas as coordenadas seed abaixo ficam perto da Praça da Sé, São Paulo
// (-23.5505, -46.6333), próximas o bastante para que toda família esteja
// bem dentro do matchingConfig.maxDistanceKm de todo cuidador.

type CaregiverSeed = {
  label: string;
  email: string;
  latitude: number;
  longitude: number;
  careTypes: CareType[];
  hourlyRate: number;
  ratings: number[];
};

type FamilySeed = {
  label: string;
  email: string;
  latitude: number;
  longitude: number;
  neededCareTypes: CareType[];
};

// 3 cuidadores. X é deliberadamente a opção mais próxima/barata/mais bem
// avaliada para a maioria das famílias, então é a escolha natural número 1
// de todo mundo -- é isso que força as rejeições por capacidade abaixo (a
// capacidade é 3, mas mais de 3 famílias vão querer X primeiro).
const CAREGIVER_SEEDS: CaregiverSeed[] = [
  {
    label: "X (perto, barato, bem avaliado -- o mais cobiçado)",
    email: `${EMAIL_PREFIX}cuidador-x@example.com`,
    latitude: -23.555,
    longitude: -46.635,
    careTypes: [CareType.ELDERLY, CareType.CHILD],
    hourlyRate: 20,
    ratings: [5, 5, 5],
  },
  {
    label: "Y (perto, preço médio -- opção de reserva)",
    email: `${EMAIL_PREFIX}cuidador-y@example.com`,
    latitude: -23.56,
    longitude: -46.64,
    careTypes: [CareType.ELDERLY, CareType.CHILD],
    hourlyRate: 35,
    ratings: [4, 3],
  },
  {
    label: "Z (mais longe, só cobre CHILD, sem reviews)",
    email: `${EMAIL_PREFIX}cuidador-z@example.com`,
    latitude: -23.65,
    longitude: -46.72,
    careTypes: [CareType.CHILD],
    hourlyRate: 15,
    ratings: [],
  },
];

// 4 famílias, todas perto de X, todas precisando de algo que X cobre --
// então espera-se que todas as 4 classifiquem X em primeiro lugar. Com
// caregiverCapacity=3, pelo menos uma delas PRECISA ser rejeitada por X e
// cair para sua próxima escolha. Esse é o cenário "não trivial" que o
// algoritmo precisa resolver.
const FAMILY_SEEDS: FamilySeed[] = [
  {
    label: "Familia 1 (bem perto de X)",
    email: `${EMAIL_PREFIX}familia-1@example.com`,
    latitude: -23.556,
    longitude: -46.636,
    neededCareTypes: [CareType.ELDERLY, CareType.CHILD],
  },
  {
    label: "Familia 2 (perto de X)",
    email: `${EMAIL_PREFIX}familia-2@example.com`,
    latitude: -23.557,
    longitude: -46.637,
    neededCareTypes: [CareType.ELDERLY, CareType.CHILD],
  },
  {
    label: "Familia 3 (perto de X, só precisa ELDERLY)",
    email: `${EMAIL_PREFIX}familia-3@example.com`,
    latitude: -23.558,
    longitude: -46.634,
    neededCareTypes: [CareType.ELDERLY],
  },
  {
    label: "Familia 4 (a mais longe de X entre as 4, só precisa CHILD)",
    email: `${EMAIL_PREFIX}familia-4@example.com`,
    latitude: -23.559,
    longitude: -46.638,
    neededCareTypes: [CareType.CHILD],
  },
];

async function seed() {
  const familyUserIdByLabel = new Map<string, string>();
  const caregiverUserIdByLabel = new Map<string, string>();

  for (const seed of FAMILY_SEEDS) {
    const user = await prisma.user.create({
      data: {
        email: seed.email,
        role: Role.FAMILY,
        familyProfile: {
          create: {
            city: "São Paulo",
            state: "SP",
            latitude: seed.latitude,
            longitude: seed.longitude,
            neededCareTypes: seed.neededCareTypes,
          },
        },
      },
    });
    familyUserIdByLabel.set(seed.label, user.id);
  }

  // As reviews só precisam de ALGUMA família válida como autora para
  // satisfazer a integridade referencial do schema Hire/Review -- qual
  // família as escreveu não tem nenhum efeito no cálculo do matching, já
  // que as avaliações são agregadas por cuidador independente de quem as
  // escreveu.
  const reviewAuthorFamilyId = familyUserIdByLabel.values().next().value as string;

  for (const seed of CAREGIVER_SEEDS) {
    const user = await prisma.user.create({
      data: {
        email: seed.email,
        role: Role.CAREGIVER,
        caregiverProfile: {
          create: {
            latitude: seed.latitude,
            longitude: seed.longitude,
            careTypes: seed.careTypes,
            hourlyRate: seed.hourlyRate,
          },
        },
      },
    });
    caregiverUserIdByLabel.set(seed.label, user.id);

    for (const rating of seed.ratings) {
      const hire = await prisma.hire.create({
        data: {
          familyId: reviewAuthorFamilyId,
          caregiverId: user.id,
          status: "COMPLETED",
        },
      });

      await prisma.review.create({
        data: {
          hireId: hire.id,
          authorId: reviewAuthorFamilyId,
          targetId: user.id,
          rating,
        },
      });
    }
  }

  return { familyUserIdByLabel, caregiverUserIdByLabel };
}

async function cleanup() {
  await prisma.hire.deleteMany({
    where: {
      OR: [
        { family: { email: { startsWith: EMAIL_PREFIX } } },
        { caregiver: { email: { startsWith: EMAIL_PREFIX } } },
      ],
    },
  });

  const deleted = await prisma.user.deleteMany({
    where: { email: { startsWith: EMAIL_PREFIX } },
  });

  return deleted.count;
}

/**
 * Checagem programática de estabilidade para um matching many-to-one
 * (hospital-residents). Um matching tem um "par bloqueante" (proponente P,
 * receptor R) se:
 *   - P prefere R ao seu match atual (ou P não tem match e R está na lista
 *     de preferências de P), E
 *   - R considera P aceitável (P está na lista de preferências de R), E
 *   - R tem uma vaga livre, OU R prefere P ao pior proponente que já detém.
 * Se nenhum par bloqueante existir, o matching é estável por definição.
 * Isso re-deriva a estabilidade diretamente das listas de preferência em
 * vez de simplesmente confiar no bookkeeping interno do próprio algoritmo,
 * então é uma checagem independente.
 */
function findBlockingPairs(
  proposers: string[],
  receivers: string[],
  proposerPreferences: Map<string, string[]>,
  receiverPreferences: Map<string, string[]>,
  matches: Map<string, string[]>,
  receiverCapacity: number
): Array<{ proposerId: string; receiverId: string }> {
  const receiverOfProposer = new Map<string, string>();
  for (const [receiverId, proposerIds] of matches) {
    for (const proposerId of proposerIds) {
      receiverOfProposer.set(proposerId, receiverId);
    }
  }

  const blockingPairs: Array<{ proposerId: string; receiverId: string }> = [];

  for (const proposerId of proposers) {
    const proposerPrefs = proposerPreferences.get(proposerId) ?? [];
    const currentReceiverId = receiverOfProposer.get(proposerId) ?? null;
    const currentRank = currentReceiverId
      ? proposerPrefs.indexOf(currentReceiverId)
      : Number.POSITIVE_INFINITY;

    for (const receiverId of receivers) {
      if (receiverId === currentReceiverId) continue;

      const receiverRankForProposer = proposerPrefs.indexOf(receiverId);
      if (receiverRankForProposer === -1) continue; // não está na lista do proponente
      if (receiverRankForProposer >= currentRank) continue; // não é uma melhora

      const receiverPrefs = receiverPreferences.get(receiverId) ?? [];
      const proposerRankForReceiver = receiverPrefs.indexOf(proposerId);
      if (proposerRankForReceiver === -1) continue; // receptor considera o proponente inaceitável

      const held = matches.get(receiverId) ?? [];

      if (held.length < receiverCapacity) {
        blockingPairs.push({ proposerId, receiverId });
        continue;
      }

      const worstHeldRank = Math.max(
        ...held.map((heldId) => receiverPrefs.indexOf(heldId))
      );

      if (proposerRankForReceiver < worstHeldRank) {
        blockingPairs.push({ proposerId, receiverId });
      }
    }
  }

  return blockingPairs;
}

async function main() {
  console.log("=== Seed: criando 4 famílias + 3 cuidadores fictícios ===\n");
  const { familyUserIdByLabel, caregiverUserIdByLabel } = await seed();
  console.log(
    `Capacidade por cuidador (matchingConfig.caregiverCapacity): ${matchingConfig.caregiverCapacity}\n`
  );

  // Rebusca as listas de preferência do mesmo jeito que
  // runStableMatchingForAllFamilies faz internamente, unicamente para que
  // possamos imprimi-las e alimentá-las no verificador de estabilidade
  // independente abaixo (o verificador não deve simplesmente confiar no
  // estado interno do próprio algoritmo).
  const familyProfiles = await prisma.familyProfile.findMany({
    where: { userId: { in: Array.from(familyUserIdByLabel.values()) } },
  });
  const caregiverProfiles = await prisma.caregiverProfile.findMany({
    where: { userId: { in: Array.from(caregiverUserIdByLabel.values()) } },
    include: {
      user: { select: { name: true, reviewsReceived: { select: { rating: true } } } },
    },
  });

  const families = familyProfiles.map((p) => ({
    userId: p.userId,
    latitude: p.latitude,
    longitude: p.longitude,
    neededCareTypes: p.neededCareTypes,
    hourlyBudget: p.hourlyBudget ? Number(p.hourlyBudget) : null,
    visibleToCaregivers: p.visibleToCaregivers,
  }));
  const caregivers = caregiverProfiles.map((p) => {
    const ratings = p.user.reviewsReceived.map((r) => r.rating);
    return {
      id: p.id,
      userId: p.userId,
      name: p.user.name,
      bio: p.bio,
      hourlyRate: p.hourlyRate ? Number(p.hourlyRate) : null,
      careTypes: p.careTypes,
      latitude: p.latitude,
      longitude: p.longitude,
      averageRating:
        ratings.length > 0
          ? ratings.reduce((sum, r) => sum + r, 0) / ratings.length
          : null,
      reviewCount: ratings.length,
      visibleToFamilies: p.visibleToFamilies,
      availabilityStatus: p.availabilityStatus,
    };
  });

  const proposerPreferences = buildFamilyPreferences(families, caregivers);
  const receiverPreferences = buildCaregiverPreferences(caregivers, families);

  const labelByUserId = new Map<string, string>();
  familyUserIdByLabel.forEach((id, label) => labelByUserId.set(id, label));
  caregiverUserIdByLabel.forEach((id, label) => labelByUserId.set(id, label));

  console.log("=== Preferências das famílias (ordem de preferência) ===");
  for (const [familyId, prefs] of proposerPreferences) {
    console.log(
      `${labelByUserId.get(familyId)}: ${prefs.map((id) => labelByUserId.get(id)).join(" > ")}`
    );
  }

  console.log("\n=== Preferências dos cuidadores (ordem de preferência) ===");
  for (const [caregiverId, prefs] of receiverPreferences) {
    console.log(
      `${labelByUserId.get(caregiverId)}: ${prefs.map((id) => labelByUserId.get(id)).join(" > ") || "(nenhuma família elegível)"}`
    );
  }

  console.log("\n=== runStableMatchingForAllFamilies ===\n");
  const result = await runStableMatchingForAllFamilies();

  // O resultado real cobre toda família/cuidador do banco; filtra para
  // ficar só com os nossos fictícios, caso exista outro dado no banco.
  const ourCaregiverIds = new Set(caregiverUserIdByLabel.values());
  const ourFamilyIds = new Set(familyUserIdByLabel.values());

  const scopedResult = new Map<string, string[]>();
  for (const [caregiverId, familyIds] of result) {
    if (!ourCaregiverIds.has(caregiverId)) continue;
    scopedResult.set(
      caregiverId,
      familyIds.filter((id) => ourFamilyIds.has(id))
    );
  }

  for (const [caregiverId, familyIds] of scopedResult) {
    const familyLabels = familyIds.map((id) => labelByUserId.get(id));
    console.log(
      `${labelByUserId.get(caregiverId)} <- [${familyLabels.join(", ") || "ninguém"}]`
    );
  }

  const unmatchedFamilies = families
    .map((f) => f.userId)
    .filter(
      (familyId) =>
        !Array.from(scopedResult.values()).some((ids) => ids.includes(familyId))
    );
  console.log(
    `\nFamílias não casadas nesta rodada: ${
      unmatchedFamilies.map((id) => labelByUserId.get(id)).join(", ") || "nenhuma"
    }`
  );

  console.log("\n=== Verificações ===");

  const capacityOk = Array.from(scopedResult.values()).every(
    (familyIds) => familyIds.length <= matchingConfig.caregiverCapacity
  );
  console.log(
    `- Nenhum cuidador recebeu mais famílias que a capacidade (${matchingConfig.caregiverCapacity})? ` +
      (capacityOk ? "SIM -- correto" : "NÃO -- ERRO")
  );

  const blockingPairs = findBlockingPairs(
    Array.from(familyUserIdByLabel.values()),
    Array.from(caregiverUserIdByLabel.values()),
    proposerPreferences,
    receiverPreferences,
    scopedResult,
    matchingConfig.caregiverCapacity
  );

  if (blockingPairs.length === 0) {
    console.log(
      "- O resultado é estável (nenhum par fora do matching prefere mutuamente um ao outro mais do que quem já tem)? SIM -- correto"
    );
  } else {
    console.log("- O resultado é estável? NÃO -- ERRO. Pares instáveis encontrados:");
    for (const pair of blockingPairs) {
      console.log(
        `    ${labelByUserId.get(pair.proposerId)} <-> ${labelByUserId.get(pair.receiverId)}`
      );
    }
  }

  console.log("\n=== Cleanup ===");
  const deletedCount = await cleanup();
  console.log(`Usuários fictícios removidos: ${deletedCount}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
