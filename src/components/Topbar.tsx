"use client";

import { signOut } from "next-auth/react";
import { ROLE_LABELS } from "@/lib/auth";

export default function Topbar({
  name,
  role,
}: {
  name: string;
  role: "ADMIN" | "TEACHER" | "STUDENT";
}) {
  return (
    <header className="no-print flex h-16 items-center justify-between border-b border-gray-200 bg-white px-5">
      <div className="text-sm text-gray-500">
        مرحباً، <span className="font-bold text-gray-800">{name}</span>
      </div>
      <div className="flex items-center gap-3">
        <span className="badge bg-brand-50 text-brand-700">{ROLE_LABELS[role]}</span>
        <button
          onClick={() => signOut({ callbackUrl: "/login" })}
          className="btn-secondary"
        >
          تسجيل الخروج
        </button>
      </div>
    </header>
  );
}
