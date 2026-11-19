import { withPermission, HttpError } from "@/lib/guard";
import { audit } from "@/lib/audit";
import { loadStudentInScope } from "@/lib/studentService";
import { exportStudent } from "@/lib/privacy";

/** تصدير كل بيانات الطالبة (طلب اطلاع من ولي الأمر) — للقائدة/الإدارة فقط */
export const GET = withPermission<{ id: string }>("users:manage", async (_req, ctx, { id }) => {
  const s = await loadStudentInScope(ctx, id);
  if (!ctx.can("students:sensitive", s.classId)) throw new HttpError(403, "FORBIDDEN", "يتطلب صلاحية البيانات الحساسة");
  const data = await exportStudent(id);
  await audit({ actorId: ctx.id, action: "STUDENT_DATA_EXPORTED", entity: "Student", entityId: id });
  return new Response(JSON.stringify(data, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(`بيانات-${s.displayName}.json`)}`,
      "Cache-Control": "private, no-store",
    },
  });
});
