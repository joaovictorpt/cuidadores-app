import { CareType, Role } from "@prisma/client";

import {
  buildCaregiverPreferences,
  buildFamilyPreferences,
  runStableMatchingForAllFamilies,
} from "@/lib/matching";
import { matchingConfig } from "@/lib/matching-config";
import { prisma } from "@/lib/prisma";

const EMAIL_PREFIX = "gale-shapley-test-";

// All seed coordinates below are near Praça da Sé, São Paulo
// (-23.5505, -46.6333), close enough together that every family is well
// within matchingConfig.maxDistanceKm of every caregiver.

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

// 3 caregivers. X is deliberately the closest/cheapest/best-rated option
// for most families, so it's everyone's natural top pick -- that's what
// forces the capacity-driven rejections below (capacity is 3, but more
// than 3 families will want X first).
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

// 4 families, all close to X, all needing something X covers -- so all 4
// are expected to rank X first. With caregiverCapacity=3, at least one of
// them MUST be rejected by X and fall back to their next choice. That's
// the "não trivial" scenario the algorithm needs to resolve.
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

  // Reviews just need SOME valid family as the author to satisfy the
  // Hire/Review schema's referential integrity -- which family authored
  // them has no bearing on the matching computation, since ratings are
  // aggregated per caregiver regardless of who wrote them.
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
 * Programmatic stability check for a many-to-one (hospital-residents)
 * matching. A matching has a "blocking pair" (proposer P, receiver R) if:
 *   - P prefers R over its current match (or P is unmatched and R is on
 *     P's preference list), AND
 *   - R finds P acceptable (P is on R's preference list), AND
 *   - R has a free slot, OR R prefers P over the worst proposer it
 *     currently holds.
 * If no blocking pair exists, the matching is stable by definition. This
 * re-derives stability directly from the preference lists rather than just
 * trusting the algorithm's own bookkeeping, so it's an independent check.
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
      if (receiverRankForProposer === -1) continue; // not on proposer's list
      if (receiverRankForProposer >= currentRank) continue; // not an improvement

      const receiverPrefs = receiverPreferences.get(receiverId) ?? [];
      const proposerRankForReceiver = receiverPrefs.indexOf(proposerId);
      if (proposerRankForReceiver === -1) continue; // receiver finds proposer unacceptable

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

  // Re-fetch preference lists the same way runStableMatchingForAllFamilies
  // does internally, purely so we can print them and feed them into the
  // independent stability checker below (the checker must not just trust
  // the algorithm's own internal state).
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

  // The real result covers every family/caregiver in the DB; filter down
  // to just our fictitious ones in case other data exists.
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
