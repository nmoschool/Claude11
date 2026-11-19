import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { decryptField } from "@/lib/crypto";
import { verifyTotp } from "@/lib/totp";
import { rateLimitIp, clientIp, LIMITS } from "@/lib/rateLimit";
import { audit } from "@/lib/audit";
import {
  parseCode,
  serializeCode,
  STUDENT_LOCK_MINUTES,
  STUDENT_MAX_FAILS,
} from "@/lib/pictureCode";

const STAFF_SESSION_MS = 8 * 60 * 60 * 1000;
const STUDENT_SESSION_MS = 60 * 60 * 1000;
const STAFF_MAX_FAILS = 5;
const STAFF_LOCK_MINUTES = 15;

const DUMMY_HASH = bcrypt.hashSync("timing-equalizer", 10);

export const require2fa = () => process.env.REQUIRE_STAFF_2FA !== "false";

/**
 * رموز الأخطاء التي تصل للواجهة عبر signIn(...).error
 * INVALID | LOCKED | OTP_REQUIRED | OTP_INVALID | RATE_LIMITED
 */
export const authOptions: NextAuthOptions = {
  session: { strategy: "jwt", maxAge: STAFF_SESSION_MS / 1000 },
  pages: { signIn: "/login" },
  providers: [
    // ---------------- الطاقم: بريد + كلمة مرور + TOTP ----------------
    CredentialsProvider({
      id: "staff",
      name: "staff",
      credentials: {
        email: { type: "email" },
        password: { type: "password" },
        otp: { type: "text" },
      },
      async authorize(credentials, req) {
        const ip = clientIp(req?.headers as any);
        if (!rateLimitIp("login", ip, LIMITS.staffLogin(), 60_000)) throw new Error("RATE_LIMITED");

        const email = credentials?.email?.trim().toLowerCase();
        const password = credentials?.password ?? "";
        if (!email || !password) throw new Error("INVALID");

        const user = await prisma.user.findUnique({ where: { email } });
        if (!user || !user.active) {
          await bcrypt.compare(password, DUMMY_HASH); // توحيد زمن الاستجابة لمنع كشف الحسابات
          throw new Error("INVALID");
        }
        if (user.lockedUntil && user.lockedUntil > new Date()) throw new Error("LOCKED");

        const fail = async (code: string) => {
          const fails = user.failedLogins + 1;
          await prisma.user.update({
            where: { id: user.id },
            data: {
              failedLogins: fails >= STAFF_MAX_FAILS ? 0 : fails,
              lockedUntil:
                fails >= STAFF_MAX_FAILS
                  ? new Date(Date.now() + STAFF_LOCK_MINUTES * 60_000)
                  : user.lockedUntil,
            },
          });
          await audit({ actorId: user.id, action: "LOGIN_FAILED", entity: "User", entityId: user.id, reason: code, ip: ip ?? undefined });
          throw new Error(fails >= STAFF_MAX_FAILS ? "LOCKED" : code);
        };

        if (!(await bcrypt.compare(password, user.passwordHash))) await fail("INVALID");

        if (user.totpEnabled && user.totpSecret) {
          const otp = credentials?.otp?.trim();
          if (!otp) throw new Error("OTP_REQUIRED");
          if (!verifyTotp(decryptField(user.totpSecret), otp)) await fail("OTP_INVALID");
        }

        await prisma.user.update({
          where: { id: user.id },
          data: { failedLogins: 0, lockedUntil: null, lastLoginAt: new Date() },
        });
        await audit({ actorId: user.id, action: "LOGIN", entity: "User", entityId: user.id, ip: ip ?? undefined });

        return {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          kind: "staff" as const,
          mfaSetupRequired: require2fa() && !user.totpEnabled,
        };
      },
    }),

    // ---------------- الطالبات: رمز الفصل + الاسم + تسلسل الصور ----------------
    CredentialsProvider({
      id: "student",
      name: "student",
      credentials: {
        classCode: { type: "text" },
        studentId: { type: "text" },
        code: { type: "text" },
      },
      async authorize(credentials, req) {
        const ip = clientIp(req?.headers as any);
        if (!rateLimitIp("student-login", ip, LIMITS.studentLogin(), 60_000)) throw new Error("RATE_LIMITED");

        const classCode = credentials?.classCode?.trim().toUpperCase();
        const code = parseCode(credentials?.code ?? "");
        if (!classCode || !credentials?.studentId || !code) throw new Error("INVALID");

        const student = await prisma.student.findFirst({
          where: { id: credentials.studentId, archived: false, class: { joinCode: classCode } },
        });
        if (!student || !student.pictureCodeHash) throw new Error("INVALID");
        if (student.lockedUntil && student.lockedUntil > new Date()) throw new Error("LOCKED");

        const ok = await bcrypt.compare(serializeCode(code), student.pictureCodeHash);
        if (!ok) {
          const fails = student.failedLogins + 1;
          const lock = fails >= STUDENT_MAX_FAILS;
          await prisma.student.update({
            where: { id: student.id },
            data: {
              failedLogins: lock ? 0 : fails,
              lockedUntil: lock ? new Date(Date.now() + STUDENT_LOCK_MINUTES * 60_000) : null,
            },
          });
          throw new Error(lock ? "LOCKED" : "INVALID");
        }

        await prisma.student.update({
          where: { id: student.id },
          data: { failedLogins: 0, lockedUntil: null, lastLoginAt: new Date() },
        });
        await audit({ actorId: student.id, actorType: "STUDENT", action: "LOGIN", entity: "Student", entityId: student.id, ip: ip ?? undefined });

        return { id: student.id, name: student.displayName, role: "STUDENT" as const, kind: "student" as const };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user, trigger }) {
      if (user) {
        token.id = user.id;
        token.role = user.role;
        token.kind = user.kind;
        token.mfaSetupRequired = user.mfaSetupRequired ?? false;
        token.expiresAt =
          Date.now() + (user.kind === "student" ? STUDENT_SESSION_MS : STAFF_SESSION_MS);
      }
      // بعد تفعيل 2FA تستدعي الواجهة update() لتحديث الحالة من القاعدة
      if (trigger === "update" && token.kind === "staff" && token.id) {
        const u = await prisma.user.findUnique({ where: { id: token.id } });
        token.mfaSetupRequired = !!u && require2fa() && !u.totpEnabled;
      }
      // انتهاء الجلسة حسب نوع المستخدم (الطالبة 60 دقيقة)
      if (token.expiresAt && Date.now() > token.expiresAt) {
        return { expired: true } as any;
      }
      return token;
    },
    async session({ session, token }) {
      if (token.id && token.role && token.kind) {
        session.user = {
          ...session.user,
          id: token.id,
          name: session.user?.name ?? "",
          role: token.role,
          kind: token.kind,
          mfaSetupRequired: token.mfaSetupRequired,
        };
      } else {
        (session as any).user = undefined;
      }
      return session;
    },
  },
};
