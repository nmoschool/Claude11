import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "غير مصرح" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const classId = searchParams.get("classId");

  const students = await prisma.student.findMany({
    where: { ...(classId ? { classId } : {}) },
    include: { class: true },
    orderBy: [{ class: { name: "asc" } }, { fullName: "asc" }],
  });

  return NextResponse.json(students);
}

const createSchema = z.object({
  fullName: z.string().min(1),
  studentNumber: z.string().min(1),
  grade: z.number().int().min(1).max(2),
  className: z.string().min(1),
  guardianPhone: z.string().optional().nullable(),
});

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role === "STUDENT") {
    return NextResponse.json({ error: "غير مصرح" }, { status: 403 });
  }

  const parsed = createSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "بيانات غير صالحة" }, { status: 400 });
  }
  const { fullName, studentNumber, grade, className, guardianPhone } = parsed.data;

  const existing = await prisma.student.findUnique({ where: { studentNumber } });
  if (existing) {
    return NextResponse.json({ error: "رقم الطالب مستخدم مسبقاً" }, { status: 409 });
  }

  const schoolClass = await prisma.schoolClass.upsert({
    where: { name_grade: { name: className, grade } },
    update: {},
    create: { name: className, grade },
  });

  const student = await prisma.student.create({
    data: {
      fullName,
      studentNumber,
      grade,
      classId: schoolClass.id,
      guardianPhone: guardianPhone || null,
    },
  });

  return NextResponse.json(student, { status: 201 });
}
