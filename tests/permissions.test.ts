import { test } from "node:test";
import assert from "node:assert/strict";
import { ALL_PERMISSIONS, effectivePermissions, ROLE_DEFAULTS } from "../src/lib/permissions";

test("المعلمة تملك صلاحيات الكتابة على الدرجات والمنهج", () => {
  const p = effectivePermissions("TEACHER");
  for (const x of ["grades:write", "curriculum:write", "students:write", "assessments:publish"] as const) {
    assert.ok(p.includes(x), x);
  }
  assert.ok(!p.includes("users:manage"));
});

test("المشرفة قراءة فقط افتراضياً", () => {
  const p = effectivePermissions("SUPERVISOR");
  assert.ok(p.includes("grades:read"));
  assert.ok(!p.some((x) => x.endsWith(":write")));
});

test("لا يمكن منح المشرفة صلاحية كتابة حتى بالتخصيص", () => {
  const p = effectivePermissions("SUPERVISOR", [
    { permission: "grades:write", granted: true },
    { permission: "students:sensitive", granted: true },
    { permission: "users:manage", granted: true },
  ]);
  assert.ok(!p.includes("grades:write"));
  assert.ok(!p.includes("students:sensitive"));
  assert.ok(!p.includes("users:manage"));
});

test("السحب يُزيل صلاحية افتراضية والمنح يُضيف", () => {
  const p = effectivePermissions("TEACHER", [
    { permission: "grades:lock", granted: false },
    { permission: "audit:read", granted: true },
  ]);
  assert.ok(!p.includes("grades:lock"));
  assert.ok(p.includes("audit:read"));
});

test("صلاحيات مجهولة تُتجاهل", () => {
  const p = effectivePermissions("TEACHER", [{ permission: "root:everything", granted: true }]);
  assert.deepEqual(new Set(p), new Set(ROLE_DEFAULTS.TEACHER));
});

test("مدير النظام يملك كل الصلاحيات، والطالبة لا شيء", () => {
  assert.equal(effectivePermissions("SUPER_ADMIN").length, ALL_PERMISSIONS.length);
  assert.equal(effectivePermissions("STUDENT").length, 0);
});
