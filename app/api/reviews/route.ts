import { HireStatus, Prisma, Role } from "@prisma/client";
import { getServerSession } from "next-auth/next";
import { NextResponse } from "next/server";
import { z } from "zod";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const createReviewSchema = z.object({
  hireId: z.string().min(1),
  rating: z.number().int().min(1).max(5),
  comment: z.string().optional(),
});

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
  const parsed = createReviewSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Dados inválidos", issues: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { hireId, rating, comment } = parsed.data;

  const hire = await prisma.hire.findUnique({ where: { id: hireId } });

  if (!hire) {
    return NextResponse.json(
      { error: "Contratação não encontrada" },
      { status: 404 }
    );
  }

  if (hire.familyId !== session.user.id) {
    return NextResponse.json(
      { error: "Você não participa desta contratação" },
      { status: 403 }
    );
  }

  if (hire.status !== HireStatus.COMPLETED) {
    return NextResponse.json(
      { error: "Só é possível avaliar contratações concluídas" },
      { status: 400 }
    );
  }

  try {
    const review = await prisma.review.create({
      data: {
        hireId,
        authorId: session.user.id,
        targetId: hire.caregiverId,
        rating,
        comment,
      },
    });

    return NextResponse.json({ review }, { status: 201 });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      // Race-condition safety net: two concurrent requests both passed the
      // status/ownership checks above before either had committed a row.
      return NextResponse.json(
        { error: "Essa contratação já foi avaliada" },
        { status: 409 }
      );
    }

    throw error;
  }
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const caregiverId = searchParams.get("caregiverId");

  if (!caregiverId) {
    return NextResponse.json(
      { error: "Parâmetro caregiverId é obrigatório" },
      { status: 400 }
    );
  }

  const reviews = await prisma.review.findMany({
    where: { targetId: caregiverId },
    include: { author: { select: { name: true } } },
    orderBy: { createdAt: "desc" },
  });

  const total = reviews.length;
  const average =
    total > 0
      ? reviews.reduce((sum, review) => sum + review.rating, 0) / total
      : null;

  return NextResponse.json({ reviews, average, total });
}
