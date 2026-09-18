# نشر منصة رياضيات 1448 على Netlify

دليل خطوة بخطوة لنشر هذا المشروع (Next.js 15 + Prisma) على Netlify مع
قاعدة بيانات PostgreSQL مُدارة. يستغرق التنفيذ الكامل من الصفر عادة
15-20 دقيقة.

---

## الخطوة 1: إنشاء قاعدة بيانات PostgreSQL مجانية

المشروع يستخدم PostgreSQL (غير متوافق مع SQLite على بيئات serverless).
أسهل خيار مجاني:

### الخيار أ) Neon (موصى به - أسرع إعداد)
1. افتح [neon.tech](https://neon.tech) وأنشئ حساباً مجانياً.
2. أنشئ مشروعاً جديداً (New Project) — اختر أقرب منطقة لك.
3. من لوحة المشروع، انسخ **Connection String** (يبدأ بـ `postgresql://`).
   تأكد من اختيار وضع "Pooled connection" إن ظهر خياران.

### الخيار ب) Supabase
1. افتح [supabase.com](https://supabase.com) وأنشئ مشروعاً جديداً.
2. من Project Settings → Database → Connection string، انسخ رابط
   الاتصال (استخدم "Connection pooling" على المنفذ 6543 لبيئة serverless).

احتفظ برابط الاتصال هذا — ستحتاجه في الخطوة 4.

---

## الخطوة 2: تجهيز قاعدة البيانات (مرة واحدة قبل أول نشر)

من جهازك المحلي (بعد استنساخ المستودع):

```bash
git clone -b claude/saudi-math-education-platform-erz3c4 https://github.com/nmoschool/Claude11.git
cd Claude11
npm install

# ضع رابط قاعدة البيانات الذي نسخته في الخطوة 1
echo 'DATABASE_URL="postgresql://...."' > .env
echo 'NEXTAUTH_SECRET="'$(openssl rand -base64 32)'"' >> .env

npm run db:push    # ينشئ كل الجداول في قاعدة البيانات السحابية
npm run db:seed    # يضيف خريطة المنهج + حسابات تجريبية
```

> تأكد من نجاح `db:push` قبل المتابعة — إن ظهر خطأ اتصال فتأكد من صحة
> رابط `DATABASE_URL` ومن أن قاعدة البيانات تسمح بالاتصال من الإنترنت
> (مفعّلة افتراضياً في Neon وSupabase).

---

## الخطوة 3: ربط المستودع بـ Netlify

1. افتح [app.netlify.com](https://app.netlify.com) وسجّل الدخول (يمكن
   الدخول مباشرة بحساب GitHub).
2. اضغط **Add new site → Import an existing project**.
3. اختر **GitHub** وامنح Netlify صلاحية الوصول لمستودع
   `nmoschool/Claude11` (إن لم يكن مصرَّحاً مسبقاً).
4. اختر المستودع، ثم من قائمة الفروع اختر
   **`claude/saudi-math-education-platform-erz3c4`**.
5. Netlify يكتشف Next.js تلقائياً ويقترح:
   - **Build command**: `npm run build`
   - **Publish directory**: يُترك فارغاً/تلقائياً (يديره
     `@netlify/plugin-nextjs` الذي يُضاف تلقائياً)
   اترك الإعدادات الافتراضية كما هي.

---

## الخطوة 4: متغيرات البيئة

قبل الضغط على Deploy، من **Site settings → Environment variables** (أو
الشاشة التي تظهر أثناء الاستيراد)، أضف:

| المتغير | القيمة |
|---------|--------|
| `DATABASE_URL` | رابط الاتصال من الخطوة 1 (نفسه) |
| `NEXTAUTH_SECRET` | نفس القيمة العشوائية التي ولّدتها في الخطوة 2 |
| `NEXTAUTH_URL` | رابط موقعك على Netlify، مثال: `https://your-site.netlify.app` (يمكن تعديله بعد أول نشر عندما يُنشئ Netlify الرابط) |

> إن لم تعرف رابط الموقع بعد: انشر أولاً بأي قيمة مؤقتة لـ
> `NEXTAUTH_URL`، ثم بعد ظهور الرابط الفعلي عدّل المتغير وأعد النشر
> (Trigger deploy) من لوحة Netlify.

---

## الخطوة 5: النشر

اضغط **Deploy site**. تابع سجل البناء (Deploy log) حتى تظهر رسالة
النجاح. Netlify سيشغّل `npm install` (وبالتالي `postinstall: prisma
generate` تلقائياً) ثم `npm run build`.

---

## الخطوة 6: التحقق

1. افتح رابط الموقع الذي أنشأه Netlify.
2. سجّل الدخول بالحساب التجريبي الذي أنشأه `db:seed`:
   - `admin@school.sa` / `ChangeMe123!`
3. **غيّر كلمة المرور فوراً** من لوحة الإدارة (أو أنشئ حساب مدير جديد
   واحذف/عطّل الحساب التجريبي) قبل استخدام الموقع فعلياً.

---

## ملاحظات مهمة

- **كل نشر جديد (push لفرع الإنتاج) يُعيد بناء الموقع تلقائياً**، لكنه
  لا يُشغّل `db:push`/`db:seed` من تلقائياً — أي تعديل مستقبلي على
  `prisma/schema.prisma` يتطلب تشغيل `npm run db:push` يدوياً (بنفس
  طريقة الخطوة 2) بعد كل تعديل في المخطط.
- **النسخ الاحتياطي**: كل من Neon وSupabase يوفران نسخاً احتياطية
  تلقائية في الخطط المجانية بحدود محدودة؛ راجع القسم 7 في `README.md`
  لمتطلبات الإنتاج الكاملة (نسخ احتياطي يومي، تشفير، إلخ) قبل الاعتماد
  الفعلي في مدرسة.
- **نطاق مخصص (Custom Domain)**: من Site settings → Domain management
  يمكن ربط نطاق خاص بالمدرسة بدلاً من `netlify.app`.
