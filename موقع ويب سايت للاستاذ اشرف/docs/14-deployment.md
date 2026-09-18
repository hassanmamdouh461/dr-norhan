# 14 — خطة النشر والبيئات (Deployment & Environments)

يوثق هذا الملف إجراءات النشر وإعداد البيئات المختلفة وإعداد نطاقات الـ DNS وبوابات الاتصال لكل مكونات منصة "فُصْحَى — الأستاذ أشرف سليم" على البنية التحتية الخاصة بـ **Cloudflare** و **Supabase**.

---

## 🌐 أولاً: هيكلة النطاقات (DNS and Subdomains)

تُدار النطاقات بالكامل من خلال لوحة تحكم Cloudflare الخاصة بـ `fusha.site`:

| النطاق | المكوّن | نوع السجل | الوجهة / الربط |
|---|---|---|---|
| `fusha.site` (+ `www`) | تطبيق الطالب (Pages) | CNAME | Custom Domain على مشروع `fusha-student-web` |
| `dashboard.fusha.site` | لوحة تحكم المدرس (Pages) | CNAME | Custom Domain على مشروع `fusha-dashboard` |
| `api.fusha.site` | الـ API الخلفي (Workers) | CNAME | Custom Domain على العامل `fusha-ashraf-api` |

### نطاقات المعاينة والاحتياط (Fallbacks)
| النطاق | المكوّن |
|---|---|
| `fusha-student-web.pages.dev` | تطبيق الطالب — رابط Pages الافتراضي |
| `fusha-dashboard.pages.dev` | لوحة التحكم — رابط Pages الافتراضي |
| `fusha-ashraf-api.synaptic-gw.workers.dev` | الـ API — رابط Workers الافتراضي (اسم حساب Cloudflare الحقيقي) |

> **⚠️ مهم:** بما أن الواجهتين والـ API على **مضيفين مختلفين** (`fusha.site` مقابل `api.fusha.site`)،
> فلا يمكن الاعتماد على الطلبات النسبية. يجب ضبط `VITE_API_URL` و`NEXT_PUBLIC_API_URL`
> على `https://api.fusha.site` **وقت البناء** (يفعله `deploy-all.sh` تلقائياً).
> البديل الوحيد للطلبات النسبية هو إضافة Worker Route على `fusha.site/*` — وهو غير مُعدّ حالياً.

---

## 💻 ثانياً: نشر لوحة تحكم المدرس (Cloudflare Pages)

يتم نشر تطبيق لوحة التحكم المكتوب بـ Next.js كـ **موقع ويب ساكن (Static HTML Export)** لتقليل تكاليف التشغيل وزيادة سرعة التحميل العالمية.

### 1) الإعداد والتحضير (Build Settings)
- **أمر البناء:** `npm run build` (مع تفعيل `output: 'export'` في ملف `next.config.js`).
- **مجلد المخرجات:** `out` (المجلد الناتج عن البناء الساكن).
- **إعدادات البيئة (Environment Variables):**
  - `NEXT_PUBLIC_SUPABASE_URL`: رابط مشروع Supabase.
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY`: مفتاح Supabase العام.
  - `NEXT_PUBLIC_API_URL`: رابط الـ API الخلفي (`https://fusha-ashraf-api.<your-subdomain>.workers.dev`).

### 2) خطوات النشر
1. ربط مستودع GitHub بـ Cloudflare Pages.
2. تحديد إعدادات البناء أعلاه.
3. يقوم Cloudflare بالبناء والرفع التلقائي مع كل عملية دفع (Push) لفرع `main` (للإنتاج) أو `staging` (للاختبار).
4. إضافة النطاق المخصص `fusha-dashboard.pages.dev` في تبويب **Custom Domains** داخل إعدادات Pages.

---

## ⚙️ ثالثاً: نشر الـ API الخلفي (Cloudflare Workers)

يتم كتابة ونشر الـ API الخلفي باستخدام إطار عمل **Hono** ويتم نشره باستخدام أداة **Wrangler CLI**.

### 1) ملف إعدادات `wrangler.toml` (النسخة الإنتاجية)
```toml
name = "fusha-api"
main = "src/index.js"
compatibility_date = "2026-06-22"

[vars]
SUPABASE_URL = "https://your-supabase-project.supabase.co"
JWT_AUDIENCE = "authenticated"

[[d1_databases]]
binding = "DB"
database_name = "fusha_prod_db"
database_id = "your-d1-database-uuid"

[[r2_buckets]]
binding = "FILES"
bucket_name = "fusha-prod-files"

[[kv_namespaces]]
binding = "KV"
id = "your-kv-namespace-uuid"

[[queues.producers]]
queue = "fusha-prod-notif-queue"
binding = "NOTIF_QUEUE"

[[queues.consumers]]
queue = "fusha-prod-notif-queue"
max_batch_size = 10
max_batch_timeout = 5
```

### 2) الأسرار والمتغيرات الحساسة (Worker Secrets)
يتم إدخال المتغيرات الحساسة مباشرة عبر سطر الأوامر لتشفيرها وعدم إدراجها في الكود:
```bash
npx wrangler secret put SUPABASE_JWT_SECRET
npx wrangler secret put BUNNY_API_KEY
npx wrangler secret put R2_ACCESS_KEY_ID
npx wrangler secret put R2_SECRET_ACCESS_KEY
npx wrangler secret put FIREBASE_SERVICE_ACCOUNT_JSON
```

### 3) تنفيذ هجرات قاعدة البيانات (D1 Migrations)
قبل تشغيل الـ API، يجب تطبيق هيكل الجداول على D1:
```bash
# تطبيق الهجرة محلياً للتأكد
npx wrangler d1 migrations apply fusha_prod_db --local

# تطبيق الهجرة على الخادم البعيد (الإنتاج)
npx wrangler d1 migrations apply fusha_prod_db --remote
```

### 4) أمر النشر النهائي
```bash
npx wrangler deploy
```

### 5) مهمة صيانة قاعدة البيانات المجدولة (D1 Maintenance Cron)
يتم إدراج التكوين التالي في ملف `wrangler.toml` لجدولة عملية الصيانة الدورية محلياً وتلقائياً:
```toml
[triggers]
crons = ["0 3 * * 5"] # تشغيل كل جمعة الساعة 3 صباحاً
```
يقوم الـ Handler في الكود باستدعاء أوامر التطهير `VACUUM` و `ANALYZE` لإبقاء الاستعلامات سريعة وقاعدة البيانات خفيفة المساحة.

---

## 🔒 رابعاً: إعدادات مصادقة Supabase (Supabase Configuration)

يستخدم Supabase بشكل أساسي لإدارة هويات الطلاب والمعلمين والتحقق من الجلسات:

1. **تفعيل تسجيل الدخول:** تفعيل خيار تسجيل الدخول باستخدام البريد الإلكتروني وكلمة المرور (Email/Password) في لوحة تحكم Supabase.
2. **عناوين إعادة التوجيه (Redirect URLs):**
   - إضافة العناوين المسموحة لإعادة التوجيه بعد تأكيد البريد أو استعادة كلمة المرور:
     - `https://fusha-dashboard.pages.dev/auth/callback`
     - `https://staging.fusha-dashboard.pages.dev/auth/callback`
3. **مفتاح التحقق من التوكن (JWT verification):**
   - يقوم الـ Worker بتحميل مفاتيح التحقق (JWKS) من رابط Supabase الخاص بالمشروع لتأكيد صحة الـ Access Token المرسل من التطبيق بشكل فوري ودون الحاجة للاستعلام من خادم Supabase في كل طلب.

---

## 🧪 خامساً: بيئة الاختبار (Staging Environment)

لضمان سلامة التحديثات قبل إتاحتها للطلاب والمدرس:

- **مشروع منفصل لقاعدة البيانات D1:** باسم `fusha_staging_db` لعدم تداخل بيانات الاختبار ببيانات الطلاب الحقيقية.
- **حاوية R2 منفصلة:** باسم `fusha-staging-files`.
- **نشر Worker منفصل:** باسم `fusha-api-staging` مرتبط بالنطاق `fusha-ashraf-api-staging.<your-subdomain>.workers.dev`.
- **مشروع Supabase منفصل (اختياري):** لمنع تداخل توكنات الجلسات ومستخدمي بيئة الاختبار مع بيئة الإنتاج.

---

## 💾 سادساً: استراتيجية النسخ الاحتياطي والاستعادة (Backup & Recovery)

بيانات الطلاب والأكواد تمثل أصلاً تجارياً هاماً للمنصة، لذلك يتم إدارتها كالتالي:
1. **النسخ الاحتياطي التلقائي (D1 Backups):**
   - يتم تفعيل النسخ الاحتياطي اليومي التلقائي لقاعدة بيانات D1 من لوحة تحكم Cloudflare.
   - يتم أخذ نسخة يدوية قبل تنفيذ أي هجرات أو عمليات صيانة عبر الأمر:
     ```bash
     npx wrangler d1 backup create fusha_prod_db --remote
     ```
2. **النسخ الاحتياطي الخارجي (R2 Replication):**
   - يتم تشغيل مهمة مجدولة (Cron Task) يومية تقوم بتصدير نسخة احتياطية بصيغة SQL من قاعدة البيانات وضغطها ورفعها بشكل مستقل إلى حاوية R2 آمنة ومنعزلة للوقاية من تلف خوادم D1.
3. **خطة الاستعادة (Disaster Recovery):**
   - في حال حدوث عطل جسيم، يتم استعادة قاعدة البيانات إلى آخر نقطة سليمة عبر الأمر:
     ```bash
     npx wrangler d1 backup restore fusha_prod_db <backup-id> --remote
     ```

---

التالي: [15 — خطة العمل والمراحل](./15-roadmap.md)
