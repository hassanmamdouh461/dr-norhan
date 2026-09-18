# توثيق بيانات الربط والباكند والمفاتيح السرية (Backend Credentials & Platform Isolation)

يوثق هذا الملف البيانات التقنية، قواعد البيانات، حاويات الملفات R2، ومفاتيح الربط والمصادقة الخاصة بكل من منصة **الدكتور في الفيزياء (Dr. Physics)** ومنصة **الهضبة في الكيمياء (Al-Hadaba Chemistry)** لضمان استقلالية كاملة للمنصتين وعملهما بشكل آمن ومنعزل تماماً.

---

## 1. جدول مقارنة الموارد والروابط الأساسية (Resources & Domains)

| البند / المورد | منصة الدكتور في الفيزياء (Dr. Physics) | منصة الهضبة في الكيمياء (Al-Hadaba Chemistry) |
| :--- | :--- | :--- |
| **رابط لوحة التحكم** | [dr-physics.synapticstudio.tech](https://dr-physics.synapticstudio.tech) | [alhadaba-chemistry.synapticstudio.tech](https://alhadaba-chemistry.synapticstudio.tech) |
| **رابط الباكند (API)** | `api.dr-physics.synapticstudio.tech` | `api.alhadaba-chemistry.synapticstudio.tech` |
| **معرف منصة الباكند** | `dr-physics` | `alhadaba-chemistry` |
| **قاعدة البيانات (D1)** | `dr_physics_prod_db` | `alhadaba_chemistry_prod_db` |
| **معرف D1 ID** | `da2267a1-e59b-4014-b492-86001d96aec0` | `dbcc7450-bd45-40fe-bc84-e91f98727e90` |
| **حاوية الملفات (R2)** | `dr-physics-files` | `alhadaba-chemistry-files` |
| **مساحة تخزين الكاش (KV)**| `cd6c34d88ff24c4daa955bbe8fd7070d` | `43603d16739b409da7134b0c649b1058` |
| **مشروع Supabase (Auth)**| `https://oaeivekclvxmxuwrvqrj.supabase.co` | `https://czivfxjhvepvpzrdyrli.supabase.co` |

---

## 2. متغيرات البيئة والمفاتيح السرية للباكند (Env & Secrets)

تنقسم إعدادات خوادم Cloudflare Workers (الباكند) إلى نوعين:
1. **متغيرات بيئة عامة (Public Vars):** تُعرَّف مباشرة في ملف `wrangler.toml` تحت قسم `[vars]`.
2. **متغيرات سرية (Secrets):** تُرفع بشكل آمن لخوادم Cloudflare ولا يتم تضمينها في الكود البرمجي.

### أ. المتغيرات العامة في `wrangler.toml`

تأكد من مطابقة هذه القيم في ملف `wrangler.toml` الخاص بكل منصة:

#### لوحدة تحكم الفيزياء (`dr-physics-api`):
```toml
[vars]
SUPABASE_URL = "https://oaeivekclvxmxuwrvqrj.supabase.co"
JWT_AUDIENCE = "authenticated"
ENVIRONMENT = "production"
PLATFORM_KEY = "dr-physics"
R2_BUCKET_NAME = "dr-physics-files"
CF_ACCOUNT_ID = "780ddc00154813b98d142686dc31ecde"
CORS_ORIGIN = "https://alhadaba-chemistry.synapticstudio.tech, https://alhadaba-chemistry-student.synapticstudio.tech, https://dr-physics.synapticstudio.tech, https://dr-physics.pages.dev, http://localhost:3000, http://localhost:5173"
```

#### لوحدة تحكم الكيمياء (`alhadaba-chemistry-api`):
```toml
[vars]
SUPABASE_URL = "https://czivfxjhvepvpzrdyrli.supabase.co"
JWT_AUDIENCE = "authenticated"
ENVIRONMENT = "production"
PLATFORM_KEY = "alhadaba-chemistry"
R2_BUCKET_NAME = "alhadaba-chemistry-files"
CF_ACCOUNT_ID = "780ddc00154813b98d142686dc31ecde"
CORS_ORIGIN = "https://alhadaba-chemistry.synapticstudio.tech, https://alhadaba-chemistry.pages.dev, http://localhost:3000, http://localhost:5173"
```

---

### ب. المفاتيح السرية (Cloudflare Secrets) وكيفية ضبطها

يجب تعيين المفاتيح التالية لكل منصة بشكل منفصل لضمان عمل الرفع والتشفير والمصادقة بشكل صحيح.

#### قائمة المفاتيح المطلوبة وتفاصيلها:

1. **`SUPABASE_JWT_SECRET`**: مفتاح تشفير الـ JWT الخاص بمشروع Supabase للتحقق من هوية المستخدمين المسجلين.
2. **`API_SIGNING_SECRET`**: مفتاح سري لتوقيع الطلبات المرسلة من الفرونت اند للباكند لمنع التلاعب بها.
3. **`R2_ACCESS_KEY_ID`**: معرف الوصول الخاص بالـ S3 API الخاص بـ Cloudflare R2 لإنشاء روابط الرفع المؤقتة.
4. **`R2_SECRET_ACCESS_KEY`**: مفتاح المرور الخاص بالـ S3 API الخاص بـ Cloudflare R2 لإنشاء روابط الرفع المؤقتة.
5. **`BUNNY_API_KEY`**: مفتاح الوصول لمكتبة Bunny Stream لإنشاء الفيديوهات وتوقيع رفع TUS قبل نقل الشرائح إلى R2.
6. **`FIREBASE_SERVICE_ACCOUNT_JSON`**: ملف الخدمة الخاص بـ Firebase بصيغة JSON لإرسال الإشعارات الفورية للطلاب (FCM).

---

### ج. أوامر تعيين المفاتيح عبر منفذ الأوامر (Wrangler CLI commands)

لتحديث أو وضع هذه المفاتيح يدوياً، قم بفتح التيرمنال داخل مجلد الـ `backend` الخاص بالمنصة المستهدفة وتشغيل الأوامر التالية:

#### 1. لمنصة الهضبة في الكيمياء (`alhadaba-chemistry-api`):
```bash
npx wrangler secret put SUPABASE_JWT_SECRET --name alhadaba-chemistry-api
npx wrangler secret put API_SIGNING_SECRET --name alhadaba-chemistry-api
npx wrangler secret put R2_ACCESS_KEY_ID --name alhadaba-chemistry-api
npx wrangler secret put R2_SECRET_ACCESS_KEY --name alhadaba-chemistry-api
npx wrangler secret put BUNNY_API_KEY --name alhadaba-chemistry-api
npx wrangler secret put FIREBASE_SERVICE_ACCOUNT_JSON --name alhadaba-chemistry-api
```

#### 2. لمنصة الدكتور في الفيزياء (`dr-physics-api`):
```bash
npx wrangler secret put SUPABASE_JWT_SECRET --name dr-physics-api
npx wrangler secret put API_SIGNING_SECRET --name dr-physics-api
npx wrangler secret put R2_ACCESS_KEY_ID --name dr-physics-api
npx wrangler secret put R2_SECRET_ACCESS_KEY --name dr-physics-api
npx wrangler secret put BUNNY_API_KEY --name dr-physics-api
npx wrangler secret put FIREBASE_SERVICE_ACCOUNT_JSON --name dr-physics-api
```

---

## 3. التحقق والمطابقة التقنية

> [!WARNING]
> إذا واجهت خطأ **500 Internal Server Error** أثناء رفع ملفات الكورس أو فيديوهات المحاضرات، يرجى التأكد من:
> 1. أن معرف الحساب `CF_ACCOUNT_ID` تم تعيينه في ملف `wrangler.toml` بشكل صحيح.
> 2. أن مفاتيح الـ R2 (`R2_ACCESS_KEY_ID` و `R2_SECRET_ACCESS_KEY`) تم إنشاؤها من إعدادات Cloudflare R2 وإضافتها كأسرار (Secrets) للمشروع المختار.
