/**
 * فحص ثابت: كل واجهة API محمية بغلاف صلاحيات (withPermission للطاقم أو withStudent للطالبة)،
 * إلا قائمة صريحة من الواجهات العامة. يمنع نسيان الحماية في أي واجهة جديدة.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "fs";
import { join } from "path";

const ROOT = join(__dirname, "..", "src", "app", "api");
const PUBLIC = new Map([
  ["auth/[...nextauth]/route.ts", "NextAuth نفسه"],
  ["v1/auth/class-roster/route.ts", "شاشة دخول الطالبات: الاسم الأول والصورة فقط، مع حد معدل"],
  ["v1/health/route.ts", "فحص الصحة للمراقبة: بلا بيانات"],
]);

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? walk(p) : p.endsWith("route.ts") ? [p] : [];
  });
}

test("كل واجهات API محمية بغلاف صلاحيات", () => {
  const files = walk(ROOT);
  assert.ok(files.length > 50, `عدد الواجهات ${files.length}`);
  const unguarded: string[] = [];
  for (const f of files) {
    const rel = f.slice(ROOT.length + 1).replace(/\\/g, "/");
    if (PUBLIC.has(rel)) continue;
    const src = readFileSync(f, "utf8");
    const exports = [...src.matchAll(/export\s+(?:const|async function|function)\s+(GET|POST|PUT|PATCH|DELETE)\b([^\n]*)/g)];
    assert.ok(exports.length, `${rel}: لا توجد معالجات`);
    for (const [, method, rest] of exports) {
      if (!/=\s*with(Permission|Student)\b/.test(rest)) unguarded.push(`${method} ${rel}`);
    }
  }
  assert.deepEqual(unguarded, [], `واجهات بلا حماية:\n${unguarded.join("\n")}`);
});

test("الواجهات الذاتية (selfService) مقتصرة على «حسابي»", () => {
  const offenders = walk(ROOT)
    .filter((f) => readFileSync(f, "utf8").includes("selfService: true"))
    .map((f) => f.slice(ROOT.length + 1).replace(/\\/g, "/"))
    .filter((r) => !r.startsWith("v1/account/"));
  assert.deepEqual(offenders, []);
});

test("لا يُستخدم withPermission(null) خارج الواجهات الذاتية", () => {
  for (const f of walk(ROOT)) {
    const src = readFileSync(f, "utf8");
    if (/withPermission(<[^>]*>)?\(\s*null/.test(src)) assert.ok(src.includes("selfService: true"), f);
  }
});
