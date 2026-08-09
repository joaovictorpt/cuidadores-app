import { CareType, HireInitiator, HireStatus, Role } from "@prisma/client";

import { getSharedCareTypes } from "@/lib/care-types";
import { prisma } from "@/lib/prisma";

// Exercises Hire.careType end-to-end: real fictitious profiles created in
// the database (same pattern as scripts/test-matching.ts -- own email
// prefix, cleaned up at the end), and the exact same getSharedCareTypes +
// `.includes(careType)` check that POST /api/hires runs server-side (see
// app/api/hires/route.ts), rather than a literal authenticated HTTP round
// trip -- consistent with how the other permanent test scripts in this
// project validate lib logic directly instead of spinning up a server.
const EMAIL_PREFIX = "hire-caretype-test-";

async function seed() {
  // Caregiver A: overlaps with the family on exactly one type (CHILD) --
  // "single shared type" scenario, where the picker UI should skip
  // straight to creating the Hire.
  const caregiverSingleOverlap = await prisma.user.create({
    data: {
      email: `${EMAIL_PREFIX}cuidador-1tipo@example.com`,
      role: Role.CAREGIVER,
      caregiverProfile: {
        create: { careTypes: [CareType.CHILD, CareType.SPECIAL_NEEDS] },
      },
    },
  });

  // Caregiver B: overlaps with the family on two types (ELDERLY, CHILD) --
  // "multiple shared types" scenario, where the picker UI should expand a
  // selection before creating the Hire.
  const caregiverMultiOverlap = await prisma.user.create({
    data: {
      email: `${EMAIL_PREFIX}cuidador-2tipos@example.com`,
      role: Role.CAREGIVER,
      caregiverProfile: {
        create: { careTypes: [CareType.ELDERLY, CareType.CHILD] },
      },
    },
  });

  const family = await prisma.user.create({
    data: {
      email: `${EMAIL_PREFIX}familia@example.com`,
      role: Role.FAMILY,
      familyProfile: {
        create: { neededCareTypes: [CareType.ELDERLY, CareType.CHILD] },
      },
    },
  });

  return { caregiverSingleOverlap, caregiverMultiOverlap, family };
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
  console.log("=== Seed: família + 2 cuidadores fictícios ===\n");
  const { caregiverSingleOverlap, caregiverMultiOverlap, family } = await seed();

  const [caregiverSingleProfile, caregiverMultiProfile, familyProfile] =
    await Promise.all([
      prisma.caregiverProfile.findUniqueOrThrow({
        where: { userId: caregiverSingleOverlap.id },
      }),
      prisma.caregiverProfile.findUniqueOrThrow({
        where: { userId: caregiverMultiOverlap.id },
      }),
      prisma.familyProfile.findUniqueOrThrow({ where: { userId: family.id } }),
    ]);

  console.log("=== Cenário 1: só 1 tipo em comum ===");
  const sharedSingle = getSharedCareTypes(
    caregiverSingleProfile.careTypes,
    familyProfile.neededCareTypes
  );
  console.log(`Tipos em comum: [${sharedSingle.join(", ")}]`);
  console.log(
    `- Exatamente 1 tipo em comum (picker deveria ser pulado)? ${
      sharedSingle.length === 1 ? "SIM -- correto" : "NÃO -- ERRO"
    }`
  );

  console.log("\n=== Cenário 2: múltiplos tipos em comum ===");
  const sharedMulti = getSharedCareTypes(
    caregiverMultiProfile.careTypes,
    familyProfile.neededCareTypes
  );
  console.log(`Tipos em comum: [${sharedMulti.join(", ")}]`);
  console.log(
    `- Mais de 1 tipo em comum (picker deveria aparecer)? ${
      sharedMulti.length > 1 ? "SIM -- correto" : "NÃO -- ERRO"
    }`
  );

  console.log(
    "\n=== Cenário 3: careType fora da interseção real (mesma checagem do servidor) ==="
  );
  const invalidCareType = CareType.SPECIAL_NEEDS; // not in caregiverMultiProfile.careTypes
  const wouldBeRejected = !sharedMulti.includes(invalidCareType);
  console.log(
    `Tentando "${invalidCareType}" contra o par com tipos em comum [${sharedMulti.join(", ")}]`
  );
  console.log(
    `- A mesma checagem que POST /api/hires roda (sharedCareTypes.includes(careType)) rejeitaria isso? ${
      wouldBeRejected ? "SIM -- correto" : "NÃO -- ERRO"
    }`
  );

  console.log("\n=== Cenário 4: Hire real com careType válido persiste e é lido de volta ===");
  const hire = await prisma.hire.create({
    data: {
      familyId: family.id,
      caregiverId: caregiverSingleOverlap.id,
      initiatedBy: HireInitiator.FAMILY,
      careType: sharedSingle[0],
      status: HireStatus.PENDING,
      activeHireKey: `${family.id}:${caregiverSingleOverlap.id}`,
    },
  });
  const reloaded = await prisma.hire.findUniqueOrThrow({ where: { id: hire.id } });
  console.log(
    `- Hire criado com careType="${sharedSingle[0]}" e recarregado com o mesmo valor? ${
      reloaded.careType === sharedSingle[0] ? "SIM -- correto" : "NÃO -- ERRO"
    }`
  );

  console.log("\n=== Cenário 5: Hire antigo sem careType (simulando pré-migration) ===");
  const legacyHire = await prisma.hire.create({
    data: {
      familyId: family.id,
      caregiverId: caregiverMultiOverlap.id,
      initiatedBy: HireInitiator.FAMILY,
      status: HireStatus.PENDING,
      activeHireKey: `${family.id}:${caregiverMultiOverlap.id}`,
      // careType intentionally omitted -- defaults to null, same as any
      // Hire row created before this migration.
    },
  });
  console.log(
    `- Hire criado sem careType fica null (não quebra)? ${
      legacyHire.careType === null ? "SIM -- correto" : "NÃO -- ERRO"
    } (/dashboard/hires/[id] mostraria "Tipo não especificado")`
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
