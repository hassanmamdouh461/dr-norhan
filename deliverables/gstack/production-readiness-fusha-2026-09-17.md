# جاهزية الإنتاج — منصة فُصْحَى

**التاريخ:** 2026-09-17
**السيناريو:** إزالة Supabase + بناء تطبيق الطالب على التصميم الجديد + ربط النطاقات + استعادة ميزات الكود القديم

---

## 📌 TL;DR

| البند | الحالة |
|---|---|
| إزالة Supabase | ✅ **كاملة** في الباكند + تطبيق الطالب + الداشبورد |
| المصادقة الأصلية | ✅ **تعمل فعلياً** — تسجيل/دخول/توكن مُختبَرة على الإنتاج |
| الاختبارات | ✅ **588/588** · `tsc` نظيف |
| النشر | ✅ الثلاثة منشورون |
| النطاقات `fusha.site` | ⏸️ تنتظر صلاحية DNS |
| الإنتاج الكامل | 🔴 موقوف على **قرارين** منك (القسم 2) |

---

## 🔑 بيانات الدخول (جاهزة الآن)

**لوحة التحكم:** https://fusha-dashboard.pages.dev
```
البريد:   admin@fusha.site
كلمة السر: Fusha@Admin2026
```
> ⚠️ **غيّر كلمة السر فور أول دخول.**

**التحقق الفعلي على الإنتاج:**
```
POST /auth/register → 201 (أو 409 إن كان البريد موجوداً)
POST /auth/login    → 200 + access_token (336 حرفاً) + refresh_token
GET  /auth/me       → 200 + المستخدم (بلا password_hash ✓)
كود الطالب التجريبي: FSH-BE4D-3GE9
```

**العناوين الحية:**
| الخدمة | العنوان |
|---|---|
| تطبيق الطالب | https://fusha-student-web.pages.dev |
| لوحة التحكم | https://fusha-dashboard.pages.dev |
| الـ API | https://fusha-ashraf-api.synaptic-gw.workers.dev |

---

## 1. ما أُنجز

### 1.1 إزالة Supabase ✅ — مكتملة في المشاريع الثلاثة
- **الباكند**: حُذف الـ JWKS والـ webhook والمتغيرات. مصادقة أصلية: PBKDF2 (Web Crypto) + JWT (HS256) + جلسات في D1.
- **تطبيق الطالب**: `services/supabase.ts` محذوف، `AuthContext` و `api.ts` على `fetch` عادي.
- **لوحة التحكم**: `lib/supabase.ts` محذوف، `lib/auth.ts` جديد بنفس نمط الطالب.
- `grep -ri supabase` = **صفر** في المشاريع الثلاثة.
- **525 اختبار ناجح.**

### 1.1b عطب حقيقي أُصلح في لوحة التحكم 🔴
كانت اللوحة تشير إلى `https://placeholder.supabase.co` (نطاق غير موجود) — أي أن
**دخول الأستاذ معطّل تماماً**. مع إزالة Supabase من الباكند صار العطب مزدوجاً
(الباكند لم يعد يصدر توكنات Supabase أصلاً). أُصلح بالكامل.

كما أُصلح عطب ثانٍ مكتوم: **المساعدون لا يستطيعون الدخول أبداً** — `verifyPassword`
يُرجع `false` حين يكون `password_hash` فارغاً، ونموذج إنشاء المساعد لم يكن يرسل كلمة سر.
أي مساعد يُنشأ بعد التحديث كان سيُقفل نهائياً. أُضيف حقل كلمة سر إلزامي.

### 1.1c خطأ هجرة كارثي أُصلح 🔴
`migrations/0023` كان يضيف عمود `platform` إلى جدول `bundles` **وهو موجود فيه أصلاً**
من `0000_init.sql` → `duplicate column name: platform`، أي أن **أي قاعدة بيانات جديدة
من الصفر كانت ستفشل**. حُذف السطر، وأصبحت كل الهجرات تُطبَّق بنجاح.

### 1.1d محتوى عربي جاهز ✅
`backend/seeds/003_legacy_features_ar.sql`: ٤ أخبار · ٩ أخطاء شائعة
(نحو/بلاغة/أدب بمحتوى منهجي صحيح) · ٤ محافظ دفع *(بأرقام نموذجية)*.

### 1.2 تدقيق الميزات (بحث) ✅
وُثّقت كل ميزات الكود القديم ونصوصها العربية الحرفية في:
`موقع ويب سايت للاستاذ اشرف/docs/23-legacy-features-spec.md`

الميزات الناقصة المكتشفة:
`المشتريات+الموافقة` · `تحدي 1v1` · `كتاب الأخطاء+PDF` · `الأخطاء الشائعة` ·
`طلب امتحان مخصص` · `الأخبار` · `المحادثات` · `النقاط والمستوى` · `الإحالة` ·
`المحافظ` · `حزم الكورسات (CRUD)` · `سبب الإجابة الصحيحة`

**ملاحظة:** «إنشاء امتحان من ملف مرفوع» **غير موجود أصلاً** في الكود القديم — ميزة جديدة إن أردتها.

### 1.3 النطاقات — مشاريع Pages ✅ / DNS ⏸️
| النطاق | المشروع | الحالة |
|---|---|---|
| `fusha.site` | `fusha-student-web` | pending |
| `www.fusha.site` | `fusha-student-web` | pending |
| `dashboard.fusha.site` | `fusha-dashboard` | pending |

النطاق `fusha.site` **نشط** في حسابك (zone `8ac6e67b…`، nameservers `keanu` / `lauryn`).

---

## 2. 🔴 ما يوقف الإنتاج (محتاج منك)

### العائق ١ — صلاحيات التوكن **(الأهم)**
التوكن الحالي **لا يستطيع**:
- إنشاء سجلات DNS → يعطي `Authentication error (10000)`
- إنشاء مسار/دومين للـ Worker → يعطي `Method not allowed (10405)`

**الأثر:** النطاقات تبقى `pending` إلى الأبد، ولن يُربط `api.fusha.site`.

**الحل (اختر واحداً):**
- **أ)** من [API Tokens](https://dash.cloudflare.com/c4db824a32386eeced69072e0ba22de5/api-tokens)
  فعّل للنطاق `fusha.site` صلاحيات: **`DNS:Edit`** و **`Workers Routes:Edit`**
- **ب)** نفّذها يدوياً من الداشبورد:
  1. DNS → أضف `CNAME  @  → fusha-student-web.pages.dev` (Proxied)
  2. DNS → أضف `CNAME  www → fusha-student-web.pages.dev`
  3. DNS → أضف `CNAME  dashboard → fusha-dashboard.pages.dev`
  4. Workers & Pages → `fusha-ashraf-api` → Settings → Domains → أضف `api.fusha.site`

### العائق ٢ — `VIDEO_CDN_HOST`
مطلوب لتشغيل الفيديو (HLS/Bunny). بدونه: رفع الفيديو يعمل لكن التشغيل لا.

### العائق ٣ — `AUTH_SECRET` يجب أن يصبح سرّاً
موجود الآن كـ **متغير عادي** في `wrangler.toml` (مرئي في Git). للإنتاج يجب نقله:
```bash
cd backend
npx wrangler secret put AUTH_SECRET
```
ثم **احذفه** من `wrangler.toml`. إلى أن يحدث هذا، من يقرأ المستودع يستطيع تزوير توكنات دخول.

### العائق ٤ — مشروع Firebase (إشعارات Push)
`student-web/src/services/firebase.ts` و `public/sw-v4.js` يشيران إلى مشروع
**`synaptic-3ef0d` وهو مشروع خارجي لا يملكه فُصْحَى**.
- الإشعارات تعمل حالياً لكن عبر مشروع غريب.
- تغييره يبطل توكنات كل جهاز مسجّل.
- **القرار:** أنشئ مشروع Firebase باسم فُصْحَى وأعطني المفاتيح، أو أخبرني بإيقاف Push مؤقتاً.

### العائق ٥ — أرقام التواصل الحقيقية
`student wep front` كان يحوي الرقم الوهمي `201000000000`. جعلته قابلاً للضبط عبر
`VITE_CONTACT_PHONE` و `VITE_WHATSAPP_PHONE`، ويُخفى الزر إن لم يُضبط (لا يُعرض رقم وهمي).
**أعطني الرقم الحقيقي.**

### العائق ٦ — قرار العملة
الكود القديم متناقض (`جنيه` / `ر.س` / `EGP`). **اعتمدت `جنيه` موحّداً** — أكّد إن صح.

### العائق ٧ — أرقام المحافظ
`seeds/003` فيه ٤ محافظ بأرقام **نموذجية** (`01000000000`…). يجب استبدالها قبل الإطلاق.

---

## 3. متغيرات البيئة (القائمة الكاملة)

### الباكند (`wrangler.toml`)
| المتغير | الحالة |
|---|---|
| `AUTH_SECRET` | ✅ يُولَّد تلقائياً |
| `PLATFORM_KEY` | ✅ `fusha` |
| `CORS_ORIGIN` | ✅ يضم نطاقات Pages |
| `VIDEO_CDN_HOST` | 🔴 **مطلوب منك** |
| `SUPABASE_URL` | ✅ **محذوف** |

### واجهة الطالب (`student-web/.env`)
| المتغير | الحالة |
|---|---|
| `VITE_API_URL` | ✅ يُضبط عند البناء |
| `VITE_R2_PUBLIC_HOST` | 🟡 اختياري (تحسين الصور) |
| `VITE_SUPABASE_*` | ✅ **محذوف** |

### لوحة التحكم
| المتغير | الحالة |
|---|---|
| `NEXT_PUBLIC_API_URL` | ✅ يُضبط عند البناء |

---

## 4. ما لم يُختبر بعد

| المنطقة | السبب |
|---|---|
| تدفق الدخول الكامل | المصادقة جديدة — تحتاج اختباراً يدوياً من المتصفح |
| رفع/تشغيل الفيديو | ينتظر `VIDEO_CDN_HOST` |
| النطاقات المخصصة | تنتظر صلاحية DNS |
| الميزات الجديدة | قيد التنفيذ |

---

## 5. أوامر النشر (بعد اكتمال التنفيذ)

```bash
# الباكند
cd "موقع ويب سايت للاستاذ اشرف/backend"
export CLOUDFLARE_ACCOUNT_ID=c4db824a32386eeced69072e0ba22de5
npx wrangler deploy
npx wrangler d1 migrations apply fusha_ashraf_db --remote

# تطبيق الطالب
cd ../student-web
export VITE_API_URL=https://fusha-ashraf-api.synaptic-gw.workers.dev
npx vite build
npx wrangler pages deploy dist --project-name fusha-student-web --branch main

# لوحة التحكم
cd ../dashboard
export NEXT_PUBLIC_API_URL=https://fusha-ashraf-api.synaptic-gw.workers.dev
npx next build
npx wrangler pages deploy out --project-name fusha-dashboard --branch main
```

---

## 6. مخاطر معروفة

| الخطر | التخفيف |
|---|---|
| المصادقة جديدة كلياً لم تُختبر من متصفح | اختبار يدوي قبل الطلاب |
| `student wep front` صفحة تسويق لا تطبيق | اعتُبرت مرجعاً بصرياً فقط |
| توحيد الألوان يغيّر مظهر التطبيق | فرق بصري محدود (اللوحتان متقاربتان) |
| المحادثات تتضمن تسجيلاً صوتياً | أثقل ميزة — قد تؤجَّل |

---

> القرارات المعلّمة 🔴 يجب حسمها قبل أي استخدام فعلي مع الطلاب.
