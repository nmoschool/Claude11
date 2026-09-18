import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const questionSchema = z.object({
  type: z.enum(["MULTIPLE_CHOICE", "TRUE_FALSE", "FILL_BLANK", "WORD_PROBLEM"]),
  text: z.string().min(1),
  options: z.array(z.string()).optional(),
  correct: z.string(),
  points: z.number().min(0.5).max(100),
  autoGrade: z.boolean(),
});

const createSchema = z.object({
  title: z.string().min(1).max(200),
  type: z.enum(["WORKSHEET", "QUIZ"]),
  grade: z.number().int().min(1).max(2),
  unitId: z.string().optional().nullable(),
  durationMinutes: z.number().int().min(5).max(180),
  instructions: z.string().max(500).optional().nullable(),
  questions: z.array(questionSchema).min(1),
});

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "غير مصرح" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const grade = searchParams.get("grade");
  const type = searchParams.get("type");

  const worksheets = await prisma.worksheet.findMany({
    where: {
      ...(grade ? { grade: Number(grade) } : {}),
      ...(type ? { type: type as "WORKSHEET" | "QUIZ" } : {}),
      ...(session.user.role === "TEACHER" ? { createdById: session.user.id } : {}),
    },
    orderBy: { createdAt: "desc" },
    include: {
      unit: { select: { title: true } },
      _count: { select: { questions: true, assignments: true } },
    },
  });

  return NextResponse.json(worksheets);
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role === "STUDENT") {
    return NextResponse.json({ error: "غير مصرح" }, { status: 403 });
  }

  const body = await req.json();
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "بيانات غير صالحة", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const data = parsed.data;

  const worksheet = await prisma.worksheet.create({
    data: {
      title: data.title,
      type: data.type,
      grade: data.grade,
      unitId: data.unitId || null,
      createdById: session.user.id,
      durationMinutes: data.durationMinutes,
      instructions: data.instructions || null,
      questions: {
        create: data.questions.map((q, i) => ({
          order: i + 1,
          type: q.type,
          text: q.text,
          optionsJson: q.options ? JSON.stringify(q.options) : null,
          correctJson: JSON.stringify(q.correct),
          points: q.points,
          autoGrade: q.autoGrade,
        })),
      },
    },
    include: { questions: true },
  });

  await prisma.auditLog.create({
    data: {
      userId: session.user.id,
      action: "CREATE",
      entity: "Worksheet",
      entityId: worksheet.id,
    },
  });

  return NextResponse.json(worksheet, { status: 201 });
}
