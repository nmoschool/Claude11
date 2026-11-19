/** أدوات مشتركة لاختبارات طرف-لطرف */
import assert from "node:assert/strict";
import type { PrismaClient } from "@prisma/client";
import { totp } from "../../src/lib/totp";

export const BASE = process.env.BASE_URL ?? "http://localhost:3000";

export class Client {
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

  async upload(path: string, fields: Record<string, string | { name: string; data: Buffer | string; type?: string }>) {
    const fd = new FormData();
    for (const [k, v] of Object.entries(fields)) {
      if (typeof v === "string") fd.append(k, v);
      else fd.append(k, new Blob([typeof v.data === "string" ? v.data : new Uint8Array(v.data)], { type: v.type ?? "application/octet-stream" }), v.name);
    }
    const res = await this.req(path, { method: "POST", body: fd });
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

export const secrets: Record<string, string> = {};

/** دخول + تفعيل 2FA (أول مرة) + إعادة الدخول بالرمز */
export async function staff(email: string, password: string): Promise<Client> {
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


export async function resetAuthState(prisma: PrismaClient) {
  await prisma.user.updateMany({ data: { totpEnabled: false, totpSecret: null, failedLogins: 0, lockedUntil: null } });
  await prisma.student.updateMany({ data: { failedLogins: 0, lockedUntil: null } });
  for (const k of Object.keys(secrets)) delete secrets[k];
}
