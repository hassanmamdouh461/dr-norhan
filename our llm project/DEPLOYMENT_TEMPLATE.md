# 📋 دليل نشر نسخة إنتاجية جديدة — Template Deployment Guide

> هذا الملف هو **التيمبلت الرئيسي** لإنشاء نسخة إنتاجية جديدة من المنصة التعليمية لأي مدرس جديد.
> عند استلام طلب من مدرس، قم بنسخ هذا المشروع بالكامل وتعديل القيم الموضحة أدناه فقط.

---

## 📐 اصطلاح التسمية (Naming Convention)

كل مدرس يحصل على **معرف منصة فريد** (`PLATFORM_KEY`) يُستخدم كجذر لجميع الموارد.

| العنصر | النمط | مثال (الهضبة) |
| :--- | :--- | :--- |
| `PLATFORM_KEY` | `{اسم-قصير-بالإنجليزية}` | `alhadaba-chemistry` |
| Worker API name | `{PLATFORM_KEY}-api` | `alhadaba-chemistry-api` |
| API subdomain | `api.{PLATFORM_KEY}.synapticstudio.tech` | `api.alhadaba-chemistry.synapticstudio.tech` |
| Dashboard Pages project | اسم مختصر عربي/إنجليزي | `mowqe-al-modares` |
| Dashboard subdomain | `{PLATFORM_KEY}.synapticstudio.tech` | `alhadaba-chemistry.synapticstudio.tech` |
| Student Web Pages project | اسم مختصر عربي/إنجليزي | `mansah-tollabiah` |
| Student Web subdomain | `{PLATFORM_KEY}-student.synapticstudio.tech` | `alhadaba-chemistry-student.synapticstudio.tech` |
| D1 Database | `{PLATFORM_KEY_underscored}_prod_db` | `alhadaba_chemistry_prod_db` |
| KV Namespace | `{PLATFORM_KEY}-kv` | (يُنشأ تلقائياً ويُعطى ID) |
| R2 Bucket (ملفات) | `{PLATFORM_KEY}-files` | `alhadaba-chemistry-files` |
| R2 Bucket (فيديو HLS) | `{PLATFORM_KEY}-video-hls` | `alhadaba-chemistry-video-hls` |
| Video CDN subdomain | `videos.{PLATFORM_KEY}.synapticstudio.tech` | `videos.alhadaba-chemistry.synapticstudio.tech` |
| Queue (نقل الفيديو) | `{PLATFORM_KEY}-video-transfer` | `alhadaba-chemistry-video-transfer` |
| Supabase Project | مشروع مستقل لكل مدرس | `https://xxxxx.supabase.co` |
| Firebase Project | مشروع مستقل لكل مدرس | (لإشعارات FCM) |
| Flutter Deep Link Scheme | `{PLATFORM_KEY}` | `alhadaba-chemistry` أو `alhadaba` |

---

## 🏗️ الموارد المطلوب إنشاؤها لكل مدرس جديد

### 1. Supabase (مصادقة الطلاب)

> **قرار معماري:** يتم إنشاء **حساب Supabase مستقل (Account)** لكل مدرس وليس مجرد مشروع جديد على نفس الحساب.
> السبب: الـ Free Plan يدعم مشروعين نشطين فقط لكل حساب. بإنشاء حساب منفصل لكل مدرس، كل مدرس يعمل على Free Tier بتكلفة **$0/شهر** بدون أي قيود.
>
> **اصطلاح التسمية:** إيميل حساب Supabase لكل مدرس: `{PLATFORM_KEY}@synapticstudio.tech` أو إيميل مخصص.

- [ ] إنشاء **حساب Supabase جديد** (ليس مشروع على حساب موجود)
- [ ] إنشاء مشروع جديد داخل الحساب
- [ ] تفعيل تسجيل الدخول بالبريد وكلمة المرور (Email/Password)
- [ ] نسخ الروابط والمفاتيح التالية:

| القيمة | المصدر | تُستخدم في |
| :--- | :--- | :--- |
| `SUPABASE_URL` | Settings → API → Project URL | Backend + Dashboard + Student Web + Flutter |
| `SUPABASE_ANON_KEY` | Settings → API → `anon` public key | Dashboard + Student Web + Flutter |
| `SUPABASE_JWT_SECRET` | Settings → API → JWT Secret | Backend (كـ Secret) |

### 2. Cloudflare D1 (قاعدة البيانات)
```bash
# إنشاء قاعدة البيانات
npx wrangler d1 create {PLATFORM_KEY_underscored}_prod_db

# تطبيق الهجرات
npx wrangler d1 migrations apply {PLATFORM_KEY_underscored}_prod_db --remote
```
- [ ] نسخ `database_id` الناتج وإضافته في `wrangler.toml`

### 3. Cloudflare KV (التخزين المؤقت والجلسات)
```bash
npx wrangler kv namespace create KV
```
- [ ] نسخ `id` الناتج وإضافته في `wrangler.toml`

### 4. Cloudflare R2 — باكت الملفات (PDFs + صور الكورسات)
```bash
npx wrangler r2 bucket create {PLATFORM_KEY}-files
```
- [ ] إضافة binding `R2` في `wrangler.toml`

> **ملاحظة مهمة:** هذا الباكت **خاص ومحمي** — الوصول للملفات يتم فقط عبر presigned URLs يولدها الـ Worker.

### 5. Cloudflare R2 — باكت الفيديو HLS (سيجمنتات فقط)
```bash
npx wrangler r2 bucket create {PLATFORM_KEY}-video-hls
```
- [ ] إضافة binding `R2_VIDEO` في `wrangler.toml`
- [ ] ربط subdomain الفيديو بالباكت (انظر قسم "ربط دومين الفيديو" أدناه)

> **ملاحظة مهمة:** هذا الباكت **عام عبر CDN** — السيجمنتات مشفرة AES-128 ولا فائدة منها بدون مفتاح فك التشفير الذي يُسلَّم فقط عبر الـ Worker.

### 6. Cloudflare Queue (طابور نقل الفيديو)
```bash
npx wrangler queues create {PLATFORM_KEY}-video-transfer
```

### 7. R2 API Keys (مفاتيح S3 للرفع)
- [ ] من Cloudflare Dashboard → R2 → Manage R2 API Tokens → Create API Token
- [ ] منح صلاحيات Object Read & Write على الباكتات المطلوبة
- [ ] نسخ `R2_ACCESS_KEY_ID` و `R2_SECRET_ACCESS_KEY`

### 8. Firebase (إشعارات FCM)
- [ ] إنشاء مشروع Firebase جديد
- [ ] تحميل ملف `Service Account JSON`
- [ ] رفعه كـ Secret في الـ Worker

---

## ⚙️ ملف `wrangler.toml` — القالب الكامل

```toml
name = "{PLATFORM_KEY}-api"
main = "src/index.ts"
compatibility_date = "2024-06-01"
compatibility_flags = ["nodejs_compat"]

# ── Routes ──
workers_dev = false
routes = [
  { pattern = "api.{PLATFORM_KEY}.synapticstudio.tech", custom_domain = true }
]

# ── Environment Variables ──
[vars]
SUPABASE_URL        = "https://{SUPABASE_PROJECT_REF}.supabase.co"
JWT_AUDIENCE        = "authenticated"
ENVIRONMENT         = "production"
PLATFORM_KEY        = "{PLATFORM_KEY}"
R2_BUCKET_NAME      = "{PLATFORM_KEY}-files"
CF_ACCOUNT_ID       = "780ddc00154813b98d142686dc31ecde"   # ← ثابت (حساب Cloudflare الخاص بك)
MAX_SUBREQUESTS     = "1000"
VIDEO_CDN_HOST      = "videos.{PLATFORM_KEY}.synapticstudio.tech"
CORS_ORIGIN         = "https://{PLATFORM_KEY}.synapticstudio.tech, https://{DASHBOARD_PAGES_PROJECT}.pages.dev, https://{PLATFORM_KEY}-student.synapticstudio.tech, https://{STUDENT_PAGES_PROJECT}.pages.dev, http://localhost:3000, http://localhost:5173"

# Bunny Stream (مزود الترميز السحابي — يُرفع إليه الفيديو ثم تُنقل نسخ HLS إلى R2)
# BUNNY_LIBRARY_ID  = ""
# BUNNY_CDN_HOST    = ""

# ── D1 Database ──
[[d1_databases]]
binding        = "DB"
database_name  = "{PLATFORM_KEY_underscored}_prod_db"
database_id    = "{D1_DATABASE_ID}"
migrations_dir = "migrations"

# ── KV Namespace ──
[[kv_namespaces]]
binding = "KV"
id      = "{KV_NAMESPACE_ID}"

# ── R2 Bucket (ملفات محمية) ──
[[r2_buckets]]
binding     = "R2"
bucket_name = "{PLATFORM_KEY}-files"

# ── R2 Bucket (فيديو HLS عام) ──
[[r2_buckets]]
binding     = "R2_VIDEO"
bucket_name = "{PLATFORM_KEY}-video-hls"

# ── Cloudflare Queues ──
[[queues.producers]]
queue   = "{PLATFORM_KEY}-video-transfer"
binding = "VIDEO_QUEUE"

[[queues.consumers]]
queue           = "{PLATFORM_KEY}-video-transfer"
max_batch_size  = 1
max_concurrency = 15
max_retries     = 10
retry_delay     = 30
```

---

## 🔐 الأسرار المشفرة (Worker Secrets)

تُعيَّن مرة واحدة عند إعداد المنصة ولا تُكتب في الكود:

```bash
# داخل مجلد backend/
npx wrangler secret put SUPABASE_JWT_SECRET    --name {PLATFORM_KEY}-api
npx wrangler secret put R2_ACCESS_KEY_ID       --name {PLATFORM_KEY}-api
npx wrangler secret put R2_SECRET_ACCESS_KEY   --name {PLATFORM_KEY}-api
npx wrangler secret put FIREBASE_SERVICE_ACCOUNT_JSON --name {PLATFORM_KEY}-api

# مفتاح Bunny Stream (مطلوب لرفع الفيديو وترميزه قبل نقله إلى R2)
npx wrangler secret put BUNNY_API_KEY                 --name {PLATFORM_KEY}-api
```

ملف `.dev.vars` المحلي (للتطوير فقط — لا يُرفع للإنتاج):
```env
R2_ACCESS_KEY_ID="{R2_ACCESS_KEY_ID}"
R2_SECRET_ACCESS_KEY="{R2_SECRET_ACCESS_KEY}"
```

---

## 🌐 النطاقات الفرعية (Subdomains)

جميع النطاقات تُدار من Cloudflare DNS Zone لـ `synapticstudio.tech`:

| الغرض | Subdomain | نوع الربط | الوجهة |
| :--- | :--- | :--- | :--- |
| **API (Worker)** | `api.{PLATFORM_KEY}.synapticstudio.tech` | Custom Domain (Worker) | يُربط تلقائياً عند `npx wrangler deploy` |
| **Dashboard (المدرس)** | `{PLATFORM_KEY}.synapticstudio.tech` | Custom Domain (Pages) | يُربط من Cloudflare Pages → Custom Domains |
| **Student Web** | `{PLATFORM_KEY}-student.synapticstudio.tech` | Custom Domain (Pages) | يُربط من Cloudflare Pages → Custom Domains |
| **Video CDN** | `videos.{PLATFORM_KEY}.synapticstudio.tech` | Custom Domain (R2) | يُربط من R2 Bucket → Settings → Public Access → Connect Domain |

---

## 🎬 إعداد بنية فيديو HLS عبر CDN

### المبدأ المعماري

السيجمنتات المشفرة (.ts) تُقدَّم مباشرة من R2 عبر Cloudflare CDN (تكلفة شبه صفر). المانيفست (.m3u8) ومفتاح فك التشفير (key) فقط يمران عبر الـ Worker.

```
┌─────────────────────────────────────────────────────────┐
│                   تدفق تشغيل الفيديو                     │
│                                                         │
│  المشغل ──→ Worker (manifest + key فقط)                  │
│     │         ↓                                          │
│     │    m3u8 يحتوي روابط مطلقة للسيجمنتات               │
│     │         ↓                                          │
│     └──→ CDN مباشرة (segments .ts)                       │
│           videos.{PLATFORM_KEY}.synapticstudio.tech       │
│           ↓ Cloudflare Cache (HIT بعد أول طلب)            │
│           ↓ R2 Bucket ({PLATFORM_KEY}-video-hls)          │
└─────────────────────────────────────────────────────────┘
```

### خطوات الإعداد

#### أ. إنشاء باكت الفيديو وربط الدومين
```bash
# 1. إنشاء الباكت
npx wrangler r2 bucket create {PLATFORM_KEY}-video-hls

# 2. ربط الدومين — يتم يدوياً من Cloudflare Dashboard:
#    R2 → {PLATFORM_KEY}-video-hls → Settings → Public Access → Connect Domain
#    أدخل: videos.{PLATFORM_KEY}.synapticstudio.tech
```

#### ب. ضبط CORS على باكت الفيديو

أنشئ ملف `cors-video.json`:
```json
[
  {
    "AllowedOrigins": [
      "https://{PLATFORM_KEY}.synapticstudio.tech",
      "https://{PLATFORM_KEY}-student.synapticstudio.tech",
      "https://{DASHBOARD_PAGES_PROJECT}.pages.dev",
      "https://{STUDENT_PAGES_PROJECT}.pages.dev",
      "http://localhost:3000",
      "http://localhost:5173"
    ],
    "AllowedMethods": ["GET", "HEAD"],
    "AllowedHeaders": ["*"],
    "MaxAgeSeconds": 86400
  }
]
```

```bash
# تطبيق CORS
# (حالياً يتم يدوياً من Dashboard → R2 → Bucket Settings → CORS Policy)
```

#### ج. إضافة Cache Rule على Cloudflare (خطوة يدوية)

> **تحذير:** Cloudflare لا يقوم بتخزين ملفات `.ts` و `.m3u8` مؤقتاً بشكل افتراضي. يجب إضافة Cache Rule يدوياً.

1. افتح **Cloudflare Dashboard** → Zone `synapticstudio.tech`
2. اذهب إلى **Caching** → **Cache Rules**
3. أنشئ قاعدة جديدة:
   - **Rule name:** `HLS Video CDN Cache - {PLATFORM_KEY}`
   - **When incoming requests match:**
     - Hostname equals `videos.{PLATFORM_KEY}.synapticstudio.tech`
   - **Then:**
     - Cache eligibility: **Eligible for cache**
     - Edge TTL: Override → `1 year` (31536000 seconds)
     - Browser TTL: Override → `1 year`

---

## 💻 لوحة تحكم المدرس (Dashboard — Next.js on Cloudflare Pages)

### الملفات التي تحتاج تعديل

| الملف | المتغيرات |
| :--- | :--- |
| `.env` (أو .env.local) | `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_API_URL` |
| `src/lib/api.ts` | تغيير الـ fallback URL في `API_BASE` |
| `src/lib/supabase.ts` | تغيير الـ fallback values |

### ملف `.env` للداشبورد
```env
NEXT_PUBLIC_SUPABASE_URL=https://{SUPABASE_PROJECT_REF}.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY={SUPABASE_ANON_KEY}
NEXT_PUBLIC_API_URL=https://api.{PLATFORM_KEY}.synapticstudio.tech
```

### نشر الداشبورد
```bash
cd dashboard
npm run build
npx wrangler pages deploy out --project-name {DASHBOARD_PAGES_PROJECT}
```

---

## 🎓 موقع الطالب (Student Web — Vite/React on Cloudflare Pages)

### الملفات التي تحتاج تعديل

| الملف | المتغيرات |
| :--- | :--- |
| `src/services/api.ts` | تغيير الـ fallback `apiBaseUrl` |
| `src/services/supabase.ts` | تغيير الـ fallback `supabaseUrl` و `supabaseAnonKey` |

### نشر موقع الطالب
```bash
cd student-web
npm run build
npx wrangler pages deploy dist --project-name {STUDENT_PAGES_PROJECT}
```

---

## 📱 تطبيق الطالب (Flutter Mobile App)

### الملفات التي تحتاج تعديل

| الملف | المتغيرات |
| :--- | :--- |
| `lib/config/api_config.dart` | `apiBaseUrl`, `supabaseUrl`, `supabaseAnonKey` |
| `lib/main.dart` | اسم التطبيق، Deep Link Scheme |
| `android/app/src/main/AndroidManifest.xml` | Deep Link Scheme + Package Name |
| `ios/Runner/Info.plist` | Deep Link Scheme + Bundle ID |

### ملف `api_config.dart`
```dart
const String apiBaseUrl = 'https://api.{PLATFORM_KEY}.synapticstudio.tech';
const String supabaseUrl = 'https://{SUPABASE_PROJECT_REF}.supabase.co';
const String supabaseAnonKey = '{SUPABASE_ANON_KEY}';
```

---

## 🎥 الفيديوهات المجانية (YouTube)

> الفيديوهات المجانية **لا تُرفع على البنية التحتية المدفوعة** (لا Bunny Stream ولا R2).
> المدرس يرفعها على **YouTube** (Unlisted أو Public) ويضيف رابط الفيديو مباشرة من لوحة التحكم.

- الفيديو المجاني يُعرض داخل مشغل YouTube المدمج (iframe/WebView)
- لا يستهلك موارد Worker أو R2 أو أي تكلفة تشغيلية
- لا تنطبق عليه طبقات الحماية (AES/DRM/Signed URLs) لأنه محتوى مفتوح أصلاً
- يظل التطبيق يطبق `FLAG_SECURE` والعلامة المائية على شاشة المشغل قدر المتاح

---

## 🚀 نشر الـ API (Worker)

```bash
cd backend

# 1. تطبيق هجرات قاعدة البيانات
npx wrangler d1 migrations apply {PLATFORM_KEY_underscored}_prod_db --remote

# 2. نشر الـ Worker
npx wrangler deploy
```

---

## ✅ قائمة مراجعة النشر الكاملة (Deployment Checklist)

### البنية التحتية
- [ ] إنشاء **حساب Supabase جديد** + مشروع جديد + تفعيل Email Auth
- [ ] إنشاء D1 Database + نسخ `database_id`
- [ ] إنشاء KV Namespace + نسخ `id`
- [ ] إنشاء R2 Bucket للملفات (`{PLATFORM_KEY}-files`)
- [ ] إنشاء R2 Bucket للفيديو (`{PLATFORM_KEY}-video-hls`)
- [ ] إنشاء R2 API Token (Access Key + Secret Key)
- [ ] إنشاء Cloudflare Queue (`{PLATFORM_KEY}-video-transfer`)
- [ ] إنشاء مشروع Firebase + تحميل Service Account JSON

### الدومينات و DNS
- [ ] ربط Worker API بـ `api.{PLATFORM_KEY}.synapticstudio.tech`
- [ ] ربط Dashboard Pages بـ `{PLATFORM_KEY}.synapticstudio.tech`
- [ ] ربط Student Web Pages بـ `{PLATFORM_KEY}-student.synapticstudio.tech`
- [ ] ربط R2 Video Bucket بـ `videos.{PLATFORM_KEY}.synapticstudio.tech`
- [ ] إضافة Cache Rule لدومين الفيديو (Cache Everything, TTL 1 year)
- [ ] ضبط CORS على باكت الفيديو

### الأسرار (Secrets)
- [ ] `SUPABASE_JWT_SECRET`
- [ ] `R2_ACCESS_KEY_ID`
- [ ] `R2_SECRET_ACCESS_KEY`
- [ ] `FIREBASE_SERVICE_ACCOUNT_JSON`
- [ ] `BUNNY_API_KEY` (مفتاح Bunny Stream للترميز السحابي)

### تعديل الكود
- [ ] تحديث `backend/wrangler.toml` بكل القيم الجديدة
- [ ] تحديث `backend/.dev.vars` بمفاتيح R2 المحلية
- [ ] تحديث `dashboard/.env` بروابط Supabase و API
- [ ] تحديث `student-web/src/services/api.ts` و `supabase.ts`
- [ ] تحديث `student_app/lib/config/api_config.dart`
- [ ] تحديث اسم التطبيق و Deep Link Scheme في Flutter

### النشر
- [ ] تطبيق D1 Migrations (`--remote`)
- [ ] رفع الأسرار بـ `wrangler secret put`
- [ ] نشر Backend Worker (`npx wrangler deploy`)
- [ ] نشر Dashboard (`npx wrangler pages deploy out`)
- [ ] نشر Student Web (`npx wrangler pages deploy dist`)
- [ ] بناء تطبيق Flutter (`flutter build apk --release`)

### التحقق بعد النشر
- [ ] تسجيل دخول المدرس على الداشبورد يعمل
- [ ] تسجيل طالب جديد من موقع الطالب يعمل
- [ ] رفع كورس + محاضرة + فيديو من الداشبورد يعمل
- [ ] تشغيل فيديو من موقع الطالب يعمل
- [ ] التحقق من `cf-cache-status: HIT` على سيجمنتات الفيديو
- [ ] الإشعارات تصل عبر FCM (إذا مفعّل)
