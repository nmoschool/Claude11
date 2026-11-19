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
  title: "منصة لغتي | الصف الرابع الابتدائي",
  description: "منصة لغتي للصف الرابع الابتدائي: سجل الدرجات، توزيع المنهج، ملفات الطالبات، الاختبارات والألعاب التعليمية",
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
