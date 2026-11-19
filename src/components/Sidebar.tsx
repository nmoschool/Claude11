"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import Logo from "@/components/Logo";
import type { Permission } from "@/lib/permissions";

interface NavItem {
  href: string;
  label: string;
  icon: string;
  perm?: Permission;
  phase?: number; // وحدة لم تُفعَّل بعد — تظهر معطّلة مع رقم المرحلة
}

const NAV: NavItem[] = [
  { href: "/dashboard", label: "الرئيسية", icon: "🏠" },
  { href: "/dashboard/classes", label: "الفصول والطالبات", icon: "👧", perm: "students:read" },
  { href: "/dashboard/curriculum", label: "توزيع المنهج", icon: "🗓️", perm: "curriculum:read" },
  { href: "/dashboard/gradebook", label: "سجل الدرجات", icon: "📊", perm: "grades:read" },
  { href: "/dashboard/reports", label: "التقارير", icon: "📈", perm: "reports:read" },
  { href: "/dashboard/assessments", label: "أوراق العمل والاختبارات", icon: "📝", perm: "assessments:read" },
  { href: "/dashboard/games", label: "الألعاب التعليمية", icon: "🎮", perm: "reports:read", phase: 5 },
  { href: "/dashboard/admin/users", label: "المستخدمون والصلاحيات", icon: "🔐", perm: "users:manage" },
  { href: "/dashboard/audit", label: "سجل التدقيق", icon: "🧾", perm: "audit:read" },
  { href: "/dashboard/account/security", label: "حسابي والأمان", icon: "🛡️" },
];

export default function Sidebar({ perms }: { perms: Permission[] }) {
  const pathname = usePathname();
  const items = NAV.filter((i) => !i.perm || perms.includes(i.perm));

  return (
    <aside className="no-print hidden w-64 shrink-0 border-l border-gray-200 bg-white md:block">
      <div className="flex h-16 items-center gap-2 border-b border-gray-100 px-5">
        <Logo />
        <div>
          <div className="text-sm font-black leading-tight">منصة لغتي</div>
          <div className="text-xs leading-tight text-gray-400">الصف الرابع</div>
        </div>
      </div>
      <nav className="space-y-1 p-3">
        {items.map((item) => {
          const active = item.href === "/dashboard" ? pathname === item.href : pathname.startsWith(item.href);
          if (item.phase) {
            return (
              <div key={item.href} className="flex cursor-not-allowed items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-bold text-gray-300" title="ضمن خطة التنفيذ">
                <span className="text-lg grayscale">{item.icon}</span>
                {item.label}
                <span className="badge mr-auto bg-gray-100 text-[10px] text-gray-400">م{item.phase}</span>
              </div>
            );
          }
          return (
            <Link key={item.href} href={item.href}
              className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-bold transition-colors ${active ? "bg-brand-50 text-brand-700" : "text-gray-600 hover:bg-gray-50"}`}>
              <span className="text-lg">{item.icon}</span>
              {item.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
