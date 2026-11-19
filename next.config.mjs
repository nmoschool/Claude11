/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  // تُحمَّل وقت التشغيل من node_modules ولا تُحزَم (Chromium لتوليد PDF)
  serverExternalPackages: ["playwright", "playwright-core"],
};

export default nextConfig;
