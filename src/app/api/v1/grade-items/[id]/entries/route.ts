import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { withPermission, HttpError } from "@/lib/guard";
import { audit } from "@/lib/audit";
import { getLock, loadItem } from "@/lib/gradebookService";

const Body = z.object({
  entries: z
    .array(
      z.object({
        studentId: z.string(),
        score: z.number().min(0).nullable(),
        status: z.enum(["NORMAL", "EXCUSED", "ABSENT"]).default("NORMAL"),
      })
    )
    .min(1)
    .max(80),
  reason: z.string().trim().max(300).optional(),
});

/**
 * رصد دفعة درجات لتقييم واحد (خلية أو عمود ملصوق).
 * بعد الاعتماد: يلزم «سبب» ويُسجَّل كل تغيير بالقيمة القديمة والجديدة.
 */
export const PUT = withPermission<{ id: string }>("grades:write", async (req, ctx, { id }) => {
  const it = await loadItem(ctx, id);
  const body = Body.parse(await req.json());
  const max = Number(it.maxScore);
  const bad = body.entries.find((e) => e.score !== null && (e.score > max || Math.round(e.score * 100) !== e.score * 100));
  if (bad) throw new HttpError(400, "INVALID_SCORE", `درجة غير صالحة (العظمى ${max}، ورقمان عشريان كحد أقصى)`);

  const lock = await getLock(it.classId, it.termId);
  if (lock && (!body.reason || body.reason.length < 5)) {
    throw new HttpError(409, "LOCKED_REASON_REQUIRED", "الدرجات معتمدة؛ اكتبي سبب التعديل (5 أحرف على الأقل)");
  }
  const ids = Array.from(new Set(body.entries.map((e) => e.studentId)));
  const valid = await prisma.student.count({ where: { id: { in: ids }, classId: it.classId } });
  if (valid !== ids.length) throw new HttpError(400, "INVALID_STUDENT", "طالبة لا تنتمي لهذا الفصل");

  const existing = await prisma.gradeEntry.findMany({ where: { itemId: id, studentId: { in: ids } } });
  const prev = new Map(existing.map((e) => [e.studentId, { score: e.score === null ? null : Number(e.score), status: e.status }]));
  const changes = body.entries
    .map((e) => ({ studentId: e.studentId, before: prev.get(e.studentId) ?? null, after: { score: e.status === "NORMAL" ? e.score : null, status: e.status } }))
    .filter((c) => !c.before || c.before.score !== c.after.score || c.before.status !== c.after.status);
  if (!changes.length) return { ok: true, changed: 0 };

  await prisma.$transaction(
    changes.map((c) =>
      prisma.gradeEntry.upsert({
        where: { itemId_studentId: { itemId: id, studentId: c.studentId } },
        create: { itemId: id, studentId: c.studentId, score: c.after.score, status: c.after.status, updatedBy: ctx.id },
        update: { score: c.after.score, status: c.after.status, updatedBy: ctx.id, source: "MANUAL" },
      })
    )
  );
  await audit({
    actorId: ctx.id,
    action: lock ? "GRADES_CHANGED_AFTER_LOCK" : "GRADES_UPDATED",
    entity: "GradeItem",
    entityId: id,
    before: changes.map((c) => ({ studentId: c.studentId, ...c.before })),
    after: changes.map((c) => ({ studentId: c.studentId, ...c.after })),
    reason: body.reason,
  });
  return { ok: true, changed: changes.length };
});
