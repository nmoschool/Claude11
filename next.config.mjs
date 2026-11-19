const prod = process.env.NODE_ENV === "production";
// HSTS: يُقرأ وقت البناء؛ في نشر Docker يضيفه Caddy (deploy/Caddyfile) لأنه من ينهي TLS
const https = (process.env.NEXTAUTH_URL ?? "").startsWith("https://");

/**
 * سياسة أمان المحتوى (CSP): كل الموارد من نفس الأصل فقط (الخطوط مستضافة ذاتياً عبر next/font).
 * 'unsafe-inline' للسكربت مطلوب لتمهيد Next.js؛ 'unsafe-eval' في التطوير فقط.
 */
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${prod ? "" : " 'unsafe-eval'"}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "media-src 'self' blob:",
  "font-src 'self' data:",
  "connect-src 'self'",
  "worker-src 'self'",
  "manifest-src 'self'",
  "frame-ancestors 'none'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), geolocation=(), microphone=(), payment=()" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  ...(https ? [{ key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" }] : []),
];

/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: { ignoreDuringBuilds: true },
  // فحص الأنواع أثناء البناء للتطبيق فقط؛ «npm run typecheck» يفحص كل المشروع (والاختبارات والسكربتات)
  typescript: { tsconfigPath: "tsconfig.build.json" },
  poweredByHeader: false,
  output: process.env.NEXT_OUTPUT === "standalone" ? "standalone" : undefined,
  // تُحمَّل وقت التشغيل من node_modules ولا تُحزَم (Chromium لتوليد PDF)
  serverExternalPackages: ["playwright", "playwright-core"],
  async headers() {
    return [
      { source: "/:path*", headers: securityHeaders },
      // ملفات API لا تُخزَّن في وسيط مشترك (بيانات شخصية)
      { source: "/api/:path*", headers: [{ key: "Cache-Control", value: "private, no-store" }] },
      { source: "/sw.js", headers: [{ key: "Cache-Control", value: "no-cache" }, { key: "Service-Worker-Allowed", value: "/" }] },
    ];
  },
};

export default nextConfig;
