/**
 * عنوان الـ API يُقرأ من NEXT_PUBLIC_API_URL ويُضبط بعد النشر.
 * عند تركه فارغاً تُصبح الطلبات نسبية على نفس النطاق (مثل `/auth/me`).
 *
 * ⚠️ لا تُثبّت أي نطاق هنا — القيمة تُحقن من بيئة النشر فقط.
 */
export const API_BASE = (process.env.NEXT_PUBLIC_API_URL || 'https://api.fusha.site').replace(/\/+$/, '');
