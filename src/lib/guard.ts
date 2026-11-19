import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  effectivePermissions,
  hasSchoolWideScope,
  SUPERVISOR_WRITABLE,
  type Permission,
  type StaffRoleName,
} from "@/lib/permissions";

/**
 * سياق المستخدم من الطاقم — يُعاد بناؤه من قاعدة البيانات في كل طلب،
 * فأي تغيير في الصلاحيات أو تعطيل الحساب يسري فوراً دون انتظار انتهاء الجلسة.
 */
export interface StaffContext {
  id: string;
  name: string;
  email: string;
  role: StaffRoleName;
  schoolId: string;
  perms: Set<Permission>;
  classIds: string[];
  schoolWide: boolean;
  mfaSetupRequired: boolean;
  can(perm: Permission, classId?: string): boolean;
  inScope(classId: string): boolean;
  /** شرط Prisma لتصفية الفصول ضمن نطاق المستخدم */
  classWhere(): { schoolId: string; id?: { in: string[] } };
}

export class HttpError extends Error {
  constructor(public status: number, public code: string, message: string) {
    super(message);
  }
}

export async function loadStaffContext(): Promise<StaffContext | null> {
  const session = await getServerSession(authOptions);
  const su = session?.user;
  if (!su || su.kind !== "staff") return null;

  const user = await prisma.user.findUnique({
    where: { id: su.id },
    include: { permissions: true, classLinks: true },
  });
  if (!user || !user.active) return null;

  const role = user.role as StaffRoleName;
  const perms = new Set(effectivePermissions(role, user.permissions));
  const classIds = user.classLinks.map((l) => l.classId);
  const schoolWide = hasSchoolWideScope(role);
  const inScope = (classId: string) => schoolWide || classIds.includes(classId);

  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role,
    schoolId: user.schoolId,
    perms,
    classIds,
    schoolWide,
    mfaSetupRequired: !!su.mfaSetupRequired,
    inScope,
    can: (perm, classId) => perms.has(perm) && (!classId || inScope(classId)),
    classWhere: () =>
      schoolWide ? { schoolId: user.schoolId } : { schoolId: user.schoolId, id: { in: classIds } },
  };
}

// ---------------------------------------------------------------------------
// صفحات الخادم
// ---------------------------------------------------------------------------

export async function requireStaffPage(perm?: Permission): Promise<StaffContext> {
  const ctx = await loadStaffContext();
  if (!ctx) redirect("/login");
  if (perm && !ctx.can(perm)) redirect("/dashboard?denied=1");
  return ctx;
}

export async function requireStudentPage() {
  const session = await getServerSession(authOptions);
  const su = session?.user;
  if (!su || su.kind !== "student") redirect("/student-login");
  const student = await prisma.student.findFirst({
    where: { id: su.id, archived: false },
    include: { class: true },
  });
  if (!student) redirect("/student-login");
  return student;
}

// ---------------------------------------------------------------------------
// واجهات API
// ---------------------------------------------------------------------------

type Handler<P> = (
  req: Request,
  ctx: StaffContext,
  params: P
) => Promise<Response | unknown> | Response | unknown;

interface ApiOptions {
  /**
   * مسارات «حسابي» (2FA، كلمة المرور): تخص المستخدمة نفسها فقط، فتُستثنى من
   * اشتراط الصلاحية ومن قيد القراءة فقط، ويُسمح بها قبل إكمال إعداد 2FA.
   */
  selfService?: boolean;
}

export function jsonError(status: number, code: string, message: string) {
  return NextResponse.json({ error: { code, message_ar: message } }, { status });
}

/**
 * غلاف موحّد لكل Route Handler:
 * المصادقة ← 2FA ← الصلاحية ← قيد القراءة فقط للمشرفة ← التنفيذ ← معالجة الأخطاء
 */
export function withPermission<P = Record<string, string>>(
  perm: Permission | null,
  handler: Handler<P>,
  opts: ApiOptions = {}
) {
  if (perm === null && !opts.selfService) {
    throw new Error("withPermission(null) مسموح فقط لمسارات selfService");
  }
  return async (req: Request, route: { params: Promise<P> }) => {
    try {
      const ctx = await loadStaffContext();
      if (!ctx) return jsonError(401, "UNAUTHENTICATED", "يجب تسجيل الدخول");
      if (ctx.mfaSetupRequired && !opts.selfService) {
        return jsonError(403, "MFA_SETUP_REQUIRED", "يجب تفعيل التحقق الثنائي أولاً");
      }
      if (perm && !ctx.perms.has(perm)) {
        return jsonError(403, "FORBIDDEN", "لا تملكين صلاحية تنفيذ هذا الإجراء");
      }
      // طبقة دفاع إضافية: المشرفة لا تنفّذ أي عملية كتابة خارج قناة الملاحظات الإشرافية
      if (
        ctx.role === "SUPERVISOR" &&
        req.method !== "GET" &&
        !opts.selfService &&
        !(perm && SUPERVISOR_WRITABLE.includes(perm))
      ) {
        return jsonError(403, "READ_ONLY", "حساب المشرفة للقراءة فقط");
      }
      const params = (await route?.params) ?? ({} as P);
      const result = await handler(req, ctx, params);
      return result instanceof Response ? result : NextResponse.json(result ?? { ok: true });
    } catch (e) {
      if (e instanceof HttpError) return jsonError(e.status, e.code, e.message);
      if (e instanceof ZodError) {
        return NextResponse.json(
          { error: { code: "VALIDATION", message_ar: "بيانات غير صالحة", issues: e.issues } },
          { status: 400 }
        );
      }
      console.error(e);
      return jsonError(500, "SERVER_ERROR", "حدث خطأ غير متوقع");
    }
  };
}

export function assertScope(ctx: StaffContext, classId: string) {
  if (!ctx.inScope(classId)) throw new HttpError(403, "OUT_OF_SCOPE", "هذا الفصل خارج نطاق صلاحياتك");
}
