# منصة فُصحى — الأستاذ أشرف سليم

منصة ويب عربية RTL مستقلة، مبنية من أفضل أساس React/Next/TypeScript المتاح في المشروع الحالي، وتتكوّن من:

- `student-web`: واجهة الطالب React + TypeScript + Vite + Cloudflare Pages Functions.
- `dashboard`: لوحة الإدارة Next.js + TypeScript + Tailwind.
- `backend`: Cloudflare Worker (Hono) مع D1 وR2 وKV وQueues.
- `brand`: تعليمات الهوية والتوكنات وTailwind preset الرسمية.
- `docs`: توثيق المعمارية والـAPI والنشر.

## التشغيل المحلي

```bash
cd student-web && npm ci && npm run build
cd ../dashboard && npm ci && npm run build
cd ../backend && npm ci && npx tsc --noEmit && npm test -- --run
```

انسخ ملفات `.env.example`/`.dev.vars.example` محلياً وأدخل قيمك. لا ترفع الأسرار إلى المستودع.

## Cloudflare

1. أنشئ D1 وKV وحاويتي R2 وQueue بأسماء المنصة.
2. استبدل placeholders في `backend/wrangler.toml` بمعرّفات مواردك الخاصة.
3. طبّق هجرات D1 بالترتيب من `0000` إلى `0016`.
4. خزّن مفاتيح Supabase/Bunny/R2/Firebase كـWorker Secrets، لا كملفات.
5. انشر `student-web/dist` وخرج `dashboard` على Cloudflare Pages، وانشر `backend` كـWorker.

## الهوية

لوحة الإدارة تستورد `brand/tailwind_brand_preset.js` مباشرة. الواجهات عربية `dir="rtl"`، وتستخدم مقياس 8pt، أهداف لمس لا تقل عن 48px، وبطاقات أساسية باستدارة 20px.
