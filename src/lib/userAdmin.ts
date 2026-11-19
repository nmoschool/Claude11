import { prisma } from "@/lib/prisma";
import { HttpError, type StaffContext } from "@/lib/guard";
import { ALL_PERMISSIONS, type Permission, type StaffRoleName } from "@/lib/permissions";

export const MANAGEABLE_ROLES: StaffRoleName[] = ["SCHOOL_ADMIN", "TEACHER", "SUPERVISOR"];

/** يمنع تصعيد الصلاحيات: لا يُدار حساب أعلى، ولا يُمنح ما لا يملكه المدير نفسه */
export async function loadManagedUser(ctx: StaffContext, id: string) {
  const target = await prisma.user.findUnique({
    where: { id },
    include: { permissions: true, classLinks: true },
  });
  if (!target || target.schoolId !== ctx.schoolId) {
    throw new HttpError(404, "NOT_FOUND", "المستخدم غير موجود");
  }
  if (target.id === ctx.id) {
    throw new HttpError(400, "SELF_EDIT", "لا يمكنك تعديل دورك أو صلاحياتك بنفسك");
  }
  if (target.role === "SUPER_ADMIN" && ctx.role !== "SUPER_ADMIN") {
    throw new HttpError(403, "FORBIDDEN", "لا يمكن تعديل حساب مدير النظام");
  }
  return target;
}

/**
 * ما يستطيع المدير الحالي منحه:
 * مدير النظام: كل شيء — القائدة: كل شيء عدا إعدادات النظام — غيرهما: ما يملكه فقط.
 */
export function grantablePermissions(ctx: StaffContext): Permission[] {
  if (ctx.role === "SUPER_ADMIN") return ALL_PERMISSIONS;
  if (ctx.role === "SCHOOL_ADMIN") return ALL_PERMISSIONS.filter((p) => p !== "settings:manage");
  return ALL_PERMISSIONS.filter((p) => ctx.perms.has(p));
}

export function assertAssignableRole(ctx: StaffContext, role: StaffRoleName) {
  if (role === "SUPER_ADMIN" && ctx.role !== "SUPER_ADMIN") {
    throw new HttpError(403, "FORBIDDEN", "لا يمكنك إنشاء مدير نظام");
  }
  if (role === "GUARDIAN") throw new HttpError(400, "UNSUPPORTED", "حسابات أولياء الأمور في المرحلة الثانية");
  if (role === "SCHOOL_ADMIN" && !["SUPER_ADMIN", "SCHOOL_ADMIN"].includes(ctx.role)) {
    throw new HttpError(403, "ESCALATION", "إسناد دور القائدة متاح لمدير النظام والقائدة فقط");
  }
}

export function assertGrantable(ctx: StaffContext, perms: Permission[]) {
  const allowed = new Set(grantablePermissions(ctx));
  const bad = perms.filter((p) => !allowed.has(p));
  if (bad.length) {
    throw new HttpError(403, "ESCALATION", `لا يمكنك منح هذه الصلاحيات: ${bad.join("، ")}`);
  }
}

export async function assertClassesInSchool(ctx: StaffContext, classIds: string[]) {
  if (!classIds.length) return;
  const n = await prisma.schoolClass.count({ where: { id: { in: classIds }, schoolId: ctx.schoolId } });
  if (n !== new Set(classIds).size) throw new HttpError(400, "INVALID_CLASS", "فصل غير صالح");
}
