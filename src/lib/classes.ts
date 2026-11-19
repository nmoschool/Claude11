import { prisma } from "@/lib/prisma";
import type { StaffContext } from "@/lib/guard";
import { decryptOptional, maskId } from "@/lib/crypto";

export function classLabel(c: { grade: number; section: string }) {
  return `${c.grade === 4 ? "الرابع" : `الصف ${c.grade}`} / ${c.section}`;
}

export async function listClasses(ctx: StaffContext) {
  const classes = await prisma.schoolClass.findMany({
    where: ctx.classWhere(),
    include: {
      _count: { select: { students: { where: { archived: false } } } },
      staff: { include: { user: { select: { name: true } } } },
    },
    orderBy: [{ grade: "asc" }, { section: "asc" }],
  });
  return classes.map((c) => ({
    id: c.id,
    label: classLabel(c),
    joinCode: c.joinCode,
    studentCount: c._count.students,
    teachers: c.staff.filter((s) => s.role === "TEACHER").map((s) => s.user.name),
    supervisors: c.staff.filter((s) => s.role === "SUPERVISOR").map((s) => s.user.name),
  }));
}

export async function listStudents(ctx: StaffContext, classId: string, opts: { archived?: boolean } = {}) {
  const sensitive = ctx.can("students:sensitive", classId);
  const students = await prisma.student.findMany({
    where: { classId, archived: opts.archived ?? false },
    orderBy: { fullName: "asc" },
  });
  return students.map((s) => ({
    id: s.id,
    fullName: s.fullName,
    displayName: s.displayName,
    avatar: s.avatar,
    nationalId: maskId(s.nationalIdLast4),
    guardianName: s.guardianName,
    guardianPhone: sensitive ? decryptOptional(s.guardianPhoneEnc) : s.guardianPhoneEnc ? "مخفي" : null,
    healthNotes: sensitive ? decryptOptional(s.healthNotesEnc) : s.healthNotesEnc ? "مخفي" : null,
    hasPictureCode: !!s.pictureCodeHash,
    locked: !!s.lockedUntil && s.lockedUntil > new Date(),
    lastLoginAt: s.lastLoginAt,
    points: s.points,
  }));
}
