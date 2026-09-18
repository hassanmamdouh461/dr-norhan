/**
 * فُصْحَى | مدير شريط التنقل والتفاعل الموحد
 * نظام ملاحة متطور فائق الأناقة والانسجام البصري
 */

document.addEventListener('DOMContentLoaded', () => {
  initNavbarAuth();
  initNavbarActiveLinks();
  initMobileDrawer();
  if (window.lucide) {
    window.lucide.createIcons();
  }
});

function initNavbarAuth() {
  const authContainer = document.getElementById('navbar-auth-actions');
  if (!authContainer) return;

  const user = window.api ? window.api.getUser() : null;
  const isLoggedIn = window.api && window.api.isLoggedIn() && user;

  if (isLoggedIn) {
    const fullName = user.full_name || 'طالب فصحى';
    const firstName = fullName.trim().split(' ')[0] || 'طالب';
    const initial = firstName.charAt(0) || 'ف';
    const grade = user.grade || 'الصف الثالث الثانوي';
    const phone = user.phone || user.email || 'طالب مسجل';
    const initialBalance = user.wallet_balance ?? user.balance ?? 0;

    authContainer.innerHTML = `
      <div class="relative flex items-center gap-2 sm:gap-2.5">
        <!-- Live Wallet Pill -->
        <a href="wallet.html" id="navWalletPill" class="flex items-center gap-2 px-3 py-1.5 sm:py-2 rounded-xl bg-stone-100 hover:bg-stone-200/80 border border-stone-200/90 text-xs font-bold text-fusha-forest transition-all shadow-2xs group shrink-0" title="المحفظة وشحن الرصيد">
          <span class="w-6 h-6 rounded-lg bg-fusha-sun/20 text-fusha-forest flex items-center justify-center shrink-0">
            <i data-lucide="wallet" class="w-3.5 h-3.5 text-fusha-forest"></i>
          </span>
          <div class="flex items-baseline gap-1">
            <span id="navWalletBalance" class="font-alexandria font-bold text-fusha-forest">${initialBalance}</span>
            <span class="text-[10px] text-stone-500 font-medium">ج.م</span>
          </div>
          <span class="hidden sm:inline-flex items-center text-[10px] bg-fusha-sun hover:bg-fusha-sunHover text-fusha-forestDark px-1.5 py-0.5 rounded-md font-extrabold transition-colors mr-0.5">
            + شحن
          </span>
        </a>

        <!-- User Profile Dropdown -->
        <div class="relative" id="navUserMenuContainer">
          <button type="button" id="navUserMenuBtn" class="flex items-center gap-2 p-1 pe-2.5 sm:pe-3 rounded-2xl bg-white hover:bg-stone-50 border border-stone-200/90 transition shadow-2xs group focus:outline-hidden cursor-pointer" aria-expanded="false" aria-haspopup="true">
            <div class="w-8 h-8 rounded-xl bg-gradient-to-br from-fusha-forest to-fusha-forestLight text-white flex items-center justify-center font-alexandria font-bold text-xs shadow-xs border border-white/20 shrink-0">
              ${initial}
            </div>
            <div class="hidden sm:flex flex-col text-start leading-none">
              <span class="text-xs font-bold text-fusha-forest truncate max-w-[100px] sm:max-w-[120px] mb-0.5">${firstName}</span>
              <span class="text-[10px] text-stone-400 font-medium truncate max-w-[100px]">${grade}</span>
            </div>
            <i data-lucide="chevron-down" id="navUserMenuChevron" class="w-3.5 h-3.5 text-stone-400 group-hover:text-fusha-forest transition-transform duration-200"></i>
          </button>

          <!-- Dropdown Card -->
          <div id="navUserMenu" class="absolute end-0 top-full mt-2 w-64 bg-white rounded-2xl shadow-xl border border-stone-200/90 py-2 hidden z-50 animate-in fade-in slide-in-from-top-1 duration-150">
            <!-- User Info Header -->
            <div class="px-4 py-3 border-b border-stone-100">
              <div class="flex items-center gap-3">
                <div class="w-10 h-10 rounded-xl bg-gradient-to-br from-fusha-forest to-fusha-forestLight text-white flex items-center justify-center font-alexandria font-bold text-sm shadow-xs shrink-0">
                  ${initial}
                </div>
                <div class="overflow-hidden">
                  <p class="text-xs font-bold text-fusha-forest truncate leading-tight">${fullName}</p>
                  <p class="text-[11px] text-stone-500 font-medium truncate mt-0.5">${phone}</p>
                </div>
              </div>
              <div class="flex items-center gap-2 mt-2.5">
                <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-emerald-50 text-emerald-700 text-[10px] font-bold border border-emerald-200/50">
                  <span class="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                  ${grade}
                </span>
                <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-fusha-sun/15 text-fusha-forestDark text-[10px] font-bold">
                  <i data-lucide="award" class="w-3 h-3 text-fusha-sun"></i>
                  <span id="navMenuPoints">${user.points ?? 0} نقطة</span>
                </span>
              </div>
            </div>

            <!-- Quick Links -->
            <div class="py-1.5 text-xs font-bold text-stone-700">
              <a href="dashboard.html" class="flex items-center gap-2.5 px-4 py-2 hover:bg-stone-50 hover:text-fusha-forest transition">
                <i data-lucide="layout-dashboard" class="w-4 h-4 text-stone-400"></i>
                <span>لوحة التحكم الرئيسية</span>
              </a>
              <a href="courses.html" class="flex items-center gap-2.5 px-4 py-2 hover:bg-stone-50 hover:text-fusha-forest transition">
                <i data-lucide="book-open" class="w-4 h-4 text-stone-400"></i>
                <span>المناهج والمحاضرات</span>
              </a>
              <a href="bank.html" class="flex items-center gap-2.5 px-4 py-2 hover:bg-stone-50 hover:text-fusha-forest transition">
                <i data-lucide="layers" class="w-4 h-4 text-stone-400"></i>
                <span>بنك الأسئلة والتدريبات</span>
              </a>
              <a href="dictionary.html" class="flex items-center gap-2.5 px-4 py-2 hover:bg-stone-50 hover:text-fusha-forest transition">
                <i data-lucide="book-marked" class="w-4 h-4 text-stone-400"></i>
                <span>معجم فُصْحَى اللغوي</span>
              </a>
              <a href="wallet.html" class="flex items-center gap-2.5 px-4 py-2 hover:bg-stone-50 hover:text-fusha-forest transition">
                <i data-lucide="wallet" class="w-4 h-4 text-stone-400"></i>
                <span>المحفظة وشحن الكروت</span>
              </a>
              <a href="profile.html" class="flex items-center gap-2.5 px-4 py-2 hover:bg-stone-50 hover:text-fusha-forest transition">
                <i data-lucide="settings" class="w-4 h-4 text-stone-400"></i>
                <span>الملف الشخصي وإدارة الأجهزة</span>
              </a>
            </div>

            <!-- Logout -->
            <div class="border-t border-stone-100 pt-1 mt-1">
              <button type="button" id="navLogoutBtn" class="w-full flex items-center gap-2.5 px-4 py-2 text-xs font-bold text-red-600 hover:bg-red-50 transition cursor-pointer">
                <i data-lucide="log-out" class="w-4 h-4 text-red-500"></i>
                <span>تسجيل الخروج</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    `;

    // Dropdown toggling logic
    const menuBtn = document.getElementById('navUserMenuBtn');
    const menu = document.getElementById('navUserMenu');
    const chevron = document.getElementById('navUserMenuChevron');
    const logoutBtn = document.getElementById('navLogoutBtn');

    if (menuBtn && menu) {
      menuBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const isOpen = !menu.classList.contains('hidden');
        if (isOpen) {
          menu.classList.add('hidden');
          if (chevron) chevron.classList.remove('rotate-180');
          menuBtn.setAttribute('aria-expanded', 'false');
        } else {
          menu.classList.remove('hidden');
          if (chevron) chevron.classList.add('rotate-180');
          menuBtn.setAttribute('aria-expanded', 'true');
        }
      });

      document.addEventListener('click', (e) => {
        if (!menu.contains(e.target) && !menuBtn.contains(e.target)) {
          menu.classList.add('hidden');
          if (chevron) chevron.classList.remove('rotate-180');
          menuBtn.setAttribute('aria-expanded', 'false');
        }
      });

      document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && !menu.classList.contains('hidden')) {
          menu.classList.add('hidden');
          if (chevron) chevron.classList.remove('rotate-180');
          menuBtn.setAttribute('aria-expanded', 'false');
        }
      });
    }

    if (logoutBtn) {
      logoutBtn.addEventListener('click', () => {
        if (window.api && window.api.auth) {
          window.api.auth.logout();
        } else {
          localStorage.clear();
          window.location.href = 'index.html';
        }
      });
    }

    // Background fetch to update wallet balance and points seamlessly
    if (window.api && window.api.wallet) {
      window.api.wallet.get().then((data) => {
        if (data && typeof data.balance !== 'undefined') {
          const balanceEl = document.getElementById('navWalletBalance');
          if (balanceEl) balanceEl.textContent = data.balance;
          const pointsEl = document.getElementById('navMenuPoints');
          if (pointsEl && typeof data.points !== 'undefined') {
            pointsEl.textContent = `${data.points} نقطة`;
          }
        }
      }).catch(() => {});
    }

  } else {
    // Guest state
    authContainer.innerHTML = `
      <div class="flex items-center gap-2 sm:gap-3">
        <a href="login.html" class="inline-flex items-center gap-1.5 px-3 sm:px-4 py-2 text-xs sm:text-sm font-bold text-fusha-forest hover:text-fusha-forestLight transition">
          <i data-lucide="log-in" class="w-4 h-4"></i>
          <span>تسجيل الدخول</span>
        </a>
        <a href="login.html?tab=register" class="inline-flex items-center gap-1.5 px-3.5 sm:px-5 py-2 sm:py-2.5 rounded-xl bg-fusha-forest text-white text-xs sm:text-sm font-bold hover:bg-fusha-forestLight transition shadow-md shadow-fusha-forest/10">
          <span>اشترك مجاناً</span>
          <i data-lucide="arrow-left" class="w-4 h-4"></i>
        </a>
      </div>
    `;
  }
}

function initNavbarActiveLinks() {
  const currentPath = window.location.pathname.toLowerCase();
  let pageName = currentPath.split('/').pop() || 'index.html';
  if (pageName.includes('?')) pageName = pageName.split('?')[0];

  // Map to main section
  let activeSection = 'index';
  if (pageName === 'dashboard.html' || pageName === '') activeSection = 'dashboard';
  else if (pageName === 'courses.html' || pageName === 'course-details.html' || pageName === 'lesson.html') activeSection = 'courses';
  else if (pageName === 'bank.html') activeSection = 'bank';
  else if (pageName === 'dictionary.html') activeSection = 'dictionary';
  else if (pageName === 'parent.html') activeSection = 'parent';
  else if (pageName === 'wallet.html') activeSection = 'wallet';
  else if (pageName === 'profile.html') activeSection = 'profile';

  // Update desktop links
  const navContainer = document.getElementById('navbar-links') || document.querySelector('header nav');
  if (navContainer) {
    const links = navContainer.querySelectorAll('a');
    links.forEach(link => {
      const href = (link.getAttribute('href') || '').toLowerCase();
      const isMatch = 
        (activeSection === 'dashboard' && href.includes('dashboard.html')) ||
        (activeSection === 'courses' && href.includes('courses.html')) ||
        (activeSection === 'bank' && href.includes('bank.html')) ||
        (activeSection === 'dictionary' && href.includes('dictionary.html')) ||
        (activeSection === 'parent' && href.includes('parent.html')) ||
        (activeSection === 'wallet' && href.includes('wallet.html')) ||
        (activeSection === 'index' && (href === 'index.html' || href === '/' || href.startsWith('#')));

      // Remove legacy yellow underlines and borders
      link.classList.remove('border-b-2', 'border-fusha-sun', 'pb-1', 'text-fusha-forestLight');

      if (isMatch) {
        link.className = 'px-3.5 py-2 rounded-xl bg-fusha-forest text-white font-bold text-xs sm:text-sm shadow-xs transition-all flex items-center gap-1.5';
      } else {
        link.className = 'px-3.5 py-2 rounded-xl text-stone-600 hover:text-fusha-forest hover:bg-stone-100 font-bold text-xs sm:text-sm transition-all flex items-center gap-1.5';
      }
    });
  }
}

function initMobileDrawer() {
  let drawer = document.getElementById('fushaMobileDrawer');
  let overlay = document.getElementById('fushaMobileOverlay');

  // If mobile drawer doesn't exist on page, inject it dynamically
  if (!drawer) {
    const user = window.api ? window.api.getUser() : null;
    const isLoggedIn = window.api && window.api.isLoggedIn() && user;
    const fullName = user ? (user.full_name || 'طالب فصحى') : '';
    const grade = user ? (user.grade || 'الصف الثالث الثانوي') : '';
    const initial = user ? (fullName.charAt(0) || 'ف') : '';
    const balance = user ? (user.wallet_balance ?? user.balance ?? 0) : 0;

    const drawerHtml = `
      <div id="fushaMobileOverlay" class="lg:hidden"></div>
      <aside id="fushaMobileDrawer" class="lg:hidden">
        <!-- Drawer Header -->
        <div class="p-4 border-b border-stone-100 flex items-center justify-between">
          <div class="flex items-center gap-2.5">
            <img src="assets/fusha-brand-logo.png" alt="فصحى" class="h-8 w-auto object-contain" />
            <span class="text-xs font-alexandria font-bold text-fusha-forest">منصة فُصْحَى</span>
          </div>
          <button type="button" id="fushaMobileClose" class="p-2 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-600 transition cursor-pointer" aria-label="إغلاق">
            <i data-lucide="x" class="w-4 h-4"></i>
          </button>
        </div>

        <!-- Student Profile Card in Drawer (if logged in) -->
        ${isLoggedIn ? `
          <div class="p-4 bg-stone-50/80 border-b border-stone-100">
            <div class="flex items-center gap-3 mb-3">
              <div class="w-10 h-10 rounded-xl bg-gradient-to-br from-fusha-forest to-fusha-forestLight text-white flex items-center justify-center font-bold text-sm shadow-xs">
                ${initial}
              </div>
              <div class="overflow-hidden">
                <h4 class="text-xs font-bold text-fusha-forest truncate">${fullName}</h4>
                <p class="text-[11px] text-stone-500 font-medium">${grade}</p>
              </div>
            </div>
            <div class="grid grid-cols-2 gap-2">
              <a href="wallet.html" class="p-2.5 rounded-xl bg-white border border-stone-200/80 flex items-center gap-2 hover:border-fusha-sun transition">
                <i data-lucide="wallet" class="w-4 h-4 text-fusha-sun"></i>
                <div class="text-start">
                  <span class="text-[10px] text-stone-400 block font-medium">الرصيد</span>
                  <span class="text-xs font-bold text-fusha-forest">${balance} ج.م</span>
                </div>
              </a>
              <a href="profile.html" class="p-2.5 rounded-xl bg-white border border-stone-200/80 flex items-center gap-2 hover:border-fusha-forest transition">
                <i data-lucide="award" class="w-4 h-4 text-fusha-forest"></i>
                <div class="text-start">
                  <span class="text-[10px] text-stone-400 block font-medium">النقاط</span>
                  <span class="text-xs font-bold text-fusha-forest">${user.points ?? 0} نقطة</span>
                </div>
              </a>
            </div>
          </div>
        ` : ''}

        <!-- Navigation Links -->
        <nav class="flex-1 overflow-y-auto p-4 space-y-1.5 text-xs font-bold">
          <a href="dashboard.html" class="flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-stone-700 hover:bg-stone-50 hover:text-fusha-forest transition">
            <i data-lucide="home" class="w-4 h-4 text-stone-400"></i>
            <span>الرئيسية (لوحة التحكم)</span>
          </a>
          <a href="courses.html" class="flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-stone-700 hover:bg-stone-50 hover:text-fusha-forest transition">
            <i data-lucide="book-open" class="w-4 h-4 text-stone-400"></i>
            <span>المناهج والمحاضرات</span>
          </a>
          <a href="bank.html" class="flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-stone-700 hover:bg-stone-50 hover:text-fusha-forest transition">
            <i data-lucide="layers" class="w-4 h-4 text-stone-400"></i>
            <span>بنك الأسئلة والتدريبات</span>
          </a>
          <a href="dictionary.html" class="flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-stone-700 hover:bg-stone-50 hover:text-fusha-forest transition">
            <i data-lucide="book-marked" class="w-4 h-4 text-stone-400"></i>
            <span>معجم فُصْحَى اللغوي</span>
          </a>
          <a href="parent.html" class="flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-stone-700 hover:bg-stone-50 hover:text-fusha-forest transition">
            <i data-lucide="shield-check" class="w-4 h-4 text-stone-400"></i>
            <span>متابعة ولي الأمر</span>
          </a>
          <a href="wallet.html" class="flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-stone-700 hover:bg-stone-50 hover:text-fusha-forest transition">
            <i data-lucide="wallet" class="w-4 h-4 text-stone-400"></i>
            <span>شحن المحفظة والكروت</span>
          </a>
          <a href="profile.html" class="flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-stone-700 hover:bg-stone-50 hover:text-fusha-forest transition">
            <i data-lucide="settings" class="w-4 h-4 text-stone-400"></i>
            <span>الملف الشخصي والأجهزة</span>
          </a>
        </nav>

        <!-- Drawer Footer -->
        <div class="p-4 border-t border-stone-100">
          ${isLoggedIn ? `
            <button type="button" id="fushaMobileLogout" class="w-full flex items-center justify-center gap-2 p-2.5 rounded-xl bg-red-50 text-red-600 text-xs font-bold hover:bg-red-100 transition cursor-pointer">
              <i data-lucide="log-out" class="w-4 h-4"></i>
              <span>تسجيل الخروج</span>
            </button>
          ` : `
            <div class="flex flex-col gap-2">
              <a href="login.html" class="w-full text-center py-2.5 rounded-xl bg-stone-100 text-fusha-forest text-xs font-bold hover:bg-stone-200 transition">تسجيل الدخول</a>
              <a href="login.html?tab=register" class="w-full text-center py-2.5 rounded-xl bg-fusha-forest text-white text-xs font-bold hover:bg-fusha-forestLight transition">اشتراك جديد مجاناً</a>
            </div>
          `}
        </div>
      </aside>
    `;

    document.body.insertAdjacentHTML('beforeend', drawerHtml);
    drawer = document.getElementById('fushaMobileDrawer');
    overlay = document.getElementById('fushaMobileOverlay');
  }

  const menuBtn = document.getElementById('mobileMenuBtn');
  const closeBtn = document.getElementById('fushaMobileClose');
  const mobileLogout = document.getElementById('fushaMobileLogout');

  function openDrawer() {
    if (!drawer) return;
    drawer.classList.add('is-active');
    if (overlay) overlay.classList.add('is-active');
    document.body.classList.add('overflow-hidden');
    if (window.lucide) window.lucide.createIcons();
  }

  function closeDrawer() {
    if (!drawer) return;
    drawer.classList.remove('is-active');
    if (overlay) overlay.classList.remove('is-active');
    document.body.classList.remove('overflow-hidden');
  }

  if (menuBtn) menuBtn.addEventListener('click', openDrawer);
  if (closeBtn) closeBtn.addEventListener('click', closeDrawer);
  if (overlay) overlay.addEventListener('click', closeDrawer);

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && drawer && drawer.classList.contains('is-active')) {
      closeDrawer();
    }
  });

  // Close drawer on navigating links
  if (drawer) {
    const navLinks = drawer.querySelectorAll('nav a, a');
    navLinks.forEach((link) => {
      link.addEventListener('click', () => {
        closeDrawer();
      });
    });
  }

  if (mobileLogout) {
    mobileLogout.addEventListener('click', () => {
      if (window.api && window.api.auth) {
        window.api.auth.logout();
      } else {
        localStorage.clear();
        window.location.href = 'index.html';
      }
    });
  }
}

