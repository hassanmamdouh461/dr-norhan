import type { FC } from 'react';

// Generic Fusha cover used on course cards that have no cover_image set.
// Replaces the teacher's personal photo, which used to render as the fallback thumbnail.
const CourseCoverFallback: FC<{ className?: string }> = ({ className }) => (
  <svg
    className={className}
    viewBox="0 0 400 220"
    preserveAspectRatio="xMidYMid slice"
    width="100%"
    height="100%"
    role="img"
    aria-label="صورة تعبيرية لمقرر اللغة العربية"
  >
    <defs>
      <linearGradient id="ccf-bg" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="rgb(var(--fusha-teal-900))" />
        <stop offset="100%" stopColor="rgb(var(--fusha-teal-900))" />
      </linearGradient>
      <radialGradient id="ccf-glow-a" cx="50%" cy="50%" r="50%">
        <stop offset="0%" stopColor="rgb(var(--fusha-teal-400))" stopOpacity="0.35" />
        <stop offset="100%" stopColor="rgb(var(--fusha-teal-400))" stopOpacity="0" />
      </radialGradient>
      <radialGradient id="ccf-glow-b" cx="50%" cy="50%" r="50%">
        <stop offset="0%" stopColor="rgb(var(--fusha-feedback-success))" stopOpacity="0.4" />
        <stop offset="100%" stopColor="rgb(var(--fusha-feedback-success))" stopOpacity="0" />
      </radialGradient>
      <linearGradient id="ccf-liquid" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stopColor="rgb(var(--fusha-teal-400))" stopOpacity="0.85" />
        <stop offset="100%" stopColor="rgb(var(--fusha-feedback-success))" stopOpacity="0.9" />
      </linearGradient>
    </defs>

    <rect width="400" height="220" fill="url(#ccf-bg)" />
    <circle cx="70" cy="40" r="140" fill="url(#ccf-glow-b)" />
    <circle cx="330" cy="190" r="150" fill="url(#ccf-glow-a)" />

    {/* Molecule motif, top-left */}
    <g stroke="rgb(var(--fusha-teal-400))" strokeOpacity="0.35" strokeWidth="1.5">
      <line x1="30" y1="35" x2="70" y2="20" />
      <line x1="70" y1="20" x2="105" y2="45" />
      <line x1="70" y1="20" x2="60" y2="65" />
    </g>
    <g fill="rgb(var(--fusha-sage-400))" fillOpacity="0.55">
      <circle cx="30" cy="35" r="4" />
      <circle cx="70" cy="20" r="5.5" />
      <circle cx="105" cy="45" r="4" />
      <circle cx="60" cy="65" r="3.5" />
    </g>

    {/* Molecule motif, bottom-right */}
    <g stroke="rgb(var(--fusha-teal-400))" strokeOpacity="0.3" strokeWidth="1.5">
      <line x1="330" y1="170" x2="365" y2="155" />
      <line x1="365" y1="155" x2="378" y2="185" />
    </g>
    <g fill="rgb(var(--fusha-sage-400))" fillOpacity="0.5">
      <circle cx="330" cy="170" r="3.5" />
      <circle cx="365" cy="155" r="5" />
      <circle cx="378" cy="185" r="3.5" />
    </g>

    {/* Erlenmeyer flask, left-of-center */}
    <g transform="translate(148, 60)">
      <path
        d="M20 0 H34 V26 L54 78 Q58 88 48 88 H6 Q-4 88 0 78 L20 26 Z"
        fill="rgba(255,255,255,0.04)"
        stroke="rgb(var(--fusha-sage-400))"
        strokeOpacity="0.55"
        strokeWidth="2"
      />
      <path d="M8.5 62 L48 62 L48.5 78 Q50 84 44 84 H12 Q6 84 6.5 78 Z" fill="url(#ccf-liquid)" />
      <circle cx="20" cy="70" r="2.2" fill="rgb(var(--fusha-teal-100))" fillOpacity="0.8" />
      <circle cx="32" cy="58" r="1.6" fill="rgb(var(--fusha-teal-100))" fillOpacity="0.7" />
      <circle cx="26" cy="76" r="1.4" fill="rgb(var(--fusha-teal-100))" fillOpacity="0.6" />
      <rect x="17" y="-6" width="20" height="7" rx="1.5" fill="none" stroke="rgb(var(--fusha-sage-400))" strokeOpacity="0.55" strokeWidth="2" />
    </g>

    {/* Round-bottom flask, right */}
    <g transform="translate(238, 40)">
      <circle cx="24" cy="70" r="34" fill="rgba(255,255,255,0.04)" stroke="rgb(var(--fusha-sage-400))" strokeOpacity="0.45" strokeWidth="2" />
      <path d="M14 0 H34 V38 Q34 42 24 42 Q14 42 14 38 Z" fill="rgba(255,255,255,0.04)" stroke="rgb(var(--fusha-sage-400))" strokeOpacity="0.45" strokeWidth="2" />
      <path d="M-8 62 A34 34 0 0 0 56 62 A34 34 0 0 1 -8 62 Z" fill="url(#ccf-liquid)" opacity="0.9" />
      <circle cx="18" cy="74" r="2.4" fill="rgb(var(--fusha-teal-100))" fillOpacity="0.75" />
      <circle cx="32" cy="82" r="1.8" fill="rgb(var(--fusha-teal-100))" fillOpacity="0.65" />
      <rect x="11" y="-6" width="26" height="7" rx="1.5" fill="none" stroke="rgb(var(--fusha-sage-400))" strokeOpacity="0.45" strokeWidth="2" />
    </g>
  </svg>
);

export default CourseCoverFallback;
