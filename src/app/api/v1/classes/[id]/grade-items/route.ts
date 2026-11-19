import { prisma } from "@/lib/prisma";
import { withPermission, HttpError } from "@/lib/guard";
import { audit } from "@/lib/audit";
import { loadClassInScope } from "@/lib/calendarService";
import { getLock } from "@/lib/gradebookService";
import { GradeItemFields } from "@/lib/gradeItemSchema";
import { resolveSkills } from "@/lib/lessonSchema";
import { parseDay } from "@/lib/dates";

export const POST = withPermission<{ id: string }>("grades:write", async (req, ctx, { id }) => {
  await loadClassInScope(ctx, id);
  const body = GradeItemFields.parse(await req.json());
  const comp = await prisma.schemeComponent.findFirst({
    where: { id: body.componentId, scheme: { term: { year: { schoolId: ctx.schoolId } } } },
    include: { scheme: true },
  });
  if (!comp) throw new HttpError(400, "INVALID_COMPONENT", "المكوّن غير صالح");
  const termId = comp.scheme.termId;
  if (await getLock(id, termId)) throw new HttpError(409, "LOCKED", "درجات هذا الفصل معتمدة؛ لا يمكن إضافة تقييمات");
  const skillIds = await resolveSkills(body.skillCodes);
  const item = await prisma.gradeItem.create({
    data: { classId: id, termId, componentId: comp.id, title: body.title, maxScore: body.maxScore, date: parseDay(body.date), skillIds, createdBy: ctx.id },
  });
  await audit({ actorId: ctx.id, action: "GRADE_ITEM_CREATED", entity: "SchoolClass", entityId: id, after: { itemId: item.id, title: body.title, maxScore: body.maxScore } });
  return { id: item.id };
});
