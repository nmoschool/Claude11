/* عامل الخدمة لألعاب لغتي: اللعب دون اتصال.
 * - صفحات /student/games: الشبكة أولاً ثم النسخة المخزنة.
 * - ملفات Next الثابتة والأيقونات: المخزن أولاً.
 * - حزمة المحتوى: الشبكة أولاً ثم المخزن.
 * لا تُخزَّن أي واجهة API أخرى (درجات، اختبارات، بيانات شخصية). */
const VERSION = "lughati-games-v1";
const STATIC = /\/_next\/static\/|\/icon\.svg$|\/manifest\.webmanifest$/;
const PAGES = /^\/student\/(games|progress)(\/|$)/;
const CONTENT = /^\/api\/v1\/me\/games\/content$/;

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k)))).then(() => self.clients.claim())
  );
});

async function networkFirst(req) {
  const cache = await caches.open(VERSION);
  try {
    const res = await fetch(req);
    if (res.ok && !res.redirected) cache.put(req, res.clone());
    return res;
  } catch {
    const hit = await cache.match(req, { ignoreSearch: false });
    if (hit) return hit;
    return new Response("<!doctype html><html lang=ar dir=rtl><meta charset=utf-8><body style='font-family:sans-serif;text-align:center;padding:3em'><h1>📶 لا يوجد اتصال</h1><p>افتحي الألعاب مرة واحدة وأنتِ متصلة لتعمل دون اتصال لاحقاً.</p></body></html>", { headers: { "Content-Type": "text/html; charset=utf-8" } });
  }
}

async function cacheFirst(req) {
  const cache = await caches.open(VERSION);
  const hit = await cache.match(req);
  if (hit) return hit;
  const res = await fetch(req);
  if (res.ok) cache.put(req, res.clone());
  return res;
}

self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== "GET" || url.origin !== location.origin) return;
  if (STATIC.test(url.pathname)) return e.respondWith(cacheFirst(e.request));
  if (CONTENT.test(url.pathname)) return e.respondWith(networkFirst(e.request));
  if (e.request.mode === "navigate" && PAGES.test(url.pathname)) return e.respondWith(networkFirst(e.request));
  // مكوّنات RSC لصفحات الألعاب (تنقل داخلي)
  if (PAGES.test(url.pathname) && e.request.headers.get("RSC") === "1") return e.respondWith(networkFirst(e.request));
});
