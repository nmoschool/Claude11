/**
 * نموذج الصلاحيات الدقيقة (docs/lughati-g4-design.md — القسم 1.2).
 * ملف نقي بلا اعتماديات خادم: يُستخدم في الـ middleware والواجهة والخادم.
 */

export const PERMISSIONS = {
  "grades:read": "عرض الدرجات",
  "grades:write": "إدخال وتعديل الدرجات",
  "grades:export": "تصدير وطباعة الدرجات",
  "grades:lock": "قفل واعتماد الدرجات",
  "curriculum:read": "عرض توزيع المنهج",
  "curriculum:write": "تعديل وإعادة جدولة المنهج",
  "students:read": "عرض بيانات الطالبات",
  "students:write": "إضافة وتعديل الطالبات",
  "students:sensitive": "عرض البيانات الحساسة (الهوية، الجوال، الصحة)",
  "students:credentials": "إعادة تعيين رموز دخول الطالبات",
  "attendance:write": "تسجيل الحضور",
  "behavior:write": "تسجيل السلوك والملاحظات",
  "files:upload": "رفع ملفات الطالبات",
  "assessments:read": "عرض الأوراق والاختبارات",
  "assessments:write": "إنشاء الأوراق والاختبارات",
  "assessments:publish": "نشر الاختبارات للطالبات",
  "games:manage": "إدارة الألعاب",
  "certificates:issue": "إصدار الشهادات",
  "reports:read": "عرض التقارير",
  "reports:export": "تصدير التقارير",
  "supervision:comment": "إضافة ملاحظات إشرافية",
  "users:manage": "إدارة المستخدمين والصلاحيات",
  "settings:manage": "إدارة الإعدادات",
  "audit:read": "عرض سجل التدقيق",
} as const;

export type Permission = keyof typeof PERMISSIONS;
export type StaffRoleName =
  | "SUPER_ADMIN"
  | "SCHOOL_ADMIN"
  | "TEACHER"
  | "SUPERVISOR"
  | "GUARDIAN";
export type RoleName = StaffRoleName | "STUDENT";

export const ALL_PERMISSIONS = Object.keys(PERMISSIONS) as Permission[];

export const PERMISSION_GROUPS: { title: string; perms: Permission[] }[] = [
  { title: "الدرجات", perms: ["grades:read", "grades:write", "grades:export", "grades:lock"] },
  { title: "المنهج", perms: ["curriculum:read", "curriculum:write"] },
  {
    title: "الطالبات",
    perms: [
      "students:read",
      "students:write",
      "students:sensitive",
      "students:credentials",
      "attendance:write",
      "behavior:write",
      "files:upload",
    ],
  },
  {
    title: "الاختبارات والألعاب",
    perms: [
      "assessments:read",
      "assessments:write",
      "assessments:publish",
      "games:manage",
      "certificates:issue",
    ],
  },
  { title: "التقارير والإشراف", perms: ["reports:read", "reports:export", "supervision:comment"] },
  { title: "الإدارة", perms: ["users:manage", "settings:manage", "audit:read"] },
];

const READ_ONLY: Permission[] = [
  "grades:read",
  "grades:export",
  "curriculum:read",
  "students:read",
  "assessments:read",
  "reports:read",
  "reports:export",
];

export const ROLE_DEFAULTS: Record<RoleName, Permission[]> = {
  SUPER_ADMIN: ALL_PERMISSIONS,
  SCHOOL_ADMIN: [
    ...READ_ONLY,
    "grades:lock",
    "students:sensitive",
    "supervision:comment",
    "users:manage",
    "audit:read",
  ],
  TEACHER: ALL_PERMISSIONS.filter(
    (p) => !["users:manage", "settings:manage", "audit:read", "supervision:comment"].includes(p)
  ),
  SUPERVISOR: [...READ_ONLY, "supervision:comment", "audit:read"],
  GUARDIAN: [],
  STUDENT: [],
};

/**
 * صلاحيات «كتابة» لا يجوز منحها للمشرفة حتى عبر التخصيص —
 * ضمانة أن واجهة المشرفة قراءة فقط بصرف النظر عن أي خطأ إداري.
 */
export const SUPERVISOR_WRITABLE: Permission[] = ["supervision:comment"];

export const ROLE_LABELS: Record<RoleName, string> = {
  SUPER_ADMIN: "مدير النظام",
  SCHOOL_ADMIN: "قائدة المدرسة",
  TEACHER: "معلمة",
  SUPERVISOR: "مشرفة تربوية",
  GUARDIAN: "ولي أمر",
  STUDENT: "طالبة",
};

export interface Override {
  permission: string;
  granted: boolean;
}

/** الصلاحيات الفعلية = افتراضيات الدور + المنح − السحب (مع قيد المشرفة) */
export function effectivePermissions(role: RoleName, overrides: Override[] = []): Permission[] {
  const set = new Set<Permission>(ROLE_DEFAULTS[role] ?? []);
  for (const o of overrides) {
    if (!(o.permission in PERMISSIONS)) continue;
    const p = o.permission as Permission;
    if (o.granted) set.add(p);
    else set.delete(p);
  }
  if (role === "SUPERVISOR") {
    for (const p of Array.from(set)) {
      if (!READ_ONLY.includes(p) && !SUPERVISOR_WRITABLE.includes(p) && p !== "audit:read") {
        set.delete(p);
      }
    }
  }
  return ALL_PERMISSIONS.filter((p) => set.has(p));
}

/** هل الدور يرى كل فصول المدرسة (وليس الفصول المسندة له فقط)؟ */
export function hasSchoolWideScope(role: RoleName): boolean {
  return role === "SUPER_ADMIN" || role === "SCHOOL_ADMIN";
}

/** هل الدور للقراءة فقط (لا يرى أزرار التعديل في الواجهة)؟ */
export function isReadOnlyRole(role: RoleName): boolean {
  return role === "SUPERVISOR";
}
