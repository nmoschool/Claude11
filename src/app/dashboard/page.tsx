import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireStaffPage } from "@/lib/guard";
import { listClasses } from "@/lib/classes";
import { PERMISSIONS, ROLE_LABELS, isReadOnlyRole } from "@/lib/permissions";

export default async function DashboardHome({ searchParams }: { searchParams: Promise<{ denied?: string }> }) {
  const ctx = await requireStaffPage();
  const { denied } = await searchParams;
  const classes = ctx.can("students:read") ? await listClasses(ctx) : [];
  const totalStudents = classes.reduce((s, c) => s + c.studentCount, 0);
  const withCode = await prisma.student.count({
    where: { archived: false, pictureCodeHash: { not: null }, class: ctx.classWhere() },
  });

  return (
    <div className="space-y-6">
      {denied && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">لا تملكين صلاحية الوصول إلى تلك الصفحة.</div>
      )}

      <div>
        <h1 className="text-2xl font-black">لوحة {ROLE_LABELS[ctx.role]}</h1>
        <p className="text-sm text-gray-500">
          {ctx.schoolWide ? "نطاقك: جميع فصول المدرسة" : `نطاقك: ${classes.length} فصل مسند إليك`}
          {isReadOnlyRole(ctx.role) && " — عرض فقط دون صلاحيات تعديل"}
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Stat label="الفصول" value={classes.length} icon="🏫" />
        <Stat label="الطالبات" value={totalStudents} icon="👧" />
        <Stat label="طالبات لديهن رمز دخول" value={`${withCode}/${totalStudents}`} icon="🔑" />
      </div>

      {classes.length > 0 && (
        <div className="card p-5">
          <h2 className="mb-3 font-black">فصولي</h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {classes.map((c) => (
              <Link key={c.id} href={`/dashboard/classes/${c.id}`} className="rounded-lg border border-gray-200 p-4 hover:border-brand-300 hover:bg-brand-50">
                <div className="font-black">{c.label}</div>
                <div className="text-sm text-gray-500">{c.studentCount} طالبة · المعلمة: {c.teachers.join("، ") || "—"}</div>
              </Link>
            ))}
          </div>
        </div>
      )}

      <details className="card p-5">
        <summary className="cursor-pointer font-black">صلاحياتي الفعلية ({ctx.perms.size})</summary>
        <div className="mt-3 flex flex-wrap gap-2">
          {Array.from(ctx.perms).map((p) => (
            <span key={p} className="badge bg-gray-100 text-gray-700">{PERMISSIONS[p]}</span>
          ))}
        </div>
      </details>
    </div>
  );
}

function Stat({ label, value, icon }: { label: string; value: number | string; icon: string }) {
  return (
    <div className="card flex items-center gap-4 p-5">
      <span className="text-3xl">{icon}</span>
      <div>
        <div className="text-2xl font-black">{value}</div>
        <div className="text-sm text-gray-500">{label}</div>
      </div>
    </div>
  );
}
