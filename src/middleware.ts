import { getToken } from "next-auth/jwt";
import { NextResponse, type NextRequest } from "next/server";

/**
 * الطبقة الأولى من الحماية (المسارات). الصلاحيات الدقيقة ونطاق الفصول
 * تُفحص في الخادم عبر src/lib/guard.ts لأن الـ middleware لا يصل للقاعدة.
 */
const SECURITY_PAGE = "/dashboard/account/security";

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
  const valid = !!token?.id && !!token?.kind;

  if (pathname.startsWith("/dashboard") || pathname.startsWith("/print")) {
    if (!valid) return NextResponse.redirect(new URL("/login", req.url));
    if (token!.kind !== "staff") return NextResponse.redirect(new URL("/student", req.url));
    if (token!.mfaSetupRequired && !pathname.startsWith(SECURITY_PAGE)) {
      return NextResponse.redirect(new URL(`${SECURITY_PAGE}?setup=1`, req.url));
    }
  }

  if (pathname.startsWith("/student") && !pathname.startsWith("/student-login")) {
    if (!valid) return NextResponse.redirect(new URL("/student-login", req.url));
    if (token!.kind !== "student") return NextResponse.redirect(new URL("/dashboard", req.url));
  }

  // رؤوس الأمان (CSP, HSTS...) مضبوطة مركزياً في next.config.mjs
  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*", "/print/:path*", "/student/:path*", "/student-login"],
};
