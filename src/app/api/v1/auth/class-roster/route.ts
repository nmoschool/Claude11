import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { rateLimitIp, clientIp, LIMITS } from "@/lib/rateLimit";
import { jsonError } from "@/lib/guard";

/** عام: يعرض الاسم الأول والصورة الرمزية فقط لطالبات الفصل صاحب الرمز (لشاشة الدخول) */
export async function GET(req: Request) {
  if (!rateLimitIp("roster", clientIp(req.headers), LIMITS.roster(), 60_000)) {
    return jsonError(429, "RATE_LIMITED", "محاولات كثيرة، انتظري قليلاً");
  }
  const code = new URL(req.url).searchParams.get("code")?.trim().toUpperCase();
  if (!code || !/^[A-Z0-9]{6}$/.test(code)) return jsonError(400, "INVALID", "رمز الفصل غير صحيح");

  const cls = await prisma.schoolClass.findUnique({
    where: { joinCode: code },
    include: {
      students: {
        where: { archived: false, pictureCodeHash: { not: null } },
        select: { id: true, displayName: true, avatar: true },
        orderBy: { displayName: "asc" },
      },
    },
  });
  if (!cls) return jsonError(404, "NOT_FOUND", "لم نجد فصلاً بهذا الرمز");
  return NextResponse.json({ label: `الرابع / ${cls.section}`, students: cls.students });
}
