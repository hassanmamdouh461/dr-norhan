# 🤖 تعليمات تنفيذ الهوية البصرية ونظام UI/UX لنماذج الذكاء الاصطناعي
# AI Coding Agent Implementation Guide — منصة فُصْحَى (الأستاذ أشرف سليم)

> **تنبيه صارم لأي نموذج ذكاء اصطناعي (AI Agent) يعمل في هذا المجلد:**  
> هذا الملف يحتوي على التوجيهات البرمجية والمعمارية الإلزامية التي **يجب** اتباعها حرفياً عند توليد أو تعديل كود الواجهات (Flutter / React / Next.js / Vue / HTML). ممنوع منعاً باتاً استخدام ألوان عشوائية أو قيَم مجهولة المصدر (No hardcoded arbitrary hex codes).

---

## 1. مرجع الملفات داخل هذا الجذر (`C:\Users\kayf\Desktop\mr ashraf final\fusha\`)

| الملف | الوظيفة وكيفية استخدامه |
|---|---|
| `IDENTITY_AND_DESIGN_SYSTEM.md` | **الدليل المعماري الشامل** (الرؤية، سلم الخطوط، مصفوفة الحالات الـ 8، علم النفس الإدراكي). |
| `DESIGN_TOKENS.json` | **قاموس التوكنات البرمجي (W3C Standard)** — اقرأه مباشرة لاستخراج قيم الألوان والمسافات. |
| `theme_tokens.dart` | جاهز للاستيراد فوراً في مشاريع **Flutter** (`FushaColors`, `FushaTypography`, `FushaTheme`). |
| `tailwind_brand_preset.js` | جاهز للدمج فوراً في ملف `tailwind.config.js` لمشاريع **Next.js / React / Tailwind**. |
| `assets/brand/fosha_logo.png` | **شعار فصحى الرسمي الأصلي** (خط كوفي هندسي متناسق). |
| `assets/brand/banner_phone.png`| صورة العرض الترويجي والتطبيق. |

---

## 2. القواعد الذهبية الإلزامية للنموذج (Mandatory Agent Rules)

### القاعدة 1: الاتجاه الطباعي العربي أولاً (Strict RTL First)
- التطبيق عربي بالكامل، يجب تفعيل `Directionality(textDirection: TextDirection.rtl)` في Flutter، و `<html lang="ar" dir="rtl">` في الويب.
- جميع الهوامش الأفقية يجب أن تستخدم الخصائص المنطقية:
  - في Tailwind: استخدم `ms-*` (Margin Start) و `me-*` (Margin End) و `ps-*` و `pe-*` بدلاً من `ml/mr/pl/pr`.
  - في Flutter: استخدم `EdgeInsetsDirectional.only(start: 16, end: 16)`.

### القاعدة 2: جدول مطابقة الألوان (Token Enforcement Table)
ممنوع كتابة أي لون عشوائي. التزم بالمطابقة التالية:

```
+---------------------------+-----------------------+--------------------------+
| الاستخدام في الواجهة      | الرمز والاسم          | القيمة اللونية (HEX)     |
+---------------------------+-----------------------+--------------------------+
| الزر الرئيسي / الهيدر     | fusha-teal-800        | #163134                  |
| لون العناوين والتركيز     | fusha-teal-800        | #163134                  |
| لون الأيقونات وحبر المادة | fusha-teal-500        | #37695C                  |
| بطاقات الشرح والتقدم      | fusha-sage-500        | #62856A                  |
| زر التشغيل والإنجازات     | fusha-gold-500 (Hero) | #E8B54A                  |
| نقطة الشعار والإطارات     | fusha-sand-300        | #B7B19B                  |
| أرضية الشاشة الفاتحة      | fusha-canvas-light    | #F8F9F7                  |
| سطح البطاقات الفاتحة      | surface-white         | #FFFFFF                  |
+---------------------------+-----------------------+--------------------------+
```

### القاعدة 3: خطوط الكتابة (Typography Rules)
- الخط الأساسي: `'Avenir Arabic'` أو بديله `'Cairo'` بحجم مناسب.
- خط الشعر والنصوص البلاغية: `'Amiri'` مع ارتفاع سطر رحب (`line-height: 1.8` إلى `2.0`).
- لا تقلل حجم أي نص تفاعلي أو سؤال عن `14px` على شاشات الموبايل، و`16px` لنصوص الأسئلة والخيارات.

### القاعدة 4: الأبعاد والشبكة (Layout & 8pt Grid Math)
- كل أبعاد المسافات تكون من مضاعفات الـ **8pt** (`8`, `16`, `24`, `32`, `48`).
- جميع الأزرار وحقول الإدخال ذات ارتفاع قياسي لا يقل عن **48px** إلى **52px** لضمان سهولة النقر بالإبهام (Fitts’s Law).
- استدارة الحواف للبطاقات الرئيسية: **20px** (`rounded-[20px]` أو `BorderRadius.circular(20)`).

---

## 3. مواصفات الأكواد للمكونات الأساسية (Code Blueprint Snippets)

### 3.1 بطاقة خيار سؤال الامتحان (Quiz Option Component)
يجب أن تدعم البطاقة حالاتها بدقة (عادية، محددة، صحيحة بعد الإرسال، خاطئة):

#### [Flutter Implementation Example]:
```dart
Widget buildQuizOption({
  required String text,
  required String letter, // "أ", "ب", "ج", "د"
  required bool isSelected,
  required bool isAnswered,
  required bool isCorrect,
  required VoidCallback onTap,
}) {
  Color borderColor = const Color(0xFFE2E6E3);
  Color bgColor = Colors.white;
  Color textColor = const Color(0xFF163134);

  if (isAnswered) {
    if (isCorrect) {
      borderColor = const Color(0xFF1E6B37);
      bgColor = const Color(0xFFEAF6EE);
    } else if (isSelected && !isCorrect) {
      borderColor = const Color(0xFFA82315);
      bgColor = const Color(0xFFFDF0EE);
    }
  } else if (isSelected) {
    borderColor = const Color(0xFF163134);
    bgColor = const Color(0xFFF0F4F2);
  }

  return InkWell(
    onTap: isAnswered ? null : onTap,
    borderRadius: BorderRadius.circular(16),
    child: AnimatedContainer(
      duration: const Duration(milliseconds: 200),
      curve: Curves.easeOutCubic,
      padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 16),
      decoration: BoxDecoration(
        color: bgColor,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: borderColor, width: isSelected ? 2 : 1.5),
        boxShadow: [
          BoxShadow(
            color: const Color(0xFF163134).withOpacity(0.04),
            blurRadius: 8,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: Row(
        children: [
          Container(
            width: 36,
            height: 36,
            alignment: Alignment.center,
            decoration: BoxDecoration(
              color: isSelected ? const Color(0xFF163134) : const Color(0xFFF4F6F5),
              borderRadius: BorderRadius.circular(8),
            ),
            child: Text(
              letter,
              style: TextStyle(
                fontFamily: 'Cairo',
                fontWeight: FontWeight.bold,
                color: isSelected ? Colors.white : const Color(0xFF163134),
              ),
            ),
          ),
          const SizedBox(width: 16),
          Expanded(
            child: Text(
              text,
              style: TextStyle(
                fontFamily: 'Cairo',
                fontSize: 16,
                fontWeight: FontWeight.w600,
                color: textColor,
              ),
            ),
          ),
        ],
      ),
    ),
  );
}
```

#### [Tailwind / React Implementation Example]:
```tsx
interface QuizOptionProps {
  letter: string;
  text: string;
  selected: boolean;
  isAnswered: boolean;
  isCorrect?: boolean;
  onClick: () => void;
}

export function QuizOption({ letter, text, selected, isAnswered, isCorrect, onClick }: QuizOptionProps) {
  let stateClasses = "border-[#E2E6E3] bg-white hover:border-[#62856A] hover:bg-[#F8F9F7]";
  
  if (isAnswered) {
    if (isCorrect) stateClasses = "border-[#1E6B37] bg-[#EAF6EE] text-[#1E6B37]";
    else if (selected) stateClasses = "border-[#A82315] bg-[#FDF0EE] text-[#A82315]";
  } else if (selected) {
    stateClasses = "border-[#163134] bg-[#F0F4F2] ring-2 ring-[#163134]/10";
  }

  return (
    <button
      onClick={onClick}
      disabled={isAnswered}
      className={`w-full flex items-center gap-4 p-4 rounded-[16px] border-2 transition-all duration-200 text-right ${stateClasses}`}
    >
      <span className={`w-9 h-9 flex items-center justify-center rounded-lg font-bold text-sm ${
        selected ? 'bg-[#163134] text-white' : 'bg-[#EFF2EF] text-[#163134]'
      }`}>
        {letter}
      </span>
      <span className="flex-1 font-semibold text-[16px] text-[#163134] leading-relaxed">
        {text}
      </span>
    </button>
  );
}
```

---

### 3.2 بنر تشغيل المحاضرة الذكي (Smart Hero Lecture Card)
يحتوي على تدرج فاخر يجمع بين البترولي والزمردي مع زر التشغيل الذهبي:
- الخلفية: `bg-gradient-to-l from-[#163134] to-[#2B574F]`
- شارة الحالة: خلفية `#E8B54A` ونص داكن `#163134` بخط عريض (مثال: `محاضرة الأسبوع`).
- زر الأكشن: خلفية `#E8B54A` بتأثير ضوء ذهبي خفيف وأيقونة تشغيل دائرية.

---

## 4. قائمة التحقق قبل اعتماد أي كود (Agent Quality Checklist)

قبل إنهاء كتابة أي شاشة، تأكد من استيفاء الشروط الآتية:
- [ ] هل اتجاه الشاشة RTL بشكل سليم وجميع الحقول مرتبة من اليمين إلى اليسار؟
- [ ] هل تم استخدام درجات الألوان الرسمية (`#163134`, `#37695C`, `#E8B54A`, `#B7B19B`) وتجنب الألوان العشوائية؟
- [ ] هل كل عنصر قابل للنقر يمتلك حجم لمسي لا يقل عن `48x48 dp`؟
- [ ] هل تمت إضافة حالات التحميل (Skeleton/Loader) بنمط وميض أنيق مستوحى من لون الشعار؟
- [ ] هل نصوص الشواهد الشعرية تظهر بوزن واضح وهامش سطر مريح للقراءة؟
