import { CareType, HireStatus, Role } from "@prisma/client";

import { computePriceScore, rankCaregiversForFamily } from "@/lib/matching";
import { matchingConfig } from "@/lib/matching-config";
import { prisma } from "@/lib/prisma";

const EMAIL_PREFIX = "matching-test-";

type CaregiverSeed = {
  label: string;
  email: string;
  latitude: number;
  longitude: number;
  careTypes: CareType[];
  hourlyRate: number;
  ratings: number[];
};

// Reference point: Praça da Sé, São Paulo
const FAMILY_LAT = -23.5505;
const FAMILY_LON = -46.6333;

const CAREGIVER_SEEDS: CaregiverSeed[] = [
  {
    label: "A (perto, barato, cobre os 2 tipos, bem avaliado)",
    email: `${EMAIL_PREFIX}cuidador-a@example.com`,
    latitude: -23.5605,
    longitude: -46.6433,
    careTypes: [CareType.ELDERLY, CareType.CHILD],
    hourlyRate: 25,
    ratings: [5, 5, 4],
  },
  {
    label: "B (distância média, cobre só 1 tipo, SEM reviews)",
    email: `${EMAIL_PREFIX}cuidador-b@example.com`,
    latitude: -23.62,
    longitude: -46.69,
    careTypes: [CareType.ELDERLY],
    hourlyRate: 40,
    ratings: [],
  },
  {
    label: "C (perto, cobre os 3 tipos, caro, avaliação mediana)",
    email: `${EMAIL_PREFIX}cuidador-c@example.com`,
    latitude: -23.555,
    longitude: -46.635,
    careTypes: [CareType.ELDERLY, CareType.CHILD, CareType.SPECIAL_NEEDS],
    hourlyRate: 60,
    ratings: [3, 2],
  },
  {
    label: "D (FORA do raio máximo -- não deve aparecer no resultado)",
    email: `${EMAIL_PREFIX}cuidador-d@example.com`,
    latitude: -22.9068,
    longitude: -43.1729,
    careTypes: [CareType.ELDERLY, CareType.CHILD],
    hourlyRate: 20,
    ratings: [5],
  },
];

// Pure, no DB involved -- exercises all three computePriceScore fallback
// layers directly (see lib/matching.ts for the layer order/reasoning),
// independent of the weighted composite matchScore.
function testComputePriceScore() {
  console.log("=== computePriceScore (função pura, sem banco) ===\n");

  const checks: { label: string; actual: number; expected: number }[] = [
    { label: "Camada 1 (budget) -- rate igual ao budget", actual: computePriceScore(30, 30), expected: 1 },
    { label: "Camada 1 (budget) -- rate abaixo do budget", actual: computePriceScore(20, 30), expected: 1 },
    { label: "Camada 1 (budget) -- rate 50% acima do budget", actual: computePriceScore(45, 30), expected: 0.5 },
    { label: "Camada 1 (budget) -- rate 2x o budget (piso em 0)", actual: computePriceScore(60, 30), expected: 0 },
    { label: "Camada 1 (budget) -- rate muito acima, nunca negativo", actual: computePriceScore(120, 30), expected: 0 },
    { label: "Camada 2 (fallback) -- sem budget, rate = mínimo do pool", actual: computePriceScore(10, null, [10, 20, 30]), expected: 1 },
    { label: "Camada 2 (fallback) -- sem budget, rate = máximo do pool", actual: computePriceScore(30, null, [10, 20, 30]), expected: 0 },
    { label: "Camada 2 (fallback) -- sem budget, rate no meio do pool", actual: computePriceScore(20, null, [10, 20, 30]), expected: 0.5 },
    { label: "Camada 3 (neutro) -- sem budget, sem pool", actual: computePriceScore(20, null), expected: matchingConfig.defaultRatingWhenNoReviews },
    { label: "caregiverRate null -- neutro independente do resto", actual: computePriceScore(null, 30, [10, 20]), expected: matchingConfig.defaultRatingWhenNoReviews },
  ];

  let allPassed = true;
  for (const check of checks) {
    const pass = Math.abs(check.actual - check.expected) < 1e-9;
    allPassed &&= pass;
    console.log(
      `- ${check.label}: esperado=${check.expected}, obtido=${check.actual.toFixed(4)} -> ${pass ? "OK" : "ERRO"}`
    );
  }
  console.log(`\n${allPassed ? "Todas as checagens passaram." : "PELO MENOS UMA CHECAGEM FALHOU."}\n`);
}

// End-to-end scenario for the budget path (Camada 1), run through the real
// rankCaregiversForFamily pipeline rather than computePriceScore in
// isolation -- proves FamilyProfile.hourlyBudget actually flows from
// Prisma through FamilyForMatching/computeMatchScore. Both caregivers sit
// at the identical coordinates/careTypes/ratings as the family, so
// distance/careType/rating score identically -- only their hourlyRate
// (and therefore price score) differs, isolating the budget comparison's
// effect on the final weighted matchScore.
async function seedBudgetScenario() {
  const familyUser = await prisma.user.create({
    data: {
      email: `${EMAIL_PREFIX}familia-orcamento@example.com`,
      role: Role.FAMILY,
      familyProfile: {
        create: {
          city: "São Paulo",
          state: "SP",
          latitude: FAMILY_LAT,
          longitude: FAMILY_LON,
          neededCareTypes: [CareType.ELDERLY],
          hourlyBudget: 30,
        },
      },
    },
    include: { familyProfile: true },
  });

  if (!familyUser.familyProfile) {
    throw new Error("Family profile was not created");
  }

  const withinBudget = await prisma.user.create({
    data: {
      email: `${EMAIL_PREFIX}cuidador-dentro-orcamento@example.com`,
      role: Role.CAREGIVER,
      caregiverProfile: {
        create: {
          latitude: FAMILY_LAT,
          longitude: FAMILY_LON,
          careTypes: [CareType.ELDERLY],
          hourlyRate: 25,
        },
      },
    },
  });

  const overBudget = await prisma.user.create({
    data: {
      email: `${EMAIL_PREFIX}cuidador-fora-orcamento@example.com`,
      role: Role.CAREGIVER,
      caregiverProfile: {
        create: {
          latitude: FAMILY_LAT,
          longitude: FAMILY_LON,
          careTypes: [CareType.ELDERLY],
          hourlyRate: 90,
        },
      },
    },
  });

  return {
    familyProfile: familyUser.familyProfile,
    withinBudgetId: withinBudget.id,
    overBudgetId: overBudget.id,
  };
}

async function seed() {
  const familyUser = await prisma.user.create({
    data: {
      email: `${EMAIL_PREFIX}familia@example.com`,
      role: Role.FAMILY,
      familyProfile: {
        create: {
          city: "São Paulo",
          state: "SP",
          latitude: FAMILY_LAT,
          longitude: FAMILY_LON,
          neededCareTypes: [CareType.ELDERLY, CareType.CHILD],
        },
      },
    },
    include: { familyProfile: true },
  });

  if (!familyUser.familyProfile) {
    throw new Error("Family profile was not created");
  }

  const caregiverUserIdByLabel = new Map<string, string>();

  for (const seed of CAREGIVER_SEEDS) {
    const caregiverUser = await prisma.user.create({
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

    caregiverUserIdByLabel.set(seed.label, caregiverUser.id);

    for (const rating of seed.ratings) {
      const hire = await prisma.hire.create({
        data: {
          familyId: familyUser.id,
          caregiverId: caregiverUser.id,
          status: HireStatus.COMPLETED,
        },
      });

      await prisma.review.create({
        data: {
          hireId: hire.id,
          authorId: familyUser.id,
          targetId: caregiverUser.id,
          rating,
        },
      });
    }
  }

  return { familyProfile: familyUser.familyProfile, caregiverUserIdByLabel };
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

async function main() {
  testComputePriceScore();

  console.log("=== Seed: criando família com orçamento + 2 cuidadores ===\n");
  const budgetScenario = await seedBudgetScenario();
  const budgetRanked = await rankCaregiversForFamily(budgetScenario.familyProfile);

  console.log(
    `Família com hourlyBudget=R$${budgetScenario.familyProfile.hourlyBudget} -- ` +
      `${budgetRanked.length} cuidadores elegíveis (mesma distância/careType/rating, só o hourlyRate difere):`
  );
  budgetRanked.forEach((entry) => {
    console.log(
      `  ${entry.caregiver.userId === budgetScenario.withinBudgetId ? "[dentro do orçamento]" : "[fora do orçamento]"} ` +
        `hourlyRate=R$${entry.caregiver.hourlyRate}  score=${entry.matchScore.toFixed(4)}`
    );
  });

  const withinEntry = budgetRanked.find(
    (entry) => entry.caregiver.userId === budgetScenario.withinBudgetId
  );
  const overEntry = budgetRanked.find(
    (entry) => entry.caregiver.userId === budgetScenario.overBudgetId
  );
  const budgetPathWorks =
    withinEntry !== undefined &&
    overEntry !== undefined &&
    withinEntry.matchScore > overEntry.matchScore;
  console.log(
    "- Cuidador dentro do orçamento pontuou mais que o cuidador muito acima dele? " +
      (budgetPathWorks ? "SIM -- correto" : "NÃO -- ERRO") +
      "\n"
  );

  // Cleaned up here, before the second scenario's seed() call below --
  // both scenarios reuse the same FAMILY_LAT/FAMILY_LON (and an
  // overlapping ELDERLY careType), so if this scenario's caregivers were
  // left in place they'd leak into the second scenario's candidate pool
  // as spurious extra matches (caught by an earlier run of this script:
  // "5 de 4 cuidadores criados").
  await cleanup();

  console.log("=== Seed: criando família + cuidadores fictícios ===\n");
  const { familyProfile, caregiverUserIdByLabel } = await seed();
  console.log(
    `Família criada em (${FAMILY_LAT}, ${FAMILY_LON}), procurando: ${familyProfile.neededCareTypes.join(", ")}`
  );
  console.log(`${CAREGIVER_SEEDS.length} cuidadores fictícios criados.\n`);

  console.log("=== rankCaregiversForFamily ===\n");
  const ranked = await rankCaregiversForFamily(familyProfile);

  console.log(
    `Candidatos elegíveis no resultado: ${ranked.length} de ${CAREGIVER_SEEDS.length} cuidadores criados\n`
  );

  ranked.forEach((entry, index) => {
    const rating =
      entry.caregiver.averageRating !== null
        ? entry.caregiver.averageRating.toFixed(2)
        : `sem reviews -> default ${matchingConfig.defaultRatingWhenNoReviews}`;

    console.log(
      `${index + 1}. score=${entry.matchScore.toFixed(4)}  ` +
        `distancia=${entry.distanceKm.toFixed(2)}km  ` +
        `careTypes=[${entry.caregiver.careTypes.join(", ")}]  ` +
        `hourlyRate=R$${entry.caregiver.hourlyRate ?? "N/A"}  ` +
        `rating=${rating}`
    );
  });

  console.log("\n=== Verificações ===");

  const caregiverDId = caregiverUserIdByLabel.get(
    "D (FORA do raio máximo -- não deve aparecer no resultado)"
  );
  const dAppeared = ranked.some((entry) => entry.caregiver.userId === caregiverDId);
  console.log(
    `- Cuidador D (fora do raio de ${matchingConfig.maxDistanceKm}km) foi excluído do resultado? ` +
      (dAppeared ? "NÃO -- ERRO" : "SIM -- correto")
  );

  const caregiverBId = caregiverUserIdByLabel.get(
    "B (distância média, cobre só 1 tipo, SEM reviews)"
  );
  const bEntry = ranked.find((entry) => entry.caregiver.userId === caregiverBId);
  const bUsedDefaultRating =
    bEntry !== undefined && bEntry.caregiver.averageRating === null;
  console.log(
    "- Cuidador B (sem reviews) recebeu rating neutro sem quebrar o cálculo? " +
      (bUsedDefaultRating ? "SIM -- correto" : "NÃO -- ERRO")
  );

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
