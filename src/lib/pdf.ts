/**
 * توليد PDF من صفحات الطباعة (/print/...) بمتصفح Chromium على الخادم —
 * أدق خيار لاتصال الحروف العربية والتشكيل.
 *
 * يعمل إن توفرت حزمة playwright (أو playwright-core + CHROMIUM_PATH) على الخادم
 * (خادم خاص / حاوية). على Netlify/Vercel غير متاح عادةً: تعيد الدالة null
 * وتستخدم الواجهة الطباعة من المتصفح «حفظ كـ PDF» بنفس القالب.
 */

type Browser = { newContext(o: unknown): Promise<any>; close(): Promise<void>; isConnected(): boolean };

let browserPromise: Promise<Browser> | null = null;
let active = 0;
const MAX_CONCURRENT = 2;

async function launch(): Promise<Browser | null> {
  if (process.env.PDF_ENGINE === "browser") return null;
  if (browserPromise) {
    const b = await browserPromise.catch(() => null);
    if (b?.isConnected()) return b;
  }
  browserPromise = (async () => {
    // require الأصلي لـ Node (عبر eval كي لا يعيد webpack كتابته): يحترم NODE_PATH
    // حين تكون الحزمة مثبتة عالمياً، والحزمة اختيارية لا تُحزم ولا تُشترط وقت البناء
    // eslint-disable-next-line no-eval
    const nodeRequire = eval("require") as NodeRequire;
    const load = async (name: string) => nodeRequire(name);
    let mod: any;
    try {
      mod = await load("playwright");
    } catch {
      mod = await load("playwright-core");
    }
    const chromium = mod.chromium ?? mod.default?.chromium;
    return chromium.launch({
      executablePath: process.env.CHROMIUM_PATH || undefined,
      args: ["--no-sandbox", "--disable-dev-shm-usage"],
    });
  })();
  return browserPromise.catch((e) => {
    console.warn("PDF engine unavailable:", (e as Error).message?.split("\n")[0]);
    browserPromise = null;
    return null;
  });
}

export const PRINT_PATH = /^\/print\/[a-z-]+\/[A-Za-z0-9_-]+(\?[A-Za-z0-9_=&%-]*)?$/;

export async function renderPdf(path: string, cookieHeader: string, opts: { landscape?: boolean } = {}): Promise<Buffer | null> {
  if (!PRINT_PATH.test(path)) throw new Error("مسار طباعة غير صالح");
  // العنوان من الإعدادات وليس من رأس Host (منع SSRF/حقن المضيف).
  // داخل الحاوية: http://localhost:3000 (وليس 127.0.0.1) لأن Chromium يعدّ localhost سياقاً آمناً
  // فيقبل كوكي __Secure- للجلسة عبر http الداخلي.
  const base = new URL(process.env.PDF_BASE_URL || process.env.NEXTAUTH_URL || "http://localhost:3000");
  const browser = await launch();
  if (!browser) return null;
  if (active >= MAX_CONCURRENT) throw new Error("BUSY");
  active++;
  // نمرّر كوكي الجلسة فقط كترويسة Cookie: Chromium يرفض زرع كوكي ببادئة __Secure- على أصل http
  // الداخلي عبر CDP، والترويسة لا تخرج عن أصل المنصة (كل طلب آخر يُلغى أدناه)
  const session = cookieHeader
    .split(/;\s*/)
    .filter((c) => /^(__Secure-)?next-auth\.session-token(\.\d+)?=/.test(c))
    .join("; ");
  const context = await browser.newContext({ locale: "ar-SA", timezoneId: "Asia/Riyadh", extraHTTPHeaders: session ? { cookie: session } : {} });
  try {
    await context.route("**/*", (route: any) => (new URL(route.request().url()).origin === base.origin ? route.continue() : route.abort()));
    const page = await context.newPage();
    const res = await page.goto(new URL(path, base).toString(), { waitUntil: "networkidle", timeout: 30_000 });
    if (!res || res.status() !== 200 || !new URL(page.url()).pathname.startsWith("/print/")) throw new Error("FORBIDDEN");
    await page.evaluate(() => (document as any).fonts?.ready);
    return Buffer.from(
      await page.pdf({ format: "A4", landscape: !!opts.landscape, printBackground: true, preferCSSPageSize: true, margin: { top: "12mm", bottom: "12mm", left: "10mm", right: "10mm" } })
    );
  } finally {
    active--;
    await context.close().catch(() => {});
  }
}
