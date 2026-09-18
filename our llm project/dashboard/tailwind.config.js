/** @type {import('tailwindcss').Config} */

// Helper: map a token name to `rgb(var(--token) / <alpha-value>)`
const token = (name) => `rgb(var(--${name}) / <alpha-value>)`;

module.exports = {
  darkMode: 'class',
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // ---- Brand ----
        "primary": token("primary"),
        "on-primary": token("on-primary"),
        "primary-container": token("primary-container"),
        "on-primary-container": token("on-primary-container"),

        "accent": token("accent"),
        "on-accent": token("on-accent"),
        "accent-container": token("accent-container"),
        "on-accent-container": token("on-accent-container"),

        "secondary": token("secondary"),
        "on-secondary": token("on-secondary"),
        "secondary-container": token("secondary-container"),
        "on-secondary-container": token("on-secondary-container"),

        "tertiary": token("tertiary"),
        "on-tertiary": token("on-tertiary"),
        "tertiary-container": token("tertiary-container"),

        "error": token("error"),
        "on-error": token("on-error"),
        "error-container": token("error-container"),
        "on-error-container": token("on-error-container"),

        "success": token("success"),
        "on-success": token("on-success"),
        "success-container": token("success-container"),
        "on-success-container": token("on-success-container"),

        "warning": token("warning"),
        "on-warning": token("on-warning"),
        "warning-container": token("warning-container"),
        "on-warning-container": token("on-warning-container"),

        // ---- Fixed accent chips ----
        "primary-fixed": token("primary-fixed"),
        "on-primary-fixed": token("on-primary-fixed"),
        "on-primary-fixed-variant": token("on-primary-fixed-variant"),
        "primary-fixed-dim": token("primary-fixed-dim"),

        "secondary-fixed": token("secondary-fixed"),
        "on-secondary-fixed": token("on-secondary-fixed"),
        "on-secondary-fixed-variant": token("on-secondary-fixed-variant"),
        "secondary-fixed-dim": token("secondary-fixed-dim"),

        "tertiary-fixed": token("tertiary-fixed"),
        "on-tertiary-fixed": token("on-tertiary-fixed"),
        "on-tertiary-fixed-variant": token("on-tertiary-fixed-variant"),
        "tertiary-fixed-dim": token("tertiary-fixed-dim"),

        "accent-fixed": token("accent-fixed"),
        "on-accent-fixed": token("on-accent-fixed"),
        "on-accent-fixed-variant": token("on-accent-fixed-variant"),
        "accent-fixed-dim": token("accent-fixed-dim"),

        // ---- Surfaces ----
        "background": token("background"),
        "on-background": token("on-background"),
        "surface": token("surface"),
        "surface-bright": token("surface-bright"),
        "surface-dim": token("surface-dim"),
        "surface-container-lowest": token("surface-container-lowest"),
        "surface-container-low": token("surface-container-low"),
        "surface-container": token("surface-container"),
        "surface-container-high": token("surface-container-high"),
        "surface-container-highest": token("surface-container-highest"),
        "surface-variant": token("surface-variant"),
        "on-surface": token("on-surface"),
        "on-surface-variant": token("on-surface-variant"),

        "outline": token("outline"),
        "outline-variant": token("outline-variant"),

        "inverse-surface": token("inverse-surface"),
        "inverse-on-surface": token("inverse-on-surface"),
        "inverse-primary": token("inverse-primary"),
        "surface-tint": token("surface-tint"),
      },
      fontFamily: {
        "display-lg": ["Plus Jakarta Sans", "Cairo", "sans-serif"],
        "display-lg-mobile": ["Plus Jakarta Sans", "Cairo", "sans-serif"],
        "headline-md": ["Plus Jakarta Sans", "Cairo", "sans-serif"],
        "headline-sm": ["Plus Jakarta Sans", "Cairo", "sans-serif"],
        "body-lg": ["Inter", "Cairo", "sans-serif"],
        "body-md": ["Inter", "Cairo", "sans-serif"],
        "body-sm": ["Inter", "Cairo", "sans-serif"],
        "label-md": ["Inter", "Cairo", "sans-serif"],
        cairo: ["var(--font-cairo)", "Cairo", "sans-serif"],
      },
      fontSize: {
        "display-lg": ["2.25rem", { lineHeight: "2.5rem", fontWeight: "800" }],
        "display-lg-mobile": ["1.75rem", { lineHeight: "2.1rem", fontWeight: "800" }],
        "headline-md": ["1.5rem", { lineHeight: "1.9rem", fontWeight: "700" }],
        "headline-sm": ["1.125rem", { lineHeight: "1.6rem", fontWeight: "700" }],
        "body-lg": ["1rem", { lineHeight: "1.6rem" }],
        "body-md": ["0.875rem", { lineHeight: "1.4rem" }],
        "body-sm": ["0.75rem", { lineHeight: "1.1rem" }],
        "label-md": ["0.8125rem", { lineHeight: "1.1rem", fontWeight: "600" }],
      },
      boxShadow: {
        'ambient': '0 1px 2px rgb(var(--shadow-color) / 0.04), 0 6px 20px rgb(var(--shadow-color) / 0.06)',
        'card-shadow': '0 1px 2px rgb(var(--shadow-color) / 0.04), 0 6px 20px rgb(var(--shadow-color) / 0.06)',
        'soft': '0 1px 2px rgb(var(--shadow-color) / 0.04), 0 6px 20px rgb(var(--shadow-color) / 0.06)',
        'lift': '0 10px 30px rgb(var(--shadow-color) / 0.12)',
        'glow-primary': '0 0 30px rgb(var(--primary) / 0.25)',
        'glow-accent': '0 0 30px rgb(var(--accent) / 0.25)',
      },
      borderRadius: {
        "DEFAULT": "0.5rem",
        "sm": "0.25rem",
        "md": "0.75rem",
        "lg": "1rem",
        "xl": "1.5rem",
        "full": "9999px",
      },
      spacing: {
        "xs": "4px",
        "sm": "12px",
        "base": "8px",
        "md": "24px",
        "gutter": "24px",
        "lg": "48px",
        "xl": "80px",
        "container-max": "1280px",
      },
      maxWidth: {
        "container-max": "1280px",
      },
      transitionTimingFunction: {
        'quantum': 'cubic-bezier(0.4, 0, 0.2, 1)',
      },
    },
  },
  plugins: [],
};
