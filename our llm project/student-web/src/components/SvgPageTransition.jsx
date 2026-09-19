import React, { useRef, useImperativeHandle, forwardRef, useEffect } from 'react';
import { gsap } from 'gsap';
import './SvgPageTransition.css';

/**
 * Brand color palettes matching Gravity for Physics (م. نوران الصناديقي) visual identity
 */
export const BRAND_TRANSITION_PALETTES = [
  { name: 'Deep Space & Gravity Blue', stroke1: '#0A1128', stroke2: '#101EC5' },
  { name: 'Cosmic Indigo & Midnight',   stroke1: '#1E1B4B', stroke2: '#080D21' },
  { name: 'Gravity Blue & Orbital Lime', stroke1: '#101EC5', stroke2: '#BCD91E' },
  { name: 'Surface Navy & Deep Void',  stroke1: '#141D3D', stroke2: '#060A1A' },
  { name: 'Deep Teal & Gravity Blue',  stroke1: '#0F2937', stroke2: '#101EC5' },
  { name: 'Cosmic Violet & Deep Space', stroke1: '#2E1065', stroke2: '#0A1128' },
  { name: 'Electric Cyan & Surface Navy', stroke1: '#0284C7', stroke2: '#141D3D' },
  { name: 'Dark Nebula & Gravity Blue', stroke1: '#0B1E48', stroke2: '#1E1B4B' }
];

const SvgPageTransition = forwardRef(function SvgPageTransition(
  {
    palettes = BRAND_TRANSITION_PALETTES,
    durationIn = 0.8,
    durationOut = 0.75,
    onBeforeNavigate,
    onAfterNavigate,
    className = ''
  },
  ref
) {
  const overlayRef = useRef(null);
  const path1Ref = useRef(null);
  const path2Ref = useRef(null);
  const lastIndexRef = useRef(-1);
  const isTransitioningRef = useRef(false);

  const setupPaths = () => {
    [path1Ref.current, path2Ref.current].forEach(path => {
      if (!path) return;
      try {
        const length = path.getTotalLength();
        path.style.strokeDasharray = `${length + 15}px`;
        path.style.strokeDashoffset = `${length + 15}px`;
      } catch (e) {}
    });
  };

  useEffect(() => {
    setupPaths();
    window.addEventListener('resize', setupPaths);
    return () => window.removeEventListener('resize', setupPaths);
  }, []);

  const getRandomPalette = () => {
    let nextIndex;
    do {
      nextIndex = Math.floor(Math.random() * palettes.length);
    } while (nextIndex === lastIndexRef.current && palettes.length > 1);
    lastIndexRef.current = nextIndex;
    return palettes[nextIndex];
  };

  const leave = () => {
    return new Promise(resolve => {
      const overlay = overlayRef.current;
      const paths = [path1Ref.current, path2Ref.current];
      if (overlay) overlay.classList.add('is-active');

      const tl = gsap.timeline({ onComplete: resolve });
      paths.forEach((path, i) => {
        if (!path) return;
        tl.to(
          path,
          {
            strokeDashoffset: 0,
            attr: { 'stroke-width': 800 },
            duration: durationIn,
            ease: 'power2.inOut'
          },
          i * 0.04
        );
      });
    });
  };

  const enter = () => {
    return new Promise(resolve => {
      const overlay = overlayRef.current;
      const paths = [path1Ref.current, path2Ref.current];

      const tl = gsap.timeline({
        onComplete: () => {
          if (overlay) overlay.classList.remove('is-active');
          paths.forEach(path => {
            if (!path) return;
            try {
              const length = path.getTotalLength();
              gsap.set(path, {
                strokeDashoffset: length + 15,
                attr: { 'stroke-width': 200 }
              });
            } catch (e) {}
          });
          resolve();
        }
      });

      paths.forEach((path, i) => {
        if (!path) return;
        try {
          const length = path.getTotalLength();
          tl.to(
            path,
            {
              strokeDashoffset: -(length + 15),
              attr: { 'stroke-width': 200 },
              duration: durationOut,
              ease: 'power2.inOut'
            },
            i * 0.04
          );
        } catch (e) {}
      });
    });
  };

  const trigger = async (navigateCallback) => {
    if (isTransitioningRef.current) return;
    isTransitioningRef.current = true;

    // Pick random palette and apply
    const palette = getRandomPalette();
    if (path1Ref.current) path1Ref.current.style.stroke = palette.stroke1;
    if (path2Ref.current) path2Ref.current.style.stroke = palette.stroke2;

    if (onBeforeNavigate) onBeforeNavigate(palette);

    // 1. Wipe screen in
    await leave();

    // 2. Perform navigation action at peak
    if (typeof navigateCallback === 'function') {
      await navigateCallback(palette);
    }

    // Brief cinematic apex hold
    await new Promise(r => setTimeout(r, 60));

    // 3. Wipe screen out
    await enter();

    if (onAfterNavigate) onAfterNavigate(palette);

    isTransitioningRef.current = false;
  };

  useImperativeHandle(ref, () => ({
    trigger,
    isTransitioning: () => isTransitioningRef.current
  }));

  return (
    <div
      ref={overlayRef}
      className={`svg-page-transition ${className}`.trim()}
      aria-hidden="true"
    >
      <svg
        viewBox="0 0 2453 2535"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        preserveAspectRatio="none"
      >
        <path
          ref={path1Ref}
          d="M227.549 1818.76C227.549 1818.76 406.016 2207.75 569.049 2130.26C843.431 1999.85 -264.104 1002.3 227.549 876.262C552.918 792.849 773.647 2456.11 1342.05 2130.26C1885.43 1818.76 14.9644 455.772 760.548 137.262C1342.05 -111.152 1663.5 2266.35 2209.55 1972.76C2755.6 1679.18 1536.63 384.467 1826.55 137.262C2013.5 -22.1463 2209.55 381.262 2209.55 381.262"
          stroke="#101EC5"
          strokeWidth="200"
          strokeLinecap="round"
        />
        <path
          ref={path2Ref}
          d="M1661.28 2255.51C1661.28 2255.51 2311.09 1960.37 2111.78 1817.01C1944.47 1696.67 718.456 2870.17 499.781 2255.51C308.969 1719.17 2457.51 1613.83 2111.78 963.512C1766.05 313.198 427.949 2195.17 132.281 1455.51C-155.219 736.292 2014.78 891.514 1708.78 252.012C1437.81 -314.29 369.471 909.169 132.281 566.512C18.1772 401.672 244.781 193.012 244.781 193.012"
          stroke="#BCD91E"
          strokeWidth="200"
          strokeLinecap="round"
        />
      </svg>
    </div>
  );
});

export default SvgPageTransition;
