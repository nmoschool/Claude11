import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";

const ADMIN_ONLY = ["/dashboard/admin"];
const TEACHER_ADMIN_ONLY = [
  "/dashboard/worksheets",
  "/dashboard/students",
  "/dashboard/gradebook",
];

export default withAuth(
  function middleware(req) {
    const { pathname } = req.nextUrl;
    const role = req.nextauth.token?.role;

    if (ADMIN_ONLY.some((p) => pathname.startsWith(p)) && role !== "ADMIN") {
      return NextResponse.redirect(new URL("/dashboard?denied=1", req.url));
    }

    if (
      TEACHER_ADMIN_ONLY.some((p) => pathname.startsWith(p)) &&
      role === "STUDENT"
    ) {
      return NextResponse.redirect(new URL("/dashboard?denied=1", req.url));
    }

    return NextResponse.next();
  },
  {
    pages: {
      signIn: "/login",
    },
    callbacks: {
      authorized: ({ token }) => !!token,
    },
  }
);

export const config = {
  matcher: ["/dashboard/:path*"],
};
