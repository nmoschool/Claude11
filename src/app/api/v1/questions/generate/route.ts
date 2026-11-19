import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { withPermission } from "@/lib/guard";
import { generateDrafts, GENERATOR_KINDS, type GeneratorKind } from "@/lib/vocabGenerators";

const Body = z.object({
  kind: z.enum(Object.keys(GENERATOR_KINDS) as [GeneratorKind, ...GeneratorKind[]]),
  lessonIds: z.array(z.string()).max(50).default([]),
  count: z.number().int().min(1).max(20).default(5),
  seed: z.number().int().optional(),
});

/** مسودات من قاموس المفردات — لا تُحفظ حتى توافق المعلمة */
export const POST = withPermission("assessments:write", async (req, ctx) => {
  const b = Body.parse(await req.json());
  const vocab = await prisma.vocabItem.findMany({
    where: { lesson: { unit: { term: { year: { schoolId: ctx.schoolId } } } }, ...(b.lessonIds.length ? { lessonId: { in: b.lessonIds } } : {}) },
  });
  const drafts = generateDrafts(b.kind, vocab, b.count, b.seed ?? Date.now() % 100000);
  return { drafts, vocabCount: vocab.length };
});
