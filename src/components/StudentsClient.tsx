"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import StudentImportModal from "@/components/StudentImportModal";

interface Student {
  id: string;
  fullName: string;
  studentNumber: string;
  grade: number;
  guardianPhone: string | null;
  class: { id: string; name: string };
}

export default function StudentsClient({ students }: { students: Student[] }) {
  const router = useRouter();
  const [showImport, setShowImport] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({
    fullName: "",
    studentNumber: "",
    grade: 1,
    className: "",
    guardianPhone: "",
  });
  const [filter, setFilter] = useState("");
  const [saving, setSaving] = useState(false);

  async function addStudent(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const res = await fetch("/api/students", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    setSaving(false);
    if (res.ok) {
      setForm({ fullName: "", studentNumber: "", grade: 1, className: "", guardianPhone: "" });
      setShowAdd(false);
      router.refresh();
    } else {
      const data = await res.json().catch(() => ({}));
      alert(data.error ?? "تعذر إضافة الطالب");
    }
  }

  async function removeStudent(id: string) {
    if (!confirm("إيقاف تفعيل هذا الطالب؟")) return;
    await fetch(`/api/students/${id}`, { method: "DELETE" });
    router.refresh();
  }

  const filtered = students.filter(
    (s) =>
      s.fullName.includes(filter) ||
      s.studentNumber.includes(filter) ||
      s.class.name.includes(filter)
  );

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-black text-gray-900">إدارة الطلاب</h1>
          <p className="text-sm text-gray-500">{students.length} طالباً مسجلاً</p>
        </div>
        <div className="flex gap-2">
          <button className="btn-secondary" onClick={() => setShowAdd((v) => !v)}>
            ＋ إضافة طالب يدوياً
          </button>
          <button className="btn-primary" onClick={() => setShowImport(true)}>
            ⭳ استيراد من Excel
          </button>
        </div>
      </div>

      {showAdd && (
        <form onSubmit={addStudent} className="card grid grid-cols-1 gap-3 p-5 sm:grid-cols-5">
          <input
            required
            className="input"
            placeholder="اسم الطالب"
            value={form.fullName}
            onChange={(e) => setForm({ ...form, fullName: e.target.value })}
          />
          <input
            required
            className="input"
            placeholder="رقم الطالب"
            value={form.studentNumber}
            onChange={(e) => setForm({ ...form, studentNumber: e.target.value })}
          />
          <select
            className="input"
            value={form.grade}
            onChange={(e) => setForm({ ...form, grade: Number(e.target.value) })}
          >
            <option value={1}>الأول</option>
            <option value={2}>الثاني</option>
          </select>
          <input
            required
            className="input"
            placeholder="الفصل (مثال: 1/أ)"
            value={form.className}
            onChange={(e) => setForm({ ...form, className: e.target.value })}
          />
          <button className="btn-primary" disabled={saving}>
            {saving ? "جارِ الحفظ..." : "حفظ"}
          </button>
        </form>
      )}

      <input
        className="input max-w-xs"
        placeholder="بحث بالاسم أو الرقم أو الفصل..."
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
      />

      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-500">
            <tr>
              <th className="p-3 text-right font-bold">الاسم</th>
              <th className="p-3 text-right font-bold">الرقم</th>
              <th className="p-3 text-right font-bold">الصف</th>
              <th className="p-3 text-right font-bold">الفصل</th>
              <th className="p-3 text-right font-bold">جوال ولي الأمر</th>
              <th className="p-3 text-right font-bold"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {filtered.map((s) => (
              <tr key={s.id} className="hover:bg-gray-50">
                <td className="p-3 font-bold text-gray-900">{s.fullName}</td>
                <td className="p-3 text-gray-600" dir="ltr">{s.studentNumber}</td>
                <td className="p-3 text-gray-600">{s.grade === 1 ? "الأول" : "الثاني"}</td>
                <td className="p-3 text-gray-600">{s.class.name}</td>
                <td className="p-3 text-gray-600" dir="ltr">{s.guardianPhone ?? "—"}</td>
                <td className="p-3">
                  <button
                    onClick={() => removeStudent(s.id)}
                    className="text-xs font-bold text-red-600 hover:underline"
                  >
                    إيقاف
                  </button>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={6} className="p-8 text-center text-gray-400">
                  لا يوجد طلاب مطابقون
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {showImport && <StudentImportModal onClose={() => setShowImport(false)} />}
    </div>
  );
}
