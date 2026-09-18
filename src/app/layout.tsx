import type { Metadata } from "next";
import { Tajawal } from "next/font/google";
import "./globals.css";
import Providers from "@/components/Providers";

const tajawal = Tajawal({
  subsets: ["arabic"],
  weight: ["300", "400", "500", "700", "800", "900"],
  variable: "--font-tajawal",
  display: "swap",
});

export const metadata: Metadata = {
  title: "منصة رياضيات 1448 | الصفين الأول والثاني الابتدائي",
  description:
    "منصة تعليمية متكاملة لمعلمي الرياضيات للصفين الأول والثاني الابتدائي وفق منهج وزارة التعليم السعودية 1448",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ar" dir="rtl" className={tajawal.variable}>
      <body className="min-h-screen font-sans text-gray-900 antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
