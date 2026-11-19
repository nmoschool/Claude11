/**
 * فحص إمكانية الوصول (WCAG 2 A/AA) بأداة axe-core على 11 صفحة رئيسية للمعلمة والطالبة.
 *   npm run db:seed && npm run build && npm start   (في نافذة أخرى)
 *   npm run test:a11y
 * يتطلب Playwright مثبتاً. يفشل (رمز خروج 1) عند أي مخالفة جادة أو حرجة.
 */
const { chromium, devices } = require('playwright');
const { PrismaClient } = require('@prisma/client');
// TOTP مضمّن (لتفعيل التحقق الثنائي لحساب المعلمة التجريبي)
const crypto = require('crypto');
const B32='ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
function dec(s){let bits=0,v=0,o=[];for(const c of s){v=(v<<5)|B32.indexOf(c);bits+=5;if(bits>=8){o.push((v>>>(bits-8))&255);bits-=8;}}return Buffer.from(o);}
const totp=(sec)=>{const b=Buffer.alloc(8);b.writeBigUInt64BE(BigInt(Math.floor(Date.now()/30000)));const h=crypto.createHmac('sha1',dec(sec)).update(b).digest();const o=h[h.length-1]&15;return String((((h[o]&127)<<24)|(h[o+1]<<16)|(h[o+2]<<8)|h[o+3])%1e6).padStart(6,'0');};

const AXE = require.resolve('axe-core/axe.min.js');
const B = process.env.BASE_URL || 'http://localhost:3000';
async function audit(page, name) {
  await page.addScriptTag({ path: AXE });
  const r = await page.evaluate(async () => (await axe.run(document, { runOnly: ['wcag2a', 'wcag2aa'] })).violations.map(v => ({ id: v.id, impact: v.impact, n: v.nodes.length, help: v.help, sample: v.nodes[0]?.target?.join(' ') })));
  const bad = r.filter(v => ['serious', 'critical'].includes(v.impact));
  console.log(`${bad.length ? '✖' : '✅'} ${name}: ${r.length} ملاحظة (${bad.length} خطيرة)`);
  for (const v of r) console.log(`    [${v.impact}] ${v.id} ×${v.n} — ${v.help} — ${v.sample}`);
  return bad.length;
}
(async () => {
  const prisma = new PrismaClient();
  const b = await chromium.launch(); let bad = 0;
  const p = await b.newPage({ viewport: { width: 1366, height: 900 } });
  await p.goto(B + '/login'); bad += await audit(p, 'دخول الطاقم');
  await p.fill('#email', 'teacher@school.sa'); await p.fill('#password', 'Teacher123!'); await p.click('button[type=submit]'); await p.waitForURL(/security/);
  await p.getByRole('button', { name: 'بدء الإعداد' }).click(); await p.waitForSelector('code');
  await p.fill('input[aria-label="رمز التحقق"]', totp((await p.textContent('code')).trim()));
  await p.getByRole('button', { name: 'تأكيد التفعيل' }).click(); await p.waitForURL(B + '/dashboard');
  bad += await audit(p, 'لوحة المعلمة');
  const A = await prisma.schoolClass.findFirst({ where: { section: 'أ' } });
  for (const [path, name, sel] of [['/dashboard/gradebook', 'سجل الدرجات', 'table input'], [`/dashboard/classes/${A.id}/attendance`, 'الحضور', '[role=radiogroup]'], ['/dashboard/curriculum', 'توزيع المنهج', 'text=التغطية'], ['/dashboard/reports', 'التقارير', 'text=خريطة']]) {
    await p.goto(B + path); await p.waitForSelector(sel); bad += await audit(p, name);
  }
  const st = (await prisma.student.findMany({ where: { classId: A.id }, orderBy: { fullName: 'asc' } }))[10];
  const code = (await (await p.request.post(`${B}/api/v1/classes/${A.id}/picture-codes`, { data: { studentIds: [st.id] } })).json()).cards[0].code;
  const s = await (await b.newContext({ ...devices['iPad (gen 7)'] })).newPage();
  await s.goto(B + '/student-login'); bad += await audit(s, 'دخول الطالبات');
  await s.fill('input[aria-label="رمز الفصل"]', A.joinCode); await s.click('text=التالي');
  await s.locator('button', { hasText: st.displayName }).first().click();
  bad += await audit(s, 'شبكة الصور');
  const PICS = ['قمر','نجمة','زهرة','فراشة','تفاحة','قطة','قوس قزح','كتاب','شمس'];
  for (const i of code) await s.click(`button[aria-label="${PICS[i]}"]`);
  await s.waitForURL(B + '/student'); bad += await audit(s, 'رئيسية الطالبة');
  await s.goto(B + '/student/games/SHAMS_GARDEN'); await s.waitForSelector('text=في أيّ زهرة'); bad += await audit(s, 'لعبة');
  await s.goto(B + '/student/progress'); await s.waitForSelector('text=أوسمتي'); bad += await audit(s, 'نقاطي وأوسمتي');
  console.log(bad ? `\n✖ ${bad} مخالفة خطيرة` : '\n✅ لا مخالفات خطيرة');
  await b.close(); await prisma.$disconnect();
  process.exitCode = bad ? 1 : 0;
})().catch(e => { console.error(e); process.exit(1); });
