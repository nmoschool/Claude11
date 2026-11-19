import { prisma } from "@/lib/prisma";
import { withPermission, HttpError } from "@/lib/guard";
import { audit } from "@/lib/audit";
import { LessonFields, resolveSkills, assertWeekInTerm } from "@/lib/lessonSchema";

export const POST = withPermission<{ id: string }>("curriculum:write", async (req, ctx, { id }) => {
  const body = LessonFields.parse(await req.json());
  const unit = await prisma.unit.findFirst({ where: { id, term: { year: { schoolId: ctx.schoolId } } } });
  if (!unit) throw new HttpError(404, "NOT_FOUND", "الوحدة غير موجودة");
  await assertWeekInTerm(body.weekId, unit.termId);
  const skillIds = await resolveSkills(body.skillCodes);
  const max = await prisma.lesson.aggregate({ where: { unitId: id }, _max: { order: true } });
  const lesson = await prisma.lesson.create({
    data: {
      unitId: id,
      order: (max._max.order ?? 0) + 1,
      title: body.title,
      kind: body.kind,
      periods: body.periods,
      objectives: body.objectives,
      weekId: body.weekId ?? null,
      skills: { create: skillIds.map((skillId) => ({ skillId })) },
    },
  });
  await audit({ actorId: ctx.id, action: "LESSON_CREATED", entity: "Lesson", entityId: lesson.id, after: body });
  return { id: lesson.id };
});
