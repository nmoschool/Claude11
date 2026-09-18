import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const rowSchema = z.object({
  fullName: z.string().min(1),
  studentNumber: z.string().min(1),
  grade: z.number().int().min(1).max(2),
  className: z.string().min(1),
  guardianPhone: z.string().optional().nullable(),
});

const bodySchema = z.object({
  rows: z.array(rowSchema).min(1).max(500),
});

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role === "STUDENT") {
    return NextResponse.json({ error: "غير مصرح" }, { status: 403 });
  }

  const parsed = bodySchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "بيانات غير صالحة" }, { status: 400 });
  }

  const { rows } = parsed.data;
  let created = 0;
  const skipped: { studentNumber: string; reason: string }[] = [];

  for (const row of rows) {
    const existing = await prisma.student.findUnique({
      where: { studentNumber: row.studentNumber },
    });
    if (existing) {
      skipped.push({ studentNumber: row.studentNumber, reason: "رقم مكرر - موجود مسبقاً" });
      continue;
    }

    const schoolClass = await prisma.schoolClass.upsert({
      where: { name_grade: { name: row.className, grade: row.grade } },
      update: {},
      create: { name: row.className, grade: row.grade },
    });

    await prisma.student.create({
      data: {
        fullName: row.fullName,
        studentNumber: row.studentNumber,
        grade: row.grade,
        classId: schoolClass.id,
        guardianPhone: row.guardianPhone || null,
      },
    });
    created++;
  }

  await prisma.auditLog.create({
    data: {
      userId: session.user.id,
      action: "IMPORT",
      entity: "Student",
      meta: JSON.stringify({ created, skippedCount: skipped.length }),
    },
  });

  return NextResponse.json({ created, skipped });
}
