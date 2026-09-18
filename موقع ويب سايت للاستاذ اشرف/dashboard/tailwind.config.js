/** @type {import('tailwindcss').Config} */

// ── The OFFICIAL preset, copied verbatim from the client's brand package. ──
// NEVER hand-edit brand/tailwind_brand_preset.js. Anything extra goes here.
const fushaBrandPreset = require('../brand/tailwind_brand_preset.js');

// Fusha primitives, READ from the preset (never re-declared here).
const F = fushaBrandPreset.theme.extend.colors.fusha;

// Semantic token → Tailwind colour with alpha support.
// e.g. t('brand-primary') → rgb(var(--brand-primary-rgb) / <alpha-value>)
const t = (name) => `rgb(var(--${name}-rgb) / <alpha-value>)`;

// Legacy M3 bridge variable. These are ALREADY space-separated triplets
// (see brand/fusha-tokens.css "LEGACY BRIDGE") so there is no -rgb suffix.
const L = (name) => `rgb(var(--${name}) / <alpha-value>)`;

// ── Legacy M3 colour aliases ───────────────────────────────────────────────
// Existing pages use bg-primary / text-on-primary / bg-surface-container-high /
// text-on-surface-variant / border-outline-variant … They must keep resolving to
// something valid. DO NOT write new code with these names.
const legacy = {
  primary: L('primary'), 'on-primary': L('on-primary'),
  'primary-container': L('primary-container'), 'on-primary-container': L('on-primary-container'),
  secondary: L('secondary'), 'on-secondary': L('on-secondary'),
  'secondary-container': L('secondary-container'), 'on-secondary-container': L('on-secondary-container'),
  tertiary: L('tertiary'), 'on-tertiary': L('on-tertiary'),
  'tertiary-container': L('tertiary-container'), 'on-tertiary-container': L('on-tertiary-container'),
  accent: L('accent'), 'on-accent': L('on-accent'),
  'accent-container': L('accent-container'), 'on-accent-container': L('on-accent-container'),
  error: L('error'), 'on-error': L('on-error'),
  'error-container': L('error-container'), 'on-error-container': L('on-error-container'),
  success: L('success'), 'on-success': L('on-success'),
  'success-container': L('success-container'), 'on-success-container': L('on-success-container'),
  warning: L('warning'), 'on-warning': L('on-warning'),
  'warning-container': L('warning-container'), 'on-warning-container': L('on-warning-container'),
  background: L('background'), 'on-background': L('on-background'),
  surface: L('surface'), 'surface-bright': L('surface-bright'), 'surface-dim': L('surface-dim'),
  'surface-container-lowest': L('surface-container-lowest'),
  'surface-container-low': L('surface-container-low'),
  'surface-container': L('surface-container'),
  'surface-container-high': L('surface-container-high'),
  'surface-container-highest': L('surface-container-highest'),
  'surface-variant': L('surface-variant'),
  'on-surface': L('on-surface'), 'on-surface-variant': L('on-surface-variant'),
  outline: L('outline'), 'outline-variant': L('outline-variant'),
  'inverse-surface': L('inverse-surface'), 'inverse-on-surface': L('inverse-on-surface'),
  'inverse-primary': L('inverse-primary'), 'surface-tint': L('surface-tint'),
  'primary-fixed': L('primary-fixed'), 'primary-fixed-dim': L('primary-fixed-dim'),
  'on-primary-fixed': L('on-primary-fixed'), 'on-primary-fixed-variant': L('on-primary-fixed-variant'),
  'secondary-fixed': L('secondary-fixed'), 'secondary-fixed-dim': L('secondary-fixed-dim'),
  'on-secondary-fixed': L('on-secondary-fixed'), 'on-secondary-fixed-variant': L('on-secondary-fixed-variant'),
  'tertiary-fixed': L('tertiary-fixed'), 'tertiary-fixed-dim': L('tertiary-fixed-dim'),
  'on-tertiary-fixed': L('on-tertiary-fixed'), 'on-tertiary-fixed-variant': L('on-tertiary-fixed-variant'),
  'accent-fixed': L('accent-fixed'), 'accent-fixed-dim': L('accent-fixed-dim'),
  'on-accent-fixed': L('on-accent-fixed'), 'on-accent-fixed-variant': L('on-accent-fixed-variant'),
};

// ── Off-palette Tailwind defaults still referenced in existing pages ────────
// (bg-slate-950, text-slate-400, border-slate-300, text-amber-700, green-500,
// blue-500, purple-500, indigo-500 …). Rather than leaving Tailwind's default
// palette reachable — which is exactly the drift we are removing — these ramps
// are REMAPPED onto Fusha values, so the classes still work AND stay on-brand.
const NEUTRAL = {
  50: F.sand[50], 100: F.sand[100], 200: F.teal[100], 300: F.sand[300],
  400: t('text-muted'), 500: t('text-secondary'), 600: F.teal[600],
  700: F.teal[700], 800: F.teal[800], 900: F.teal[900], 950: F.teal[900],
};
const WARM = { // amber / yellow / orange
  50: F.gold[100], 100: F.gold[100], 200: F.gold[400], 300: F.gold[400],
  400: F.gold[500], 500: F.gold[500], 600: F.gold[700], 700: F.gold[700],
  800: F.brass[700], 900: F.brass[700],
};
const COOL = { // blue / cyan / sky
  50: F.teal[50], 100: F.teal[100], 200: F.teal[100], 300: F.teal[400],
  400: F.teal[500], 500: F.teal[500], 600: F.teal[600], 700: F.teal[700],
  800: F.teal[800], 900: F.teal[900],
};
const BRASSY = { // indigo / violet / purple / fuchsia / pink / rose
  100: F.olive[100], 200: F.olive[400], 300: F.brass[400], 400: F.brass[600],
  500: F.brass[600], 600: F.brass[700], 700: F.brass[700], 800: F.brass[700],
  900: F.brass[700],
};
const compat = {
  slate: NEUTRAL, gray: NEUTRAL, zinc: NEUTRAL, neutral: NEUTRAL, stone: NEUTRAL,
  amber: WARM, yellow: WARM, orange: { ...WARM, 300: F.gold[400], 400: F.gold[500], 500: F.gold[700] },
  emerald: {
    50: F.teal[50], 100: F.teal[100], 200: F.sage[100], 300: F.sage[400],
    400: F.sage[500], 500: F.sage[600], 600: F.teal[500], 700: F.teal[600],
    800: F.teal[800], 900: F.teal[900], 950: F.teal[900],
  },
  green: {
    50: F.sage[100], 100: F.sage[100], 200: F.sage[100], 300: F.sage[400],
    400: F.sage[500], 500: F.sage[500], 600: F.sage[600], 700: F.sage[600],
    800: F.sage[600], 900: F.sage[600],
  },
  teal: F.teal,
  blue: COOL, cyan: COOL, sky: COOL,
  indigo: BRASSY, violet: BRASSY, purple: BRASSY, fuchsia: BRASSY, pink: BRASSY, rose: BRASSY,
  lime: {
    50: F.olive[100], 100: F.olive[100], 200: F.olive[100], 300: F.olive[400],
    400: F.olive[500], 500: F.olive[500], 600: F.sage[600], 700: F.sage[600],
    800: F.sage[600], 900: F.sage[600],
  },
  red: {
    50: t('status-error-bg'), 100: t('status-error-bd'), 200: t('status-error-bd'),
    300: t('status-error-fg'), 400: t('status-error-fg'), 500: t('status-error-fg'),
    600: t('status-error-fg'), 700: t('status-error-fg'), 800: t('status-error-fg'),
    900: t('status-error-fg'),
  },
};

// Legacy type scale — all collapse onto Cairo (Plus Jakarta Sans / Inter removed:
// Latin-only, so Arabic fell through to Cairo anyway).
const CAIRO = ['Cairo', 'IBM Plex Sans Arabic', 'system-ui', 'sans-serif'];

module.exports = {
  presets: [fushaBrandPreset],   // keeps bg-fusha-teal-800 etc. as the L1 escape hatch
  darkMode: 'class',
  content: [
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/lib/**/*.{js,ts,jsx,tsx,mdx}',
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    // ── REPLACED (not extended) so no off-palette value is reachable ──
    screens: { sm: '640px', md: '768px', lg: '1024px', xl: '1280px', '2xl': '1536px' },

    colors: {
      inherit: 'inherit', current: 'currentColor', transparent: 'transparent',
      white: '#FFFFFF', black: '#0B1A1B',

      // ── Fusha semantic (PREFERRED for all new code) ──
      canvas: t('bg-canvas'),
      surface: t('bg-surface'),
      'surface-raised': t('bg-surface-raised'),
      'surface-subtle': t('bg-surface-subtle'),
      'surface-sunken': t('bg-surface-sunken'),
      inverse: t('bg-inverse'),

      sidebar: t('bg-sidebar'),
      'sidebar-hover': t('bg-sidebar-hover'),
      'sidebar-active': t('bg-sidebar-active'),

      ink: t('text-primary'),
      'ink-secondary': t('text-secondary'),
      'ink-muted': t('text-muted'),
      'ink-inverse': t('text-inverse'),
      'ink-on-accent': t('text-on-accent'),
      'ink-sidebar': t('text-sidebar'),
      'ink-sidebar-muted': t('text-sidebar-muted'),

      brand: t('brand-primary'),
      'brand-hover': t('brand-primary-hover'),
      'brand-active': t('brand-primary-active'),
      'brand-subtle': t('brand-primary-subtle'),
      'brand-2': t('brand-secondary'),
      accent: t('brand-accent'),
      'accent-hover': t('brand-accent-hover'),
      'accent-subtle': t('brand-accent-subtle'),
      sage: t('brand-sage'),
      olive: t('brand-olive'),
      brass: t('brand-brass'),

      line: t('border-subtle'),
      'line-strong': t('border-strong'),

      success: t('status-success-fg'),
      'success-bg': t('status-success-bg'),
      'success-bd': t('status-success-bd'),
      warning: t('status-warning-fg'),
      'warning-bg': t('status-warning-bg'),
      'warning-bd': t('status-warning-bd'),
      danger: t('status-error-fg'),
      'danger-bg': t('status-error-bg'),
      'danger-bd': t('status-error-bd'),
      info: t('status-info-fg'),
      'info-bg': t('status-info-bg'),
      'info-bd': t('status-info-bd'),

      // ── Deprecated M3 bridge + remapped default ramps (migration only) ──
      ...legacy,
      ...compat,
    },

    fontFamily: {
      ui: CAIRO,
      cairo: CAIRO,
      poetry: ['Amiri', 'Noto Naskh Arabic', 'serif'],
      // legacy aliases
      'display-lg': CAIRO, 'display-lg-mobile': CAIRO,
      'headline-md': CAIRO, 'headline-sm': CAIRO,
      'body-lg': CAIRO, 'body-md': CAIRO, 'body-sm': CAIRO, 'label-md': CAIRO,
    },

    fontSize: {
      // Fusha scale — PREFER these names
      poetry: ['18px', { lineHeight: '34px', fontFamily: "'Amiri','Noto Naskh Arabic',serif" }],
      caption: ['12px', { lineHeight: '18px' }],
      body: ['14px', { lineHeight: '22px' }],
      'body-lg': ['16px', { lineHeight: '26px', fontWeight: '500' }],
      h4: ['18px', { lineHeight: '26px', fontWeight: '600' }],
      h3: ['20px', { lineHeight: '28px', fontWeight: '700' }],
      h2: ['24px', { lineHeight: '32px', fontWeight: '800' }],
      h1: ['32px', { lineHeight: '42px', fontWeight: '800' }],
      display: ['40px', { lineHeight: '52px', fontWeight: '800' }],
      // compat aliases — delete after migration, do not use in new code
      xs: ['12px', { lineHeight: '18px' }],
      sm: ['14px', { lineHeight: '22px' }],
      base: ['16px', { lineHeight: '26px' }],
      lg: ['18px', { lineHeight: '26px' }],
      xl: ['20px', { lineHeight: '28px' }],
      '2xl': ['24px', { lineHeight: '32px' }],
      '3xl': ['32px', { lineHeight: '42px' }],
      '4xl': ['40px', { lineHeight: '52px' }],
      '5xl': ['40px', { lineHeight: '52px' }],
      '6xl': ['40px', { lineHeight: '52px' }],
      'display-lg': ['32px', { lineHeight: '42px', fontWeight: '800' }],
      'display-lg-mobile': ['26px', { lineHeight: '36px', fontWeight: '800' }],
      'headline-md': ['20px', { lineHeight: '28px', fontWeight: '700' }],
      'headline-sm': ['18px', { lineHeight: '26px', fontWeight: '700' }],
      'body-md': ['14px', { lineHeight: '22px' }],
      'body-sm': ['12px', { lineHeight: '18px' }],
      'label-md': ['13px', { lineHeight: '18px', fontWeight: '600' }],
    },

    // rounded-lg = 20px, the spec's primary card radius
    borderRadius: {
      none: '0', sm: '6px', DEFAULT: '12px', md: '12px',
      lg: '20px', xl: '32px', '2xl': '32px', '3xl': '32px', full: '9999px',
    },

    boxShadow: {
      none: 'none',
      sm: 'var(--shadow-sm)',
      DEFAULT: 'var(--shadow-md)',
      md: 'var(--shadow-md)',
      lg: 'var(--shadow-lg)',
      xl: 'var(--shadow-lg)',
      '2xl': 'var(--shadow-floating)',
      inner: 'var(--shadow-inset-hairline)',
      floating: 'var(--shadow-floating)',
      'glow-accent': 'var(--shadow-glow-accent)',
      // legacy aliases
      ambient: 'var(--shadow-md)', 'card-shadow': 'var(--shadow-md)',
      soft: 'var(--shadow-md)', lift: 'var(--shadow-lg)',
      'glow-primary': 'var(--shadow-lg)',
      // focus rings
      'ring-light': 'var(--ring-on-light)',
      'ring-canvas': 'var(--ring-on-canvas)',
      'ring-brand': 'var(--ring-on-brand)',
      'ring-accent': 'var(--ring-on-accent)',
      'ring-danger': 'var(--ring-error)',
    },

    extend: {
      transitionTimingFunction: {
        fusha: 'cubic-bezier(0.16, 1, 0.3, 1)',
        'fusha-exit': 'cubic-bezier(0.7, 0, 0.84, 0)',
      },
      transitionDuration: { 250: '250ms', 350: '350ms', 400: '400ms' },
      minHeight: { touch: '48px', control: '48px', 'control-lg': '52px' },
      minWidth: { touch: '48px' },
      // NOTE: numeric spacing keys (p-2 p-4 p-6 p-8 p-10 p-12 p-16) are the
      // 8pt-safe path. p-3 (12px) / p-5 (20px) are legacy — see doc §B.2 audit.
      spacing: {
        sidebar: '264px', 'sidebar-collapsed': '88px',
        header: '72px', 'bottom-nav': '64px',
      },
      maxWidth: { container: '1280px', reading: '68ch' },
      zIndex: {
        header: '20', sidebar: '30', overlay: '40', modal: '50', toast: '60',
      },
      backgroundImage: {
        'hero-brand': 'linear-gradient(90deg, #163134 0%, #37695C 100%)',
        'hero-brand-rtl': 'linear-gradient(270deg, #163134 0%, #37695C 100%)',
        'sheen-gold': 'linear-gradient(100deg, transparent 20%, rgba(232,181,74,.18) 50%, transparent 80%)',
      },
      keyframes: {
        shimmer: { '0%': { backgroundPosition: '200% 0' }, '100%': { backgroundPosition: '-200% 0' } },
        shake: {
          '0%,100%': { transform: 'translateX(0)' },
          '20%,60%': { transform: 'translateX(-4px)' },
          '40%,80%': { transform: 'translateX(4px)' },
        },
        'fade-in': { from: { opacity: '0' }, to: { opacity: '1' } },
        'slide-up': { from: { opacity: '0', transform: 'translateY(8px)' }, to: { opacity: '1', transform: 'translateY(0)' } },
        'zoom-in': { from: { opacity: '0', transform: 'scale(.96)' }, to: { opacity: '1', transform: 'scale(1)' } },
        'check-pop': { '0%': { transform: 'scale(.6)', opacity: '0' }, '100%': { transform: 'scale(1)', opacity: '1' } },
        'pulse-soft': { '0%,100%': { opacity: '1' }, '50%': { opacity: '.55' } },
      },
      animation: {
        shimmer: 'shimmer 1.6s linear infinite',
        shake: 'shake 300ms cubic-bezier(0.16,1,0.3,1)',
        'fade-in': 'fade-in 250ms cubic-bezier(0.16,1,0.3,1)',
        'slide-up': 'slide-up 250ms cubic-bezier(0.16,1,0.3,1)',
        'zoom-in': 'zoom-in 350ms cubic-bezier(0.16,1,0.3,1)',
        'check-pop': 'check-pop 200ms cubic-bezier(0.16,1,0.3,1)',
        'pulse-soft': 'pulse-soft 1.8s ease-in-out infinite',
      },
    },
  },
  plugins: [],
};
