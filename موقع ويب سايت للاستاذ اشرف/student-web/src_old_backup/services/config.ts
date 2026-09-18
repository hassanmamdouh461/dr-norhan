/**
 * عنوان الـ API يُقرأ من متغير البيئة VITE_API_URL ويُضبط بعد النشر.
 * عند تركه فارغاً تُصبح كل الطلبات نسبية على نفس النطاق (مثل `/auth/me`)،
 * وهو الوضع الصحيح عندما تُخدَم الواجهة والـ Worker من نفس النطاق.
 *
 * ⚠️ لا تُثبّت أي نطاق هنا — القيمة تُحقن من بيئة النشر فقط.
 */
export const API_BASE_URL = (import.meta.env.VITE_API_URL || '').replace(/\/+$/, '');

/** يبني العنوان الكامل لمسار API، ويدعم الروابط المطلقة كما هي. */
export function apiUrl(path: string): string {
  if (/^https?:\/\//i.test(path)) return path;
  return `${API_BASE_URL}${path}`;
}
