import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireStaffPage, HttpError } from "@/lib/guard";
import { loadAssessment, versionView, KIND_LABELS } from "@/lib/assessmentService";
import { listClasses, classLabel } from "@/lib/classes";
import { formatHijri } from "@/lib/dates";
import AssessmentActions from "@/components/AssessmentActions";
import QuestionCard from "@/components/QuestionCard";

export default async function AssessmentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await requireStaffPage("assessments:read");
  let a;
  try {
    a = await loadAssessment(ctx, id);
  } catch (e) {
    if (e instanceof HttpError) notFound();
    throw e;
  }
  const v = a.versions[0] ? await versionView(a.versions[0].id, false) : null;
  const classes = await listClasses(ctx);
  const pubClasses = await prisma.schoolClass.findMany({ where: { id: { in: a.publications.map((p) => p.classId) } } });
  const pubs = a.publications.filter((p) => ctx.inScope(p.classId));

  return (
    <div className="space-y-5">
      <div>
        <div className="text-sm text-gray-400"><Link href="/dashboard/assessments" className="hover:text-gray-600">الاختبارات</Link> ←</div>
        <h1 className="text-2xl font-black">{a.title}</h1>
        <p className="text-sm text-gray-500">{KIND_LABELS[a.kind]} · {a.term.title} · {v?.questions.filter((q) => q.number).length ?? 0} سؤال · {v?.total ?? 0} درجة{a.durationMin && ` · ${a.durationMin} دقيقة`} · النماذج: {a.versions.map((x) => x.label).join("، ")}</p>
      </div>

      <section className="card space-y-3 p-5">
        <h2 className="font-black">🖨️ الطباعة</h2>
        <div className="flex flex-wrap gap-2">
          {a.versions.map((x) => (
            <span key={x.id} className="flex gap-1">
              <Link className="btn-secondary" href={`/print/assessment/${x.id}`}>ورقة النموذج ({x.label})</Link>
              <Link className="btn-secondary" href={`/print/assessment/${x.id}?answers=1`}>إجابة ({x.label})</Link>
            </span>
          ))}
        </div>
      </section>

      <section className="card space-y-3 p-5">
        <h2 className="font-black">📣 النشر للفصول</h2>
        {pubs.length > 0 && (
          <table className="table">
            <thead><tr><th>الفصل</th><th>الطريقة</th><th>من</th><th>إلى</th><th>سجل الدرجات</th><th /></tr></thead>
            <tbody>
              {pubs.map((p) => (
                <tr key={p.id}>
                  <td className="font-bold">{classLabel(pubClasses.find((c) => c.id === p.classId)!)}</td>
                  <td>{p.mode === "ONLINE" ? "💻 إلكتروني" : "📄 ورقي"}</td>
                  <td className="text-xs">{formatHijri(p.opensAt)}</td>
                  <td className="text-xs">{p.closesAt ? formatHijri(p.closesAt) : "—"}</td>
                  <td>{p.gradeItemId ? "✅ مربوط" : "—"}</td>
                  <td className="flex gap-2">
                    <Link className="btn-secondary" href={`/dashboard/assessments/results/${p.id}`}>النتائج</Link>
                    <Link className="btn-secondary" href={`/print/assessment-batch/${p.id}`}>أوراق بأسماء الطالبات</Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <AssessmentActions
          assessmentId={a.id}
          classes={classes.filter((c) => !pubs.some((p) => p.classId === c.id)).map((c) => ({ id: c.id, label: c.label }))}
          canPublish={ctx.can("assessments:publish")}
          canDelete={ctx.can("assessments:write")}
        />
      </section>

      {v && (
        <section className="card space-y-2 p-5">
          <h2 className="font-black">الأسئلة (النموذج {a.versions[0].label}) مع الإجابات</h2>
          <ol className="space-y-2">
            {v.questions.map((q) => (
              <li key={q.id} className={`rounded-lg border p-3 ${q.parentId ? "mr-6 bg-gray-50" : ""}`}>
                <div className="flex gap-2"><span className="font-black">{q.number ?? "📖"}</span><div className="flex-1"><QuestionCard q={v.byId.get(q.id)!} /></div><span className="text-xs text-gray-400">{q.points ? `${q.points} د` : ""}</span></div>
              </li>
            ))}
          </ol>
        </section>
      )}
    </div>
  );
}
