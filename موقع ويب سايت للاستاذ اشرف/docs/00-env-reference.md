# 00 — مرجع متغيرات البيئة (Environment Variables Reference)

يوضح هذا الملف جميع متغيرات البيئة والأسرار (Secrets) المطلوبة لتشغيل كلاً من الـ API (Workers)، لوحة التحكم (Pages)، وتطبيق الموبايل (Flutter).

---

## ⚙️ 1. الـ API الخلفي (Cloudflare Workers)

تُقسم المتغيرات هنا إلى متغيرات عادية (Variables) تُكتب في `wrangler.toml` وأسرار مشفرة (Secrets) تُحفظ عبر سطر الأوامر.

### المتغيرات العامة (Environment Variables)
| المتغير | النوع | الوصف | مثال |
|---|---|---|---|
| `AUTH_SECRET` | String | سر توقيع توكنات JWT (HS256) — **انقله إلى `wrangler secret` في الإنتاج** | `<48-حرفاً عشوائياً>` |
| `ENVIRONMENT` | String | بيئة التشغيل (production أو development) | `production` |
| `CORS_ORIGIN` | String | النطاقات المسموح بها للمشاركة المتقاطعة (CORS) | `https://fusha-dashboard.pages.dev` |
| `CF_ACCOUNT_ID` | String | معرف حساب Cloudflare الخاص بك (يُستخدم لتوقيع روابط R2) | `da2267a1e59b4014b49286001d96aec0` |
| `BUNNY_LIBRARY_ID` | String | معرف مكتبة Bunny Stream المستخدمة في الترميز السحابي | `478291` |
| `BUNNY_CDN_HOST` | String | نطاق الـ CDN الخاص بمكتبة Bunny | `vz-1a2b3c.b-cdn.net` |
| `VIDEO_CDN_HOST` | String | النطاق المخصص لبث شرائح HLS من R2 | `<video-cdn-host>` |
| `PUBLIC_API_ORIGIN` | String | النطاق العام للـ API — يُرسل كـ `Referer` عند جلب الفيديوهات من Bunny CDN. عند تركه فارغاً يُحذف الهيدر | `https://fusha-ashraf-api.<your-subdomain>.workers.dev` |
| `R2_PUBLIC_HOST` | String | المضيف العام لحاوية R2 الذي يُسمح لدالة `/cdn-img` بتمرير صوره. عند تركه فارغاً لا يُسمح بأي مضيف | `<bucket-id>.r2.cloudflarestorage.com` |
| `R2_BUCKET_NAME` | String | اسم حاوية R2 لملفات الدروس (الاحتياطي `fusha-ashraf-files`) | `fusha-ashraf-files` |
| `PLATFORM_KEY` | String | مفتاح المنصة لعزل البيانات بين المستأجرين | `fusha` |
| `ALLOW_MOCK_AUTH` | String | تفعيل المصادقة التجريبية/المحاكاة للتطوير | `true` |

### الأسرار المشفرة (Secrets)
*يتم تعيينها باستخدام الأمر: `npx wrangler secret put SECRET_NAME`*

| السر | الوصف | المصدر |
|---|---|---|
| `BUNNY_API_KEY` | مفتاح الوصول لمكتبة Bunny Stream (إنشاء الفيديو وتوقيع رفع TUS) | لوحة Bunny ← Stream Library ← API |
| `R2_ACCESS_KEY_ID` | معرف مفتاح R2 المتوافق مع S3 لتوقيع روابط الملفات | Cloudflare ← R2 ← Manage API Tokens |
| `R2_SECRET_ACCESS_KEY` | المفتاح السري المقابل لـ R2 | Cloudflare ← R2 ← Manage API Tokens |
| `FIREBASE_SERVICE_ACCOUNT_JSON` | ملف JSON الخاص بـ Firebase Service Account لإرسال الإشعارات | Firebase Console ← Service Accounts |

---

## 💻 2. لوحة تحكم المدرس (Cloudflare Pages / Next.js)

يتم كتابة هذه المتغيرات في لوحة تحكم Cloudflare Pages في تبويب Settings ← Environment Variables.

| المتغير | الوصف | مثال |
|---|---|---|
| `NEXT_PUBLIC_API_URL` | رابط الـ API الخلفي للـ Workers. اتركه **فارغاً** لتُصبح الطلبات نسبية على نفس النطاق. **يُضمَّن وقت البناء** — أي تغيير يتطلب إعادة بناء اللوحة | `https://api.fusha.site` |

---

## 🌐 3. واجهة الطالب (Cloudflare Pages / Vite + React)

يتم كتابة هذه المتغيرات في `student-web/.env` محلياً، وفي لوحة تحكم Cloudflare Pages في تبويب Settings ← Environment Variables للإنتاج. راجع `student-web/.env.example`.

| المتغير | الوصف | مثال |
|---|---|---|
| `VITE_API_URL` | رابط الـ API الخلفي. اتركه **فارغاً** لتُصبح الطلبات نسبية على نفس النطاق | `https://api.fusha.site` |
| `VITE_R2_PUBLIC_HOST` | المضيف العام لحاوية R2 لتحسين صور الأغلفة. عند تركه فارغاً يُتجاوز التحسين. يجب أن يطابق `R2_PUBLIC_HOST` في الـ Worker | `<bucket-id>.r2.cloudflarestorage.com` |

---

## 📱 4. تطبيق الطلاب (Flutter Mobile App)

تُوضع المتغيرات في ملفات تهيئة البيئة (مثل `.env` أو عبر Dart Defines أثناء البناء).

| المتغير | الوصف | مثال |
|---|---|---|
| `API_BASE_URL` | رابط الـ API الرئيسي الموجه للـ Worker | `https://fusha-ashraf-api.<your-subdomain>.workers.dev` |
| `SUPABASE_URL` | رابط مشروع Supabase العام | `https://oaeivekclvx.supabase.co` |
| `SUPABASE_ANON_KEY` | المفتاح العام لـ Supabase | `eyJhbGciOiJIUzI1NiIsInR5c...` |
| `APP_DEEP_LINK_SCHEME` | بروتوكول الروابط العميقة | `fusha` |
