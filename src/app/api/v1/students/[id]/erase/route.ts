import { z } from "zod";
import { withPermission, HttpError } from "@/lib/guard";
import { audit } from "@/lib/audit";
import { loadStudentInScope } from "@/lib/studentService";
import { eraseStudent } from "@/lib/privacy";

const Body = z.object({ confirmName: z.string(), reason: z.string().trim().min(10).max(300) });

/**
 * حذف نهائي لكل بيانات الطالبة (طلب محو). ضمانات:
 * يجب أرشفتها أولاً، وكتابة اسمها الكامل للتأكيد، وذكر السبب. لا يمكن التراجع.
 */
export const POST = withPermission<{ id: string }>("users:manage", async (req, ctx, { id }) => {
  const s = await loadStudentInScope(ctx, id);
  const b = Body.parse(await req.json());
  if (!ctx.can("students:sensitive", s.classId)) throw new HttpError(403, "FORBIDDEN", "يتطلب صلاحية البيانات الحساسة");
  if (!s.archived) throw new HttpError(409, "NOT_ARCHIVED", "أرشفي الطالبة أولاً قبل الحذف النهائي");
  if (b.confirmName.trim() !== s.fullName) throw new HttpError(400, "CONFIRM_MISMATCH", "الاسم المكتوب لا يطابق اسم الطالبة");
  const r = await eraseStudent(id);
  await audit({ actorId: ctx.id, action: "STUDENT_ERASED", entity: "Student", entityId: null, reason: b.reason, after: { fingerprint: r.fingerprint, classId: s.classId, files: r.files } });
  return { ok: true };
});
