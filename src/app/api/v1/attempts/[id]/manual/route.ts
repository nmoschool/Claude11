import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { withPermission, HttpError } from "@/lib/guard";
import { audit } from "@/lib/audit";
import { loadQuestions, scoreAndSync } from "@/lib/assessmentService";

const Body = z.object({ scores: z.record(z.string(), z.number().min(0)) });

/** تصحيح يدوي للأسئلة المفتوحة ثم نقل النتيجة لسجل الدرجات */
export const PUT = withPermission<{ id: string }>("grades:write", async (req, ctx, { id }) => {
  const { scores } = Body.parse(await req.json());
  const at = await prisma.attempt.findFirst({ where: { id }, include: { publication: true, version: true } });
  if (!at?.publication || !ctx.inScope(at.publication.classId)) throw new HttpError(404, "NOT_FOUND", "المحاولة غير موجودة");
  if (!at.submittedAt) throw new HttpError(409, "NOT_SUBMITTED", "لم تُسلَّم المحاولة بعد");
  const byId = await loadQuestions(at.version.questionIds);
  for (const [qid, s] of Object.entries(scores)) {
    const q = byId.get(qid);
    if (!q || q.type !== "OPEN") throw new HttpError(400, "INVALID_QUESTION", "سؤال غير صالح للتصحيح اليدوي");
    if (s > q.points) throw new HttpError(400, "INVALID_SCORE", `الدرجة أكبر من العظمى (${q.points})`);
  }
  const before = (at.manualScores as Record<string, number>) ?? {};
  await prisma.attempt.update({ where: { id }, data: { manualScores: { ...before, ...scores } } });
  const r = await scoreAndSync(id, ctx.id);
  await audit({ actorId: ctx.id, action: "ATTEMPT_MANUAL_GRADED", entity: "Student", entityId: at.studentId, before, after: { scores, final: r.final, synced: r.synced } });
  return { final: r.final, max: r.max, pendingManual: r.pendingManual, synced: r.synced };
});
