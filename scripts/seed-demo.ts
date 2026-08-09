import { CareType, CaregiverAvailability, HireStatus, Role } from "@prisma/client";
import bcrypt from "bcryptjs";

import { buildGeocodeQuery, geocodeAddress, GeocodeResult } from "@/lib/geocoding";
import { prisma } from "@/lib/prisma";

// Rough bounding box for the state of Goiás. All demo people live in the
// Goiânia metro area, so any geocoding result landing outside this box is
// necessarily a Nominatim disambiguation mistake (e.g. matching a
// same-named neighborhood in a different state), not a real result -- this
// is a sanity check specific to this demo dataset, not a general-purpose
// concern of lib/geocoding.ts.
const GOIAS_BOUNDS = {
  minLatitude: -19.5,
  maxLatitude: -12.5,
  minLongitude: -53.5,
  maxLongitude: -45.9,
};

function isWithinGoiasBounds(result: GeocodeResult): boolean {
  return (
    result.latitude >= GOIAS_BOUNDS.minLatitude &&
    result.latitude <= GOIAS_BOUNDS.maxLatitude &&
    result.longitude >= GOIAS_BOUNDS.minLongitude &&
    result.longitude <= GOIAS_BOUNDS.maxLongitude
  );
}

// Tries each query in order (most specific first) and returns the first
// result that both geocodes successfully AND passes the Goiás bounding-box
// check. Smaller cities like Trindade/Aparecida de Goiânia aren't as densely
// mapped in OSM as Goiânia itself, so an overly specific fictitious street +
// house number sometimes yields no match at all -- falling back to a
// broader (but still Goiás-qualified) query trades away some precision
// rather than leaving the profile with no coordinates at all.
async function geocodeWithSanityCheck(
  queries: string[],
  label: string
): Promise<GeocodeResult | null> {
  for (let attempt = 0; attempt < queries.length; attempt++) {
    const query = queries[attempt];
    const result = await geocodeAddress(query);

    if (!result) {
      console.log(
        `  Geocodificando ${label} (tentativa ${attempt + 1}/${queries.length}, "${query}")... sem resultado`
      );
      continue;
    }

    if (!isWithinGoiasBounds(result)) {
      console.log(
        `  Geocodificando ${label} (tentativa ${attempt + 1}/${queries.length}, "${query}")... ` +
          `FALHA DE SANIDADE: coordenada (${result.latitude.toFixed(5)}, ${result.longitude.toFixed(5)}) ` +
          `cai fora de Goiás -- descartando.`
      );
      continue;
    }

    console.log(
      `  Geocodificando ${label}... OK (${result.latitude.toFixed(5)}, ${result.longitude.toFixed(5)})` +
        (attempt > 0 ? " [endereço específico falhou, usando fallback menos preciso]" : "")
    );
    return result;
  }

  console.log(
    `  Geocodificando ${label}... falhou em todas as ${queries.length} tentativas -- ` +
      `latitude/longitude ficarão null. Corrija o endereço manualmente se necessário.`
  );
  return null;
}

// All demo accounts share this domain so cleanup() can find (and remove) them
// by a single, unambiguous filter -- never delete real user data by accident.
const EMAIL_DOMAIN = "@demo.trevo.app";
const DEMO_PASSWORD = "Demo@2026";
const BCRYPT_SALT_ROUNDS = 12;

type CaregiverSeed = {
  email: string;
  name: string;
  phone: string;
  // street/neighborhood exist only to build a specific geocoding query --
  // CaregiverProfile has no address column, so these are never persisted,
  // only city/state are.
  street: string;
  neighborhood: string;
  city: string;
  state: string;
  bio: string;
  careTypes: CareType[];
  hourlyRate: number;
  experienceYears: number;
  availabilityStatus: CaregiverAvailability;
  // Optional, defaults to true (visible) when omitted -- only one seed
  // caregiver sets this to false, to demonstrate the control actually
  // hides them from family search/matching (see CLAUDE.md "Dados de
  // demonstração").
  visibleToFamilies?: boolean;
};

type FamilySeed = {
  email: string;
  name: string;
  phone: string;
  address: string;
  city: string;
  state: string;
  bio: string;
  neededCareTypes: CareType[];
  // Optional, left undefined on one family on purpose -- exercises
  // computePriceScore's neutral/relative fallback layers (no budget
  // declared). See CLAUDE.md "Dados de demonstração".
  hourlyBudget?: number;
  // Optional, defaults to true (visible) when omitted -- only one seed
  // family sets this to false, to demonstrate the control actually hides
  // them from caregiver search/matching.
  visibleToCaregivers?: boolean;
};

// Real streets/neighborhoods in Goiânia and its metropolitan region, each
// paired with a fictitious (but plausible) house number. Specific enough
// that Nominatim doesn't have to guess between two different people who
// happen to live in the same city, and that it doesn't confuse "Centro" or
// "Setor X" with a same-named neighborhood in another state -- the queries
// built in seedCaregivers/seedFamilies below also append "Goiás, Brasil"
// explicitly for the same reason.
const CAREGIVER_SEEDS: CaregiverSeed[] = [
  {
    email: `cuidador1${EMAIL_DOMAIN}`,
    name: "Ana Paula Ferreira",
    phone: "(62) 99111-2233",
    street: "Rua T-63, 1200",
    neighborhood: "Setor Bueno",
    city: "Goiânia",
    state: "GO",
    bio: "Cuidadora de idosos há 8 anos, especializada em mobilidade reduzida e acompanhamento de medicação.",
    careTypes: [CareType.ELDERLY],
    hourlyRate: 25,
    experienceYears: 8,
    availabilityStatus: CaregiverAvailability.AVAILABLE,
  },
  {
    email: `cuidador2${EMAIL_DOMAIN}`,
    name: "Bruno Costa Lima",
    phone: "(62) 99222-3344",
    street: "Avenida Independência, 850",
    neighborhood: "Jardim Tiradentes",
    city: "Aparecida de Goiânia",
    state: "GO",
    bio: "Cuidador infantil, atendo crianças de 0 a 10 anos com apoio em rotina diária e tarefas escolares.",
    careTypes: [CareType.CHILD],
    hourlyRate: 20,
    experienceYears: 1,
    availabilityStatus: CaregiverAvailability.BUSY,
  },
  {
    email: `cuidador3${EMAIL_DOMAIN}`,
    name: "Camila Rodrigues Santos",
    phone: "(62) 99333-4455",
    street: "Avenida Universitária, 400",
    neighborhood: "Vila Brasil",
    city: "Trindade",
    state: "GO",
    bio: "Atendo idosos e crianças, com experiência em cuidados domiciliares e noções de primeiros socorros.",
    careTypes: [CareType.ELDERLY, CareType.CHILD],
    hourlyRate: 35,
    experienceYears: 6,
    availabilityStatus: CaregiverAvailability.AVAILABLE,
  },
  {
    email: `cuidador4${EMAIL_DOMAIN}`,
    name: "Diego Almeida Souza",
    phone: "(62) 99444-5566",
    street: "Avenida Brasil, 620",
    neighborhood: "Centro",
    city: "Senador Canedo",
    state: "GO",
    bio: "12 anos de experiência cuidando de idosos, crianças e pessoas com necessidades especiais.",
    careTypes: [CareType.ELDERLY, CareType.CHILD, CareType.SPECIAL_NEEDS],
    hourlyRate: 45,
    experienceYears: 12,
    availabilityStatus: CaregiverAvailability.BUSY,
  },
  {
    email: `cuidador5${EMAIL_DOMAIN}`,
    name: "Elisa Martins Oliveira",
    phone: "(62) 99555-6677",
    street: "Rua 84, 300",
    neighborhood: "Setor Marista",
    city: "Goiânia",
    state: "GO",
    bio: "Especialista em cuidados infantis e necessidades especiais, com formação em pedagogia terapêutica.",
    careTypes: [CareType.CHILD, CareType.SPECIAL_NEEDS],
    hourlyRate: 60,
    experienceYears: 15,
    availabilityStatus: CaregiverAvailability.UNAVAILABLE,
    // Demonstrates visibleToFamilies actually hiding a caregiver from
    // family search/matching -- see CLAUDE.md "Dados de demonstração".
    visibleToFamilies: false,
  },
];

const FAMILY_SEEDS: FamilySeed[] = [
  {
    email: `familia1${EMAIL_DOMAIN}`,
    name: "Família Pereira",
    phone: "(62) 98111-1122",
    address: "Rua T-30, 555 - Setor Bueno",
    city: "Goiânia",
    state: "GO",
    bio: "Buscamos cuidador(a) para nossa mãe idosa, com mobilidade reduzida.",
    neededCareTypes: [CareType.ELDERLY],
    // Below what the ELDERLY-capable caregivers charge (cuidador1 R$25,
    // cuidador3 R$35, cuidador4 R$45) -- exercises computePriceScore's
    // budget layer with the caregiver over budget.
    hourlyBudget: 20,
  },
  {
    email: `familia2${EMAIL_DOMAIN}`,
    name: "Família Souza",
    phone: "(62) 98222-2233",
    address: "Rua Uirapuru, 210 - Jardim América",
    city: "Aparecida de Goiânia",
    state: "GO",
    bio: "Precisamos de apoio no cuidado dos nossos filhos gêmeos, período vespertino.",
    neededCareTypes: [CareType.CHILD],
    // Above what every CHILD-capable caregiver charges (cuidador2 R$20,
    // cuidador3 R$35, cuidador4 R$45, cuidador5 R$60) -- exercises
    // computePriceScore's budget layer with every candidate within budget.
    hourlyBudget: 70,
    // Demonstrates visibleToCaregivers actually hiding a family from
    // caregiver search/matching -- see CLAUDE.md "Dados de demonstração".
    visibleToCaregivers: false,
  },
  {
    email: `familia3${EMAIL_DOMAIN}`,
    name: "Família Ribeiro",
    phone: "(62) 98333-3344",
    address: "Avenida Rotariana, 150 - Centro",
    city: "Trindade",
    state: "GO",
    bio: "Família busca cuidador(a) para atender avó idosa e sobrinho com necessidades especiais.",
    neededCareTypes: [CareType.ELDERLY, CareType.CHILD, CareType.SPECIAL_NEEDS],
  },
];

// Indices into FAMILY_SEEDS / CAREGIVER_SEEDS. Deliberately concentrated so
// a single login during the presentation has something to show:
// familia1 (Pereira) ends up with one COMPLETED + one ACCEPTED hire, and
// cuidador4 (Diego) ends up with one ACCEPTED + one PENDING request received.
const HIRE_SEEDS: Array<{
  familyIndex: number;
  caregiverIndex: number;
  status: HireStatus;
  // Must be within the real overlap between FAMILY_SEEDS[familyIndex]
  // .neededCareTypes and CAREGIVER_SEEDS[caregiverIndex].careTypes -- same
  // rule POST /api/hires enforces server-side (see CLAUDE.md "Tipo de
  // cuidado do Hire").
  careType: CareType;
  message?: string;
  review?: { rating: number; comment: string };
}> = [
  {
    familyIndex: 0,
    caregiverIndex: 0,
    status: HireStatus.COMPLETED,
    careType: CareType.ELDERLY,
    review: {
      rating: 5,
      comment: "Ana foi maravilhosa com minha mãe, muito atenciosa e pontual!",
    },
  },
  {
    familyIndex: 1,
    caregiverIndex: 1,
    status: HireStatus.COMPLETED,
    careType: CareType.CHILD,
    review: {
      rating: 3,
      comment: "Bom cuidado com as crianças, mas às vezes chegou atrasado.",
    },
  },
  {
    familyIndex: 2,
    caregiverIndex: 3,
    status: HireStatus.PENDING,
    careType: CareType.SPECIAL_NEEDS,
    message: "Olá Diego, gostaríamos de contratar seus serviços para cuidar da minha avó e do meu sobrinho.",
  },
  {
    familyIndex: 0,
    caregiverIndex: 3,
    status: HireStatus.ACCEPTED,
    careType: CareType.ELDERLY,
    message: "Precisaríamos de apoio adicional nos fins de semana, além do cuidado já combinado.",
  },
];

export async function cleanup() {
  await prisma.hire.deleteMany({
    where: {
      OR: [
        { family: { email: { endsWith: EMAIL_DOMAIN } } },
        { caregiver: { email: { endsWith: EMAIL_DOMAIN } } },
      ],
    },
  });

  // Cascades to FamilyProfile/CaregiverProfile (and, through those,
  // Document), Account and Session -- see prisma/schema.prisma.
  const deleted = await prisma.user.deleteMany({
    where: { email: { endsWith: EMAIL_DOMAIN } },
  });

  return deleted.count;
}

async function seedCaregivers(hashedPassword: string) {
  const userIdByEmail = new Map<string, string>();

  for (const seed of CAREGIVER_SEEDS) {
    const queries = [
      buildGeocodeQuery([seed.street, seed.neighborhood, seed.city, "Goiás, Brasil"]),
      buildGeocodeQuery([seed.neighborhood, seed.city, "Goiás, Brasil"]),
      buildGeocodeQuery([seed.city, "Goiás, Brasil"]),
    ].filter((query): query is string => Boolean(query));

    const geocoded = await geocodeWithSanityCheck(queries, `cuidador "${seed.name}"`);

    const user = await prisma.user.create({
      data: {
        email: seed.email,
        name: seed.name,
        password: hashedPassword,
        role: Role.CAREGIVER,
        caregiverProfile: {
          create: {
            phone: seed.phone,
            city: seed.city,
            state: seed.state,
            bio: seed.bio,
            careTypes: seed.careTypes,
            hourlyRate: seed.hourlyRate,
            experienceYears: seed.experienceYears,
            availabilityStatus: seed.availabilityStatus,
            visibleToFamilies: seed.visibleToFamilies ?? true,
            latitude: geocoded?.latitude,
            longitude: geocoded?.longitude,
          },
        },
      },
    });

    userIdByEmail.set(seed.email, user.id);
  }

  return userIdByEmail;
}

async function seedFamilies(hashedPassword: string) {
  const userIdByEmail = new Map<string, string>();

  for (const seed of FAMILY_SEEDS) {
    const queries = [
      buildGeocodeQuery([seed.address, seed.city, "Goiás, Brasil"]),
      buildGeocodeQuery([seed.city, "Goiás, Brasil"]),
    ].filter((query): query is string => Boolean(query));

    const geocoded = await geocodeWithSanityCheck(queries, seed.name);

    const user = await prisma.user.create({
      data: {
        email: seed.email,
        name: seed.name,
        password: hashedPassword,
        role: Role.FAMILY,
        familyProfile: {
          create: {
            phone: seed.phone,
            address: seed.address,
            city: seed.city,
            state: seed.state,
            bio: seed.bio,
            neededCareTypes: seed.neededCareTypes,
            hourlyBudget: seed.hourlyBudget,
            visibleToCaregivers: seed.visibleToCaregivers ?? true,
            latitude: geocoded?.latitude,
            longitude: geocoded?.longitude,
          },
        },
      },
    });

    userIdByEmail.set(seed.email, user.id);
  }

  return userIdByEmail;
}

async function seedHires(
  familyIdByEmail: Map<string, string>,
  caregiverIdByEmail: Map<string, string>
) {
  const TERMINAL_STATUSES: HireStatus[] = [
    HireStatus.REJECTED,
    HireStatus.COMPLETED,
    HireStatus.CANCELLED,
  ];

  for (const hireSeed of HIRE_SEEDS) {
    const familyId = familyIdByEmail.get(
      FAMILY_SEEDS[hireSeed.familyIndex].email
    );
    const caregiverId = caregiverIdByEmail.get(
      CAREGIVER_SEEDS[hireSeed.caregiverIndex].email
    );

    if (!familyId || !caregiverId) {
      throw new Error("Family or caregiver missing while seeding hires");
    }

    const isActive = !TERMINAL_STATUSES.includes(hireSeed.status);

    const hire = await prisma.hire.create({
      data: {
        familyId,
        caregiverId,
        status: hireSeed.status,
        careType: hireSeed.careType,
        message: hireSeed.message,
        activeHireKey: isActive ? `${familyId}:${caregiverId}` : null,
      },
    });

    if (hireSeed.review) {
      await prisma.review.create({
        data: {
          hireId: hire.id,
          authorId: familyId,
          targetId: caregiverId,
          rating: hireSeed.review.rating,
          comment: hireSeed.review.comment,
        },
      });
    }
  }
}

function printCredentialsTable() {
  const rows = [
    ...FAMILY_SEEDS.map((seed) => ({
      Nome: seed.name,
      Email: seed.email,
      Senha: DEMO_PASSWORD,
      Role: "FAMILY",
    })),
    ...CAREGIVER_SEEDS.map((seed) => ({
      Nome: seed.name,
      Email: seed.email,
      Senha: DEMO_PASSWORD,
      Role: "CAREGIVER",
    })),
  ];

  console.log("\n=== Credenciais de demonstração (mesma senha para todos) ===\n");
  console.table(rows);
}

async function main() {
  console.log("=== Limpando dados de demonstração anteriores ===");
  const removedCount = await cleanup();
  console.log(`Usuários demo removidos: ${removedCount}\n`);

  console.log("=== Criando cuidadores (geocodificando via Nominatim, ~1 req/s) ===");
  const hashedPassword = await bcrypt.hash(DEMO_PASSWORD, BCRYPT_SALT_ROUNDS);
  const caregiverIdByEmail = await seedCaregivers(hashedPassword);
  console.log(`${CAREGIVER_SEEDS.length} cuidadores criados.\n`);

  console.log("=== Criando famílias (geocodificando via Nominatim, ~1 req/s) ===");
  const familyIdByEmail = await seedFamilies(hashedPassword);
  console.log(`${FAMILY_SEEDS.length} famílias criadas.\n`);

  console.log("=== Criando histórico de contratações e avaliações ===");
  await seedHires(familyIdByEmail, caregiverIdByEmail);
  console.log(
    `${HIRE_SEEDS.length} contratações criadas ` +
      `(${HIRE_SEEDS.filter((h) => h.review).length} com avaliação).\n`
  );

  printCredentialsTable();
}

// Guarded so that scripts/cleanup-demo.ts can `import { cleanup }` from this
// file (to reuse the exact same logic) without also triggering a full seed
// run as a side effect of the import.
if (require.main === module) {
  main()
    .catch((error) => {
      console.error(error);
      process.exitCode = 1;
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}
