import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { HttpError, type StaffContext } from "@/lib/guard";
import { decryptOptional, encryptOptional, hashNationalId, maskId } from "@/lib/crypto";
import { normalizeNationalId, normalizePhone } from "@/lib/studentImport";
import { AVATARS } from "@/lib/pictures";
import { parseDay } from "@/lib/dates";

export async function loadStudentInScope(ctx: StaffContext, id: string) {
  const s = await prisma.student.findFirst({ where: { id, class: { schoolId: ctx.schoolId } }, include: { class: true } });
  if (!s || !ctx.inScope(s.classId)) throw new HttpError(404, "NOT_FOUND", "الطالبة غير موجودة أو خارج نطاقك");
  return s;
}

export const StudentFields = z.object({
  fullName: z.string().trim().min(3).max(120),
  displayName: z.string().trim().min(2).max(30).optional(),
  avatar: z.enum(AVATARS as unknown as [string, ...string[]]).optional(),
  birthDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  guardianName: z.string().trim().max(120).nullable().optional(),
  // حساسة:
  nationalId: z.string().nullable().optional(),
  guardianPhone: z.string().nullable().optional(),
  healthNotes: z.string().trim().max(500).nullable().optional(),
});
export type StudentInput = z.infer<typeof StudentFields>;

const SENSITIVE = ["nationalId", "guardianPhone", "healthNotes"] as const;

/** يحوّل المدخلات إلى أعمدة القاعدة (مع التشفير والتحقق والتطبيع) */
export async function studentData(ctx: StaffContext, classId: string, input: Partial<StudentInput>, existingId?: string) {
  if (SENSITIVE.some((k) => input[k] !== undefined) && !ctx.can("students:sensitive", classId)) {
    throw new HttpError(403, "FORBIDDEN", "تعديل البيانات الحساسة يتطلب صلاحية خاصة");
  }
  const data: Record<string, unknown> = {};
  if (input.fullName !== undefined) {
    const fullName = input.fullName.replace(/\s+/g, " ");
    data.fullName = fullName;
    if (!input.displayName) data.displayName = fullName.split(" ")[0];
  }
  if (input.displayName) data.displayName = input.displayName;
  if (input.avatar) data.avatar = input.avatar;
  if (input.birthDate !== undefined) data.birthDate = input.birthDate ? parseDay(input.birthDate) : null;
  if (input.guardianName !== undefined) data.guardianName = input.guardianName || null;
  if (input.nationalId !== undefined) {
    if (input.nationalId) {
      const id = normalizeNationalId(input.nationalId);
      if (!id) throw new HttpError(400, "INVALID_ID", "رقم الهوية يجب أن يكون 10 أرقام يبدأ بـ 1 أو 2");
      const hash = hashNationalId(id);
      const dup = await prisma.student.findFirst({ where: { nationalIdHash: hash, ...(existingId ? { id: { not: existingId } } : {}) } });
      if (dup) throw new HttpError(409, "DUPLICATE_ID", "رقم الهوية مسجّل لطالبة أخرى");
      Object.assign(data, { nationalIdEnc: encryptOptional(id), nationalIdLast4: id.slice(-4), nationalIdHash: hash });
    } else Object.assign(data, { nationalIdEnc: null, nationalIdLast4: null, nationalIdHash: null });
  }
  if (input.guardianPhone !== undefined) {
    const p = input.guardianPhone ? normalizePhone(input.guardianPhone) : null;
    if (input.guardianPhone && !p) throw new HttpError(400, "INVALID_PHONE", "رقم الجوال يجب أن يكون بصيغة 05xxxxxxxx");
    data.guardianPhoneEnc = encryptOptional(p);
  }
  if (input.healthNotes !== undefined) data.healthNotesEnc = encryptOptional(input.healthNotes || null);
  return data;
}

/** آخر سلسلة غياب متتالية (بدون عذر) */
export function absenceStreak(records: { date: Date; status: string }[]): number {
  let n = 0;
  for (const r of [...records].sort((a, b) => b.date.getTime() - a.date.getTime())) {
    if (r.status === "ABSENT") n++;
    else break;
  }
  return n;
}

export function attendanceStats(records: { date: Date; status: string }[]) {
  const c = { PRESENT: 0, ABSENT: 0, LATE: 0, EXCUSED: 0 };
  records.forEach((r) => {
    if (r.status in c) c[r.status as keyof typeof c]++;
  });
  const total = records.length;
  return {
    total,
    ...c,
    rate: total ? Math.round(((c.PRESENT + c.LATE) / total) * 100) : null,
    streak: absenceStreak(records),
  };
}

export async function studentProfile(ctx: StaffContext, id: string) {
  const s = await loadStudentInScope(ctx, id);
  const sensitive = ctx.can("students:sensitive", s.classId);
  const [attendance, behavior, notes, files] = await Promise.all([
    prisma.attendance.findMany({ where: { studentId: id, period: 0 }, orderBy: { date: "desc" } }),
    prisma.behaviorRecord.findMany({ where: { studentId: id }, orderBy: { date: "desc" } }),
    prisma.studentNote.findMany({
      where: { studentId: id, ...(ctx.role === "SUPERVISOR" ? { visibleToSupervisor: true } : {}) },
      orderBy: { createdAt: "desc" },
    }),
    prisma.studentFile.findMany({
      where: { studentId: id, ...(sensitive ? {} : { category: { not: "MEDICAL" } }) },
      orderBy: { createdAt: "desc" },
    }),
  ]);
  const authorIds = Array.from(new Set([...notes.map((n) => n.authorId), ...behavior.map((b) => b.recordedBy), ...files.map((f) => f.uploadedBy)]));
  const authors = Object.fromEntries(
    (await prisma.user.findMany({ where: { id: { in: authorIds } }, select: { id: true, name: true } })).map((u) => [u.id, u.name])
  );
  return {
    student: {
      id: s.id,
      classId: s.classId,
      fullName: s.fullName,
      displayName: s.displayName,
      avatar: s.avatar,
      archived: s.archived,
      birthDate: s.birthDate,
      guardianName: s.guardianName,
      nationalId: sensitive ? decryptOptional(s.nationalIdEnc) : maskId(s.nationalIdLast4),
      nationalIdMasked: maskId(s.nationalIdLast4),
      guardianPhone: sensitive ? decryptOptional(s.guardianPhoneEnc) : s.guardianPhoneEnc ? "مخفي" : null,
      healthNotes: sensitive ? decryptOptional(s.healthNotesEnc) : s.healthNotesEnc ? "مخفي" : null,
      points: s.points,
    },
    sensitive,
    attendance: {
      stats: attendanceStats(attendance),
      records: attendance.slice(0, 120).map((a) => ({ id: a.id, date: a.date, status: a.status, note: a.note })),
    },
    behavior: {
      points: behavior.reduce((sum, b) => sum + (b.positive ? b.points : -b.points), 0),
      positive: behavior.filter((b) => b.positive).length,
      negative: behavior.filter((b) => !b.positive).length,
      records: behavior.map((b) => ({ ...b, recordedByName: authors[b.recordedBy] ?? "—" })),
    },
    notes: notes.map((n) => ({ ...n, authorName: authors[n.authorId] ?? "—", mine: n.authorId === ctx.id })),
    files: files.map((f) => ({ id: f.id, fileName: f.fileName, mime: f.mime, size: f.size, category: f.category, createdAt: f.createdAt, uploadedByName: authors[f.uploadedBy] ?? "—" })),
  };
}
