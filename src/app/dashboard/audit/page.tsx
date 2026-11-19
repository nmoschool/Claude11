import { requireStaffPage } from "@/lib/guard";
import { queryAudit } from "@/lib/auditQuery";
import { ROLE_LABELS } from "@/lib/permissions";

const ACTIONS: Record<string, string> = {
  LOGIN: "تسجيل دخول",
  LOGIN_FAILED: "محاولة دخول فاشلة",
  MFA_ENABLED: "تفعيل التحقق الثنائي",
  MFA_RESET: "إعادة ضبط التحقق الثنائي",
  PASSWORD_CHANGED: "تغيير كلمة المرور",
  PASSWORD_RESET: "إعادة تعيين كلمة المرور",
  USER_CREATED: "إنشاء مستخدم",
  USER_UPDATED: "تعديل مستخدم",
  PERMISSIONS_UPDATED: "تعديل صلاحيات",
  PICTURE_CODES_RESET: "توليد رموز دخول الطالبات",
  SENSITIVE_VIEW: "اطلاع على بيانات حساسة",
  SUPERVISOR_COMMENT: "ملاحظة إشرافية",
};

export default async function AuditPage() {
  const ctx = await requireStaffPage("audit:read");
  const { rows } = await queryAudit(ctx, 200);
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-black">سجل التدقيق</h1>
      <p className="text-sm text-gray-500">آخر 200 عملية ضمن نطاقك. السجل للإضافة فقط ولا يمكن تعديله من الواجهة.</p>
      <div className="card overflow-x-auto">
        <table className="table">
          <thead><tr><th>الوقت</th><th>المنفّذ</th><th>العملية</th><th>العنصر</th><th>السبب/التفاصيل</th><th>IP</th></tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td className="whitespace-nowrap text-xs">{r.createdAt.toLocaleString("ar-SA")}</td>
                <td>{r.actorType === "STUDENT" ? "طالبة" : r.actor ? `${r.actor.name} (${ROLE_LABELS[r.actor.role]})` : "النظام"}</td>
                <td className="font-bold">{ACTIONS[r.action] ?? r.action}</td>
                <td className="text-xs text-gray-500">{r.entity}</td>
                <td className="max-w-xs truncate text-xs text-gray-500">{r.reason ?? (r.after ? JSON.stringify(r.after) : "")}</td>
                <td dir="ltr" className="text-right text-xs text-gray-400">{r.ip ?? ""}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
