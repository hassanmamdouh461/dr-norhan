# 20 — فُصْحَى Design Implementation Spec

**Audience:** the engineer implementing `student-web` and `dashboard`.
**Status:** normative. Where this document and any older doc conflict, **this document wins**.
**Sources of truth (in precedence order):**
1. `brand/IDENTITY_AND_DESIGN_SYSTEM.md` (master spec, v2.0.0)
2. `brand/DESIGN_TOKENS.json`
3. `brand/fusha-tokens.css` ← **new, the executable token layer (deliverable A)**
4. This file

> New file created for you: **`brand/fusha-tokens.css`** — the complete `:root` / `.dark`
> custom-property block, shared by BOTH apps. Import it; do not retype it.
>
> **`brand/tailwind_brand_preset.js` is PRISTINE and must stay that way** — it is the
> official preset from the client's brand package. Any extra value the dashboard needs
> goes in `dashboard/tailwind.config.js` via `presets: [...]` + `extend`.
>
> **Status: §A.1 (dashboard) and §B.2 are APPLIED** to `dashboard/src/app/globals.css`
> and `dashboard/tailwind.config.js`. See §B.4 for the two additions the applied config
> carries on top of the §B.2 listing below (a legacy Tailwind alias layer and a remapped
> default-colour ramp) — both exist only so existing pages keep rendering during
> migration.

---

## 0. Global rules (read once, applies to every file)

| # | Rule | Enforcement |
|---|---|---|
| G1 | `<html lang="ar" dir="rtl">` on both apps | `student-web/index.html` ✓ already; `dashboard/src/app/layout.tsx` must add `dir="rtl"` |
| G2 | **Logical properties only.** `ms-* me-* ps-* pe-* start-* end-* text-start text-end border-s border-e rounded-s-* rounded-e-*`. Never `ml mr pl pr left right text-left text-right`. | grep: `grep -rnE '\b(ml\|mr\|pl\|pr\|left\|right)-' src/` must return 0 |
| G3 | **8pt grid.** Allowed spacing values: `4, 8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 128`. `4px` only for icon↔label micro-gaps and chip padding. `12/20/28/36/44/52px` are **banned as spacing** (52px is allowed as a *control height* only). | Tailwind: use **even** numeric keys (`p-2 p-4 p-6 p-8 p-10 p-12 p-16`) plus `p-1` for micro |
| G4 | **No hex in components.** Components consume `--bg-* / --text-* / --brand-* / --border-* / --status-*` only. | grep: `grep -rnE '#[0-9A-Fa-f]{3,8}' src/` must return 0 outside tokens.css |
| G5 | Touch targets ≥ **48×48px** | `min-h-touch min-w-touch` (48px) |
| G6 | Primary card radius **20px**, inputs **12px**, chips/buttons **6px**, pills **full** | `--radius-lg` etc. |
| G7 | Motion: `var(--ease-standard)` = `cubic-bezier(0.16,1,0.3,1)`. 150–200ms micro · 250–300ms expansion · 350–400ms modal | never `ease-in-out` / never `duration-500` |
| G8 | Shadows tinted `#163134`, never `rgba(0,0,0,…)` in light mode | `--shadow-*` |
| G9 | Amiri is **only** for poetry / Qur'anic / rhetorical quotations (`--font-poetry`, line-height 1.8–2.0). Everything else is Cairo. | Current `--font-display: 'Amiri'` in `index.css` is a **bug** (see §G) |
| G10 | One question per screen (Hick's law) on all exam flows | §D.4 |

---

# A. The token layer

**File:** `brand/fusha-tokens.css` (created). Three layers:

```
L1  --fx-*          global primitives (hex)  +  --fx-*-rgb (channel triplets)
L2  --bg-* --text-* --brand-* --border-* --status-*   semantic  (light in :root, dark in .dark)
L3  component-level: --card-bg, --btn-primary-bg …    local to a component, defined from L2
```

Components **must** use L2. L1 is only for building L3 and for the Tailwind preset.
The `-rgb` triplets exist solely so Tailwind can render opacity modifiers
(`bg-brand-primary/10` → `rgb(var(--brand-primary-rgb) / 0.1)`).

### A.1 How each app consumes it

**dashboard (Next.js)** — in `src/app/globals.css`, **replace lines 1–381 entirely** with:

```css
@import '../../brand/fusha-tokens.css';   /* adjust relative path if needed */
@import url('https://fonts.googleapis.com/css2?family=Cairo:wght@300;400;500;600;700;800&family=Amiri:wght@400;700&display=swap');
@import url('https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=block');

@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  html { color-scheme: light; }
  html.dark { color-scheme: dark; }
  body {
    @apply bg-canvas text-text-primary antialiased min-h-screen;
    font-family: var(--font-ui);
  }
  :focus-visible { outline: none; }          /* rings come from --ring-* utilities */
  ::selection { background: var(--brand-accent-subtle); color: var(--text-primary); }
}
```

**student-web (Vite)** — create `src/styles/tokens.css`:

```css
@import '../../../brand/fusha-tokens.css';
```

…and in `src/main.tsx` make it the **first** import, before `./index.css`.
Then delete the duplicated `--fusha-*` primitive block at `src/index.css:4820-4854`
and the duplicated semantic block at `:root` / `html.dark` (lines 3–207), keeping only
the genuinely app-specific vars (`--main-pad`, `--build-id`, `--hero-*`).

### A.2 Semantic token reference (what to reach for)

| Token | Light | Dark | Use for |
|---|---|---|---|
| `--bg-canvas` | `#F8F9F7` | `#0B1A1B` | app floor / page background |
| `--bg-surface` | `#FFFFFF` | `#112628` | cards, sheets, tables |
| `--bg-surface-raised` | `#FFFFFF` | `#183538` | floating cards, dropdowns, popovers |
| `--bg-surface-subtle` | `#EFF2EF` | `#1D3F43` | input fills, icon wells, chip tracks |
| `--bg-surface-sunken` | `#E8E5DC` | `#0E1F21` | progress track, inset wells, code blocks |
| `--bg-inverse` | `#163134` | `#F4F6F5` | hero, footer, inverted blocks |
| `--bg-scrim` | `rgb(11 26 27/.48)` | `rgb(0 0 0/.64)` | modal backdrop |
| `--text-primary` | `#163134` | `#F4F6F5` | headings, body, question text |
| `--text-secondary` | `#37695C` | `#B9C7C5` | descriptions, labels, meta |
| `--text-muted` | `#5B6361` | `#829896` | timestamps, hints |
| `--text-inverse` | `#FFFFFF` | `#0B1A1B` | text on teal fills |
| `--text-on-accent` | `#163134` | `#0B1A1B` | text on gold fills |
| `--brand-primary` | `#163134` | `#4FA895` | CTA fill, header, active states |
| `--brand-primary-hover` | `#1E4347` | `#5FB8A4` | CTA hover |
| `--brand-primary-active` | `#0B1A1B` | `#3D8B79` | CTA pressed |
| `--brand-primary-subtle` | `#EEF7F5` | `#1E4347` | tinted teal container |
| `--brand-secondary` | `#37695C` | `#798963` | icons, secondary ink, links |
| `--brand-accent` | `#E8B54A` | `#F0C76C` | play buttons, stars, achievements |
| `--brand-accent-hover` | `#D69E32` | `#E8B54A` | gold hover |
| `--brand-accent-subtle` | `#FDF6E2` | `#2E2A16` | gold tint container, badge bg |
| `--brand-sage` | `#62856A` | `#7AA482` | progress fill, explanation cards |
| `--brand-olive` | `#798963` | `#92A578` | gradients, badges |
| `--brand-brass` | `#918D58` | `#B1AC6E` | scrollbar thumb, luxury borders |
| `--border-subtle` | `#D8DDD9` | `#1C3B3E` | hairlines, dividers |
| `--border-strong` | `#B7B19B` | `#3D6265` | inputs, active cards |
| `--status-success-fg/bg/bd` | `#1E6B37 / #EAF6EE / #A3D9B5` | `#A3D9B5 / #0F2C21 / #143E28` | correct answer, saved |
| `--status-warning-fg/bg/bd` | `#8F5B00 / #FEF7E6 / #F7D788` | `#F7D788 / #282815 / #46370F` | due soon, offline |
| `--status-error-fg/bg/bd` | `#A82315 / #FDF0EE / #F5A9A0` | `#F5A9A0 / #2E1C1A / #521E18` | wrong answer, validation |
| `--status-info-fg/bg/bd` | `#17546E / #EEF5F8 / #A5CBE0` | `#A5CBE0 / #0E272D / #103440` | tips, announcements |

Plus: `--bg-sidebar`, `--bg-sidebar-hover`, `--bg-sidebar-active`, `--text-sidebar`,
`--text-sidebar-muted`, `--sidebar-active-indicator`, `--ring-*`, `--radius-*`,
`--spacing-*`, `--shadow-*`, `--ease-*`, `--dur-*`, `--text-*`/`--lh-*`/`--fw-*`,
`--font-ui`, `--font-poetry`, `--container-max`, `--content-pad`, `--sidebar-w`,
`--header-h`, `--bottom-nav-h`, `--touch-min`, `--z-*`.

### A.3 The legacy bridge (migration safety net)

`fusha-tokens.css` ships a **Legacy Bridge** block that aliases every old
Material-3 / chemistry-era variable (`--primary`, `--on-primary`, `--surface`,
`--background`, `--outline`, `--error`, `--success`, `--warning`,
`--surface-container-high`, `--shadow-color`, `--motion-easing`, …) onto the Fusha
semantic tokens. Because they are `var()` **references** (not copies), they
auto-resolve correctly in dark mode.

**This means you can swap the token layer in first and migrate class names
incrementally** instead of doing a big-bang rewrite of 4,854 lines.

⚠️ The bridge is **deprecated on arrival**. Delete each alias as you migrate its
consumers. Do **not** write new code against `--primary` / `--surface`.

---

# B. Tailwind ruling (decisive)

## B.1 `dashboard/tailwind.config.js` — verdict

| Block | Verdict | Why |
|---|---|---|
| `presets: [fushaBrandPreset]` | **KEEP** | correct pattern; primitives stay in `brand/` |
| `darkMode: 'class'` | **KEEP** | matches `student-web` (`html.dark`) |
| `content` globs | **KEEP + add** `./src/lib/**` | |
| ~60 M3 semantic colors (`primary`, `on-primary`, `primary-container`, `*-fixed`, `*-fixed-dim`, `surface-container-*`, `inverse-*`, `surface-tint`, `tertiary`, `on-tertiary`…) | **DELETE ALL** | unreachable: `globals.css` already overrode them to Fusha at lines 316–344. They are dead weight + they re-import Material-3 vocabulary that invites drift. Replaced by 24 Fusha semantic colors. |
| `fontFamily` — `display-lg`, `display-lg-mobile`, `headline-md`, `headline-sm`, `body-lg/md/sm`, `label-md` all → **Plus Jakarta Sans / Inter** | **DELETE ALL** | Latin-only typefaces. Arabic text falls through to Cairo anyway, so you ship 2 extra font families for **zero** Arabic glyphs. Also `Inter` before `Cairo` in the stack makes numerals render in a non-matching face. Keep only `fusha` + `poetry` (from preset) + `cairo`. |
| `fontFamily.cairo: ["var(--font-cairo)", …]` | **FIX** | `var(--font-cairo)` was never defined. → `['Cairo', 'IBM Plex Sans Arabic', 'system-ui', 'sans-serif']` |
| `fontSize` — `display-lg` 2.25rem, `display-lg-mobile` 1.75rem, `headline-*` 1.5/1.125rem, `body-lg` 1rem/1.6, `body-md` .875/1.4, `body-sm` .75/1.1, `label-md` .8125/1.1 | **DELETE ALL** | Not the Fusha scale (spec §3.2: 40/32/24/20/18/16/14/12). `body-sm` 12px/1.1 violates the ≥14px interactive-text rule. Replaced by the 8-step Fusha scale. |
| `boxShadow.ambient / card-shadow / soft / lift / glow-primary / glow-accent` | **DELETE ALL** | all keyed to `rgb(var(--shadow-color))` = slate; `ambient`/`card-shadow`/`soft` are byte-identical duplicates; `lift` uses pure-black-ish slate at 12%. Replaced by the 4 spec shadows. |
| `borderRadius` — `DEFAULT .5rem, sm .25rem, md .75rem, lg 1rem, xl 1.5rem` | **REPLACE** | 8px/4px/12px/16px/24px ≠ Fusha 6/12/20/32. Remapped so `rounded-lg` = **20px** (the spec's primary card radius). |
| `spacing` — `xs:4px, sm:12px, base:8px, md:24px, gutter:24px, lg:48px, xl:80px, container-max:1280px` | **DELETE ALL** | `sm:12px` breaks 8pt; the names lie (`xs`=4 but `base`=8 while `sm`=12 — non-monotonic); `container-max` in `spacing` is nonsense. Use the numeric Tailwind scale (even keys) + `maxWidth.container`. |
| `transitionTimingFunction.quantum: cubic-bezier(0.4,0,0.2,1)` | **DELETE** | brand easing is `cubic-bezier(0.16,1,0.3,1)`. `quantum` is the Material standard curve. |
| `plugins: []` | **KEEP** | no plugin needed; RTL via logical utilities, no `rtl:` variants required |

## B.2 Final `dashboard/tailwind.config.js` (copy-paste)

```js
/** @type {import('tailwindcss').Config} */
const fushaBrandPreset = require('../brand/tailwind_brand_preset.js');

// Semantic token → Tailwind color with alpha support
const t = (name) => `rgb(var(--${name}-rgb) / <alpha-value>)`;

module.exports = {
  presets: [fushaBrandPreset],          // supplies bg-fusha-teal-800 etc. (L1 escape hatch)
  darkMode: 'class',
  content: [
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/lib/**/*.{js,ts,jsx,tsx,mdx}',
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    // ── REPLACED (not extended) so off-palette values are unreachable ──
    screens: { sm: '640px', md: '768px', lg: '1024px', xl: '1280px', '2xl': '1536px' },
    colors: {
      inherit: 'inherit', current: 'currentColor', transparent: 'transparent',
      white: '#FFFFFF', black: '#0B1A1B',

      canvas:          t('bg-canvas'),
      surface:         t('bg-surface'),
      'surface-raised':t('bg-surface-raised'),
      'surface-subtle':t('bg-surface-subtle'),
      'surface-sunken':t('bg-surface-sunken'),
      inverse:         t('bg-inverse'),

      sidebar:         t('bg-sidebar'),
      'sidebar-hover': t('bg-sidebar-hover'),
      'sidebar-active':t('bg-sidebar-active'),

      ink:             t('text-primary'),      // text-ink
      'ink-secondary': t('text-secondary'),
      'ink-muted':     t('text-muted'),
      'ink-inverse':   t('text-inverse'),
      'ink-on-accent': t('text-on-accent'),
      'ink-sidebar':   t('text-sidebar'),
      'ink-sidebar-muted': t('text-sidebar-muted'),

      brand:           t('brand-primary'),     // bg-brand
      'brand-hover':   t('brand-primary-hover'),
      'brand-active':  t('brand-primary-active'),
      'brand-subtle':  t('brand-primary-subtle'),
      'brand-2':       t('brand-secondary'),   // bg-brand-2  (teal-500 / olive)
      accent:          t('brand-accent'),
      'accent-hover':  t('brand-accent-hover'),
      'accent-subtle': t('brand-accent-subtle'),
      sage:            t('brand-sage'),
      olive:           t('brand-olive'),
      brass:           t('brand-brass'),

      line:            t('border-subtle'),     // border-line
      'line-strong':   t('border-strong'),

      success:      t('status-success-fg'),
      'success-bg': t('status-success-bg'),
      'success-bd': t('status-success-bd'),
      warning:      t('status-warning-fg'),
      'warning-bg': t('status-warning-bg'),
      'warning-bd': t('status-warning-bd'),
      danger:       t('status-error-fg'),
      'danger-bg':  t('status-error-bg'),
      'danger-bd':  t('status-error-bd'),
      info:         t('status-info-fg'),
      'info-bg':    t('status-info-bg'),
      'info-bd':    t('status-info-bd'),
    },
    fontFamily: {
      ui:     ['Cairo', 'IBM Plex Sans Arabic', 'system-ui', 'sans-serif'],
      poetry: ['Amiri', 'Noto Naskh Arabic', 'serif'],
      cairo:  ['Cairo', 'IBM Plex Sans Arabic', 'sans-serif'],
    },
    fontSize: {
      // Fusha scale — prefer these names
      poetry:   ['18px', { lineHeight: '34px', fontFamily: "'Amiri','Noto Naskh Arabic',serif" }],
      caption:  ['12px', { lineHeight: '18px' }],
      body:     ['14px', { lineHeight: '22px' }],
      'body-lg':['16px', { lineHeight: '26px', fontWeight: '500' }],
      h4:       ['18px', { lineHeight: '26px', fontWeight: '600' }],
      h3:       ['20px', { lineHeight: '28px', fontWeight: '700' }],
      h2:       ['24px', { lineHeight: '32px', fontWeight: '800' }],
      h1:       ['32px', { lineHeight: '42px', fontWeight: '800' }],
      display:  ['40px', { lineHeight: '52px', fontWeight: '800' }],
      // compat aliases — DELETE after migration, do not use in new code
      xs:  ['12px', { lineHeight: '18px' }],
      sm:  ['14px', { lineHeight: '22px' }],
      base:['16px', { lineHeight: '26px' }],
      lg:  ['18px', { lineHeight: '26px' }],
      xl:  ['20px', { lineHeight: '28px' }],
      '2xl':['24px', { lineHeight: '32px' }],
      '3xl':['32px', { lineHeight: '42px' }],
      '4xl':['40px', { lineHeight: '52px' }],
    },
    borderRadius: {
      none: '0', sm: '6px', DEFAULT: '12px', md: '12px',
      lg: '20px', xl: '32px', '2xl': '32px', '3xl': '32px', full: '9999px',
    },
    boxShadow: {
      sm: 'var(--shadow-sm)', md: 'var(--shadow-md)',
      lg: 'var(--shadow-lg)', floating: 'var(--shadow-floating)',
      'glow-accent': 'var(--shadow-glow-accent)',
      'ring-light':  'var(--ring-on-light)',
      'ring-canvas': 'var(--ring-on-canvas)',
      'ring-brand':  'var(--ring-on-brand)',
      'ring-accent': 'var(--ring-on-accent)',
      'ring-danger': 'var(--ring-error)',
    },
    extend: {
      transitionTimingFunction: {
        fusha: 'cubic-bezier(0.16, 1, 0.3, 1)',
        'fusha-exit': 'cubic-bezier(0.7, 0, 0.84, 0)',
      },
      transitionDuration: { 250: '250ms', 350: '350ms', 400: '400ms' },
      minHeight:  { touch: '48px', control: '48px', 'control-lg': '52px' },
      minWidth:   { touch: '48px' },
      spacing:    { sidebar: '264px', 'sidebar-collapsed': '88px', header: '72px', 'bottom-nav': '64px' },
      maxWidth:   { container: '1280px', reading: '68ch' },
      zIndex:     { header: '20', sidebar: '30', overlay: '40', modal: '50', toast: '60' },
      backgroundImage: {
        'hero-brand': 'linear-gradient(90deg, #163134 0%, #37695C 100%)',
        'hero-brand-rtl': 'linear-gradient(270deg, #163134 0%, #37695C 100%)',
        'sheen-gold': 'linear-gradient(100deg, transparent 20%, rgba(232,181,74,.18) 50%, transparent 80%)',
      },
      keyframes: {
        shimmer:      { '0%': { backgroundPosition: '200% 0' }, '100%': { backgroundPosition: '-200% 0' } },
        shake:        { '0%,100%': { transform: 'translateX(0)' }, '20%,60%': { transform: 'translateX(-4px)' }, '40%,80%': { transform: 'translateX(4px)' } },
        'fade-in':    { from: { opacity: '0' }, to: { opacity: '1' } },
        'slide-up':   { from: { opacity: '0', transform: 'translateY(8px)' }, to: { opacity: '1', transform: 'translateY(0)' } },
        'zoom-in':    { from: { opacity: '0', transform: 'scale(.96)' }, to: { opacity: '1', transform: 'scale(1)' } },
        'check-pop':  { '0%': { transform: 'scale(.6)', opacity: '0' }, '100%': { transform: 'scale(1)', opacity: '1' } },
        'pulse-soft': { '0%,100%': { opacity: '1' }, '50%': { opacity: '.55' } },
      },
      animation: {
        shimmer:     'shimmer 1.6s var(--ease-linear, linear) infinite',
        shake:       'shake 300ms var(--ease-standard, ease)',
        'fade-in':   'fade-in var(--dur-expand, 250ms) cubic-bezier(0.16,1,0.3,1)',
        'slide-up':  'slide-up var(--dur-expand, 250ms) cubic-bezier(0.16,1,0.3,1)',
        'zoom-in':   'zoom-in var(--dur-modal, 350ms) cubic-bezier(0.16,1,0.3,1)',
        'check-pop': 'check-pop 200ms cubic-bezier(0.16,1,0.3,1)',
        'pulse-soft':'pulse-soft 1.8s ease-in-out infinite',
      },
    },
  },
  plugins: [],
};
```

**Pre-flight audit before flipping the config** (run in `dashboard/`):

```bash
# 1. Which legacy color utilities are actually in use?
grep -rnoE '\b(bg|text|border|ring|from|to|via|fill|stroke|shadow|decoration|outline|divide|placeholder|accent|caret)-(primary|on-primary|primary-container|secondary|tertiary|accent|error|success|warning|background|surface[a-z-]*|outline[a-z-]*|inverse[a-z-]*|surface-tint|[a-z]+-fixed[a-z-]*)(/\[?[0-9.]+\]?)?' src/ | sort -u
# 2. Physical properties (must be 0)
grep -rnE 'className="[^"]*\b(ml|mr|pl|pr|left|right)-' src/
# 3. Banned spacing keys: p-3 p-5 p-7 p-9 p-11 p-13 p-14 / gap-3 gap-5 … / m-3 m-5 …
grep -rnoE '\b(p|px|py|pt|pb|ps|pe|m|mx|my|mt|mb|ms|me|gap|gap-x|gap-y|space-x|space-y|w|h)-(1|3|5|7|9|11|13|14)\b' src/ | sort -u
```

### B.2.1 ⚠️ The LEGACY BRIDGE must emit RGB triplets, not hex

Every legacy consumer wraps these variables in a colour function — `student-web` has
**313** `rgb(var(--…))` and **36** `rgba(var(--…), α)` call sites, and the whole Tailwind
colour layer is `rgb(var(--x) / <alpha-value>)`.

If a bridge alias resolved to a hex value, `rgb(var(--primary))` would expand to
`rgb(#163134)` — **invalid CSS**. The declaration is silently dropped, the element
renders transparent, and there is no console error.

Therefore every colour alias in the bridge points at a `*-rgb` triplet. It points at the
**semantic** triplet (`--brand-primary-rgb`), not the raw primitive
(`--fx-teal-800-rgb`), because the semantic triplets are re-declared inside `.dark` —
that is what keeps the bridge dark-mode reactive. Verified resolution:

| alias | light | dark |
|---|---|---|
| `--primary` | `22 49 52` | `79 168 149` |
| `--on-primary` | `255 255 255` | `11 26 27` |
| `--background` | `248 249 247` | `11 26 27` |
| `--surface` | `255 255 255` | `17 38 40` |
| `--surface-container-high` | `239 242 239` | `29 63 67` |
| `--on-surface-variant` | `55 105 92` | `185 199 197` |
| `--accent` | `232 181 74` | `240 199 108` |
| `--error` | `168 35 21` | `245 169 160` |
| `--shadow-color` | `22 49 52` | `22 49 52` |

Non-colour aliases (`--transition-speed`, `--font-body`, `--font-display`,
`--font-arabic`, `--font-english`, `--motion-easing`) are unchanged.
`--manuscript-gold` stays a plain colour value (it has always been used bare, never
wrapped in `rgb()`).

### B.4 What the applied dashboard config adds on top of §B.2

`dashboard/tailwind.config.js` is the §B.2 config plus two **migration-only** layers.
Both are marked deprecated in the file; delete them when the pages are migrated.

1. **Legacy M3 colour aliases** (~50 entries: `primary`, `on-primary`,
   `surface-container-high`, `on-surface-variant`, `outline-variant`, `tertiary-fixed`,
   `surface-tint`, …) wired to the CSS bridge via `rgb(var(--<name>) / <alpha-value>)`.
   Without these, every existing dashboard page renders unstyled.
2. **Remapped default-colour ramps.** Existing pages also use Tailwind *defaults*
   (`bg-slate-950`, `text-slate-400`, `border-slate-300`, `text-amber-700`,
   `bg-green-500/10`, `text-blue-500`, `text-purple-500`, `border-indigo-500`). Rather
   than leaving the whole default palette reachable — which is precisely the drift we are
   removing — `slate/gray/zinc/neutral/stone`, `amber/yellow/orange`, `emerald/green/lime`,
   `blue/cyan/sky`, `indigo/violet/purple/fuchsia/pink/rose` and `red` are **remapped onto
   Fusha primitives** (read from the preset, never retyped). The classes still work and
   the result is on-brand.

`theme.boxShadow` and `theme.fontFamily` also carry legacy aliases (`shadow-ambient`,
`shadow-soft`, `shadow-lift`, `glow-primary`; `font-display-lg`, `font-body-sm`, …) so
nothing disappears. `theme.fontSize` keeps `text-xs/sm/base/lg/xl/2xl…` plus the old
`display-lg`/`headline-md`/`body-sm`/`label-md` names, all collapsed onto Cairo.

Two pre-existing issues found while applying — **not** introduced by this change:
- `animate-in`, `fade-in`, `zoom-in-95` are used by dashboard pages but require
  `tailwindcss-animate`, which is **not** in `package.json`. Those classes are already
  dead today.
- `p-3` (12px) and `p-5` (20px) remain reachable from Tailwind's default spacing scale
  (I only *added* to `spacing` via `extend`). They are 8pt violations, not breakages —
  run the §B.2 audit #3 to find and fix them.

## B.3 `student-web` — recommendation: **do NOT introduce Tailwind**

**Verdict: stay on plain CSS + the shared custom-property layer.**

Justification:

1. **Migration cost is the whole app.** 4,854 lines of `index.css` plus 5 very large
   page components (`LessonPlayer.tsx` 108 KB, `LoginRegister.tsx` 97 KB, `Home.tsx`,
   `CourseDetails.tsx`, `LandingPage.tsx`) are written against semantic CSS class names
   (`.premium-course-card`, `.mobile-bottom-nav`, `.segmented-tab-button`,
   `.taped-note-card`, `.glassy-profile-card`). Porting them is a rewrite, not a refactor,
   and it competes with the Fusha feature work for the same calendar.
2. **Tailwind buys nothing that the token layer doesn't already give.** RTL logical
   utilities are only half the value; the other half — a closed palette, 8pt spacing,
   fixed radii, brand easing — is already enforced by `--variables`. Tailwind's real
   benefit is *preventing* arbitrary values, and we get that from CSS vars + review.
3. **Zero build risk.** Vite + plain CSS has no PostCSS/plugin/version coupling.
   Adding Tailwind means adding `postcss.config.js`, `tailwind.config.js`, and a
   content-glob that silently drops classes when files move.
4. **Two apps, one token file.** `brand/fusha-tokens.css` is imported by both. The
   dashboard gets Tailwind ergonomics; student-web gets the same values with zero
   duplication. Adding Tailwind to student-web would create a *second* vocabulary for
   the same tokens.

**Instead, do this:**

1. `src/styles/tokens.css` → `@import '../../../brand/fusha-tokens.css';` (first import in `main.tsx`).
2. Split `src/index.css` (4,854 lines) into:
   ```
   src/styles/tokens.css     — @import of brand tokens (no edits here)
   src/styles/base.css       — reset, html/body, typography, scrollbar, focus, a11y
   src/styles/utilities.css  — the 8pt utility layer below (~60 lines)
   src/styles/components.css — the .premium-* / .taped-* / .login-* / .mobile-* blocks
   ```
   Concatenate them in `main.tsx` in that order. Do not attempt to rewrite them yet.
3. Add a **closed 8pt utility layer** in `utilities.css`. It is deliberately tiny and
   contains **no 12/20/28/36/44px values**, so it is impossible to violate G3 with it:

```css
/* ── 8pt utility layer (student-web) ─────────────────────────────── */
.u-row { display: flex; flex-direction: row; align-items: center; }
.u-col { display: flex; flex-direction: column; }
.u-wrap { flex-wrap: wrap; }
.u-fill { flex: 1 1 auto; min-width: 0; }

.u-gap-1 { gap: var(--spacing-xs); }   /* 4  micro only */
.u-gap-2 { gap: var(--spacing-sm); }   /* 8  */
.u-gap-3 { gap: var(--spacing-md); }   /* 16 */
.u-gap-4 { gap: var(--spacing-lg); }   /* 24 */
.u-gap-5 { gap: var(--spacing-xl); }   /* 32 */
.u-gap-6 { gap: var(--spacing-xxl); }  /* 48 */

.u-p-2 { padding: var(--spacing-sm); }
.u-p-3 { padding: var(--spacing-md); }
.u-p-4 { padding: var(--spacing-lg); }
.u-p-5 { padding: var(--spacing-xl); }
.u-p-6 { padding: var(--spacing-xxl); }
.u-px-3 { padding-inline: var(--spacing-md); }
.u-px-4 { padding-inline: var(--spacing-lg); }
.u-py-2 { padding-block: var(--spacing-sm); }
.u-py-3 { padding-block: var(--spacing-md); }
.u-mt-4 { margin-block-start: var(--spacing-lg); }
.u-mb-4 { margin-block-end: var(--spacing-lg); }
.u-stack-3 > * + * { margin-block-start: var(--spacing-md); }
.u-stack-4 > * + * { margin-block-start: var(--spacing-lg); }
.u-stack-5 > * + * { margin-block-start: var(--spacing-xl); }
.u-stack-6 > * + * { margin-block-start: var(--spacing-xxl); }

.u-grid { display: grid; gap: var(--spacing-lg); }
.u-auto-2 { grid-template-columns: repeat(2, minmax(0, 1fr)); }
.u-auto-3 { grid-template-columns: repeat(3, minmax(0, 1fr)); }
.u-auto-4 { grid-template-columns: repeat(4, minmax(0, 1fr)); }
.u-auto-fit { grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); }
@media (max-width: 1024px) { .u-auto-4, .u-auto-3 { grid-template-columns: repeat(2, minmax(0,1fr)); } }
@media (max-width: 640px)  { .u-auto-4, .u-auto-3, .u-auto-2 { grid-template-columns: 1fr; } }

.u-r-sm   { border-radius: var(--radius-sm); }
.u-r-md   { border-radius: var(--radius-md); }
.u-r-lg   { border-radius: var(--radius-lg); }
.u-r-xl   { border-radius: var(--radius-xl); }
.u-r-full { border-radius: var(--radius-full); }

.u-surface       { background: var(--bg-surface); border: 1px solid var(--border-subtle); }
.u-surface-subtle{ background: var(--bg-surface-subtle); }
.u-raised        { box-shadow: var(--shadow-md); }
.u-elevated      { box-shadow: var(--shadow-lg); }

.u-t-display { font: var(--fw-display) var(--text-display) / var(--lh-display) var(--font-ui); }
.u-t-h1      { font: var(--fw-h1)      var(--text-h1)      / var(--lh-h1)      var(--font-ui); }
.u-t-h2      { font: var(--fw-h2)      var(--text-h2)      / var(--lh-h2)      var(--font-ui); }
.u-t-h3      { font: var(--fw-h3)      var(--text-h3)      / var(--lh-h3)      var(--font-ui); }
.u-t-h4      { font: var(--fw-h4)      var(--text-h4)      / var(--lh-h4)      var(--font-ui); }
.u-t-body-lg { font: var(--fw-body-lg) var(--text-body-lg) / var(--lh-body-lg) var(--font-ui); }
.u-t-body    { font: var(--fw-body)    var(--text-body)    / var(--lh-body)    var(--font-ui); }
.u-t-caption { font: var(--fw-caption) var(--text-caption) / var(--lh-caption) var(--font-ui); }
.u-t-poetry  { font: var(--fw-poetry)  var(--text-poetry)  / var(--lh-poetry)  var(--font-poetry); }

.u-focus { outline: none; }
.u-focus:focus-visible { box-shadow: var(--ring-on-light); }
.u-focus-dark:focus-visible { box-shadow: var(--ring-on-brand); }
```

New components should be authored with these utilities. Existing `.premium-*`
classes stay until each screen is touched.

---

# C. Component specs (8-state matrix)

Every interactive component implements **all 8 states**: `default · hover · focus-visible ·
active · loading · empty · success · error`. Where a state is structurally impossible
(e.g. a progress bar has no "empty"), it is marked **N/A** with a defined fallback.

Legend for CSS-var usage: `var(--x)` = student-web; `bg-x` = Tailwind (dashboard).

---

## C.1 Primary CTA button

**Anatomy:** label (Cairo 600, 16px) + optional leading icon 20px + optional trailing icon.

**Geometry:** `min-height: 48px` (`h-12`, `min-h-touch`) · `padding-inline: 24px` ·
`radius: 6px` (`rounded-sm`) · `gap: 8px` · no border (border-transparent 1px to prevent
layout shift on state change).

| State | Spec |
|---|---|
| **default** | `bg: var(--brand-primary)` · `color: var(--text-inverse)` · `box-shadow: var(--shadow-sm)` · `transition: background-color, box-shadow, transform var(--dur-micro) var(--ease-standard)` |
| **hover** | `bg: var(--brand-primary-hover)` · `transform: translateY(-2px)` · `box-shadow: var(--shadow-md)` · 200ms |
| **focus-visible** | `box-shadow: var(--ring-on-brand)` (2px canvas gap + 2px gold) · `outline: none` |
| **active** | `bg: var(--brand-primary-active)` · `transform: scale(0.98)` · shadow → `var(--shadow-sm)` · **no** translateY |
| **loading** | keep exact geometry; label → `opacity: 0`; center a 20×20 spinner `border: 2px solid rgba(255,255,255,.25); border-top-color: var(--brand-accent)`; `animation: fusha-spin 700ms linear infinite`; `aria-busy="true"`; `pointer-events: none` |
| **empty** | N/A → renders as **disabled** (see below) |
| **success** | `bg: var(--status-success-fg)` · label → "تم" + check icon with `animation: fusha-check-pop 200ms`; revert after 2000ms or on navigation |
| **error** | `bg: var(--brand-primary)` unchanged · `animation: fusha-shake 300ms var(--ease-standard)` · move the message to an adjacent `--status-error-fg` text node (never change the button fill to red — see §F J-9) |
| **disabled** | `bg: var(--bg-surface-subtle)` · `color: var(--text-disabled)` · `cursor: not-allowed` · `box-shadow: none` · `aria-disabled="true"` (keep focusable so SR can reach it) |

```html
<!-- dashboard -->
<button class="inline-flex items-center justify-center gap-2 min-h-touch px-6
               rounded-sm bg-brand text-ink-inverse text-body-lg font-semibold
               shadow-sm transition-all duration-200 ease-fusha
               hover:bg-brand-hover hover:-translate-y-0.5 hover:shadow-md
               active:bg-brand-active active:scale-[0.98]
               focus-visible:outline-none focus-visible:shadow-ring-brand
               disabled:bg-surface-subtle disabled:text-ink-muted/[.55] disabled:shadow-none">
  ابدأ المحاضرة
  <span class="material-symbols-outlined text-[20px]">play_arrow</span>
</button>
```

> RTL note: the icon is *visually* on the left (after the label) in RTL flow. Use
> `flex-row` and let `dir=rtl` reorder — do **not** add `flex-row-reverse`.

---

## C.2 Secondary / ghost button

**Geometry:** identical to C.1 (48px, radius 6px, px 24px).

| State | Secondary (outlined) | Ghost (text-only) |
|---|---|---|
| default | `bg: transparent` · `border: 1px solid var(--border-strong)` · `color: var(--text-primary)` | `bg: transparent` · `border: 1px solid transparent` · `color: var(--brand-secondary)` |
| hover | `border-color: var(--brand-primary)` · `bg: var(--brand-primary-subtle)` | `bg: var(--bg-surface-subtle)` |
| focus-visible | `box-shadow: var(--ring-on-light)` | `box-shadow: var(--ring-on-light)` |
| active | `bg: var(--brand-secondary-subtle)` · `scale(0.98)` | `bg: var(--bg-surface-subtle)` · `scale(0.98)` |
| loading | 20px spinner in `--brand-primary` + `border-top-color: transparent`; label `opacity:.5` | same |
| empty | N/A → disabled | N/A → disabled |
| success | `border-color: var(--status-success-fg)` · `color: var(--status-success-fg)` · `bg: var(--status-success-bg)` | `color: var(--status-success-fg)` |
| error | `border-color: var(--status-error-fg)` · `color: var(--status-error-fg)` + shake 300ms; message below in `--status-error-fg` 12px | same |
| disabled | `border-color: var(--border-disabled)` · `color: var(--text-disabled)` | `color: var(--text-disabled)` |

**Danger button** (delete account, drop course): same geometry,
`bg: var(--status-error-bg)`, `color: var(--status-error-fg)`,
`border: 1px solid var(--status-error-bd)`; hover → `bg: var(--status-error-bd)/40`.
Never a filled `#A82315` block (the brand forbids large red areas).

---

## C.3 Input field & textarea

**Anatomy:** label (14px/600, `--text-primary`) → control → helper/validation row (12px).

**Geometry:** `min-height: 48px` (`h-12`) · `padding-inline: 16px` · `radius: 12px`
(`rounded-md`) · `font-size: 16px` (never <16px on iOS — prevents zoom) ·
label↔control `8px` · control↔helper `4px`. Textarea: `min-height: 96px`, auto-grow to
`max-height: 320px`, `padding-block: 12px` (**the only permitted 12px**, because it pairs
with a 16px+26px line box to total 48px+).

| State | Spec |
|---|---|
| default | `bg: var(--bg-surface)` · `border: 1px solid var(--border-subtle)` · `color: var(--text-primary)` · `placeholder: var(--text-placeholder)` |
| hover | `border-color: var(--border-strong)` |
| focus-visible | `border-color: var(--brand-primary)` (1px→2px via `box-shadow: inset 0 0 0 1px var(--brand-primary)` to avoid reflow) · outer `box-shadow: var(--ring-on-light)` · label `color: var(--brand-primary)` |
| active | same as focus (typing state); caret `var(--brand-primary)` |
| loading | `pointer-events: none` · `opacity: .7` · a 2px indeterminate bar pinned to the bottom edge, `background: linear-gradient(90deg, transparent, var(--brand-accent), transparent)`, `animation: fusha-shimmer 1.2s linear infinite` |
| empty | on blur with no content and `required`: `border-color: var(--border-strong)` + trailing 16px info icon in `--text-muted`; **no error colour until submit** (`:user-invalid` only) |
| success | `border-color: var(--status-success-fg)` · trailing 20px check icon `var(--status-success-fg)` · helper text `var(--status-success-fg)` |
| error | `border-color: var(--status-error-fg)` · `box-shadow: var(--ring-error)` on focus · helper text `var(--status-error-fg)` 12px + `animation: fusha-shake 300ms` on submit attempt · `aria-invalid="true"` · `aria-describedby` → error node |
| disabled | `bg: var(--bg-surface-subtle)` · `color: var(--text-disabled)` · `border-color: var(--border-disabled)` |

**Search input** (used in المعجم and course search): same, plus a leading
`search` icon 20px in `--text-muted` at `inset-inline-start: 16px`, and a trailing
clear (×) 48×48 hit area shown only when non-empty.

---

## C.4 Quiz option card

### C.4.1 Validation of the reference implementation (`AI_AGENT_INSTRUCTIONS.md` §3.1)

The reference is **directionally correct but not shippable**. Findings:

| # | Issue | Severity | Fix |
|---|---|---|---|
| 1 | `rounded-[16px]` — master spec §4.1 assigns `radius-lg: 20px` to *"كروت الأسئلة"* | **Critical** | `rounded-lg` (20px) |
| 2 | `text-right` — physical property; wrong in RTL | **Critical** | `text-start` |
| 3 | `disabled={isAnswered}` removes the button from the a11y tree and from tab order | **Critical** | use `aria-disabled="true"` + no-op `onClick`; keep focusable |
| 4 | Hardcoded hex `border-[#E2E6E3]`, `bg-[#1E6B37]`, `bg-[#EAF6EE]`, `text-[#163134]`, `ring-[#163134]/10` | **Critical** | semantic tokens (`--border-subtle`, `--status-success-bd`, …) |
| 5 | Selected background `#F0F4F2` is **not in the palette** | **Major** | `--brand-primary-subtle` (`#EEF7F5`) |
| 6 | Answered-correct uses `border-[#1E6B37]` + `bg-[#EAF6EE]` — duplicated; spec says border `#1E6B37`, bg `#EAF6EE`, so it should use `--status-success-bd`? No: use `bd: --status-success-fg`, `bg: --status-success-bg` per spec §5 | **Major** | `border-success bg-success-bg` |
| 7 | No `min-h` → collapses below 48px with short options | **Major** | `min-h-touch` (48px) |
| 8 | Only 4 of 8 states (default / selected / correct / wrong). Missing `focus-visible`, `active`, `loading`, `empty` | **Major** | table below |
| 9 | `gap-4` (16px) and `p-4` (16px) — **correct**, 8pt ✓ | — | keep |
| 10 | Letter badge `w-9 h-9` (36px) with `rounded-lg` — should be `rounded-md` (12px) | Minor | `rounded-md` |
| 11 | No `role`/`aria` semantics | Minor | wrap in `role="radiogroup"`, each option `role="radio" aria-checked` |
| 12 | `transition-all` — animates everything, janky | Minor | `transition-[background-color,border-color,box-shadow,transform]` |

### C.4.2 Final spec

**Geometry:** full width · `min-height: 48px` · `padding: 16px` · `radius: 20px` ·
`border: 2px` **always** (prevents 1px reflow on select) · gap between badge and text
`16px` · option text `font-body-lg` (16px/26px, weight 500).

**Badge:** 36×36 · `radius: 12px` · centered letter (أ / ب / ج / د) · Cairo 700 · 14px.

**Stack:** `<div role="radiogroup" aria-labelledby="q1" class="u-stack-3">` wrapping
4 × `<button role="radio" aria-checked>`.

**State precedence — resolve top-down, first match wins.** Once grading reveals the
answer, a student must be able to distinguish *"I picked this and it was wrong"* from
*"this is the correct answer"*, so the wrong-pick check must run **before** the plain
`isSelected` check. Never let `isSelected` alone paint a graded option — that is what
masked the student's own answer.

| # | Condition | Result |
|---|---|---|
| 1 | `isCorrect` | **success** (the right answer). If it is also `isSelected`, it is the student's own correct pick; otherwise add the `--status-success-fg` caption "الإجابة الصحيحة" |
| 2 | `!isCorrect && isSelected` | **error** — the student's own wrong pick (`fusha-shake 300ms`, error border/bg, badge glyph → close) |
| 3 | `isSelected` | **selected** (pre-submit only; unreachable once graded) |
| 4 | default | **default**. After grading, non-correct non-selected options render dimmed (`opacity: .6`, `--text-muted`) per the table below |

```ts
// Correct order — do NOT reorder: `isSelected` must be tested under `!isCorrect`.
function optionState(o: { isCorrect: boolean; isSelected: boolean; graded: boolean }) {
  if (o.isCorrect) return 'success';
  if (o.isSelected) return o.graded ? 'error' : 'selected';
  return o.graded ? 'dimmed' : 'default';
}
```

| State | Card | Badge | Text | Motion |
|---|---|---|---|---|
| **default** | `bg-surface` · `border: 2px solid var(--border-subtle)` · `shadow-sm` | `bg: var(--bg-surface-subtle)` · `color: var(--text-primary)` | `--text-primary` | — |
| **hover** (pointer: fine only) | `border-color: var(--brand-sage)` · `bg: var(--bg-canvas)` · `shadow-md` | unchanged | unchanged | 200ms `ease-fusha` |
| **focus-visible** | `box-shadow: var(--ring-on-light)` · `outline: none` | — | — | — |
| **active / pressed** | `transform: scale(0.99)` · `bg: var(--bg-surface-subtle)` | — | — | 150ms |
| **selected** (pre-submit) | `border-color: var(--brand-primary)` (2px) · `bg: var(--brand-primary-subtle)` · `shadow-sm` | `bg: var(--brand-primary)` · `color: var(--text-inverse)` | `--text-primary` | 200ms |
| **loading** (awaiting server check) | `bg: var(--bg-surface)` · `border-subtle` · content replaced by shimmer bar (see C.7) · `pointer-events: none` | shimmer circle 36px | none | 1.6s loop |
| **empty** | N/A at card level → the *question area* shows an empty state: 64px icon in `--text-muted`, headline `h3`, body `body`, and a ghost CTA "تصفّح بنك الأسئلة" | | | |
| **success** (correct) | `border-color: var(--status-success-fg)` · `bg: var(--status-success-bg)` | `bg: var(--status-success-fg)` · `color: var(--text-inverse)` · glyph → check via `fusha-check-pop 200ms` | `--status-success-fg` | 250ms |
| **success** (correct but not chosen) | same as above but `opacity: .85` + a `--status-success-fg` caption "الإجابة الصحيحة" | | | |
| **error** (chosen and wrong) | `border-color: var(--status-error-fg)` · `bg: var(--status-error-bg)` · `animation: fusha-shake 300ms` | `bg: var(--status-error-fg)` · `color: var(--text-inverse)` · glyph → close | `--status-error-fg` | 300ms |
| **error** (not chosen, not correct) | `opacity: .6` · `border-subtle` · `bg-surface` | muted | `--text-muted` | — |
| **answered / locked** | `cursor: default` · `aria-disabled="true"` · still focusable · still announces state | | | — |

```html
<div role="radiogroup" aria-labelledby="q-1" class="flex flex-col gap-4">
  <button role="radio" aria-checked="false"
    class="group flex items-center gap-4 w-full min-h-touch p-4 rounded-lg
           border-2 border-line bg-surface text-start shadow-sm
           transition-[background-color,border-color,box-shadow,transform]
           duration-200 ease-fusha
           hover:border-sage hover:bg-canvas hover:shadow-md
           active:scale-[0.99]
           focus-visible:outline-none focus-visible:shadow-ring-light
           aria-checked:border-brand aria-checked:bg-brand-subtle">
    <span class="grid place-items-center w-9 h-9 shrink-0 rounded-md
                 bg-surface-subtle text-ink font-bold text-sm
                 group-aria-checked:bg-brand group-aria-checked:text-ink-inverse">أ</span>
    <span class="flex-1 text-body-lg font-medium text-ink leading-relaxed">…النص…</span>
  </button>
  …
</div>
```

> Use `aria-checked:` variants (Tailwind 3.2+) so state lives in ARIA, not in class
> soup. For pre-3.2, keep the conditional `stateClasses` pattern but swap hex → tokens.

---

## C.5 Course / lesson card

**Anatomy:**
```
┌───────────────────────────────────────┐
│ [cover 16:9, radius-lg, play overlay] │
│  badge (level)              ·· 12px   │  ← absolutely positioned, inset-inline-start 16 / top 16
│  h3 title (18–20px, 2 lines max)      │
│  caption meta: 12 محاضرة · 4.5 ساعة   │
│  ─────────────────────────────────    │  ← divider, border-subtle
│  [progress bar]  60%                  │
│  [gold CTA / ghost CTA]               │
└───────────────────────────────────────┘
```

**Geometry:** `radius: 20px` · `padding: 16px` · `gap: 16px` between blocks ·
cover aspect `16/9` (`aspect-video`) · `background: var(--bg-surface)` ·
`border: 1px solid var(--border-subtle)`.

| State | Spec |
|---|---|
| default | `shadow-sm` · border `--border-subtle` |
| hover | `translateY(-4px)` · `shadow-lg` · border `--brand-sage` · cover `scale(1.03)` (150ms) · the gold play overlay `opacity: 0 → 1` |
| focus-visible | whole card is a link → `box-shadow: var(--ring-on-light)` |
| active | `translateY(-1px)` · `shadow-md` |
| loading | skeleton variant (C.7) with identical footprint: cover block + 2 text bars + 1 bar |
| empty | grid-level empty state, not card-level: 96px illustration zone, `h3` "لا توجد كورسات بعد", `body` "سيتم إضافة محتوى جديد قريباً", ghost CTA |
| success | "مكتمل" state: `border-color: var(--status-success-bd)` · `bg: var(--status-success-bg)` · corner ribbon badge in `--status-success-fg` · progress 100% |
| error | "فشل تحميل الغلاف": cover area → `bg: var(--bg-surface-sunken)` + centered 24px `broken_image` icon in `--text-muted` + caption in `--text-muted`. Card remains usable. |

**Level badge** (on cover): `radius-full` · `px: 8px` · `py: 4px` · 12px/700 ·
`bg: var(--brand-accent)` · `color: var(--text-on-accent)` for "الصف الثالث الثانوي";
`bg: var(--brand-sage)` / `color: var(--text-inverse)` for lower levels.

---

## C.6 Progress bar

**Geometry:** track `height: 8px` · `radius-full` · `background: var(--bg-surface-sunken)`;
fill `background: var(--brand-sage)` (course progress) or `var(--brand-accent)`
(exam completion) · `transition: inline-size var(--dur-expand) var(--ease-standard)`.
Label row above: label `caption` `--text-secondary` + value `caption/700` `--text-primary`,
separated by `justify-between`, `margin-block-end: 8px`.

| State | Spec |
|---|---|
| default | fill width = `percent`; `aria-valuenow` |
| hover | N/A (non-interactive) — but if inside a clickable card, inherit card hover |
| focus-visible | N/A unless it's a seekable scrubber → then `ring-on-light`, 48px hit area via invisible padding |
| active | N/A |
| loading | indeterminate: fill replaced by `width: 40%` bar animating `inset-inline-start` `-40% → 100%` over 1.2s linear, infinite |
| empty | `percent = 0`: fill hidden, track stays; label reads "لم تبدأ بعد" in `--text-muted` |
| success | `percent ≥ 100`: fill → `var(--status-success-fg)`; a 16px check appears in the label row |
| error | fill → `var(--status-error-fg)` at current percent + label "تعذّر تحديث التقدم" in `--status-error-fg` |

Markup: `<div role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="62"
aria-label="نسبة إتمام المنهج">`.
`width` in RTL: use logical `inline-size` — the fill must grow from the **inline-start
(right)** edge. With `dir=rtl` and a plain `width: 62%` on a block child inside
`overflow:hidden`, the fill naturally starts at the right. Verify visually.

---

## C.7 Skeleton loader (shimmer)

**Geometry:** mirrors the real component's exact box model (identical heights, radii,
paddings) so there is zero layout shift on swap.

```css
.skeleton {
  background-color: var(--bg-surface-subtle);
  background-image: linear-gradient(
    90deg,
    transparent 0%,
    color-mix(in srgb, var(--brand-accent) 12%, transparent) 50%,
    transparent 100%
  );
  background-size: 400% 100%;
  background-repeat: no-repeat;
  border-radius: var(--radius-md);
  animation: fusha-shimmer 1.6s linear infinite;
}
@media (prefers-reduced-motion: reduce) {
  .skeleton { animation: none; background-image: none; opacity: .6; }
}
```

The sheen uses **gold at 12%**, not grey — this is the spec's "وميض مستوحى من لون الشعار"
requirement (`AI_AGENT_INSTRUCTIONS.md` §4 checklist).

| State | Spec |
|---|---|
| default | shimmer as above |
| hover / focus-visible / active | N/A — `pointer-events: none`, `aria-hidden="true"` |
| loading | this IS the loading state |
| empty | N/A → replaced by the empty state, never a permanent skeleton (>10s → switch to empty/error) |
| success | fade out 200ms (`fusha-fade-in` reversed) and swap in real content |
| error | skeleton replaced by an inline error row: `bg: var(--status-error-bg)`, `border: 1px solid var(--status-error-bd)`, `radius-md`, `padding: 16px`, icon + message in `--status-error-fg`, and a ghost retry button |

**Video-player skeleton** (spec §7.3): instead of a black rectangle, render
`aspect-video` · `bg: var(--bg-inverse)` · centered Kufic فُصحى wordmark at
`opacity: .35` in `--brand-accent` · `animation: fusha-pulse-soft 1.8s ease-in-out infinite`
plus a 24px gold spinner below.

---

## C.8 Badge / chip

**Geometry:** `radius-full` · `height: 24px` · `padding-inline: 8px` · `gap: 4px` ·
font `caption` (12px) weight 600 · optional 12px leading icon.
**Variant — status pill:** `radius-sm` (6px), `height: 24px`, `padding-inline: 8px`.

| Variant | bg | fg | border |
|---|---|---|---|
| neutral | `--bg-surface-subtle` | `--text-secondary` | none |
| brand | `--brand-primary-subtle` | `--brand-primary` | none |
| accent (achievement / stars) | `--brand-accent-subtle` | `--text-on-accent` | none |
| sage (in-progress) | `--brand-sage-subtle` | `--brand-sage` | none |
| success | `--status-success-bg` | `--status-success-fg` | `1px solid var(--status-success-bd)` |
| warning (e.g. "امتحانك بعد يومين") | `--status-warning-bg` | `--status-warning-fg` | `1px solid var(--status-warning-bd)` |
| error | `--status-error-bg` | `--status-error-fg` | `1px solid var(--status-error-bd)` |
| info | `--status-info-bg` | `--status-info-fg` | `1px solid var(--status-info-bd)` |
| offline-saved (spec §7.3) | `--brand-primary-subtle` | `--brand-primary` | `1px dashed var(--brand-accent)` — text: «تم حفظ إجابتك بأمان محلياً وستُرفع تلقائياً فور عودة الاتصال» |

| State | Spec |
|---|---|
| default | as table |
| hover | only for **filter chips** (interactive): `bg: var(--bg-surface-sunken)` |
| focus-visible | `box-shadow: var(--ring-on-light)` (interactive chips only) |
| active/pressed | `scale(0.96)`, 150ms |
| selected (filter) | `bg: var(--brand-primary)` · `color: var(--text-inverse)` · icon → check |
| loading | chip becomes a 64×24 `.skeleton` |
| empty | not rendered at all (never render a zero-count badge) |
| success / error | same colours as table; for async chips (e.g. "حفظ") swap variant for 2s then revert |

---

## C.9 Toast

**Placement:** on `<1025px`, `bottom: calc(var(--bottom-nav-h) + 16px)`;
on `≥1025px`, `inset-block-end: 24px; inset-inline-start: 24px` (bottom-left in RTL —
away from the sidebar). Stack `gap: 8px`, newest closest to the edge.

**Geometry:** `min-height: 48px` · `max-width: 420px` · `padding: 16px` ·
`radius: 12px` (`--radius-md`) · `shadow-floating` · `gap: 12px`
(icon↔content) · `z-index: var(--z-toast)`.

**Anatomy:** 20px leading icon + message (14px/22px) + optional 48×48 ghost action + 48×48 dismiss.

| State | Spec |
|---|---|
| default | `bg: var(--bg-surface-raised)` · `border: 1px solid var(--border-subtle)` · `color: var(--text-primary)` |
| hover | `shadow-lg`; the dismiss button gets `bg: var(--bg-surface-subtle)` |
| focus-visible | `box-shadow: var(--ring-on-light)`; when the toast has an action, autofocus the action |
| active | dismiss `scale(0.94)` |
| loading | leading icon → 20px spinner in `--brand-secondary`; action disabled |
| empty | N/A |
| success | `bg: var(--status-success-bg)` · `border: var(--status-success-bd)` · icon `check_circle` `--status-success-fg` · title `--status-success-fg` |
| error | `bg: var(--status-error-bg)` · `border: var(--status-error-bd)` · icon `error` `--status-error-fg` · **persistent** (no auto-dismiss) · `role="alert"` |
| warning / info | same pattern with the warning / info triple |

**Motion:** enter `fusha-slide-up 250ms var(--ease-standard)`; exit
`opacity → 0, translateY(8px)` `200ms var(--ease-exit)`.
**Duration:** success/info 4000ms · warning 6000ms · error ∞ (dismiss-only).
**A11y:** container `role="status" aria-live="polite"` for success/info;
`role="alert" aria-live="assertive"` for error. Pause auto-dismiss on hover/focus.

---

## C.10 Navigation

### C.10.1 Top header (all viewports)

**Geometry:** `height: 72px` (`--header-h`) · `padding-inline: var(--content-pad)` ·
`z-index: var(--z-header)` · `border-block-end: 1px solid var(--border-subtle)`.

**Public landing:** transparent over the hero (`background: transparent`,
`color: var(--text-inverse)`), becomes `bg: var(--bg-surface)` +
`shadow-sm` + `border-subtle` after 24px of scroll (transition 250ms).
**App (dashboard/student):** always `bg: var(--bg-surface)`.

**Layout (RTL):** `[logo + wordmark]` at inline-start → spacer →
`[nav links]` → `[dark-mode toggle 48×48]` → `[notifications 48×48]` →
`[avatar 40×40 + name]`. Every icon control is a 48×48 hit area.

| Element | Token |
|---|---|
| wordmark | Kufic "فُصحى" + gold square; `color: var(--text-primary)` (on light) / `var(--text-inverse)` (on hero) |
| nav link | `body` 14px/600 · `color: var(--text-secondary)` · `padding-block: 8px` · `border-block-end: 2px solid transparent` |
| nav link hover | `color: var(--text-primary)` · `border-block-end-color: var(--brand-sage)` |
| nav link active | `color: var(--brand-primary)` · `border-block-end-color: var(--brand-accent)` |
| focus-visible | `box-shadow: var(--ring-on-light)` (or `--ring-on-brand` when over the hero) |
| notification dot | 8px `bg: var(--brand-accent)` with `1px solid var(--bg-surface)` ring, positioned at the icon's top-inline-start |
| mobile menu | `<1025px`: hamburger → full-width sheet from the block-start, `radius-bl/br: 20px`… use `rounded-b-[20px]` (bottom corners), `bg: var(--bg-surface)`, `shadow-floating`, `animation: fusha-slide-up 300ms` |

### C.10.2 Sidebar (`>1024px`, dashboard + student app)

Per spec §9: **fixed, dark teal.**

| Token | Light | Dark |
|---|---|---|
| container bg | `--bg-sidebar` `#163134` | `#0E1F21` |
| width | `264px` (`--sidebar-w`) | same |
| collapsed width | `88px` | same |
| text | `--text-sidebar` `#D8EBE7` | `#D8EBE7` |
| text muted | `--text-sidebar-muted` | `#829896` |
| hover row | `--bg-sidebar-hover` `#1E4347` | `#163134` |
| active row | `--bg-sidebar-active` `#0B1A1B` | `#1E4347` |
| active indicator | `--sidebar-active-indicator` (`#E8B54A`) | `#F0C76C` |

**Row geometry:** `height: 48px` · `radius: 12px` · `padding-inline: 16px` ·
`gap: 16px` (icon 20px ↔ label 14px/600) · rows separated by `4px`.

**Active indicator:** a 3px bar at the **inline-start** edge (i.e. the **right** edge in
RTL), `height: 24px`, `radius-full`, `background: var(--sidebar-active-indicator)`.
Implement with `border-inline-start: 3px solid` or a pseudo-element with
`inset-inline-start: 0`. **Never `border-left`.**

| State | Spec |
|---|---|
| default | `bg: transparent` · `color: var(--text-sidebar-muted)` · icon `opacity: .8` |
| hover | `bg: var(--bg-sidebar-hover)` · `color: var(--text-sidebar)` |
| focus-visible | `box-shadow: var(--ring-on-brand)` (gold ring on dark) |
| active/pressed | `bg: var(--bg-sidebar-active)` |
| loading | row label → 96×12 `.skeleton` on `--bg-sidebar-hover` |
| empty | section with no items collapses entirely (no "لا يوجد" text in the rail) |
| success | N/A in nav; use for "تم الحفظ" badge on a row: 16px gold dot |
| error | item marked with a 8px `--status-error-bd` dot at the inline-end + `aria-describedby` |

**Footer of the rail:** teacher identity block — 40×40 avatar
(`teacher_portrait.webp`) + "أ. أشرف سليم" + "اللغة العربية · الثانوية العامة",
separated by a `border-subtle` hairline with `24px` padding.

### C.10.3 Bottom navigation (`<640px`)

Spec §9 mandates it. `height: 64px` + `env(safe-area-inset-bottom)` ·
`bg: var(--bg-surface)` · `border-block-start: 1px solid var(--border-subtle)` ·
`shadow-[0_-4px_12px_rgba(22,49,52,0.06)]` · 4–5 items · each item a 48×48 target with a
16px icon and a 12px label. Active icon+label → `var(--brand-primary)`;
inactive → `var(--text-muted)`. **No gold fill** (gold is reserved for actions).

---

# D. Page-level layout specs

## D.0 Shared shell

```
┌──────────────────────────────────────────────────────────────┐
│ header (72px, sticky, z-20)                                  │
├────────────┬─────────────────────────────────────────────────┤
│  sidebar   │  main                                           │
│  264px     │  max-w-1280  padding: var(--content-pad)        │
│  (≥1025)   │  section gap: 48px (mobile 32px)                │
├────────────┴─────────────────────────────────────────────────┤
│ bottom nav 64px (<640px only)                                │
└──────────────────────────────────────────────────────────────┘
```

Vertical rhythm: section↔section `48px` mobile `32px`;
block↔block inside a section `24px`; card internal padding `24px` (large) / `16px` (compact).

---

## D.1 Public landing page

`student-web` route `/` (`LandingPage.tsx` already exists but is chemistry-branded —
re-skin, don't rewrite). **`index.html` meta/title is still «كيميا | منصة الهضبة» — see §G.**

Section stack, **in order**:

| # | Section | Layout | Tokens |
|---|---|---|---|
| 1 | **Header** — sticky, transparent-over-hero → solid on scroll | 72px, `justify-between` | `--text-inverse` over hero; `--bg-surface` + `--shadow-sm` when scrolled |
| 2 | **Hero** — `teacher_hero.webp` | 2-col grid `≥1025px` (`1fr 1fr`, gap 48px), 1-col below. **RTL: copy on the right (`order-first` on ≥lg), portrait on the left.** | bg `--bg-inverse` (`#163134`) full-bleed with a geometric Kufic pattern at `opacity: .08`; eyebrow chip (gold-100 bg / `--text-on-accent`); `h1` = `--text-display` 40/52 w800 in `--text-inverse`; sub `body-lg` in `#D8EBE7`; primary CTA = **gold** (`--brand-accent` bg, `--text-on-accent` text, 52px tall) "ابدأ مجاناً"; secondary = ghost on dark (`border: 1px solid #3D6265`, `color: #D8EBE7`) "شاهد نموذج محاضرة" |
| 3 | **Trust bar** — 3 stats | grid 3, gap 32, `padding-block: 32` | `--bg-surface`, `border-subtle` top+bottom; numbers `h1` 800 in `--brand-primary`; labels `caption` `--text-muted`. Numbers: **12,000+ طالب · 320 محاضرة · 98% نسبة النجاح** |
| 4 | **Value props** — "لماذا فُصحى؟" 4 cards | `u-auto-4` → 2 → 1; card `padding: 24`, `radius-lg`, `shadow-sm` | icon well 48×48 `radius-md` with `--brand-sage-subtle` bg + `--brand-sage` icon (repeat cycle sage → gold → brass → olive); `h3` title; `body` copy in `--text-secondary` |
| 5 | **المستويات / الكورسات** — level listing | `u-auto-3`, gap 24 | Section head: `h2` + `body-lg` subtitle, `margin-block-end: 32`. Cards = C.5 with level badge. Each card: "الصف الأول الثانوي" · "الصف الثاني" · "الصف الثالث" |
| 6 | **نموذج محاضرة (sample lesson)** | 2-col: video preview (`aspect-video`, `radius-lg`, gold play 64×64 `radius-full` with `--shadow-glow-accent`) + a meta list of 4 bullets with 20px `--brand-sage` check icons | bg `--bg-surface-sunken` section (`#E8E5DC`); play button `--brand-accent` + `--text-on-accent` |
| 7 | **منهجية الأستاذ (How it works)** — 3 steps | `u-auto-3`, each step numbered `1/2/3` in a 48×48 `radius-full` `--brand-primary-subtle` well with `--brand-primary` text | connector line `border-subtle` dashed between steps on ≥lg |
| 8 | **الشهادات (testimonials)** | horizontal scroll-snap rail on mobile, `u-auto-3` on ≥lg; card `padding: 24`, `radius-lg`, `shadow-sm` | 5 gold stars (`--brand-accent`, 16px); quote in `--text-primary` `body-lg`; **if the testimonial quotes a verse/rhetorical rule, use `--font-poetry`**; attribution row: 40px avatar + name `h4` + "ولي أمر طالب" `caption --text-muted` |
| 9 | **الأسعار والخطط (pricing)** — 3 tiers | `u-auto-3`, gap 24; middle tier elevated `translateY(-8px)` on ≥lg | Basic: `--bg-surface`; **Pro (recommended): `--bg-inverse` bg, `--text-inverse` text, `border: 2px solid var(--brand-accent)`, `shadow-lg`, ribbon badge gold**; Premium: `--bg-surface`. Each: price `h1` + `caption` "/شهر", feature list with 16px `--status-success-fg` checks, CTA (primary on the Pro card = gold; ghost elsewhere) |
| 10 | **الأسئلة الشائعة (FAQ)** | accordion, max-width `800px`, `margin-inline: auto`; row `padding: 24`, `border-block-end: 1px solid var(--border-subtle)`; chevron rotates 180° on expand, `--dur-expand` | question `h4` `--text-primary`; answer `body-lg` `--text-secondary`; expanded row `bg: var(--bg-surface-subtle)` |
| 11 | **CTA band + تواصل معنا** | full-bleed `--bg-inverse`, `padding-block: 64` | headline `h2` `--text-inverse`; 3 contact chips: WhatsApp (`--status-success-fg` icon, `#1E6B37`), البريد الإلكتروني, الهاتف — each a 48px-tall pill with `border: 1px solid #3D6265` and `color: #D8EBE7`, hover `bg: #1E4347` |
| 12 | **Footer** | 4-col grid (brand+bio \| المنصة \| الدعم \| تواصل) → 2 → 1; `padding-block: 48` | `bg: var(--bg-inverse)`; text `#D8EBE7` / `--text-sidebar-muted` for links; bottom bar `border-block-start: 1px solid #1E4347`, `padding-block: 24`, `caption` |
| + | **Floating WhatsApp FAB** | `position: fixed`, `inset-block-end: 24px`, `inset-inline-end: 24px`, 56×56 `radius-full`, `shadow-floating`, `z-toast` | `bg: var(--brand-accent)`, icon `--text-on-accent`; `aria-label="تواصل عبر واتساب"` |

**Hero portrait:** use `student-web/src/assets/teacher_hero.webp` in the hero (36 KB) and
`teacher_portrait.webp` (24 KB) for the sidebar/bio avatar. Both are small — **verify
visually that they are actually the Arabic teacher and not the chemistry-era portrait**
before shipping; if wrong, the hero falls back to a typographic composition
(Kufic wordmark + gold rule) with no photo.

---

## D.2 Student dashboard

Route `/home` (`Home.tsx` + `pages/home/`).

```
┌────────────────────────────────────────────────────────────────┐
│ 1. Hero banner (gradient + gold play)          [radius-xl 32px]│
├────────────────────────────────────────────────────────────────┤
│ 2. Quick actions — 4 tiles (grid-4 → 2 → 2)                    │
├───────────────────────────────────┬────────────────────────────┤
│ 3. أكمل المشاهدة (continue)       │ 4. تقدّمك (progress card)  │
│    horizontal rail, 3 visible     │    ring + stats            │
├───────────────────────────────────┴────────────────────────────┤
│ 5. مهام هذا الأسبوع (list)        │ 6. ملاحظات الأستاذ (notes) │
└────────────────────────────────────────────────────────────────┘
```

| # | Block | Spec |
|---|---|---|
| 1 | **Hero banner** | `background: linear-gradient(270deg, #163134 0%, #37695C 100%)` (RTL: gradient runs start→end, so use `to left` in LTR terms = `270deg`) · `radius: 32px` (`--radius-xl`) · `padding: 32` (mobile 24) · `min-height: 200px` · `position: relative; overflow: hidden` · Kufic pattern overlay `opacity: .08` · `shadow-lg`. Contents (RTL): chip "محاضرة الأسبوع" (`bg: --brand-accent`, `color: --text-on-accent`, `radius-full`, `px-2 py-1`, 12px/700) → `h2` lesson title in `--text-inverse` → `caption` meta in `#D8EBE7` → gold CTA: 56×56 circular play button (`radius-full`, `bg: --brand-accent`, icon `--text-on-accent`, `shadow-glow-accent`, hover `scale(1.06)`) beside a text CTA "شرح البلاغة — الدرس الرابع". Bottom-right: "أكملت 62% من المنهج · ترتيبك 14 على الجمهورية" in `caption` on `--brand-accent-subtle` chip |
| 2 | **Quick actions grid** | `u-auto-4` (`≥1025`) / 2 (`640–1024`) / 2 (`<640`); tile `min-height: 96px`, `radius-lg`, `padding: 16`, `bg: --bg-surface`, `border: 1px solid --border-subtle`, `shadow-sm`, hover `translateY(-4px) shadow-md border-sage`, focus `ring-on-light`, active `scale(.98)`. **Icon well 48×48 `radius-md`:** ① محاضرات الأسبوع — `video_library` in `--brand-sage` on `--brand-sage-subtle`; ② بنك الأسئلة — `quiz` in `--brand-accent` on `--brand-accent-subtle`; ③ مُعجم فُصحى — `menu_book` in `--brand-brass` on `--brand-olive-subtle`; ④ منتدى الاستفسارات — `forum` in `--brand-secondary` on `--brand-primary-subtle`. Label `h4`, sub `caption --text-muted` |
| 3 | **أكمل المشاهدة** | Section head `h3` + ghost "عرض الكل" at inline-end. Rail: `overflow-x-auto; scroll-snap-type: x mandatory; gap: 16; padding-block-end: 8`. Card: 160×90 thumb `radius-md` with an 8px progress bar pinned to the bottom + 40×40 gold play overlay; title `body` 2-line clamp; meta `caption`. Skeleton: 3 cards (C.7). Empty: see C.4/empty pattern with CTA "استعرض المحاضرات" |
| 4 | **تقدّمك** | Card `padding: 24`, `radius-lg`. A 120×120 circular progress (SVG, stroke 8, `--brand-sage` on `--bg-surface-sunken`) with the percent in `h2` at center; below: 3 stat rows (`label caption --text-secondary` / `value body-lg 700 --text-primary`) separated by `border-subtle` hairlines: ساعات المذاكرة · المحاضرات المكتملة · متوسط الدرجات |
| 5 | **مهام هذا الأسبوع** | List; row `min-height: 64px`, `padding-block: 8`, `gap: 16`, `border-block-end: 1px solid --border-subtle`. Leading 24px status icon (success sage / warning gold / pending `--text-muted`); title `body-lg`; meta `caption`; trailing ghost CTA. Row hover `bg: --bg-surface-subtle` |
| 6 | **ملاحظات الأستاذ** | Card with `bg: --brand-olive-subtle` (`#EDF1E8`) / dark `#262C1E`, `border: 1px solid --brand-sage-subtle`, `radius-lg`, `padding: 24`. Avatar 40px + "أ. أشرف سليم" + `caption` timestamp. Body in `--text-primary`; rhetorical quotations use `--font-poetry` at `line-height: 1.9` |

Mobile (`<640px`): order becomes 1 → 2 → 4 → 3 → 5 → 6; bottom nav appears;
banner radius drops to `20px` and padding to `24`.

---

## D.3 Exam / question-bank screens

Hard rule (spec §7.1): **one question per screen**. Never a scrolling list of questions.

```
┌────────────────────────────────────────────┐
│ ✕  [████████░░░░░░]  ٧ / ٢٠        ⏱ ١٢:٣٤ │  ← header row, 48px icons
├────────────────────────────────────────────┤
│  badge: نحو · صعوبة: متوسط                  │
│                                            │
│  h3 (20/28) question stem                  │  ← may include a poetry
│  [optional poetry block, Amiri 18/34]      │     block, Amiri
│                                            │
│  ┌ radio card أ ────────────────────────┐  │
│  ┌ radio card ب ────────────────────────┐  │  ← C.4, gap 16
│  ┌ radio card ج ────────────────────────┐  │
│  ┌ radio card د ────────────────────────┐  │
│                                            │
│  [hint chip] [اشرح لي]                     │
├────────────────────────────────────────────┤
│  ┌ السابق ──────┐  ┌────── تأكيد وتالي ──┐ │  ← thumb zone, h-13 (52px)
└────────────────────────────────────────────┘
```

| Element | Spec |
|---|---|
| Progress | C.6, `height: 8px`, full width, fill `--brand-sage`; label `caption` "السؤال 7 من 20" |
| Timer | pill `radius-full`, `bg: --bg-surface-subtle`, `color: --text-secondary`, `tabular-nums`; turns `--status-warning-fg` under 5 min, `--status-error-fg` under 1 min (pulse-soft) |
| Exit | 48×48 ghost icon button `close` at inline-start; opens a confirm dialog ("هل تريد الخروج؟ سيتم حفظ تقدمك") |
| Question stem | `h3` 20/28 w700 `--text-primary`, `margin-block-end: 24` |
| Poetry / ayah block | `font-poetry` 18/34, `bg: --bg-surface-sunken`, `radius-md`, `padding: 16`, with a `border-inline-start: 3px solid var(--brand-accent)` accent rule (logical!) |
| Options | C.4; `role="radiogroup"`; gap 16; keyboard ↑↓ / ←→ moves selection, Space selects, Enter confirms |
| Thumb-zone nav | Sticky `position: sticky; inset-block-end: 0`, `bg: var(--bg-surface)`, `border-block-start: 1px solid var(--border-subtle)`, `padding: 16`, `padding-block-end: calc(16px + env(safe-area-inset-bottom))`, `gap: 16`. **Primary "تأكيد وتالي"** 52px (`h-13`) `flex-1` `bg-brand`; **secondary "السابق"** 52px ghost, `aria-disabled` on Q1. Radius 6px |
| Feedback panel | After confirming: a 250ms-expanding panel below the options — correct → `--status-success-bg` with the explanation; wrong → `--status-error-bg` with the correct answer + explanation. Panel `radius-lg`, `padding: 16`. Never covers the options |
| Offline | chip per C.8 (`--brand-primary-subtle` + dashed gold border) pinned under the header |
| Empty | no questions in the bank → full-screen empty state + ghost CTA back to بنك الأسئلة |
| Loading | C.7 skeleton with the exact same stem/4-option footprint |
| Error | `--status-error-bg` panel + ghost retry; answers already given stay selected |

**Result screen:** circular score ring (160px, `--brand-sage` / `--brand-accent` ring),
`h1` "نتيجتك: 17 / 20", a breakdown table (correct `--status-success-fg` /
wrong `--status-error-fg` / skipped `--text-muted`), and two CTAs:
"راجع الإجابات الخاطئة" (primary) + "امتحان آخر" (secondary).

---

## D.4 معجم فُصحى (vocabulary dictionary)

Does not exist yet. Full spec:

```
┌────────────────────────────────────────────────────────────┐
│ header + sticky search bar (72px)                          │
│  [ 🔍 ابحث عن كلمة…                    ][🎤][✕]            │
│  chips: الكل · النحو · البلاغة · القراءة · الأدب           │
├────────────────────────────────────────────────────────────┤
│ results rail (list)   │  word card (detail, ≥lg: 2-col)    │
│  • كلمة  (caption)    │  ┌────────────────────────────┐    │
│  • كلمة               │  │ الكلمة   [ badge: اسم ]    │    │
│  • كلمة               │  │ المعنى …                   │    │
│                       │  │ المفرد / الجمع              │    │
│                       │  │ المضاد                      │    │
│                       │  │ سياق الامتحان (quote card)  │    │
│                       │  └────────────────────────────┘    │
└────────────────────────────────────────────────────────────┘
```

| Element | Spec |
|---|---|
| **Search input** | C.3 search variant; `sticky; inset-block-start: var(--header-h)`; wrapper `bg: var(--bg-surface)` + `border-block-end: 1px solid var(--border-subtle)` + `padding: 16`. `min-height: 52px` (`h-13`) — this is the primary control |
| **Voice search** | 48×48 icon button at inline-end: idle `mic` in `--brand-secondary`; listening → `bg: --brand-accent`, icon `graphic_eq` in `--text-on-accent`, plus a 1.6s `fusha-pulse-soft` ring (`box-shadow: 0 0 0 8px var(--brand-accent-subtle)`). Transcript appears as placeholder text live. Fallback when `SpeechRecognition` is unavailable: hide the button (progressive enhancement), never show a dead button |
| **Fuzzy matching** (spec §7.2) | Normalise before comparing: strip ال التعريف; unify `أ إ آ ٱ → ا`; `ى → ي`; `ة → ه`; remove all تشكيل; treat `ؤ/ئ` variants. Rank: exact > prefix > contains > fuzzy (Levenshtein ≤2 for stems ≥4 chars). Show "هل تقصد: …؟" as a `--status-info-bg` row when no exact hit |
| **Filter chips** | C.8 filter variant; `gap: 8`; horizontally scrollable with `scroll-padding-inline-start: 16px` |
| **Result row** | `min-height: 56px`, `padding-block: 8`, `border-block-end: 1px solid var(--border-subtle)`, hover `bg: --bg-surface-subtle`, active row `bg: --brand-primary-subtle` + `border-inline-start: 3px solid var(--brand-accent)`. Word in `h4`; POS tag `caption --text-muted`; trailing 16px `chevron_left` (RTL → the chevron points left, i.e. "forward") |
| **Word card** | `radius-lg`, `padding: 24`, `bg: --bg-surface`, `border: 1px solid --border-subtle`, `shadow-sm`. **`bg: --brand-olive-subtle` (`#EDF1E8`) is the spec's designated dictionary surface** (§2.1: brass = «خلفيات المعجم») — use `--brand-olive-subtle` for the card body and `--brand-brass` as a 1px border on the header strip |
| — headword | `h1` 32/42 w800 `--text-primary`, with an optional 48×48 speaker button (`volume_up`, `--brand-secondary`) to hear pronunciation |
| — POS badge | C.8 neutral variant: اسم / فعل / حرف / مصدر |
| — المعنى | `body-lg` `--text-primary`, block `margin-block-start: 16`; multiple meanings as a numbered list (Arabic-Indic or Western? → **Western**, see §E.4) |
| — المفرد / الجمع | 2-col definition grid, `gap: 16`; label `caption --text-muted`, value `body-lg 700` |
| — المضاد | same grid; value in `--brand-secondary`; if none, a `caption` "—" in `--text-muted` (never leave a blank row) |
| — سياق ورودها في امتحانات الثانوية | quote card: `bg: --bg-surface-sunken`, `radius-md`, `padding: 16`, `border-inline-start: 3px solid var(--brand-brass)`; the exam sentence in `--font-poetry` 18/34 (it is a شاهد); a `caption` attribution "وزارة التربية والتعليم — امتحان 2023، السؤال الرابع" |
| **States** | default / hover / focus-visible / active as C.5. **Loading** = C.7 skeleton matching the card. **Empty (zero chars)** = a "ابدأ الكتابة…" hint panel with 6 suggested words as chips. **Empty (no match)** = 64px icon + "لم نجد «…»" + "هل تقصد: …؟" + ghost "اقترح إضافة كلمة". **Error** = `--status-error-bg` panel + retry (offline: the offline chip from C.8). **Success** = word card + a silent `--status-success-fg` "أُضيفت إلى قائمة المراجعة" toast when saved |
| **RTL detail** | The results list is at the **inline-start (right)** on ≥lg; the detail card is at the inline-end. On `<lg`, results fill the screen and tapping a row pushes the card in with `fusha-slide-up 300ms` |

---

## D.5 Parent / guardian view

Route `/parent`. Emotional goal: **transparency without alarm** — sage/teal, no red
except a genuine failing grade, and even then only as text, never a filled block.

```
┌────────────────────────────────────────────────────────────┐
│ 1. Student switcher + term picker (chips)                  │
├─────────────────────────────┬──────────────────────────────┤
│ 2. ساعات المذاكرة (card)    │ 3. الحضور والمشاركة (card)   │
│    big number + 7-day spark │    ring + streak             │
├─────────────────────────────┴──────────────────────────────┤
│ 4. جدول الدرجات vs متوسط الطلاب (table, full width)        │
├────────────────────────────────────────────────────────────┤
│ 5. ملاحظات الأستاذ أشرف سليم (thread)                      │
└────────────────────────────────────────────────────────────┘
```

| # | Block | Spec |
|---|---|---|
| 1 | **Switcher** | Avatar 40px + name `h4`; term filter chips (C.8) aligned to inline-end. `padding-block: 16` |
| 2 | **ساعات المذاكرة** | Card `padding: 24`, `radius-lg`, `shadow-sm`. Big number: `text-display` 40/52 w800 in `--brand-primary` + unit `body-lg` "ساعة هذا الأسبوع". Delta chip: `+2.5 عن الأسبوع الماضي` in `--status-success-fg` on `--status-success-bg` (or `--status-warning-*` if it dropped). Below: a 7-day bar sparkline, `height: 64px`, bars `width: 8px`, `radius-full`, `--brand-sage` with `--bg-surface-sunken` for zero days, `gap: 8`, day labels `caption --text-muted` |
| 3 | **الحضور والمشاركة** | Same card shell. 96px circular progress (`--brand-sage`), centre `h3` "92%". Below: streak row "١٢ يوماً متتالياً" with a 16px gold flame. **Copy must be encouraging, never shaming** |
| 4 | **جدول الدرجات** | Full width, `radius-lg`, `overflow: hidden`, `border: 1px solid --border-subtle`. Header row `bg: --bg-surface-subtle`, `height: 48px`, `padding-inline: 16`, cells `caption/700 --text-secondary`, **right-aligned** (`text-start`). Columns: الامتحان · التاريخ · درجة الطالب · متوسط الطلاب · الفرق · الحالة. Body rows `min-height: 56px`, zebra `--bg-surface` / `--bg-surface-subtle` (odd rows only), hover `bg: --brand-primary-subtle`. Score cell: `body-lg/700`. **Delta cell**: positive → `--status-success-fg` with `▲`; negative → `--status-error-fg` with `▼` (text only). State chip: ممتاز (success) / جيد (info) / مقبول (warning) / يحتاج متابعة (error). Mobile `<640`: switch to stacked cards, one per exam, same tokens |
| 5 | **ملاحظات الأستاذ** | Thread of cards, `gap: 16`. Card: `--brand-olive-subtle` bg, `radius-lg`, `padding: 24`, avatar 40px + "أ. أشرف سليم" `h4` + `caption` timestamp + unread dot 8px `--brand-accent`. Body `body-lg`. Trailing row: a 48px ghost "رد" and a 48px ghost "تم القراءة" (success variant on tap). Empty: 64px icon + "لا توجد ملاحظات جديدة" + `caption` "ستظهر هنا رسائل الأستاذ الموجهة لولي الأمر" |

---

# E. Accessibility

## E.1 Focus

| Surface | Ring | Contrast of ring vs. surface |
|---|---|---|
| On `--bg-surface` / `--bg-canvas` (light) | `--ring-on-light` / `--ring-on-canvas` → 2px teal-800 `#163134` | 11.8:1 ✓ |
| On `--brand-primary` / `--bg-inverse` / sidebar / hero gradient | `--ring-on-brand` / `--ring-on-dark` → 2px gold `#E8B54A` | 6.1:1 ✓ |
| On `--brand-accent` (gold buttons) | `--ring-on-accent` → 2px teal-800 | 6.1:1 ✓ |
| Error state | `--ring-error` → 2px `#A82315` | 5.9:1 on white ✓ |

Implementation: `outline: none` + `box-shadow: var(--ring-*)` on `:focus-visible`.
The double-ring (2px gap in the *surface* colour + 2px brand colour) guarantees ≥3:1
against **both** the element and its background — required for WCAG 1.4.11 and the
reason the spec's single gold ring needs the pair (see §F J-8).

Never remove focus to "clean up" hover styles. `:focus-visible` only, so mouse users
don't see rings.

## E.2 Confirmed contrast pairs (WCAG 2.1 AA — all ≥4.5:1)

| Foreground | Background | Ratio |
|---|---|---|
| `--text-primary` `#163134` | `--bg-canvas` `#F8F9F7` | 11.4:1 AAA |
| `--text-primary` `#163134` | `--bg-surface` `#FFFFFF` | 12.2:1 AAA |
| `--text-secondary` `#37695C` | `#F8F9F7` | 6.8:1 AA |
| `--text-muted` `#5B6361` | `#F8F9F7` | 5.9:1 AA |
| `--text-inverse` `#FFFFFF` | `--brand-primary` `#163134` | 11.8:1 AAA |
| `--text-on-accent` `#163134` | `--brand-accent` `#E8B54A` | 6.1:1 AA |
| `--status-success-fg` `#1E6B37` | `--status-success-bg` `#EAF6EE` | 5.6:1 AA |
| `--status-warning-fg` `#8F5B00` | `--status-warning-bg` `#FEF7E6` | 6.4:1 AA |
| `--status-error-fg` `#A82315` | `--status-error-bg` `#FDF0EE` | 6.2:1 AA |
| `--status-info-fg` `#17546E` | `--status-info-bg` `#EEF5F8` | 6.6:1 AA |
| `--text-sidebar` `#D8EBE7` | `--bg-sidebar` `#163134` | 9.1:1 AAA |
| `--text-primary` dark `#F4F6F5` | `--bg-canvas` dark `#0B1A1B` | 14.6:1 AAA |
| `--brand-primary` dark `#4FA895` | `--bg-canvas` dark `#0B1A1B` | 6.9:1 AA |

⚠️ **Never** put `--text-muted` (`#5B6361`) on `--brand-primary` (`#163134`) — 2.1:1.
⚠️ **Never** use `--brand-accent` `#E8B54A` as *text* on white — 2.0:1. Gold is a
**fill/border/icon** colour only. For gold-toned text on light, use `--brand-brass`
`#918D58` (3.1:1, large text only) or `--text-primary`.

## E.3 Reduced motion

`fusha-tokens.css` ships a global `@media (prefers-reduced-motion: reduce)` block that
collapses all animation/transition durations to 0.01ms. Additional rules:

- Skeleton shimmer → static `--bg-surface-subtle` at `opacity: .6` (no loop).
- The hero video autoplay poster → no Ken Burns drift.
- Page transitions → instant (no slide).
- `scroll-behavior: auto` on `html`.
- **Keep** the 200ms success check-pop? No — replace with an opacity fade ≤150ms.
  Colour/opacity changes are permitted; transform/translation is not.

## E.4 Numerals policy

**Rule: Western (Latin) digits `0 1 2 3 4 5 6 7 8 9` everywhere in the product.**

Rationale: Egyptian Thanawiyya Amma papers, mark sheets and every mainstream Egyptian
ed-tech product use Western digits; students read them faster under exam time pressure;
they also avoid the `Intl` default surprise.

Implementation:
```js
// Always pass numberingSystem explicitly — ar-EG defaults to arab (٠١٢٣).
new Intl.NumberFormat('ar-EG-u-nu-latn').format(1234)      // "1,234"
new Intl.NumberFormat('ar-EG', { numberingSystem: 'latn' }) // same
new Intl.DateTimeFormat('ar-EG-u-nu-latn', { dateStyle: 'medium' })
```
- Question numbers, timers, scores, prices, dates, counts, percentages → **Western**.
- **Exception:** inside `--font-poetry` blocks (شواهد شعرية / آيات), where the source
  text itself is typeset traditionally, Arabic-Indic may be preserved **if** the
  original source uses it. Default: still Western.
- Ordering of quiz options stays **أ ب ج د** (letters, not digits).
- Use `font-variant-numeric: tabular-nums` on timers, scores and price columns so
  digits don't jitter.

## E.5 Keyboard

| Context | Keys |
|---|---|
| Global | `Tab` order follows DOM (RTL visual order is automatic). Skip-link "تخطَّ إلى المحتوى" as the first focusable element |
| Quiz (radiogroup) | `↑↓` / `←→` move + select, `Space` select, `Enter` confirm & advance, `1–4` jump to option |
| Sidebar / menus | `Arrow` roving tabindex, `Home`/`End`, `Esc` closes |
| Modal / sheet | `Esc` closes, focus trapped, focus returns to the trigger on close, `aria-modal="true"` |
| Toast | `F6`-style region: wrap in `role="status"`, `Tab` reaches the action; `Esc` dismisses |
| Dictionary | `/` focuses search; `Esc` clears; `↓` moves through results with `aria-activedescendant` |
| Tables (parent view) | scope="col"/"row", `<caption class="sr-only">`, sortable headers as `aria-sort` buttons |

## E.6 Semantics & Arabic specifics

- `lang="ar"` on `<html>`; any embedded Latin brand name gets `lang="en"` on its own span.
- `dir="ltr"` on Material Symbols icons and on any Latin/numeric-only node inside RTL.
- `aria-live` on dynamic regions (scores, timers at thresholds, search result counts).
- Every icon-only 48×48 button gets `aria-label` (Arabic) — the icon font is invisible
  to screen readers otherwise.
- Alt text: portraits → "الأستاذ أشرف سليم، مدرس اللغة العربية للثانوية العامة".
  Decorative Kufic patterns → `aria-hidden="true"`.
- Line length: `max-width: 68ch` for prose; with Cairo at 16px that's ≈ 640px.
- `text-size-adjust: 100%`; never lock `user-scalable=no`.

---

# F. Judgment calls — **please validate these**

These are places where the brand spec is ambiguous, self-contradictory, or silent. I made
a ruling on each; confirm or override.

| # | Issue | My ruling |
|---|---|---|
| **J-1** | `text-secondary`: master spec §2.2 says `#3D5A58`; `DESIGN_TOKENS.json` says `{teal.500}` = `#37695C`. `#3D5A58` is not in the primitive palette. | **Use `#37695C` (teal-500).** Palette-pure, and the spec's own §2.3 contrast table cites "Secondary Text" at 6.8:1 which matches teal-500. |
| **J-2** | `text-muted`: master spec says `#6B7C7B`; JSON says `neutral.gray.600` = `#5B6361`. `#6B7C7B` isn't in the palette. | **Use `#5B6361`** (5.9:1 on canvas). `#6B7C7B` is only 4.6:1 — too close to the AA floor once it lands on `--bg-surface-subtle`. |
| **J-3** | `brand-accent-hover: #D69E32` (§2.2) is not in the primitive palette; the palette jumps gold-500 `#E8B54A` → gold-700 `#B88422`. | Defined `--fx-gold-600: #D69E32` **in the token layer only**. `brand/tailwind_brand_preset.js` was left **pristine** (it is the client's official file) — so there is no `bg-fusha-gold-600` class; use the semantic `--brand-accent-hover` / `bg-accent-hover` instead. |
| **J-4** | `--color-bg-surface-subtle`: spec says `#F0F3F1`; JSON says `neutral.gray.100` = `#EFF2EF`. | **Use `#EFF2EF`.** Matches the JSON (the machine-readable file) and the existing `index.css`. |
| **J-5** | **Dark accent**: master spec §2.2 says `#F2C35F`; `DESIGN_TOKENS.json` says `gold-400` = `#F0C76C`. | **Use `#F0C76C`** (palette-pure). Also `dark.accent` in JSON has no `accentHover`, so I derived `--brand-accent-hover: #E8B54A` (step down to gold-500) and `-active: #B88422`. |
| **J-6** | **Dark mode has no feedback tokens at all** — spec §2.2 lists only bg/text/brand/border for dark. | Derived mechanically and documented in the CSS: dark `fg` = light `bd` tint; dark `bg` = light `fg` at 22% over canvas `#0B1A1B`; dark `bd` = light `fg` at 45%. All ≥9.5:1. See `fusha-tokens.css` `.dark` block. |
| **J-7** | **Dark `--brand-primary` = `#4FA895`** is a *bright* teal. Is it a fill colour or a text colour? | Treated as **both**: on dark, a filled primary button is `#4FA895` with `--text-inverse` (`#0B1A1B`) text (6.5:1). Derived `--brand-primary-hover: #5FB8A4`, `-active: #3D8B79`, `-subtle: #1E4347`. **Flag:** if you'd rather dark mode keep a *dark* primary button with light text, say so — it's a 4-line change but it changes every dark CTA. |
| **J-8** | Spec §2.3 claims "Focus Ring `#E8B54A` vs Input Border = 3.8:1 → مُجاز". But WCAG 1.4.11 measures against **adjacent** colours; gold vs white is **2.0:1** — it fails. | **Split the rule:** gold ring only on brand/dark surfaces (6.1:1 ✓); teal-800 ring on light surfaces (11.8:1 ✓). Always rendered as a *double* ring (2px surface gap + 2px brand) so it satisfies both edges. Keeps the spec's aesthetic intent while actually passing. |
| **J-9** | Spec §5 says a Primary CTA's **error** state is "اهتزاز أفقي" (shake) — but the same table's *success* state turns the button green, implying error might turn it red. It doesn't say to. | **Do not turn CTAs red.** The brand forbids red as a large area (§1.1 "no tension colours"). Error = shake 300ms + a `--status-error-fg` message **adjacent** to the button. Success = green fill for 2s then revert. |
| **J-10** | Quiz option radius: master spec §4.1 assigns `radius-lg: 20px` to "كروت الأسئلة", but `AI_AGENT_INSTRUCTIONS.md` §3.1's reference code uses `16px`. | **20px.** `IDENTITY_AND_DESIGN_SYSTEM.md` is the master spec; the agent guide is a derived example. Badge inside stays 12px. |
| **J-11** | Spec §4.1 `radius-sm: 6px` for "أزرار صغيرة" vs. the modern look of pill buttons. | Buttons = **6px** (spec). Pills/avatars/FABs = `full`. No 8px buttons. |
| **J-12** | `4pt` is only allowed for micro-gaps, but the spec's own `--spacing-xs: 4px` and 12px badge padding (`px-2 py-1`) sit right at the edge. | Chip padding = `4px` vertical / `8px` horizontal (24px total height, 8pt-compliant). Icon↔label inside compact controls = `4px`. Row separators in the sidebar = `4px`. Everything else 8+. |
| **J-13** | Numerals: spec is silent. | **Western digits everywhere** (§E.4). Explicit `numberingSystem: 'latn'` because `ar-EG` defaults to `٠١٢٣`. |
| **J-14** | Spec §3.1 names `Avenir Arabic` as primary, but it's a commercial font and `Cairo` is the sanctioned free fallback. | **Ship Cairo only.** Add `'Avenir Arabic'` first in the stack if/when licensed; the stack in `fusha-tokens.css` is already ordered for that drop-in. Amiri loaded for poetry only. |
| **J-15** | Spec §9 says sidebar is "كحلي بترولي `#163134`" — but in dark mode a `#163134` rail on a `#0B1A1B` canvas has almost no separation. | Light: `#163134`. Dark: `#0E1F21` with a `1px solid #1C3B3E` border at the inline-end. Active row `#1E4347` + gold indicator. |
| **J-16** | Landing page is not described anywhere in the spec (§8 only covers dashboard + parent). | Invented the 12-section stack in §D.1 using spec §1/§2/§4/§5 primitives. **Needs your product sign-off on the order and on the pricing/FAQ/contact content.** |
| **J-17** | `student-web/src/assets/teacher_hero.webp` / `teacher_portrait.webp` — I cannot verify visually whether these depict the Arabic teacher or are leftovers from the chemistry project. | Specced them as the hero/avatar but flagged a **typographic fallback** (Kufic wordmark + gold rule, no photo) if the images turn out to be wrong. **Please eyeball them.** |
| **J-18** | `docs/21-validation-report.md` claims "no hex in TS/CSS" — but `student-web/src/index.css` still has `rgba(154,123,45,.35)`, `rgba(4,120,87,…)`, `rgba(52,211,153,…)` etc. | Treat that report as **stale/inaccurate**. See §G for the real cleanup list. |

---

# G. Drift cleanup list (student-web + dashboard)

Not part of the design spec, but these will fight you if left in place.

| File | Line(s) | Problem | Action |
|---|---|---|---|
| `student-web/index.html` | meta description + `<title>` | still «كيميا \| منصة الهضبة - الكيمياء للثانوية العامة» | → «فُصحى \| منصة الأستاذ أشرف سليم — اللغة العربية للثانوية العامة» |
| `student-web/index.html` | theme-color | `rgb(248 249 247)` hardcoded | keep value, add comment; dark value must be `#0B1A1B` not `#000000` |
| `student-web/src/index.css` | 22 | `--font-display: 'Amiri'` — Amiri is used for **display** type | `--font-display` → Cairo; add `--font-poetry: 'Amiri'` |
| `student-web/src/index.css` | 26, 193 | `rgba(154,123,45,.35)`, `rgba(220,187,109,.4)` — off-palette gold | delete `--manuscript-gold-soft` |
| `student-web/src/index.css` | 44–48, 180–184 | pure-black shadows `rgba(0,0,0,…)` | replace with `--shadow-*` |
| `student-web/src/index.css` | 61–105, 131–178 | emerald/amber/slate light+dark semantic block | delete; the token layer + legacy bridge covers it |
| `student-web/src/index.css` | 113–123, 196–206 | `--hero-*` hardcoded rgba greens | re-derive from `--brand-*`/`--bg-inverse` |
| `student-web/src/index.css` | 4820–4854 | duplicated `--fusha-*` primitives | delete (now in `brand/fusha-tokens.css`) |
| `student-web/src/components/ChemicalParticles.tsx` | all | chemistry-branded decorative component | delete (no Fusha equivalent needed; use the Kufic pattern) |
| `student-web/src/assets/chemistry_bg.webp` | — | chemistry asset | delete |
| `student-web/src/index.css` | 215, 485 | `.chemistry-grid`, `.physics-grid`, `.animate-chemistry-float` | delete |
| `dashboard/src/app/globals.css` | 1 | imports Plus Jakarta Sans + Inter | → Cairo + Amiri only |
| `dashboard/src/app/globals.css` | 14–159 | full emerald/amber M3 `:root` + `.dark` | delete |
| `dashboard/src/app/globals.css` | 161–163 | `* { border-color: rgb(var(--outline-variant)) }` — repaints every border | delete; set borders explicitly |
| `dashboard/src/app/globals.css` | 203–207 | `.chemistry-grid`, `.physics-grid` | delete |
| `dashboard/src/app/globals.css` | 316–381 | duplicated Fusha semantic + primitives | delete; `@import` the token layer |
| `dashboard/src/app/globals.css` | 267–287 | `.premium-kpi-card` / `.premium-table-row` use `border-left: 3px solid` | → `border-inline-start` (logical) |
| `dashboard/tailwind.config.js` | 100–151 | Plus Jakarta Sans / Inter / `quantum` / 12px spacing | per §B.1 |

---

# H. Definition of done (per screen)

- [ ] `dir="rtl"` and all spacing uses logical properties (G2 — grep returns 0).
- [ ] No hex literals and no `--fusha-*` primitives in component code (G4 — grep returns 0).
- [ ] All spacing values ∈ {4, 8, 16, 24, 32, 40, 48, 56, 64, 80, 96} (G3).
- [ ] Every interactive element ≥ 48×48 (G5).
- [ ] Every interactive component implements all 8 states, and each state is reachable
      by keyboard and visible to a screen reader.
- [ ] Focus ring visible on every focusable element at ≥3:1 against both edges.
- [ ] Light **and** dark mode checked; no hardcoded colour survives the theme flip.
- [ ] `prefers-reduced-motion: reduce` → no transform/loop animations.
- [ ] Loading states use the gold sheen skeleton with an identical footprint (no CLS).
- [ ] Empty states exist for every list, rail, and search.
- [ ] Poetry/shawāhid use Amiri at line-height 1.8–2.0.
- [ ] Numerals are Western + `tabular-nums` where they change.
- [ ] Verified at 360px, 768px, 1024px, 1440px.
