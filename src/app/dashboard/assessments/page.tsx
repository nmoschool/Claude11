import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireStaffPage } from "@/lib/guard";
import { KIND_LABELS } from "@/lib/assessmentService";
import { classLabel } from "@/lib/classes";
import { formatHijri } from "@/lib/dates";

export default async function AssessmentsPage() {
  const ctx = await requireStaffPage("assessments:read");
  const [list, classes, bankCount] = await Promise.all([
    prisma.assessment.findMany({
      where: { term: { year: { schoolId: ctx.schoolId } }, kind: { not: "GAME_SET" } },
      include: { versions: { select: { label: true, questionIds: true } }, publications: { include: { _count: { select: { attempts: { where: { submittedAt: { not: null } } } } } } }, term: true },
      orderBy: { createdAt: "desc" },
    }),
    prisma.schoolClass.findMany({ where: ctx.classWhere() }),
    prisma.question.count({ where: { schoolId: ctx.schoolId, archived: false, parentId: null } }),
  ]);
  const label = (id: string) => { const c = classes.find((x) => x.id === id); return c ? classLabel(c) : null; };
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-black">أوراق العمل والاختبارات</h1>
        <div className="flex gap-2">
          <Link className="btn-secondary" href="/dashboard/assessments/bank">📚 بنك الأسئلة ({bankCount})</Link>
          {ctx.can("assessments:write") && <Link className="btn-primary" href="/dashboard/assessments/new">＋ اختبار / ورقة عمل</Link>}
        </div>
      </div>
      <div className="card overflow-x-auto">
        <table className="table">
          <thead><tr><th>العنوان</th><th>النوع</th><th>الأسئلة</th><th>النماذج</th><th>النشر</th><th>أُنشئ</th></tr></thead>
          <tbody>
            {list.map((a) => (
              <tr key={a.id}>
                <td className="font-bold"><Link className="hover:text-brand-700 hover:underline" href={`/dashboard/assessments/${a.id}`}>{a.title}</Link><div className="text-xs font-normal text-gray-400">{a.term.title}</div></td>
                <td>{KIND_LABELS[a.kind]}</td>
                <td>{a.versions[0]?.questionIds.length ?? 0}</td>
                <td>{a.versions.map((v) => v.label).join("، ")}</td>
                <td className="text-xs">
                  {a.publications.filter((p) => ctx.inScope(p.classId)).map((p) => (
                    <Link key={p.id} href={`/dashboard/assessments/results/${p.id}`} className="ml-2 inline-block rounded bg-brand-50 px-2 py-0.5 text-brand-700 hover:bg-brand-100">
                      {label(p.classId)} · {p.mode === "ONLINE" ? "💻" : "📄"} {p._count.attempts} سلّمت
                    </Link>
                  ))}
                  {!a.publications.length && <span className="text-gray-400">غير منشور</span>}
                </td>
                <td className="text-xs text-gray-500">{formatHijri(a.createdAt)}</td>
              </tr>
            ))}
            {!list.length && <tr><td colSpan={6} className="py-8 text-center text-gray-400">لا توجد اختبارات بعد.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
