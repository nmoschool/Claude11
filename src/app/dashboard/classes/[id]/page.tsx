import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireStaffPage } from "@/lib/guard";
import { classLabel, listStudents } from "@/lib/classes";
import { audit } from "@/lib/audit";
import LoginCards from "@/components/LoginCards";
import SupervisorComments from "@/components/SupervisorComments";

export default async function ClassPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await requireStaffPage("students:read");
  if (!ctx.inScope(id)) notFound();
  const cls = await prisma.schoolClass.findFirst({ where: { id, schoolId: ctx.schoolId } });
  if (!cls) notFound();

  const students = await listStudents(ctx, id);
  const sensitive = ctx.can("students:sensitive", id);
  if (sensitive) await audit({ actorId: ctx.id, action: "SENSITIVE_VIEW", entity: "SchoolClass", entityId: id });

  return (
    <div className="space-y-5">
      <div className="no-print flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black">فصل {classLabel(cls)}</h1>
          <p className="text-sm text-gray-500">
            {students.length} طالبة · رمز الفصل لدخول الطالبات:{" "}
            <span dir="ltr" className="font-mono font-black tracking-widest text-brand-700">{cls.joinCode}</span>
          </p>
        </div>
      </div>

      <div className="card no-print overflow-x-auto">
        <table className="table">
          <thead>
            <tr>
              <th>#</th><th>الطالبة</th><th>الهوية</th><th>ولي الأمر</th><th>جوال ولي الأمر</th><th>ملاحظات صحية</th><th>رمز الدخول</th><th>آخر دخول</th>
            </tr>
          </thead>
          <tbody>
            {students.map((s, i) => (
              <tr key={s.id}>
                <td className="text-gray-400">{i + 1}</td>
                <td className="font-bold"><span className="ml-1">{s.avatar}</span>{s.fullName}</td>
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
          </tbody>
        </table>
        {!sensitive && <p className="border-t p-3 text-xs text-gray-400">🔒 البيانات الحساسة مخفية وفق صلاحياتك.</p>}
      </div>

      {ctx.can("students:credentials", id) && (
        <LoginCards classId={id} students={students.map((s) => ({ id: s.id, fullName: s.fullName }))} />
      )}

      <SupervisorComments classId={id} canWrite={ctx.can("supervision:comment", id)} />
    </div>
  );
}
