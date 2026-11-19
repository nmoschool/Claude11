/**
 * اختبارات طرف-لطرف للمرحلة 2: توزيع المنهج، التقويم، الطالبات، الحضور، السلوك، الملاحظات، الملفات.
 * تتطلب بذرة جديدة: npm run db:seed
 */
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import ExcelJS from "exceljs";
import { PrismaClient } from "@prisma/client";
import { Client, staff, resetAuthState } from "./helpers";
import { hashNationalId } from "../../src/lib/crypto";

const prisma = new PrismaClient();
let T: Client; // معلمة 4/أ و4/ب
let S: Client; // مشرفة 4/أ و4/ب
let termId = "";
let A = "", C = "";

before(async () => {
  await resetAuthState(prisma);
  T = await staff("teacher@school.sa", "Teacher123!");
  S = await staff("supervisor@school.sa", "Supervisor123!");
  const classes = await prisma.schoolClass.findMany();
  A = classes.find((c) => c.section === "أ")!.id;
  C = classes.find((c) => c.section === "ج")!.id;
});
after(() => prisma.$disconnect());

const isoDay = (d: Date) => d.toISOString().slice(0, 10);
const riyadhToday = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Riyadh" }).format(new Date());

// ------------------------------------------------------------------ المنهج
test("التوزيع: عرض الخطة والتغطية للمعلمة والمشرفة", async () => {
  const terms = await T.json("/api/v1/terms");
  assert.equal(terms.status, 200);
  termId = terms.data.terms[0].id;
  const plan = await S.json(`/api/v1/terms/${termId}/plan`);
  assert.equal(plan.status, 200);
  assert.equal(plan.data.units.length, 3);
  assert.ok(plan.data.weeks.find((w: any) => w.number === 9).holiday, "الأسبوع 9 إجازة");
  assert.ok(plan.data.coverage.due > 0 && plan.data.coverage.percent < 100, "يوجد تأخر نموذجي");
});

test("التوزيع: إعادة الجدولة مع الإزاحة تتخطى أسبوع الإجازة، والمعاينة لا تحفظ", async () => {
  const plan = (await T.json(`/api/v1/terms/${termId}/plan`)).data;
  const wk = (n: number) => plan.weeks.find((w: any) => w.number === n).id;
  const all = plan.units.flatMap((u: any) => u.lessons);
  const inWeek = (p: any, n: number) => p.units.flatMap((u: any) => u.lessons).filter((l: any) => l.weekId === wk(n)).map((l: any) => l.id);
  const target = all.find((l: any) => l.weekId === wk(8));
  const week8 = inWeek(plan, 8);

  assert.equal((await T.json(`/api/v1/lessons/${target.id}/reschedule`, "POST", { toWeekId: wk(9), shiftFollowing: false })).status, 400);

  const dry = await T.json(`/api/v1/lessons/${target.id}/reschedule`, "POST", { toWeekId: wk(10), shiftFollowing: true, dryRun: true });
  assert.equal(dry.status, 200);
  assert.ok(dry.data.moves.length > 1);
  assert.deepEqual(inWeek((await T.json(`/api/v1/terms/${termId}/plan`)).data, 8), week8, "المعاينة لا تغيّر شيئاً");

  const r = await T.json(`/api/v1/lessons/${target.id}/reschedule`, "POST", { toWeekId: wk(10), shiftFollowing: true, markPostponed: true });
  assert.equal(r.data.applied, true);
  const after = (await T.json(`/api/v1/terms/${termId}/plan`)).data;
  assert.equal(inWeek(after, 9).length, 0, "لا شيء في أسبوع الإجازة");
  const moved = after.units.flatMap((u: any) => u.lessons).find((l: any) => l.id === target.id);
  assert.equal(moved.weekId, wk(10));
  assert.equal(moved.status, "POSTPONED");
});

test("التوزيع: المشرفة لا تعدّل، والمعلمة تضيف وتحذف درساً", async () => {
  const plan = (await T.json(`/api/v1/terms/${termId}/plan`)).data;
  const lesson = plan.units[0].lessons[0];
  assert.equal((await S.json(`/api/v1/lessons/${lesson.id}`, "PATCH", { status: "DONE" })).status, 403);
  assert.equal((await S.json(`/api/v1/terms/${termId}/holidays`, "POST", { title: "x", start: "2026-10-01", end: "2026-10-01" })).status, 403);

  const created = await T.json(`/api/v1/units/${plan.units[0].id}/lessons`, "POST", { title: "درس إضافي", kind: "SPELLING", skillCodes: ["SPELL.TAA"], weekId: plan.weeks[0].id });
  assert.equal(created.status, 200, JSON.stringify(created.data));
  assert.equal((await T.json(`/api/v1/units/${plan.units[0].id}/lessons`, "POST", { title: "مهارة مجهولة", kind: "SPELLING", skillCodes: ["NOPE"] })).status, 400);
  assert.equal((await T.json(`/api/v1/lessons/${created.data.id}`, "DELETE")).status, 200);
});

async function planXlsx(rows: (string | number)[][]) {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("x");
  ws.addRow(["الأسبوع", "الوحدة", "الدرس", "المكوّن", "عدد الحصص", "الأهداف", "رموز المهارات"]);
  rows.forEach((r) => ws.addRow(r));
  return Buffer.from(await wb.xlsx.writeBuffer());
}

test("التوزيع: القالب يُستورد كما هو، والملف الخاطئ يُرفض بتفصيل الأخطاء", async () => {
  const tpl = await T.req("/api/v1/curriculum/template");
  assert.equal(tpl.status, 200);
  const tplBuf = Buffer.from(await tpl.arrayBuffer());
  const dryTpl = await T.upload(`/api/v1/terms/${termId}/import`, { file: { name: "t.xlsx", data: tplBuf }, mode: "replace", dryRun: "1" });
  assert.equal(dryTpl.data.valid, 2, JSON.stringify(dryTpl.data.rows?.map((r: any) => r.errors)));

  const bad = await planXlsx([[1, "و1", "درس", "نص قرائي", 1, "", ""], [99, "", "", "شيء", 1, "", "XX"]]);
  const dryBad = await T.upload(`/api/v1/terms/${termId}/import`, { file: { name: "b.xlsx", data: bad }, mode: "append", dryRun: "1" });
  assert.equal(dryBad.data.valid, 1);
  assert.ok(dryBad.data.rows[1].errors.length >= 3);
  assert.equal((await T.upload(`/api/v1/terms/${termId}/import`, { file: { name: "b.xlsx", data: bad }, mode: "append" })).status, 400);

  // ملف غير جدولي
  assert.equal((await T.upload(`/api/v1/terms/${termId}/import`, { file: { name: "x.xlsx", data: "not a spreadsheet" }, dryRun: "1" })).status, 400);
});

// ------------------------------------------------------------------ التقويم
test("التقويم: إضافة حدث، نقله بالسحب (PATCH date) مع حفظ التاريخ الأصلي، وتصدير iCal", async () => {
  const e = await T.json(`/api/v1/classes/${A}/events`, "POST", { type: "QUIZ", title: "اختبار الإملاء", date: "2026-12-01" });
  assert.equal(e.status, 200);
  assert.equal((await T.json(`/api/v1/events/${e.data.id}`, "PATCH", { date: "2026-12-03" })).status, 200);
  assert.equal((await T.json(`/api/v1/events/${e.data.id}`, "PATCH", { date: "2026-12-05" })).status, 400, "السبت مرفوض");
  const cal = await T.json(`/api/v1/classes/${A}/calendar?from=2026-11-29&to=2026-12-12`);
  const ev = cal.data.events.find((x: any) => x.id === e.data.id);
  assert.equal(isoDay(new Date(ev.date)), "2026-12-03");
  assert.equal(isoDay(new Date(ev.rescheduledFrom)), "2026-12-01");
  assert.ok(cal.data.weeks.length >= 1);

  const ics = await T.req(`/api/v1/classes/${A}/calendar.ics`);
  const text = await ics.text();
  assert.match(ics.headers.get("content-type")!, /text\/calendar/);
  assert.match(text, /SUMMARY:اختبار قصير: اختبار الإملاء/);
  assert.match(text, /DTSTART;VALUE=DATE:20261203/);

  assert.equal((await S.json(`/api/v1/classes/${A}/events`, "POST", { type: "QUIZ", title: "x y", date: "2026-12-01" })).status, 403);
  assert.equal((await T.json(`/api/v1/classes/${C}/events`, "POST", { type: "QUIZ", title: "x y", date: "2026-12-01" })).status, 403);
  assert.equal((await S.json(`/api/v1/events/${e.data.id}`, "DELETE")).status, 403);
  assert.equal((await T.json(`/api/v1/events/${e.data.id}`, "DELETE")).status, 200);
});

// ------------------------------------------------------------------ الطالبات
let newStudent = "";
test("الطالبات: إضافة مع تشفير، منع تكرار الهوية، والمشرفة ترى المقنّع ولا تعدّل", async () => {
  const r = await T.json(`/api/v1/classes/${A}/students`, "POST", { fullName: "تجربة   أحمد   الاختبار", nationalId: "١٢٣٤٥٦٧٨٩٠", guardianPhone: "+966501112233" });
  assert.equal(r.status, 200, JSON.stringify(r.data));
  newStudent = r.data.id;
  const row = await prisma.student.findUniqueOrThrow({ where: { id: newStudent } });
  assert.equal(row.fullName, "تجربة أحمد الاختبار");
  assert.equal(row.displayName, "تجربة");
  assert.ok(row.nationalIdEnc && !row.nationalIdEnc.includes("1234567890"));
  assert.equal(row.nationalIdHash, hashNationalId("1234567890"));

  assert.equal((await T.json(`/api/v1/classes/${A}/students`, "POST", { fullName: "مكررة الهوية هنا", nationalId: "1234567890" })).status, 409);
  assert.equal((await T.json(`/api/v1/classes/${A}/students`, "POST", { fullName: "هوية خاطئة هنا", nationalId: "123" })).status, 400);

  const tp = await T.json(`/api/v1/students/${newStudent}`);
  assert.equal(tp.data.student.nationalId, "1234567890");
  assert.equal(tp.data.student.guardianPhone, "0501112233");
  const sp = await S.json(`/api/v1/students/${newStudent}`);
  assert.equal(sp.status, 200);
  assert.equal(sp.data.student.nationalId, "••••••7890");
  assert.equal(sp.data.student.guardianPhone, "مخفي");
  assert.equal((await S.json(`/api/v1/students/${newStudent}`, "PATCH", { fullName: "تغيير غير مسموح" })).status, 403);

  // نطاق: المعلمة لا ترى طالبة فصل ج
  const cStudent = await prisma.student.findFirstOrThrow({ where: { classId: C } });
  assert.equal((await T.json(`/api/v1/students/${cStudent.id}`)).status, 404);
  assert.equal((await T.json(`/api/v1/students/${newStudent}`, "PATCH", { classId: C })).status, 403);
});

test("الطالبات: الأرشفة والاستعادة", async () => {
  assert.equal((await T.json(`/api/v1/students/${newStudent}`, "PATCH", { archived: true })).status, 200);
  const active = await T.json(`/api/v1/classes/${A}/students`);
  assert.ok(!active.data.students.some((s: any) => s.id === newStudent));
  const arch = await T.json(`/api/v1/classes/${A}/students?archived=1`);
  assert.ok(arch.data.students.some((s: any) => s.id === newStudent));
  await T.json(`/api/v1/students/${newStudent}`, "PATCH", { archived: false });
});

test("استيراد نور: جديدة/تحديث/تعارض/خطأ، معاينة مقنّعة، وإعادة الاستيراد لا تكرر", async () => {
  const cStudent = await prisma.student.findFirstOrThrow({ where: { classId: C } });
  await prisma.student.update({ where: { id: cStudent.id }, data: { nationalIdHash: hashNationalId("2000000001") } });
  const csv = [
    "م,اسم الطالب,رقم الهوية,جوال ولي الأمر,تاريخ الميلاد,اسم ولي الأمر",
    "1,ريما سعد المستوردة,1999999991,0551231234,2017-01-20,سعد",
    "2,تجربة أحمد الاختبار,1234567890,,,",
    "3,طالبة في فصل آخر,2000000001,,,",
    "4,هوية خاطئة جداً,12,,,",
  ].join("\n");
  const file = { name: "noor.csv", data: "﻿" + csv, type: "text/csv" };
  const dry = await T.upload(`/api/v1/classes/${A}/students/import`, { file, dryRun: "1" });
  assert.equal(dry.status, 200, JSON.stringify(dry.data));
  assert.deepEqual(dry.data.counts, { create: 1, update: 1, conflict: 1, error: 1 });
  assert.equal(dry.data.mapping.guardianName, "اسم ولي الأمر");
  assert.ok(!JSON.stringify(dry.data).includes("1999999991"), "المعاينة لا تكشف الهوية كاملة");

  assert.equal((await S.upload(`/api/v1/classes/${A}/students/import`, { file, dryRun: "1" })).status, 403);

  const real = await T.upload(`/api/v1/classes/${A}/students/import`, { file });
  assert.equal(real.data.applied, true);
  const again = await T.upload(`/api/v1/classes/${A}/students/import`, { file, dryRun: "1" });
  assert.equal(again.data.counts.create ?? 0, 0, "لا تكرار");
  const imported = await prisma.student.findFirstOrThrow({ where: { nationalIdHash: hashNationalId("1999999991") } });
  assert.equal(imported.classId, A);
  assert.equal(imported.guardianName, "سعد");
});

// ------------------------------------------------------------------ الحضور
test("الحضور: تنبيه الغياب المتتالي، حفظ دفعة، رفض المستقبل والطالبة الدخيلة، والمشرفة قراءة فقط", async () => {
  const y = new Date(riyadhToday() + "T00:00:00Z");
  do y.setUTCDate(y.getUTCDate() - 1); while (y.getUTCDay() > 4);
  const before = await T.json(`/api/v1/classes/${A}/attendance?date=${isoDay(y)}`);
  assert.ok(before.data.students.some((s: any) => s.streak >= 3), "البذرة فيها غياب 3 أيام");

  const today = riyadhToday();
  const list = (await T.json(`/api/v1/classes/${A}/attendance?date=${today}`)).data.students;
  const records = list.map((s: any, i: number) => ({ studentId: s.id, status: i === 0 ? "ABSENT" : "PRESENT", note: i === 0 ? "مريضة" : null }));
  const put = await T.json(`/api/v1/classes/${A}/attendance`, "PUT", { date: today, records });
  assert.equal(put.status, 200);
  assert.equal(put.data.counts.ABSENT, 1);
  const got = await S.json(`/api/v1/classes/${A}/attendance?date=${today}`);
  assert.equal(got.data.students[0].status, "ABSENT");
  assert.equal(got.data.students[0].note, "مريضة");

  // التحديث (upsert) لا يكرر السجل
  await T.json(`/api/v1/classes/${A}/attendance`, "PUT", { date: today, records: [{ studentId: list[0].id, status: "EXCUSED" }] });
  assert.equal(await prisma.attendance.count({ where: { studentId: list[0].id, date: new Date(today + "T00:00:00Z") } }), 1);

  const future = new Date(Date.now() + 3 * 86400000).toISOString().slice(0, 10);
  assert.equal((await T.json(`/api/v1/classes/${A}/attendance`, "PUT", { date: future, records: [] })).status, 400);
  const cStudent = await prisma.student.findFirstOrThrow({ where: { classId: C } });
  assert.equal((await T.json(`/api/v1/classes/${A}/attendance`, "PUT", { date: today, records: [{ studentId: cStudent.id, status: "PRESENT" }] })).status, 400);
  assert.equal((await S.json(`/api/v1/classes/${A}/attendance`, "PUT", { date: today, records })).status, 403);
});

// ------------------------------------------------------------------ السلوك والملاحظات
test("السلوك والملاحظات: الخصوصية تجاه المشرفة وحدود الحذف", async () => {
  assert.equal((await T.json(`/api/v1/students/${newStudent}/behavior`, "POST", { category: "مشاركة", positive: true, points: 3 })).status, 200);
  assert.equal((await S.json(`/api/v1/students/${newStudent}/behavior`, "POST", { category: "مشاركة", positive: true })).status, 403);

  const priv = await T.json(`/api/v1/students/${newStudent}/notes`, "POST", { kind: "GUARDIAN_CONTACT", body: "اتصال بولي الأمر بخصوص ظرف خاص", visibleToSupervisor: false });
  const pub = await T.json(`/api/v1/students/${newStudent}/notes`, "POST", { kind: "REMEDIAL", body: "خطة علاجية للقراءة الجهرية" });
  assert.equal(priv.status, 200);
  assert.equal((await S.json(`/api/v1/students/${newStudent}/notes`, "POST", { kind: "ACADEMIC", body: "ليست من صلاحيتها" })).status, 403);
  const sup = await S.json(`/api/v1/students/${newStudent}/notes`, "POST", { kind: "SUPERVISOR", body: "متابعة إشرافية" });
  assert.equal(sup.status, 200);

  const sView = (await S.json(`/api/v1/students/${newStudent}`)).data;
  assert.ok(!sView.notes.some((n: any) => n.id === priv.data.id), "الملاحظة الخاصة مخفية عن المشرفة");
  assert.ok(sView.notes.some((n: any) => n.id === pub.data.id));
  const tView = (await T.json(`/api/v1/students/${newStudent}`)).data;
  assert.equal(tView.notes.length, 3);
  assert.equal(tView.behavior.points, 3);

  assert.equal((await S.json(`/api/v1/notes/${pub.data.id}`, "DELETE")).status, 403, "المشرفة لا تحذف ملاحظة المعلمة");
  assert.equal((await T.json(`/api/v1/notes/${sup.data.id}`, "DELETE")).status, 403, "المعلمة لا تحذف ملاحظة المشرفة");
  assert.equal((await T.json(`/api/v1/notes/${priv.data.id}`, "DELETE")).status, 200);
});

// ------------------------------------------------------------------ الملفات
function pngWithText(text: string) {
  const chunk = (type: string, data: Buffer) => { const l = Buffer.alloc(4); l.writeUInt32BE(data.length); return Buffer.concat([l, Buffer.from(type, "latin1"), data, Buffer.alloc(4)]); };
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk("IHDR", Buffer.alloc(13)), chunk("tEXt", Buffer.from(text)), chunk("IDAT", Buffer.alloc(8)), chunk("IEND", Buffer.alloc(0))]);
}

test("الملفات: كشف النوع الحقيقي، إزالة البيانات الوصفية، حجب التقارير الطبية، وحد الحجم", async () => {
  const up = await T.upload(`/api/v1/students/${newStudent}/files`, { file: { name: "تعبير.png", data: pngWithText("GPS 24.71,46.67"), type: "image/png" }, category: "WORK" });
  assert.equal(up.status, 200, JSON.stringify(up.data));
  const dl = await S.req(`/api/v1/files/${up.data.id}`);
  assert.equal(dl.status, 200);
  assert.match(dl.headers.get("content-disposition")!, /attachment/);
  const body = Buffer.from(await dl.arrayBuffer());
  assert.ok(body.includes(Buffer.from("IDAT")) && !body.includes(Buffer.from("GPS")), "أُزيلت البيانات الوصفية");

  const html = await T.upload(`/api/v1/students/${newStudent}/files`, { file: { name: "صورة.png", data: "<html><script>alert(1)</script></html>", type: "image/png" }, category: "WORK" });
  assert.equal(html.status, 415, "ملف HTML متنكر بامتداد png مرفوض");

  const med = await T.upload(`/api/v1/students/${newStudent}/files`, { file: { name: "تقرير.pdf", data: "%PDF-1.4 medical report body", type: "application/pdf" }, category: "MEDICAL" });
  assert.equal(med.status, 200);
  const sFiles = (await S.json(`/api/v1/students/${newStudent}`)).data.files;
  assert.ok(!sFiles.some((f: any) => f.id === med.data.id), "التقرير الطبي مخفي عن المشرفة");
  assert.equal((await S.req(`/api/v1/files/${med.data.id}`)).status, 404);
  assert.equal((await S.upload(`/api/v1/students/${newStudent}/files`, { file: { name: "a.pdf", data: "%PDF-1.4 x" }, category: "WORK" })).status, 403);

  const big = await T.upload(`/api/v1/students/${newStudent}/files`, { file: { name: "big.pdf", data: Buffer.concat([Buffer.from("%PDF-1.4 "), Buffer.alloc(11 * 1024 * 1024)]) }, category: "WORK" });
  assert.equal(big.status, 413);

  assert.equal((await S.json(`/api/v1/files/${up.data.id}`, "DELETE")).status, 403);
  assert.equal((await T.json(`/api/v1/files/${up.data.id}`, "DELETE")).status, 200);
  assert.equal((await T.req(`/api/v1/files/${up.data.id}`)).status, 404);
});

test("التدقيق يسجّل عمليات المرحلة 2 دون قيم حساسة", async () => {
  const logs = await prisma.auditLog.findMany({ where: { createdAt: { gte: new Date(Date.now() - 10 * 60_000) } } });
  const actions = new Set(logs.map((l) => l.action));
  for (const a of ["LESSON_RESCHEDULED", "EVENT_RESCHEDULED", "STUDENT_CREATED", "STUDENTS_IMPORTED", "ATTENDANCE_SAVED", "NOTE_ADDED", "FILE_UPLOADED", "FILE_DELETED", "STUDENT_ARCHIVED"]) {
    assert.ok(actions.has(a), a);
  }
  const dump = JSON.stringify(logs);
  for (const secret of ["1234567890", "1999999991", "0501112233", "0551231234"]) assert.ok(!dump.includes(secret), `قيمة حساسة في التدقيق: ${secret}`);
});
