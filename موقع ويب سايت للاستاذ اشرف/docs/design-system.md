# نظام التصميم الموحد — Unified Design System

هذا المستند هو **المرجع الوحيد** للهوية البصرية عبر المنصات الثلاث:
`student-web` (React) · `dashboard` (Next.js) · `student_app` (Flutter)

أي تعديل مستقبلي على الهوية يبدأ من هنا ثم يُطبق على ملفات التوكنز الثلاثة:

| المنصة | ملف التوكنز |
|---|---|
| ويب الطالب | `student-web/src/index.css` (`:root` + `html.dark`) |
| لوحة المدرس | `dashboard/src/app/globals.css` + `dashboard/tailwind.config.js` |
| تطبيق الطالب | `student_app/lib/config/theme.dart` (`AppTheme`) |

---

## 1. الألوان (Color Palette)

قاعدة الكتابة في CSS: قنوات RGB مفصولة بمسافات `--primary: 16 185 129;` وتُستهلك `rgb(var(--primary) / <alpha>)`.

### الأساسية — Emerald (زمردي)
| Token | Light | Dark | Hex مرجعي |
|---|---|---|---|
| `primary` | `16 185 129` | `52 211 153` | `#10b981` / `#34d399` |
| `primary-dark` / `primary-container` | `5 150 105` | `6 78 59` | `#059669` / `#064e3b` |
| `on-primary` | `255 255 255` | `2 44 34` | أبيض / `#022c22` |

### الثانوية — Amber (ذهبي/عنبري)
| Token | Light | Dark | Hex مرجعي |
|---|---|---|---|
| `accent` / `secondary` | `217 119 6` | `245 158 11` | `#d97706` / `#f59e0b` |
| `accent-container` | `254 243 199` | `120 53 15` | `#fef3c7` / `#78350f` |

### المحايد — Slate
| Token | Light | Dark |
|---|---|---|
| `background` | `248 250 252` (`#f8fafc`) | `11 13 23` (`#0b0d17`) |
| `surface` | `255 255 255` | `17 20 32` (`#111420`) |
| `surface-container-low` | `248 250 252` | `24 28 42` |
| `surface-container` | `241 245 249` | `30 35 52` |
| `surface-container-high` | `226 232 240` | `39 45 65` |
| `on-surface` | `15 23 42` (`#0f172a`) | `241 245 249` (`#f1f5f9`) |
| `on-surface-variant` | `100 116 139` (`#64748b`) | `148 163 184` (`#94a3b8`) |
| `outline` | `203 213 225` | `51 65 85` |
| `outline-variant` | `226 232 240` | `39 45 65` |

### الحالات — Semantic
| Token | Light | Dark |
|---|---|---|
| `success` | `22 163 74` (`#16a34a`) | `74 222 128` (`#4ade80`) |
| `success-container` | `220 252 231` | `20 60 40` |
| `warning` | `217 119 6` (`#d97706`) | `251 191 36` (`#fbbf24`) |
| `warning-container` | `254 243 199` | `70 45 10` |
| `error` | `220 38 38` (`#dc2626`) | `248 113 113` (`#f87171`) |
| `error-container` | `254 226 226` | `70 20 20` |

قواعد:
- **ممنوع** كتابة hex مباشر في المكونات — دائماً عبر التوكن.
- `success` مميز عن `primary` عمداً (أخضر عشبي مقابل زمردي) لتمييز حالات النجاح عن الهوية.

## 2. الخطوط (Typography)

| الاستخدام | الخط | ملاحظات |
|---|---|---|
| كل النصوص العربية (UI) | **Cairo** | الوزن 400/600/700 |
| العناوين الاستعراضية (ويب الطالب فقط: Landing/Hero) | **Amiri** | طابع تعليمي مميز |
| النص اللاتيني/الأرقام الطويلة | **Inter** | fallback |
| الأيقونات | Material Symbols Outlined (ويب/لوحة) · Material Icons (Flutter) | |

المقاسات المرجعية: body 14–15px · titles 18/20/24 · hero بـ `clamp()`.

## 3. الأشكال (Shape & Elevation)

| Token | القيمة |
|---|---|
| `radius-sm` | 8px |
| `radius-md` | 12px |
| `radius-lg` | 16px |
| `radius-xl` | 20–24px (بطاقات بارزة/BottomSheet) |
| `radius-full` | 9999px (chips/avatars) |
| الظلال | ناعمة جداً في الفاتح (`0 4px 12px rgb(0 0 0 / 0.04)`)، **معدومة في الداكن** (الفصل بالحدود `outline` بدلاً منها) |

## 4. الوضع الليلي (Dark Mode)

- مفعّل في **المنصات الثلاث**.
- أول تحميل: يتبع تفضيل النظام (`prefers-color-scheme`) ما لم يوجد اختيار محفوظ.
- الاختيار يُحفظ: `localStorage.theme` (ويب/لوحة) · التخزين المحلي الحالي (Flutter `ThemeBloc`).
- التبديل: class `dark` على `<html>` (ويب/لوحة) · `ThemeMode` (Flutter).

## 5. الحركة (Motion)

- Easing موحد: `cubic-bezier(0.4, 0, 0.2, 1)` · المدة الافتراضية 200–300ms.
- **إلزامي** احترام `prefers-reduced-motion: reduce` لكل أنيميشن لانهائي (توهج/عوم/جسيمات).

## 6. RTL

- `dir="rtl"` على مستوى الوثيقة + `Directionality.rtl` في Flutter.
- يفضَّل استخدام الخصائص المنطقية (`margin-inline-start`...) في أي كود جديد.
