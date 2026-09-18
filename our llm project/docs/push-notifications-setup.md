# إعداد إشعارات Push (FCM) — دليل التشغيل

الكود جاهز بالكامل في المنصات الثلاث. يتبقى **خطوات إعداد يدوية** في Firebase Console وCloudflare لأنها تتطلب تسجيل دخول تفاعلي ولا يمكن أتمتتها. أنجزها مرة واحدة.

مشروع Firebase: **`synaptic-3ef0d`** (messagingSenderId: `633875033612`).

البنية جاهزة: الباكند يوقّع عبر service account ويرسل بـ FCM HTTP v1 API (`backend/src/queues/notificationConsumer.ts`)، ويستهدف الكل/كورس/طالب من لوحة المدرس. يبقى فقط ربط الأطراف.

---

## 1) الباكند — سر الـ Service Account (مرة واحدة)

الباكند يحتاج مفتاح service account (مختلف عن إعداد الويب/العميل):

1. Firebase Console → ⚙️ Project settings → **Service accounts** → **Generate new private key** → يُنزّل ملف JSON.
2. اضبطه كسر على Cloudflare Workers (لا تلصقه في الكود ولا ترسله لأحد):
   ```bash
   cd "backend"
   wrangler secret put FIREBASE_SERVICE_ACCOUNT_JSON
   # الصق محتوى ملف الـ JSON كاملاً عند الطلب
   ```
3. تأكد أن قائمة الانتظار مفعّلة في `wrangler.toml` (منتج/مستهلك) — إن لم تكن، الباكند يرسل مباشرة عبر `sendNotificationDirectly` كبديل.

بدون هذا السر، تُحفظ الإشعارات في قاعدة البيانات وتظهر داخل التطبيق/الويب، لكن **لا تصل كإشعار Push للنظام**.

---

## 2) تطبيق الطالب (Flutter / Android)

الكود جاهز (firebase_core + firebase_messaging، تسجيل التوكن في كل تدفقات الدخول، معالج الخلفية، مستمع تدوير التوكن، إذن Android 13). يتبقى ملف الإعداد الأصلي:

1. Firebase Console → مشروع `synaptic-3ef0d` → **Add app** → **Android**.
2. **Android package name**: `tech.synapticstudio.drphysics` (مطابق لـ `android/app/build.gradle`).
3. حمّل **`google-services.json`** وضعه في:
   ```
   student_app/android/app/google-services.json
   ```
4. ابنِ التطبيق:
   ```bash
   cd "student_app"
   flutter pub get
   flutter build apk --release
   ```
   > قبل إضافة `google-services.json` سيفشل البناء برسالة `File google-services.json is missing` — هذا متوقع.

ملاحظة: `flutter analyze` يعمل ويمر نظيفاً بدون هذا الملف (لا يحتاجه)؛ فقط بناء الـ APK يتطلبه.

---

## 3) ويب الطالب (React PWA)

جاهز بالكامل، **لا خطوات إضافية**:
- إعداد Firebase Web مضمّن في `student-web/src/services/firebase.ts`.
- مفتاح VAPID العام مضمّن (آمن للعميل).
- معالجة إشعارات الخلفية مدموجة في `student-web/public/sw.js` (Service Worker واحد للـ PWA وFCM معاً).
- يُطلب الإذن عند تسجيل الدخول، مع زر تفعيل لاحق في تبويب "حسابي".

> يعمل فقط على أصل HTTPS (أو localhost). تأكد أن نطاق الإنتاج ضمن **Authorized domains** في Firebase Auth settings إن لزم.

---

## 4) اختبار شامل بعد الإعداد

1. سجّل دخول طالب على التطبيق (جهاز حقيقي، ليس محاكي) أو على الويب، ووافق على إذن الإشعارات.
2. من لوحة المدرس (admin) → الرئيسية → مربع إرسال إشعار → اختر الجمهور (الكل/كورس/طالب) واكتب عنواناً ونصاً وأرسل.
3. المتوقع:
   - **التطبيق في الخلفية**: إشعار في شريط النظام.
   - **التطبيق مفتوح**: شريط SnackBar داخل التطبيق.
   - **الويب مغلق/خلفية**: إشعار نظام من المتصفح.
   - **الويب مفتوح**: Toast داخل الصفحة.
4. لو لم يصل: تحقق من `wrangler tail` للباكند، ومن أن `push_token` محفوظ في جدول `devices` للطالب (يُحدّث عند كل دخول)، ومن ضبط سر service account.

---

## أمان
- مفتاح VAPID وإعداد Web config **عامان** بطبيعتهما (مصممان للعميل) — لا مشكلة في وجودهما بالكود.
- ملف `google-services.json` وسر `FIREBASE_SERVICE_ACCOUNT_JSON` **حساسان** — لا يُرفعان للمستودع العام. `google-services.json` مضاف عادة لـ `.gitignore` (تحقق).
