"use client";

/**
 * تخزين محلي للعب دون اتصال: حزمة المحتوى + طابور المحاولات غير المُزامَنة.
 * المفاتيح مخصّصة لكل طالبة (الأجهزة اللوحية مشتركة في الفصل).
 * المزامنة idempotent: الخادم يتجاهل clientId المكرر، فإعادة الإرسال آمنة دائماً.
 */
import type { GameCode, GameContent } from "@/lib/games";

export interface QueuedAttempt {
  clientId: string;
  gameCode: GameCode;
  skillCode: string;
  itemRef: string;
  correct: boolean;
  hintsUsed: number;
  ms: number;
  level: number;
  playedAt: string;
}

const k = (sid: string, name: string) => `lughati:${sid}:${name}`;

function read<T>(key: string, fallback: T): T {
  try {
    const v = localStorage.getItem(key);
    return v ? (JSON.parse(v) as T) : fallback;
  } catch {
    return fallback;
  }
}
function write(key: string, v: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(v));
  } catch {
    /* التخزين ممتلئ أو محظور: نكمل دون حفظ */
  }
}

export const uuid = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;

export function loadPack(sid: string): { content: GameContent; enabled: GameCode[] } | null {
  return read(k(sid, "pack"), null);
}

export async function refreshPack(sid: string) {
  try {
    const r = await fetch("/api/v1/me/games/content", { cache: "no-store" });
    if (!r.ok) return loadPack(sid);
    const d = await r.json();
    write(k(sid, "pack"), { content: d.content, enabled: d.enabled });
    return { content: d.content as GameContent, enabled: d.enabled as GameCode[] };
  } catch {
    return loadPack(sid);
  }
}

export const queue = (sid: string) => read<QueuedAttempt[]>(k(sid, "queue"), []);
export function enqueue(sid: string, a: QueuedAttempt) {
  write(k(sid, "queue"), [...queue(sid), a]);
}

export function getLevel(sid: string, game: string): 1 | 2 | 3 {
  return read(k(sid, `level:${game}`), 1);
}
export function setLevel(sid: string, game: string, l: number) {
  write(k(sid, `level:${game}`), l);
}

/** يرسل الطابور على دفعات؛ يحذف من الطابور ما قَبِله الخادم فقط */
export async function flush(sid: string): Promise<any | null> {
  let last: any = null;
  for (;;) {
    const q = queue(sid);
    if (!q.length) return last;
    const batch = q.slice(0, 200);
    let r: Response;
    try {
      r = await fetch("/api/v1/me/game-attempts", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ attempts: batch }) });
    } catch {
      return last; // دون اتصال: يبقى الطابور
    }
    if (r.status === 401) return last; // انتهت الجلسة: يبقى الطابور حتى الدخول مجدداً
    if (!r.ok && r.status !== 400) return last;
    const sent = new Set(batch.map((a) => a.clientId));
    write(k(sid, "queue"), queue(sid).filter((a) => !sent.has(a.clientId)));
    if (r.ok) last = await r.json();
  }
}
