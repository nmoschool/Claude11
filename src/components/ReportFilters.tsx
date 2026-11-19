"use client";

import { useRouter } from "next/navigation";

export default function ReportFilters({ classes, terms, classId, termId }: { classes: { id: string; label: string }[]; terms: { id: string; title: string }[]; classId: string; termId: string }) {
  const router = useRouter();
  const go = (c: string, t: string) => router.push(`/dashboard/reports?class=${c}&term=${t}`);
  return (
    <div className="flex gap-2">
      <select className="input w-auto" aria-label="الفصل" value={classId} onChange={(e) => go(e.target.value, termId)}>{classes.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}</select>
      <select className="input w-auto" aria-label="الفصل الدراسي" value={termId} onChange={(e) => go(classId, e.target.value)}>{terms.map((t) => <option key={t.id} value={t.id}>{t.title}</option>)}</select>
    </div>
  );
}
