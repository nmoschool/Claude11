import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireStudentPage } from "@/lib/guard";
import { KIND_LABELS } from "@/lib/assessmentService";
import { formatHijri } from "@/lib/dates";

export default async function StudentAssessments() {
  const s = await requireStudentPage();
  const now = new Date();
  const pubs = await prisma.assessmentPublication.findMany({
    where: { classId: s.classId, mode: "ONLINE", opensAt: { lte: now } },
    include: { assessment: true, attempts: { where: { studentId: s.id } } },
    orderBy: { opensAt: "desc" },
  });
  return (
    <div className="min-h-screen bg-gradient-to-b from-accent-50 via-brand-50 to-mint-50 px-4 py-8">
      <div className="mx-auto max-w-3xl space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-black text-brand-800">📒 واجباتي واختباراتي</h1>
          <Link href="/student" className="rounded-2xl bg-white px-4 py-2 font-bold shadow">→ الرئيسية</Link>
        </div>
        {pubs.map((p) => {
          const at = p.attempts[0];
          const closed = !!p.closesAt && p.closesAt < now;
          const done = !!at?.submittedAt;
          return (
            <div key={p.id} className="flex items-center gap-4 rounded-3xl bg-white p-5 shadow">
              <span className="text-5xl">{done ? "✅" : closed ? "🔒" : "📝"}</span>
              <div className="flex-1">
                <div className="text-xl font-black">{p.assessment.title}</div>
                <div className="text-gray-500">{KIND_LABELS[p.assessment.kind]}{p.assessment.durationMin && ` · ${p.assessment.durationMin} دقيقة`}{p.closesAt && !done && ` · حتى ${formatHijri(p.closesAt)}`}</div>
                {done && at.finalScore !== null && <div className="mt-1 font-bold text-mint-700">درجتي: {Number(at.finalScore)} 🌟</div>}
                {done && at.finalScore === null && <div className="mt-1 text-amber-700">سلّمتِ — تصحّح المعلمة بعض الأسئلة</div>}
              </div>
              {!done && !closed && <Link href={`/student/assessments/${p.id}`} className="rounded-2xl bg-brand-600 px-6 py-4 text-xl font-black text-white shadow">{at ? "أكملي" : "ابدئي"} ←</Link>}
            </div>
          );
        })}
        {!pubs.length && <p className="rounded-3xl bg-white p-10 text-center text-xl text-gray-500 shadow">لا توجد واجبات الآن 🌈</p>}
      </div>
    </div>
  );
}
