import { prisma } from "@/lib/prisma";
import { HttpError, type StaffContext } from "@/lib/guard";
import { renderVersion, type StoredQuestion } from "@/lib/renderVersion";
import { gradeAttempt } from "@/lib/autoGrade";
import { round2 } from "@/lib/gradeCalc";
import { versionForStudent } from "@/lib/generator";
import { audit } from "@/lib/audit";
import { ensureScheme, getLock } from "@/lib/gradebookService";
import type { QType } from "@/lib/questionTypes";

export const KIND_LABELS = { WORKSHEET: "ورقة عمل", QUIZ: "اختبار قصير", MIDTERM: "اختبار فتري", FINAL: "اختبار نهائي", GAME_SET: "مجموعة ألعاب" } as const;
/** المكوّن في سجل الدرجات الذي تُنقل إليه نتيجة كل نوع */
const COMPONENT_FOR_KIND: Record<string, string> = { WORKSHEET: "HOMEWORK", QUIZ: "QUIZ", MIDTERM: "MIDTERM", FINAL: "FINAL" };

export async function loadQuestions(ids: string[]): Promise<Map<string, StoredQuestion>> {
  const qs = await prisma.question.findMany({ where: { id: { in: ids } }, include: { skill: true } });
  return new Map(
    qs.map((q) => [
      q.id,
      { id: q.id, type: q.type as QType, stem: q.stem, payload: q.payload, answerKey: q.answerKey, points: Number(q.points), parentId: q.parentId, skillCode: q.skill?.code ?? null, mediaUrl: q.mediaUrl },
    ])
  );
}

export async function loadAssessment(ctx: StaffContext, id: string) {
  const a = await prisma.assessment.findFirst({
    where: { id, term: { year: { schoolId: ctx.schoolId } } },
    include: { versions: { orderBy: { label: "asc" } }, publications: true, term: true },
  });
  if (!a) throw new HttpError(404, "NOT_FOUND", "الاختبار غير موجود");
  return a;
}

export function totalPoints(ids: string[], byId: Map<string, StoredQuestion>) {
  return round2(ids.reduce((s, id) => s + (byId.get(id)?.type === "READING_PASSAGE" ? 0 : byId.get(id)?.points ?? 0), 0));
}

export async function versionView(versionId: string, forStudent: boolean) {
  const v = await prisma.assessmentVersion.findUnique({ where: { id: versionId }, include: { assessment: true } });
  if (!v) throw new HttpError(404, "NOT_FOUND", "النموذج غير موجود");
  const byId = await loadQuestions(v.questionIds);
  return { version: v, byId, questions: renderVersion(v.questionIds, v.shuffleSeed, byId, forStudent), total: totalPoints(v.questionIds, byId) };
}

/** نشر لفصل: يُنشأ عمود في سجل الدرجات (عظمى = مجموع النقاط) لتنتقل إليه النتائج */
export async function publish(ctx: StaffContext, assessmentId: string, classId: string, opts: { opensAt: Date; closesAt: Date | null; mode: "ONLINE" | "PAPER"; toGradebook: boolean }) {
  const a = await loadAssessment(ctx, assessmentId);
  if (!a.versions.length) throw new HttpError(400, "NO_VERSIONS", "لا توجد نماذج");
  if (a.publications.some((p) => p.classId === classId)) throw new HttpError(409, "ALREADY_PUBLISHED", "منشور لهذا الفصل مسبقاً");
  const byId = await loadQuestions(a.versions[0].questionIds);
  const total = totalPoints(a.versions[0].questionIds, byId);

  let gradeItemId: string | null = null;
  if (opts.toGradebook && COMPONENT_FOR_KIND[a.kind]) {
    if (await getLock(classId, a.termId)) throw new HttpError(409, "LOCKED", "درجات الفصل معتمدة؛ فكّي الاعتماد أو انشري دون ربط بالسجل");
    const scheme = await ensureScheme(a.termId);
    const comp = scheme.components.find((c) => c.kind === COMPONENT_FOR_KIND[a.kind]) ?? scheme.components[0];
    const skillIds = Array.from(new Set([...byId.values()].map((q) => q.skillCode).filter(Boolean))) as string[];
    const skills = await prisma.skill.findMany({ where: { code: { in: skillIds } } });
    const item = await prisma.gradeItem.create({
      data: { classId, termId: a.termId, componentId: comp.id, title: a.title, maxScore: total, date: opts.opensAt, assessmentId: a.id, skillIds: skills.map((s) => s.id), createdBy: ctx.id },
    });
    gradeItemId = item.id;
  }
  const pub = await prisma.assessmentPublication.create({
    data: { assessmentId, classId, gradeItemId, mode: opts.mode, opensAt: opts.opensAt, closesAt: opts.closesAt, createdBy: ctx.id },
  });
  if (!a.publishedAt) await prisma.assessment.update({ where: { id: a.id }, data: { publishedAt: new Date() } });
  await audit({ actorId: ctx.id, action: "ASSESSMENT_PUBLISHED", entity: "SchoolClass", entityId: classId, after: { assessmentId, publicationId: pub.id, mode: opts.mode, gradeItemId } });
  return pub;
}

/** النموذج المخصص لطالبة: بالتناوب حسب ترتيبها الأبجدي في الفصل */
export async function versionForStudentIn(publicationId: string, studentId: string) {
  const pub = await prisma.assessmentPublication.findUniqueOrThrow({ where: { id: publicationId }, include: { assessment: { include: { versions: { orderBy: { label: "asc" } } } } } });
  const students = await prisma.student.findMany({ where: { classId: pub.classId, archived: false }, orderBy: { fullName: "asc" }, select: { id: true } });
  const idx = Math.max(0, students.findIndex((s) => s.id === studentId));
  return pub.assessment.versions[versionForStudent(idx, pub.assessment.versions.length)];
}

export function deadlineOf(attempt: { startedAt: Date }, pub: { closesAt: Date | null }, durationMin: number | null): Date | null {
  const byDuration = durationMin ? new Date(attempt.startedAt.getTime() + durationMin * 60_000) : null;
  if (byDuration && pub.closesAt) return byDuration < pub.closesAt ? byDuration : pub.closesAt;
  return byDuration ?? pub.closesAt;
}

/**
 * يصحح المحاولة ويحدّث سجل الدرجات إن اكتمل التصحيح (لا أسئلة يدوية معلّقة).
 * إن كانت الدرجات معتمدة: لا يكتب في السجل (يلزم سبب من المعلمة) ويعيد synced=false.
 */
export async function scoreAndSync(attemptId: string, actorId: string | null) {
  const at = await prisma.attempt.findUniqueOrThrow({ where: { id: attemptId }, include: { version: true, publication: true } });
  const byId = await loadQuestions(at.version.questionIds);
  const qs = at.version.questionIds.map((id) => byId.get(id)!).filter(Boolean);
  const r = gradeAttempt(qs, (at.answers as Record<string, unknown>) ?? {}, (at.manualScores as Record<string, number>) ?? {});
  const perSkill = Object.fromEntries(Object.entries(r.perSkill).map(([k, v]) => [k, v.max ? round2((v.got / v.max) * 100) : 0]));
  const final = r.pendingManual ? null : r.auto;
  await prisma.attempt.update({ where: { id: attemptId }, data: { autoScore: r.auto, finalScore: final, perSkill, gradedBy: actorId ?? undefined } });

  let synced = false;
  const pub = at.publication;
  if (final !== null && pub?.gradeItemId) {
    const item = await prisma.gradeItem.findUnique({ where: { id: pub.gradeItemId } });
    if (item && !(await getLock(item.classId, item.termId))) {
      const scaled = round2((final / (r.max || 1)) * Number(item.maxScore));
      await prisma.gradeEntry.upsert({
        where: { itemId_studentId: { itemId: item.id, studentId: at.studentId } },
        create: { itemId: item.id, studentId: at.studentId, score: scaled, status: "NORMAL", source: "AUTO", updatedBy: actorId ?? "system" },
        update: { score: scaled, status: "NORMAL", source: "AUTO", updatedBy: actorId ?? "system" },
      });
      synced = true;
    }
  }
  return { ...r, final, synced };
}

/** إن انتهى الوقت ولم تُسلَّم: تُسلَّم آلياً بما حُفظ */
export async function finalizeIfExpired(attemptId: string) {
  const at = await prisma.attempt.findUnique({ where: { id: attemptId }, include: { publication: { include: { assessment: true } } } });
  if (!at || at.submittedAt || !at.publication) return false;
  const dl = deadlineOf(at, at.publication, at.publication.assessment.durationMin);
  if (dl && Date.now() > dl.getTime() + 60_000) {
    await prisma.attempt.update({ where: { id: attemptId }, data: { submittedAt: dl } });
    await scoreAndSync(attemptId, null);
    return true;
  }
  return false;
}
