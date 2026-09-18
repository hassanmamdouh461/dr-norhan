# الدكتور في الفيزياء - Student App

تطبيق الهاتف المحمول الخاص بالطلاب لمنصة الدكتور في الفيزياء (مبني باستخدام Flutter).

## إعداد بيئة التشغيل وتوقيع التطبيق (Signing Configuration)

يستخدم التطبيق ملف `key.properties` محلياً لتوقيع نسخة الإنتاج (Release APK). لا تقم أبداً برفع هذا الملف أو ملفات الـ keystore (`.jks`) إلى مستودع الكود (Git).

### 1. توليد مفتاح التوقيع (Keystore)

لتوليد ملف keystore جديد لتوقيع نسخة الأندرويد، نفذ الأمر التالي في سطر الأوامر:

```bash
keytool -genkey -v -keystore android/app/release.jks -keyalg RSA -keysize 2048 -validity 10000 -alias key
```

### 2. إعداد ملف `key.properties`

قم بنسخ الملف المرجعي `key.properties.example` المتواجد في `student_app/android/` وتسميته بـ `key.properties` في نفس المجلد، ثم ضَع فيه البيانات الخاصة بك:

```properties
storePassword=كلمة_مرور_المستودع
keyPassword=كلمة_مرور_المفتاح
keyAlias=key
storeFile=app/release.jks
```

### 3. بناء نسخة الإنتاج مع التشفير والتعمية (Obfuscation)

لإنشاء نسخة APK محمية ومشفّرة ومحسّنة للإنتاج، قم بتشغيل الأمر التالي:

```bash
flutter build apk --obfuscate --split-debug-info=build/symbols
```

