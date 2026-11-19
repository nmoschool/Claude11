import { prisma } from "@/lib/prisma";
import { decryptOptional, hashNationalId } from "@/lib/crypto";
import { deleteFile } from "@/lib/storage";

/** كل بيانات الطالبة بصيغة مقروءة (حق الاطلاع — نظام حماية البيانات الشخصية) */
export async function exportStudent(id: string) {
  const s = await prisma.student.findUniqueOrThrow({
    where: { id },
    include: {
      class: true,
      attendance: { orderBy: { date: "asc" } },
      behavior: { orderBy: { date: "asc" } },
      notes: { orderBy: { createdAt: "asc" } },
      files: true,
      grades: { include: { item: { include: { component: true } } } },
      attempts: { include: { version: { include: { assessment: true } } } },
      badges: { include: { badge: true } },
      certificates: true,
    },
  });
  const games = await prisma.gameAttempt.groupBy({ by: ["gameCode"], where: { studentId: id }, _count: true, _sum: { points: true } });
  return {
    exportedAt: new Date().toISOString(),
    student: {
      fullName: s.fullName,
      displayName: s.displayName,
      class: `${s.class.grade}/${s.class.section}`,
      nationalId: decryptOptional(s.nationalIdEnc),
      birthDate: s.birthDate,
      guardianName: s.guardianName,
      guardianPhone: decryptOptional(s.guardianPhoneEnc),
      healthNotes: decryptOptional(s.healthNotesEnc),
      points: s.points,
      archived: s.archived,
      createdAt: s.createdAt,
    },
    attendance: s.attendance.map((a) => ({ date: a.date, status: a.status, note: a.note })),
    behavior: s.behavior.map((b) => ({ date: b.date, category: b.category, positive: b.positive, points: b.points, note: b.note })),
    notes: s.notes.map((n) => ({ createdAt: n.createdAt, kind: n.kind, body: n.body })),
    files: s.files.map((f) => ({ fileName: f.fileName, category: f.category, size: f.size, createdAt: f.createdAt })),
    grades: s.grades.map((g) => ({ item: g.item.title, component: g.item.component.title, max: Number(g.item.maxScore), score: g.score === null ? null : Number(g.score), status: g.status })),
    assessments: s.attempts.map((a) => ({ title: a.version.assessment.title, submittedAt: a.submittedAt, score: a.finalScore === null ? null : Number(a.finalScore) })),
    games: games.map((g) => ({ game: g.gameCode, attempts: g._count, points: g._sum.points ?? 0 })),
    badges: s.badges.map((b) => ({ title: b.badge.title, earnedAt: b.earnedAt })),
    certificates: s.certificates.map((c) => ({ title: c.title, issuedAt: c.issuedAt, verifyCode: c.verifyCode })),
  };
}

/** حذف نهائي (حق المحو): الملفات من التخزين ثم السجل وكل ما يتبعه (cascade) */
export async function eraseStudent(id: string) {
  const s = await prisma.student.findUniqueOrThrow({ where: { id }, include: { files: true } });
  for (const f of s.files) await deleteFile(f.storageKey).catch(() => {});
  await prisma.student.delete({ where: { id } });
  // أثر في التدقيق دون بيانات شخصية: بصمة غير قابلة للعكس فقط
  return { fingerprint: hashNationalId(`erased:${id}`).slice(0, 16), files: s.files.length };
}
