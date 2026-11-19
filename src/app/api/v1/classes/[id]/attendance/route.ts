import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { withPermission, assertScope, HttpError } from "@/lib/guard";
import { audit } from "@/lib/audit";
import { parseDay, todayRiyadh, isSchoolDay } from "@/lib/dates";
import { absenceStreak } from "@/lib/studentService";

function day(raw: string | null) {
  try {
    return parseDay(raw ?? todayRiyadh());
  } catch (e) {
    throw new HttpError(400, "INVALID_DATE", (e as Error).message);
  }
}

/** كشف حضور اليوم + تنبيه الغياب المتتالي (3 أيام فأكثر) */
export const GET = withPermission<{ id: string }>("students:read", async (req, ctx, { id }) => {
  assertScope(ctx, id);
  const date = day(new URL(req.url).searchParams.get("date"));
  const students = await prisma.student.findMany({
    where: { classId: id, archived: false },
    orderBy: { fullName: "asc" },
    include: { attendance: { where: { period: 0, date: { lte: date } }, orderBy: { date: "desc" }, take: 10 } },
  });
  return {
    date: date.toISOString().slice(0, 10),
    schoolDay: isSchoolDay(date),
    students: students.map((s) => {
      const today = s.attendance.find((a) => a.date.getTime() === date.getTime());
      return {
        id: s.id,
        fullName: s.fullName,
        avatar: s.avatar,
        status: today?.status ?? null,
        note: today?.note ?? null,
        streak: absenceStreak(s.attendance),
      };
    }),
  };
});

const Body = z.object({
  date: z.string(),
  records: z
    .array(z.object({ studentId: z.string(), status: z.enum(["PRESENT", "ABSENT", "LATE", "EXCUSED"]), note: z.string().trim().max(200).nullable().optional() }))
    .max(80),
});

export const PUT = withPermission<{ id: string }>("attendance:write", async (req, ctx, { id }) => {
  assertScope(ctx, id);
  const body = Body.parse(await req.json());
  const date = day(body.date);
  if (date.getTime() > parseDay(todayRiyadh()).getTime()) throw new HttpError(400, "FUTURE", "لا يمكن تسجيل الحضور لتاريخ مستقبلي");
  const valid = await prisma.student.count({ where: { id: { in: body.records.map((r) => r.studentId) }, classId: id } });
  if (valid !== new Set(body.records.map((r) => r.studentId)).size) throw new HttpError(400, "INVALID_STUDENT", "طالبة لا تنتمي لهذا الفصل");

  await prisma.$transaction(
    body.records.map((r) =>
      prisma.attendance.upsert({
        where: { studentId_date_period: { studentId: r.studentId, date, period: 0 } },
        create: { studentId: r.studentId, date, period: 0, status: r.status, note: r.note ?? null, recordedBy: ctx.id },
        update: { status: r.status, note: r.note ?? null, recordedBy: ctx.id },
      })
    )
  );
  const counts = body.records.reduce((m, r) => ({ ...m, [r.status]: (m[r.status] ?? 0) + 1 }), {} as Record<string, number>);
  await audit({ actorId: ctx.id, action: "ATTENDANCE_SAVED", entity: "SchoolClass", entityId: id, after: { date: body.date, counts } });
  return { ok: true, counts };
});
