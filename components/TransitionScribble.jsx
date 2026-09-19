'use client';

import { useEffect, useRef, forwardRef, useImperativeHandle, useState } from 'react';
import { gsap } from 'gsap';
import { INTRO_COLORS, DEFAULT_INTRO_CONFIG } from '@/lib/intro-config';
import IntroLogo from './IntroLogo';

const TransitionScribble = forwardRef(function TransitionScribble(
    {
        config = DEFAULT_INTRO_CONFIG,
        logoText,
        logoComponent,
        autoPlay = true,
        onStart,
        onComplete
    },
    ref
) {
    const svgRef = useRef(null);
    const pathRef = useRef(null);
    const logoWrapperRef = useRef(null);
    const logoInnerRef = useRef(null);
    const [logoColor, setLogoColor] = useState('#ffffff');
    const isAnimatingRef = useRef(false);

    // Function to run the full scribble intro animation
    const runAnimation = (colorOverride = null) => {
        const svg = svgRef.current;
        const path = pathRef.current;
        const logoWrapper = logoWrapperRef.current;
        const logoInner = logoInnerRef.current;

        if (!svg || !path || !logoWrapper || isAnimatingRef.current) return;

        isAnimatingRef.current = true;
        if (onStart) onStart();

        // Pick random color or use override
        let selected = colorOverride;
        if (!selected) {
            selected = INTRO_COLORS[Math.floor(Math.random() * INTRO_COLORS.length)];
        } else if (typeof selected === 'string') {
            const found = INTRO_COLORS.find(c => c.value === selected || c.name === selected);
            selected = found || { name: 'custom', value: selected, isLight: false };
        }

        // Apply color to scribble
        svg.style.color = selected.value;

        // Determine contrasting logo color (black for light backgrounds, white for dark)
        const contrastColor = selected.isLight ? '#000000' : '#ffffff';
        setLogoColor(contrastColor);

        // Calculate path length for stroke dash animation
        const pathLength = path.getTotalLength();
        const l = pathLength + 10;

        const durIn = config.durationIn ?? DEFAULT_INTRO_CONFIG.durationIn;
        const durOut = config.durationOut ?? DEFAULT_INTRO_CONFIG.durationOut;
        const strokeStart = config.strokeWidthStart ?? DEFAULT_INTRO_CONFIG.strokeWidthStart;
        const strokeMax = config.strokeWidthMax ?? DEFAULT_INTRO_CONFIG.strokeWidthMax;
        const scaleVal = config.scale ?? DEFAULT_INTRO_CONFIG.scale;
        const wiggleRot = config.wiggleIntensity ?? DEFAULT_INTRO_CONFIG.wiggleIntensity;
        const wiggleSpd = config.wiggleSpeed ?? DEFAULT_INTRO_CONFIG.wiggleSpeed;
        const startCovered = config.startCovered ?? DEFAULT_INTRO_CONFIG.startCovered;
        const coveredHold = config.startCoveredHold ?? DEFAULT_INTRO_CONFIG.startCoveredHold ?? 0.9;

        // Reset elements. In `startCovered` mode we paint the path and logo to
        // their peak-coverage state immediately — the visitor's first frame is
        // the fully-covered brand mark, and only then does the scribble wipe
        // away.
        gsap.set(svg, { scale: scaleVal, opacity: 1, x: 0, y: 0, rotation: 0 });
        gsap.set(path, {
            strokeDasharray: l,
            strokeDashoffset: startCovered ? 0 : l,
            strokeWidth: startCovered ? strokeMax : strokeStart,
            opacity: 1
        });
        gsap.set(logoWrapper, { opacity: startCovered ? 1 : 0, scale: 1 });
        if (logoInner) gsap.set(logoInner, { rotation: 0 });

        document.body.classList.add('is-transitioning');

        // Main GSAP Timeline
        const tl = gsap.timeline({
            onComplete: () => {
                isAnimatingRef.current = false;
                document.body.classList.remove('is-transitioning');
                gsap.set(path, { strokeWidth: '0%' });
                gsap.set(logoWrapper, { opacity: 0 });
                if (logoInner) gsap.killTweensOf(logoInner);
                if (onComplete) onComplete(selected);
            }
        });

        // 1. Draw-in phase. Skipped in startCovered mode — the screen is
        // already painted over from t=0.
        const undrawStart = startCovered ? coveredHold : durIn;

        if (!startCovered) {
            // 1. Draw scribble in (covers the screen)
            tl.to(path, {
                strokeDashoffset: 0,
                duration: durIn,
                ease: 'power1.inOut'
            }, 0);

            tl.to(path, {
                strokeWidth: strokeMax,
                duration: durIn,
                ease: 'power2.inOut'
            }, 0);

            // 2. Fade in logo & start signature wiggle halfway through draw-in
            tl.to(logoWrapper, {
                opacity: 1,
                duration: durIn * 0.45,
                ease: 'power2.out',
                onStart: () => {
                    if (logoInner) {
                        gsap.to(logoInner, {
                            rotation: wiggleRot,
                            duration: wiggleSpd,
                            repeat: -1,
                            yoyo: true,
                            ease: 'steps(1)',
                            overwrite: 'auto'
                        });
                    }
                }
            }, durIn * 0.48);
        } else if (logoInner) {
            // startCovered: the logo is already visible from t=0, so kick off
            // the wiggle immediately so the brand mark animates during the hold.
            gsap.to(logoInner, {
                rotation: wiggleRot,
                duration: wiggleSpd,
                repeat: -1,
                yoyo: true,
                ease: 'steps(1)',
                overwrite: 'auto'
            });
        }

        // 3. Hide logo as scribble begins wiping away
        tl.to(logoWrapper, {
            opacity: 0,
            duration: 0.25,
            ease: 'power2.in',
            onComplete: () => {
                if (logoInner) {
                    gsap.killTweensOf(logoInner);
                    gsap.set(logoInner, { rotation: 0 });
                }
            }
        }, undrawStart + (durOut * 0.42));

        // 4. Undraw scribble away (reveals page content)
        tl.to(path, {
            strokeDashoffset: -l,
            duration: durOut,
            ease: 'power2.inOut'
        }, undrawStart);

        tl.to(path, {
            strokeWidth: strokeStart,
            duration: durOut,
            ease: 'power2.inOut'
        }, undrawStart);

        return tl;
    };

    // Expose replay imperative method
    useImperativeHandle(ref, () => ({
        replay: (color) => runAnimation(color),
        isAnimating: () => isAnimatingRef.current
    }));

    // Listen to global trigger event
    useEffect(() => {
        const handleCustomEvent = (e) => {
            runAnimation(e.detail?.color || null);
        };
        window.addEventListener('replay-intro', handleCustomEvent);

        // Auto play on mount
        let timer;
        if (autoPlay) {
            timer = setTimeout(() => {
                runAnimation();
            }, config.autoPlayDelay ?? DEFAULT_INTRO_CONFIG.autoPlayDelay);
        }

        // Listen for clicks on navbar logo
        const logoClickable = document.querySelector('.logo-truus');
        const onLogoClick = (e) => {
            if (e) e.preventDefault();
            runAnimation();
        };
        if (logoClickable) logoClickable.addEventListener('click', onLogoClick);

        return () => {
            window.removeEventListener('replay-intro', handleCustomEvent);
            if (logoClickable) logoClickable.removeEventListener('click', onLogoClick);
            if (timer) clearTimeout(timer);
            isAnimatingRef.current = false;
        };
    }, []);

    return (
        <>
            {/* Scribble SVG covering the viewport */}
            <svg
                ref={svgRef}
                xmlns="http://www.w3.org/2000/svg"
                width="100%"
                viewBox="0 0 3222 3114"
                fill="none"
                preserveAspectRatio="none"
                className="transition-scribble"
            >
                <path
                    ref={pathRef}
                    d="M299.654 453.865C505.574 319.225 711.494 184.585 836.054 109.945C960.614 35.3048 997.574 24.7448 944.014 110.385C890.454 196.025 745.254 378.185 571.454 634.385C397.654 890.585 199.654 1215.3 110.854 1382.58C22.0544 1549.86 48.4544 1549.86 77.8944 1540.62C107.334 1531.38 139.014 1512.9 367.854 1319.9C596.694 1126.9 1021.73 759.945 1255.21 555.065C1488.69 350.185 1517.73 318.505 1527.41 306.145C1537.09 293.785 1526.53 301.705 1346.85 618.625C1167.17 935.545 818.694 1561.22 635.214 1896.74C451.734 2232.26 443.814 2258.66 447.654 2268.3C451.494 2277.94 467.334 2270.02 511.134 2236.9C554.934 2203.78 626.214 2145.7 966.534 1817.46C1306.85 1489.22 1914.05 892.585 2263.81 557.505C2613.57 222.425 2687.49 166.985 2741.41 129.185C2795.33 91.3848 2827.01 72.9048 2843.33 67.3448C2859.65 61.7848 2859.65 69.7048 2849.09 96.2248C2838.53 122.745 2817.41 167.625 2584.77 544.505C2352.13 921.385 1370.37 2165.43 1139.25 2537.83C908.134 2910.23 902.854 2926.07 902.774 2939.51C902.694 2952.95 907.974 2963.51 1255.21 2613.87C1602.45 2264.23 2829.73 1017.54 2903.53 1071.46C2977.33 1125.38 2176.12 2817.04 2128 3037C2079.88 3256.96 2911.24 2018.56 3172 1793"
                    stroke="currentColor"
                    strokeLinecap="round"
                    style={{ strokeWidth: '0%', strokeDashoffset: '0.001', strokeDasharray: '0px, 999999px' }}
                />
            </svg>

            {/* Center Logo / Headline shown during peak coverage */}
            <div
                ref={logoWrapperRef}
                className="transition-logo-container"
                style={{
                    position: 'fixed',
                    top: '50%',
                    left: '50%',
                    transform: 'translate(-50%, -50%)',
                    zIndex: 10000,
                    pointerEvents: 'none',
                    opacity: 0,
                    display: 'flex',
                    justifyContent: 'center',
                    alignItems: 'center'
                }}
            >
                <div ref={logoInnerRef} style={{ display: 'inline-block' }}>
                    {logoComponent ? (
                        logoComponent
                    ) : (
                        <IntroLogo color={logoColor} text={logoText} />
                    )}
                </div>
            </div>
        </>
    );
});

export default TransitionScribble;
