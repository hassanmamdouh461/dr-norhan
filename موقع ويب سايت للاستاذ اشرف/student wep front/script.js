// Initialize Lucide Icons & Intro
document.addEventListener('DOMContentLoaded', () => {
  if (window.lucide) {
    window.lucide.createIcons();
  }

  const yearSpan = document.getElementById('currentYear');
  if (yearSpan) {
    yearSpan.textContent = new Date().getFullYear();
  }

  // Initialize Page Transitions and Intro
  initSectionSvgTransition();

  // Initialize distinct entrance animations for system cards
  initSystemCardsAnimation();

  // Run the Intro Scribble Animation on initial page load
  runIntro();
});

// =========================================================
// 1. FULLSCREEN INTRO SCRIBBLER & SECTION TRANSITIONS (Truus / Animmaster)
// =========================================================
const INTRO_COLORS = [
  // Fusha Signature Brand Colors (100% Authentic & Prestigious)
  { name: 'forest', value: '#142B24', isLight: false },
  { name: 'forestLight', value: '#1E3E34', isLight: false },
  { name: 'sage', value: '#5F7A61', isLight: false },
  { name: 'khaki', value: '#B7B19B', isLight: true },
  { name: 'olive', value: '#8B9565', isLight: false },
];

let lastColorIdx = -1;

function pickRandomIntroColor() {
  let idx;
  do {
    idx = Math.floor(Math.random() * INTRO_COLORS.length);
  } while (idx === lastColorIdx && INTRO_COLORS.length > 1);
  lastColorIdx = idx;
  return INTRO_COLORS[idx];
}

let isIntroAnimating = false;
let introHasRunOnThisPage = false;

function cleanUpIntroOverlays() {
  const svg = document.getElementById('scribbleSvg');
  const path = document.getElementById('scribblePath');
  const logoContainer = document.getElementById('logoContainer');
  const logoInner = document.getElementById('logoInner');

  if (path && typeof gsap !== 'undefined') {
    gsap.set(path, { strokeWidth: '0%' });
  }
  if (logoContainer) {
    logoContainer.style.display = 'none';
    logoContainer.style.visibility = 'hidden';
    logoContainer.style.opacity = '0';
    logoContainer.style.pointerEvents = 'none';
  }
  if (svg) {
    svg.style.display = 'none';
    svg.style.visibility = 'hidden';
    svg.style.opacity = '0';
    svg.style.pointerEvents = 'none';
  }
  if (logoInner && typeof gsap !== 'undefined') {
    gsap.killTweensOf(logoInner);
    gsap.set(logoInner, { rotation: 0 });
  }
  document.body.classList.remove('is-transitioning');
}

function applyIntroTheme(color) {
  const svg = document.getElementById('scribbleSvg');
  const logoImg = document.getElementById('introLogoImg');
  const subText = document.getElementById('introSubText');

  if (svg) svg.style.color = color.value;

  if (logoImg) {
    logoImg.src = color.isLight
      ? 'assets/fusha-brand-logo.png'
      : 'assets/fusha-brand-logo-white.png';
  }

  if (subText) {
    subText.style.color = color.isLight ? '#142B24' : '#ffffff';
  }
}

function runIntro(onComplete) {
  // Run on every page visit/reload, guarded only against concurrent double-trigger
  if (isIntroAnimating || introHasRunOnThisPage) {
    if (onComplete) onComplete();
    return;
  }
  isIntroAnimating = true;
  introHasRunOnThisPage = true;

  const svg = document.getElementById('scribbleSvg');
  const path = document.getElementById('scribblePath');
  const logoContainer = document.getElementById('logoContainer');
  const logoInner = document.getElementById('logoInner');

  if (!svg || !path || !logoContainer) {
    isIntroAnimating = false;
    cleanUpIntroOverlays();
    if (onComplete) onComplete();
    return;
  }

  // If GSAP hasn't arrived yet (slow iOS network), wait for window 'load' once
  // and retry, instead of bailing out and letting a later call re-run the intro.
  if (typeof gsap === 'undefined') {
    var retried = false;
    var retryIntro = function () {
      if (retried) return;
      retried = true;
      isIntroAnimating = false;
      introHasRunOnThisPage = false;
      runIntro(onComplete);
    };
    if (document.readyState === 'complete') {
      isIntroAnimating = false;
      cleanUpIntroOverlays();
      if (onComplete) onComplete();
      return;
    }
    window.addEventListener('load', retryIntro, { once: true });
    setTimeout(retryIntro, 500);
    return;
  }

  // Use pre-selected initial color or pick a random one
  const color = window.__INITIAL_INTRO_COLOR || pickRandomIntroColor();
  applyIntroTheme(color);

  // Safe path length calculation for WebKit (protect against 0 or NaN on early layout)
  const rawLength = (path.getTotalLength && path.getTotalLength()) || 22000;
  const l = Math.max(Math.ceil(rawLength), 22000) + 100;

  // The intro STARTS FULLY COVERING the entire screen
  gsap.set(svg, { scale: 0.7, opacity: 1, display: 'block', visibility: 'visible' });
  gsap.set(path, {
    strokeDasharray: `${l}px ${l}px`,
    strokeDashoffset: 0,
    strokeWidth: '32%',
    opacity: 1,
  });
  gsap.set(logoContainer, { opacity: 1, scale: 1, display: 'flex', visibility: 'visible' });

  // Start the signature logo wiggle immediately
  if (logoInner) {
    gsap.to(logoInner, {
      rotation: 6,
      duration: 0.14,
      repeat: -1,
      yoyo: true,
      ease: 'steps(1)',
      overwrite: 'auto',
    });
  }

  // Hold full intro screen briefly so user sees it first, then undraw away in signature scribble style
  const holdDuration = 0.9;
  const durOut = 2.0;

  const tl = gsap.timeline({
    delay: holdDuration,
    onComplete: () => {
      isIntroAnimating = false;
      cleanUpIntroOverlays();
      if (onComplete) onComplete();
    },
  });

  // 1. Smoothly fade out center logo
  tl.to(
    logoContainer,
    {
      opacity: 0,
      scale: 0.92,
      duration: 0.35,
      ease: 'power2.in',
      onComplete: () => {
        if (logoInner) {
          gsap.killTweensOf(logoInner);
          gsap.set(logoInner, { rotation: 0 });
        }
      },
    },
    0
  );

  // 2. Undraw scribble away in signature curve, revealing the landing page
  // Using positive offset `l` (from 0 to +l) to prevent WebKit negative-offset reversal glitch
  tl.to(
    path,
    {
      strokeDashoffset: l,
      duration: durOut,
      ease: 'power2.inOut',
    },
    0.15
  );

  tl.to(
    path,
    {
      strokeWidth: '8%',
      duration: durOut,
      ease: 'power2.inOut',
    },
    0.15
  );
}

// iOS BFCache and Chrome tab restore fix: when the page is restored or displayed,
// ensure completed overlays are completely purged and hidden.
window.addEventListener('pageshow', function (event) {
  if (event.persisted) {
    cleanUpIntroOverlays();
    isIntroAnimating = false;
  }
});

// =========================================================
// 1.1 SECTION TRANSITION SVG (Animmaster/SVG-Page-transition)
// =========================================================
const SECTION_TRANSITION_PAIRS = [
  { stroke1: '#142B24', stroke2: '#B7B19B' }, // Forest Dark & Khaki
  { stroke1: '#1E3E34', stroke2: '#B7B19B' }, // Forest Light & Khaki
  { stroke1: '#5F7A61', stroke2: '#142B24' }, // Sage Green & Forest
  { stroke1: '#8B9565', stroke2: '#142B24' }, // Olive & Forest
  { stroke1: '#142B24', stroke2: '#5F7A61' }, // Forest & Sage
  { stroke1: '#B7B19B', stroke2: '#142B24' }, // Khaki & Forest
  { stroke1: '#142B24', stroke2: '#1E3E34' }, // Forest Dark & Forest Light
];

let lastPairIdx = -1;
function pickRandomTransitionPair() {
  let idx;
  do {
    idx = Math.floor(Math.random() * SECTION_TRANSITION_PAIRS.length);
  } while (idx === lastPairIdx && SECTION_TRANSITION_PAIRS.length > 1);
  lastPairIdx = idx;
  return SECTION_TRANSITION_PAIRS[idx];
}

function initSectionSvgTransition() {
  const overlay = document.getElementById('sectionTransitionOverlay');
  const path1 = document.getElementById('secTransPath1');
  const path2 = document.getElementById('secTransPath2');

  if (!overlay || !path1 || !path2 || typeof gsap === 'undefined') return;

  const paths = [path1, path2];

  // Guarantee overlay is hidden initially
  overlay.style.display = 'none';
  overlay.style.visibility = 'hidden';
  overlay.style.opacity = '0';

  // Initial path lengths setup (paired dasharray prevents WebKit reversal bug)
  paths.forEach((path) => {
    const length = (path.getTotalLength && path.getTotalLength()) || 15000;
    path.style.strokeDasharray = `${length}px ${length}px`;
    path.style.strokeDashoffset = `${length}px`;
  });

  function leave() {
    return new Promise((resolve) => {
      overlay.style.display = 'block';
      overlay.style.visibility = 'visible';
      overlay.style.opacity = '1';
      overlay.classList.add('is-active');
      document.body.classList.add('is-transitioning');

      const tween = gsap.timeline({ onComplete: resolve });

      paths.forEach((path) => {
        const length = (path.getTotalLength && path.getTotalLength()) || 15000;
        gsap.set(path, {
          strokeDasharray: `${length}px ${length}px`,
          strokeDashoffset: `${length}px`,
          attr: { 'stroke-width': 200 },
        });
        tween.to(
          path,
          {
            strokeDashoffset: 0,
            attr: { 'stroke-width': 700 },
            duration: 0.75,
            ease: 'power1.inOut',
          },
          0
        );
      });
    });
  }

  function enter() {
    return new Promise((resolve) => {
      const tween = gsap.timeline({
        onComplete: () => {
          overlay.classList.remove('is-active');
          overlay.style.visibility = 'hidden';
          overlay.style.opacity = '0';
          overlay.style.display = 'none';
          document.body.classList.remove('is-transitioning');
          resolve();
        },
      });

      paths.forEach((path) => {
        const length = (path.getTotalLength && path.getTotalLength()) || 15000;
        tween.to(
          path,
          {
            strokeDashoffset: length,
            attr: { 'stroke-width': 200 },
            duration: 0.75,
            ease: 'power1.inOut',
          },
          0
        );
      });
    });
  }

  document.querySelectorAll('[data-transition], a[href^="#"]').forEach((link) => {
    link.addEventListener('click', async (e) => {
      const targetId =
        link.getAttribute('data-transition') ||
        (link.getAttribute('href') && link.getAttribute('href').startsWith('#')
          ? link.getAttribute('href').slice(1)
          : null);

      if (!targetId || targetId === '' || targetId === '#') return;

      const targetSection = document.getElementById(targetId);
      if (!targetSection) return;

      e.preventDefault();
      if (isIntroAnimating) return;
      isIntroAnimating = true;

      // Close mobile drawer if open
      const mobileMenu = document.getElementById('mobileMenu');
      if (mobileMenu && !mobileMenu.classList.contains('hidden')) {
        mobileMenu.classList.add('hidden');
      }

      document.documentElement.style.scrollBehavior = 'auto';
      document.documentElement.classList.remove('scroll-smooth');

      // Pick brand colors pair & apply to the 2 strokes
      const pair = pickRandomTransitionPair();
      path1.setAttribute('stroke', pair.stroke1);
      path1.style.stroke = pair.stroke1;
      path2.setAttribute('stroke', pair.stroke2);
      path2.style.stroke = pair.stroke2;

      try {
        // 1. Wipe in 2-path transition (Animmaster leave)
        await leave();

        // 2. Instant teleport to section behind the curtain
        const navbar = document.getElementById('navbar');
        const navHeight = navbar ? navbar.offsetHeight + 18 : 96;
        const targetTop = targetId === 'hero'
          ? 0
          : targetSection.getBoundingClientRect().top + window.pageYOffset - navHeight;

        window.scrollTo({
          top: Math.max(0, targetTop),
          behavior: 'instant',
        });

        await new Promise((resolve) => {
          requestAnimationFrame(() => {
            requestAnimationFrame(resolve);
          });
        });
        await new Promise((resolve) => setTimeout(resolve, 60));

        // 3. Wipe out 2-path transition (Animmaster enter)
        await enter();
      } catch (err) {
        console.error('Transition error:', err);
      } finally {
        overlay.classList.remove('is-active');
        overlay.style.visibility = 'hidden';
        overlay.style.opacity = '0';
        overlay.style.display = 'none';
        document.body.classList.remove('is-transitioning');
        document.documentElement.style.scrollBehavior = '';
        document.documentElement.classList.add('scroll-smooth');
        isIntroAnimating = false;
      }

      // Re-trigger cards animation when transitioning to system section
      if (targetId === 'system' && typeof window.animateSystemCards === 'function') {
        window.animateSystemCards(true);
      }
    });
  });
}

// =========================================================
// 2. NAVBAR, MOBILE DRAWER & SCROLL PROGRESS BAR
// =========================================================
const mobileMenuBtn = document.getElementById('mobileMenuBtn');
const mobileMenu = document.getElementById('mobileMenu');

if (mobileMenuBtn && mobileMenu) {
  mobileMenuBtn.addEventListener('click', () => {
    mobileMenu.classList.toggle('hidden');
  });
}

function updateScrollProgress() {
  const progressBar = document.getElementById('scrollProgressBar');
  if (!progressBar) return;

  const scrollTop = window.pageYOffset || document.documentElement.scrollTop || document.body.scrollTop || 0;
  const docHeight = (document.documentElement.scrollHeight || document.body.scrollHeight) - window.innerHeight;
  const percent = docHeight > 0 ? (scrollTop / docHeight) * 100 : 0;
  const clamped = Math.min(100, Math.max(0, percent));

  progressBar.style.width = clamped + '%';
}

window.addEventListener('scroll', updateScrollProgress, { passive: true });
window.addEventListener('resize', updateScrollProgress, { passive: true });
document.addEventListener('DOMContentLoaded', updateScrollProgress);
updateScrollProgress();

// =========================================================
// 3. VIDEO LIGHTBOX MODAL
// =========================================================
const videoModal = document.getElementById('videoModal');
const videoModalCard = document.getElementById('videoModalCard');
const openVideoModalBtn = document.getElementById('openVideoModalBtn');
const closeVideoModalBtn = document.getElementById('closeVideoModalBtn');
const modalVideoPlayer = document.getElementById('modalVideoPlayer');
const bgHeroVideo = document.getElementById('bgHeroVideo');

function openModal() {
  if (!videoModal) return;
  videoModal.classList.remove('opacity-0', 'pointer-events-none');
  videoModalCard.classList.remove('scale-95');
  videoModalCard.classList.add('scale-100');

  // Pause background video to save resources
  if (bgHeroVideo) {
    bgHeroVideo.pause();
  }

  // Play modal video unmuted
  if (modalVideoPlayer) {
    modalVideoPlayer.currentTime = 0;
    modalVideoPlayer.muted = false;
    modalVideoPlayer.play().catch(e => console.log('Autoplay prevented:', e));
  }
}

function closeModal() {
  if (!videoModal) return;
  videoModal.classList.add('opacity-0', 'pointer-events-none');
  videoModalCard.classList.remove('scale-100');
  videoModalCard.classList.add('scale-95');

  if (modalVideoPlayer) {
    modalVideoPlayer.pause();
  }

  if (bgHeroVideo) {
    bgHeroVideo.play().catch(e => console.log(e));
  }
}

if (openVideoModalBtn) openVideoModalBtn.addEventListener('click', openModal);
if (closeVideoModalBtn) closeVideoModalBtn.addEventListener('click', closeModal);

if (videoModal) {
  videoModal.addEventListener('click', (e) => {
    if (e.target === videoModal) closeModal();
  });
}

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') closeModal();
});

// =========================================================
// 4. BOOKING FORM -> WHATSAPP INTEGRATION
// =========================================================
const bookingForm = document.getElementById('bookingForm');
if (bookingForm) {
  bookingForm.addEventListener('submit', (e) => {
    e.preventDefault();

    const studentName = document.getElementById('studentName').value.trim();
    const studentPhone = document.getElementById('studentPhone').value.trim();
    const parentPhone = document.getElementById('parentPhone').value.trim();
    const gradeStage = document.getElementById('gradeStage').value;
    const studyMode = document.getElementById('studyMode').value;
    const location = document.getElementById('location').value.trim();

    const message = 
`*طلب اشتراك جديد — منصة وتطبيق فُصْحَى (أستاذ أشرف سليم)*
-----------------------------------
👤 *اسم الطالب:* ${studentName}
📱 *هاتف الطالب:* ${studentPhone}
📞 *هاتف ولي الأمر:* ${parentPhone}
📚 *المرحلة الدراسية:* ${gradeStage}
🏫 *طريقة الحضور:* ${studyMode}
📍 *المحافظة / المنطقة:* ${location}
-----------------------------------
أرجو تفعيل الحساب وتأكيد كود الاشتراك.`;

    const encodedMessage = encodeURIComponent(message);
    const whatsappUrl = `https://wa.me/201000000000?text=${encodedMessage}`;

    window.open(whatsappUrl, '_blank');
  });
}

// =========================================================
// 5. SYSTEM SECTION CARDS DISTINCT ENTRANCE ANIMATIONS (#system)
// =========================================================
function initSystemCardsAnimation() {
  const container = document.getElementById('systemCardsContainer');
  const card1 = document.getElementById('systemCard1');
  const card2 = document.getElementById('systemCard2');
  const card3 = document.getElementById('systemCard3');

  if (!container || !card1 || !card2 || !card3) return;

  // Respect users who prefer reduced motion
  if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    [card1, card2, card3].forEach((card) => {
      card.style.opacity = '1';
      card.style.transform = 'none';
      card.style.filter = 'none';
    });
    return;
  }

  const isMobile = window.innerWidth < 768;
  const xOffset = isMobile ? 80 : 160;
  const yOffsetTop = isMobile ? -80 : -150;

  function setInitialStates() {
    if (typeof gsap === 'undefined') {
      [card1, card2, card3].forEach((c) => {
        c.style.opacity = '1';
        c.style.transform = 'none';
        c.style.filter = 'none';
      });
      return;
    }

    // Card 1: الهبوط من الأعلى للأسفلตาม مسار السهم (Arrow 1: Top to Down ↓)
    gsap.set(card1, {
      opacity: 0,
      x: 0,
      y: yOffsetTop,
      rotation: 0,
      scale: 0.94,
    });
    const icon1 = card1.querySelector('.system-card-icon');
    if (icon1) gsap.set(icon1, { scale: 0.4, opacity: 0 });
    const glow1 = card1.querySelector('.system-card-glow');
    if (glow1) gsap.set(glow1, { scale: 0.7, opacity: 0.4 });

    // Card 2: الانزلاق من أقصى اليسار لليمينตาม مسار السهم (Arrow 2: Left to Right →)
    gsap.set(card2, {
      opacity: 0,
      x: -xOffset,
      y: 15,
      rotation: -2.5,
      scale: 0.93,
    });
    const icon2 = card2.querySelector('.system-card-icon');
    if (icon2) gsap.set(icon2, { scale: 0.4, rotation: 20, opacity: 0 });
    const glow2 = card2.querySelector('.system-card-glow');
    if (glow2) gsap.set(glow2, { scale: 0.7, opacity: 0.4 });

    // Card 3: مسار مقوس من اليمين لليسار مع انحدار ناعم (Arrow 3: Curved Arc Right to Left ←)
    gsap.set(card3, {
      opacity: 0,
      x: xOffset,
      y: -25,
      rotation: 2.5,
      scale: 0.93,
    });
    const icon3 = card3.querySelector('.system-card-icon');
    if (icon3) gsap.set(icon3, { scale: 0.4, rotation: -20, opacity: 0 });
    const glow3 = card3.querySelector('.system-card-glow');
    if (glow3) gsap.set(glow3, { scale: 0.7, opacity: 0.4 });
  }

  setInitialStates();

  let hasAnimated = false;

  window.animateSystemCards = function (force = false) {
    if (hasAnimated && !force) return;
    hasAnimated = true;

    if (typeof gsap === 'undefined') {
      [card1, card2, card3].forEach((c) => {
        c.style.opacity = '1';
        c.style.transform = 'none';
        c.style.filter = 'none';
      });
      return;
    }

    if (force) {
      setInitialStates();
    }

    const tl = gsap.timeline({
      defaults: { ease: 'power3.out' },
    });

    // -------------------------------------------------------------
    // CARD 1: حساب ولي الأمر — مسار السهم 1 (هبوط عمودي من الأعلى واستقرار ناعم)
    // -------------------------------------------------------------
    const icon1 = card1.querySelector('.system-card-icon');
    const glow1 = card1.querySelector('.system-card-glow');

    tl.to(
      card1,
      {
        opacity: 1,
        x: 0,
        y: 0,
        rotation: 0,
        scale: 1,
        duration: 0.85,
        ease: 'back.out(1.15)',
        onComplete: () => {
          gsap.set(card1, { clearProps: 'transform' });
        },
      },
      0
    );

    if (icon1) {
      tl.to(
        icon1,
        {
          scale: 1,
          opacity: 1,
          duration: 0.65,
          ease: 'back.out(2)',
          onComplete: () => {
            gsap.set(icon1, { clearProps: 'transform' });
          },
        },
        0.2
      );
    }

    if (glow1) {
      tl.to(
        glow1,
        {
          scale: 1,
          opacity: 1,
          duration: 1.2,
          ease: 'power2.out',
        },
        0.1
      );
    }

    // -------------------------------------------------------------
    // CARD 2: منتدى النقاش — مسار السهم 2 (انزلاق انسيابي من اليسار إلى اليمين)
    // -------------------------------------------------------------
    const icon2 = card2.querySelector('.system-card-icon');
    const glow2 = card2.querySelector('.system-card-glow');

    tl.to(
      card2,
      {
        opacity: 1,
        x: 0,
        y: 0,
        rotation: 0,
        scale: 1,
        duration: 0.88,
        ease: 'back.out(1.2)',
        onComplete: () => {
          gsap.set(card2, { clearProps: 'transform' });
        },
      },
      0.18
    );

    if (icon2) {
      tl.to(
        icon2,
        {
          scale: 1,
          rotation: 0,
          opacity: 1,
          duration: 0.65,
          ease: 'back.out(2.2)',
          onComplete: () => {
            gsap.set(icon2, { clearProps: 'transform' });
          },
        },
        0.38
      );
    }

    if (glow2) {
      tl.to(
        glow2,
        {
          scale: 1,
          opacity: 1,
          duration: 1.2,
          ease: 'power2.out',
        },
        0.25
      );
    }

    // -------------------------------------------------------------
    // CARD 3: المعجم اللغوي — مسار السهم 3 (مسار مقوس من اليمين إلى اليسار)
    // -------------------------------------------------------------
    const icon3 = card3.querySelector('.system-card-icon');
    const glow3 = card3.querySelector('.system-card-glow');

    tl.to(
      card3,
      {
        opacity: 1,
        x: 0,
        y: 0,
        rotation: 0,
        scale: 1,
        duration: 0.9,
        ease: 'back.out(1.2)',
        onComplete: () => {
          gsap.set(card3, { clearProps: 'transform' });
        },
      },
      0.36
    );

    if (icon3) {
      tl.to(
        icon3,
        {
          scale: 1,
          rotation: 0,
          opacity: 1,
          duration: 0.65,
          ease: 'back.out(2)',
          onComplete: () => {
            gsap.set(icon3, { clearProps: 'transform' });
          },
        },
        0.55
      );
    }

    if (glow3) {
      tl.to(
        glow3,
        {
          scale: 1,
          opacity: 1,
          duration: 1.2,
          ease: 'power2.out',
        },
        0.4
      );
    }
  };

  // IntersectionObserver to trigger when section enters viewport
  if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            if (document.body.classList.contains('is-transitioning')) {
              const checkInterval = setInterval(() => {
                if (!document.body.classList.contains('is-transitioning')) {
                  clearInterval(checkInterval);
                  window.animateSystemCards();
                }
              }, 60);
            } else {
              window.animateSystemCards();
            }
            observer.unobserve(entry.target);
          }
        });
      },
      {
        threshold: 0.15,
        rootMargin: '0px 0px -40px 0px',
      }
    );

    observer.observe(container);
  } else {
    window.animateSystemCards();
  }
}
