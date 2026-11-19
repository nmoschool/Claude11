import type { CertificateData } from "@/lib/certificate";
import { formatGregorian, formatHijri } from "@/lib/dates";

/** شهادة A4 أفقية — تُعرض للطالبة وتُطبع/تُحوَّل PDF بالقالب نفسه */
export default function CertificateView({ c }: { c: CertificateData }) {
  return (
    <div className="certificate relative mx-auto aspect-[297/210] w-full max-w-[1000px] overflow-hidden rounded-2xl bg-white print:rounded-none" style={{ fontFamily: "var(--font-tajawal)" }}>
      <style>{`@page { size: A4 landscape; margin: 0; } @media print { .certificate { width: 297mm !important; max-width: none !important; height: 210mm; } }`}</style>
      <div className="absolute inset-[3%] rounded-xl border-[6px] border-double border-brand-600" />
      <div className="absolute inset-[5%] rounded-lg border border-accent-300" />
      <div className="absolute left-[6%] top-[6%] text-[4vw] opacity-20 print:text-6xl">🌸</div>
      <div className="absolute bottom-[6%] right-[6%] text-[4vw] opacity-20 print:text-6xl">⭐</div>
      <div className="relative flex h-full flex-col items-center justify-center px-[12%] text-center">
        <div className="text-[1.3vw] text-gray-500 print:text-sm">المملكة العربية السعودية — وزارة التعليم — {c.schoolName}</div>
        <div className="mt-[2%] text-[4.2vw] font-black text-brand-700 print:text-5xl">شهادة تقدير</div>
        <div className="mt-[2%] text-[1.6vw] text-gray-600 print:text-lg">تتشرف معلمة مادة لغتي بمنح الطالبة المتميزة</div>
        <div className="mt-[1.5%] border-b-2 border-dotted border-accent-400 px-[4%] pb-[1%] text-[3.4vw] font-black text-gray-900 print:text-4xl">{c.studentName}</div>
        <div className="mt-[2.5%] text-[2.4vw] font-black text-accent-700 print:text-3xl">{c.title}</div>
        {c.reason && <div className="mt-[1%] text-[1.5vw] text-gray-600 print:text-base">{c.reason}</div>}
        <div className="mt-[2%] text-[1.4vw] text-gray-600 print:text-base">متمنيةً لها دوام التفوق والنجاح 🌷</div>
        <div className="mt-[4%] flex w-full items-end justify-between">
          <div className="text-[1.2vw] print:text-sm">
            <div className="text-gray-500">معلمة المادة</div>
            <div className="mt-1 font-bold">{c.teacherName}</div>
          </div>
          <div className="text-[1.2vw] text-gray-500 print:text-sm">
            {formatHijri(c.issuedAt)}<br />{formatGregorian(c.issuedAt)}
          </div>
          <div className="flex items-end gap-2 text-left">
            <div className="text-[0.9vw] leading-tight text-gray-400 print:text-[9px]">للتحقق امسحي الرمز<br /><span dir="ltr" className="font-mono">{c.verifyCode}</span></div>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={c.qr} alt={`رمز التحقق ${c.verifyCode}`} className="h-[9vw] w-[9vw] print:h-24 print:w-24" />
          </div>
        </div>
      </div>
    </div>
  );
}
