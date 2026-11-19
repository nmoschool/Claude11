import { requireStaffPage } from "@/lib/guard";
import { loadClassPage } from "@/lib/classPage";
import ClassTabs from "@/components/ClassTabs";
import ClassCalendar from "@/components/ClassCalendar";
import { todayRiyadh } from "@/lib/dates";

export default async function CalendarPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await requireStaffPage("curriculum:read");
  const { label } = await loadClassPage(ctx, id);
  return (
    <div>
      <ClassTabs classId={id} label={label} showCalendar />
      <ClassCalendar classId={id} label={label} canEdit={ctx.can("curriculum:write", id)} today={todayRiyadh()} />
    </div>
  );
}
