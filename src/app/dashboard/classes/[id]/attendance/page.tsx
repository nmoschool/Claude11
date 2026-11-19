import { requireStaffPage } from "@/lib/guard";
import { loadClassPage } from "@/lib/classPage";
import ClassTabs from "@/components/ClassTabs";
import AttendanceSheet from "@/components/AttendanceSheet";
import { todayRiyadh } from "@/lib/dates";

export default async function AttendancePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await requireStaffPage("students:read");
  const { label } = await loadClassPage(ctx, id);
  return (
    <div>
      <ClassTabs classId={id} label={label} showCalendar={ctx.can("curriculum:read")} />
      <AttendanceSheet classId={id} canEdit={ctx.can("attendance:write", id)} today={todayRiyadh()} />
    </div>
  );
}
