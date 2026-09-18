import React, { useEffect, useState } from 'react';

export interface TourStep {
  selector: string;
  title: string;
  text: string;
}

interface GuidedTourProps {
  steps: TourStep[];
  /** localStorage/sessionStorage key used to remember that this tour was already shown. */
  storageKey: string;
  /** 'local' shows the tour once ever; 'session' re-shows it every new tab/session. */
  persistence?: 'local' | 'session';
  /** Gate for when the tour is allowed to start (e.g. only once a profile/section has loaded). */
  active?: boolean;
}

const SPOTLIGHT_PADDING = 8;

/**
 * Spotlight walkthrough: dims the page, cuts a highlight around each step's
 * target element (found via CSS selector) and shows a small tooltip card
 * with next/skip controls. Steps whose target isn't present/visible (e.g.
 * a desktop-only element on a mobile layout) are skipped automatically.
 */
export const GuidedTour: React.FC<GuidedTourProps> = ({ steps, storageKey, persistence = 'local', active = true }) => {
  const [stepIndex, setStepIndex] = useState(0);
  const [visible, setVisible] = useState(false);
  const [rect, setRect] = useState<DOMRect | null>(null);

  const storage = persistence === 'local' ? window.localStorage : window.sessionStorage;

  const finish = () => {
    setVisible(false);
    try {
      storage.setItem(storageKey, 'true');
    } catch {
      // Storage unavailable (private mode, quota) — safe to ignore, tour just re-shows next time.
    }
  };

  const goToValidStep = (fromIndex: number, direction: 1 | -1) => {
    let idx = fromIndex;
    while (idx >= 0 && idx < steps.length) {
      const elements = document.querySelectorAll(steps[idx].selector);
      let visibleEl: HTMLElement | null = null;
      let visibleRect: DOMRect | null = null;
      
      for (let i = 0; i < elements.length; i++) {
        const el = elements[i] as HTMLElement;
        const r = el.getBoundingClientRect();
        if (r.width > 0 && r.height > 0) {
          visibleEl = el;
          visibleRect = r;
          break;
        }
      }

      if (visibleEl && visibleRect) {
        // Scroll target element to center of viewport so it is visible and has room for the tour card
        visibleEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
        
        setStepIndex(idx);
        setRect(visibleRect);
        
        // Update the rect again once smooth scrolling is complete
        setTimeout(() => {
          if (visibleEl) {
            setRect(visibleEl.getBoundingClientRect());
          }
        }, 350);
        return;
      }
      idx += direction;
    }
    finish();
  };

  useEffect(() => {
    if (!active || steps.length === 0) return;
    let alreadySeen = false;
    try {
      alreadySeen = !!storage.getItem(storageKey);
    } catch {
      alreadySeen = false;
    }
    if (alreadySeen) return;
    const timer = setTimeout(() => setVisible(true), 600);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, storageKey]);

  useEffect(() => {
    if (!visible) return;
    goToValidStep(0, 1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  useEffect(() => {
    if (!visible) return;
    const onReflow = () => {
      const selector = steps[stepIndex]?.selector || '';
      const elements = document.querySelectorAll(selector);
      for (let i = 0; i < elements.length; i++) {
        const el = elements[i] as HTMLElement;
        const r = el.getBoundingClientRect();
        if (r.width > 0 && r.height > 0) {
          setRect(r);
          break;
        }
      }
    };
    window.addEventListener('resize', onReflow);
    window.addEventListener('scroll', onReflow, true);
    return () => {
      window.removeEventListener('resize', onReflow);
      window.removeEventListener('scroll', onReflow, true);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, stepIndex]);

  if (!visible || !rect) return null;

  const step = steps[stepIndex];
  const isLast = stepIndex >= steps.length - 1;

  const spaceBelow = window.innerHeight - rect.bottom;
  const cardTop = spaceBelow > 170 ? rect.bottom + 12 : Math.max(12, rect.top - 160);
  const cardLeft = Math.min(Math.max(12, rect.left), window.innerWidth - 296);

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 3000, pointerEvents: 'none' }}>
      <div
        style={{
          position: 'fixed',
          top: rect.top - SPOTLIGHT_PADDING,
          left: rect.left - SPOTLIGHT_PADDING,
          width: rect.width + SPOTLIGHT_PADDING * 2,
          height: rect.height + SPOTLIGHT_PADDING * 2,
          borderRadius: '12px',
          boxShadow: '0 0 0 9999px rgba(0,0,0,0.72)',
          transition: 'top 0.25s ease, left 0.25s ease, width 0.25s ease, height 0.25s ease',
          pointerEvents: 'none',
        }}
      />
      <div
        style={{
          position: 'fixed',
          top: cardTop,
          left: cardLeft,
          width: '280px',
          maxWidth: 'calc(100vw - 24px)',
          background: 'rgb(var(--surface))',
          color: 'rgb(var(--on-surface))',
          borderRadius: '14px',
          padding: '16px',
          boxShadow: '0 12px 30px rgba(0,0,0,0.35)',
          border: '1px solid rgb(var(--outline) / 0.15)',
          pointerEvents: 'auto',
          direction: 'rtl',
          fontFamily: 'Cairo, sans-serif',
        }}
      >
        <h4 style={{ fontSize: '14px', fontWeight: 800, marginBottom: '6px' }}>{step.title}</h4>
        <p style={{ fontSize: '12px', color: 'rgb(var(--on-surface-variant))', lineHeight: 1.6, marginBottom: '14px' }}>
          {step.text}
        </p>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <button
            type="button"
            onClick={finish}
            style={{ background: 'none', border: 'none', color: 'rgb(var(--on-surface-variant))', fontSize: '12px', cursor: 'pointer' }}
          >
            تخطي
          </button>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontSize: '11px', color: 'rgb(var(--on-surface-variant))' }}>
              {stepIndex + 1}/{steps.length}
            </span>
            <button
              type="button"
              onClick={() => (isLast ? finish() : goToValidStep(stepIndex + 1, 1))}
              style={{
                background: 'rgb(var(--primary))',
                color: '#fff',
                border: 'none',
                borderRadius: '8px',
                padding: '8px 16px',
                fontSize: '12px',
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              {isLast ? 'إنهاء' : 'التالي'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default GuidedTour;
