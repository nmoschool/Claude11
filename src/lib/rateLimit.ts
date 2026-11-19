/**
 * محدِّد معدل بسيط في الذاكرة (نافذة منزلقة).
 * مناسب لخادم واحد/VPS. في بيئة serverless متعددة النسخ يُستبدل بـ Redis
 * (نفس الواجهة) — انظر docs/lughati-g4-design.md القسم 7.3.
 */
const buckets = new Map<string, number[]>();

export function rateLimit(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  const hits = (buckets.get(key) ?? []).filter((t) => now - t < windowMs);
  if (hits.length >= limit) {
    buckets.set(key, hits);
    return false;
  }
  hits.push(now);
  buckets.set(key, hits);
  if (buckets.size > 10_000) {
    for (const [k, v] of buckets) if (!v.some((t) => now - t < windowMs)) buckets.delete(k);
  }
  return true;
}

/**
 * عنوان IP للعميل. لا يُوثق برأس X-Forwarded-For إلا خلف وكيل موثوق
 * (TRUST_PROXY=true مثل Vercel/Netlify/Nginx) لأن العميل يستطيع تزويره.
 * بدون ذلك يُعاد null فيُتخطّى حد IP ويبقى قفل الحساب نفسه هو الحماية.
 */
export function clientIp(headers: Headers | Record<string, any> | undefined): string | null {
  if (!headers || process.env.TRUST_PROXY !== "true") return null;
  const get = (n: string) =>
    typeof (headers as Headers).get === "function"
      ? (headers as Headers).get(n)
      : ((headers as Record<string, any>)[n] as string | undefined);
  return (get("x-forwarded-for") ?? "").split(",")[0].trim() || get("x-real-ip") || null;
}

/** يطبّق الحد فقط عند معرفة IP موثوق */
export function rateLimitIp(prefix: string, ip: string | null, limit: number, windowMs: number): boolean {
  return ip ? rateLimit(`${prefix}:${ip}`, limit, windowMs) : true;
}

/**
 * حدود المعدل لكل IP في الدقيقة. مهم: فصل كامل يخرج غالباً من IP واحد (NAT المدرسة)،
 * لذلك حدود الطالبات واسعة، والحماية الأساسية من التخمين هي قفل كل حساب على حدة.
 */
const num = (v: string | undefined, d: number) => (v && Number(v) > 0 ? Number(v) : d);
export const LIMITS = {
  staffLogin: () => num(process.env.RATE_LIMIT_STAFF_LOGIN, 30),
  studentLogin: () => num(process.env.RATE_LIMIT_STUDENT_LOGIN, 300),
  roster: () => num(process.env.RATE_LIMIT_ROSTER, 200),
};
