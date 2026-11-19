import { test } from "node:test";
import assert from "node:assert/strict";

process.env.FIELD_ENCRYPTION_KEY = Buffer.alloc(32, 7).toString("base64");

import { base32Encode, hotp, totp, verifyTotp, generateSecret } from "../src/lib/totp";
import { encryptField, decryptField, maskId } from "../src/lib/crypto";
import { parseCode, randomPictureCode, serializeCode, randomJoinCode } from "../src/lib/pictureCode";

test("HOTP يطابق متجهات RFC 4226", () => {
  const secret = base32Encode(Buffer.from("12345678901234567890"));
  const expected = ["755224", "287082", "359152", "969429", "338314"];
  expected.forEach((code, i) => assert.equal(hotp(secret, i), code));
});

test("TOTP يقبل الرمز الحالي والسابق ويرفض البعيد", () => {
  const s = generateSecret();
  const now = Date.now();
  assert.ok(verifyTotp(s, totp(s, now), now));
  assert.ok(verifyTotp(s, totp(s, now - 30_000), now));
  assert.ok(!verifyTotp(s, totp(s, now - 120_000), now));
  assert.ok(!verifyTotp(s, "abc123", now));
});

test("تشفير الحقول: ذهاب وإياب، ونص مشفّر مختلف كل مرة، وكشف العبث", () => {
  const a = encryptField("1098765432");
  const b = encryptField("1098765432");
  assert.notEqual(a, b);
  assert.equal(decryptField(a), "1098765432");
  const parts = a.split(":");
  parts[3] = Buffer.from("tampered").toString("base64");
  assert.throws(() => decryptField(parts.join(":")));
});

test("إقناع الهوية", () => {
  assert.equal(maskId("5432"), "••••••5432");
  assert.equal(maskId(null), "—");
});

test("رمز الصور: توليد وتحليل", () => {
  const c = randomPictureCode();
  assert.equal(c.length, 4);
  assert.deepEqual(parseCode(serializeCode(c)), c);
  assert.equal(parseCode("1-2-3"), null);
  assert.equal(parseCode("1-2-3-9"), null);
  assert.match(randomJoinCode(), /^[A-HJ-NP-Z2-9]{6}$/);
});

import { checkEnv } from "../src/lib/env";

test("فحص البيئة: يرفض أسرار التطوير والمفاتيح الضعيفة في الإنتاج", () => {
  const good = {
    NODE_ENV: "production",
    DATABASE_URL: "postgresql://x",
    NEXTAUTH_SECRET: "q8Z3vY1n0Wm2Lk5Rt7Pb9Xc4Ds6Fg8Hj",
    FIELD_ENCRYPTION_KEY: Buffer.alloc(32, 9).toString("base64"),
    NEXTAUTH_URL: "https://lughati.school.sa",
  };
  assert.deepEqual(checkEnv(good), []);
  const bad = checkEnv({ ...good, NEXTAUTH_SECRET: "dev-secret", FIELD_ENCRYPTION_KEY: "MDEyMzQ1Njc4OWFiY2RlZjAxMjM0NTY3ODlhYmNkZWY=", NEXTAUTH_URL: "http://x", REQUIRE_STAFF_2FA: "false" });
  assert.deepEqual(bad.map((i) => i.key).sort(), ["FIELD_ENCRYPTION_KEY", "NEXTAUTH_SECRET", "NEXTAUTH_URL", "REQUIRE_STAFF_2FA"]);
  assert.ok(bad.every((i) => i.level === "error"));
  assert.ok(checkEnv({ ...good, NODE_ENV: "development", NEXTAUTH_SECRET: "x" }).every((i) => i.level === "warn"));
  assert.ok(checkEnv({ ...good, FILE_STORAGE_DRIVER: "s3" }).some((i) => i.key === "S3_BUCKET"));
});
