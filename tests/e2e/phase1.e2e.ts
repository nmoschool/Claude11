/**
 * اختبارات طرف-لطرف للمرحلة 1 على خادم فعلي.
 *   npm run build && npm start   (بعد npm run db:seed)
 *   BASE_URL=http://localhost:3000 npm run test:e2e
 * تقرأ رموز الطالبات مباشرة من القاعدة عبر Prisma لإعداد الحالة.
 */
import { test, before } from "node:test";
import assert from "node:assert/strict";
import { PrismaClient } from "@prisma/client";
import { totp } from "../../src/lib/totp";

const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const prisma = new PrismaClient();

class Client {
  cookies = new Map<string, string>();
  constructor(public ip = `10.0.0.${Math.floor(Math.random() * 250) + 1}`) {}

  async req(path: string, init: RequestInit = {}) {
    const headers = new Headers(init.headers);
    headers.set("cookie", Array.from(this.cookies, ([k, v]) => `${k}=${v}`).join("; "));
    headers.set("x-forwarded-for", this.ip);
    const res = await fetch(BASE + path, { ...init, headers, redirect: "manual" });
    for (const c of res.headers.getSetCookie()) {
      const [kv] = c.split(";");
      const i = kv.indexOf("=");
      this.cookies.set(kv.slice(0, i), kv.slice(i + 1));
    }
    return res;
  }

  async json(path: string, method = "GET", body?: unknown) {
    const res = await this.req(path, {
      method,
      headers: body ? { "content-type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
    return { status: res.status, data: (await res.json().catch(() => null)) as any };
  }

  /** تسجيل الدخول عبر NextAuth Credentials — يعيد رمز الخطأ أو null عند النجاح */
  async signIn(provider: "staff" | "student", fields: Record<string, string>): Promise<string | null> {
    this.cookies.clear();
    const { data } = await this.json("/api/auth/csrf");
    const res = await this.req(`/api/auth/callback/${provider}`, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ ...fields, csrfToken: data.csrfToken, json: "true" }),
    });
    const url = (await res.json().catch(() => ({})))?.url ?? res.headers.get("location") ?? "";
    return new URL(url, BASE).searchParams.get("error");
  }
}

const secrets: Record<string, string> = {};

/** دخول + تفعيل 2FA (أول مرة) + إعادة الدخول بالرمز */
async function staff(email: string, password: string): Promise<Client> {
  const c = new Client();
  if (!secrets[email]) {
    assert.equal(await c.signIn("staff", { email, password }), null);
    const blocked = await c.json("/api/v1/classes");
    assert.equal(blocked.status, 403);
    assert.equal(blocked.data.error.code, "MFA_SETUP_REQUIRED");
    const setup = await c.json("/api/v1/account/2fa/setup", "POST");
    assert.equal(setup.status, 200);
    assert.match(setup.data.qr, /^data:image\/png;base64,/);
    const en = await c.json("/api/v1/account/2fa/enable", "POST", { code: totp(setup.data.secret) });
    assert.equal(en.status, 200, JSON.stringify(en.data));
    secrets[email] = setup.data.secret;
  }
  assert.equal(await c.signIn("staff", { email, password }), "OTP_REQUIRED");
  assert.equal(await c.signIn("staff", { email, password, otp: "000000" }), "OTP_INVALID");
  assert.equal(await c.signIn("staff", { email, password, otp: totp(secrets[email]) }), null);
  return c;
}

let classes: Record<string, { id: string; joinCode: string }> = {};

before(async () => {
  const rows = await prisma.schoolClass.findMany();
  classes = Object.fromEntries(rows.map((r) => [r.section, r]));
  // إعادة ضبط حالة الاختبار
  await prisma.user.updateMany({ data: { totpEnabled: false, totpSecret: null, failedLogins: 0, lockedUntil: null } });
  await prisma.student.updateMany({ data: { failedLogins: 0, lockedUntil: null } });
});

test("الصحة", async () => {
  const r = await new Client().json("/api/v1/health");
  assert.equal(r.data.status, "ok");
});

test("رفض بيانات دخول خاطئة وغير المصادَق", async () => {
  const c = new Client();
  assert.equal(await c.signIn("staff", { email: "teacher@school.sa", password: "wrong" }), "INVALID");
  assert.equal(await c.signIn("staff", { email: "nobody@school.sa", password: "x" }), "INVALID");
  assert.equal((await c.json("/api/v1/classes")).status, 401);
  const page = await c.req("/dashboard");
  assert.equal(page.status, 307);
  assert.match(page.headers.get("location")!, /\/login/);
});

test("المعلمة: نطاق فصولها فقط + البيانات الحساسة + لا إدارة مستخدمين", async () => {
  const t = await staff("teacher@school.sa", "Teacher123!");
  const list = await t.json("/api/v1/classes");
  assert.deepEqual(list.data.classes.map((c: any) => c.label).sort(), ["الرابع / أ", "الرابع / ب"]);

  const own = await t.json(`/api/v1/classes/${classes["أ"].id}/students`);
  assert.equal(own.status, 200);
  assert.match(own.data.students[0].guardianPhone, /^05\d{8}$/);
  assert.match(own.data.students[0].nationalId, /•/);

  const other = await t.json(`/api/v1/classes/${classes["ج"].id}/students`);
  assert.equal(other.status, 403);
  assert.equal(other.data.error.code, "OUT_OF_SCOPE");

  assert.equal((await t.json("/api/v1/users")).status, 403);
  assert.equal((await t.json(`/api/v1/classes/${classes["أ"].id}/comments`, "POST", { body: "test" })).status, 403);
});

test("المشرفة: قراءة فقط — كل عمليات الكتابة مرفوضة عدا الملاحظة الإشرافية", async () => {
  const s = await staff("supervisor@school.sa", "Supervisor123!");
  const A = classes["أ"].id;
  const r = await s.json(`/api/v1/classes/${A}/students`);
  assert.equal(r.status, 200);
  assert.equal(r.data.students[0].guardianPhone, "مخفي");

  for (const [path, method, body] of [
    [`/api/v1/classes/${A}/picture-codes`, "POST", {}],
    ["/api/v1/users", "POST", { name: "x x x", email: "x@x.sa", role: "TEACHER" }],
    ["/api/v1/users/someone/permissions", "PUT", { overrides: [] }],
  ] as const) {
    const res = await s.json(path, method, body);
    assert.equal(res.status, 403, `${method} ${path}`);
  }

  const c = await s.json(`/api/v1/classes/${A}/comments`, "POST", { body: "نأمل زيادة أنشطة القراءة الجهرية" });
  assert.equal(c.status, 200);
  assert.equal((await s.json(`/api/v1/classes/${classes["ج"].id}/comments`, "POST", { body: "خارج النطاق" })).status, 403);

  const audit = await s.json("/api/v1/audit");
  assert.equal(audit.status, 200);
});

test("القائدة: إدارة المستخدمين، تخصيص الصلاحيات، ومنع التصعيد", async () => {
  const p = await staff("principal@school.sa", "Principal123!");
  const users = (await p.json("/api/v1/users")).data.users as any[];
  const sup = users.find((u) => u.email === "supervisor@school.sa");
  const teacher = users.find((u) => u.email === "teacher@school.sa");
  const admin = users.find((u) => u.role === "SUPER_ADMIN");
  const me = users.find((u) => u.email === "principal@school.sa");

  // منح المشرفة صلاحية كتابة لا يسري (قيد صلب)
  const g = await p.json(`/api/v1/users/${sup.id}/permissions`, "PUT", {
    overrides: [{ permission: "grades:write", granted: true }],
  });
  assert.equal(g.status, 200);
  assert.ok(!g.data.effective.includes("grades:write"));

  // سحب صلاحية من المعلمة يسري فوراً دون إعادة دخول
  const t = await staff("teacher@school.sa", "Teacher123!");
  await p.json(`/api/v1/users/${teacher.id}/permissions`, "PUT", {
    overrides: [{ permission: "students:read", granted: false }],
  });
  assert.equal((await t.json("/api/v1/classes")).status, 403);
  await p.json(`/api/v1/users/${teacher.id}/permissions`, "PUT", { overrides: [] });
  assert.equal((await t.json("/api/v1/classes")).status, 200);

  // منع: تعديل الذات، تعديل مدير النظام، منح settings:manage
  assert.equal((await p.json(`/api/v1/users/${me.id}`, "PATCH", { role: "TEACHER" })).status, 400);
  assert.equal((await p.json(`/api/v1/users/${admin.id}`, "PATCH", { active: false })).status, 403);
  assert.equal(
    (await p.json(`/api/v1/users/${teacher.id}/permissions`, "PUT", { overrides: [{ permission: "settings:manage", granted: true }] })).status,
    403
  );

  // إنشاء معلمة جديدة
  const email = `new${Date.now()}@school.sa`;
  const created = await p.json("/api/v1/users", "POST", { name: "أ. جديدة", email, role: "TEACHER", classIds: [classes["ج"].id] });
  assert.equal(created.status, 200, JSON.stringify(created.data));
  const n = new Client();
  assert.equal(await n.signIn("staff", { email, password: created.data.tempPassword }), null);

  // تعطيل الحساب يقطع الجلسة القائمة فوراً
  await p.json(`/api/v1/users/${created.data.id}`, "PATCH", { active: false });
  assert.equal((await n.json("/api/v1/account/2fa/setup", "POST")).status, 401);
});

test("الطالبة: دخول بالصور، جلسة معزولة، وقفل بعد 5 محاولات", async () => {
  const t = await staff("teacher@school.sa", "Teacher123!");
  const A = classes["أ"];
  const roster = await new Client().json(`/api/v1/auth/class-roster?code=${A.joinCode}`);
  assert.equal(roster.status, 200);
  assert.deepEqual(Object.keys(roster.data.students[0]).sort(), ["avatar", "displayName", "id"]); // لا بيانات أخرى
  const [s1, s2] = roster.data.students;

  const gen = await t.json(`/api/v1/classes/${A.id}/picture-codes`, "POST", { studentIds: [s1.id, s2.id] });
  assert.equal(gen.status, 200);
  const code1 = gen.data.cards.find((c: any) => c.id === s1.id).code.join("-");

  const st = new Client();
  assert.equal(await st.signIn("student", { classCode: A.joinCode, studentId: s1.id, code: code1 }), null);
  assert.equal((await st.req("/student")).status, 200);
  assert.equal((await st.json("/api/v1/classes")).status, 401); // الطالبة ليست من الطاقم
  assert.equal((await st.req("/dashboard")).status, 307);

  // رمز الفصل الخاطئ لا يعمل حتى مع رمز صور صحيح
  assert.equal(await new Client().signIn("student", { classCode: classes["ب"].joinCode, studentId: s1.id, code: code1 }), "INVALID");

  // 5 محاولات خاطئة ⇒ قفل، ثم حتى الرمز الصحيح مرفوض
  const bad = new Client();
  const wrong = gen.data.cards.find((c: any) => c.id === s2.id).code.map((x: number) => (x + 1) % 9).join("-");
  const code2 = gen.data.cards.find((c: any) => c.id === s2.id).code.join("-");
  const results = [];
  for (let i = 0; i < 5; i++) results.push(await bad.signIn("student", { classCode: A.joinCode, studentId: s2.id, code: wrong }));
  assert.equal(results.at(-1), "LOCKED");
  assert.equal(await bad.signIn("student", { classCode: A.joinCode, studentId: s2.id, code: code2 }), "LOCKED");

  // إعادة توليد الرمز من المعلمة يفك القفل
  const regen = await t.json(`/api/v1/classes/${A.id}/picture-codes`, "POST", { studentIds: [s2.id] });
  assert.equal(await bad.signIn("student", { classCode: A.joinCode, studentId: s2.id, code: regen.data.cards[0].code.join("-") }), null);
});

test("قفل حساب الطاقم بعد 5 كلمات مرور خاطئة", async () => {
  const c = new Client();
  const r = [];
  for (let i = 0; i < 5; i++) r.push(await c.signIn("staff", { email: "teacher2@school.sa", password: "nope" }));
  assert.equal(r.at(-1), "LOCKED");
  assert.equal(await c.signIn("staff", { email: "teacher2@school.sa", password: "Teacher123!" }), "LOCKED");
  await prisma.user.update({ where: { email: "teacher2@school.sa" }, data: { lockedUntil: null, failedLogins: 0 } });
});

test("سجل التدقيق يوثّق العمليات الحساسة", async () => {
  const actions = (await prisma.auditLog.findMany({ select: { action: true } })).map((a) => a.action);
  for (const a of ["LOGIN", "LOGIN_FAILED", "MFA_ENABLED", "PERMISSIONS_UPDATED", "USER_CREATED", "PICTURE_CODES_RESET", "SUPERVISOR_COMMENT", "SENSITIVE_VIEW"]) {
    assert.ok(actions.includes(a), a);
  }
  await prisma.$disconnect();
});
