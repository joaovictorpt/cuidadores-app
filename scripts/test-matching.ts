import { CareType, HireStatus, Role } from "@prisma/client";

import { rankCaregiversForFamily } from "@/lib/matching";
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
