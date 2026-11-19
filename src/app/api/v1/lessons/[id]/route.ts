import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { withPermission, HttpError, type StaffContext } from "@/lib/guard";
import { audit } from "@/lib/audit";
import { LessonFields, resolveSkills, assertWeekInTerm } from "@/lib/lessonSchema";

async function loadLesson(ctx: StaffContext, id: string) {
  const l = await prisma.lesson.findFirst({
    where: { id, unit: { term: { year: { schoolId: ctx.schoolId } } } },
    include: { unit: true, skills: { include: { skill: true } } },
  });
  if (!l) throw new HttpError(404, "NOT_FOUND", "الدرس غير موجود");
  return l;
}

const Patch = LessonFields.partial().extend({
  status: z.enum(["PLANNED", "DONE", "POSTPONED"]).optional(),
  unitId: z.string().optional(),
});

export const PATCH = withPermission<{ id: string }>("curriculum:write", async (req, ctx, { id }) => {
  const body = Patch.parse(await req.json());
  const before = await loadLesson(ctx, id);
  if (body.unitId && body.unitId !== before.unitId) {
    const u = await prisma.unit.findFirst({ where: { id: body.unitId, termId: before.unit.termId } });
    if (!u) throw new HttpError(400, "INVALID_UNIT", "الوحدة غير صالحة");
  }
  await assertWeekInTerm(body.weekId, before.unit.termId);
  const skillIds = body.skillCodes ? await resolveSkills(body.skillCodes) : null;

  await prisma.$transaction(async (tx) => {
    await tx.lesson.update({
      where: { id },
      data: {
        title: body.title,
        kind: body.kind,
        periods: body.periods,
        objectives: body.objectives,
        status: body.status,
        unitId: body.unitId,
        ...(body.weekId !== undefined ? { weekId: body.weekId } : {}),
      },
    });
    if (skillIds) {
      await tx.lessonSkill.deleteMany({ where: { lessonId: id } });
      await tx.lessonSkill.createMany({ data: skillIds.map((skillId) => ({ lessonId: id, skillId })) });
    }
  });
  await audit({
    actorId: ctx.id,
    action: body.status && body.status !== before.status ? "LESSON_STATUS" : "LESSON_UPDATED",
    entity: "Lesson",
    entityId: id,
    before: { title: before.title, status: before.status, weekId: before.weekId, kind: before.kind },
    after: body,
  });
  return { ok: true };
});

export const DELETE = withPermission<{ id: string }>("curriculum:write", async (_req, ctx, { id }) => {
  const l = await loadLesson(ctx, id);
  await prisma.lesson.delete({ where: { id } });
  await audit({ actorId: ctx.id, action: "LESSON_DELETED", entity: "Lesson", entityId: id, before: { title: l.title, weekId: l.weekId } });
  return { ok: true };
});
