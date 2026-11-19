import Link from "next/link";
import { requireStaffPage } from "@/lib/guard";
import { listClasses } from "@/lib/classes";

export default async function ClassesPage() {
  const ctx = await requireStaffPage("students:read");
  const classes = await listClasses(ctx);
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-black">الفصول والطالبات</h1>
      <div className="card overflow-x-auto">
        <table className="table">
          <thead>
            <tr><th>الفصل</th><th>عدد الطالبات</th><th>المعلمة</th><th>المشرفة</th><th>رمز دخول الطالبات</th><th></th></tr>
          </thead>
          <tbody>
            {classes.map((c) => (
              <tr key={c.id}>
                <td className="font-bold">{c.label}</td>
                <td>{c.studentCount}</td>
                <td>{c.teachers.join("، ") || "—"}</td>
                <td>{c.supervisors.join("، ") || "—"}</td>
                <td dir="ltr" className="text-right font-mono font-bold tracking-widest">{c.joinCode}</td>
                <td><Link className="btn-secondary" href={`/dashboard/classes/${c.id}`}>فتح</Link></td>
              </tr>
            ))}
            {!classes.length && (
              <tr><td colSpan={6} className="py-8 text-center text-gray-400">لا توجد فصول مسندة إليك.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
