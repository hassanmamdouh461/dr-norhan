---
name: Luminal Physics
colors:
  surface: '#faf8ff'
  surface-dim: '#d9d9e5'
  surface-bright: '#faf8ff'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f3f3fe'
  surface-container: '#ededf9'
  surface-container-high: '#e7e7f3'
  surface-container-highest: '#e1e2ed'
  on-surface: '#191b23'
  on-surface-variant: '#434655'
  inverse-surface: '#2e3039'
  inverse-on-surface: '#f0f0fb'
  outline: '#737686'
  outline-variant: '#c3c6d7'
  surface-tint: '#0053db'
  primary: '#004ac6'
  on-primary: '#ffffff'
  primary-container: '#2563eb'
  on-primary-container: '#eeefff'
  inverse-primary: '#b4c5ff'
  secondary: '#545f73'
  on-secondary: '#ffffff'
  secondary-container: '#d5e0f8'
  on-secondary-container: '#586377'
  tertiary: '#006058'
  on-tertiary: '#ffffff'
  tertiary-container: '#007b71'
  on-tertiary-container: '#b3fff3'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#dbe1ff'
  primary-fixed-dim: '#b4c5ff'
  on-primary-fixed: '#00174b'
  on-primary-fixed-variant: '#003ea8'
  secondary-fixed: '#d8e3fb'
  secondary-fixed-dim: '#bcc7de'
  on-secondary-fixed: '#111c2d'
  on-secondary-fixed-variant: '#3c475a'
  tertiary-fixed: '#89f5e7'
  tertiary-fixed-dim: '#6bd8cb'
  on-tertiary-fixed: '#00201d'
  on-tertiary-fixed-variant: '#005049'
  background: '#faf8ff'
  on-background: '#191b23'
  surface-variant: '#e1e2ed'
typography:
  display-lg:
    fontFamily: Plus Jakarta Sans
    fontSize: 48px
    fontWeight: '700'
    lineHeight: 56px
    letterSpacing: -0.02em
  display-lg-mobile:
    fontFamily: Plus Jakarta Sans
    fontSize: 32px
    fontWeight: '700'
    lineHeight: 40px
    letterSpacing: -0.01em
  headline-md:
    fontFamily: Plus Jakarta Sans
    fontSize: 30px
    fontWeight: '600'
    lineHeight: 38px
  headline-sm:
    fontFamily: Plus Jakarta Sans
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
  body-lg:
    fontFamily: Inter
    fontSize: 18px
    fontWeight: '400'
    lineHeight: 28px
  body-md:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  body-sm:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
  label-md:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '600'
    lineHeight: 16px
    letterSpacing: 0.05em
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  base: 8px
  xs: 4px
  sm: 12px
  md: 24px
  lg: 48px
  xl: 80px
  container-max: 1280px
  gutter: 24px
---

## Brand & Style
The design system focuses on intellectual clarity and scientific precision. It targets students and educators in the advanced physics space, requiring a UI that feels authoritative yet approachable. 

The aesthetic is **Modern Minimalist with a focus on High-Contrast Readability**. It utilizes heavy whitespace to reduce cognitive load during complex problem-solving. The emotional response is one of calm focus—stripping away unnecessary decoration to highlight mathematical and physical concepts. All visual elements are designed for bi-directional support, ensuring a seamless experience for both LTR and RTL (Arabic) scripts without losing the systematic structure.

## Colors
The palette is rooted in scientific rigor. 
- **Primary (Royal Blue):** Used for primary calls to action, interactive diagrams, and active states. It represents momentum and focus.
- **Secondary (Deep Slate):** The bedrock of the system's hierarchy. Used for primary headings and dense technical text to ensure maximum legibility.
- **Accents:** Soft Teal (#0d9488) is used for "success" states and completed modules. Lavender (#8b5cf6) is reserved for micro-interactions, hints, and specialized physics notation highlights.
- **Neutral/Background:** The background remains ultra-clean to allow diagrams to pop, while surfaces use pure white to denote interactive areas.

## Typography
The system uses a paired sans-serif approach. **Plus Jakarta Sans** provides a modern, slightly geometric feel for headings, making them appear sophisticated and welcoming. **Inter** is used for all body copy and UI labels due to its exceptional legibility at small sizes and extensive support for glyphs used in scientific notation.

For RTL support, the font weights remain consistent, but line heights are slightly increased (+2px) for Arabic script to accommodate deeper descenders and higher ascenders, ensuring the same rhythmic "airiness" as the English counterpart.

## Layout & Spacing
The layout uses a **12-column fluid grid** for desktop and a **4-column grid** for mobile. Spacing follows an 8px linear scale to maintain mathematical harmony throughout the UI.

- **Margins:** 24px on mobile, scaling to 48px+ on desktop to create a "letterbox" effect for focused reading.
- **RTL Reflow:** The layout is mirrored horizontally for Arabic. Global icons (like arrows) that imply direction of time or progress are flipped, while scientific symbols and math constants remain LTR as per international standards.
- **Content Density:** High whitespace around equations and interactive simulations is mandatory to prevent visual clutter.

## Elevation & Depth
Elevation is conveyed through **Tonal Layers and Ambient Shadows**. 

The design avoids heavy dropshadows. Instead, it uses a single, consistent shadow style for interactive cards and floating menus: `0px 4px 20px rgba(30, 41, 59, 0.08)`. This creates a soft "lift" from the light grey background. 

Non-interactive containers use a low-contrast **1px border** (`#e2e8f0`) instead of shadows to stay flat and academic. Backdrop blurs (12px) are used sparingly on sticky headers to maintain context while scrolling through long-form lessons.

## Shapes
The design system adopts a **Medium Roundedness** (12px or 0.75rem for standard cards). This specific radius strikes a balance between the precision of a laboratory and the friendliness of an educational tool.

- **Small elements (Checkboxes, Tags):** 4px radius.
- **Standard elements (Buttons, Inputs):** 8px radius.
- **Large elements (Lesson Cards, Modals):** 12px-16px radius.
Interactive elements should feel substantial and "clickable" without appearing toy-like.

## Components
- **Buttons:** Primary buttons are solid Royal Blue with white text. Secondary buttons use a slate outline. Height is set to 48px for accessibility.
- **Cards:** White background, 1px border (`#e2e8f0`), and the ambient shadow on hover to indicate interactivity.
- **Input Fields:** Use Inter 16px to prevent iOS zoom. Focus state uses a 2px Royal Blue ring with a 4px offset.
- **Physics Chips:** Small badges used for categorizing topics (e.g., "Quantum," "Thermodynamics"). These use the Teal and Lavender palettes with 10% opacity backgrounds and 100% opacity text.
- **Formula Blocks:** Specially styled containers with a light Slate background (#f1f5f9) and left-border accent (or right-border for RTL) in Royal Blue to denote "Laws" or "Equations."
- **Progress Indicators:** Thin, 4px rounded bars using a primary-to-teal gradient to show lesson completion.