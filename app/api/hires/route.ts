import { HireStatus, Prisma, Role } from "@prisma/client";
import { getServerSession } from "next-auth/next";
import { NextResponse } from "next/server";
import { z } from "zod";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const createHireSchema = z.object({
  caregiverId: z.string().min(1),
  message: z.string().optional(),
});

const ACTIVE_HIRE_STATUSES: HireStatus[] = [HireStatus.PENDING, HireStatus.ACCEPTED];

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }

  if (session.user.role !== Role.FAMILY) {
    return NextResponse.json(
      { error: "Acesso restrito a famílias" },
      { status: 403 }
    );
  }

  const body = await request.json();
  const parsed = createHireSchema.safeParse(body);

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

  const existingActiveHire = await prisma.hire.findFirst({
    where: {
      familyId: session.user.id,
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
        familyId: session.user.id,
        caregiverId,
        message,
        status: HireStatus.PENDING,
        // Locks this pair while active; released on any terminal
        // transition (see lib/hire-transitions.ts / the [id] PATCH route).
        activeHireKey: `${session.user.id}:${caregiverId}`,
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
