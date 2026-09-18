# 18 — دليل تصميم وتحسين الواجهات (Frontend Design & Modern Web APIs)

يستند هذا الدليل إلى أحدث معايير الويب الحديثة (Modern Web APIs) لتطوير وتحسين واجهة مستخدم **لوحة تحكم المدرس (Teacher Web Dashboard)**. يهدف الدليل إلى التخلي عن الأكواد البرمجية البرمجية الثقيلة (JS-heavy solutions) والاستفادة الكاملة من إمكانيات المتصفحات الأصلية لتحقيق أداء فائق ومظهر تفاعلي فخم (Premium UX) وسلس.

---

## 🎨 1. الألوان، السمات وسلاسة التصفح (Color Spaces & Theme Sync)

لإنشاء واجهة متطابقة ومتناغمة في الألوان بين الوضعين الداكن والفاتح، نعتمد على مساحات ألوان متطورة وميزات المتصفح الأصلية.

### أ. مساحة الألوان OKLCH
بدلاً من ألوان HSL التقليدية، نستخدم مساحة الألوان `oklch` في ملف Tailwind CSS لتحديد لوحة الألوان. ميزة `oklch` أنها توفر توزيع إضاءة متساوٍ ومتطابق بصرياً للعين البشرية عند الانتقال بين الدرجات اللونية المختلفة.

```css
/* src/app/globals.css */
@theme {
  --color-brand-primary: oklch(0.62 0.21 280); /* أزرق فائق النقاء */
  --color-brand-secondary: oklch(0.68 0.17 140); /* أخضر مريح */
  --color-bg-base: light-dark(oklch(0.98 0.01 280), oklch(0.12 0.02 280));
}
```

### ب. استخدام الميزة الأصلية `light-dark()`
لتسهيل كتابة شفرات التنسيق للوضعين الداكن والفاتح (Dark/Light Mode) بدون تكرار الفئات المخصصة، نستخدم الدالة الأصلية في CSS:

```css
.card {
  background-color: light-dark(#ffffff, #1e1e2e);
  color: light-dark(#111118, #f5f5f7);
  border: 1px solid light-dark(#e2e8f0, #2d2d3d);
}
```

### ج. تخصيص شريط التمرير (Scrollbars)
لمنع شريط التمرير الافتراضي للمتصفح من تشويه جمالية لوحة التحكم (خاصة بالوضع الداكن)، نستخدم الخصائص الحديثة للتحكم الفوري بالألوان دون الحاجة للمكتبات الخارجية:

```css
/* تطبيق تحسين شريط التمرير على الحاويات تلقائياً */
.scrollable-container {
  scrollbar-color: light-dark(oklch(0.8 0.01 280), oklch(0.3 0.02 280)) transparent;
  scrollbar-width: thin;
}
```

---

## 📝 2. النماذج وعناصر الإدخال الذكية (Smart Forms & Inputs)

شاشات تعديل الدروس وتوليد الأكواد تحتاج إلى تجربة مستخدم خالية من التعقيد والتنبيهات المزعجة المسبقة.

### أ. فحص الحقول بعد تفاعل المستخدم فقط (`:user-invalid`)
لتجنب إظهار علامات الخطأ باللون الأحمر فور تحميل الصفحة وقبل أن يبدأ المدرس بالكتابة، نستخدم فئة `:user-invalid` بدلاً من `:invalid` التقليدية:

```css
/* إظهار الخطأ فقط بعد أن يكتب المدرس ويغادر الحقل (Blur) */
.form-input:user-invalid {
  border-color: oklch(0.6 0.25 20); /* أحمر صريح */
  background-color: oklch(0.98 0.01 20);
}
```

### ب. التمدد التلقائي لحقول النصوص (`field-sizing: content`)
في شاشة إضافة الردود على أسئلة الطلاب أو شاشة وصف الدرس، نريد حقل نصوص يتمدد تلقائياً حسب حجم الكلام المكتوب دون ظهور أشرطة تمرير داخلية مزعجة أو استخدام لغة JavaScript للحساب:

```css
.dynamic-textarea {
  field-sizing: content;
  min-height: 80px;
  max-height: 400px;
  resize: none;
}
```

### ج. توحيد هوية عناصر الاختيار الأصلية (`accent-color`)
بدلاً من بناء عناصر Checkbox و Radio مخصصة ومعقدة برمجياً، نستخدم ميزة `accent-color` لصبغ العناصر الافتراضية بألوان الهوية بضغطة زر واحدة:

```css
input[type="checkbox"],
input[type="radio"] {
  accent-color: var(--color-brand-primary);
}
```

---

## 🪟 3. النوافذ المنبثقة وأوراق العرض الجانبية (Native Dialogs & Popovers)

شاشة الإشعارات السريعة وتأكيدات عمليات الحذف يجب أن تكون خفيفة جداً ومتوافقة مع قارئات الشاشة.

### أ. استخدام عنصر الحوار الأصلي `<dialog>`
بدلاً من حزم Modals الضخمة، نستخدم عنصر `<dialog>` الأصلي مع دعم الإغلاق بالضغط في الخارج تلقائياً (Light Dismiss) ومفتاح `Escape`:

```tsx
// مكون نافذة التأكيد المنبثقة
import { useRef } from 'react';

export function ConfirmDeleteDialog({ onDelete }) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  const openDialog = () => dialogRef.current?.showModal();
  const closeDialog = () => dialogRef.current?.close();

  return (
    <>
      <button onClick={openDialog} className="btn-danger">حذف الكود</button>
      
      <dialog 
        ref={dialogRef} 
        onClick={(e) => e.target === dialogRef.current && closeDialog()} // إغلاق عند الضغط بالخارج
        className="native-dialog p-6 rounded-lg shadow-2xl backdrop:backdrop-blur-md"
      >
        <h3 className="text-lg font-bold">هل أنت متأكد من الحذف؟</h3>
        <p className="mt-2 text-sm text-gray-500">لا يمكن التراجع عن هذا الإجراء.</p>
        <div className="flex gap-2 justify-end mt-4">
          <button onClick={closeDialog} className="btn-secondary">إلغاء</button>
          <button onClick={() => { onDelete(); closeDialog(); }} className="btn-confirm-danger">تأكيد الحذف</button>
        </div>
      </dialog>
    </>
  );
}
```

### ب. استخدام Popover API للإشعارات والتعليمات
لعرض قائمة الإشعارات المنسدلة من الجرس أو التلميحات (Tooltips) في شريط التنقل، نستخدم ميزة `popover` الأصلية التي ترفع المكون تلقائياً إلى الطبقة العليا للمتصفح (Top Layer) دون مشاكل `z-index` المزعجة:

```html
<!-- زر تفعيل جرس الإشعارات -->
<button popovertarget="notifications-menu" class="icon-button">
  🔔
</button>

<!-- قائمة الإشعارات المنبثقة -->
<div id="notifications-menu" popover class="notifications-panel p-4 rounded-md shadow-lg border">
  <h4 class="font-bold border-b pb-2">آخر التنبيهات</h4>
  <p class="text-sm mt-2">قام الطالب أحمد بتفعيل كورس النحو والصرف.</p>
</div>
```

---

## ⚡ 4. سلاسة الانتقالات وتحسين التحميل (Transitions & Performance Optimization)

### أ. ميزة الانتقالات البصرية للمتصفح (View Transitions API)
عند سحب وإعادة ترتيب الدروس والوحدات في صفحة محتوى الكورس (`/courses/{id}`)، نستخدم ميزة `document.startViewTransition` للحصول على حركة انسيابية ناعمة جداً للعناصر أثناء انتقالها لمكانها الجديد تلقائياً:

```javascript
// دالة تحديث ترتيب الدروس محلياً مع الانتقال البصري
function handleReorder(newOrderList) {
  if (!document.startViewTransition) {
    setLessons(newOrderList); // تحديث فوري بدون تأثيرات إذا كان المتصفح لا يدعمها
    return;
  }

  document.startViewTransition(() => {
    setLessons(newOrderList); // المتصفح سيقوم بعمل أنيميشن انسيابي للعناصر التي تغير مكانها
  });
}
```

### ب. قواعد التنبؤ بالزيارة (Speculation Rules API)
لجعل التنقل بين صفحات الطلاب والتقارير فورياً وبسرعة فائقة جداً (Instant Page Load)، نقوم ببرمجة قواعد تجعل المتصفح يقوم بجلب مسبق كامل (Prerender) للصفحة التالية في الخلفية بمجرد أن يحرك المدرس مؤشر الفأرة فوق الرابط:

```html
<!-- إضافة النص البرمجي في الهيد الرئيسي للوحة التحكم -->
<script type="speculationrules">
{
  "prerender": [
    {
      "source": "document",
      "where": {
        "and": [
          { "href_matches": "/students/*" },
          { "selector_matches": "a" }
        ]
      },
      "eagerness": "moderate"
    }
  ]
}
</script>
```

### ج. تأثيرات الظهور التدريجي الفخمة (`@starting-style` & CSS Easing)
لتسهيل إنشاء تأثيرات فتح المودالز والنوافذ الجانبية تدريجياً وبنعومة تامة (Fade and Scale In) دون إرهاق المتصفح بحسابات JS:

```css
/* أنيميشن دخول وخروج النوافذ */
dialog {
  opacity: 0;
  transform: scale(0.95);
  transition: opacity 0.3s ease-out, transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1), display 0.3s allow-discrete;
}

/* الحالة التي يبدأ منها الأنيميشن فوراً عند الفتح */
@starting-style {
  dialog[open] {
    opacity: 0;
    transform: scale(0.95);
  }
}

/* الحالة النهائية بعد الفتح */
dialog[open] {
  opacity: 1;
  transform: scale(1);
}
```

---

## 📋 5. خطة التحقق والاختبار (Verification Plan)

للتأكد من عمل هذه الميزات بكفاءة وعدم حدوث مشاكل توافقية مع الأنظمة الأقدم:

1. **التحقق التلقائي (Lighthouse Audits):**
   - قياس سرعة الاستجابة (INP) ومؤشر LCP للتأكد من بقائها في النطاق الممتاز الأخضر بعد تقليل استخدام مكتبات JavaScript وتطبيق الـ Speculation Rules.
2. **الاختبار اليدوي على متصفحات متعددة (Cross-Browser Testing):**
   - اختبار السحب والإفلات في الكورسات على Chrome و Safari لمراقبة عمل الـ View Transitions.
   - التحقق من النماذج والتحذيرات باستخدام أجهزة لوحية (Tablets) بنظام iOS و Android للتأكد من توافقية الحقول الذكية.
   - تشغيل محاكاة وضع عالي التباين (High Contrast Mode) للتأكد من وضوح شريط التمرير المخصص.
