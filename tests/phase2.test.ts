import { test } from "node:test";
import assert from "node:assert/strict";

process.env.FIELD_ENCRYPTION_KEY = Buffer.alloc(32, 7).toString("base64");

import { reschedule, isHolidayWeek, coverage, type WeekLite } from "../src/lib/schedule";
import { buildIcs, fold } from "../src/lib/ical";
import { detectType, stripJpegMetadata, stripPngMetadata, safeFileName } from "../src/lib/fileTypes";
import { guessMapping, validateRows, normalizePhone, normalizeDate } from "../src/lib/studentImport";
import { kindFromLabel, validatePlanRows } from "../src/lib/curriculum";
import { parseCsv } from "../src/lib/spreadsheet";
import { hashNationalId } from "../src/lib/crypto";
import { formatHijri } from "../src/lib/dates";

// 6 أسابيع تبدأ الأحد 2026-08-23
const weeks: WeekLite[] = Array.from({ length: 6 }, (_, i) => {
  const s = new Date(Date.UTC(2026, 7, 23 + i * 7));
  return { id: `w${i + 1}`, number: i + 1, start: s, end: new Date(s.getTime() + 4 * 86400000) };
});
const lessons = ["w1", "w1", "w2", "w3", "w4"].map((w, i) => ({ id: `L${i + 1}`, weekId: w, order: i, unitOrder: 1 }));

test("أسبوع الإجازة يُكتشف فقط إذا غطّت الإجازة كل أيام الدوام", () => {
  const full = [{ start: weeks[2].start, end: weeks[2].end }];
  const partial = [{ start: weeks[2].start, end: new Date(weeks[2].start.getTime() + 86400000) }];
  assert.ok(isHolidayWeek(weeks[2], full));
  assert.ok(!isHolidayWeek(weeks[2], partial));
});

test("نقل درس وحده", () => {
  const r = reschedule({ lessonId: "L3", toWeekId: "w5", shiftFollowing: false, lessons, weeks, holidays: [] });
  assert.deepEqual(r.moves, [{ lessonId: "L3", fromWeekId: "w2", toWeekId: "w5" }]);
});

test("تأجيل مع إزاحة التالي يتخطّى أسبوع الإجازة", () => {
  const holidays = [{ start: weeks[3].start, end: weeks[3].end }]; // الأسبوع 4 إجازة
  const r = reschedule({ lessonId: "L3", toWeekId: "w3", shiftFollowing: true, lessons, weeks, holidays });
  // L3: 2→3، L4: 3→5 (تخطّي 4)، L5 في أسبوع إجازة (4) يُعامل كالأسبوع 3 ⇒ 5
  assert.deepEqual(
    r.moves.map((m) => [m.lessonId, m.toWeekId]),
    [["L3", "w3"], ["L4", "w5"], ["L5", "w5"]]
  );
  assert.deepEqual(r.overflow, []);
});

test("التجاوز بعد آخر أسبوع يُبلَّغ عنه", () => {
  const r = reschedule({ lessonId: "L4", toWeekId: "w6", shiftFollowing: true, lessons, weeks, holidays: [] });
  assert.deepEqual(r.overflow, ["L5"]);
  assert.equal(r.moves.find((m) => m.lessonId === "L5")?.toWeekId, "w6");
});

test("رفض الجدولة في أسبوع إجازة", () => {
  const holidays = [{ start: weeks[4].start, end: weeks[4].end }];
  assert.throws(() => reschedule({ lessonId: "L1", toWeekId: "w5", shiftFollowing: false, lessons, weeks, holidays }), /إجازة/);
});

test("نسبة التغطية حتى الأسبوع الحالي", () => {
  const ls = [
    { weekId: "w1", status: "DONE" },
    { weekId: "w1", status: "DONE" },
    { weekId: "w2", status: "PLANNED" },
    { weekId: "w5", status: "PLANNED" },
  ];
  const c = coverage(ls, weeks, new Date(Date.UTC(2026, 7, 31))); // داخل الأسبوع 2
  assert.equal(c.currentWeekNumber, 2);
  assert.equal(c.due, 3);
  assert.equal(c.percent, 67);
});

test("iCal: صيغة صحيحة وطي الأسطر دون كسر الحروف العربية", () => {
  const ics = buildIcs("الرابع/أ", [{ uid: "e1", date: new Date("2026-09-01T00:00:00Z"), title: "اختبار قصير، الوحدة الأولى; " + "أ".repeat(60) }]);
  assert.match(ics, /^BEGIN:VCALENDAR\r\n/);
  assert.match(ics, /DTSTART;VALUE=DATE:20260901\r\n/);
  assert.match(ics, /DTEND;VALUE=DATE:20260902\r\n/);
  assert.match(ics, /\\،|\;/);
  for (const line of ics.split("\r\n")) assert.ok(Buffer.byteLength(line) <= 75, line);
  assert.ok(!ics.includes("�"));
  assert.equal(fold("x".repeat(10)), "x".repeat(10));
});

test("كشف نوع الملف بالبصمة لا بالامتداد", () => {
  assert.equal(detectType(Buffer.from("%PDF-1.7 xxxxxxxx"))?.mime, "application/pdf");
  assert.equal(detectType(Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0, 0, 0, 0, 0]))?.mime, "image/jpeg");
  assert.equal(detectType(Buffer.from("<html><script>alert(1)</script>")), null);
  assert.equal(detectType(Buffer.from("MZ\x90\x00 executable......")), null);
});

test("إزالة EXIF من JPEG مع الحفاظ على بيانات الصورة", () => {
  const app0 = Buffer.from([0xff, 0xe0, 0x00, 0x04, 0x4a, 0x46]);
  const exif = Buffer.concat([Buffer.from([0xff, 0xe1, 0x00, 0x08]), Buffer.from("Exif\0\0")]);
  const sos = Buffer.from([0xff, 0xda, 0x00, 0x02, 0x11, 0x22, 0xff, 0xd9]);
  const out = stripJpegMetadata(Buffer.concat([Buffer.from([0xff, 0xd8]), app0, exif, sos]));
  assert.ok(!out.includes(Buffer.from("Exif")));
  assert.ok(out.includes(app0) && out.includes(sos));
});

test("إزالة مقاطع النص من PNG", () => {
  const chunk = (type: string, data: Buffer) => {
    const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
    return Buffer.concat([len, Buffer.from(type, "latin1"), data, Buffer.alloc(4)]);
  };
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const png = Buffer.concat([sig, chunk("IHDR", Buffer.alloc(13)), chunk("tEXt", Buffer.from("GPS:24.7,46.6")), chunk("IDAT", Buffer.alloc(5)), chunk("IEND", Buffer.alloc(0))]);
  const out = stripPngMetadata(png);
  assert.ok(!out.includes(Buffer.from("GPS")));
  assert.ok(out.includes(Buffer.from("IDAT")) && out.includes(Buffer.from("IEND")));
});

test("اسم ملف آمن", () => {
  assert.equal(safeFileName("../../etc/passwd.exe", "pdf"), ".._.._etc_passwd.pdf");
  assert.equal(safeFileName("تعبير سارة.jpeg", "jpg"), "تعبير سارة.jpg");
});

test("استيراد نور: مطابقة الأعمدة تلقائياً دون خلط اسم الطالبة بولي الأمر", () => {
  const m = guessMapping(["م", "اسم ولي الأمر", "اسم الطالب", "رقم الهوية", "جوال ولي الأمر", "تاريخ الميلاد"]);
  const expected = { guardianName: "اسم ولي الأمر", guardianPhone: "جوال ولي الأمر", nationalId: "رقم الهوية", birthDate: "تاريخ الميلاد", fullName: "اسم الطالب" };
  assert.deepEqual(m, expected);
  // ترتيب آخر للأعمدة: الجوال قبل اسم ولي الأمر
  assert.deepEqual(guessMapping(["اسم الطالب", "رقم الهوية", "جوال ولي الأمر", "تاريخ الميلاد", "اسم ولي الأمر"]), expected);
});

test("استيراد نور: التحقق والتطبيع", () => {
  const rows = [
    { n: "سارة محمد العتيبي", id: "١١٢٣٤٥٦٧٨٩", p: "+966 55 123 4567", b: "15/03/2017" },
    { n: "نورة", id: "1123456789", p: "123", b: "1438/06/15" },
    { n: "", id: "99", p: "", b: "" },
  ];
  const v = validateRows(rows, { fullName: "n", nationalId: "id", guardianPhone: "p", birthDate: "b" });
  assert.deepEqual(v[0].data, { fullName: "سارة محمد العتيبي", displayName: "سارة", nationalId: "1123456789", birthDate: "2017-03-15", guardianName: null, guardianPhone: "0551234567" });
  assert.deepEqual(v[0].errors, []);
  assert.ok(v[1].errors.some((e) => e.includes("مكرر")));
  assert.equal(v[1].warnings.length, 3);
  assert.equal(v[2].errors.length, 2);
  assert.equal(normalizePhone("0551234567"), "0551234567");
  assert.equal(normalizeDate("2017-02-30"), null);
});

test("CSV بفاصلة منقوطة وعلامات اقتباس وBOM", () => {
  assert.deepEqual(parseCsv('﻿الاسم;الهوية\r\n"العتيبي; سارة";1123456789\r\n'), [["الاسم", "الهوية"], ["العتيبي; سارة", "1123456789"]]);
});

test("مكوّنات الدرس من التسميات العربية", () => {
  assert.equal(kindFromLabel("الرسم الإملائي"), "SPELLING");
  assert.equal(kindFromLabel("التواصل الكتابي"), "WRITING");
  assert.equal(kindFromLabel("الرسم الكتابي"), "HANDWRITING");
  assert.equal(kindFromLabel("نص الاستماع"), "LISTENING");
  assert.equal(kindFromLabel("شيء غريب"), null);
});

test("توزيع المنهج: التحقق ودعم الخلايا المدمجة للوحدة", () => {
  const r = validatePlanRows(
    [
      { الأسبوع: "١", الوحدة: "الوحدة الأولى", الدرس: "نص قرائي 1", المكوّن: "نص قرائي", "رموز المهارات": "READ.COMP" },
      { الأسبوع: "2", الوحدة: "", الدرس: "اللام الشمسية", المكوّن: "الرسم الإملائي", "رموز المهارات": "SPELL.X" },
      { الأسبوع: "40", الوحدة: "", الدرس: "", المكوّن: "" },
    ],
    20,
    new Set(["READ.COMP"])
  );
  assert.deepEqual(r[0].errors, []);
  assert.equal(r[1].unit, "الوحدة الأولى");
  assert.ok(r[1].errors[0].includes("SPELL.X"));
  assert.equal(r[2].errors.length, 2);
});

test("بصمة الهوية حتمية ولا تكشف الرقم", () => {
  assert.equal(hashNationalId("1123456789"), hashNationalId(" 1123456789 "));
  assert.notEqual(hashNationalId("1123456789"), hashNationalId("1123456788"));
  assert.ok(!hashNationalId("1123456789").includes("1123456789"));
});

test("التاريخ الهجري (أم القرى)", () => {
  assert.match(formatHijri("2026-08-23T00:00:00Z"), /1448/);
});
