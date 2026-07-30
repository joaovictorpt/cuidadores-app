import { CareType, Prisma, Role } from "@prisma/client";
import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";
import { z } from "zod";

import {
  isAdult,
  isBirthDateInFuture,
  isBirthDateTooOld,
  MIN_BIRTH_YEAR,
  MIN_REGISTRATION_AGE,
} from "@/lib/age";
import { BR_STATE_UFS } from "@/lib/br-states";
import { buildGeocodeQuery, geocodeAddress } from "@/lib/geocoding";
import { prisma } from "@/lib/prisma";

const BCRYPT_SALT_ROUNDS = 12;

// Shared by both branches: name/birthDate/phone/city/state are required for
// everyone. `address` is family-only below -- CaregiverProfile has no
// address column (see CLAUDE.md "Geolocalização"), so there's nothing to
// require it against for caregivers.
const baseFields = {
  email: z.string().email("Email inválido"),
  password: z.string().min(8, "A senha deve ter pelo menos 8 caracteres"),
  name: z.string().min(1, "Nome é obrigatório"),
  // Order matters: an absurd date (e.g. a typo'd unbounded year) should
  // surface as a range error, not a confusing "you must be 18+" message.
  birthDate: z.coerce
    .date()
    .refine((date) => !isBirthDateInFuture(date), {
      message: "Data de nascimento não pode ser no futuro",
    })
    .refine((date) => !isBirthDateTooOld(date), {
      message: `Data de nascimento não pode ser anterior a ${MIN_BIRTH_YEAR}`,
    })
    .refine(isAdult, {
      message: `Você precisa ter pelo menos ${MIN_REGISTRATION_AGE} anos para se cadastrar`,
    }),
  phone: z.string().min(1, "Telefone é obrigatório"),
  city: z.string().min(1, "Cidade é obrigatória"),
  state: z.enum(BR_STATE_UFS, { message: "Selecione um estado válido" }),
};

const familySchema = z.object({
  ...baseFields,
  role: z.literal(Role.FAMILY),
  address: z.string().min(1, "Endereço é obrigatório"),
  bio: z.string().optional(),
  neededCareTypes: z.array(z.nativeEnum(CareType)).optional(),
});

const caregiverSchema = z.object({
  ...baseFields,
  role: z.literal(Role.CAREGIVER),
  bio: z.string().optional(),
  hourlyRate: z.number().positive().optional(),
  experienceYears: z.number().int().nonnegative().optional(),
  careTypes: z.array(z.nativeEnum(CareType)).optional(),
});

const registerSchema = z.discriminatedUnion("role", [
  familySchema,
  caregiverSchema,
]);

export async function POST(request: Request) {
  const body = await request.json();
  const parsed = registerSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Dados inválidos", issues: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const data = parsed.data;
  const hashedPassword = await bcrypt.hash(data.password, BCRYPT_SALT_ROUNDS);

  // Geocode before opening the Prisma transaction: Nominatim is rate-limited
  // to 1 req/sec and can take a while to respond, and an interactive
  // transaction has a short timeout — an external HTTP call inside it risks
  // aborting the whole registration over a slow geocoding request.
  const addressQuery =
    data.role === Role.FAMILY
      ? buildGeocodeQuery([data.address, data.city, data.state])
      : buildGeocodeQuery([data.city, data.state]);

  const geocoded = addressQuery ? await geocodeAddress(addressQuery) : null;

  try {
    const user = await prisma.$transaction(async (tx) => {
      const createdUser = await tx.user.create({
        data: {
          email: data.email,
          name: data.name,
          birthDate: data.birthDate,
          password: hashedPassword,
          role: data.role,
        },
      });

      if (data.role === Role.FAMILY) {
        await tx.familyProfile.create({
          data: {
            userId: createdUser.id,
            phone: data.phone,
            city: data.city,
            state: data.state,
            address: data.address,
            bio: data.bio,
            neededCareTypes: data.neededCareTypes ?? [],
            latitude: geocoded?.latitude,
            longitude: geocoded?.longitude,
          },
        });
      } else {
        await tx.caregiverProfile.create({
          data: {
            userId: createdUser.id,
            phone: data.phone,
            city: data.city,
            state: data.state,
            bio: data.bio,
            hourlyRate: data.hourlyRate,
            experienceYears: data.experienceYears,
            careTypes: data.careTypes ?? [],
            latitude: geocoded?.latitude,
            longitude: geocoded?.longitude,
          },
        });
      }

      return createdUser;
    }, { timeout: 15000 });

    return NextResponse.json(
      { id: user.id, email: user.email, role: user.role },
      { status: 201 }
    );
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return NextResponse.json(
        { error: "Este email já está cadastrado" },
        { status: 409 }
      );
    }

    throw error;
  }
}
