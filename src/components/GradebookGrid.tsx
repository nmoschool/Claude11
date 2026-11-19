"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { api } from "@/lib/apiClient";
import { formatHijri, formatHijriShort } from "@/lib/dates";
import {
  itemPercent,
  parseCellInput,
  stats,
  studentResult,
  type CalcEntry,
  type EntryStatus,
} from "@/lib/gradeCalc";
import type { Gradebook } from "@/lib/gradebookService";

type G = Gradebook;
type Cell = { score: number | null; status: EntryStatus };
type Perms = { write: boolean; lock: boolean; export: boolean; reports: boolean };
interface Skill { id: string; code: string; title: string; domain: string }

const pctClass = (p: number | null) =>
  p === null ? "" : p < 50 ? "bg-red-50 text-red-700" : p < 70 ? "bg-amber-50 text-amber-800" : p >= 90 ? "bg-mint-50 text-mint-700" : "";
const show = (c?: Cell) => (!c ? "" : c.status === "ABSENT" ? "غ" : c.status === "EXCUSED" ? "ع" : c.score === null ? "" : String(c.score));

export default function GradebookGrid({ initial, classes, terms, skills, perms }: { initial: G; classes: { id: string; label: string }[]; terms: { id: string; title: string }[]; skills: Skill[]; perms: Perms }) {
  const router = useRouter();
  const [g, setG] = useState<G>(initial);
  const [cells, setCells] = useState<Record<string, Record<string, Cell>>>(() => Object.fromEntries(initial.rows.map((r) => [r.student.id, r.cells as Record<string, Cell>])));
  const [pending, setPending] = useState<Record<string, "saving" | "error">>({});
  const [flash, setFlash] = useState<{ ok: boolean; text: string } | null>(null);
  const [reason, setReason] = useState<string | null>(null);
  const [itemForm, setItemForm] = useState<"new" | G["items"][number] | null>(null);
  const [quick, setQuick] = useState<string | null>(null);
  const [showStats, setShowStats] = useState(false);
  const tableRef = useRef<HTMLTableElement>(null);

  const locked = !!g.lock;
  const editable = perms.write && (!locked || reason !== null);
  const comps = g.scheme.components;
  const itemsByComp = useMemo(() => comps.map((c) => ({ c, items: g.items.filter((i) => i.componentId === c.id) })), [comps, g.items]);
  const ordered = useMemo(() => itemsByComp.flatMap((x) => x.items), [itemsByComp]);
  const calcItems = useMemo(() => g.items.map((i) => ({ id: i.id, componentId: i.componentId, maxScore: i.maxScore, skillIds: i.skillIds })), [g.items]);

  // إعادة الحساب في المتصفح بنفس دوال الخادم (src/lib/gradeCalc.ts)
  const results = useMemo(() => {
    const m: Record<string, ReturnType<typeof studentResult>> = {};
    for (const r of g.rows) {
      const es: CalcEntry[] = Object.entries(cells[r.student.id] ?? {}).map(([itemId, c]) => ({ itemId, ...c }));
      m[r.student.id] = studentResult(comps, calcItems, es, { scale: g.scheme.gradeScale, absentAsZero: g.scheme.absentAsZero });
    }
    return m;
  }, [cells, g.rows, comps, calcItems, g.scheme]);
  const itemStats = useMemo(
    () => Object.fromEntries(g.items.map((it) => [it.id, stats(g.rows.map((r) => { const c = cells[r.student.id]?.[it.id]; return itemPercent(c && { itemId: it.id, ...c }, it.maxScore, g.scheme.absentAsZero); }))])),
    [cells, g.items, g.rows, g.scheme.absentAsZero]
  );
  const totalStats = useMemo(() => stats(Object.values(results).map((r) => r.total)), [results]);

  const reload = useCallback(async (msg?: string) => {
    const fresh = await api<G>(`/api/v1/classes/${g.class.id}/gradebook?term=${g.term.id}`);
    setG(fresh);
    setCells(Object.fromEntries(fresh.rows.map((r) => [r.student.id, r.cells as Record<string, Cell>])));
    if (msg) setFlash({ ok: true, text: msg });
  }, [g.class.id, g.term.id]);

  async function save(itemId: string, entries: { studentId: string; score: number | null; status: EntryStatus }[]) {
    const keys = entries.map((e) => `${e.studentId}:${itemId}`);
    const prev = entries.map((e) => cells[e.studentId]?.[itemId]);
    setCells((cs) => {
      const n = { ...cs };
      for (const e of entries) n[e.studentId] = { ...n[e.studentId], [itemId]: { score: e.score, status: e.status } };
      return n;
    });
    setPending((p) => ({ ...p, ...Object.fromEntries(keys.map((k) => [k, "saving" as const])) }));
    try {
      await api(`/api/v1/grade-items/${itemId}/entries`, "PUT", { entries, ...(reason ? { reason } : {}) });
      setPending((p) => { const n = { ...p }; keys.forEach((k) => delete n[k]); return n; });
    } catch (e) {
      // تراجع عن التحديث المتفائل
      setCells((cs) => {
        const n = { ...cs };
        entries.forEach((en, i) => { const row = { ...n[en.studentId] }; if (prev[i]) row[itemId] = prev[i]!; else delete row[itemId]; n[en.studentId] = row; });
        return n;
      });
      setPending((p) => ({ ...p, ...Object.fromEntries(keys.map((k) => [k, "error" as const])) }));
      setFlash({ ok: false, text: (e as Error).message });
    }
  }

  function commit(studentId: string, itemId: string, raw: string): boolean {
    const it = g.items.find((i) => i.id === itemId)!;
    const parsed = parseCellInput(raw, it.maxScore);
    if ("error" in parsed) {
      setFlash({ ok: false, text: parsed.error });
      return false;
    }
    const cur = cells[studentId]?.[itemId];
    if ((cur?.score ?? null) === parsed.score && (cur?.status ?? "NORMAL") === parsed.status) return true;
    if (!cur && parsed.score === null && parsed.status === "NORMAL") return true;
    save(itemId, [{ studentId, ...parsed }]);
    return true;
  }

  function focusCell(row: number, col: number) {
    const el = tableRef.current?.querySelector<HTMLInputElement>(`input[data-r="${row}"][data-c="${col}"]`);
    if (el) { el.focus(); el.select(); }
  }

  function onKey(e: React.KeyboardEvent<HTMLInputElement>, row: number, col: number) {
    const move: Record<string, [number, number]> = { Enter: [1, 0], ArrowDown: [1, 0], ArrowUp: [-1, 0] };
    if (e.key === "Escape") { e.currentTarget.value = show(cells[g.rows[row].student.id]?.[ordered[col].id]); e.currentTarget.blur(); return; }
    const d = e.key === "Enter" && e.shiftKey ? [-1, 0] : move[e.key];
    if (d) { e.preventDefault(); e.currentTarget.blur(); focusCell(row + d[0], col + d[1]); }
  }

  /** لصق من Excel: أسطر ← طالبات للأسفل، أعمدة (Tab) ← التقييمات التالية */
  function onPaste(e: React.ClipboardEvent<HTMLInputElement>, row: number, col: number) {
    const text = e.clipboardData.getData("text");
    if (!/[\t\n]/.test(text.trim())) return;
    e.preventDefault();
    const grid = text.replace(/\r/g, "").replace(/\n$/, "").split("\n").map((l) => l.split("\t"));
    const batches = new Map<string, { studentId: string; score: number | null; status: EntryStatus }[]>();
    const errors: string[] = [];
    grid.forEach((line, dr) => line.forEach((raw, dc) => {
      const r = g.rows[row + dr], it = ordered[col + dc];
      if (!r || !it) return;
      const p = parseCellInput(raw, it.maxScore);
      if ("error" in p) { errors.push(`${r.student.fullName} / ${it.title}: ${p.error}`); return; }
      batches.set(it.id, [...(batches.get(it.id) ?? []), { studentId: r.student.id, ...p }]);
    }));
    if (errors.length) { setFlash({ ok: false, text: `لم يُلصق شيء — ${errors.length} قيمة غير صالحة: ${errors.slice(0, 3).join("؛ ")}` }); return; }
    batches.forEach((entries, itemId) => save(itemId, entries));
    setFlash({ ok: true, text: `تم لصق ${grid.length} صف × ${Math.max(...grid.map((l) => l.length))} عمود` });
  }

  async function toggleLock() {
    try {
      if (locked) {
        const why = prompt("سبب فك الاعتماد (يُسجَّل في سجل التدقيق):");
        if (!why) return;
        await api(`/api/v1/classes/${g.class.id}/grade-lock`, "DELETE", { termId: g.term.id, reason: why });
        setReason(null);
        await reload("تم فك الاعتماد");
      } else {
        const missing = g.rows.filter((r) => (results[r.student.id]?.completeness ?? 0) < 100).length;
        if (!confirm(`اعتماد درجات الفصل؟ بعد الاعتماد يلزم كتابة سبب لأي تعديل، وتُجمَّد أوزان التقييم.${missing ? `\n⚠️ ${missing} طالبة لم يكتمل رصد كل مكوّناتها.` : ""}`)) return;
        await api(`/api/v1/classes/${g.class.id}/grade-lock`, "POST", { termId: g.term.id });
        await reload("تم اعتماد الدرجات ✅");
      }
    } catch (e) {
      setFlash({ ok: false, text: (e as Error).message });
    }
  }

  const q = (cls: string, term: string) => router.push(`/dashboard/gradebook?class=${cls}&term=${term}`);
  const exp = (format: string) => `/api/v1/classes/${g.class.id}/gradebook/export?term=${g.term.id}&format=${format}`;
  let col = -1;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-black">سجل الدرجات</h1>
          <select className="input w-auto" aria-label="الفصل" value={g.class.id} onChange={(e) => q(e.target.value, g.term.id)}>{classes.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}</select>
          <select className="input w-auto" aria-label="الفصل الدراسي" value={g.term.id} onChange={(e) => q(g.class.id, e.target.value)}>{terms.map((t) => <option key={t.id} value={t.id}>{t.title}</option>)}</select>
          {locked ? <span className="badge bg-mint-50 text-mint-700">✅ معتمدة {formatHijri(g.lock!.lockedAt)}</span> : <span className="badge bg-gray-100 text-gray-600">غير معتمدة</span>}
        </div>
        <div className="flex flex-wrap gap-2">
          {perms.write && !locked && <button className="btn-primary" onClick={() => setItemForm("new")}>＋ تقييم</button>}
          {perms.write && g.items.length > 0 && <button className="btn-secondary" onClick={() => setQuick(quick ? null : ordered[0].id)}>📱 إدخال سريع</button>}
          {perms.lock && <button className={locked ? "btn-secondary" : "btn-accent"} onClick={toggleLock}>{locked ? "🔓 فك الاعتماد" : "🔒 اعتماد الدرجات"}</button>}
          {perms.export && (
            <details className="relative">
              <summary className="btn-secondary cursor-pointer list-none">⬇️ تصدير</summary>
              <div className="absolute left-0 z-20 mt-1 w-56 rounded-lg border bg-white p-1 shadow-lg">
                <a className="block rounded px-3 py-2 text-sm hover:bg-gray-50" href={exp("xlsx")}>Excel (كشف كامل)</a>
                <a className="block rounded px-3 py-2 text-sm hover:bg-gray-50" href={exp("csv")}>CSV (كشف كامل)</a>
                <a className="block rounded px-3 py-2 text-sm hover:bg-gray-50" href={exp("noor")}>ملف «نور» (المكوّنات)</a>
                <Link className="block rounded px-3 py-2 text-sm hover:bg-gray-50" href={`/print/gradebook/${g.class.id}?term=${g.term.id}`}>PDF / طباعة الكشف</Link>
              </div>
            </details>
          )}
          {perms.reports && <Link className="btn-secondary" href={`/dashboard/reports?class=${g.class.id}&term=${g.term.id}`}>📈 التقارير</Link>}
          <Link className="btn-secondary" href={`/dashboard/gradebook/settings?term=${g.term.id}`}>⚙️ الأوزان</Link>
        </div>
      </div>

      {flash && <div className={`rounded-lg p-3 text-sm ${flash.ok ? "bg-mint-50 text-mint-700" : "bg-red-50 text-red-700"}`} role="status">{flash.text} <button className="mr-2 font-bold" onClick={() => setFlash(null)}>✕</button></div>}

      {locked && perms.write && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          {reason === null ? (
            <>الدرجات معتمدة ومقفلة. لتصحيح خطأ: <button className="font-bold underline" onClick={() => { const r = prompt("سبب التعديل (يُسجَّل مع القيمة القديمة والجديدة):"); if (r && r.trim().length >= 5) setReason(r.trim()); else if (r !== null) setFlash({ ok: false, text: "السبب 5 أحرف على الأقل" }); }}>تعديل بسبب موثّق</button></>
          ) : (
            <>✏️ وضع التعديل بعد الاعتماد — السبب: «{reason}» <button className="mr-2 font-bold underline" onClick={() => setReason(null)}>إنهاء</button></>
          )}
        </div>
      )}

      <div className="flex flex-wrap gap-4 text-xs text-gray-500">
        <span>متوسط الفصل: <b className="text-gray-800">{totalStats.mean ?? "—"}</b></span>
        <span>الإتقان (≥80): <b className="text-gray-800">{totalStats.mastery ?? "—"}٪</b></span>
        <span>تحت 60: <b className="text-gray-800">{totalStats.needSupport ?? "—"}٪</b></span>
        {editable && <span>⌨️ اكتبي الدرجة ثم Enter · «غ» غائبة · «ع» بعذر · يمكن لصق عمود من Excel</span>}
      </div>

      {quick && (
        <QuickEntry items={ordered} itemId={quick} setItemId={setQuick} rows={g.rows} cells={cells} disabled={!editable} onCommit={commit} pending={pending} />
      )}

      {!g.items.length ? (
        <div className="card p-10 text-center text-gray-500">لا توجد تقييمات بعد. {perms.write && !locked && <button className="font-bold text-brand-700 underline" onClick={() => setItemForm("new")}>أضيفي أول تقييم</button>}</div>
      ) : (
        <div className="card overflow-auto" style={{ maxHeight: "70vh" }}>
          <table ref={tableRef} className="border-separate text-sm" style={{ borderSpacing: 0 }}>
            <thead className="sticky top-0 z-10 bg-white">
              <tr>
                <th rowSpan={2} className="sticky right-0 z-20 min-w-[13rem] border-b border-l bg-white px-3 text-right">الطالبة</th>
                {itemsByComp.map(({ c, items }) => (
                  <th key={c.id} colSpan={items.length + 1} className="border-b border-l bg-gray-50 px-2 py-1 text-xs font-black">{c.title} <span className="font-normal text-gray-500">({c.weight})</span></th>
                ))}
                <th rowSpan={2} className="border-b border-l bg-brand-50 px-2 text-xs">المجموع</th>
                <th rowSpan={2} className="border-b border-l bg-brand-50 px-2 text-xs">التقدير</th>
                <th rowSpan={2} className="border-b bg-gray-50 px-2 text-[10px] text-gray-500">اكتمال</th>
              </tr>
              <tr>
                {itemsByComp.flatMap(({ c, items }) => [
                  ...items.map((it) => (
                    <th key={it.id} className="min-w-[4.5rem] border-b border-l px-1 py-1 text-[11px] font-bold">
                      <button disabled={!perms.write || locked} onClick={() => setItemForm(it)} className="w-full enabled:hover:text-brand-700" title={`${it.title} — ${formatHijri(it.date)}${perms.write && !locked ? " (اضغطي للتعديل)" : ""}`}>
                        <div className="truncate">{it.title}</div>
                        <div className="font-normal text-gray-400">/{it.maxScore} · {formatHijriShort(it.date)}</div>
                      </button>
                    </th>
                  )),
                  <th key={c.id + "t"} className="border-b border-l bg-gray-50 px-1 text-[10px] text-gray-500">/{c.weight}</th>,
                ])}
              </tr>
            </thead>
            <tbody>
              {g.rows.map((r, ri) => {
                const res = results[r.student.id];
                col = -1;
                return (
                  <tr key={r.student.id} className="hover:bg-brand-50/30">
                    <td className="sticky right-0 z-[5] whitespace-nowrap border-b border-l bg-white px-3 py-1 font-bold">
                      <Link href={`/dashboard/students/${r.student.id}`} className="hover:text-brand-700"><span className="ml-1">{r.student.avatar}</span>{r.student.fullName}</Link>
                    </td>
                    {itemsByComp.flatMap(({ c, items }) => [
                      ...items.map((it) => {
                        col++;
                        const ci = col;
                        const cell = cells[r.student.id]?.[it.id];
                        const p = cell ? itemPercent({ itemId: it.id, ...cell }, it.maxScore, g.scheme.absentAsZero) : null;
                        const st = pending[`${r.student.id}:${it.id}`];
                        return (
                          <td key={it.id} className={`border-b border-l p-0 ${pctClass(p)}`}>
                            <input
                              data-r={ri}
                              data-c={ci}
                              aria-label={`${r.student.fullName} — ${it.title}`}
                              readOnly={!editable}
                              defaultValue={show(cell)}
                              key={`${show(cell)}-${st ?? ""}`}
                              inputMode="decimal"
                              onFocus={(e) => e.currentTarget.select()}
                              onBlur={(e) => { if (!editable) return; if (!commit(r.student.id, it.id, e.currentTarget.value)) e.currentTarget.value = show(cell); }}
                              onKeyDown={(e) => onKey(e, ri, ci)}
                              onPaste={(e) => editable && onPaste(e, ri, ci)}
                              className={`h-8 w-full min-w-[4.5rem] bg-transparent text-center font-bold outline-none focus:bg-white focus:ring-2 focus:ring-inset focus:ring-brand-400 ${st === "saving" ? "text-gray-400" : ""} ${st === "error" ? "ring-2 ring-inset ring-red-500" : ""} ${cell?.status !== "NORMAL" && cell ? "text-gray-700" : ""}`}
                            />
                          </td>
                        );
                      }),
                      <td key={c.id + "t"} className={`border-b border-l bg-gray-50/70 px-1 text-center text-xs font-bold ${pctClass(res.componentPercent[c.id])}`}>{res.components[c.id] ?? ""}</td>,
                    ])}
                    <td className={`border-b border-l px-2 text-center font-black ${pctClass(res.total)}`}>{res.total ?? "—"}</td>
                    <td className="whitespace-nowrap border-b border-l px-2 text-center text-xs font-bold">{res.grade ?? "—"}</td>
                    <td className="border-b px-2 text-center text-[10px] text-gray-500">{res.completeness}٪</td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot className="sticky bottom-0 bg-gray-50 text-xs">
              <tr>
                <td className="sticky right-0 border-t bg-gray-50 px-3 py-1 font-black">
                  متوسط الفصل ٪ <button className="mr-1 text-[10px] font-normal text-brand-700 underline" onClick={() => setShowStats(!showStats)}>{showStats ? "أقل" : "المزيد"}</button>
                </td>
                {itemsByComp.flatMap(({ c, items }) => [
                  ...items.map((it) => {
                    const s = itemStats[it.id];
                    return (
                      <td key={it.id} className="border-l border-t px-1 py-1 text-center" title={`الوسيط ${s.median ?? "—"} · الانحراف ${s.sd ?? "—"} · الأدنى ${s.min ?? "—"} · الأعلى ${s.max ?? "—"}`}>
                        <b>{s.mean ?? "—"}</b>
                        {showStats && <div className="text-[10px] font-normal leading-tight text-gray-500">و {s.median ?? "—"}<br />ع {s.sd ?? "—"}<br />إتقان {s.mastery ?? "—"}٪</div>}
                      </td>
                    );
                  }),
                  <td key={c.id + "t"} className="border-l border-t" />,
                ])}
                <td className="border-l border-t text-center font-black">{totalStats.mean ?? "—"}</td>
                <td className="border-t" colSpan={2} />
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      {itemForm && (
        <ItemForm
          item={itemForm === "new" ? null : itemForm}
          components={comps}
          classId={g.class.id}
          skills={skills}
          onClose={() => setItemForm(null)}
          onSaved={(m) => { setItemForm(null); reload(m); }}
          onError={(m) => setFlash({ ok: false, text: m })}
        />
      )}
    </div>
  );
}

function QuickEntry({ items, itemId, setItemId, rows, cells, disabled, onCommit, pending }: {
  items: G["items"]; itemId: string; setItemId: (id: string) => void; rows: G["rows"]; cells: Record<string, Record<string, Cell>>;
  disabled: boolean; onCommit: (s: string, i: string, raw: string) => boolean; pending: Record<string, string>;
}) {
  const it = items.find((i) => i.id === itemId)!;
  return (
    <div className="card space-y-3 p-4">
      <div className="flex flex-wrap items-center gap-2">
        <b>📱 إدخال سريع:</b>
        <select className="input w-auto" value={itemId} onChange={(e) => setItemId(e.target.value)} aria-label="التقييم">{items.map((i) => <option key={i.id} value={i.id}>{i.title} (/{i.maxScore})</option>)}</select>
      </div>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {rows.map((r) => {
          const c = cells[r.student.id]?.[itemId];
          return (
            <label key={r.student.id} className="flex items-center gap-2 rounded-lg border p-2">
              <span className="text-2xl">{r.student.avatar}</span>
              <span className="flex-1 text-sm font-bold">{r.student.fullName}</span>
              <input className={`input w-20 text-center text-lg font-black ${pending[`${r.student.id}:${itemId}`] === "error" ? "border-red-500" : ""}`} inputMode="decimal" readOnly={disabled}
                defaultValue={show(c)} key={show(c)} aria-label={`درجة ${r.student.fullName}`}
                onBlur={(e) => !disabled && onCommit(r.student.id, itemId, e.currentTarget.value)}
                onKeyDown={(e) => { if (e.key === "Enter") (e.currentTarget as HTMLInputElement).blur(); }} />
              <span className="text-xs text-gray-400">/{it.maxScore}</span>
            </label>
          );
        })}
      </div>
    </div>
  );
}

function ItemForm({ item, components, classId, skills, onClose, onSaved, onError }: {
  item: G["items"][number] | null; components: G["scheme"]["components"]; classId: string; skills: Skill[];
  onClose: () => void; onSaved: (m: string) => void; onError: (m: string) => void;
}) {
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Riyadh" }).format(new Date());
  const [f, setF] = useState({
    componentId: item?.componentId ?? components[0]?.id ?? "",
    title: item?.title ?? "",
    maxScore: item?.maxScore ?? 10,
    date: item ? new Date(item.date).toISOString().slice(0, 10) : today,
    skillCodes: item ? skills.filter((s) => item.skillIds.includes(s.id)).map((s) => s.code) : ([] as string[]),
  });
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    try {
      if (item) await api(`/api/v1/grade-items/${item.id}`, "PATCH", { title: f.title, maxScore: Number(f.maxScore), date: f.date, skillCodes: f.skillCodes });
      else await api(`/api/v1/classes/${classId}/grade-items`, "POST", { ...f, maxScore: Number(f.maxScore) });
      onSaved(item ? "تم حفظ التقييم" : "تمت إضافة التقييم");
    } catch (err) {
      onError((err as Error).message);
    }
  }
  async function remove() {
    if (!item || !confirm(`حذف «${item.title}»؟`)) return;
    try {
      await api(`/api/v1/grade-items/${item.id}`, "DELETE");
    } catch (err) {
      if (!/مرصودة/.test((err as Error).message) || !confirm(`${(err as Error).message}. حذف التقييم ودرجاته نهائياً؟`)) return onError((err as Error).message);
      try { await api(`/api/v1/grade-items/${item.id}?confirm=1`, "DELETE"); } catch (e2) { return onError((e2 as Error).message); }
    }
    onSaved("تم حذف التقييم");
  }
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/30 p-4" onClick={onClose}>
      <form onSubmit={submit} onClick={(e) => e.stopPropagation()} className="card max-h-[90vh] w-full max-w-lg space-y-3 overflow-y-auto p-5" role="dialog" aria-label="تقييم">
        <h2 className="text-lg font-black">{item ? "تعديل تقييم" : "تقييم جديد"}</h2>
        <div>
          <label className="label">المكوّن</label>
          <select className="input" disabled={!!item} value={f.componentId} onChange={(e) => setF({ ...f, componentId: e.target.value })}>
            {components.map((c) => <option key={c.id} value={c.id}>{c.title} ({c.weight})</option>)}
          </select>
        </div>
        <div><label className="label">العنوان</label><input className="input" required minLength={2} placeholder="مثال: اختبار قصير 2 — الإملاء" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} /></div>
        <div className="grid grid-cols-2 gap-3">
          <div><label className="label">الدرجة العظمى</label><input className="input" type="number" min={0.5} step={0.5} max={1000} required value={f.maxScore} onChange={(e) => setF({ ...f, maxScore: Number(e.target.value) })} /></div>
          <div><label className="label">التاريخ</label><input className="input" type="date" required value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} /></div>
        </div>
        <div>
          <label className="label">المهارات المقاسة (للتحليل المهاري)</label>
          <div className="max-h-36 overflow-y-auto rounded-lg border p-2">
            {skills.map((s) => (
              <label key={s.code} className="flex items-center gap-2 py-0.5 text-sm">
                <input type="checkbox" checked={f.skillCodes.includes(s.code)} onChange={(e) => setF({ ...f, skillCodes: e.target.checked ? [...f.skillCodes, s.code] : f.skillCodes.filter((x) => x !== s.code) })} />
                {s.title} <span className="text-xs text-gray-400">({s.domain})</span>
              </label>
            ))}
          </div>
        </div>
        <div className="flex gap-2">
          <button className="btn-primary">حفظ</button>
          {item && <button type="button" className="btn-danger" onClick={remove}>حذف</button>}
          <button type="button" className="btn-secondary" onClick={onClose}>إلغاء</button>
        </div>
      </form>
    </div>
  );
}
