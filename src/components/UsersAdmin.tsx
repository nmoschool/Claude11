"use client";

import { useEffect, useMemo, useState } from "react";
import {
  PERMISSIONS,
  PERMISSION_GROUPS,
  ROLE_DEFAULTS,
  ROLE_LABELS,
  effectivePermissions,
  type Permission,
  type StaffRoleName,
} from "@/lib/permissions";

interface UserRow {
  id: string;
  name: string;
  email: string;
  role: StaffRoleName;
  active: boolean;
  totpEnabled: boolean;
  lockedUntil: string | null;
  lastLoginAt: string | null;
  overrides: { permission: Permission; granted: boolean }[];
  effective: Permission[];
  classLinks: { classId: string; role: string }[];
}

type Tri = "default" | "grant" | "revoke";
const EDITABLE_ROLES: StaffRoleName[] = ["TEACHER", "SUPERVISOR", "SCHOOL_ADMIN"];

async function api(url: string, method: string, body?: unknown) {
  const res = await fetch(url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error?.message_ar ?? "تعذّر تنفيذ العملية");
  return data;
}

export default function UsersAdmin({
  meId,
  myPerms,
  isSuper,
  canAssignAdmin,
  classes,
}: {
  meId: string;
  myPerms: Permission[];
  isSuper: boolean;
  canAssignAdmin: boolean;
  classes: { id: string; label: string }[];
}) {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [editing, setEditing] = useState<UserRow | null>(null);
  const [creating, setCreating] = useState(false);
  const [flash, setFlash] = useState<{ ok: boolean; text: string } | null>(null);

  async function load() {
    const data = await api("/api/v1/users", "GET");
    setUsers(data.users);
    return data.users as UserRow[];
  }
  useEffect(() => {
    load().catch((e) => setFlash({ ok: false, text: e.message }));
  }, []);

  const classLabel = (id: string) => classes.find((c) => c.id === id)?.label ?? "؟";

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-black">المستخدمون والصلاحيات</h1>
        <button className="btn-primary" onClick={() => { setCreating(true); setEditing(null); }}>＋ مستخدمة جديدة</button>
      </div>

      {flash && (
        <div className={`rounded-lg p-3 text-sm ${flash.ok ? "bg-mint-50 text-mint-700" : "bg-red-50 text-red-700"}`} role="status">
          {flash.text}
          <button className="mr-3 font-bold" onClick={() => setFlash(null)}>✕</button>
        </div>
      )}

      {creating && (
        <CreateForm
          classes={classes}
          isSuper={canAssignAdmin}
          onCancel={() => setCreating(false)}
          onDone={async (msg) => { setCreating(false); setFlash({ ok: true, text: msg }); await load(); }}
          onError={(m) => setFlash({ ok: false, text: m })}
        />
      )}

      <div className="card overflow-x-auto">
        <table className="table">
          <thead>
            <tr><th>الاسم</th><th>الدور</th><th>الفصول</th><th>2FA</th><th>الحالة</th><th>آخر دخول</th><th></th></tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} className={editing?.id === u.id ? "bg-brand-50" : ""}>
                <td>
                  <div className="font-bold">{u.name}</div>
                  <div dir="ltr" className="text-right text-xs text-gray-400">{u.email}</div>
                </td>
                <td>
                  {ROLE_LABELS[u.role]}
                  {u.overrides.length > 0 && <span className="badge mr-1 bg-accent-50 text-accent-700">مخصّص</span>}
                </td>
                <td className="text-xs">{u.classLinks.map((l) => classLabel(l.classId)).join("، ") || (u.role === "SCHOOL_ADMIN" || u.role === "SUPER_ADMIN" ? "كل الفصول" : "—")}</td>
                <td>{u.totpEnabled ? "✅" : "⚠️"}</td>
                <td>
                  {!u.active ? <span className="badge bg-gray-100 text-gray-500">معطّل</span>
                    : u.lockedUntil && new Date(u.lockedUntil) > new Date() ? <span className="badge bg-red-50 text-red-700">مقفل</span>
                    : <span className="badge bg-mint-50 text-mint-700">نشط</span>}
                </td>
                <td className="text-xs text-gray-500">{u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleString("ar-SA") : "—"}</td>
                <td>
                  {u.id !== meId && (u.role !== "SUPER_ADMIN" || isSuper) && (
                    <button className="btn-secondary" onClick={() => { setEditing(u); setCreating(false); }}>إدارة</button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {editing && (
        <EditPanel
          key={editing.id}
          user={editing}
          classes={classes}
          myPerms={myPerms}
          isSuper={canAssignAdmin}
          onClose={() => setEditing(null)}
          onSaved={async (msg) => {
            setFlash({ ok: true, text: msg });
            const fresh = await load();
            setEditing(fresh.find((u) => u.id === editing.id) ?? null);
          }}
          onError={(m) => setFlash({ ok: false, text: m })}
        />
      )}
    </div>
  );
}

function CreateForm({ classes, isSuper, onCancel, onDone, onError }: {
  classes: { id: string; label: string }[];
  isSuper: boolean;
  onCancel: () => void;
  onDone: (msg: string) => void;
  onError: (msg: string) => void;
}) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<StaffRoleName>("TEACHER");
  const [classIds, setClassIds] = useState<string[]>([]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    try {
      const r = await api("/api/v1/users", "POST", { name, email, role, classIds });
      onDone(`تم إنشاء الحساب. كلمة المرور المؤقتة: ${r.tempPassword} — سلّميها للمستخدمة، وسيُطلب منها تفعيل التحقق الثنائي عند أول دخول.`);
    } catch (err) {
      onError((err as Error).message);
    }
  }

  return (
    <form onSubmit={submit} className="card grid gap-4 p-5 md:grid-cols-2">
      <div><label className="label">الاسم</label><input className="input" required minLength={3} value={name} onChange={(e) => setName(e.target.value)} /></div>
      <div><label className="label">البريد</label><input className="input" dir="ltr" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} /></div>
      <div>
        <label className="label">الدور</label>
        <select className="input" value={role} onChange={(e) => setRole(e.target.value as StaffRoleName)}>
          {EDITABLE_ROLES.filter((r) => isSuper || r !== "SCHOOL_ADMIN").map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
        </select>
      </div>
      {role !== "SCHOOL_ADMIN" && (
        <ClassPicker classes={classes} value={classIds} onChange={setClassIds} />
      )}
      <div className="flex gap-2 md:col-span-2">
        <button className="btn-primary">إنشاء</button>
        <button type="button" className="btn-secondary" onClick={onCancel}>إلغاء</button>
      </div>
    </form>
  );
}

function ClassPicker({ classes, value, onChange }: { classes: { id: string; label: string }[]; value: string[]; onChange: (v: string[]) => void }) {
  return (
    <div>
      <label className="label">الفصول المسندة</label>
      <div className="flex flex-wrap gap-2">
        {classes.map((c) => (
          <label key={c.id} className={`cursor-pointer rounded-lg border px-3 py-1.5 text-sm ${value.includes(c.id) ? "border-brand-400 bg-brand-50 font-bold" : "border-gray-200"}`}>
            <input type="checkbox" className="ml-1" checked={value.includes(c.id)}
              onChange={(e) => onChange(e.target.checked ? [...value, c.id] : value.filter((x) => x !== c.id))} />
            {c.label}
          </label>
        ))}
      </div>
    </div>
  );
}

function EditPanel({ user, classes, myPerms, isSuper, onClose, onSaved, onError }: {
  user: UserRow;
  classes: { id: string; label: string }[];
  myPerms: Permission[];
  isSuper: boolean;
  onClose: () => void;
  onSaved: (msg: string) => void;
  onError: (msg: string) => void;
}) {
  const [role, setRole] = useState<StaffRoleName>(user.role);
  const [active, setActive] = useState(user.active);
  const [classIds, setClassIds] = useState(user.classLinks.map((l) => l.classId));
  const [tri, setTri] = useState<Record<string, Tri>>(
    Object.fromEntries(user.overrides.map((o) => [o.permission, o.granted ? "grant" : "revoke"]))
  );

  const overrides = useMemo(
    () => Object.entries(tri).filter(([, v]) => v !== "default").map(([permission, v]) => ({ permission: permission as Permission, granted: v === "grant" })),
    [tri]
  );
  const preview = effectivePermissions(role, overrides);
  const defaults = ROLE_DEFAULTS[role];

  const run = async (fn: () => Promise<unknown>, msg: string) => {
    try { await fn(); onSaved(msg); } catch (e) { onError((e as Error).message); }
  };

  return (
    <div className="card space-y-5 p-5">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-black">إدارة: {user.name}</h2>
        <button className="btn-secondary" onClick={onClose}>إغلاق</button>
      </div>

      <section className="grid gap-4 md:grid-cols-3">
        <div>
          <label className="label">الدور</label>
          <select className="input" value={role} onChange={(e) => setRole(e.target.value as StaffRoleName)}>
            {EDITABLE_ROLES.filter((r) => isSuper || r !== "SCHOOL_ADMIN" || user.role === "SCHOOL_ADMIN").map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
          </select>
        </div>
        <div>
          <label className="label">الحالة</label>
          <label className="flex items-center gap-2 py-2"><input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} /> الحساب نشط</label>
        </div>
        {role !== "SCHOOL_ADMIN" && <ClassPicker classes={classes} value={classIds} onChange={setClassIds} />}
        <div className="md:col-span-3">
          <button className="btn-primary" onClick={() => run(() => api(`/api/v1/users/${user.id}`, "PATCH", { role, active, classIds }), "تم حفظ بيانات الحساب")}>حفظ الدور والفصول</button>
        </div>
      </section>

      <section>
        <h3 className="mb-1 font-black">تخصيص الصلاحيات</h3>
        <p className="mb-3 text-xs text-gray-500">«افتراضي» يتبع الدور. الصلاحيات غير المتاحة للمنح تظهر معطّلة. المشرفة لا تُمنح أي صلاحية كتابة مهما خُصّص.</p>
        <div className="grid gap-4 lg:grid-cols-2">
          {PERMISSION_GROUPS.map((g) => (
            <div key={g.title} className="rounded-lg border border-gray-100">
              <div className="bg-gray-50 px-3 py-2 text-sm font-black">{g.title}</div>
              {g.perms.map((p) => {
                const v = tri[p] ?? "default";
                const on = preview.includes(p);
                return (
                  <div key={p} className="flex items-center justify-between gap-2 border-t border-gray-50 px-3 py-1.5 text-sm">
                    <span className={on ? "font-bold text-gray-800" : "text-gray-400"}>
                      {on ? "✅" : "⛔"} {PERMISSIONS[p]}
                      {defaults.includes(p) && <span className="mr-1 text-[10px] text-gray-400">(افتراضي للدور)</span>}
                    </span>
                    <select aria-label={PERMISSIONS[p]} className="rounded border border-gray-200 px-1 py-0.5 text-xs" value={v}
                      onChange={(e) => setTri({ ...tri, [p]: e.target.value as Tri })}>
                      <option value="default">افتراضي</option>
                      <option value="grant" disabled={!myPerms.includes(p)}>منح</option>
                      <option value="revoke">سحب</option>
                    </select>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
        <button className="btn-primary mt-3" onClick={() => run(() => api(`/api/v1/users/${user.id}/permissions`, "PUT", { overrides }), "تم حفظ الصلاحيات")}>حفظ الصلاحيات</button>
      </section>

      <section className="flex flex-wrap gap-2 border-t pt-4">
        <button className="btn-secondary" onClick={async () => {
          if (!confirm("إنشاء كلمة مرور مؤقتة جديدة؟")) return;
          try { const r = await api(`/api/v1/users/${user.id}/reset-password`, "POST"); onSaved(`كلمة المرور المؤقتة الجديدة: ${r.tempPassword}`); } catch (e) { onError((e as Error).message); }
        }}>إعادة تعيين كلمة المرور</button>
        <button className="btn-secondary" disabled={!user.totpEnabled} onClick={() => {
          if (confirm("إلغاء التحقق الثنائي؟ سيُطلب من المستخدمة إعداده من جديد.")) run(() => api(`/api/v1/users/${user.id}/reset-2fa`, "POST"), "تم إلغاء التحقق الثنائي");
        }}>إعادة ضبط التحقق الثنائي</button>
        {user.lockedUntil && new Date(user.lockedUntil) > new Date() && (
          <button className="btn-secondary" onClick={() => run(() => api(`/api/v1/users/${user.id}`, "PATCH", { unlock: true }), "تم فك القفل")}>فك القفل</button>
        )}
      </section>
    </div>
  );
}
