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

  // Safety fallback for Hero Typewriter in case intro is bypassed or delayed
  setTimeout(() => {
    if (typeof initHeroTypewriter === 'function') {
      initHeroTypewriter();
    }
  }, 3200);
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
    if (typeof initHeroTypewriter === 'function') initHeroTypewriter();
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
      if (typeof initHeroTypewriter === 'function') initHeroTypewriter();
      return;
    }
    window.addEventListener('load', retryIntro, { once: true });
    return;
  }

  // Use pre-selected initial color or pick a random one
  const color = window.__INITIAL_INTRO_COLOR || pickRandomIntroColor();
  applyIntroTheme(color);

  // Robust path length calculation (safe against iOS 0-return timing bug)
  const rawLength = (path.getTotalLength && path.getTotalLength()) || 0;
  const l = Math.max(Math.ceil(rawLength), 22000) + 100;

  // The intro STARTS FULLY COVERING the entire screen
  // Using explicit pair `${l}px ${l}px` to prevent WebKit modulo wrap/reversal bug on iOS
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
      if (typeof initHeroTypewriter === 'function') initHeroTypewriter();
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

  // Trigger typewriter as the screen opens up
  tl.call(() => {
    if (typeof initHeroTypewriter === 'function') {
      initHeroTypewriter();
    }
  }, [], 0.5);
}

// iOS BFCache restore fix: when the page is restored from back-forward cache,
// ensure completed overlays are completely purged and hidden.
window.addEventListener('pageshow', function (event) {
  if (event.persisted) {
    cleanUpIntroOverlays();
    isIntroAnimating = false;
  }
});


// =========================================================
// HERO REAL-TIME TYPEWRITER EFFECT (تأثير كتابة لحظي)
// =========================================================
let isTypewriterRunning = false;
let hasTypewriterFinished = false;

function initHeroTypewriter() {
  if (isTypewriterRunning || hasTypewriterFinished) return;

  const line1El = document.getElementById('typewriterLine1');
  const line2El = document.getElementById('typewriterLine2');
  const ctaWrap = document.getElementById('heroCtaWrap');

  if (!line1El || !line2El) return;
  isTypewriterRunning = true;

  const text1 = 'من صعوبة العربية';
  const text2 = 'إلى سلاسة فُصْحَى';

  // Responsive, high-contrast typewriter cursor
  const cursor = document.createElement('span');
  cursor.className = 'typewriter-cursor inline-block w-[3px] sm:w-[4px] h-[0.82em] bg-fusha-forest align-middle mr-2 rounded-xs';
  cursor.setAttribute('aria-hidden', 'true');

  line1El.textContent = '';
  line2El.textContent = '';
  line1El.appendChild(cursor);

  let idx1 = 0;
  let idx2 = 0;

  function typeFirstLine() {
    if (idx1 < text1.length) {
      line1El.textContent = text1.slice(0, idx1 + 1);
      line1El.appendChild(cursor);
      idx1++;
      const delay = 45 + Math.random() * 25;
      setTimeout(typeFirstLine, delay);
    } else {
      setTimeout(() => {
        cursor.classList.remove('bg-fusha-forest');
        cursor.classList.add('bg-fusha-olive');
        line2El.appendChild(cursor);
        typeSecondLine();
      }, 260);
    }
  }

  function typeSecondLine() {
    if (idx2 < text2.length) {
      const current = text2.slice(0, idx2 + 1);
      if (current.startsWith('إلى ')) {
        const prefix = '<span class="text-fusha-forest">إلى </span>';
        const brandWord = '<span class="text-fusha-olive font-black">' + current.slice(4) + '</span>';
        line2El.innerHTML = prefix + brandWord;
      } else {
        line2El.innerHTML = '<span class="text-fusha-forest">' + current + '</span>';
      }
      line2El.appendChild(cursor);
      idx2++;
      const delay = 50 + Math.random() * 25;
      setTimeout(typeSecondLine, delay);
    } else {
      isTypewriterRunning = false;
      hasTypewriterFinished = true;

      // Reveal subtitle and CTA buttons with smooth sequential upward glide
      const subtitleEl = document.getElementById('heroSubtitle');

      setTimeout(() => {
        if (subtitleEl) {
          subtitleEl.classList.remove('opacity-0', 'translate-y-2');
          subtitleEl.classList.add('opacity-100', 'translate-y-0');
        }
      }, 150);

      setTimeout(() => {
        if (ctaWrap) {
          ctaWrap.classList.remove('opacity-0', 'translate-y-2');
          ctaWrap.classList.add('opacity-100', 'translate-y-0');
        }
      }, 350);

      // Softly fade out cursor after 1.8 seconds
      setTimeout(() => {
        cursor.style.transition = 'opacity 0.6s ease';
        cursor.style.opacity = '0';
        setTimeout(() => {
          if (cursor.parentNode) cursor.remove();
        }, 600);
      }, 1800);
    }
  }

  typeFirstLine();
}

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
// HERO DIRECT AUDIO CONTROLS & VISUALIZER
// =========================================================
function initHeroAudioControls() {
  const heroAudioToggleBtn = document.getElementById('heroAudioToggleBtn');
  const cardAudioToggleBtn = document.getElementById('cardAudioToggleBtn');
  const heroAudioIcon = document.getElementById('heroAudioIcon');
  const heroAudioLabel = document.getElementById('heroAudioLabel');
  const heroAudioWaves = document.getElementById('heroAudioWaves');
  const cardAudioIcon = document.getElementById('cardAudioIcon');
  const cardAudioLabel = document.getElementById('cardAudioLabel');
  const bgHeroVideo = document.getElementById('bgHeroVideo');

  if (!bgHeroVideo) return;

  function updateAudioUI(isMuted) {
    if (!isMuted) {
      if (heroAudioLabel) heroAudioLabel.textContent = 'كتم صوت الشرح';
      if (heroAudioWaves) {
        heroAudioWaves.classList.remove('hidden');
        heroAudioWaves.classList.add('flex');
      }
      if (cardAudioLabel) cardAudioLabel.textContent = 'صوت مفعّل';
      if (heroAudioIcon) heroAudioIcon.setAttribute('data-lucide', 'volume-x');
      if (cardAudioIcon) cardAudioIcon.setAttribute('data-lucide', 'volume-2');
    } else {
      if (heroAudioLabel) heroAudioLabel.textContent = 'استمع للشرح بالصوت';
      if (heroAudioWaves) {
        heroAudioWaves.classList.remove('flex');
        heroAudioWaves.classList.add('hidden');
      }
      if (cardAudioLabel) cardAudioLabel.textContent = 'صوت';
      if (heroAudioIcon) heroAudioIcon.setAttribute('data-lucide', 'volume-2');
      if (cardAudioIcon) cardAudioIcon.setAttribute('data-lucide', 'volume-x');
    }
    if (window.lucide && typeof window.lucide.createIcons === 'function') {
      window.lucide.createIcons();
    }
  }

  function toggleAudio() {
    const willBeMuted = !bgHeroVideo.muted;
    bgHeroVideo.muted = willBeMuted;
    if (!willBeMuted && bgHeroVideo.paused) {
      bgHeroVideo.play().catch(() => {});
    }
    updateAudioUI(willBeMuted);
  }

  if (heroAudioToggleBtn) heroAudioToggleBtn.addEventListener('click', toggleAudio);
  if (cardAudioToggleBtn) cardAudioToggleBtn.addEventListener('click', toggleAudio);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initHeroAudioControls);
} else {
  initHeroAudioControls();
}

// =========================================================
// ULTRA-FAST HLS STREAMING ENGINE (HTTP Live Streaming)
// =========================================================
function initHeroHlsStreaming() {
  if (!bgHeroVideo) return;

  const hlsUrl = 'assets/hls/hero.m3u8?v=20260918_classroom';

  const ensureBgPlay = () => {
    const playPromise = bgHeroVideo.play();
    if (playPromise !== undefined) {
      playPromise.catch(() => {
        // Fallback: If autoplay was blocked by low-power mode / browser policy, play on first touch/scroll
        const triggerPlay = () => {
          bgHeroVideo.play().catch(() => {});
          ['touchstart', 'scroll', 'click'].forEach(evt => window.removeEventListener(evt, triggerPlay));
        };
        ['touchstart', 'scroll', 'click'].forEach(evt => window.addEventListener(evt, triggerPlay, { passive: true }));
      });
    }
  };

  // 1. Native HLS support (Safari iOS, iPadOS, macOS Safari)
  if (bgHeroVideo.canPlayType('application/vnd.apple.mpegurl')) {
    bgHeroVideo.src = hlsUrl;
    ensureBgPlay();
    return;
  }

  // 2. HLS.js streaming for Chromium, Firefox, Edge, Android
  const attachHls = () => {
    if (typeof Hls !== 'undefined' && Hls.isSupported()) {
      const hls = new Hls({
        enableWorker: true,
        lowLatencyMode: true,
        backBufferLength: 4,
        maxBufferLength: 6,
        maxMaxBufferLength: 10,
        startLevel: -1,
      });
      hls.loadSource(hlsUrl);
      hls.attachMedia(bgHeroVideo);
      hls.on(Hls.Events.MANIFEST_PARSED, ensureBgPlay);
      hls.on(Hls.Events.ERROR, (event, data) => {
        if (data.fatal) {
          hls.destroy();
          ensureBgPlay();
        }
      });
      return true;
    }
    return false;
  };

  if (!attachHls()) {
    // If Hls.js script is still loading asynchronously
    window.addEventListener('load', () => {
      if (!attachHls()) {
        ensureBgPlay();
      }
    });
    // Meanwhile start playback of fallback source immediately
    ensureBgPlay();
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initHeroHlsStreaming);
} else {
  initHeroHlsStreaming();
}

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

  const isMobile = window.innerWidth < 1024;
  const xDistance = Math.max(window.innerWidth * 0.45, 550);
  const yTopDistance = 380;

  function setInitialStates() {
    if (typeof gsap === 'undefined') {
      [card1, card2, card3].forEach((c) => {
        c.style.opacity = '1';
        c.style.transform = 'none';
        c.style.filter = 'none';
      });
      return;
    }

    if (isMobile) {
      // Mobile / Tablet: Smooth upward reveal with zero negative Y to prevent collision with sticky column
      [card1, card2, card3].forEach((card) => {
        gsap.set(card, {
          opacity: 0,
          x: 0,
          y: 30,
          rotation: 0,
          scale: 0.98,
        });
        const icon = card.querySelector('.system-card-icon');
        if (icon) gsap.set(icon, { scale: 0.8, opacity: 0.5 });
      });
      return;
    }

    // Desktop: Dynamic directional entrance (Top / Left / Right)
    // Card 1: الهبوط من مسافة بعيدة جداً أعلى الشاشة (Far Top -> Down ↓)
    gsap.set(card1, {
      opacity: 0,
      x: 0,
      y: -yTopDistance,
      rotation: 0,
      scale: 0.92,
      zIndex: 30,
    });
    const icon1 = card1.querySelector('.system-card-icon');
    if (icon1) gsap.set(icon1, { scale: 0.4, opacity: 0 });
    const glow1 = card1.querySelector('.system-card-glow');
    if (glow1) gsap.set(glow1, { scale: 0.7, opacity: 0.4 });

    // Card 2: انزلاق من مسافة بعيدة جداً أقصى يسار الشاشة (Arrow 2: Far Left to Right →)
    gsap.set(card2, {
      opacity: 0,
      x: -xDistance,
      y: 25,
      rotation: -3.5,
      scale: 0.88,
      zIndex: 25,
    });
    const icon2 = card2.querySelector('.system-card-icon');
    if (icon2) gsap.set(icon2, { scale: 0.4, rotation: 20, opacity: 0 });
    const glow2 = card2.querySelector('.system-card-glow');
    if (glow2) gsap.set(glow2, { scale: 0.7, opacity: 0.4 });

    // Card 3: مسار مقوس من مسافة بعيدة جداً أقصى يمين الشاشة (Arrow 3: Far Right to Left ←)
    gsap.set(card3, {
      opacity: 0,
      x: xDistance,
      y: -45,
      rotation: 3.5,
      scale: 0.88,
      zIndex: 25,
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

    if (isMobile) {
      // High-performance, clean mobile entrance: zero layout shift, zero collision
      const mobileTl = gsap.timeline({ defaults: { ease: 'power2.out' } });
      [card1, card2, card3].forEach((card, idx) => {
        const icon = card.querySelector('.system-card-icon');
        mobileTl.to(
          card,
          {
            opacity: 1,
            y: 0,
            scale: 1,
            duration: 0.5,
            onComplete: () => {
              gsap.set(card, { clearProps: 'transform,opacity,scale' });
            },
          },
          idx * 0.12
        );
        if (icon) {
          mobileTl.to(icon, { scale: 1, opacity: 1, duration: 0.35 }, idx * 0.12 + 0.08);
        }
      });
      return;
    }

    const tl = gsap.timeline({
      defaults: { ease: 'power3.out' },
    });

    // -------------------------------------------------------------
    // CARD 1: حساب ولي الأمر — هبوط فوق الهيرو واللاندينج بيج (Far Top -> Down ↓)
    // -------------------------------------------------------------
    const icon1 = card1.querySelector('.system-card-icon');
    const glow1 = card1.querySelector('.system-card-glow');

    tl.to(
      card1,
      {
        opacity: 1,
        duration: 0.35,
        ease: 'power2.out',
      },
      0
    );

    tl.to(
      card1,
      {
        x: 0,
        y: 0,
        rotation: 0,
        scale: 1,
        duration: 1.05,
        ease: 'power3.out',
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
          duration: 0.7,
          ease: 'back.out(2)',
          onComplete: () => {
            gsap.set(icon1, { clearProps: 'transform' });
          },
        },
        0.35
      );
    }

    if (glow1) {
      tl.to(
        glow1,
        {
          scale: 1,
          opacity: 1,
          duration: 1.4,
          ease: 'power2.out',
        },
        0.2
      );
    }

    // -------------------------------------------------------------
    // CARD 2: منتدى النقاش — اندفاع من مسافة بعيدة يسار الشاشة (Far Left -> Right →)
    // -------------------------------------------------------------
    const icon2 = card2.querySelector('.system-card-icon');
    const glow2 = card2.querySelector('.system-card-glow');

    tl.to(
      card2,
      {
        opacity: 1,
        duration: 0.35,
        ease: 'power2.out',
      },
      0.2
    );

    tl.to(
      card2,
      {
        x: 0,
        y: 0,
        rotation: 0,
        scale: 1,
        duration: 1.1,
        ease: 'power3.out',
        onComplete: () => {
          gsap.set(card2, { clearProps: 'transform' });
        },
      },
      0.2
    );

    if (icon2) {
      tl.to(
        icon2,
        {
          scale: 1,
          rotation: 0,
          opacity: 1,
          duration: 0.7,
          ease: 'back.out(2.2)',
          onComplete: () => {
            gsap.set(icon2, { clearProps: 'transform' });
          },
        },
        0.55
      );
    }

    if (glow2) {
      tl.to(
        glow2,
        {
          scale: 1,
          opacity: 1,
          duration: 1.4,
          ease: 'power2.out',
        },
        0.35
      );
    }

    // -------------------------------------------------------------
    // CARD 3: المعجم اللغوي — اندفاع مقوس من مسافة بعيدة يمين الشاشة (Far Right -> Left ←)
    // -------------------------------------------------------------
    const icon3 = card3.querySelector('.system-card-icon');
    const glow3 = card3.querySelector('.system-card-glow');

    tl.to(
      card3,
      {
        opacity: 1,
        duration: 0.35,
        ease: 'power2.out',
      },
      0.4
    );

    tl.to(
      card3,
      {
        x: 0,
        y: 0,
        rotation: 0,
        scale: 1,
        duration: 1.15,
        ease: 'power3.out',
        onComplete: () => {
          gsap.set(card3, { clearProps: 'transform' });
        },
      },
      0.4
    );

    if (icon3) {
      tl.to(
        icon3,
        {
          scale: 1,
          rotation: 0,
          opacity: 1,
          duration: 0.7,
          ease: 'back.out(2)',
          onComplete: () => {
            gsap.set(icon3, { clearProps: 'transform' });
          },
        },
        0.75
      );
    }

    if (glow3) {
      tl.to(
        glow3,
        {
          scale: 1,
          opacity: 1,
          duration: 1.4,
          ease: 'power2.out',
        },
        0.55
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

// =========================================================
// 6. HERO SCROLL PARALLAX & CURTAIN OVERLAP (Inspired by c4-gym.com)
// =========================================================
function initHeroParallaxScroll() {
  const heroSection = document.getElementById('hero');
  const heroMedia = document.getElementById('heroMedia');
  const heroContent = document.getElementById('heroContent');
  const heroScrubOverlay = document.getElementById('heroScrubOverlay');
  const heroScrollCue = document.getElementById('heroScrollCue');

  if (!heroSection) return;

  let ticking = false;

  const onScroll = () => {
    if (!ticking) {
      window.requestAnimationFrame(() => {
        const scrollY = window.pageYOffset || document.documentElement.scrollTop;
        const vh = window.innerHeight || document.documentElement.clientHeight;

        // Only apply parallax on desktop viewports (>= 1024px) where #hero is sticky
        if (window.innerWidth < 1024) {
          if (heroMedia && heroMedia.style.transform) heroMedia.style.transform = '';
          if (heroContent && heroContent.style.transform) {
            heroContent.style.transform = '';
            heroContent.style.opacity = '1';
          }
          ticking = false;
          return;
        }

        // Progress from 0 to 1 as the user scrolls through the hero viewport
        const progress = Math.min(Math.max(scrollY / vh, 0), 1);

        if (scrollY <= vh * 1.5) {
          // 1. Subtle parallax scale on full-screen background video
          if (heroMedia) {
            heroMedia.style.transform = 'scale(' + (1.02 + progress * 0.06) + ')';
          }

          // 2. Progressive darkening scrub overlay
          if (heroScrubOverlay) {
            heroScrubOverlay.style.opacity = (progress * 0.65).toFixed(3);
          }

          // 3. Hero content smooth upward drift and fade out
          if (heroContent) {
            const translateY = -(progress * 80);
            const opacity = Math.max(1 - progress * 1.5, 0);
            heroContent.style.transform = 'translate3d(0, ' + translateY + 'px, 0)';
            heroContent.style.opacity = opacity.toFixed(3);
          }

          // 4. Fade scroll cue quickly
          if (heroScrollCue) {
            heroScrollCue.style.opacity = Math.max(1 - progress * 3, 0).toFixed(3);
          }
        }
        ticking = false;
      });
      ticking = true;
    }
  };

  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();
}

// Global initialization on DOM ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    if (typeof initSystemCardsAnimation === 'function') initSystemCardsAnimation();
    if (typeof initHeroParallaxScroll === 'function') initHeroParallaxScroll();
  });
} else {
  if (typeof initSystemCardsAnimation === 'function') initSystemCardsAnimation();
  if (typeof initHeroParallaxScroll === 'function') initHeroParallaxScroll();
}

// =========================================================
// 7. UX & ACCESSIBILITY ENHANCEMENTS MODULE
// =========================================================
(function initUxEnhancements() {
  var prefersReducedMotion =
    window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* 7.1 Reading Progress Bar */
  function initScrollProgress() {
    var bar = document.getElementById('scrollProgressBar');
    if (!bar) return;
    var ticking = false;
    var update = function () {
      var scrollTop = window.pageYOffset || document.documentElement.scrollTop;
      var docHeight = document.documentElement.scrollHeight - window.innerHeight;
      var progress = docHeight > 0 ? Math.min(100, (scrollTop / docHeight) * 100) : 0;
      bar.style.width = progress + '%';
      ticking = false;
    };
    window.addEventListener('scroll', function () {
      if (!ticking) { window.requestAnimationFrame(update); ticking = true; }
    }, { passive: true });
    update();
  }

  /* 7.2 Back to Top Button */
  function initBackToTop() {
    var btn = document.getElementById('backToTopBtn');
    if (!btn) return;
    var ticking = false;
    var toggle = function () {
      var show = (window.pageYOffset || 0) > window.innerHeight * 0.7;
      btn.classList.toggle('is-visible', show);
      ticking = false;
    };
    window.addEventListener('scroll', function () {
      if (!ticking) { window.requestAnimationFrame(toggle); ticking = true; }
    }, { passive: true });
    btn.addEventListener('click', function () {
      window.scrollTo({ top: 0, behavior: prefersReducedMotion ? 'auto' : 'smooth' });
      btn.blur();
    });
    toggle();
  }

  /* 7.3 Scroll-Spy: highlight active nav link */
  function initScrollSpy() {
    var links = document.querySelectorAll('[data-navlink]');
    if (!links.length || !('IntersectionObserver' in window)) return;
    var map = {};
    links.forEach(function (l) { map[l.getAttribute('data-navlink')] = l; });
    var sections = Object.keys(map).map(function (id) { return document.getElementById(id); }).filter(Boolean);
    if (!sections.length) return;
    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          links.forEach(function (l) { l.classList.remove('nav-link-active'); });
          var link = map[entry.target.id];
          if (link) link.classList.add('nav-link-active');
        }
      });
    }, { rootMargin: '-40% 0px -55% 0px', threshold: 0 });
    sections.forEach(function (s) { observer.observe(s); });
  }

  /* 7.4 Mobile Menu: ARIA state + ESC to close */
  function initMobileMenuA11y() {
    var btn = document.getElementById('mobileMenuBtn');
    var menu = document.getElementById('mobileMenu');
    if (!btn || !menu) return;
    btn.addEventListener('click', function () {
      var isOpen = !menu.classList.contains('hidden');
      btn.setAttribute('aria-expanded', String(isOpen));
      btn.setAttribute('aria-label', isOpen ? 'إغلاق القائمة' : 'فتح القائمة');
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && !menu.classList.contains('hidden')) {
        menu.classList.add('hidden');
        btn.setAttribute('aria-expanded', 'false');
        btn.setAttribute('aria-label', 'فتح القائمة');
        btn.focus();
      }
    });
    menu.querySelectorAll('.mobile-link').forEach(function (link) {
      link.addEventListener('click', function () {
        btn.setAttribute('aria-expanded', 'false');
        btn.setAttribute('aria-label', 'فتح القائمة');
      });
    });
  }


  /* 7.5 Video Modal: focus trap + scroll lock + focus restore */
  function initModalA11y() {
    var modal = document.getElementById('videoModal');
    if (!modal) return;
    var lastFocused = null;
    var FOCUSABLE = 'a[href], button:not([disabled]), video[controls], [tabindex]:not([tabindex="-1"])';
    var trapFocus = function (e) {
      if (e.key !== 'Tab') return;
      var nodes = modal.querySelectorAll(FOCUSABLE);
      if (!nodes.length) return;
      var first = nodes[0];
      var last = nodes[nodes.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    };
    var observer = new MutationObserver(function () {
      var isOpen = !modal.classList.contains('pointer-events-none');
      if (isOpen) {
        lastFocused = document.activeElement;
        document.body.classList.add('modal-open');
        modal.addEventListener('keydown', trapFocus);
        var closeBtn = document.getElementById('closeVideoModalBtn');
        if (closeBtn) setTimeout(function () { closeBtn.focus(); }, 120);
      } else {
        document.body.classList.remove('modal-open');
        modal.removeEventListener('keydown', trapFocus);
        if (lastFocused && typeof lastFocused.focus === 'function') { lastFocused.focus(); lastFocused = null; }
      }
    });
    observer.observe(modal, { attributes: true, attributeFilter: ['class'] });
  }

  /* 7.6 Toast Notifications */
  var toastTimer = null;
  window.fushaToast = function showToast(message, type, duration) {
    type = type || 'success'; duration = duration || 4000;
    var toast = document.getElementById('fushaToast');
    if (!toast) return;
    clearTimeout(toastTimer);
    toast.className = type === 'error' ? 'toast-error' : 'toast-success';
    var icon = type === 'error'
      ? '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>'
      : '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0;color:#EAA72E"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>';
    toast.innerHTML = icon + '<span>' + message + '</span>';
    requestAnimationFrame(function () { toast.classList.add('is-visible'); });
    toastTimer = setTimeout(function () { toast.classList.remove('is-visible'); }, duration);
  };


  /* 7.7 Booking Form: validation + loading + feedback */
  function initBookingFormUx() {
    var form = document.getElementById('bookingForm');
    if (!form) return;
    var fields = [
      { id: 'studentName', min: 3 },
      { id: 'studentPhone', phone: true },
      { id: 'parentPhone', phone: true },
      { id: 'location', min: 2 },
    ];
    var validateField = function (f) {
      var el = document.getElementById(f.id);
      if (!el) return true;
      var value = el.value.trim();
      var valid = f.phone ? /^01[0-9]{9}$/.test(value.replace(/\s/g, '')) : value.length >= (f.min || 1);
      el.classList.toggle('input-error', !valid);
      if (!valid) el.setAttribute('aria-invalid', 'true'); else el.removeAttribute('aria-invalid');
      return valid;
    };
    fields.forEach(function (f) {
      var el = document.getElementById(f.id);
      if (el) {
        el.classList.add('form-input-fusha');
        el.addEventListener('blur', function () { validateField(f); });
        el.addEventListener('input', function () { if (el.classList.contains('input-error')) validateField(f); });
      }
    });
    form.addEventListener('submit', function (e) {
      var allValid = fields.map(validateField).every(Boolean);
      if (!allValid) {
        e.preventDefault();
        e.stopImmediatePropagation();
        window.fushaToast('برجاء مراجعة البيانات — تأكد أن أرقام الهواتف 11 رقمًا وتبدأ بـ 01', 'error', 5000);
        var firstError = form.querySelector('.input-error');
        if (firstError) firstError.focus();
        return;
      }
      var submitBtn = form.querySelector('[type="submit"]');
      if (submitBtn) {
        var original = submitBtn.innerHTML;
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<span class="btn-spinner" aria-hidden="true"></span><span style="margin-inline-start:8px">جارٍ تجهيز طلبك...</span>';
        setTimeout(function () {
          submitBtn.disabled = false;
          submitBtn.innerHTML = original;
          window.fushaToast('تم تجهيز طلب الحجز! أكمل الإرسال عبر واتساب', 'success', 6000);
        }, 1200);
      }
    }, true);
  }

  /* 7.8 Lazy images fade-in */
  function initLazyImageFade() {
    document.querySelectorAll('img[loading="lazy"]').forEach(function (img) {
      if (img.complete && img.naturalWidth > 0) img.classList.add('is-loaded');
      else img.addEventListener('load', function () { img.classList.add('is-loaded'); }, { once: true });
    });
  }

  /* 7.9 Generic reveal-on-scroll */
  function initRevealOnScroll() {
    if (prefersReducedMotion || !('IntersectionObserver' in window)) return;
    var targets = document.querySelectorAll('#courses .fusha-card, #app .fusha-card, #centers .fusha-card');
    if (!targets.length) return;
    targets.forEach(function (t) { t.classList.add('reveal-on-scroll'); });
    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry, i) {
        if (entry.isIntersecting) {
          setTimeout(function () { entry.target.classList.add('is-revealed'); }, i * 90);
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -30px 0px' });
    targets.forEach(function (t) { observer.observe(t); });
  }

  /* 7.10 Reduced motion: bypass intro overlay instantly */
  function respectReducedMotionForIntro() {
    if (!prefersReducedMotion) return;
    var svg = document.getElementById('scribbleSvg');
    var logoContainer = document.getElementById('logoContainer');
    if (svg) svg.style.display = 'none';
    if (logoContainer) logoContainer.style.display = 'none';
    document.body.classList.remove('is-transitioning');
    if (typeof initHeroTypewriter === 'function') setTimeout(initHeroTypewriter, 100);
  }

  var boot = function () {
    initScrollProgress();
    initBackToTop();
    initScrollSpy();
    initMobileMenuA11y();
    initModalA11y();
    initBookingFormUx();
    initLazyImageFade();
    initRevealOnScroll();
    respectReducedMotionForIntro();
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();

// =========================================================
// 8. DEEP UX PHASE 2: COUNTERS, STICKY CTA, MISC
// =========================================================
(function initUxPhase2() {
  var prefersReducedMotion =
    window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* 8.2 Sticky mobile CTA: show after hero, hide near booking form */
  function initStickyMobileCta() {
    var bar = document.getElementById('stickyMobileCta');
    var hero = document.getElementById('hero');
    var booking = document.getElementById('booking');
    if (!bar || !hero) return;

    var heroVisible = true;
    var bookingVisible = false;

    var update = function () {
      var show = !heroVisible && !bookingVisible;
      bar.classList.toggle('is-visible', show);
      // Shift back-to-top button above the bar on mobile
      var btt = document.getElementById('backToTopBtn');
      if (btt && window.innerWidth < 1024) {
        btt.style.bottom = show ? '92px' : '16px';
      }
    };

    if ('IntersectionObserver' in window) {
      var heroObs = new IntersectionObserver(function (entries) {
        entries.forEach(function (e) { heroVisible = e.isIntersecting; update(); });
      }, { threshold: 0.15 });
      heroObs.observe(hero);
      if (booking) {
        var bookObs = new IntersectionObserver(function (entries) {
          entries.forEach(function (e) { bookingVisible = e.isIntersecting; update(); });
        }, { threshold: 0.08 });
        bookObs.observe(booking);
      }
    }
    update();
  }

  /* 8.4 Mark active nav link with aria-current for screen readers */
  function initAriaCurrent() {
    var links = document.querySelectorAll('[data-navlink]');
    if (!links.length) return;
    var observer = new MutationObserver(function () {
      links.forEach(function (l) {
        if (l.classList.contains('nav-link-active')) l.setAttribute('aria-current', 'true');
        else l.removeAttribute('aria-current');
      });
    });
    links.forEach(function (l) {
      observer.observe(l, { attributes: true, attributeFilter: ['class'] });
    });
  }

  /* 8.5 Global JS error guard: never break the page silently */
  window.addEventListener('error', function (e) {
    if (e && e.message) {
      // eslint-disable-next-line no-console
      console.warn('[Fusha] Non-fatal error caught:', e.message);
    }
  }, true);

  var boot = function () {
    initStickyMobileCta();
    initAriaCurrent();
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
