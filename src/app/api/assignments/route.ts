import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const schema = z.object({
  worksheetId: z.string(),
  classId: z.string(),
  dueAt: z.string().optional().nullable(),
});

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role === "STUDENT") {
    return NextResponse.json({ error: "غير مصرح" }, { status: 403 });
  }

  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "بيانات غير صالحة" }, { status: 400 });
  }

  const { worksheetId, classId, dueAt } = parsed.data;

  const students = await prisma.student.findMany({
    where: { classId, active: true },
    select: { id: true },
  });

  const worksheet = await prisma.worksheet.findUnique({
    where: { id: worksheetId },
    include: { questions: true },
  });
  if (!worksheet) return NextResponse.json({ error: "الورقة غير موجودة" }, { status: 404 });

  const maxScore = worksheet.questions.reduce((s, q) => s + q.points, 0);

  const assignment = await prisma.assignment.create({
    data: {
      worksheetId,
      classId,
      dueAt: dueAt ? new Date(dueAt) : null,
      submissions: {
        create: students.map((s) => ({
          studentId: s.id,
          status: "PENDING",
          maxScore,
        })),
      },
    },
    include: { submissions: true },
  });

  await prisma.auditLog.create({
    data: {
      userId: session.user.id,
      action: "CREATE",
      entity: "Assignment",
      entityId: assignment.id,
    },
  });

  return NextResponse.json(assignment, { status: 201 });
}
