import { requireStaffPage } from "@/lib/guard";
import { listClasses } from "@/lib/classes";
import GamesDashboard from "@/components/GamesDashboard";

export default async function GamesAdminPage({ searchParams }: { searchParams: Promise<{ class?: string }> }) {
  const ctx = await requireStaffPage("reports:read");
  const classes = await listClasses(ctx);
  const sp = await searchParams;
  const classId = classes.find((c) => c.id === sp.class)?.id ?? classes[0]?.id;
  if (!classId) return <p className="text-gray-500">لا توجد فصول مسندة إليك.</p>;
  return (
    <GamesDashboard
      key={classId}
      classId={classId}
      classes={classes.map((c) => ({ id: c.id, label: c.label }))}
      canManage={ctx.can("games:manage", classId)}
      canIssue={ctx.can("certificates:issue", classId)}
    />
  );
}
