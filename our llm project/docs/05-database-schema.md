# 05 — تصميم قاعدة البيانات (Cloudflare D1)

> الوصف هنا **تصميمي** (جداول وأعمدة وعلاقات) دون كتابة كود SQL. كل الجداول في
> Cloudflare D1 (SQLite). المعرّفات نصية (`TEXT`) من نوع UUID/ULID ما لم يُذكر غير ذلك.
> الطوابع الزمنية `TEXT` بصيغة ISO-8601 (UTC).

## 🗂️ مخطط العلاقات (ERD مبسّط)

```
profiles ──1:N── enrollments ──N:1── courses ──1:N── units ──1:N── lessons
   │                                    │                              │
   │                                    └──1:N── activation_codes      ├──1:N── lesson_videos
   │                                                                   ├──1:N── lesson_files
   ├──1:N── lesson_progress ───────────────────────────────────────────┘
   ├──1:N── questions ──1:N── answers
   ├──1:N── lesson_reviews / course_reviews
   ├──1:N── devices
   ├──1:N── notifications
   └──1:N── audit_logs
```

---

## 1) `profiles` — ملفات المستخدمين

> مصدر الحقيقة للأدوار والبيانات الإضافية. مرتبط بمستخدم Supabase عبر `supabase_user_id`.

| العمود | النوع | ملاحظات |
|---|---|---|
| `id` | TEXT (PK) | معرّف داخلي (UUID) |
| `supabase_user_id` | TEXT (UNIQUE) | معرّف المستخدم في Supabase Auth |
| `email` | TEXT (UNIQUE) | نسخة للقراءة السريعة |
| `student_code` | TEXT NULL (UNIQUE) | رقم الطالب الخاص الفريد (الكود الأكاديمي، مثل ST-10023) |
| `role` | TEXT | `admin` / `assistant` / `student` (افتراضي student) |
| `full_name` | TEXT | الاسم الكامل |
| `phone` | TEXT | رقم الموبايل |
| `parent_phone` | TEXT NULL | رقم وليّ الأمر (اختياري) |
| `grade` | TEXT NULL | الصف الدراسي |
| `governorate` | TEXT NULL | المحافظة |
| `avatar_url` | TEXT NULL | صورة (في R2) |
| `status` | TEXT | `active` / `blocked` |
| `max_devices` | INTEGER | حد الأجهزة المسموح (افتراضي 1–2) |
| `created_at` | TEXT | |
| `updated_at` | TEXT | |
| `last_seen_at` | TEXT NULL | آخر نشاط |
| `last_self_reset_at` | TEXT NULL | تاريخ آخر تصفير تلقائي للأجهزة بواسطة الطالب (لتطبيق مهلة الـ 30 يوماً) |

**فهارس:** `supabase_user_id`، `email`، `role`، `phone`، `student_code` (فريد).

---

## 2) `courses` — الكورسات

| العمود | النوع | ملاحظات |
|---|---|---|
| `id` | TEXT (PK) | |
| `title` | TEXT | عنوان الكورس |
| `slug` | TEXT (UNIQUE) | رابط لطيف |
| `description` | TEXT NULL | وصف |
| `cover_url` | TEXT NULL | صورة الغلاف (R2) |
| `grade` | TEXT NULL | الصف المستهدف |
| `subject` | TEXT | المادة (فيزياء) |
| `reference_price` | INTEGER NULL | سعر مرجعي (قروش/جنيه) — للعرض فقط |
| `is_published` | INTEGER (0/1) | منشور؟ |
| `is_free` | INTEGER (0/1) | مجاني بالكامل؟ |
| `is_archived` | INTEGER (0/1) | مؤرشف؟ (افتراضي 0 لسياسة Soft Delete) |
| `sort_order` | INTEGER | الترتيب |
| `created_by` | TEXT (FK→profiles) | |
| `created_at` | TEXT | |
| `updated_at` | TEXT | |

**فهارس:** `slug`، `is_published`، `grade`.
- **فهرس مركب لسرعة الاستعلام والأرشفة:** `CREATE INDEX idx_courses_lookup ON courses (is_archived, is_published, sort_order);`

---

## 3) `units` — الوحدات (داخل الكورس)

| العمود | النوع | ملاحظات |
|---|---|---|
| `id` | TEXT (PK) | |
| `course_id` | TEXT (FK→courses) | |
| `title` | TEXT | |
| `description` | TEXT NULL | |
| `sort_order` | INTEGER | ترتيب الوحدة داخل الكورس |
| `is_published` | INTEGER (0/1) | |
| `is_archived` | INTEGER (0/1) | مؤرشف؟ (افتراضي 0 لسياسة Soft Delete) |
| `created_at` | TEXT | |
| `updated_at` | TEXT | |

**فهارس:** `course_id`, `sort_order`.
- **فهرس مركب لسرعة الاستعلام والأرشفة:** `CREATE INDEX idx_units_lookup ON units (course_id, is_archived, is_published, sort_order);`

---

## 4) `lessons` — الدروس

| العمود | النوع | ملاحظات |
|---|---|---|
| `id` | TEXT (PK) | |
| `unit_id` | TEXT (FK→units) | |
| `course_id` | TEXT (FK→courses) | تكرار للوصول السريع |
| `title` | TEXT | |
| `description` | TEXT NULL | |
| `sort_order` | INTEGER | |
| `is_free_preview` | INTEGER (0/1) | درس مجاني/تجريبي بدون كود |
| `is_published` | INTEGER (0/1) | |
| `is_archived` | INTEGER (0/1) | مؤرشف؟ (افتراضي 0 لسياسة Soft Delete) |
| `is_archived` | INTEGER (0/1) | مؤرشف؟ (افتراضي 0 لسياسة Soft Delete) |
| `publish_at` | TEXT NULL | جدولة النشر |
| `duration_seconds` | INTEGER NULL | مدة الفيديو الأساسي |
| `created_at` | TEXT | |
| `updated_at` | TEXT | |

**فهارس:** `unit_id`, `course_id`, `sort_order`, `is_published`.
- **فهرس مركب لسرعة الاستعلام والأرشفة:** `CREATE INDEX idx_lessons_lookup ON lessons (unit_id, is_archived, is_published, sort_order);`

---

## 5) `lesson_videos` — فيديوهات الدرس

> يدعم مصادر متعددة: شرائح HLS مشفّرة على R2 (`r2_hls`)، ملف MP4 مباشر على R2
> (`r2` / `server`)، أو رابط YouTube.

| العمود | النوع | ملاحظات |
|---|---|---|
| `id` | TEXT (PK) | |
| `lesson_id` | TEXT (FK→lessons) | |
| `provider` | TEXT | `r2_hls` / `r2` / `server` / `youtube` |
| `stream_uid` | TEXT NULL | مسار مجلد الفيديو في R2 (`lessons/{lessonId}/videos/{videoId}/hls`) |
| `youtube_id` | TEXT NULL | معرّف فيديو YouTube |
| `thumbnail_url` | TEXT NULL | صورة مصغّرة |
| `duration_seconds` | INTEGER NULL | |
| `status` | TEXT | `uploading` / `processing` / `ready` / `error` |
| `require_drm` | INTEGER (0/1) | فرض DRM لهذا الفيديو |
| `sort_order` | INTEGER | لو الدرس فيه أكثر من فيديو (يُفضل تقييد الواجهة بفيديو واحد فقط لكل درس لتبسيط الحسابات) |
| `created_at` | TEXT | |
| `updated_at` | TEXT | |

**فهارس:** `lesson_id`, `stream_uid`, `status`.

---

## 6) `lesson_files` — مرفقات الدرس

| العمود | النوع | ملاحظات |
|---|---|---|
| `id` | TEXT (PK) | |
| `lesson_id` | TEXT (FK→lessons) | |
| `title` | TEXT | اسم الملف الظاهر |
| `r2_key` | TEXT | مفتاح الملف في R2 |
| `mime_type` | TEXT | `application/pdf` ... |
| `size_bytes` | INTEGER | |
| `is_downloadable` | INTEGER (0/1) | يسمح بالتنزيل أم عرض فقط |
| `watermark` | INTEGER (0/1) | تفعيل رسم علامة مائية ديناميكية بالعميل |
| `encrypt_offline` | INTEGER (0/1) | تشفير الملف لحفظه محلياً أوفلاين في التطبيق |
| `sort_order` | INTEGER | |
| `created_at` | TEXT | |

**فهارس:** `lesson_id`.

---

## 7) `activation_codes` — أكواد التفعيل

| العمود | النوع | ملاحظات |
|---|---|---|
| `id` | TEXT (PK) | |
| `code` | TEXT (UNIQUE) | الكود نفسه (مُهيّأ بصيغة قابلة للقراءة) |
| `batch_id` | TEXT (FK→code_batches) | الدُفعة |
| `scope_type` | TEXT | `course` / `bundle` / `all` |
| `course_id` | TEXT NULL (FK→courses) | لو الكود لكورس واحد |
| `bundle_id` | TEXT NULL (FK→bundles) | لو الكود لباقة |
| `status` | TEXT | `active` / `used` / `expired` / `revoked` |
| `max_uses` | INTEGER | عدد الاستخدامات المسموح (افتراضي 1) |
| `used_count` | INTEGER | عدد مرات الاستخدام الفعلية |
| `used_by` | TEXT NULL (FK→profiles) | أول/آخر مستخدم (لو max_uses=1) |
| `used_at` | TEXT NULL | تاريخ التفعيل |
| `valid_from` | TEXT NULL | بداية الصلاحية |
| `expires_at` | TEXT NULL | نهاية صلاحية الكود نفسه |
| `access_days` | INTEGER NULL | عدد أيام الوصول بعد التفعيل (NULL = دائم) |
| `created_by` | TEXT (FK→profiles) | |
| `created_at` | TEXT | |

**فهارس:** `code` (فريد)، `batch_id`، `status`، `course_id`.

---

## 8) `code_batches` — دفعات الأكواد

| العمود | النوع | ملاحظات |
|---|---|---|
| `id` | TEXT (PK) | |
| `name` | TEXT | اسم الدفعة (مثلًا: «دفعة سبتمبر») |
| `scope_type` | TEXT | `course`/`bundle`/`all` |
| `course_id` | TEXT NULL | |
| `bundle_id` | TEXT NULL | |
| `quantity` | INTEGER | عدد الأكواد المطلوب توليدها (يتم تأكيد العدد الفعلي عبر `COUNT(*)` في الأكواد التابعة) |
| `access_days` | INTEGER NULL | |
| `expires_at` | TEXT NULL | |
| `note` | TEXT NULL | ملاحظة للمدرس |
| `created_by` | TEXT (FK→profiles) | |
| `created_at` | TEXT | |

---

## 9) `bundles` / `bundle_courses` — الباقات (اختياري Phase 2)

`bundles`: `id`, `title`, `description`, `cover_url`, `reference_price`, `is_published`, `created_at`.
`bundle_courses`: `bundle_id` (FK), `course_id` (FK) — علاقة كثير-لكثير.

---

## 10) `enrollments` — اشتراكات الطلاب (الوصول)

| العمود | النوع | ملاحظات |
|---|---|---|
| `id` | TEXT (PK) | |
| `student_id` | TEXT (FK→profiles) | |
| `course_id` | TEXT (FK→courses) | |
| `source` | TEXT | `code` / `manual` / `free` |
| `code_id` | TEXT NULL (FK→activation_codes) | الكود الذي فعّل به |
| `status` | TEXT | `active` / `expired` / `revoked` |
| `granted_at` | TEXT | تاريخ منح الوصول |
| `expires_at` | TEXT NULL | تاريخ انتهاء الوصول (من access_days) |
| `created_at` | TEXT | |

**قيد فريد:** (`student_id`, `course_id`) لمنع التكرار.
**فهارس:** `student_id`, `course_id`, `status`, `expires_at`.

---

## 11) `lesson_progress` — تقدّم الطالب

| العمود | النوع | ملاحظات |
|---|---|---|
| `id` | TEXT (PK) | |
| `student_id` | TEXT (FK→profiles) | |
| `lesson_id` | TEXT (FK→lessons) | |
| `course_id` | TEXT (FK→courses) | للتجميع السريع |
| `watched_seconds` | INTEGER | إجمالي الثواني المشاهدة |
| `last_position` | INTEGER | آخر نقطة توقّف (Resume) |
| `is_completed` | INTEGER (0/1) | |
| `highest_position_watched` | INTEGER | أعلى نقطة مشاهدة وصل إليها الطالب (لكشف القفز والتلاعب) |
| `completed_at` | TEXT NULL | |
| `updated_at` | TEXT | |

**قيد فريد:** (`student_id`, `lesson_id`).
**فهارس:** `student_id`, `course_id`, `is_completed`.

---

## 12) `questions` — أسئلة الطلاب

| العمود | النوع | ملاحظات |
|---|---|---|
| `id` | TEXT (PK) | |
| `student_id` | TEXT (FK→profiles) | |
| `lesson_id` | TEXT NULL (FK→lessons) | السؤال مرتبط بدرس (أو عام) |
| `course_id` | TEXT NULL (FK→courses) | |
| `body` | TEXT | نص السؤال |
| `image_r2_key` | TEXT NULL | صورة مرفقة (Phase 2) |
| `status` | TEXT | `open` / `answered` / `closed` / `hidden` |
| `is_pinned` | INTEGER (0/1) | تثبيت سؤال شائع |
| `upvotes` | INTEGER | عدد الإعجابات |
| `created_at` | TEXT | |
| `updated_at` | TEXT | |

**فهارس:** `lesson_id`, `student_id`, `status`.

---

## 13) `answers` — إجابات

| العمود | النوع | ملاحظات |
|---|---|---|
| `id` | TEXT (PK) | |
| `question_id` | TEXT (FK→questions) | |
| `author_id` | TEXT (FK→profiles) | المدرس/المساعد/أحيانًا طالب |
| `body` | TEXT | |
| `is_accepted` | INTEGER (0/1) | إجابة معتمدة |
| `created_at` | TEXT | |
| `updated_at` | TEXT | |

**فهارس:** `question_id`, `author_id`.

---

## 14) `reviews` — التقييمات

| العمود | النوع | ملاحظات |
|---|---|---|
| `id` | TEXT (PK) | |
| `student_id` | TEXT (FK→profiles) | |
| `target_type` | TEXT | `lesson` / `course` |
| `target_id` | TEXT | معرّف الدرس أو الكورس |
| `rating` | INTEGER | 1–5 |
| `comment` | TEXT NULL | |
| `status` | TEXT | `visible` / `hidden` |
| `created_at` | TEXT | |
| `updated_at` | TEXT | |

**قيد فريد:** (`student_id`, `target_type`, `target_id`).
**فهارس:** `target_type`+`target_id`, `rating`.

---

## 15) `devices` — أجهزة الطلاب (ربط الجهاز)

| العمود | النوع | ملاحظات |
|---|---|---|
| `id` | TEXT (PK) | |
| `student_id` | TEXT (FK→profiles) | |
| `device_id` | TEXT | بصمة الجهاز (مولّدة على الجهاز) |
| `platform` | TEXT | `android` / `ios` |
| `model` | TEXT NULL | موديل الجهاز |
| `push_token` | TEXT NULL | توكن FCM للإشعارات |
| `is_trusted` | INTEGER (0/1) | موثّق؟ |
| `is_rooted` | INTEGER (0/1) | نتيجة كشف Root/Jailbreak |
| `last_login_at` | TEXT | |
| `created_at` | TEXT | |

**قيد فريد:** (`student_id`, `device_id`).
**فهارس:** `student_id`, `device_id`, `push_token`.

---

## 16) `notifications` — الإشعارات

| العمود | النوع | ملاحظات |
|---|---|---|
| `id` | TEXT (PK) | |
| `recipient_id` | TEXT NULL (FK→profiles) | NULL = إشعار جماعي |
| `audience` | TEXT | `user` / `course` / `all` |
| `course_id` | TEXT NULL | لو موجّه لكورس |
| `type` | TEXT | `new_lesson` / `answer` / `announcement` / `system` |
| `title` | TEXT | |
| `body` | TEXT | |
| `data_json` | TEXT NULL | حمولة إضافية (deep link) |
| `is_read` | INTEGER (0/1) | |
| `sent_at` | TEXT | |
| `created_at` | TEXT | |

**فهارس:** `recipient_id`, `audience`, `is_read`.

---

## 17) `audit_logs` — سجلّ التدقيق

| العمود | النوع | ملاحظات |
|---|---|---|
| `id` | TEXT (PK) | |
| `actor_id` | TEXT NULL (FK→profiles) | من قام بالإجراء |
| `action` | TEXT | `code.generate` / `course.delete` / `student.block` ... |
| `target_type` | TEXT NULL | |
| `target_id` | TEXT NULL | |
| `ip` | TEXT NULL | |
| `user_agent` | TEXT NULL | |
| `meta_json` | TEXT NULL | تفاصيل إضافية |
| `created_at` | TEXT | |

**فهارس:** `actor_id`, `action`, `created_at`.

---

## 18) `financial_transactions` — التجديدات والتعاملات المالية

| العمود | النوع | ملاحظات |
|---|---|---|
| `id` | TEXT (PK) | معرّف المعاملة (UUID) |
| `student_id` | TEXT (FK→profiles) | الطالب صاحب المعاملة |
| `course_id` | TEXT NULL (FK→courses) | الكورس المرتبط بالعملية (إن وجد) |
| `amount` | INTEGER | القيمة المدفوعة بالقروش/السنتات |
| `transaction_type` | TEXT | نوع العملية: `code_redeem` (تفعيل كود) / `manual_admin` (يدوي من الإدارة) / `online_payment` (دفع إلكتروني) |
| `code_id` | TEXT NULL (FK→activation_codes) | كود التفعيل المرتبط بالعملية (إن وجد) |
| `note` | TEXT NULL | ملاحظات إضافية |
| `created_at` | TEXT | تاريخ وتوقيت المعاملة |

**فهارس:** `student_id`, `created_at`.

---

## 19) `lecture_playback_logs` — سجل تشغيل وإيقاف المحاضرات بالتفصيل

| العمود | النوع | ملاحظات |
|---|---|---|
| `id` | TEXT (PK) | معرّف السجل (UUID) |
| `student_id` | TEXT (FK→profiles) | الطالب |
| `lesson_id` | TEXT (FK→lessons) | الدرس (المحاضرة) |
| `action` | TEXT | الإجراء المتخذ: `open` (فتح المحاضرة/بدء تشغيل) / `close` (إغلاق المحاضرة/إيقاف مؤقت) |
| `position_seconds` | INTEGER | نقطة توقف الفيديو بالثواني عند حدوث الإجراء |
| `created_at` | TEXT | طابع زمني دقيق للحدث |

**فهارس:** `student_id`, `lesson_id`, `created_at`.

---

## 20) `quizzes` — الكويزات (الامتحانات القصيرة)

| العمود | النوع | ملاحظات |
|---|---|---|
| `id` | TEXT (PK) | معرّف الكويز (UUID) |
| `course_id` | TEXT (FK→courses) | الكورس التابع له |
| `lesson_id` | TEXT NULL (FK→lessons) | الدرس المرتبط به (إن وجد) |
| `title` | TEXT | عنوان الكويز |
| `max_score` | INTEGER | الدرجة النهائية للكويز |
| `is_published` | INTEGER (0/1) | حالة النشر |
| `sort_order` | INTEGER | ترتيب الكويز |
| `created_at` | TEXT | |
| `updated_at` | TEXT | |

**فهارس:** `course_id`, `lesson_id`.

---

## 21) `quiz_attempts` — درجات الطلاب في الكويزات

| العمود | النوع | ملاحظات |
|---|---|---|
| `id` | TEXT (PK) | معرّف المحاولة (UUID) |
| `student_id` | TEXT (FK→profiles) | الطالب |
| `quiz_id` | TEXT (FK→quizzes) | الكويز |
| `score` | REAL | الدرجة التي حصل عليها الطالب |
| `submitted_at` | TEXT | تاريخ تقديم الإجابة |
| `created_at` | TEXT | |

**قيد فريد:** (`student_id`, `quiz_id`) لمنع تقديم المحاولة لنفس الكويز أكثر من مرة.
**فهارس:** `student_id`, `quiz_id`.

---

## 22) `app_settings` — إعدادات عامة وهيكل البيانات (Settings Schema)

لتفادي الأخطاء أثناء إدخال الإعدادات بواسطة المدرس، يتم التحقق من القيم المدخلة في الـ Worker بناءً على الهيكل التالي للمفاتيح المعروفة:

| المفتاح (Key) | نوع القيمة (Value Type) | القيمة الافتراضية | الوصف |
|---|---|---|---|
| `max_concurrent_sessions` | Integer | `1` | أقصى عدد جلسات تشغيل متزامنة للطالب الواحد |
| `signed_url_ttl_seconds` | Integer | `120` | صلاحية روابط الفيديو الموقعة قبل انتهائها |
| `min_app_version` | String (SemVer) | `"1.0.0"` | أدنى إصدار مسموح للتطبيق للعمل على الهواتف |
| `allow_self_device_reset` | Integer (0/1) | `1` | السماح للطالب بتصفير أجهزته ذاتياً بدون تواصل مع الإدارة |
| `device_reset_cooldown_days`| Integer | `30` | مدة مهلة التصفير الذاتي بالأيام |
| `support_whatsapp` | String | `"+201000000000"` | رقم التواصل للدعم الفني بالواتساب |
| `terms_url` | String (URL) | `""` | رابط صفحة الشروط والأحكام |
| `privacy_url` | String (URL) | `""` | رابط صفحة سياسة الخصوصية للمتاجر |

---

## 23) `assistant_permissions` — صلاحيات المساعدين (RBAC)

| العمود | النوع | ملاحظات |
|---|---|---|
| `id` | TEXT (PK) | معرّف السجل (UUID) |
| `assistant_id` | TEXT (FK→profiles, UNIQUE) | معرّف المساعد المرتبط بملفه الشخصي |
| `can_reset_devices` | INTEGER (0/1) | صلاحية فك ارتباط أجهزة الطلاب |
| `can_grade_quizzes` | INTEGER (0/1) | صلاحية تصحيح الكويزات والامتحانات |
| `can_answer_questions` | INTEGER (0/1) | صلاحية إجابة أسئلة الطلاب |
| `can_manage_codes` | INTEGER (0/1) | صلاحية إدارة وتوليد أكواد التفعيل |
| `can_manage_courses` | INTEGER (0/1) | صلاحية إدارة الكورسات والدروس |
| `created_at` | TEXT | تاريخ إنشاء الصلاحية |
| `updated_at` | TEXT | تاريخ آخر تحديث |

**فهارس:** `assistant_id`.

---

## 24) `device_reset_requests` — طلبات فك ارتباط الأجهزة الذاتية

| العمود | النوع | ملاحظات |
|---|---|---|
| `id` | TEXT (PK) | معرّف الطلب (UUID) |
| `student_id` | TEXT (FK→profiles) | الطالب مقدم الطلب |
| `device_id` | TEXT | معرّف الجهاز المطلوب تسجيله |
| `platform` | TEXT | نظام تشغيل الجهاز (`android` / `ios`) |
| `model` | TEXT NULL | موديل الجهاز (مثل iPhone 13) |
| `reason` | TEXT | سبب طلب فك ارتباط الأجهزة السابقة |
| `proof_image_url` | TEXT NULL | رابط صورة الإثبات المرفوعة إلى R2 |
| `status` | TEXT | حالة الطلب (`pending` / `approved` / `rejected`) |
| `handled_by` | TEXT NULL (FK→profiles) | المسؤول/المساعد الذي قام بمعالجة الطلب |
| `rejection_reason` | TEXT NULL | سبب الرفض في حال رفض الطلب |
| `handled_at` | TEXT NULL | تاريخ ووقت معالجة الطلب |
| `created_at` | TEXT | تاريخ تقديم الطلب |
| `updated_at` | TEXT | تاريخ التحديث |

**فهارس:** `student_id`, `status`.

---

## 🔁 قواعد سلامة البيانات

- **أرشفة المحتوى (Soft Delete):** بدلاً من الحذف المتتالي والكامل للكورسات والدروس، يتم تغيير علم `is_archived = 1` لإخفائها من واجهة الطالب مع الاحتفاظ بسجلات تقدم الطلاب (`lesson_progress`) والاشتراكات (`enrollments`) وسجلات التدقيق (`audit_logs`) دون تلف البيانات.
- **صيانة قاعدة البيانات الدورية (VACUUM & ANALYZE):** نظراً لاعتماد SQLite، يتم تشغيل مهمة مجدولة أسبوعية (Weekly Cron Trigger) لضغط قاعدة البيانات D1 وإعادة تنظيم فهارس البحث والتصفح مجاناً بالكامل.
- **تتبع التقدم المخفف (Heartbeat Debounce):** لتجنب الكتابة المتكررة في قاعدة البيانات D1 عند استقبال نبضة قلب تقدم المشاهدة (كل 30 ثانية)، يقوم الـ API بتخزين التقدم في كاش مؤقت (KV) وتحديث قاعدة البيانات D1 مرة واحدة فقط كل 60 ثانية لكل طالب كآلية debounce.
- **تفعيل الكود الآمن:** تفعيل الأكواد يتم داخل معاملة حصرية (DB Transaction) للوقاية من تداخل الطلبات (Race conditions).
- **الامتثال للخصوصية:** يتم حجب بيانات الطالب بمجرد انتهاء وصوله أو حظره دون إتلاف سجل العمليات أمنياً.

---

التالي: [06 — مرجع الـ API](./06-api-reference.md)
