import { prisma } from "@/lib/prisma";
import { HttpError } from "@/lib/guard";
import { withStudent } from "@/lib/studentGuard";
import { deadlineOf, versionForStudentIn, versionView } from "@/lib/assessmentService";

/** بدء/استئناف المحاولة: يعيد أسئلة نموذج الطالبة بلا مفتاح إجابة + الإجابات المحفوظة + الموعد النهائي */
export const POST = withStudent<{ id: string }>(async (_req, student, { id }) => {
  const pub = await prisma.assessmentPublication.findFirst({ where: { id, classId: student.classId, mode: "ONLINE" }, include: { assessment: true } });
  if (!pub) throw new HttpError(404, "NOT_FOUND", "الاختبار غير متاح");
  const now = new Date();
  if (pub.opensAt > now) throw new HttpError(403, "NOT_OPEN", "لم يبدأ الاختبار بعد");
  let at = await prisma.attempt.findUnique({ where: { publicationId_studentId: { publicationId: id, studentId: student.id } } });
  if (at?.submittedAt) throw new HttpError(409, "SUBMITTED", "سلّمتِ هذا الاختبار من قبل 🌟");
  if (!at) {
    if (pub.closesAt && pub.closesAt < now) throw new HttpError(403, "CLOSED", "انتهى وقت الاختبار");
    const v = await versionForStudentIn(id, student.id);
    at = await prisma.attempt.create({ data: { publicationId: id, versionId: v.id, studentId: student.id, answers: {} } });
  }
  const view = await versionView(at.versionId, true);
  const deadline = deadlineOf(at, pub, pub.assessment.durationMin);
  return {
    attemptId: at.id,
    title: pub.assessment.title,
    instructions: pub.assessment.instructions,
    deadline,
    serverNow: now,
    total: view.total,
    questions: view.questions,
    answers: at.answers ?? {},
  };
});
