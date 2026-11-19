/**
 * اختبارات طرف-لطرف للمرحلة 3: سجل الدرجات، الأوزان، الاعتماد، التصدير، PDF.
 * تتطلب بذرة جديدة: npm run db:seed
 */
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { PrismaClient } from "@prisma/client";
import { Client, staff, resetAuthState } from "./helpers";
import { studentResult } from "../../src/lib/gradeCalc";

const prisma = new PrismaClient();
let T: Client, S: Client, P: Client;
let A = "", C = "", term = "";

before(async () => {
  await resetAuthState(prisma);
  T = await staff("teacher@school.sa", "Teacher123!");
  S = await staff("supervisor@school.sa", "Supervisor123!");
  P = await staff("principal@school.sa", "Principal123!");
  const classes = await prisma.schoolClass.findMany();
  A = classes.find((c) => c.section === "أ")!.id;
  C = classes.find((c) => c.section === "ج")!.id;
  term = (await prisma.term.findFirstOrThrow({ where: { number: 1 } })).id;
  await prisma.gradeLock.deleteMany();
});
after(() => prisma.$disconnect());

const gb = (c: Client, cls = A) => c.json(`/api/v1/classes/${cls}/gradebook?term=${term}`);

test("السجل: الحساب على الخادم يطابق دوال الحساب المختبرة لكل طالبة", async () => {
  const { status, data } = await gb(T);
  assert.equal(status, 200);
  assert.equal(data.rows.length, await prisma.student.count({ where: { classId: A, archived: false } }));
  assert.equal(data.items.length, 12);
  for (const r of data.rows) {
    const entries = Object.entries(r.cells).map(([itemId, c]: [string, any]) => ({ itemId, ...c }));
    const expect = studentResult(data.scheme.components, data.items, entries, { scale: data.scheme.gradeScale, absentAsZero: true });
    assert.deepEqual(r.result, expect, r.student.fullName);
    // النهائي (30) لم يُرصد بعد ⇒ 70٪، ومن غابت بعذر عن الفتري (10) ⇒ 60٪
    // (والطالبات المضافات في اختبارات سابقة بلا درجات ⇒ 0٪)
    const midExcused = Object.values(r.cells).some((c: any) => c.status === "EXCUSED");
    const none = Object.keys(r.cells).length === 0;
    assert.equal(r.result.completeness, none ? 0 : midExcused ? 60 : 70, r.student.fullName);
  }
  assert.ok(data.skills.length >= 8);
  assert.ok(data.totalStats.mean > 0);
  assert.equal(data.gradeDistribution.reduce((s: number, d: any) => s + d.count, 0), data.rows.filter((r: any) => r.result.total !== null).length);
});

test("السجل: المشرفة تقرأ ولا ترصد، والمعلمة لا ترى فصلاً خارج نطاقها", async () => {
  assert.equal((await gb(S)).status, 200);
  const item = (await gb(T)).data.items[0];
  const st = (await gb(T)).data.rows[0].student.id;
  assert.equal((await S.json(`/api/v1/grade-items/${item.id}/entries`, "PUT", { entries: [{ studentId: st, score: 1, status: "NORMAL" }] })).status, 403);
  assert.equal((await gb(T, C)).status, 403);
  const cItem = await prisma.gradeItem.create({ data: { classId: C, termId: term, componentId: item.componentId, title: "فصل ج", maxScore: 10, date: new Date() } });
  assert.equal((await T.json(`/api/v1/grade-items/${cItem.id}/entries`, "PUT", { entries: [{ studentId: st, score: 1, status: "NORMAL" }] })).status, 404);
  await prisma.gradeItem.delete({ where: { id: cItem.id } });
});

test("الرصد: تحقق من الحدود، الغياب/العذر، ورفض الطالبة الدخيلة", async () => {
  const g = (await gb(T)).data;
  const it = g.items.find((i: any) => i.maxScore === 10);
  const [s1, s2] = g.rows.map((r: any) => r.student.id);
  const put = (entries: any[]) => T.json(`/api/v1/grade-items/${it.id}/entries`, "PUT", { entries });
  assert.equal((await put([{ studentId: s1, score: 11, status: "NORMAL" }])).status, 400);
  assert.equal((await put([{ studentId: s1, score: 7.125, status: "NORMAL" }])).status, 400);
  const cStudent = await prisma.student.findFirstOrThrow({ where: { classId: C } });
  assert.equal((await put([{ studentId: cStudent.id, score: 5, status: "NORMAL" }])).status, 400);

  const ok = await put([{ studentId: s1, score: 9.5, status: "NORMAL" }, { studentId: s2, score: 3, status: "EXCUSED" }]);
  assert.equal(ok.status, 200);
  const after = (await gb(T)).data.rows;
  assert.deepEqual(after[0].cells[it.id], { score: 9.5, status: "NORMAL" });
  assert.deepEqual(after[1].cells[it.id], { score: null, status: "EXCUSED" }, "حالة العذر تُفرغ الدرجة");
  assert.equal((await put([{ studentId: s1, score: 9.5, status: "NORMAL" }])).data.changed, 0, "لا تغيير = لا كتابة");
});

test("التقييمات: إضافة، منع خفض العظمى تحت درجات مرصودة، وحذف بتأكيد", async () => {
  const g = (await gb(T)).data;
  const final = g.scheme.components.find((c: any) => c.kind === "FINAL");
  const created = await T.json(`/api/v1/classes/${A}/grade-items`, "POST", { componentId: final.id, title: "النهائي التحريري", maxScore: 60, date: "2026-12-20", skillCodes: ["READ.COMP"] });
  assert.equal(created.status, 200, JSON.stringify(created.data));
  const st = g.rows[0].student.id;
  await T.json(`/api/v1/grade-items/${created.data.id}/entries`, "PUT", { entries: [{ studentId: st, score: 50, status: "NORMAL" }] });
  assert.equal((await T.json(`/api/v1/grade-items/${created.data.id}`, "PATCH", { maxScore: 40 })).status, 409);
  const row = (await gb(T)).data.rows[0];
  assert.equal(row.result.completeness, 100);
  assert.equal((await T.json(`/api/v1/grade-items/${created.data.id}`, "DELETE")).status, 409);
  assert.equal((await T.json(`/api/v1/grade-items/${created.data.id}?confirm=1`, "DELETE")).status, 200);
  assert.equal((await S.json(`/api/v1/classes/${A}/grade-items`, "POST", { componentId: final.id, title: "x y", maxScore: 10, date: "2026-12-20" })).status, 403);
});

test("الأوزان: يجب أن يكون المجموع 100، ولا يُحذف مكوّن مستخدم", async () => {
  const s = (await T.json(`/api/v1/terms/${term}/scheme`)).data;
  const body = (components: any[]) => ({ components, gradeScale: s.gradeScale, absentAsZero: true });
  const comps = s.components.map(({ id, kind, title, weight }: any) => ({ id, kind, title, weight }));
  assert.equal((await T.json(`/api/v1/terms/${term}/scheme`, "PUT", body(comps.map((c: any, i: number) => (i === 0 ? { ...c, weight: 15 } : c))))).status, 400);
  assert.equal((await T.json(`/api/v1/terms/${term}/scheme`, "PUT", body(comps.slice(1).map((c: any, i: number) => (i === 0 ? { ...c, weight: 20 } : c))))).status, 409);
  const swapped = comps.map((c: any) => (c.kind === "PERFORMANCE" ? { ...c, weight: 15 } : c.kind === "FINAL" ? { ...c, weight: 35 } : c));
  const ok = await T.json(`/api/v1/terms/${term}/scheme`, "PUT", body(swapped));
  assert.equal(ok.status, 200, JSON.stringify(ok.data));
  // إعادة الأوزان الأصلية
  assert.equal((await T.json(`/api/v1/terms/${term}/scheme`, "PUT", body(comps))).status, 200);
  assert.equal((await S.json(`/api/v1/terms/${term}/scheme`, "PUT", body(comps))).status, 403);
});

test("الاعتماد: القفل يمنع الإضافة ويجمّد الأوزان ويشترط سبباً موثقاً للتعديل", async () => {
  const g = (await gb(T)).data;
  const it = g.items[0];
  const st = g.rows[3].student.id;
  assert.equal((await S.json(`/api/v1/classes/${A}/grade-lock`, "POST", { termId: term })).status, 403);
  assert.equal((await T.json(`/api/v1/classes/${A}/grade-lock`, "POST", { termId: term })).status, 200);
  assert.ok((await gb(T)).data.lock);

  const put = (reason?: string) => T.json(`/api/v1/grade-items/${it.id}/entries`, "PUT", { entries: [{ studentId: st, score: 1, status: "NORMAL" }], reason });
  assert.equal((await put()).status, 409);
  assert.equal((await put("قصير")).status, 409);
  const before = (await gb(T)).data.rows[3].cells[it.id];
  assert.equal((await put("تصحيح خطأ في الرصد بعد مراجعة الورقة")).status, 200);
  const log = await prisma.auditLog.findFirstOrThrow({ where: { action: "GRADES_CHANGED_AFTER_LOCK", entityId: it.id }, orderBy: { createdAt: "desc" } });
  assert.equal(log.reason, "تصحيح خطأ في الرصد بعد مراجعة الورقة");
  assert.deepEqual((log.before as any[])[0], { studentId: st, ...before });
  assert.deepEqual((log.after as any[])[0], { studentId: st, score: 1, status: "NORMAL" });

  const comp = g.scheme.components[0];
  assert.equal((await T.json(`/api/v1/classes/${A}/grade-items`, "POST", { componentId: comp.id, title: "بعد القفل", maxScore: 5, date: "2026-12-01" })).status, 409);
  const s = (await T.json(`/api/v1/terms/${term}/scheme`)).data;
  assert.equal(s.weightsFrozen, true);
  assert.equal((await T.json(`/api/v1/terms/${term}/scheme`, "PUT", { components: s.components, gradeScale: s.gradeScale, absentAsZero: false })).status, 409);

  assert.equal((await T.json(`/api/v1/classes/${A}/grade-lock`, "DELETE", { termId: term })).status, 400);
  assert.equal((await P.json(`/api/v1/classes/${A}/grade-lock`, "DELETE", { termId: term, reason: "إعادة فتح لإضافة النهائي" })).status, 200, "القائدة تفك الاعتماد");
  assert.equal((await gb(T)).data.lock, null);
});

test("التصدير: CSV عربي بـ BOM ومحمي من حقن الصيغ، Excel، وملف «نور» يحترم صلاحية الهوية", async () => {
  const st = await prisma.student.create({ data: { classId: A, fullName: "=HYPERLINK(\"http://x\") اختبار", displayName: "اختبار" } });
  try {
    const csv = await T.req(`/api/v1/classes/${A}/gradebook/export?term=${term}&format=csv`);
    assert.equal(csv.status, 200);
    const buf = Buffer.from(await csv.arrayBuffer());
    assert.deepEqual([...buf.subarray(0, 3)], [0xef, 0xbb, 0xbf], "BOM");
    const text = buf.toString("utf8");
    assert.match(text, /اسم الطالبة/);
    assert.match(text, /"'=HYPERLINK\(""http:\/\/x""\) اختبار"/, "الصيغة مُعطّلة بعلامة '");
    assert.ok(!/^=|,=/m.test(text));

    const x = await S.req(`/api/v1/classes/${A}/gradebook/export?term=${term}&format=xlsx`);
    assert.equal(x.status, 200, "المشرفة تصدّر");
    assert.equal(Buffer.from(await x.arrayBuffer()).subarray(0, 2).toString(), "PK");

    const tNoor = await (await T.req(`/api/v1/classes/${A}/gradebook/export?term=${term}&format=noor`)).text();
    const sNoor = await (await S.req(`/api/v1/classes/${A}/gradebook/export?term=${term}&format=noor`)).text();
    assert.match(tNoor.split("\r\n")[0], /رقم الهوية/);
    assert.match(tNoor, /,1\d{9},/, "المعلمة ترى الهوية");
    assert.ok(!/رقم الهوية/.test(sNoor.split("\r\n")[0]), "المشرفة بلا عمود الهوية");
    assert.match(sNoor.split("\r\n")[0], /الاختبارات القصيرة \(20\)/);
  } finally {
    await prisma.student.delete({ where: { id: st.id } });
  }
  assert.equal((await T.req(`/api/v1/classes/${C}/gradebook/export?term=${term}&format=csv`)).status, 403);
});

test("قوالب الطباعة وPDF: بطاقة الطالبة، الكشف، والتقرير الجماعي، مع منع المسارات الخارجية", async () => {
  const st = (await gb(T)).data.rows[0].student.id;
  for (const path of [`/print/report-card/${st}?term=${term}`, `/print/gradebook/${A}?term=${term}`, `/print/class-report/${A}?term=${term}`]) {
    const page = await T.req(path);
    assert.equal(page.status, 200, path);
    const html = await page.text();
    assert.match(html, /وزارة التعليم/);
  }
  const pdf = await T.req(`/api/v1/pdf?path=${encodeURIComponent(`/print/report-card/${st}?term=${term}`)}&name=بطاقة`);
  if (pdf.status === 501) {
    console.log("⚠️ Chromium غير متاح على هذا الخادم — تم تخطي فحص PDF");
  } else {
    assert.equal(pdf.status, 200, await pdf.clone().text());
    assert.equal(pdf.headers.get("content-type"), "application/pdf");
    const b = Buffer.from(await pdf.arrayBuffer());
    assert.equal(b.subarray(0, 5).toString(), "%PDF-");
    assert.ok(b.length > 5000);
  }
  for (const bad of ["/dashboard/admin/users", "http://169.254.169.254/latest", "/print/../api/v1/users", "//evil.example/print/x/y"]) {
    assert.equal((await T.req(`/api/v1/pdf?path=${encodeURIComponent(bad)}`)).status, 400, bad);
  }
  // فصل خارج النطاق: الصفحة نفسها ترفض فيرفض PDF
  const cStudent = await prisma.student.findFirstOrThrow({ where: { classId: C } });
  assert.equal((await T.req(`/print/report-card/${cStudent.id}?term=${term}`)).status, 404);
  if (pdf.status !== 501) assert.equal((await T.req(`/api/v1/pdf?path=${encodeURIComponent(`/print/report-card/${cStudent.id}?term=${term}`)}`)).status, 403);
  // غير المصادَق يُحوَّل لصفحة الدخول
  assert.equal((await new Client().req(`/print/gradebook/${A}?term=${term}`)).status, 307);
});
