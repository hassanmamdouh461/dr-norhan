'use client';

import React, { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { AUTH_STATUS_EVENT, getAccessToken, getMe, logout as authLogout } from '@/lib/auth';
import Link from 'next/link';
import { apiGet } from '@/lib/api';
import { isMockMode } from '@/lib/mock-mode';

interface SidebarItem {
  name: string;
  href: string;
  icon: string;
  section: 'content' | 'students' | 'operations';
}

interface AssistantPermissions {
  can_reset_devices: boolean;
  can_grade_quizzes: boolean;
  can_answer_questions: boolean;
  can_manage_codes: boolean;
  can_manage_courses: boolean;
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [user, setUser] = useState<{ email?: string; full_name?: string; role?: string; avatar_url?: string } | null>(null);
  const [permissions, setPermissions] = useState<AssistantPermissions | null>(null);
  const [loading, setLoading] = useState(true);
  const [showNotifications, setShowNotifications] = useState(false);
  const [alerts] = useState<Array<{ id: string; severity: 'alert' | 'warning' | 'success'; message: string; time: string }>>([]);
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    setIsDark(document.documentElement.classList.contains('dark'));
  }, []);

  const toggleTheme = () => {
    const next = !isDark;
    setIsDark(next);
    document.documentElement.classList.toggle('dark', next);
    localStorage.setItem('theme', next ? 'dark' : 'light');
  };

  useEffect(() => {
    const denyAccess = async (reason: string) => {
      console.error('[AUTH] Access denied:', reason);
      await authLogout();
      setUser(null);
      router.push('/login');
    };

    const checkAuth = async () => {
      if (isMockMode()) {
        setLoading(false);
        return;
      }

      if (!getAccessToken()) {
        localStorage.removeItem('fusha_dashboard_session');
        setUser(null);
        router.push('/login');
        return;
      }

      try {
        // getMe() يحمل رمز الوصول ويُجدّده تلقائياً عند 401، ويفكّ غلاف { user }.
        const profile = await getMe();

        // لوحة التحكم مقصورة على فريق الإدارة. الدور يأتي من الخادم لا من العميل.
        if (!['admin', 'assistant'].includes(String(profile.role || ''))) {
          await denyAccess('User is not staff');
          return;
        }

        const userData = {
          email: profile.email || '',
          role: String(profile.role),
          full_name: profile.full_name || 'الأستاذ المشرف',
          avatar_url: profile.avatar_url || '',
        };
        setUser(userData);
        localStorage.setItem('fusha_dashboard_session', JSON.stringify({ user: userData, token: getAccessToken() }));

        // Assistants have a restricted set of permissions that control which
        // sidebar sections they can see; admins implicitly have all of them.
        if (profile.role === 'assistant') {
          try {
            const perms = await apiGet<AssistantPermissions>('/admin/me/permissions');
            setPermissions(perms);
          } catch (permErr) {
            console.error('Failed to load assistant permissions:', permErr);
            setPermissions({ can_reset_devices: false, can_grade_quizzes: false, can_answer_questions: false, can_manage_codes: false, can_manage_courses: false });
          }
        }
      } catch (err) {
        // جلسة منتهية أو حساب غير موجود — نُعيد المشرف إلى تسجيل الدخول.
        console.error('Failed to load profile on checkAuth:', err);
        localStorage.removeItem('fusha_dashboard_session');
        setUser(null);
        router.push('/login');
        return;
      }

      setLoading(false);
    };

    checkAuth();

    // يُطلقه lib/auth.ts عند فشل تجديد الرمز (جلسة منتهية فعلاً) أو عند الخروج.
    const handleAuthStatusChange = () => {
      localStorage.removeItem('fusha_dashboard_session');
      setUser(null);
      router.push('/login');
    };
    window.addEventListener(AUTH_STATUS_EVENT, handleAuthStatusChange);

    return () => {
      window.removeEventListener(AUTH_STATUS_EVENT, handleAuthStatusChange);
    };
  }, [router]);

  const handleLogout = async () => {
    await authLogout();
    router.push('/login');
  };

  const baseItems: SidebarItem[] = [
    { name: 'لوحة القيادة', href: '/dashboard', icon: 'dashboard', section: 'operations' },
    { name: 'إدارة الدورات', href: '/dashboard/courses', icon: 'menu_book', section: 'content' },
    { name: 'رفع وإدارة الامتحانات', href: '/dashboard/exams', icon: 'assignment', section: 'content' },
    { name: 'إدارة الطلاب', href: '/dashboard/students', icon: 'group', section: 'students' },
    { name: 'رموز التفعيل', href: '/dashboard/codes', icon: 'vpn_key', section: 'students' },
    { name: 'صندوق الأسئلة', href: '/dashboard/questions', icon: 'inbox', section: 'operations' },
  ];

  const getSidebarItems = (): SidebarItem[] => {
    if (user?.role === 'admin') {
      // Admins see every section, unchanged.
      return [
        ...baseItems,
        { name: 'إدارة المساعدين', href: '/dashboard/assistants', icon: 'shield_person', section: 'operations' },
        { name: 'طلبات الأجهزة', href: '/dashboard/device-resets', icon: 'phonelink_erase', section: 'students' },
        { name: 'التحليلات المتقدمة', href: '/dashboard/analytics', icon: 'monitoring', section: 'operations' },
      ];
    }

    if (user?.role === 'assistant') {
      // Hide nav items the assistant doesn't have the backend permission to use.
      const items = baseItems.filter((item) => {
        if (item.href === '/dashboard/courses' || item.href === '/dashboard/exams') return !!permissions?.can_manage_courses;
        if (item.href === '/dashboard/codes') return !!permissions?.can_manage_codes;
        if (item.href === '/dashboard/questions') return !!permissions?.can_answer_questions;
        return true;
      });
      if (permissions?.can_reset_devices) {
        items.push({ name: 'طلبات الأجهزة', href: '/dashboard/device-resets', icon: 'phonelink_erase', section: 'students' });
      }
      return items;
    }

    return [...baseItems];
  };

  const sidebarItems = getSidebarItems();
  const navigationGroups = [
    { label: 'الرئيسية والمتابعة', items: sidebarItems.filter((item) => item.section === 'operations') },
    { label: 'المحتوى التعليمي', items: sidebarItems.filter((item) => item.section === 'content') },
    { label: 'الطلاب والاشتراكات', items: sidebarItems.filter((item) => item.section === 'students') },
  ].filter((group) => group.items.length > 0);


  if (loading) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-4 relative overflow-hidden">
        <div className="relative w-12 h-12 flex items-center justify-center">
          <div className="w-12 h-12 rounded-full border-4 border-primary/20 border-t-primary animate-spin" />
        </div>
        <p className="text-secondary text-sm font-semibold animate-pulse">جاري التحميل للوحة المعلم...</p>
      </div>
    );
  }

  const getPageTitle = () => {
    const active = sidebarItems.find(item => item.href === pathname);
    return active ? active.name : 'لوحة التحكم';
  };

  return (
    <div className="min-h-screen bg-background text-on-background flex flex-col md:flex-row rtl font-body-md">
      
      {/* Mobile Top Nav */}
      <nav className="md:hidden flex flex-row-reverse items-center justify-between px-4 w-full sticky top-0 z-50 backdrop-blur-md bg-surface border-b border-outline-variant h-16">
        <div className="flex min-w-0 items-center gap-2">
          <img 
            className="w-8 h-8 rounded-full object-cover border border-outline-variant" 
            src={user?.avatar_url || '/images/default_avatar.png'} 
            alt="صورة حساب المدرس"
          />
          <span className="truncate font-headline-sm text-base font-bold text-primary">فُصْحَى</span>
        </div>
        <div className="flex items-center gap-1 text-primary">
          <Link href="/dashboard/courses" aria-label="إنشاء دورة جديدة" className="p-2 hover:bg-surface-container-low transition-colors rounded-full flex items-center">
            <span className="material-symbols-outlined">add</span>
          </Link>
          <button 
            onClick={() => setSidebarOpen(true)}
            aria-label="فتح القائمة"
            className="p-2 hover:bg-surface-container-low transition-colors rounded-full flex items-center"
          >
            <span className="material-symbols-outlined">menu</span>
          </button>
        </div>
      </nav>

      {/* Desktop Side Nav */}
      <aside className="hidden md:flex flex-col h-screen w-64 fixed start-0 top-0 bg-surface-container-low border-e border-outline-variant py-6 z-40">
        <div className="px-md mb-lg flex flex-col items-center">
          <div
            className="flex h-16 w-16 mb-sm items-center justify-center rounded-2xl bg-gradient-to-tr from-teal-700 to-teal-600 font-extrabold text-white text-2xl shadow-lg border border-teal-500/20 tracking-wider"
            aria-hidden="true"
          >
            فُ
          </div>
          <h2 className="font-headline-sm text-headline-sm text-on-surface text-center">لوحة تحكم فُصْحَى</h2>
          <p className="font-label-md text-label-md text-on-surface-variant text-center">{user?.full_name || 'الأستاذ المشرف'}</p>
        </div>
        
        <nav className="flex-1 overflow-y-auto px-3 space-y-5">
          {navigationGroups.map((group) => (
            <div key={group.label}>
              <p className="px-3 pb-2 text-[11px] font-bold text-on-surface-variant">{group.label}</p>
              <div className="space-y-1">
                {group.items.map((item) => {
                  const isActive = pathname === item.href;
                  return <Link key={item.href} href={item.href} className={`flex flex-row-reverse items-center justify-end gap-3 px-3 py-2.5 rounded-lg font-label-md text-label-md transition-all duration-200 ${isActive ? 'bg-primary/10 text-primary font-semibold' : 'text-on-surface-variant hover:bg-surface-container-high'}`}><span>{item.name}</span><span className="material-symbols-outlined" style={isActive ? { fontVariationSettings: "'FILL' 1" } : undefined}>{item.icon}</span></Link>;
                })}
              </div>
            </div>
          ))}
        </nav>
        
        <div className="px-sm mt-auto space-y-1">
          <Link
            href="/dashboard/settings"
            className="flex flex-row-reverse items-center justify-end gap-sm text-on-surface-variant px-4 py-3 font-label-md text-label-md hover:bg-surface-container-high rounded-lg transition-all duration-200 ease-in-out"
          >
            <span>الإعدادات</span>
            <span className="material-symbols-outlined">settings</span>
          </Link>
          <button
            type="button"
            onClick={toggleTheme}
            aria-label={isDark ? 'تفعيل الوضع الفاتح' : 'تفعيل الوضع الداكن'}
            className="w-full flex flex-row-reverse items-center justify-end gap-sm text-on-surface-variant px-4 py-3 font-label-md text-label-md hover:bg-surface-container-high rounded-lg transition-all duration-200 ease-in-out"
          >
            <span>{isDark ? 'الوضع الفاتح' : 'الوضع الداكن'}</span>
            <span className={`material-symbols-outlined ${isDark ? 'animate-sun-beam' : 'animate-moon-swing'}`}>{isDark ? 'light_mode' : 'dark_mode'}</span>
          </button>
          <button
            onClick={handleLogout}
            className="w-full flex flex-row-reverse items-center justify-end gap-sm text-error px-4 py-3 font-label-md text-label-md hover:bg-error-container/20 rounded-lg transition-all duration-200 ease-in-out text-start"
          >
            <span>تسجيل الخروج</span>
            <span className="material-symbols-outlined">logout</span>
          </button>

          {/* Copyright */}
          <p className="block text-center text-[11px] text-secondary pt-4 mt-auto border-t border-outline-variant">
            جميع حقوق النشر والتشغيل محفوظة لـ منصة فُصْحَى
          </p>
        </div>
      </aside>

      {/* Mobile Drawer */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-50 md:hidden flex justify-start">
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setSidebarOpen(false)} />
          
          {/* Drawer Panel */}
          <aside className="relative w-72 max-w-[88vw] bg-surface-container-low h-full flex flex-col py-6 px-3 z-50 shadow-2xl animate-in slide-in-from-right duration-200">
            <button 
              onClick={() => setSidebarOpen(false)}
              className="absolute end-4 top-4 p-2 text-on-surface-variant hover:bg-surface-container-high rounded-full flex items-center"
            >
              <span className="material-symbols-outlined">close</span>
            </button>

            <div className="px-md mb-lg mt-6 flex flex-col items-center">
              <div
                className="flex h-14 w-14 mb-sm items-center justify-center rounded-xl bg-gradient-to-tr from-teal-700 to-teal-600 font-extrabold text-white text-xl shadow-lg border border-teal-500/20 tracking-wider"
                aria-hidden="true"
              >
                فُ
              </div>
              <h2 className="font-headline-sm text-[16px] text-on-surface text-center">لوحة تحكم فُصْحَى</h2>
              <p className="font-label-md text-xs text-on-surface-variant text-center">{user?.full_name || 'الأستاذ المشرف'}</p>
            </div>
            
            <nav className="flex-1 overflow-y-auto space-y-5">
              {navigationGroups.map((group) => <div key={group.label}><p className="px-3 pb-2 text-[11px] font-bold text-on-surface-variant">{group.label}</p><div className="space-y-1">{group.items.map((item) => { const isActive = pathname === item.href; return <Link key={item.href} href={item.href} onClick={() => setSidebarOpen(false)} className={`flex flex-row-reverse items-center justify-end gap-3 px-4 py-2.5 rounded-lg font-label-md text-label-md transition-all duration-200 ${isActive ? 'bg-primary/10 text-primary font-semibold' : 'text-on-surface-variant hover:bg-surface-container-high'}`}><span>{item.name}</span><span className="material-symbols-outlined" style={isActive ? { fontVariationSettings: "'FILL' 1" } : undefined}>{item.icon}</span></Link>; })}</div></div>)}
            </nav>
            
            <div className="space-y-1 mt-auto border-t border-outline-variant pt-sm">
              <Link
                href="/dashboard/settings"
                onClick={() => setSidebarOpen(false)}
                className="flex flex-row-reverse items-center justify-end gap-sm text-on-surface-variant px-4 py-3 font-label-md text-label-md hover:bg-surface-container-high rounded-lg transition-all duration-200 ease-in-out"
              >
                <span>الإعدادات</span>
                <span className="material-symbols-outlined">settings</span>
              </Link>
              <button
                type="button"
                onClick={toggleTheme}
                aria-label={isDark ? 'تفعيل الوضع الفاتح' : 'تفعيل الوضع الداكن'}
                className="w-full flex flex-row-reverse items-center justify-end gap-sm text-on-surface-variant px-4 py-3 font-label-md text-label-md hover:bg-surface-container-high rounded-lg transition-all duration-200 ease-in-out"
              >
                <span>{isDark ? 'الوضع الفاتح' : 'الوضع الداكن'}</span>
                <span className={`material-symbols-outlined ${isDark ? 'animate-sun-beam' : 'animate-moon-swing'}`}>{isDark ? 'light_mode' : 'dark_mode'}</span>
              </button>
              <button
                onClick={() => {
                  setSidebarOpen(false);
                  handleLogout();
                }}
                className="w-full flex flex-row-reverse items-center justify-end gap-sm text-error px-4 py-3 font-label-md text-label-md hover:bg-error-container/20 rounded-lg transition-all duration-200 ease-in-out text-start"
              >
                <span>تسجيل الخروج</span>
                <span className="material-symbols-outlined">logout</span>
              </button>
            </div>

            {/* Copyright */}
            <p className="block text-center text-[11px] text-secondary pt-4 mt-auto border-t border-outline-variant">
              جميع حقوق النشر والتشغيل محفوظة لـ منصة فُصْحَى
            </p>
          </aside>
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex-1 md:ms-64 flex flex-col min-h-screen relative w-full font-body-md text-body-md bg-background text-on-background">
        
        {/* Desktop Web Content Header */}
        <header className="hidden md:flex flex-row-reverse items-center justify-between px-8 lg:px-12 w-full h-20 sticky top-0 z-30 bg-background/90 backdrop-blur-sm border-b border-outline-variant/30">
          <div className="font-headline-md text-headline-md font-bold text-on-surface">{getPageTitle()}</div>
          <div className="flex items-center gap-sm text-on-surface-variant">
            <div className="flex items-center gap-2 py-1.5 px-3 rounded-lg bg-surface-container-low text-on-surface-variant text-xs font-semibold">
              <span className="material-symbols-outlined text-[15px]">calendar_today</span>
              <span>{new Intl.DateTimeFormat('ar-EG', { weekday: 'long', day: 'numeric', month: 'long' }).format(new Date())}</span>
            </div>
            <div className="relative">
              <button 
                onClick={() => setShowNotifications(!showNotifications)}
                className="p-2 text-on-surface-variant hover:bg-surface-container-high transition-colors rounded-full flex items-center relative" 
                title="التنبيهات"
              >
                <span className="material-symbols-outlined">notifications</span>
                {alerts.length > 0 && (
                  <span className="absolute top-1.5 start-1.5 w-2 h-2 bg-error rounded-full animate-pulse" />
                )}
              </button>

              {showNotifications && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setShowNotifications(false)} />
                  <div 
                    style={{ right: 0, left: 'auto' }}
                    className="absolute mt-2 w-80 bg-surface-container-lowest border border-outline-variant rounded-xl shadow-ambient z-50 p-4 animate-in fade-in slide-in-from-top-2 duration-200"
                  >
                    <h3 className="font-headline-sm text-sm text-on-background mb-3 flex items-center gap-2 border-b border-outline-variant pb-2">
                      <span className="material-symbols-outlined text-primary text-base">notifications_active</span>
                      <span>تنبيهات النظام الأخيرة</span>
                    </h3>
                    
                    <div className="space-y-3 max-h-96 overflow-y-auto scrollable-container">
                      {alerts.length === 0 ? <div className="py-8 text-center"><span className="material-symbols-outlined text-2xl text-primary">notifications_none</span><p className="mt-2 text-xs text-on-surface-variant">لا توجد تنبيهات جديدة الآن.</p></div> : alerts.map((alert) => (
                        <div 
                          key={alert.id}
                          className={`flex items-start gap-2 p-2 rounded-lg border border-transparent transition-colors cursor-default ${
                            alert.severity === 'alert' 
                              ? 'bg-error-container/10 hover:bg-error-container/20 hover:border-error-container/30' 
                              : 'bg-surface hover:bg-surface-container hover:border-outline-variant'
                          }`}
                        >
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 text-xs ${
                            alert.severity === 'alert' 
                              ? 'bg-error text-on-error' 
                              : alert.severity === 'warning'
                                ? 'bg-secondary-container text-on-secondary-container'
                                : 'bg-tertiary-fixed text-on-tertiary-fixed-variant'
                          }`}>
                            <span className="material-symbols-outlined text-[16px]">
                              {alert.severity === 'alert' ? 'security' : alert.severity === 'warning' ? 'update' : 'info'}
                            </span>
                          </div>
                          <div className="flex-1 min-w-0">
                            <h4 className={`font-label-md text-xs mb-0.5 ${alert.severity === 'alert' ? 'text-error font-bold' : 'text-on-surface'}`}>
                              {alert.severity === 'alert' ? 'نشاط مشبوه' : alert.severity === 'warning' ? 'تحديث المعالجة' : 'حالة الخادم'}
                            </h4>
                            <p className="text-[11px] leading-relaxed text-on-surface-variant break-words">{alert.message}</p>
                            <span className="text-[10px] text-outline mt-1 block">{alert.time}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                    
                    <div className="border-t border-outline-variant pt-2 mt-3">
                      <Link 
                        href="/dashboard/students" 
                        onClick={() => setShowNotifications(false)}
                        className="block w-full text-center py-1.5 text-xs text-primary font-bold hover:underline"
                      >
                        عرض كل التنبيهات وإدارة الأجهزة
                      </Link>
                    </div>
                  </div>
                </>
              )}
            </div>
            <img 
              className="w-10 h-10 rounded-full ms-4 object-cover border border-outline-variant" 
              src={user?.avatar_url || '/images/default_avatar.png'} 
              alt="Teacher profile"
            />
          </div>
        </header>

        {/* Page Main Content Wrapper */}
          <main className="flex-1 p-4 sm:p-6 lg:p-12 max-w-container-max mx-auto w-full pb-24 md:pb-12">
          {children}
        </main>

        {/* Mobile Bottom Nav */}
        <nav className="md:hidden fixed bottom-0 end-0 start-0 z-50 bg-surface/95 backdrop-blur-lg border-t border-outline-variant flex justify-around py-2.5 shadow-lg">
          <Link href="/dashboard" className={`flex flex-col items-center gap-0.5 text-[10px] font-bold ${pathname === '/dashboard' ? 'text-primary' : 'text-secondary'}`}>
            <span className="material-symbols-outlined text-xl">dashboard</span>
            الرئيسية
          </Link>
          <Link href="/dashboard/courses" className={`flex flex-col items-center gap-0.5 text-[10px] font-bold ${pathname === '/dashboard/courses' ? 'text-primary' : 'text-secondary'}`}>
            <span className="material-symbols-outlined text-xl">menu_book</span>
            الدورات
          </Link>
          <Link href="/dashboard/students" className={`flex flex-col items-center gap-0.5 text-[10px] font-bold ${pathname === '/dashboard/students' ? 'text-primary' : 'text-secondary'}`}>
            <span className="material-symbols-outlined text-xl">group</span>
            الطلاب
          </Link>
          <Link href="/dashboard/questions" className={`flex flex-col items-center gap-0.5 text-[10px] font-bold ${pathname === '/dashboard/questions' ? 'text-primary' : 'text-secondary'}`}><span className="material-symbols-outlined text-xl">forum</span>الأسئلة</Link>
          <button 
            type="button"
            onClick={() => setSidebarOpen(true)} 
            className="flex flex-col items-center gap-0.5 text-[10px] font-bold text-secondary"
          >
            <span className="material-symbols-outlined text-xl">menu</span>
            القائمة
          </button>
        </nav>
      </div>
    </div>
  );
}
