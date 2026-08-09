import { HireStatus } from "@prisma/client";
import { getServerSession } from "next-auth/next";
import { NextResponse } from "next/server";
import { z } from "zod";

import { authOptions } from "@/lib/auth";
import {
  isValidHireTransition,
  TERMINAL_HIRE_STATUSES,
} from "@/lib/hire-transitions";
import { prisma } from "@/lib/prisma";

const updateHireSchema = z.object({
  status: z.nativeEnum(HireStatus),
});

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }

  const { id } = await params;

  const body = await request.json();
  const parsed = updateHireSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Dados inválidos", issues: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const hire = await prisma.hire.findUnique({ where: { id } });

  if (!hire) {
    return NextResponse.json(
      { error: "Solicitação não encontrada" },
      { status: 404 }
    );
  }

  const isFamily = hire.familyId === session.user.id;
  const isCaregiver = hire.caregiverId === session.user.id;

  if (!isFamily && !isCaregiver) {
    return NextResponse.json(
      { error: "Você não participa desta solicitação" },
      { status: 403 }
    );
  }

  const nextStatus = parsed.data.status;

  if (
    !isValidHireTransition(
      hire.status,
      nextStatus,
      session.user.role,
      hire.initiatedBy
    )
  ) {
    return NextResponse.json(
      {
        error: `Não é possível mudar de ${hire.status} para ${nextStatus} com o seu perfil`,
      },
      { status: 400 }
    );
  }

  const updated = await prisma.hire.update({
    where: { id },
    data: {
      status: nextStatus,
      // Release the uniqueness lock once the Hire reaches a terminal
      // state, so this family-caregiver pair can start a new Hire later.
      activeHireKey: TERMINAL_HIRE_STATUSES.includes(nextStatus)
        ? null
        : hire.activeHireKey,
      // Real transition timestamps, used by /dashboard/hires/[id] to show
      // the service duration -- only these two transitions matter for
      // that, every other transition leaves both fields untouched.
      ...(nextStatus === HireStatus.ACCEPTED ? { acceptedAt: new Date() } : {}),
      ...(nextStatus === HireStatus.COMPLETED ? { completedAt: new Date() } : {}),
    },
  });

  return NextResponse.json({ hire: updated });
}
