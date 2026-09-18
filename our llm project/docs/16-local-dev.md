# 16 — إعداد بيئة التطوير المحلية (Local Development Setup)

يوثق هذا الدليل خطوات إعداد وتشغيل كافة أجزاء المشروع محلياً على جهاز التطوير لتسهيل العمل والاختبار قبل النشر.

---

## ⚙️ 1. تشغيل الباكند محلياً (Cloudflare Workers + D1 local)

يعتمد التطوير المحلي للـ Workers على نظام محاكاة بيئة Cloudflare عن طريق **Miniflare** المدمج في Wrangler.

### المتطلبات الأساسية:
- تثبيت Node.js (إصدار 18 فما فوق).
- تثبيت `wrangler` CLI عالمياً أو تشغيله باستخدام `npx`.

### خطوات التشغيل:
1. **تثبيت الاعتماديات:**
   ```bash
   cd workers/dr-physics-api
   npm install
   ```
2. **تشغيل الهجرات محلياً (D1 Migrations):**
   ```bash
   npx wrangler d1 migrations apply dr_physics_prod_db --local
   ```
3. **تشغيل الخادم المحلي:**
   ```bash
   npx wrangler dev
   ```
   سيتم تشغيل الـ API محلياً على الرابط `http://localhost:8787`.

---

## 💻 2. تشغيل لوحة التحكم ويب محلياً (Next.js)

1. **تجهيز الملفات:**
   ```bash
   cd dashboard
   npm install
   ```
2. **إنشاء ملف البيئة المحلي (`.env.local`):**
   ```env
   NEXT_PUBLIC_SUPABASE_URL=https://your-supabase-project.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
   NEXT_PUBLIC_API_URL=http://localhost:8787
   ```
3. **تشغيل خادم التطوير:**
   ```bash
   npm run dev
   ```
   ستفتح لوحة التحكم على الرابط `http://localhost:3000`.

---

## 📱 3. تشغيل تطبيق الموبايل محلياً (Flutter)

1. **تثبيت الاعتماديات:**
   ```bash
   flutter pub get
   ```
2. **تجهيز ملف الـ configuration:**
   تعديل ملف البيئة الموجه لخادم التطوير المحلي. إذا كنت تستخدم محاكي Android، استخدم `http://10.0.2.2:8787` كعنوان للـ API بدلاً من `localhost`.
3. **تشغيل التطبيق:**
   ```bash
   flutter run --dart-define=API_BASE_URL=http://localhost:8787
   ```
