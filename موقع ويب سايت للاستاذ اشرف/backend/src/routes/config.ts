import { Hono } from 'hono';
import type { HonoBindings } from '../types';

const config = new Hono<HonoBindings>();

/**
 * إعدادات الواجهة العامة — الوثيقة 23 §2.
 * ترتيب التبويبات وشريط الأخبار يأتيان من الباكند ولا تُثبَّت في الواجهة.
 */
export const TABS_CONFIG = {
  tabs: [
    { key: 'home', label: 'الرئيسية', order: 0 },
    { key: 'profile', label: 'الملف الشخصي', order: 1 },
    { key: 'exams', label: 'الامتحانات', order: 2 },
    { key: 'conversations', label: 'المحادثات', order: 3 },
    { key: 'challenge', label: 'التحدي', order: 4 },
    { key: 'mistakes', label: 'الأخطاء', order: 5 },
    { key: 'common_mistakes', label: 'الأخطاء الشائعة', order: 6 },
  ],
  /** شريط الأخبار يظهر أعلى كل تبويب، ٧ ثوانٍ للشريحة، مع نقاط. */
  news_slider: {
    position: 'top' as const,
    interval_seconds: 7,
    show_dots: true,
  },
  /** العملة موحّدة على المنصة (الوثيقة 23 §4.1). */
  currency: 'جنيه',
  /** أرقام عربية-هندية في العرض حيث وردت. */
  use_arabic_digits: true,
} as const;

// ── GET /tabs-config — إعدادات التبويبات والشريط ──
config.get('/tabs-config', async (c) => {
  return c.json({
    ...TABS_CONFIG,
    tabs: [...TABS_CONFIG.tabs].sort((a, b) => a.order - b.order),
  });
});

export default config;
