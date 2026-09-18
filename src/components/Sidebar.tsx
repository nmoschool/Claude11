"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

interface NavItem {
  href: string;
  label: string;
  icon: string;
  roles: Array<"ADMIN" | "TEACHER" | "STUDENT">;
}

const NAV_ITEMS: NavItem[] = [
  { href: "/dashboard", label: "الرئيسية", icon: "🏠", roles: ["ADMIN", "TEACHER", "STUDENT"] },
  { href: "/dashboard/curriculum", label: "خريطة المنهج", icon: "🗺️", roles: ["ADMIN", "TEACHER", "STUDENT"] },
  { href: "/dashboard/worksheets", label: "أوراق العمل والاختبارات", icon: "📝", roles: ["ADMIN", "TEACHER"] },
  { href: "/dashboard/students", label: "الطلاب", icon: "🎒", roles: ["ADMIN", "TEACHER"] },
  { href: "/dashboard/gradebook", label: "دفتر الدرجات", icon: "📊", roles: ["ADMIN", "TEACHER"] },
  { href: "/dashboard/reports", label: "لوحة الشرف والتقارير", icon: "🏆", roles: ["ADMIN", "TEACHER", "STUDENT"] },
  { href: "/dashboard/admin", label: "لوحة الإدارة", icon: "⚙️", roles: ["ADMIN"] },
];

export default function Sidebar({ role }: { role: "ADMIN" | "TEACHER" | "STUDENT" }) {
  const pathname = usePathname();

  return (
    <aside className="no-print hidden w-64 shrink-0 border-l border-gray-200 bg-white md:block">
      <div className="flex h-16 items-center gap-2 border-b border-gray-100 px-5">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-600 text-sm font-black text-white">
          ٢+٢
        </div>
        <div>
          <div className="text-sm font-black leading-tight">منصة رياضيات</div>
          <div className="text-xs text-gray-400 leading-tight">1448هـ</div>
        </div>
      </div>

      <nav className="space-y-1 p-3">
        {NAV_ITEMS.filter((item) => item.roles.includes(role)).map((item) => {
          const active =
            item.href === "/dashboard"
              ? pathname === "/dashboard"
              : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-bold transition-colors ${
                active
                  ? "bg-brand-50 text-brand-700"
                  : "text-gray-600 hover:bg-gray-50"
              }`}
            >
              <span className="text-lg">{item.icon}</span>
              {item.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
