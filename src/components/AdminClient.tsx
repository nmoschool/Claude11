"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ROLE_LABELS } from "@/lib/auth";

interface Branding {
  siteName: string;
  schoolName: string;
  primaryColor: string;
  accentColor: string;
  logoUrl: string;
  hijriYear: string;
}

interface UserRow {
  id: string;
  name: string;
  email: string;
  role: "ADMIN" | "TEACHER" | "STUDENT";
  active: boolean;
}

interface AuditRow {
  id: string;
  action: string;
  entity: string;
  entityId: string | null;
  createdAt: string;
  user: { name: string } | null;
}

const TABS = [
  { id: "branding", label: "الإعدادات العامة" },
  { id: "users", label: "المستخدمون والصلاحيات" },
  { id: "audit", label: "سجل التغييرات" },
] as const;

export default function AdminClient({
  branding: initialBranding,
  users: initialUsers,
  auditLogs,
}: {
  branding: Branding;
  users: UserRow[];
  auditLogs: AuditRow[];
}) {
  const router = useRouter();
  const [tab, setTab] = useState<(typeof TABS)[number]["id"]>("branding");
  const [branding, setBranding] = useState(initialBranding);
  const [savingBranding, setSavingBranding] = useState(false);
  const [users, setUsers] = useState(initialUsers);
  const [newUser, setNewUser] = useState({ name: "", email: "", password: "", role: "TEACHER" as const });
  const [savingUser, setSavingUser] = useState(false);
  const [userError, setUserError] = useState<string | null>(null);

  async function saveBranding(e: React.FormEvent) {
    e.preventDefault();
    setSavingBranding(true);
    await fetch("/api/admin/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(branding),
    });
    setSavingBranding(false);
    router.refresh();
  }

  async function createUser(e: React.FormEvent) {
    e.preventDefault();
    setUserError(null);
    setSavingUser(true);
    const res = await fetch("/api/admin/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(newUser),
    });
    setSavingUser(false);
    if (res.ok) {
      const created = await res.json();
      setUsers([{ ...created }, ...users]);
      setNewUser({ name: "", email: "", password: "", role: "TEACHER" });
    } else {
      const data = await res.json().catch(() => ({}));
      setUserError(data.error ?? "تعذر إنشاء المستخدم");
    }
  }

  async function toggleActive(u: UserRow) {
    const res = await fetch(`/api/admin/users/${u.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active: !u.active }),
    });
    if (res.ok) {
      setUsers(users.map((x) => (x.id === u.id ? { ...x, active: !x.active } : x)));
    }
  }

  async function changeRole(u: UserRow, role: UserRow["role"]) {
    const res = await fetch(`/api/admin/users/${u.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role }),
    });
    if (res.ok) {
      setUsers(users.map((x) => (x.id === u.id ? { ...x, role } : x)));
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex gap-2 rounded-lg border border-gray-200 bg-white p-1">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`rounded-lg px-4 py-2 text-sm font-bold ${
              tab === t.id ? "bg-brand-600 text-white" : "text-gray-600 hover:bg-gray-100"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "branding" && (
        <form onSubmit={saveBranding} className="card grid grid-cols-1 gap-4 p-5 sm:grid-cols-2">
          <div>
            <label className="label">اسم المنصة</label>
            <input
              className="input"
              value={branding.siteName}
              onChange={(e) => setBranding({ ...branding, siteName: e.target.value })}
            />
          </div>
          <div>
            <label className="label">اسم المدرسة (يظهر في المطبوعات)</label>
            <input
              className="input"
              value={branding.schoolName}
              onChange={(e) => setBranding({ ...branding, schoolName: e.target.value })}
            />
          </div>
          <div>
            <label className="label">اللون الأساسي</label>
            <div className="flex items-center gap-2">
              <input
                type="color"
                className="h-10 w-14 rounded border border-gray-300"
                value={branding.primaryColor}
                onChange={(e) => setBranding({ ...branding, primaryColor: e.target.value })}
              />
              <input
                className="input"
                dir="ltr"
                value={branding.primaryColor}
                onChange={(e) => setBranding({ ...branding, primaryColor: e.target.value })}
              />
            </div>
          </div>
          <div>
            <label className="label">لون التمييز</label>
            <div className="flex items-center gap-2">
              <input
                type="color"
                className="h-10 w-14 rounded border border-gray-300"
                value={branding.accentColor}
                onChange={(e) => setBranding({ ...branding, accentColor: e.target.value })}
              />
              <input
                className="input"
                dir="ltr"
                value={branding.accentColor}
                onChange={(e) => setBranding({ ...branding, accentColor: e.target.value })}
              />
            </div>
          </div>
          <div>
            <label className="label">رابط الشعار (اختياري)</label>
            <input
              className="input"
              dir="ltr"
              value={branding.logoUrl}
              onChange={(e) => setBranding({ ...branding, logoUrl: e.target.value })}
            />
          </div>
          <div>
            <label className="label">العام الدراسي الهجري</label>
            <input
              className="input"
              value={branding.hijriYear}
              onChange={(e) => setBranding({ ...branding, hijriYear: e.target.value })}
            />
          </div>
          <div className="sm:col-span-2">
            <button className="btn-primary" disabled={savingBranding}>
              {savingBranding ? "جارِ الحفظ..." : "حفظ الإعدادات"}
            </button>
          </div>
        </form>
      )}

      {tab === "users" && (
        <div className="space-y-4">
          <form onSubmit={createUser} className="card grid grid-cols-1 gap-3 p-5 sm:grid-cols-5">
            <input
              required
              className="input"
              placeholder="الاسم"
              value={newUser.name}
              onChange={(e) => setNewUser({ ...newUser, name: e.target.value })}
            />
            <input
              required
              type="email"
              dir="ltr"
              className="input"
              placeholder="البريد الإلكتروني"
              value={newUser.email}
              onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
            />
            <input
              required
              type="password"
              dir="ltr"
              className="input"
              placeholder="كلمة المرور (٨ أحرف فأكثر)"
              value={newUser.password}
              onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
            />
            <select
              className="input"
              value={newUser.role}
              onChange={(e) => setNewUser({ ...newUser, role: e.target.value as any })}
            >
              <option value="ADMIN">مدير النظام</option>
              <option value="TEACHER">معلم</option>
              <option value="STUDENT">طالب</option>
            </select>
            <button className="btn-primary" disabled={savingUser}>
              {savingUser ? "جارِ الإضافة..." : "＋ إضافة مستخدم"}
            </button>
            {userError && (
              <p className="sm:col-span-5 text-sm font-bold text-red-600">{userError}</p>
            )}
          </form>

          <div className="card overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-gray-500">
                <tr>
                  <th className="p-3 text-right font-bold">الاسم</th>
                  <th className="p-3 text-right font-bold">البريد الإلكتروني</th>
                  <th className="p-3 text-right font-bold">الدور</th>
                  <th className="p-3 text-right font-bold">الحالة</th>
                  <th className="p-3 text-right font-bold"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {users.map((u) => (
                  <tr key={u.id}>
                    <td className="p-3 font-bold text-gray-900">{u.name}</td>
                    <td className="p-3 text-gray-600" dir="ltr">{u.email}</td>
                    <td className="p-3">
                      <select
                        className="input"
                        value={u.role}
                        onChange={(e) => changeRole(u, e.target.value as UserRow["role"])}
                      >
                        {Object.entries(ROLE_LABELS).map(([value, label]) => (
                          <option key={value} value={value}>
                            {label}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="p-3">
                      <span className={`badge ${u.active ? "bg-brand-50 text-brand-700" : "bg-gray-100 text-gray-500"}`}>
                        {u.active ? "نشط" : "موقوف"}
                      </span>
                    </td>
                    <td className="p-3">
                      <button
                        onClick={() => toggleActive(u)}
                        className="text-xs font-bold text-brand-700 hover:underline"
                      >
                        {u.active ? "إيقاف" : "تفعيل"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === "audit" && (
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-500">
              <tr>
                <th className="p-3 text-right font-bold">التاريخ</th>
                <th className="p-3 text-right font-bold">المستخدم</th>
                <th className="p-3 text-right font-bold">الإجراء</th>
                <th className="p-3 text-right font-bold">العنصر</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {auditLogs.map((log) => (
                <tr key={log.id}>
                  <td className="p-3 text-gray-500">
                    {new Date(log.createdAt).toLocaleString("ar-SA")}
                  </td>
                  <td className="p-3 font-bold text-gray-900">{log.user?.name ?? "النظام"}</td>
                  <td className="p-3 text-gray-600">{log.action}</td>
                  <td className="p-3 text-gray-600">{log.entity}</td>
                </tr>
              ))}
              {auditLogs.length === 0 && (
                <tr>
                  <td colSpan={4} className="p-8 text-center text-gray-400">
                    لا توجد سجلات بعد
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
