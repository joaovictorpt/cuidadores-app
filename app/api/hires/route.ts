import { HireInitiator, HireStatus, Prisma, Role } from "@prisma/client";
import { getServerSession } from "next-auth/next";
import { NextResponse } from "next/server";
import { z } from "zod";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// Which id the request body carries depends on who's initiating: a family
// reaching out names the caregiverId (their own id comes from the
// session), a caregiver reaching out names the familyId instead.
const createHireAsFamilySchema = z.object({
  caregiverId: z.string().min(1),
  message: z.string().optional(),
});

const createHireAsCaregiverSchema = z.object({
  familyId: z.string().min(1),
  message: z.string().optional(),
});

const ACTIVE_HIRE_STATUSES: HireStatus[] = [HireStatus.PENDING, HireStatus.ACCEPTED];

// Shared by both initiator paths below -- the "at most one active Hire per
// family-caregiver pair" rule (app-level check here, activeHireKey unique
// constraint as the race-condition safety net) doesn't care who initiates,
// only which pair is involved, so this stays a single, un-duplicated code
// path regardless of which side is creating the Hire.
async function createHire({
  familyId,
  caregiverId,
  initiatedBy,
  message,
}: {
  familyId: string;
  caregiverId: string;
  initiatedBy: HireInitiator;
  message?: string;
}) {
  const existingActiveHire = await prisma.hire.findFirst({
    where: {
      familyId,
      caregiverId,
      status: { in: ACTIVE_HIRE_STATUSES },
    },
  });

  if (existingActiveHire) {
    return NextResponse.json(
      { error: "Já existe uma solicitação em andamento com esse cuidador" },
      { status: 409 }
    );
  }

  try {
    const hire = await prisma.hire.create({
      data: {
        familyId,
        caregiverId,
        initiatedBy,
        message,
        status: HireStatus.PENDING,
        // Locks this pair while active; released on any terminal
        // transition (see lib/hire-transitions.ts / the [id] PATCH route).
        // Keyed by the family-caregiver pair only, independent of
        // initiatedBy -- the "one active request at a time" rule applies
        // the same way regardless of who reached out first.
        activeHireKey: `${familyId}:${caregiverId}`,
      },
    });

    return NextResponse.json({ hire }, { status: 201 });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      // Race-condition safety net: two concurrent requests both passed the
      // findFirst check above before either had committed a row.
      return NextResponse.json(
        { error: "Já existe uma solicitação em andamento com esse cuidador" },
        { status: 409 }
      );
    }

    throw error;
  }
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }

  const body = await request.json();

  if (session.user.role === Role.FAMILY) {
    const parsed = createHireAsFamilySchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Dados inválidos", issues: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { caregiverId, message } = parsed.data;

    const caregiverUser = await prisma.user.findUnique({
      where: { id: caregiverId },
    });

    if (!caregiverUser || caregiverUser.role !== Role.CAREGIVER) {
      return NextResponse.json(
        { error: "Cuidador não encontrado" },
        { status: 400 }
      );
    }

    return createHire({
      familyId: session.user.id,
      caregiverId,
      initiatedBy: HireInitiator.FAMILY,
      message,
    });
  }

  if (session.user.role === Role.CAREGIVER) {
    const parsed = createHireAsCaregiverSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Dados inválidos", issues: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { familyId, message } = parsed.data;

    const familyUser = await prisma.user.findUnique({
      where: { id: familyId },
    });

    if (!familyUser || familyUser.role !== Role.FAMILY) {
      return NextResponse.json(
        { error: "Família não encontrada" },
        { status: 400 }
      );
    }

    return createHire({
      familyId,
      caregiverId: session.user.id,
      initiatedBy: HireInitiator.CAREGIVER,
      message,
    });
  }

  return NextResponse.json(
    { error: "Acesso restrito a famílias e cuidadores" },
    { status: 403 }
  );
}

export async function GET() {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }

  if (session.user.role === Role.FAMILY) {
    const hires = await prisma.hire.findMany({
      where: { familyId: session.user.id },
      include: { caregiver: { select: { name: true, email: true } } },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ hires });
  }

  if (session.user.role === Role.CAREGIVER) {
    const hires = await prisma.hire.findMany({
      where: { caregiverId: session.user.id },
      include: { family: { select: { name: true, email: true } } },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ hires });
  }

  return NextResponse.json(
    { error: "Acesso restrito a famílias e cuidadores" },
    { status: 403 }
  );
}
