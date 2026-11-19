import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { HttpError, jsonError } from "@/lib/guard";

type StudentRow = NonNullable<Awaited<ReturnType<typeof prisma.student.findFirst>>>;

/** غلاف واجهات الطالبة: جلسة طالبة صالحة وحساب غير مؤرشف */
export function withStudent<P = Record<string, string>>(handler: (req: Request, student: StudentRow, params: P) => Promise<unknown>) {
  return async (req: Request, route: { params: Promise<P> }) => {
    try {
      const session = await getServerSession(authOptions);
      const su = session?.user;
      if (!su || su.kind !== "student") return jsonError(401, "UNAUTHENTICATED", "يجب تسجيل الدخول");
      const student = await prisma.student.findFirst({ where: { id: su.id, archived: false } });
      if (!student) return jsonError(401, "UNAUTHENTICATED", "يجب تسجيل الدخول");
      const result = await handler(req, student, (await route?.params) ?? ({} as P));
      return result instanceof Response ? result : NextResponse.json(result ?? { ok: true });
    } catch (e) {
      if (e instanceof HttpError) return jsonError(e.status, e.code, e.message);
      if (e instanceof ZodError) return jsonError(400, "VALIDATION", "بيانات غير صالحة");
      console.error(e);
      return jsonError(500, "SERVER_ERROR", "حدث خطأ غير متوقع");
    }
  };
}
