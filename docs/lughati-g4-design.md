# منصة «لغتي» — الصف الرابع الابتدائي (بنات)
## وثيقة التصميم التفصيلي والتنفيذي (v1.0)

> **الهدف:** منصة ويب عربية (RTL) تخدم معلمة لغتي في: سجل الدرجات، توزيع المنهج،
> ملفات الطالبات، مولد أوراق العمل والاختبارات، والألعاب التعليمية — مع واجهة
> قراءة فقط للمشرفة التربوية.
>
> **قرار معماري رئيسي:** تُبنى المنصة على **نفس الستاك المُثبت في هذا المستودع**
> (Next.js 15 + Prisma + PostgreSQL + NextAuth + Tailwind RTL + Zod) لإعادة
> استخدام ~40% من الكود الجاهز (المصادقة، استيراد Excel، الطباعة، سجل التدقيق،
> لوحة الشرف) وتقليص زمن التطوير إلى النصف تقريباً.

---

## 0) الملخص التنفيذي

| المحور | الحل المقترح | مستوى الجاهزية في المستودع |
|---|---|---|
| الصلاحيات | RBAC + صلاحيات دقيقة (Permissions) قابلة للتخصيص لكل مستخدم | أساس جاهز (3 أدوار) ← يُوسَّع |
| سجل الدرجات | مكونات تقييم بأوزان قابلة للضبط + حساب تلقائي + تقارير + PDF/CSV | جاهز جزئياً |
| توزيع المنهج | فصل ← أسبوع ← درس + تقويم أنشطة واختبارات بالسحب والإفلات | جاهز جزئياً |
| ملفات الطالبات | بيانات + حضور + سلوك + ملاحظات + مرفقات | يُبنى |
| أوراق العمل والاختبارات | بنك أسئلة لغوي + مولد قوالب + نماذج تصحيح آلي + PDF A4 | جاهز جزئياً |
| الألعاب | 8 ألعاب مرتبطة بأهداف المنهج + نقاط + أوسمة + شهادات PDF | يُبنى |
| التقنية | PostgreSQL، استضافة داخل المملكة، نسخ 3-2-1، REST API، مراقبة أداء | موثّق جزئياً |

**المدة التقديرية:** 12 أسبوعاً (مطوّر Full-stack + مصممة UI بدوام جزئي + معلمة لغتي كمستشارة محتوى).

---

## 1) الواجهات والصلاحيات

### 1.1 الأدوار الافتراضية

| الدور | الوصف | نطاق البيانات |
|---|---|---|
| `SUPER_ADMIN` | مدير النظام (تقني) | كل شيء + إعدادات النظام |
| `SCHOOL_ADMIN` | قائدة المدرسة / الوكيلة | كل فصول المدرسة (قراءة + اعتماد) |
| `TEACHER` | معلمة لغتي | **فصولها فقط** — تحكم كامل |
| `SUPERVISOR` | المشرفة التربوية | الفصول المسندة لها — **قراءة فقط** |
| `STUDENT` | الطالبة | بياناتها وألعابها ونتائجها فقط |
| `GUARDIAN` (مرحلة 2) | ولي الأمر | بيانات ابنته فقط — قراءة |

### 1.2 نموذج الصلاحيات الدقيقة (قابل للتخصيص)

الصلاحية = `مورد:إجراء`، والدور = مجموعة صلاحيات افتراضية، ويمكن **إضافة أو سحب**
صلاحية لمستخدم بعينه (Override) دون إنشاء دور جديد.

```
grades:read  grades:write  grades:export  grades:lock
curriculum:read  curriculum:write
students:read  students:write  students:sensitive   (رقم الهوية، الهاتف، الملاحظات الصحية)
attendance:write  behavior:write  files:upload
assessments:read  assessments:write  assessments:publish
games:play  games:manage  certificates:issue
reports:read  reports:export
users:manage  settings:manage  audit:read
```

**مصفوفة الصلاحيات الافتراضية**

| الصلاحية | المعلمة | المشرفة | القائدة | الطالبة |
|---|:-:|:-:|:-:|:-:|
| قراءة الدرجات | ✅ | ✅ | ✅ | ذاتية |
| تعديل الدرجات | ✅ | ❌ | ❌ | ❌ |
| قفل الدرجات (اعتماد) | ✅ | ❌ | ✅ | ❌ |
| تصدير / طباعة | ✅ | ✅ | ✅ | ❌ |
| تعديل توزيع المنهج | ✅ | ❌ | ❌ | ❌ |
| البيانات الحساسة للطالبة | ✅ | ❌ (مُقنَّعة) | ✅ | ❌ |
| إضافة ملاحظة إشرافية | ❌ | ✅ (تعليق فقط) | ✅ | ❌ |
| إدارة الألعاب | ✅ | ❌ | ❌ | ❌ |
| سجل التدقيق | ❌ | ✅ (فصولها) | ✅ | ❌ |

> المشرفة لديها **قناة واحدة للكتابة**: «ملاحظات إشرافية» تُحفظ منفصلة ولا
> تلمس أي بيانات للمعلمة — هذا يحقق الشفافية دون كسر مبدأ القراءة فقط.

### 1.3 التطبيق التقني للصلاحيات (ثلاث طبقات)

1. **Middleware** — حماية المسارات (`/teacher/*`, `/supervisor/*`, `/student/*`).
2. **API Guard** — كل Route Handler يمر عبر:
   ```ts
   export const GET = withPermission("grades:read", { scope: "class" }, handler);
   ```
   حيث يتحقق `scope` أن `classId` المطلوب ضمن فصول المستخدم.
3. **PostgreSQL Row-Level Security (اختياري للإنتاج)** — طبقة دفاع أخيرة تمنع
   تسرّب بيانات فصل لآخر حتى لو أخطأ الكود.

```ts
// src/lib/permissions.ts
export async function can(user: SessionUser, perm: Permission, classId?: string) {
  const granted = new Set([...ROLE_DEFAULTS[user.role], ...user.grants]);
  user.revokes.forEach((p) => granted.delete(p));
  if (!granted.has(perm)) return false;
  if (!classId) return true;
  return user.role === "SCHOOL_ADMIN" || user.classIds.includes(classId);
}
```

### 1.4 تسجيل الدخول متعدد المستويات

| المستخدم | طريقة الدخول | الحماية |
|---|---|---|
| المعلمة / القائدة / المشرفة | بريد + كلمة مرور | bcrypt، **2FA (TOTP) إلزامي**، قفل بعد 5 محاولات، جلسة 8 ساعات |
| الطالبة (طفلة 9-10 سنوات) | **رمز الفصل + صورة رمزية + رمز صوري من 4 صور** أو بطاقة QR مطبوعة | لا بريد ولا كلمة مرور معقدة، جلسة 60 دقيقة، تعمل فقط من شبكة المدرسة/وقت محدد (اختياري) |
| ولي الأمر (مرحلة 2) | رقم الجوال + OTP | — |

مستقبلاً: تكامل SSO مع **نفاذ** أو حسابات وزارة التعليم (Microsoft Entra / مدرستي) عبر OIDC — البنية تدعمه عبر NextAuth Providers.

### 1.5 خريطة الواجهات

**واجهة المعلمة (لوحة تحكم كاملة)**
```
الرئيسية ─ بطاقات: حضور اليوم، اختبارات الأسبوع، طالبات يحتجن دعماً، آخر نشاط ألعاب
├── فصولي (4/أ، 4/ب ...)
├── الطالبات ─ القائمة ← الملف الفردي (تبويبات)
├── سجل الدرجات ─ جدول شبكي (Spreadsheet-like) + تقارير
├── توزيع المنهج ─ عرض فصلي / أسبوعي / تقويم
├── أوراق العمل والاختبارات ─ بنك الأسئلة / المولد / التصحيح
├── الألعاب ─ تفعيل وربط بالدروس / لوحة الأداء / الشهادات
├── التقارير ─ فردي / جماعي / مقارنة فصول / تحليل مهارات
└── الإعدادات ─ أوزان التقييم، سلم التقديرات، صلاحيات المشرفة
```

**واجهة المشرفة (قراءة فقط):** نفس الشاشات بلا أزرار تعديل + شاشة «مؤشرات
الإنجاز» (نسبة تغطية المنهج مقابل الخطة، متوسطات الفصول، نسب الحضور) + ملاحظات إشرافية.

**واجهة الطالبة:** شاشة ملوّنة كبيرة الأزرار: «ألعابي» ـ «نقاطي وأوسمتي» ـ
«واجباتي» ـ «شهاداتي». تصميم خاص بالبنات (ألوان هادئة: بنفسجي/وردي فاتح/فيروزي)،
خط **Tajawal / Noto Naskh Arabic** بحجم ≥ 20px، **قراءة صوتية للتعليمات**.

---

## 2) سجل الدرجات

### 2.1 مكونات التقييم (قابلة للضبط بالكامل)

> الأوزان التالية **افتراضية للتوضيح**، وتُضبط من الإعدادات بما يطابق
> **لائحة تقويم الطالب** المعتمدة من وزارة التعليم للعام الدراسي الحالي.

| المكون | الرمز | الوزن الافتراضي | طريقة الإدخال |
|---|---|---|---|
| المشاركة والتفاعل الصفي | `PARTICIPATION` | 10 | تقدير سريع (نجوم 1-5) يُحوَّل لدرجة |
| الواجبات | `HOMEWORK` | 10 | متوسط آلي للواجبات |
| المهام الأدائية (قراءة جهرية، إملاء، خط، تعبير) | `PERFORMANCE` | 20 | بمعيار تقدير (Rubric) |
| الاختبارات القصيرة | `QUIZ` | 20 | آلي من المنصة أو يدوي |
| الاختبار الفتري | `MIDTERM` | 10 | آلي/يدوي |
| الاختبار النهائي | `FINAL` | 30 | آلي/يدوي |
| **المجموع** | | **100** | |

**مهارات لغتي المتتبَّعة (تحليل مهاري لا مجرد درجة):**
القراءة الجهرية • الفهم القرائي • الرسم الإملائي • الخط • الصنف اللغوي •
الأسلوب والتركيب • الوظيفة النحوية • التعبير الكتابي • الاستماع والتحدث.

كل سؤال/مهمة يُوسَم بمهارة → تُولَّد **خريطة حرارية مهارية** لكل طالبة وللفصل.

### 2.2 الحساب التلقائي

```ts
// src/lib/gradeCalc.ts
// درجة المكون = (مجموع الدرجات المحصلة ÷ مجموع العظمى) × وزن المكون
export function componentScore(items: {score: number|null; max: number; excused: boolean}[], weight: number) {
  const valid = items.filter(i => !i.excused && i.score !== null);
  if (!valid.length) return null;                     // لا يُحتسب صفراً
  const got = valid.reduce((s, i) => s + i.score!, 0);
  const max = valid.reduce((s, i) => s + i.max, 0);
  return round2((got / max) * weight);
}

// المجموع الكلي = Σ درجات المكونات، مع إعادة التطبيع إذا غاب مكون بعذر
export function totalScore(components: {score: number|null; weight: number}[]) {
  const present = components.filter(c => c.score !== null);
  const wSum = present.reduce((s, c) => s + c.weight, 0);
  const raw  = present.reduce((s, c) => s + c.score!, 0);
  return wSum ? round2((raw / wSum) * 100) : null;
}
```

قواعد العمل:
- **غياب بعذر** (`excused`) لا يُحتسب صفراً ويُستبعد من المقام.
- **غياب بدون عذر** = صفر (قابل للتعديل من الإعدادات).
- **سلم التقدير** قابل للضبط: ممتاز (90-100)، جيد جداً (80-89)، جيد (70-79)، مقبول (50-69)، يحتاج إلى دعم (<50).
- إحصاءات فورية لكل عمود: المتوسط، الوسيط، الانحراف المعياري، أعلى/أدنى، نسبة الإتقان.
- **قفل الفترة**: بعد الاعتماد تُقفل الدرجات؛ أي تعديل لاحق يتطلب سبباً ويُسجَّل في سجل التدقيق مع القيمة القديمة والجديدة.

### 2.3 واجهة الإدخال
- جدول شبكي (الطالبات صفوف × التقييمات أعمدة) مع **التنقل بلوحة المفاتيح** (Enter/Tab) وحفظ تلقائي متفائل (Optimistic) كل خلية.
- لصق عمود كامل من Excel.
- تلوين شرطي: أحمر < 50%، أصفر 50-69%، أخضر ≥ 90%.
- وضع **«إدخال سريع بالجوال»**: بطاقة لكل طالبة أثناء الحصة.

### 2.4 التقارير
| التقرير | المحتوى | الصيغ |
|---|---|---|
| بطاقة الطالبة الفردية | الدرجات بالمكونات، الرسم المهاري (Radar)، الحضور، السلوك، ملاحظة المعلمة، النقاط والأوسمة | PDF |
| كشف الفصل | جميع الطالبات × المكونات + المجموع + التقدير | PDF (A4 أفقي) / CSV / XLSX |
| تحليل الاختبار | معامل السهولة والتمييز لكل سؤال، أكثر الأخطاء شيوعاً | PDF |
| تقرير المهارات الجماعي | خريطة حرارية للمهارات × الطالبات | PDF |
| تقرير الدعم العلاجي | الطالبات تحت 60% في مهارة معينة + خطة علاجية مقترحة | PDF |
| ملف التصدير لنظام «نور» | أعمدة مرتبة وفق ترتيب الإدخال المطلوب لتسهيل النقل | CSV (UTF-8 BOM) |

> **CSV عربي:** يُصدَّر بترميز **UTF-8 مع BOM** حتى يفتح في Excel دون تشوّه الحروف.

---

## 3) توزيع المنهج

### 3.1 البنية الهرمية
```
السنة الدراسية ← الفصل الدراسي ← الوحدة ← الأسبوع ← الدرس ← الأهداف/المهارات
```
كل درس يحمل: العنوان، نوع المكوّن (نص قرائي، استماع، صنف لغوي، وظيفة نحوية،
رسم إملائي، رسم كتابي/خط، تواصل كتابي، تواصل شفهي)، عدد الحصص، الأهداف، المفردات
الجديدة، الأوراق والألعاب المرتبطة.

### 3.2 بيانات أولية مقترحة (نموذج قابل للتعديل)

> ⚠️ عناوين الوحدات والنصوص تُستورد من **التوزيع الرسمي الصادر من الوزارة**
> للعام الحالي (ملف Excel يُرفع مرة واحدة). المهارات النحوية والإملائية التالية
> نموذجية لمستوى الصف الرابع وتحتاج اعتماد المعلمة/المشرفة:

| المجال | أمثلة مهارات الصف الرابع |
|---|---|
| الصنف اللغوي / الوظيفة النحوية | الجملة الاسمية (المبتدأ والخبر)، الجملة الفعلية (الفعل والفاعل)، الفعل الماضي/المضارع/الأمر، الضمائر، أسماء الإشارة، الأسماء الموصولة، المفرد والمثنى والجمع، حروف الجر |
| الرسم الإملائي | التاء المربوطة والمفتوحة، اللام الشمسية والقمرية، الهمزة في أول الكلمة (وصل/قطع)، الألف اللينة، التنوين |
| الرسم الكتابي | خط النسخ (حروف ومقاطع وكلمات) |
| الأسلوب والتركيب | التعجب، الاستفهام، النداء، النفي |

### 3.3 التقويم الزمني
- عرض **شهري/أسبوعي** بالتاريخين **الهجري (أم القرى) والميلادي**.
- أنواع الأحداث: درس، واجب، اختبار قصير، فتري، نهائي، نشاط، إجازة رسمية.
- **سحب وإفلات لإعادة الجدولة**؛ عند تأجيل درس يعرض النظام خيار «إزاحة الدروس التالية تلقائياً» مع تنبيه إن تجاوزت الخطة نهاية الفصل.
- **مؤشر التغطية**: نسبة المنفَّذ فعلياً مقابل المخطط (يراه المشرفة).
- إجازات التقويم الدراسي الرسمي تُحمَّل مسبقاً وتُستثنى تلقائياً.
- تصدير التوزيع: PDF (خطة فصلية للطباعة) + iCal (للتقويم الشخصي).

---

## 4) بيانات الطالبات

### 4.1 القائمة
بحث فوري، تصفية حسب الفصل/المستوى/التقدير، استيراد من Excel (من «نور»)، أرشفة بدل الحذف.

### 4.2 الملف الفردي (تبويبات)

| التبويب | المحتوى |
|---|---|
| **البيانات** | الاسم الرباعي، رقم الهوية (مُشفّر، يظهر مُقنَّعاً `1•••••••89`)، تاريخ الميلاد، الفصل، ولي الأمر وجواله، ملاحظات صحية (حساسية/نظارة/سمع) — **صلاحية `students:sensitive`** |
| **الحضور** | تسجيل يومي/لكل حصة: حاضرة، غائبة، متأخرة، بعذر. نسبة الحضور، تنبيه عند 3 غيابات متتالية |
| **السلوك** | سجل إيجابي/سلبي بفئات (تعاون، نظام، مشاركة...) ونقاط سلوك مستقلة عن نقاط الألعاب |
| **الدرجات** | ملخص الأداء + الرسم المهاري + المنحنى الزمني |
| **الملاحظات** | ملاحظات مؤرخة بنوع (أكاديمية، تواصل مع ولي الأمر، خطة علاجية) — خاصة/مرئية للمشرفة |
| **الملفات** | رفع: صور تعبير كتابي، تسجيل قراءة جهرية صوتي، شهادات، تقارير طبية. الحد 10MB/ملف، أنواع مسموحة: PDF, JPG, PNG, MP3, M4A |
| **الألعاب** | النقاط، الأوسمة، المستوى، وقت اللعب، المهارات الأضعف |

**أمان الملفات:** تخزين S3-compatible خاص (غير عام)، روابط موقّعة تنتهي بعد 10 دقائق،
فحص نوع الملف الحقيقي (magic bytes)، إزالة بيانات EXIF من الصور، فحص فيروسات (ClamAV) في بيئة الإنتاج.

---

## 5) أوراق العمل والاختبارات

### 5.1 بنك الأسئلة
أنواع الأسئلة المدعومة (مصممة خصيصاً للغة العربية):

| النوع | مثال | تصحيح آلي |
|---|---|---|
| اختيار من متعدد | نوع الجملة «الشمسُ مشرقةٌ»: اسمية/فعلية | ✅ |
| صواب وخطأ | | ✅ |
| ملء الفراغ | «ذهبَت ____ إلى المدرسة» | ✅ (مع قائمة إجابات مقبولة) |
| توصيل | الضمير ↔ ما يناسبه | ✅ |
| تصنيف (سحب إلى سلال) | لام شمسية / قمرية | ✅ |
| ترتيب كلمات لتكوين جملة | | ✅ |
| استخراج من نص | «استخرجي من الفقرة فعلاً مضارعاً» | ✅ (قائمة مقبولة) |
| تحويل | حوّلي إلى المثنى | ✅ مع تطبيع |
| إملاء صوتي | يُشغَّل صوت وتكتب الطالبة الكلمة | ✅ مع تطبيع |
| سؤال مفتوح / تعبير | | ✋ يدوي بمعيار تقدير |
| فهم مقروء | نص + أسئلة فرعية | مختلط |

**تطبيع النص العربي قبل المقارنة (جوهر التصحيح الآلي العادل):**
```ts
// src/lib/arabicNormalize.ts
export function normalizeAr(s: string, opts = { keepHamza: true, keepTaaMarbuta: true }) {
  let t = s.normalize("NFC").trim()
    .replace(/[ً-ْٰ]/g, "")   // إزالة التشكيل
    .replace(/ـ/g, "")                   // إزالة التطويل
    .replace(/\s+/g, " ");
  if (!opts.keepHamza)      t = t.replace(/[أإآ]/g, "ا");
  if (!opts.keepTaaMarbuta) t = t.replace(/ة/g, "ه");
  return t;
}
```
> في أسئلة **الإملاء** تُفعَّل `keepHamza` و`keepTaaMarbuta` (لأنهما المهارة المقاسة)،
> وفي أسئلة **النحو والفهم** تُعطَّل لكي لا تُعاقَب الطالبة على خطأ إملائي في سؤال نحوي.

كل سؤال موسوم بـ: الدرس، المهارة، مستوى بلوم (تذكر/فهم/تطبيق)، الصعوبة (1-3)، الوقت المتوقع.

### 5.2 المولّد
1. اختيار النوع: ورقة عمل / اختبار قصير / فتري / نهائي.
2. تحديد النطاق: دروس أو وحدات أو أسابيع.
3. **جدول المواصفات** (Blueprint): عدد الأسئلة لكل مهارة × مستوى صعوبة، أو استخدام قالب جاهز.
4. التوليد: اختيار عشوائي متوازن من البنك + **مولّد قواعدي** لبعض المهارات
   (مثل توليد أسئلة المفرد/المثنى/الجمع واللام الشمسية/القمرية من قاموس مفردات المنهج).
5. **نماذج متعددة (أ/ب/ج)** بخلط الأسئلة والخيارات لمنع الغش.
6. المعاينة والتعديل اليدوي ← الحفظ ← الطباعة أو النشر إلكترونياً.

**مولّد بالذكاء الاصطناعي (اختياري):** اقتراح أسئلة جديدة من نص الدرس عبر نموذج لغوي، تُعرض **كمسودة تحتاج موافقة المعلمة** ولا تدخل البنك قبل المراجعة. لا تُرسل أي بيانات طالبات للنموذج إطلاقاً.

### 5.3 نماذج التصحيح الآلي
- **إلكترونياً:** الطالبة تحل على الجهاز ← تصحيح فوري ← الدرجة تنتقل للسجل تلقائياً.
- **ورقياً:** تُطبع ورقة إجابة بخانات + **QR** (يعرّف الاختبار والنموذج والطالبة). مرحلة 2: مسح الورقة بكاميرا الجوال وتصحيح أسئلة الاختيار آلياً (OMR).
- **نموذج الإجابة:** يُولَّد PDF منفصل لكل نموذج (أ/ب/ج) يحتوي الإجابات وتوزيع الدرجات.
- **التصحيح الجزئي:** درجة جزئية للتوصيل والتصنيف والترتيب.
- **مراجعة يدوية:** المعلمة تستطيع تجاوز أي تصحيح آلي مع تسجيل السبب.

### 5.4 PDF جاهز للطباعة
| العنصر | المواصفة |
|---|---|
| المقاس | A4 عمودي (الأوراق) / أفقي (الكشوف)، هوامش 15mm |
| الترويسة | شعار الوزارة/المدرسة، المملكة العربية السعودية، وزارة التعليم، الإدارة، المدرسة، المادة، الصف، الفصل الدراسي، الاسم، الدرجة |
| الخط | Noto Naskh Arabic / Amiri **مضمّن** في الملف، تشكيل يعمل بشكل صحيح |
| الاتجاه | RTL كامل، الأرقام عربية أو هندية حسب الإعداد |
| فواصل الصفحات | لا يُقسم سؤال بين صفحتين (`break-inside: avoid`) |
| الإخراج | ورقة الطالبة، نموذج الإجابة، دفعة طباعة لكل الفصل باسم كل طالبة |

**المحرك:** HTML/CSS للطباعة + **Playwright/Chromium (headless)** على الخادم لتوليد PDF —
وهو الخيار الأدق لتشكيل العربية (أفضل بكثير من مكتبات jsPDF/PDFKit التي تُفسد
اتصال الحروف). مع بقاء `window.print()` كبديل فوري بدون خادم.

---

## 6) الألعاب التعليمية

### 6.1 مبادئ التصميم
- كل لعبة مرتبطة **بمهارة ودرس محدد** وتسحب محتواها من بنك الأسئلة/قاموس المفردات (لا محتوى مُثبَّت في الكود).
- جلسة قصيرة (3-5 دقائق)، تغذية راجعة فورية لطيفة (لا أصوات عقابية)، صوت لنطق الكلمات.
- **صعوبة تكيفية:** 3 إجابات صحيحة متتالية ← مستوى أعلى؛ خطآن ← تلميح ثم مستوى أسهل.
- تعمل على اللوح والسبورة التفاعلية (لمس + سحب) و**دون اتصال** بعد التحميل (PWA) مع مزامنة لاحقة.

### 6.2 كتالوج الألعاب (8 ألعاب)

| # | اللعبة | المهارة | الآلية |
|---|---|---|---|
| 1 | **حديقة الشمس والقمر** | اللام الشمسية والقمرية | سحب الكلمة إلى زهرة الشمس أو زهرة القمر |
| 2 | **قطار الجملة** | ترتيب الكلمات / الجملة الاسمية والفعلية | ترتيب عربات الكلمات لتكوين جملة صحيحة ثم تصنيفها |
| 3 | **صائدة التاء** | التاء المربوطة والمفتوحة | كلمات تتساقط وتختار الطالبة «ـة» أو «ـت» |
| 4 | **مصنع الأعداد اللغوية** | المفرد والمثنى والجمع | آلة تحوّل الكلمة؛ تختار الطالبة الصيغة الصحيحة |
| 5 | **بطاقات الذاكرة** | المفردات ومعانيها / الأضداد | قلب البطاقات ومطابقة الكلمة بمعناها أو ضدها |
| 6 | **محققة الأفعال** | الماضي والمضارع والأمر | استخراج الأفعال من فقرة وتصنيفها بالنقر |
| 7 | **إملاء الصدى** | الرسم الإملائي | تسمع الكلمة وتكتبها بلوحة حروف مبسطة |
| 8 | **مسابقة الفصل المباشرة** | مراجعة شاملة | أسئلة على السبورة والطالبات يجبن من أجهزتهن مع لوحة متصدرين حية (WebSocket/SSE) |

### 6.3 نظام التحفيز
- **النقاط:** إجابة صحيحة = 10، بلا تلميح = +5، سلسلة 5 صحيحة = +20. **لا تُخصم نقاط أبداً**.
- **المستويات:** برعم ← زهرة ← نجمة ← قمر ← شمس اللغة.
- **الأوسمة:** «سيدة الإملاء»، «صديقة الأفعال»، «قارئة مثابرة» (7 أيام متتالية)، «المتحسنة» (تحسن 20% في مهارة) — مع تركيز على **التحسن** وليس التفوق فقط لحماية الدافعية.
- **لوحة الشرف:** على مستوى الفصل فقط، تعرض أعلى 5 + «الأكثر تحسناً»، وللمعلمة خيار إخفائها.
- **الشهادات:** PDF تلقائي عند بلوغ مستوى أو وسام (قالب مزخرف، اسم الطالبة، المهارة، التاريخ الهجري، توقيع المعلمة، QR للتحقق من صحة الشهادة عبر رابط `/verify/{code}`).

### 6.4 تتبع الأداء
كل محاولة تُسجَّل كحدث (`GameAttempt`): المهارة، السؤال، صحيحة/خاطئة، الوقت، التلميحات.
لوحة المعلمة تعرض: أكثر الأخطاء تكراراً لكل مهارة، الوقت المستغرق، طالبات لم يلعبن هذا الأسبوع،
و**ربط بالسجل:** يمكن للمعلمة (اختيارياً) احتساب إتقان لعبة ضمن مكون «المشاركة» أو «الواجبات».

---

## 7) المتطلبات التقنية

### 7.1 المعمارية

```
┌──────────────── المتصفح / اللوح / السبورة (PWA, RTL) ────────────────┐
│ واجهة المعلمة │ واجهة المشرفة (RO) │ واجهة الطالبة + الألعاب (Offline) │
└───────────────┬──────────────────────────────────────────────────────┘
                │ HTTPS (TLS 1.3) + CSP + HSTS
┌───────────────▼─────────────── Next.js 15 (App Router) ───────────────┐
│ Middleware (Auth/RBAC) → Route Handlers /api/v1/* (Zod) → Services    │
│ Services: grades · curriculum · students · assessments · games · pdf  │
└──────┬───────────────┬────────────────┬─────────────────┬────────────┘
       │ Prisma        │                │                 │
┌──────▼──────┐ ┌──────▼──────┐ ┌───────▼───────┐ ┌───────▼────────┐
│ PostgreSQL  │ │ Redis       │ │ Object Storage│ │ PDF Worker     │
│ (RLS, PITR) │ │ cache/rate/ │ │ (S3, private) │ │ (Playwright)   │
│             │ │ live quiz   │ │ ملفات/صوت/PDF │ │ queue: BullMQ  │
└─────────────┘ └─────────────┘ └───────────────┘ └────────────────┘
```

### 7.2 قاعدة البيانات (Prisma — المخطط الأساسي)

```prisma
// ========== الهوية والصلاحيات ==========
enum Role { SUPER_ADMIN SCHOOL_ADMIN TEACHER SUPERVISOR STUDENT GUARDIAN }

model School {
  id        String  @id @default(cuid())
  name      String
  region    String              // الإدارة التعليمية
  logoUrl   String?
  users     User[]
  classes   SchoolClass[]
  years     AcademicYear[]
}

model User {
  id           String   @id @default(cuid())
  schoolId     String
  school       School   @relation(fields: [schoolId], references: [id])
  name         String
  email        String?  @unique
  passwordHash String?
  totpSecret   String?            // مشفر
  role         Role
  active       Boolean  @default(true)
  failedLogins Int      @default(0)
  lockedUntil  DateTime?
  lastLoginAt  DateTime?
  permissions  UserPermission[]
  classLinks   ClassStaff[]
  student      Student?           // إذا كان الدور STUDENT
  createdAt    DateTime @default(now())
}

model UserPermission {             // تخصيص: منح أو سحب صلاحية لمستخدم بعينه
  userId     String
  user       User    @relation(fields: [userId], references: [id], onDelete: Cascade)
  permission String              // "grades:export"
  granted    Boolean             // true = منح، false = سحب
  @@id([userId, permission])
}

model ClassStaff {                 // ربط المعلمة/المشرفة بالفصول (نطاق البيانات)
  userId  String
  classId String
  role    Role                     // TEACHER | SUPERVISOR
  user    User        @relation(fields: [userId], references: [id])
  class   SchoolClass @relation(fields: [classId], references: [id])
  @@id([userId, classId])
}

// ========== الهيكل الأكاديمي ==========
model AcademicYear {
  id        String   @id @default(cuid())
  schoolId  String
  school    School   @relation(fields: [schoolId], references: [id])
  label     String               // "1448هـ"
  terms     Term[]
}

model Term {
  id         String   @id @default(cuid())
  yearId     String
  year       AcademicYear @relation(fields: [yearId], references: [id])
  number     Int                 // 1 | 2 (أو 3 حسب النظام المعتمد)
  startDate  DateTime
  endDate    DateTime
  weeks      Week[]
  units      Unit[]
  holidays   Holiday[]
  schemes    AssessmentScheme[]
}

model Week {
  id       String   @id @default(cuid())
  termId   String
  term     Term     @relation(fields: [termId], references: [id])
  number   Int
  start    DateTime
  end      DateTime
  lessons  Lesson[]
  @@unique([termId, number])
}

model Holiday { id String @id @default(cuid()); termId String; term Term @relation(fields: [termId], references: [id]); title String; start DateTime; end DateTime }

model SchoolClass {
  id       String  @id @default(cuid())
  schoolId String
  school   School  @relation(fields: [schoolId], references: [id])
  grade    Int     @default(4)
  section  String               // "أ"
  students Student[]
  staff    ClassStaff[]
  events   CalendarEvent[]
  @@unique([schoolId, grade, section])
}

// ========== المنهج ==========
enum LessonKind { READING LISTENING LEXICAL GRAMMAR SPELLING HANDWRITING WRITING SPEAKING REVIEW }

model Unit {
  id      String  @id @default(cuid())
  termId  String
  term    Term    @relation(fields: [termId], references: [id])
  order   Int
  title   String
  lessons Lesson[]
}

model Lesson {
  id         String     @id @default(cuid())
  unitId     String
  unit       Unit       @relation(fields: [unitId], references: [id])
  weekId     String?                       // قابل لإعادة الجدولة
  week       Week?      @relation(fields: [weekId], references: [id])
  order      Int
  title      String
  kind       LessonKind
  periods    Int        @default(1)
  objectives String[]
  skills     LessonSkill[]
  vocab      VocabItem[]
  questions  Question[]
  status     String     @default("PLANNED") // PLANNED | DONE | POSTPONED
}

model Skill {                     // مهارات لغتي (قاموس ثابت قابل للتوسعة)
  id     String @id @default(cuid())
  code   String @unique          // "SPELL.TAA", "GRAM.NOMINAL"
  domain String                  // قراءة، إملاء، نحو...
  title  String
  lessons LessonSkill[]
  questions Question[]
}
model LessonSkill { lessonId String; skillId String; lesson Lesson @relation(fields: [lessonId], references: [id]); skill Skill @relation(fields: [skillId], references: [id]); @@id([lessonId, skillId]) }

model VocabItem {                // قاموس المفردات يغذي الألعاب والمولّد القواعدي
  id       String  @id @default(cuid())
  lessonId String
  lesson   Lesson  @relation(fields: [lessonId], references: [id])
  word     String
  meaning  String?
  antonym  String?
  plural   String?
  dual     String?
  tags     String[]              // ["SHAMSI"], ["TAA_MARBUTA"]...
  audioUrl String?
}

model CalendarEvent {
  id        String   @id @default(cuid())
  classId   String
  class     SchoolClass @relation(fields: [classId], references: [id])
  type      String               // LESSON | HOMEWORK | QUIZ | MIDTERM | FINAL | ACTIVITY
  title     String
  date      DateTime
  lessonId  String?
  assessmentId String?
  rescheduledFrom DateTime?
}

// ========== الطالبات ==========
model Student {
  id            String  @id @default(cuid())
  userId        String? @unique
  user          User?   @relation(fields: [userId], references: [id])
  classId       String
  class         SchoolClass @relation(fields: [classId], references: [id])
  fullName      String
  nationalIdEnc String?              // مشفر AES-256-GCM على مستوى التطبيق
  birthDate     DateTime?
  guardianName  String?
  guardianPhoneEnc String?
  healthNotesEnc   String?
  avatar        String?
  loginPictureCode String?           // رمز الصور للدخول (مُجزّأ)
  archived      Boolean @default(false)
  attendance    Attendance[]
  behavior      BehaviorRecord[]
  notes         StudentNote[]
  files         StudentFile[]
  grades        GradeEntry[]
  attempts      Attempt[]
  gameAttempts  GameAttempt[]
  badges        StudentBadge[]
  certificates  Certificate[]
  points        Int     @default(0)    // ملخص مشتق (denormalized)
}

enum AttendanceStatus { PRESENT ABSENT LATE EXCUSED }
model Attendance {
  id        String  @id @default(cuid())
  studentId String
  student   Student @relation(fields: [studentId], references: [id])
  date      DateTime @db.Date
  period    Int?
  status    AttendanceStatus
  note      String?
  recordedBy String
  @@unique([studentId, date, period])
}

model BehaviorRecord { id String @id @default(cuid()); studentId String; student Student @relation(fields: [studentId], references: [id]); date DateTime; category String; positive Boolean; points Int @default(0); note String?; recordedBy String }

model StudentNote {
  id         String  @id @default(cuid())
  studentId  String
  student    Student @relation(fields: [studentId], references: [id])
  authorId   String
  kind       String               // ACADEMIC | GUARDIAN_CONTACT | REMEDIAL | SUPERVISOR
  body       String
  visibleToSupervisor Boolean @default(true)
  createdAt  DateTime @default(now())
}

model StudentFile { id String @id @default(cuid()); studentId String; student Student @relation(fields: [studentId], references: [id]); storageKey String; fileName String; mime String; size Int; category String; uploadedBy String; createdAt DateTime @default(now()) }

// ========== التقييم والدرجات ==========
enum ComponentKind { PARTICIPATION HOMEWORK PERFORMANCE QUIZ MIDTERM FINAL CUSTOM }

model AssessmentScheme {          // الأوزان لكل فصل دراسي
  id         String @id @default(cuid())
  termId     String
  term       Term   @relation(fields: [termId], references: [id])
  components SchemeComponent[]
  gradeScale Json                 // [{min:90,label:"ممتاز"},...]
  lockedAt   DateTime?
}
model SchemeComponent { id String @id @default(cuid()); schemeId String; scheme AssessmentScheme @relation(fields: [schemeId], references: [id]); kind ComponentKind; title String; weight Decimal @db.Decimal(5,2); items GradeItem[] }

model GradeItem {                 // عمود في السجل: "اختبار قصير 1"، "قراءة جهرية - الوحدة 2"
  id           String @id @default(cuid())
  componentId  String
  component    SchemeComponent @relation(fields: [componentId], references: [id])
  classId      String
  title        String
  maxScore     Decimal @db.Decimal(6,2)
  date         DateTime
  assessmentId String?           // إن كان مرتبطاً باختبار إلكتروني
  rubricId     String?
  skillIds     String[]
  entries      GradeEntry[]
}

model GradeEntry {
  id         String  @id @default(cuid())
  itemId     String
  item       GradeItem @relation(fields: [itemId], references: [id])
  studentId  String
  student    Student @relation(fields: [studentId], references: [id])
  score      Decimal? @db.Decimal(6,2)
  status     String  @default("NORMAL")  // NORMAL | EXCUSED | ABSENT
  source     String  @default("MANUAL")  // MANUAL | AUTO | GAME
  updatedBy  String
  updatedAt  DateTime @updatedAt
  @@unique([itemId, studentId])
}

model Rubric { id String @id @default(cuid()); title String; criteria Json }  // [{criterion:"سلامة النطق", levels:[...]}]

// ========== الأسئلة والاختبارات ==========
enum QType { MCQ TRUE_FALSE FILL_BLANK MATCHING CLASSIFY ORDER_WORDS EXTRACT TRANSFORM DICTATION OPEN READING_PASSAGE }

model Question {
  id          String  @id @default(cuid())
  lessonId    String?
  lesson      Lesson? @relation(fields: [lessonId], references: [id])
  skillId     String?
  skill       Skill?  @relation(fields: [skillId], references: [id])
  type        QType
  stem        String
  payload     Json      // الخيارات/الأزواج/السلال/النص حسب النوع
  answerKey   Json      // الإجابات المقبولة + قواعد التطبيع + الدرجة الجزئية
  points      Decimal   @db.Decimal(5,2)
  difficulty  Int       @default(1)
  bloom       String?
  mediaUrl    String?
  parentId    String?   // أسئلة فرعية لنص فهم مقروء
  status      String    @default("APPROVED") // DRAFT (مولّد آلياً) | APPROVED
  createdBy   String
}

enum AssessmentKind { WORKSHEET QUIZ MIDTERM FINAL GAME_SET }
model Assessment {
  id         String @id @default(cuid())
  kind       AssessmentKind
  title      String
  termId     String
  blueprint  Json?                  // جدول المواصفات
  versions   AssessmentVersion[]
  durationMin Int?
  publishedAt DateTime?
  createdBy  String
}
model AssessmentVersion {         // النماذج أ/ب/ج
  id           String @id @default(cuid())
  assessmentId String
  assessment   Assessment @relation(fields: [assessmentId], references: [id])
  label        String              // "أ"
  questionIds  String[]            // مرتبة
  shuffleSeed  Int
  pdfKey       String?             // PDF مُخزَّن مؤقتاً
  answerPdfKey String?
  attempts     Attempt[]
}
model Attempt {
  id         String @id @default(cuid())
  versionId  String
  version    AssessmentVersion @relation(fields: [versionId], references: [id])
  studentId  String
  student    Student @relation(fields: [studentId], references: [id])
  answers    Json                 // {questionId: response}
  autoScore  Decimal? @db.Decimal(6,2)
  finalScore Decimal? @db.Decimal(6,2)
  perSkill   Json?                // {skillCode: ratio}
  startedAt  DateTime
  submittedAt DateTime?
  gradedBy   String?
}

// ========== الألعاب والتحفيز ==========
model Game { id String @id @default(cuid()); code String @unique; title String; skillCodes String[]; config Json; active Boolean @default(true) }
model GameAssignment { id String @id @default(cuid()); gameId String; classId String; lessonIds String[]; from DateTime; to DateTime?; countsToGrades Boolean @default(false) }

model GameAttempt {
  id         String @id @default(cuid())
  studentId  String
  student    Student @relation(fields: [studentId], references: [id])
  gameCode   String
  skillCode  String
  itemRef    String                 // questionId | vocabId
  correct    Boolean
  hintsUsed  Int     @default(0)
  ms         Int
  level      Int
  points     Int
  createdAt  DateTime @default(now())
  clientId   String  @unique        // لمنع التكرار عند المزامنة بعد عدم الاتصال
  @@index([studentId, createdAt])
  @@index([skillCode])
}

model Badge { id String @id @default(cuid()); code String @unique; title String; icon String; rule Json }
model StudentBadge { studentId String; badgeId String; student Student @relation(fields: [studentId], references: [id]); earnedAt DateTime @default(now()); @@id([studentId, badgeId]) }
model Certificate { id String @id @default(cuid()); studentId String; student Student @relation(fields: [studentId], references: [id]); title String; verifyCode String @unique; pdfKey String; issuedBy String; issuedAt DateTime @default(now()) }

// ========== التدقيق والإشراف ==========
model AuditLog {
  id        String   @id @default(cuid())
  actorId   String
  action    String                 // GRADE_UPDATE, LESSON_RESCHEDULE...
  entity    String
  entityId  String
  before    Json?
  after     Json?
  reason    String?
  ip        String?
  createdAt DateTime @default(now())
  @@index([entity, entityId])
}
model SupervisorComment { id String @id @default(cuid()); authorId String; classId String; targetType String; targetId String; body String; createdAt DateTime @default(now()) }
```

**ملاحظات تصميمية للقاعدة:**
- الأعمدة الحساسة مشفّرة على مستوى التطبيق (`*Enc`) بمفتاح في KMS/متغير سري، وليست مجرد تشفير القرص.
- `GameAttempt` هو الجدول الأكبر نمواً (≈ 30 طالبة × 40 محاولة × 180 يوماً ≈ 216 ألف صف/فصل/سنة) → فهرسة + تقسيم حسب السنة (Partitioning) عند تجاوز الملايين، ومشاهدة مُجمَّعة (Materialized View) `skill_mastery_daily` للوحات.
- لا حذف نهائي للبيانات الأكاديمية: أرشفة (`archived`) + سياسة احتفاظ.

### 7.3 واجهات API (REST مُرقّمة الإصدار `/api/v1`)

| المورد | المسارات | الصلاحية |
|---|---|---|
| المصادقة | `POST /auth/login` · `POST /auth/2fa/verify` · `POST /auth/student-login` · `POST /auth/logout` | عام |
| الفصول | `GET /classes` · `GET /classes/:id/summary` | `students:read` |
| الطالبات | `GET/POST /classes/:id/students` · `GET/PATCH /students/:id` · `POST /students/import` | `students:*` |
| الحضور | `PUT /classes/:id/attendance?date=` (دفعة) · `GET /students/:id/attendance` | `attendance:write` |
| السلوك/الملاحظات | `POST /students/:id/behavior` · `POST /students/:id/notes` | `behavior:write` |
| الملفات | `POST /students/:id/files/presign` · `GET /files/:id/url` | `files:upload` |
| المنهج | `GET /terms/:id/plan` · `PATCH /lessons/:id` · `POST /lessons/:id/reschedule {toWeek, shiftFollowing}` | `curriculum:*` |
| التقويم | `GET /classes/:id/calendar?from&to` · `POST/PATCH /events` · `GET /classes/:id/calendar.ics` | `curriculum:*` |
| الدرجات | `GET /classes/:id/gradebook?termId` · `PUT /grade-items/:id/entries` (دفعة) · `POST /grade-items` · `POST /terms/:id/lock` | `grades:*` |
| التقارير | `GET /reports/student/:id?format=pdf` · `GET /reports/class/:id?format=pdf\|csv\|xlsx` · `GET /reports/item-analysis/:assessmentId` | `reports:*` |
| الأسئلة | `GET/POST /questions?skill&lesson&type` · `POST /questions/ai-draft` | `assessments:write` |
| الاختبارات | `POST /assessments/generate {blueprint}` · `GET /assessments/:id/pdf?version=أ&answers=1` · `POST /assessments/:id/publish` | `assessments:*` |
| المحاولات | `POST /attempts` · `PUT /attempts/:id/answers` · `POST /attempts/:id/submit` | `games:play` (الطالبة) |
| الألعاب | `GET /me/games` · `GET /games/:code/session` · `POST /game-attempts/batch` · `GET /classes/:id/games/analytics` | `games:*` |
| التحفيز | `GET /me/progress` · `GET /classes/:id/leaderboard` · `GET /verify/:code` (عام) | — |
| الإدارة | `GET/POST/PATCH /users` · `PUT /users/:id/permissions` · `GET /audit` | `users:manage` |

معايير موحّدة: JSON، أخطاء بصيغة `{error:{code, message_ar}}`، ترقيم صفحات بالمؤشر (cursor)،
`Idempotency-Key` لعمليات الدفعات، OpenAPI 3.1 مولَّد آلياً من مخططات Zod (`zod-to-openapi`)،
Rate limit: 5 محاولات دخول/دقيقة، 300 طلب/دقيقة للمستخدم.

### 7.4 الاستضافة الآمنة

| الخيار | التوصية |
|---|---|
| **الموصى به للمدارس السعودية** | سحابة داخل المملكة (مزود مرخّص من هيئة الاتصالات والفضاء والتقنية، مثل STC Cloud أو مراكز بيانات Oracle/Google/Microsoft في المملكة) لتحقيق متطلبات **نظام حماية البيانات الشخصية (PDPL)** وضوابط الهيئة الوطنية للأمن السيبراني (ECC) بخصوص إقامة البيانات |
| تجريبي / مدرسة واحدة | Vercel/Netlify + Neon/Supabase (كما في `DEPLOY.md`) — مع الانتباه أن البيانات خارج المملكة |
| حاويات | Docker Compose (app + postgres + redis + pdf-worker + minio) خلف Nginx/Caddy |

ضوابط الأمان:
- TLS 1.3، HSTS، CSP صارمة، `X-Frame-Options: DENY` (باستثناء صفحات السبورة).
- 2FA للطاقم، قفل الحساب، سجل دخول وتنبيه عند دخول من جهاز جديد.
- تشفير عند السكون (القرص) + تشفير حقول حساسة (تطبيق) + TLS عند النقل.
- مبدأ أقل صلاحية لقاعدة البيانات (مستخدم تطبيق بلا صلاحيات DDL).
- فحص التبعيات (`npm audit`، Dependabot)، واستبدال `xlsx` بـ `exceljs` (ثغرات معروفة — انظر README).
- سياسة خصوصية واضحة للأولياء، الحد الأدنى من البيانات، وتعطيل أي تتبع إعلاني أو تحليلات خارجية في واجهة الطالبة.

### 7.5 النسخ الاحتياطي (قاعدة 3-2-1)

| النوع | التكرار | الاحتفاظ | المكان |
|---|---|---|---|
| PITR (WAL مستمر) | لحظي | 7 أيام | مزود القاعدة |
| `pg_dump` مشفّر (age/GPG) | يومي 2:00 ص | 30 يوماً | تخزين كائنات منفصل |
| نسخة أسبوعية | أسبوعي | 12 أسبوعاً | منطقة/مزود آخر (Off-site) |
| نهاية الفصل الدراسي | كل فصل | 5 سنوات | أرشيف بارد |
| الملفات المرفوعة | Versioning + نسخ يومي | 30 يوماً | Bucket ثانٍ |

**المؤشرات المستهدفة:** RPO ≤ 15 دقيقة، RTO ≤ 4 ساعات.
**اختبار استعادة شهري آلي** على بيئة Staging مع تقرير — النسخة غير المختبرة لا تُعتبر نسخة.

### 7.6 توافق الطباعة وPDF
- قوالب HTML مخصصة للطباعة `@page { size: A4; margin: 15mm }` + `@media print`.
- خطوط عربية مضمّنة محلياً (لا اعتماد على CDN أثناء التوليد).
- عامل PDF منفصل (Queue) حتى لا يُبطئ الخادم؛ تخزين مؤقت للـ PDF حسب بصمة المحتوى (hash).
- اختبارات بصرية آلية (Playwright screenshot diff) لكل قالب للتأكد من عدم انكسار الحروف أو الصفحات.

### 7.7 قياسات الأداء والمراقبة

| المؤشر | الهدف |
|---|---|
| LCP (شبكة مدرسية 4G) | < 2.5 ث |
| INP | < 200 ms |
| زمن استجابة API (p95) | < 300 ms |
| فتح سجل درجات 35 طالبة × 30 عمود | < 1 ث |
| توليد PDF ورقة عمل | < 3 ث (دفعة فصل كامل < 30 ث) |
| حجم حزمة لعبة | < 300 KB مضغوطة |
| التوافر | 99.5% خلال الدوام المدرسي |
| مسابقة مباشرة | 40 جهازاً متزامناً بزمن < 500 ms |

الأدوات: Sentry (أخطاء + أداء)، OpenTelemetry، لوحة صحة `/api/health`، تنبيهات عند فشل النسخ الاحتياطي،
واختبارات حمل k6 قبل الإطلاق.

**مؤشرات تربوية (KPIs) تظهر للمعلمة والمشرفة:** نسبة تغطية المنهج، متوسط الإتقان لكل مهارة، نسبة
الطالبات تحت حد الدعم، معدل المشاركة في الألعاب أسبوعياً، الفرق بين الاختبار القبلي والبعدي.

---

## 8) تجربة الاستخدام (UX) — قواعد إلزامية
- RTL كامل، دعم الأرقام العربية والهندية، التاريخ الهجري أولاً.
- أهداف لمس ≥ 48px في واجهة الطالبة، وتباين ألوان WCAG AA.
- كل إجراء حساس (حذف/قفل/تعديل بعد قفل) بتأكيد + سبب.
- وضع «العرض على السبورة» لتكبير الألعاب والمسابقات.
- العمل دون اتصال للألعاب وتسجيل الحضور، مع مؤشر مزامنة.

---

## 9) خطة التنفيذ (12 أسبوعاً)

| المرحلة | الأسابيع | المخرجات | معيار القبول |
|---|---|---|---|
| 1. التأسيس | 1-2 | تحويل المستودع لـ Monorepo أو فرع منفصل، المخطط الجديد، RBAC الدقيق + 2FA، دخول الطالبات بالصور | المشرفة لا تستطيع تنفيذ أي `PATCH/POST/DELETE` (اختبار آلي) |
| 2. المنهج والطالبات | 3-4 | استيراد التوزيع والطالبات، التقويم بالسحب والإفلات، الملف الفردي (حضور/سلوك/ملاحظات/ملفات) | إعادة جدولة درس تُزيح التالي بشكل صحيح وتتجاوز الإجازات |
| 3. سجل الدرجات | 5-6 | الأوزان، الجدول الشبكي، الحساب التلقائي، القفل، تقارير PDF/CSV | مطابقة الحساب مع 20 حالة اختبار يدوية من المعلمة 100% |
| 4. الأسئلة والاختبارات | 7-8 | بنك الأسئلة (11 نوعاً)، التطبيع العربي، المولّد + النماذج، PDF، الحل الإلكتروني | PDF بلا كسر حروف على 3 طابعات مدرسية |
| 5. الألعاب | 9-10 | 6 ألعاب أولى + النقاط والأوسمة والشهادات + لوحة التحليلات | لعب كامل على لوح بدون اتصال ثم مزامنة دون تكرار |
| 6. التقوية والإطلاق | 11-12 | النشر داخل المملكة، النسخ الاحتياطي واختبار الاستعادة، اختبار حمل وأمان، تدريب، تجربة مع فصلين | UAT بموافقة المعلمة والمشرفة |

**المرحلة الثانية (بعد الإطلاق):** بوابة ولي الأمر، تصحيح الأوراق بالكاميرا (OMR)، مسابقة مباشرة، تقييم القراءة الجهرية بتسجيل صوتي، توسيع لبقية الصفوف.

---

## 10) المخاطر والتخفيف

| الخطر | التخفيف |
|---|---|
| عدم تطابق المحتوى مع التوزيع الرسمي | الاستيراد من ملف الوزارة + اعتماد المشرفة قبل التفعيل |
| ضعف شبكة المدرسة | PWA، تخزين مؤقت، الألعاب Offline، صفحات خفيفة |
| خصوصية بيانات قاصرات | استضافة محلية، تشفير الحقول، لا تحليلات خارجية، سجل تدقيق |
| مقاومة التغيير / عبء على المعلمة | إدخال سريع، لصق من Excel، تدريب قصير، قوالب جاهزة |
| أخطاء التصحيح الآلي للعربية | تطبيع مضبوط حسب نوع المهارة + مراجعة يدوية + قائمة إجابات مقبولة |
| المنافسة السلبية بين الطالبات | لوحة شرف قابلة للإخفاء، أوسمة للتحسن، لا خصم نقاط |

---

## 11) الخطوة التالية المقترحة
1. اعتماد الأوزان وسلم التقدير من المعلمة وفق لائحة التقويم الحالية.
2. تزويد الفريق بملف التوزيع الرسمي للفصل الدراسي (Excel/PDF) وقائمة الطالبات من «نور».
3. البدء بالمرحلة 1 مباشرة على هذا المستودع (إعادة استخدام: `auth.ts`, `excelImport.ts`, `WorksheetPrintView.tsx`, `grading.ts`, `AuditLog`).
