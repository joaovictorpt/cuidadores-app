import { CareType, HireInitiator, HireStatus, Prisma, Role } from "@prisma/client";
import { getServerSession } from "next-auth/next";
import { NextResponse } from "next/server";
import { z } from "zod";

import { authOptions } from "@/lib/auth";
import { getSharedCareTypes } from "@/lib/care-types";
import { prisma } from "@/lib/prisma";

// Qual id o corpo da requisição carrega depende de quem está iniciando: uma
// família entrando em contato informa o caregiverId (o próprio id dela vem
// da sessão), um cuidador entrando em contato informa o familyId. `careType`
// é obrigatório nos dois casos -- qual necessidade específica motiva esse
// Hire, escolhida pelo cliente a partir da interseção real entre os dois
// perfis (ver HireActionWithCareType) e revalidada contra essa mesma
// interseção no servidor abaixo, já que a lista de opções do cliente é só
// uma conveniência de UX, não uma barreira de segurança.
const createHireAsFamilySchema = z.object({
  caregiverId: z.string().min(1),
  careType: z.nativeEnum(CareType),
  message: z.string().optional(),
});

const createHireAsCaregiverSchema = z.object({
  familyId: z.string().min(1),
  careType: z.nativeEnum(CareType),
  message: z.string().optional(),
});

const ACTIVE_HIRE_STATUSES: HireStatus[] = [HireStatus.PENDING, HireStatus.ACCEPTED];

// Compartilhado pelos dois caminhos de iniciador abaixo -- a regra "no
// máximo um Hire ativo por par família-cuidador" (checagem no nível da
// aplicação aqui, constraint UNIQUE de activeHireKey como rede de
// segurança contra race condition) não se importa com quem inicia, só com
// qual par está envolvido, então isso permanece um único caminho de
// código, sem duplicação, independente de qual lado está criando o Hire.
async function createHire({
  familyId,
  caregiverId,
  initiatedBy,
  careType,
  message,
}: {
  familyId: string;
  caregiverId: string;
  initiatedBy: HireInitiator;
  careType: CareType;
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
        careType,
        message,
        status: HireStatus.PENDING,
        // Trava esse par enquanto ativo; liberado em qualquer transição
        // terminal (ver lib/hire-transitions.ts / a rota PATCH [id]).
        // Montada só a partir do par família-cuidador, independente de
        // initiatedBy -- a regra "uma solicitação ativa por vez" vale da
        // mesma forma independente de quem entrou em contato primeiro.
        activeHireKey: `${familyId}:${caregiverId}`,
      },
    });

    return NextResponse.json({ hire }, { status: 201 });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      // Rede de segurança contra race condition: duas requisições
      // concorrentes passaram na checagem findFirst acima antes que
      // qualquer uma delas tivesse confirmado uma linha.
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

    const { caregiverId, careType, message } = parsed.data;

    const caregiverUser = await prisma.user.findUnique({
      where: { id: caregiverId },
      include: { caregiverProfile: { select: { careTypes: true } } },
    });

    if (
      !caregiverUser ||
      caregiverUser.role !== Role.CAREGIVER ||
      !caregiverUser.caregiverProfile
    ) {
      return NextResponse.json(
        { error: "Cuidador não encontrado" },
        { status: 400 }
      );
    }

    const familyProfile = await prisma.familyProfile.findUnique({
      where: { userId: session.user.id },
      select: { neededCareTypes: true },
    });

    if (!familyProfile) {
      return NextResponse.json(
        { error: "Complete seu perfil antes de contratar" },
        { status: 400 }
      );
    }

    // Revalidado aqui, não apenas confiado a partir do dropdown do cliente
    // -- a lista de opções que o ContratarButton mostra é construída a
    // partir da mesma interseção (ver getSharedCareTypes), mas uma
    // requisição direta à API poderia enviar qualquer coisa.
    const sharedCareTypes = getSharedCareTypes(
      caregiverUser.caregiverProfile.careTypes,
      familyProfile.neededCareTypes
    );

    if (!sharedCareTypes.includes(careType)) {
      return NextResponse.json(
        {
          error:
            "Esse tipo de cuidado não é oferecido por esse cuidador ou não está entre os que você procura",
        },
        { status: 400 }
      );
    }

    return createHire({
      familyId: session.user.id,
      caregiverId,
      initiatedBy: HireInitiator.FAMILY,
      careType,
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

    const { familyId, careType, message } = parsed.data;

    const familyUser = await prisma.user.findUnique({
      where: { id: familyId },
      include: { familyProfile: { select: { neededCareTypes: true } } },
    });

    if (!familyUser || familyUser.role !== Role.FAMILY || !familyUser.familyProfile) {
      return NextResponse.json(
        { error: "Família não encontrada" },
        { status: 400 }
      );
    }

    const caregiverProfile = await prisma.caregiverProfile.findUnique({
      where: { userId: session.user.id },
      select: { careTypes: true },
    });

    if (!caregiverProfile) {
      return NextResponse.json(
        { error: "Complete seu perfil antes de demonstrar interesse" },
        { status: 400 }
      );
    }

    // Mesma revalidação do branch de família acima, espelhada -- ver esse
    // comentário.
    const sharedCareTypes = getSharedCareTypes(
      caregiverProfile.careTypes,
      familyUser.familyProfile.neededCareTypes
    );

    if (!sharedCareTypes.includes(careType)) {
      return NextResponse.json(
        {
          error:
            "Esse tipo de cuidado não está entre os que você atende ou os que essa família procura",
        },
        { status: 400 }
      );
    }

    return createHire({
      familyId,
      caregiverId: session.user.id,
      initiatedBy: HireInitiator.CAREGIVER,
      careType,
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
