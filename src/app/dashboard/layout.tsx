import { requireStaffPage } from "@/lib/guard";
import { ROLE_LABELS, isReadOnlyRole } from "@/lib/permissions";
import Sidebar from "@/components/Sidebar";
import Topbar from "@/components/Topbar";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const ctx = await requireStaffPage();
  return (
    <div className="flex min-h-screen">
      <Sidebar perms={ctx.mfaSetupRequired ? [] : Array.from(ctx.perms)} />
      <div className="flex min-h-screen min-w-0 flex-1 flex-col">
        <Topbar name={ctx.name} roleLabel={ROLE_LABELS[ctx.role]} readOnly={isReadOnlyRole(ctx.role)} />
        <main className="flex-1 bg-gray-50 p-5">{children}</main>
      </div>
    </div>
  );
}
