"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export default function ClassTabs({ classId, label, showCalendar }: { classId: string; label: string; showCalendar: boolean }) {
  const path = usePathname();
  const base = `/dashboard/classes/${classId}`;
  const tabs = [
    { href: base, label: "👧 الطالبات" },
    { href: `${base}/attendance`, label: "✅ الحضور" },
    ...(showCalendar ? [{ href: `${base}/calendar`, label: "🗓️ التقويم" }] : []),
  ];
  return (
    <div className="no-print mb-5">
      <div className="mb-3 text-sm text-gray-400">
        <Link href="/dashboard/classes" className="hover:text-gray-600">الفصول</Link> ← <span className="font-bold text-gray-700">{label}</span>
      </div>
      <nav className="flex gap-1 border-b border-gray-200">
        {tabs.map((t) => (
          <Link key={t.href} href={t.href}
            className={`-mb-px border-b-2 px-4 py-2 text-sm font-bold ${path === t.href ? "border-brand-600 text-brand-700" : "border-transparent text-gray-500 hover:text-gray-800"}`}>
            {t.label}
          </Link>
        ))}
      </nav>
    </div>
  );
}
