# 06 — مرجع الـ API

> الـ API يعمل على `https://fusha-ashraf-api.<your-subdomain>.workers.dev` كـ Cloudflare Worker.
> الوصف هنا **مواصفات تعاقدية** (Contract) للمسارات — وليس كودًا تنفيذيًا.

## 🔑 أساسيات

| البند | القيمة |
|---|---|
| Base URL | `https://fusha-ashraf-api.<your-subdomain>.workers.dev/v1` |
| المصادقة | ترويسة `Authorization: Bearer <Supabase JWT>` |
| الصيغة | JSON (UTF-8) |
| التواريخ | ISO-8601 UTC |
| الإصدار | بادئة `/v1` |
| ترويسات مطلوبة للموبايل | `X-Device-Id`, `X-App-Version`, `X-Platform` |

### رموز الحالة (Status codes)
| الرمز | المعنى |
|---|---|
| 200 / 201 | نجاح |
| 400 | مدخلات غير صحيحة (فشل تحقق Zod) |
| 401 | غير مصادق (توكن مفقود/منتهٍ) |
| 403 | مصادق لكن غير مصرّح (دور/اشتراك) |
| 404 | غير موجود |
| 409 | تعارض (كود مستخدم، تسجيل مكرر) |
| 423 | مقفول (تجاوز عدد الأجهزة / جهاز غير موثّق) |
| 429 | تجاوز حد المعدّل (Rate limit) |
| 500 | خطأ داخلي |

### شكل الخطأ الموحّد (مثال)
```
{
  "error": {
    "code": "CODE_ALREADY_USED",
    "message": "هذا الكود مُستخدَم بالفعل",
    "details": null
  }
}
```

### الترقيم (Pagination)
معاملات: `?page=1&limit=20` — والرد يحتوي `meta: { page, limit, total, has_more }`.

---

## 👤 المصادقة والملف الشخصي

> تسجيل الدخول نفسه يتم في **Supabase SDK** على العميل. الـ API يستقبل الـ JWT الناتج.

| الطريقة | المسار | الدور | الوصف |
|---|---|---|---|
| `POST` | `/auth/sync` | أي مستخدم مصادق | إنشاء/مزامنة `profile` بعد أول دخول |
| `GET` | `/me` | مصادق | بيانات الملف الشخصي + الأدوار |
| `PATCH` | `/me` | مصادق | تحديث الاسم/الموبايل/الصف... |
| `POST` | `/me/devices` | student | تسجيل/تحديث جهاز + push token |
| `GET` | `/me/devices` | student | قائمة أجهزتي |
| `DELETE` | `/me/devices/{id}` | student/admin | فكّ ربط جهاز |
| `POST` | `/auth/me/devices/reset-request` | student | تقديم طلب فك ارتباط أجهزتي السابقة مع السبب |
| `GET` | `/auth/me/devices/reset-requests` | student | قائمة طلبات فك أجهزتي السابقة وحالتها |

**مثال `GET /me` (رد):**
```
{
  "id": "prf_123",
  "role": "student",
  "full_name": "أحمد علي",
  "phone": "0100xxxxxxx",
  "grade": "الصف الثالث الثانوي",
  "status": "active",
  "enrollments_count": 2
}
```

---

## 📚 المحتوى (قراءة — للطلاب)

| الطريقة | المسار | الدور | الوصف |
|---|---|---|---|
| `GET` | `/courses` | student | الكورسات المتاحة (منشورة) مع علامة «مفعّل/غير مفعّل» |
| `GET` | `/courses/{id}` | student | تفاصيل كورس + الوحدات + الدروس (ميتاداتا فقط) |
| `GET` | `/me/courses` | student | كورساتي المفعّلة فقط |
| `GET` | `/lessons/{id}` | student | تفاصيل درس (يتطلّب اشتراكًا إلا إن كان Preview) |
| `GET` | `/lessons/{id}/files` | student | مرفقات الدرس |
| `GET` | `/courses/{id}/progress` | student | نسبة تقدّمي في الكورس |

**مثال `GET /courses/{id}` (رد مختصر):**
```
{
  "id": "crs_9",
  "title": "ميكانيكا — الصف الثالث",
  "is_enrolled": true,
  "units": [
    { "id": "unt_1", "title": "الوحدة 1: الحركة", "lessons_count": 6 }
  ]
}
```

---

## ▶️ البث المحمي وتتبع التشغيل (Playback & Tracking)

| الطريقة | المسار | الدور | الوصف |
|---|---|---|---|
| `POST` | `/lessons/{id}/playback` | student | يُرجع رابط HLS موقّع قصير الصلاحية + بيانات العلامة المائية |
| `POST` | `/playback/heartbeat` | student | نبضة دورية لتأكيد الجلسة وتحديث التقدّم |
| `POST` | `/lessons/{id}/playback/logs` | student | لتسجيل حدث فتح (`open`) أو إغلاق (`close`) المحاضرة بالثواني والوقت |

---

## 📝 الامتحانات القصيرة (Quizzes) — الطالب

| الطريقة | المسار | الدور | الوصف |
|---|---|---|---|
| `GET` | `/courses/{id}/quizzes` | student | قائمة الامتحانات القصيرة المتاحة في الكورس |
| `GET` | `/quizzes/{id}` | student | تفاصيل الكويز (الدرجة النهائية، العنوان) |
| `POST` | `/quizzes/{id}/attempts` | student | تقديم نتيجة محاولة حل الكويز وتخزين درجته |
| `GET` | `/me/quizzes/attempts` | student | سجل درجات ومحاولات الطالب في كافة الكويزات |

**شروط `POST /lessons/{id}/playback`:**
- الطالب مفعّل للكورس (أو الدرس Preview).
- الجهاز موثّق وضمن الحد المسموح.
- يُسجَّل الطلب في `audit_logs`.

**رد (مثال):**
```
{
  "provider": "stream",
  "hls_url": "https://<video-cdn-host>/<uid>/manifest/video.m3u8?token=<jwt>",
  "token_expires_in": 180,
  "drm": { "widevine": true, "fairplay": true },
  "watermark": {
    "text": "أحمد علي • 0100xxxxxxx",
    "mode": "moving",
    "opacity": 0.25
  },
  "policy": { "allow_cast": false, "allow_pip": false }
}
```

---

## ❓ الأسئلة والأجوبة

| الطريقة | المسار | الدور | الوصف |
|---|---|---|---|
| `GET` | `/lessons/{id}/questions` | student | أسئلة الدرس (المثبّتة أولًا) |
| `POST` | `/lessons/{id}/questions` | student | طرح سؤال |
| `POST` | `/questions/{id}/upvote` | student | إعجاب |
| `GET` | `/me/questions` | student | أسئلتي وحالتها |
| `POST` | `/questions/{id}/answers` | admin/assistant | إضافة إجابة |
| `POST` | `/answers/{id}/accept` | admin | تمييز إجابة معتمدة |
| `PATCH` | `/questions/{id}` | admin | إغلاق/إخفاء/تثبيت |

---

## ⭐ التقييمات

| الطريقة | المسار | الدور | الوصف |
|---|---|---|---|
| `GET` | `/courses/{id}/reviews` | student | تقييمات الكورس + المتوسط |
| `POST` | `/reviews` | student | إضافة/تحديث تقييم (lesson/course) |
| `DELETE` | `/reviews/{id}` | student/admin | حذف تقييمي / إخفاء (admin) |

---

## 🎟️ أكواد التفعيل (الطالب)

| الطريقة | المسار | الدور | الوصف |
|---|---|---|---|
| `POST` | `/codes/redeem` | student | تفعيل كود وفتح الكورس/الباقة |

**طلب:** `{ "code": "PHY-7Q9K-23MN" }`
**رد ناجح:**
```
{
  "ok": true,
  "course": { "id": "crs_9", "title": "ميكانيكا" },
  "access_expires_at": "2026-12-31T00:00:00Z"
}
```
**أخطاء محتملة:** `CODE_NOT_FOUND` (404)، `CODE_ALREADY_USED` (409)،
`CODE_EXPIRED` (409)، `ALREADY_ENROLLED` (409).

---

## 🔔 الإشعارات (الطالب)

| الطريقة | المسار | الدور | الوصف |
|---|---|---|---|
| `GET` | `/me/notifications` | student | قائمة إشعاراتي |
| `POST` | `/me/notifications/{id}/read` | student | تعليم كمقروء |
| `POST` | `/me/notifications/read-all` | student | تعليم الكل كمقروء |

---

# 🧑‍🏫 مسارات لوحة المدرس (Admin / Assistant)

> كلها تتطلّب دور `admin` (وبعضها متاح لـ `assistant` بصلاحيات أضيق).

## إدارة الكورسات والمحتوى

| الطريقة | المسار | الوصف |
|---|---|---|
| `POST` | `/admin/courses` | إنشاء كورس |
| `PATCH` | `/admin/courses/{id}` | تعديل كورس |
| `DELETE` | `/admin/courses/{id}` | حذف كورس (تأكيد مزدوج) |
| `POST` | `/admin/courses/{id}/reorder` | إعادة ترتيب الوحدات |
| `POST` | `/admin/units` | إنشاء وحدة |
| `PATCH` | `/admin/units/{id}` | تعديل وحدة |
| `DELETE` | `/admin/units/{id}` | حذف وحدة |
| `POST` | `/admin/lessons` | إنشاء درس |
| `PATCH` | `/admin/lessons/{id}` | تعديل درس (نشر/جدولة/Preview) |
| `DELETE` | `/admin/lessons/{id}` | حذف درس |
| `POST` | `/admin/lessons/{id}/reorder-files` | ترتيب المرفقات |
| `POST` | `/admin/quizzes` | إنشاء كويز جديد |
| `PATCH` | `/admin/quizzes/{id}` | تعديل كويز (العنوان، الدرجة، حالة النشر) |
| `DELETE` | `/admin/quizzes/{id}` | حذف كويز |

## رفع الفيديو والملفات (روابط موقّعة)

| الطريقة | المسار | الوصف |
|---|---|---|
| `POST` | `/admin/lessons/{id}/videos/bunny-upload` | يُرجع رابط رفع TUS إلى Bunny Stream + يسجّل الفيديو بحالة `uploading` |
| `POST` | `/admin/lessons/{id}/videos/bunny-upload-complete` | إبلاغ الـ API باكتمال الرفع لبدء متابعة الترميز والنقل إلى R2 |
| `GET` | `/admin/lessons/{id}/videos/transfer-status` | حالة الترميز والنقل إلى R2 |
| `POST` | `/admin/lessons/{id}/videos/transfer-retry` | إعادة محاولة النقل عند الفشل أو التعليق |
| `POST` | `/admin/lessons/{id}/videos/hls-upload-url` | رابط رفع موقّع لشرائح HLS (مسار المعالجة المحلية) |
| `POST` | `/admin/lessons/{id}/videos` | ربط فيديو (stream_uid أو youtube_id) بالدرس |
| `POST` | `/admin/uploads/file` | يُرجع رابط رفع موقّع إلى R2 (PUT) |
| `POST` | `/admin/lessons/{id}/files` | تسجيل ملف مرفوع في D1 |

**مثال `POST /admin/uploads/video` (رد):**
```
{
  "upload_url": "https://upload.videodelivery.net/<one-time>",
  "stream_uid": "ab12cd34ef...",
  "expires_in": 600
}
```

## إدارة الأكواد

| الطريقة | المسار | الوصف |
|---|---|---|
| `POST` | `/admin/codes/batches` | توليد دفعة أكواد |
| `GET` | `/admin/codes/batches` | قائمة الدفعات |
| `GET` | `/admin/codes/batches/{id}/export` | تصدير أكواد الدفعة (CSV) |
| `GET` | `/admin/codes` | بحث/فلترة الأكواد |
| `POST` | `/admin/codes/{id}/revoke` | إيقاف كود |

**طلب توليد دفعة (مثال):**
```
{
  "name": "دفعة سبتمبر",
  "scope_type": "course",
  "course_id": "crs_9",
  "quantity": 200,
  "access_days": 180,
  "expires_at": "2026-10-01T00:00:00Z"
}
```

## إدارة الطلاب

| الطريقة | المسار | الوصف |
|---|---|---|
| `GET` | `/admin/students` | قائمة الطلاب + فلترة |
| `GET` | `/admin/students/{id}` | تفاصيل طالب + اشتراكاته + تقدّمه |
| `POST` | `/admin/students/{id}/enroll` | تفعيل كورس يدويًا |
| `POST` | `/admin/students/{id}/block` | حظر طالب |
| `POST` | `/admin/students/{id}/unblock` | فكّ الحظر |
| `DELETE` | `/admin/students/{id}/devices/{deviceId}` | فكّ ربط جهاز |
| `GET` | `/admin/students/{id}/financials` | سجل التجديدات والعمليات المالية للطالب |
| `POST` | `/admin/students/{id}/financials` | إضافة سجل مالي/تجديد يدوي للطالب |
| `GET` | `/admin/students/{id}/playback-logs` | سجل فتح وإغلاق الطالب للمحاضرات بالتفصيل |
| `GET` | `/admin/students/{id}/quiz-attempts` | درجات ومحاولات الطالب في الكويزات |

## إدارة المساعدين وصلاحياتهم (RBAC)

| الطريقة | المسار | الوصف |
|---|---|---|
| `GET` | `/admin/assistants` | قائمة المساعدين المضافين مع صلاحياتهم التفصيلية |
| `POST` | `/admin/assistants` | إضافة مساعد جديد وتعيين صلاحياته |
| `PATCH` | `/admin/assistants/{id}` | تحديث صلاحيات مساعد معين |
| `DELETE` | `/admin/assistants/{id}` | إلغاء رتبة مساعد وحذف صلاحياته |

## طابور طلبات فك الأجهزة (Device Resets Queue)

| الطريقة | المسار | الوصف |
|---|---|---|
| `GET` | `/admin/device-resets` | عرض قائمة طلبات فك الأجهزة المعلقة والمعالجة |
| `POST` | `/admin/device-resets/{id}/action` | معالجة طلب فك ارتباط جهاز (قبول/رفض مع السبب) |

## الأسئلة والتقييمات (إدارة)

| الطريقة | المسار | الوصف |
|---|---|---|
| `GET` | `/admin/questions?status=open` | صندوق الأسئلة |
| `POST` | `/admin/questions/{id}/answers` | الرد |
| `PATCH` | `/admin/reviews/{id}` | إظهار/إخفاء تقييم |

## الإشعارات (إرسال)

| الطريقة | المسار | الوصف |
|---|---|---|
| `POST` | `/admin/notifications` | إرسال إشعار (لطالب/كورس/الكل) |
| `GET` | `/admin/notifications` | سجلّ الإشعارات المرسلة |

## التحليلات والإعدادات

| الطريقة | المسار | الوصف |
|---|---|---|
| `GET` | `/admin/analytics/overview` | ملخص (طلاب/تفعيلات/مشاهدات) |
| `GET` | `/admin/analytics/courses/{id}` | أداء كورس |
| `GET` | `/admin/analytics/advanced` | حساب تقارير إحصائية متطورة غير معتمدة على الـ AI (الطلاب المتعثرون، معدل الإكمال، أداء المساعدين) |
| `GET` | `/admin/settings` | قراءة الإعدادات |
| `PATCH` | `/admin/settings` | تحديث الإعدادات |
| `GET` | `/admin/audit-logs` | سجلّ التدقيق |

---

## 🛡️ سياسات عامة على الـ API

- **Rate limiting** لكل مستخدم/IP عبر KV (مثلًا 60 طلب/دقيقة، وأشدّ على `redeem` و`playback`).
- **Idempotency** على عمليات الإنشاء الحساسة عبر ترويسة `Idempotency-Key`.
- **Validation** صارمة (Zod) لكل مدخل.
- **CORS**: مسموح فقط لنطاق لوحة المدرس؛ التطبيق لا يحتاج CORS.
- **Audit**: كل إجراء إداري حساس يُسجَّل.

---

التالي: [07 — المصادقة والصلاحيات](./07-authentication.md)
