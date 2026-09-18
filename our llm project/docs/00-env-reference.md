# 00 — مرجع متغيرات البيئة (Environment Variables Reference)

يوضح هذا الملف جميع متغيرات البيئة والأسرار (Secrets) المطلوبة لتشغيل كلاً من الـ API (Workers)، لوحة التحكم (Pages)، وتطبيق الموبايل (Flutter).

---

## ⚙️ 1. الـ API الخلفي (Cloudflare Workers)

تُقسم المتغيرات هنا إلى متغيرات عادية (Variables) تُكتب في `wrangler.toml` وأسرار مشفرة (Secrets) تُحفظ عبر سطر الأوامر.

### المتغيرات العامة (Environment Variables)
| المتغير | النوع | الوصف | مثال |
|---|---|---|---|
| `SUPABASE_URL` | String | رابط مشروع Supabase الخاص بك | `https://oaeivekclvx.supabase.co` |
| `JWT_AUDIENCE` | String | نوع توجيه التوكن للمصادقة | `authenticated` |
| `ENVIRONMENT` | String | بيئة التشغيل (production أو development) | `production` |
| `CORS_ORIGIN` | String | النطاقات المسموح بها للمشاركة المتقاطعة (CORS) | `https://dr-physics.synapticstudio.tech` |
| `CF_ACCOUNT_ID` | String | معرف حساب Cloudflare الخاص بك (يُستخدم لتوقيع روابط R2) | `da2267a1e59b4014b49286001d96aec0` |
| `BUNNY_LIBRARY_ID` | String | معرف مكتبة Bunny Stream المستخدمة في الترميز السحابي | `478291` |
| `BUNNY_CDN_HOST` | String | نطاق الـ CDN الخاص بمكتبة Bunny | `vz-1a2b3c.b-cdn.net` |
| `VIDEO_CDN_HOST` | String | النطاق المخصص لبث شرائح HLS من R2 | `videos.dr-physics.synapticstudio.tech` |
| `ALLOW_MOCK_AUTH` | String | تفعيل المصادقة التجريبية/المحاكاة للتطوير | `true` |

### الأسرار المشفرة (Secrets)
*يتم تعيينها باستخدام الأمر: `npx wrangler secret put SECRET_NAME`*

| السر | الوصف | المصدر |
|---|---|---|
| `SUPABASE_JWT_SECRET` | سر التحقق من توقيع توكنات JWT الصادرة من Supabase | لوحة Supabase ← API settings |
| `BUNNY_API_KEY` | مفتاح الوصول لمكتبة Bunny Stream (إنشاء الفيديو وتوقيع رفع TUS) | لوحة Bunny ← Stream Library ← API |
| `R2_ACCESS_KEY_ID` | معرف مفتاح R2 المتوافق مع S3 لتوقيع روابط الملفات | Cloudflare ← R2 ← Manage API Tokens |
| `R2_SECRET_ACCESS_KEY` | المفتاح السري المقابل لـ R2 | Cloudflare ← R2 ← Manage API Tokens |
| `FIREBASE_SERVICE_ACCOUNT_JSON` | ملف JSON الخاص بـ Firebase Service Account لإرسال الإشعارات | Firebase Console ← Service Accounts |

---

## 💻 2. لوحة تحكم المدرس (Cloudflare Pages / Next.js)

يتم كتابة هذه المتغيرات في لوحة تحكم Cloudflare Pages في تبويب Settings ← Environment Variables.

| المتغير | الوصف | مثال |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | رابط مشروع Supabase العام | `https://oaeivekclvx.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | المفتاح العام غير الحساس لـ Supabase | `eyJhbGciOiJIUzI1NiIsInR5cCI...` |
| `NEXT_PUBLIC_API_URL` | رابط الـ API الخلفي للـ Workers | `https://api.dr-physics.synapticstudio.tech` |

---

## 📱 3. تطبيق الطلاب (Flutter Mobile App)

تُوضع المتغيرات في ملفات تهيئة البيئة (مثل `.env` أو عبر Dart Defines أثناء البناء).

| المتغير | الوصف | مثال |
|---|---|---|
| `API_BASE_URL` | رابط الـ API الرئيسي الموجه للـ Worker | `https://api.dr-physics.synapticstudio.tech` |
| `SUPABASE_URL` | رابط مشروع Supabase العام | `https://oaeivekclvx.supabase.co` |
| `SUPABASE_ANON_KEY` | المفتاح العام لـ Supabase | `eyJhbGciOiJIUzI1NiIsInR5c...` |
| `APP_DEEP_LINK_SCHEME` | بروتوكول الروابط العميقة | `dr-physics` |
