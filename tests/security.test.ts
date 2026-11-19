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
