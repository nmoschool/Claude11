import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { autoGradeAnswer } from "@/lib/grading";
import { QuestionType } from "@/types";

const schema = z.object({
  responses: z.record(
    z.object({
      response: z.string().optional(),
      manualPoints: z.number().optional(),
    })
  ),
});

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role === "STUDENT") {
    return NextResponse.json({ error: "غير مصرح" }, { status: 403 });
  }

  const { id } = await params;
  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "بيانات غير صالحة" }, { status: 400 });
  }

  const submission = await prisma.submission.findUnique({
    where: { id },
    include: {
      assignment: {
        include: { worksheet: { include: { questions: true } } },
      },
    },
  });
  if (!submission) return NextResponse.json({ error: "غير موجود" }, { status: 404 });

  const questions = submission.assignment.worksheet.questions;
  let totalScore = 0;
  const maxScore = questions.reduce((s, q) => s + q.points, 0);
  let hasManualPending = false;

  for (const q of questions) {
    const entry = parsed.data.responses[q.id] ?? {};

    if (q.autoGrade) {
      const isCorrect = autoGradeAnswer(q.type as QuestionType, q.correctJson, entry.response ?? "");
      const pointsAwarded = isCorrect ? q.points : 0;
      totalScore += pointsAwarded;

      await prisma.answer.upsert({
        where: { submissionId_questionId: { submissionId: submission.id, questionId: q.id } },
        update: {
          responseJson: entry.response ? JSON.stringify(entry.response) : null,
          isCorrect,
          pointsAwarded,
          manuallyGraded: false,
        },
        create: {
          submissionId: submission.id,
          questionId: q.id,
          responseJson: entry.response ? JSON.stringify(entry.response) : null,
          isCorrect,
          pointsAwarded,
          manuallyGraded: false,
        },
      });
    } else {
      const raw = entry.manualPoints;
      if (raw === undefined || raw === null) hasManualPending = true;
      const pointsAwarded = Math.min(Math.max(raw ?? 0, 0), q.points);
      totalScore += pointsAwarded;

      await prisma.answer.upsert({
        where: { submissionId_questionId: { submissionId: submission.id, questionId: q.id } },
        update: {
          responseJson: entry.response ? JSON.stringify(entry.response) : null,
          isCorrect: null,
          pointsAwarded,
          manuallyGraded: true,
        },
        create: {
          submissionId: submission.id,
          questionId: q.id,
          responseJson: entry.response ? JSON.stringify(entry.response) : null,
          isCorrect: null,
          pointsAwarded,
          manuallyGraded: true,
        },
      });
    }
  }

  const updated = await prisma.submission.update({
    where: { id: submission.id },
    data: {
      totalScore,
      maxScore,
      status: hasManualPending ? "PENDING" : "MANUAL_GRADED",
      gradedById: session.user.id,
      gradedAt: new Date(),
      submittedAt: submission.submittedAt ?? new Date(),
    },
  });

  return NextResponse.json(updated);
}
