import Link from "next/link";
import { requireStaffPage } from "@/lib/guard";
import { listStudents } from "@/lib/classes";
import { loadClassPage } from "@/lib/classPage";
import { audit } from "@/lib/audit";
import ClassTabs from "@/components/ClassTabs";
import LoginCards from "@/components/LoginCards";
import SupervisorComments from "@/components/SupervisorComments";
import StudentTools from "@/components/StudentTools";

export default async function ClassPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ archived?: string }> }) {
  const { id } = await params;
  const { archived } = await searchParams;
  const ctx = await requireStaffPage("students:read");
  const { cls, label } = await loadClassPage(ctx, id);
  const showArchived = archived === "1";
  const students = await listStudents(ctx, id, { archived: showArchived });
  const sensitive = ctx.can("students:sensitive", id);
  if (sensitive) await audit({ actorId: ctx.id, action: "SENSITIVE_VIEW", entity: "SchoolClass", entityId: id });

  return (
    <div className="space-y-5">
      <ClassTabs classId={id} label={label} showCalendar={ctx.can("curriculum:read")} />
      <div className="no-print flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black">فصل {label}</h1>
          <p className="text-sm text-gray-500">
            {students.length} طالبة{showArchived && " مؤرشفة"} · رمز الفصل لدخول الطالبات:{" "}
            <span dir="ltr" className="font-mono font-black tracking-widest text-brand-700">{cls.joinCode}</span>
          </p>
        </div>
        <div className="flex gap-2">
          <Link className="btn-secondary" href={showArchived ? `/dashboard/classes/${id}` : `/dashboard/classes/${id}?archived=1`}>
            {showArchived ? "← الطالبات الحاليات" : "🗄️ المؤرشفات"}
          </Link>
        </div>
      </div>

      {ctx.can("students:write", id) && !showArchived && <StudentTools classId={id} canImport={sensitive} canSensitive={sensitive} />}

      <div className="card no-print overflow-x-auto">
        <table className="table">
          <thead>
            <tr><th>#</th><th>الطالبة</th><th>الهوية</th><th>ولي الأمر</th><th>جوال ولي الأمر</th><th>ملاحظات صحية</th><th>رمز الدخول</th><th>آخر دخول</th></tr>
          </thead>
          <tbody>
            {students.map((s, i) => (
              <tr key={s.id}>
                <td className="text-gray-400">{i + 1}</td>
                <td className="font-bold"><Link href={`/dashboard/students/${s.id}`} className="hover:text-brand-700 hover:underline"><span className="ml-1">{s.avatar}</span>{s.fullName}</Link></td>
                <td dir="ltr" className="text-right font-mono text-xs">{s.nationalId}</td>
                <td>{s.guardianName ?? "—"}</td>
                <td dir="ltr" className="text-right">{s.guardianPhone ?? "—"}</td>
                <td className="max-w-[12rem] truncate">{s.healthNotes ?? "—"}</td>
                <td>
                  {s.locked ? <span className="badge bg-red-50 text-red-700">مقفل مؤقتاً</span>
                    : s.hasPictureCode ? <span className="badge bg-mint-50 text-mint-700">مفعّل</span>
                    : <span className="badge bg-gray-100 text-gray-500">غير مُعدّ</span>}
                </td>
                <td className="text-xs text-gray-500">{s.lastLoginAt ? new Date(s.lastLoginAt).toLocaleString("ar-SA") : "—"}</td>
              </tr>
            ))}
            {!students.length && <tr><td colSpan={8} className="py-8 text-center text-gray-400">لا توجد طالبات.</td></tr>}
          </tbody>
        </table>
        {!sensitive && <p className="border-t p-3 text-xs text-gray-400">🔒 البيانات الحساسة مخفية وفق صلاحياتك.</p>}
      </div>

      {ctx.can("students:credentials", id) && !showArchived && (
        <LoginCards classId={id} students={students.map((s) => ({ id: s.id, fullName: s.fullName }))} />
      )}

      <SupervisorComments classId={id} canWrite={ctx.can("supervision:comment", id)} />
    </div>
  );
}
