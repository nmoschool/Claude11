import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { withPermission } from "@/lib/guard";
import { audit } from "@/lib/audit";
import { QuestionInput, questionData } from "@/lib/questionService";
import { QTYPES } from "@/lib/questionTypes";

export const GET = withPermission("assessments:read", async (req, ctx) => {
  const sp = new URL(req.url).searchParams;
  const type = sp.get("type");
  const q = sp.get("q")?.trim();
  const ids = sp.get("ids")?.split(",").filter(Boolean).slice(0, 150);
  const where = ids?.length ? { schoolId: ctx.schoolId, id: { in: ids } } : {
    schoolId: ctx.schoolId,
    archived: sp.get("archived") === "1",
    parentId: sp.get("parent") ?? null,
    ...(type && (QTYPES as string[]).includes(type) ? { type: type as any } : {}),
    ...(sp.get("skill") ? { skill: { code: sp.get("skill")! } } : {}),
    ...(sp.get("lesson") ? { lessonId: sp.get("lesson")! } : {}),
    ...(sp.get("difficulty") ? { difficulty: Number(sp.get("difficulty")) } : {}),
    ...(sp.get("status") === "DRAFT" ? { status: "DRAFT" as const } : sp.get("status") === "APPROVED" ? { status: "APPROVED" as const } : {}),
    ...(q ? { stem: { contains: q, mode: "insensitive" as const } } : {}),
  };
  const page = Math.max(1, Number(sp.get("page") ?? 1));
  const [total, rows] = await Promise.all([
    prisma.question.count({ where }),
    prisma.question.findMany({
      where,
      include: { skill: true, lesson: { select: { title: true } } },
      orderBy: { createdAt: "desc" },
      skip: ids?.length ? 0 : (page - 1) * 50,
      take: ids?.length ? 150 : 50,
    }),
  ]);
  const children = await prisma.question.groupBy({ by: ["parentId"], where: { parentId: { in: rows.map((r) => r.id) }, archived: false }, _count: true });
  return {
    total,
    page,
    questions: rows.map((r) => ({
      id: r.id,
      type: r.type,
      stem: r.stem,
      payload: r.payload,
      answerKey: r.answerKey,
      points: Number(r.points),
      difficulty: r.difficulty,
      bloom: r.bloom,
      status: r.status,
      skillCode: r.skill?.code ?? null,
      skillTitle: r.skill?.title ?? null,
      lessonId: r.lessonId,
      lessonTitle: r.lesson?.title ?? null,
      parentId: r.parentId,
      childCount: children.find((c) => c.parentId === r.id)?._count ?? 0,
    })),
  };
});

const Bulk = z.object({ questions: z.array(QuestionInput).min(1).max(50) });

/** سؤال واحد أو دفعة (مسودات المولّد القواعدي) */
export const POST = withPermission("assessments:write", async (req, ctx) => {
  const raw = await req.json();
  const list = "questions" in raw ? Bulk.parse(raw).questions : [QuestionInput.parse(raw)];
  const data = [];
  for (const q of list) data.push(await questionData(ctx, q));
  const created = await prisma.$transaction(data.map((d) => prisma.question.create({ data: { ...d, schoolId: ctx.schoolId, createdBy: ctx.id } })));
  await audit({ actorId: ctx.id, action: "QUESTIONS_CREATED", entity: "Question", entityId: created[0].id, after: { count: created.length, types: data.map((d) => d.type) } });
  return { ids: created.map((c) => c.id) };
});
