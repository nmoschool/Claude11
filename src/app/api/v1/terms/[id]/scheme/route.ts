import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { withPermission, HttpError } from "@/lib/guard";
import { audit } from "@/lib/audit";
import { loadTerm } from "@/lib/planService";
import { schemeView, ensureScheme } from "@/lib/gradebookService";
import { validateWeights } from "@/lib/gradeCalc";

export const GET = withPermission<{ id: string }>("grades:read", async (_req, ctx, { id }) => {
  await loadTerm(ctx, id);
  return schemeView(id);
});

const Body = z.object({
  components: z
    .array(
      z.object({
        id: z.string().optional(),
        kind: z.enum(["PARTICIPATION", "HOMEWORK", "PERFORMANCE", "QUIZ", "MIDTERM", "FINAL", "CUSTOM"]),
        title: z.string().trim().min(2).max(80),
        weight: z.number().positive().max(100),
      })
    )
    .min(1)
    .max(12),
  gradeScale: z
    .array(z.object({ min: z.number().min(0).max(100), label: z.string().trim().min(1).max(40) }))
    .min(2)
    .max(10)
    .refine((s) => s.some((b) => b.min === 0), "يجب أن يبدأ السلم من صفر")
    .refine((s) => new Set(s.map((b) => b.min)).size === s.length, "حدود السلم مكررة"),
  absentAsZero: z.boolean(),
});

/**
 * مخطط التقييم مشترك لكل فصول المدرسة في هذا الفصل الدراسي.
 * يُجمَّد بعد اعتماد درجات أي فصل، ولا يُحذف مكوّن عليه تقييمات.
 */
export const PUT = withPermission<{ id: string }>("grades:write", async (req, ctx, { id }) => {
  await loadTerm(ctx, id);
  const body = Body.parse(await req.json());
  const err = validateWeights(body.components.map((c) => c.weight));
  if (err) throw new HttpError(400, "INVALID_WEIGHTS", err);

  const before = await schemeView(id);
  if (before.weightsFrozen) throw new HttpError(409, "FROZEN", "لا يمكن تعديل الأوزان بعد اعتماد درجات أحد الفصول");
  const scheme = await ensureScheme(id);

  const keepIds = body.components.filter((c) => c.id).map((c) => c.id!);
  const unknown = keepIds.filter((k) => !scheme.components.some((c) => c.id === k));
  if (unknown.length) throw new HttpError(400, "INVALID_COMPONENT", "مكوّن غير صالح");
  const removed = scheme.components.filter((c) => !keepIds.includes(c.id));
  if (removed.length) {
    const used = await prisma.gradeItem.count({ where: { componentId: { in: removed.map((c) => c.id) } } });
    if (used) throw new HttpError(409, "IN_USE", "لا يمكن حذف مكوّن مرتبط بتقييمات مرصودة؛ احذفي تقييماته أولاً");
  }

  await prisma.$transaction([
    prisma.schemeComponent.deleteMany({ where: { id: { in: removed.map((c) => c.id) } } }),
    ...body.components.map((c, i) =>
      c.id
        ? prisma.schemeComponent.update({ where: { id: c.id }, data: { kind: c.kind, title: c.title, weight: c.weight, order: i + 1 } })
        : prisma.schemeComponent.create({ data: { schemeId: scheme.id, kind: c.kind, title: c.title, weight: c.weight, order: i + 1 } })
    ),
    prisma.assessmentScheme.update({ where: { id: scheme.id }, data: { gradeScale: body.gradeScale, absentAsZero: body.absentAsZero } }),
  ]);
  await audit({
    actorId: ctx.id,
    action: "SCHEME_UPDATED",
    entity: "Term",
    entityId: id,
    before: { components: before.components.map(({ title, weight }) => ({ title, weight })), gradeScale: before.gradeScale, absentAsZero: before.absentAsZero },
    after: body,
  });
  return schemeView(id);
});
