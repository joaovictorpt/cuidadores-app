import { CareType, Prisma, Role } from "@prisma/client";
import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";
import { z } from "zod";

import { buildGeocodeQuery, geocodeAddress } from "@/lib/geocoding";
import { prisma } from "@/lib/prisma";

const BCRYPT_SALT_ROUNDS = 12;

const baseFields = {
  email: z.string().email("Email inválido"),
  password: z.string().min(8, "A senha deve ter pelo menos 8 caracteres"),
  name: z.string().min(1).optional(),
};

const familySchema = z.object({
  ...baseFields,
  role: z.literal(Role.FAMILY),
  phone: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  address: z.string().optional(),
  bio: z.string().optional(),
  neededCareTypes: z.array(z.nativeEnum(CareType)).optional(),
});

const caregiverSchema = z.object({
  ...baseFields,
  role: z.literal(Role.CAREGIVER),
  phone: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
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
