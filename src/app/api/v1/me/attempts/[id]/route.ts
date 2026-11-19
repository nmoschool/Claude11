import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { HttpError } from "@/lib/guard";
import { withStudent } from "@/lib/studentGuard";
import { deadlineOf } from "@/lib/assessmentService";

const Body = z.object({ answers: z.record(z.string(), z.unknown()) });

/** حفظ تلقائي للإجابات (حتى الموعد النهائي + دقيقة سماح) */
export const PUT = withStudent<{ id: string }>(async (req, student, { id }) => {
  const { answers } = Body.parse(await req.json());
  if (JSON.stringify(answers).length > 50_000) throw new HttpError(413, "TOO_LARGE", "الإجابات أطول من المسموح");
  const at = await prisma.attempt.findFirst({ where: { id, studentId: student.id }, include: { publication: { include: { assessment: true } }, version: true } });
  if (!at?.publication) throw new HttpError(404, "NOT_FOUND", "المحاولة غير موجودة");
  if (at.submittedAt) throw new HttpError(409, "SUBMITTED", "تم التسليم");
  const dl = deadlineOf(at, at.publication, at.publication.assessment.durationMin);
  if (dl && Date.now() > dl.getTime() + 60_000) throw new HttpError(409, "EXPIRED", "انتهى الوقت");
  const allowed = new Set(at.version.questionIds);
  const clean = Object.fromEntries(Object.entries(answers).filter(([k]) => allowed.has(k)));
  await prisma.attempt.update({ where: { id }, data: { answers: { ...((at.answers as object) ?? {}), ...clean } as object } });
  return { ok: true, savedAt: new Date() };
});
