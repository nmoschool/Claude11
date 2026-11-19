import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { withPermission, HttpError } from "@/lib/guard";
import { audit } from "@/lib/audit";
import { loadTerm } from "@/lib/planService";
import { versionOrder, VERSION_LABELS } from "@/lib/generator";
import { KIND_LABELS } from "@/lib/assessmentService";

export const GET = withPermission("assessments:read", async (req, ctx) => {
  const term = new URL(req.url).searchParams.get("term");
  const list = await prisma.assessment.findMany({
    where: { term: { year: { schoolId: ctx.schoolId } }, ...(term ? { termId: term } : {}), kind: { not: "GAME_SET" } },
    include: { versions: { select: { id: true, label: true, questionIds: true } }, publications: { include: { _count: { select: { attempts: true } } } } },
    orderBy: { createdAt: "desc" },
  });
  const visible = list.map((a) => ({ ...a, publications: a.publications.filter((p) => ctx.inScope(p.classId)) }));
  return {
    assessments: visible.map((a) => ({
      id: a.id,
      kind: a.kind,
      kindLabel: KIND_LABELS[a.kind],
      title: a.title,
      termId: a.termId,
      createdAt: a.createdAt,
      versions: a.versions.map((v) => v.label),
      questionCount: a.versions[0]?.questionIds.length ?? 0,
      publications: a.publications.map((p) => ({ id: p.id, classId: p.classId, mode: p.mode, opensAt: p.opensAt, closesAt: p.closesAt, attempts: p._count.attempts })),
    })),
  };
});

const Body = z.object({
  kind: z.enum(["WORKSHEET", "QUIZ", "MIDTERM", "FINAL"]),
  title: z.string().trim().min(3).max(150),
  termId: z.string(),
  durationMin: z.number().int().min(5).max(240).nullable().optional(),
  instructions: z.string().trim().max(1000).nullable().optional(),
  questionIds: z.array(z.string()).min(1).max(120),
  versions: z.number().int().min(1).max(3).default(1),
  blueprint: z.unknown().optional(),
});

/** إنشاء اختبار من قائمة أسئلة مرتبة (ناتج المولّد بعد تعديل المعلمة) مع 1–3 نماذج */
export const POST = withPermission("assessments:write", async (req, ctx) => {
  const b = Body.parse(await req.json());
  await loadTerm(ctx, b.termId);
  const qs = await prisma.question.findMany({ where: { id: { in: b.questionIds }, schoolId: ctx.schoolId, archived: false } });
  if (qs.length !== new Set(b.questionIds).size) throw new HttpError(400, "INVALID_QUESTIONS", "سؤال غير موجود أو مؤرشف");
  // أسئلة النص الفرعية تتبع نصها: نضيف النص إن غاب ونجمعها بعده
  const parentOf = Object.fromEntries(qs.map((q) => [q.id, q.parentId]));
  const missingParents = qs.filter((q) => q.parentId && !b.questionIds.includes(q.parentId)).map((q) => q.parentId!);
  if (missingParents.length) throw new HttpError(400, "MISSING_PASSAGE", "أضيفي النص القرائي مع أسئلته");
  if (qs.some((q) => q.status === "DRAFT")) throw new HttpError(400, "DRAFT_QUESTIONS", "يوجد أسئلة مسودة؛ اعتمديها في البنك أولاً");
  const ordered: string[] = [];
  for (const id of b.questionIds) {
    if (parentOf[id]) continue;
    ordered.push(id, ...b.questionIds.filter((c) => parentOf[c] === id));
  }
  const baseSeed = Math.floor(Math.random() * 2 ** 31);
  const a = await prisma.assessment.create({
    data: {
      kind: b.kind,
      title: b.title,
      termId: b.termId,
      durationMin: b.durationMin ?? null,
      instructions: b.instructions ?? null,
      blueprint: (b.blueprint ?? undefined) as object | undefined,
      createdBy: ctx.id,
      versions: {
        create: Array.from({ length: b.versions }, (_, i) => ({
          label: VERSION_LABELS[i],
          shuffleSeed: baseSeed + i * 104729,
          questionIds: versionOrder(ordered, parentOf, baseSeed, i),
        })),
      },
    },
  });
  await audit({ actorId: ctx.id, action: "ASSESSMENT_CREATED", entity: "Assessment", entityId: a.id, after: { title: b.title, kind: b.kind, questions: ordered.length, versions: b.versions } });
  return { id: a.id };
});
