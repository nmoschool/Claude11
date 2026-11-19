import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { withPermission } from "@/lib/guard";
import { pickQuestions } from "@/lib/generator";

const Body = z.object({
  blueprint: z
    .array(z.object({ skillCode: z.string().nullable().optional(), type: z.string().nullable().optional(), difficulty: z.number().int().min(1).max(3).nullable().optional(), count: z.number().int().min(1).max(40) }))
    .min(1)
    .max(20),
  lessonIds: z.array(z.string()).max(100).default([]),
  seed: z.number().int().optional(),
});

/** تطبيق جدول المواصفات على البنك (لا يحفظ شيئاً) */
export const POST = withPermission("assessments:write", async (req, ctx) => {
  const b = Body.parse(await req.json());
  const pool = await prisma.question.findMany({
    where: {
      schoolId: ctx.schoolId,
      archived: false,
      status: "APPROVED",
    },
    include: { skill: true },
  });
  const inScope = b.lessonIds.length
    ? pool.filter((q) => (q.lessonId && b.lessonIds.includes(q.lessonId)) || (q.parentId && pool.some((p) => p.id === q.parentId && p.lessonId && b.lessonIds.includes(p.lessonId))))
    : pool;
  const seed = b.seed ?? Math.floor(Math.random() * 1e9);
  const r = pickQuestions(
    inScope.map((q) => ({ id: q.id, type: q.type, skillCode: q.skill?.code ?? null, difficulty: q.difficulty, points: Number(q.points), parentId: q.parentId, lessonId: q.lessonId })),
    b.blueprint,
    seed
  );
  return { ...r, seed, poolSize: inScope.length };
});
