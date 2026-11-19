import { prisma } from "@/lib/prisma";
import { withPermission, HttpError } from "@/lib/guard";
import { audit } from "@/lib/audit";
import { getLock, loadItem } from "@/lib/gradebookService";
import { GradeItemFields } from "@/lib/gradeItemSchema";
import { resolveSkills } from "@/lib/lessonSchema";
import { parseDay } from "@/lib/dates";

export const PATCH = withPermission<{ id: string }>("grades:write", async (req, ctx, { id }) => {
  const it = await loadItem(ctx, id);
  if (await getLock(it.classId, it.termId)) throw new HttpError(409, "LOCKED", "درجات هذا الفصل معتمدة");
  const body = GradeItemFields.partial().omit({ componentId: true }).parse(await req.json());
  if (body.maxScore !== undefined) {
    const over = await prisma.gradeEntry.count({ where: { itemId: id, score: { gt: body.maxScore } } });
    if (over) throw new HttpError(409, "SCORES_EXCEED", `${over} درجة مرصودة أكبر من العظمى الجديدة`);
  }
  await prisma.gradeItem.update({
    where: { id },
    data: {
      title: body.title,
      maxScore: body.maxScore,
      date: body.date ? parseDay(body.date) : undefined,
      skillIds: body.skillCodes ? await resolveSkills(body.skillCodes) : undefined,
    },
  });
  await audit({ actorId: ctx.id, action: "GRADE_ITEM_UPDATED", entity: "SchoolClass", entityId: it.classId, before: { itemId: id, title: it.title, maxScore: Number(it.maxScore) }, after: body });
  return { ok: true };
});

export const DELETE = withPermission<{ id: string }>("grades:write", async (req, ctx, { id }) => {
  const it = await loadItem(ctx, id);
  if (await getLock(it.classId, it.termId)) throw new HttpError(409, "LOCKED", "درجات هذا الفصل معتمدة");
  const n = await prisma.gradeEntry.count({ where: { itemId: id, OR: [{ score: { not: null } }, { status: { not: "NORMAL" } }] } });
  const confirm = new URL(req.url).searchParams.get("confirm") === "1";
  if (n && !confirm) throw new HttpError(409, "HAS_ENTRIES", `يحتوي التقييم على ${n} درجة مرصودة؛ أكّدي الحذف`);
  await prisma.gradeItem.delete({ where: { id } });
  await audit({ actorId: ctx.id, action: "GRADE_ITEM_DELETED", entity: "SchoolClass", entityId: it.classId, before: { itemId: id, title: it.title, entries: n } });
  return { ok: true };
});

