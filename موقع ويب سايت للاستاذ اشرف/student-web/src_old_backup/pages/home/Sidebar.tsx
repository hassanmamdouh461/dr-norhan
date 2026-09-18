import type { FC } from 'react';
import type { TabId } from './types';

interface SidebarProps {
  profile: any | null;
  isSidebarCollapsed: boolean;
  setIsSidebarCollapsed: (v: boolean | ((prev: boolean) => boolean)) => void;
  activeTab: TabId;
  handleTabClick: (tab: TabId) => void;
  stats: { coursesCount: number; quizzesCount: number; questionsCount: number };
  avatarUrl: string | null;
  unreadCount: number;
  setShowNotificationsModal: (v: boolean) => void;
  theme: 'light' | 'dark';
  toggleTheme: () => void;
  logout: () => void;
  onShowAuth?: () => void;
}

/** Desktop sidebar (right side in RTL): brand/profile header, nav, stats, theme switcher, logout. */
export const Sidebar: FC<SidebarProps> = ({
  profile,
  isSidebarCollapsed,
  setIsSidebarCollapsed,
  activeTab,
  handleTabClick,
  stats,
  avatarUrl,
  unreadCount,
  setShowNotificationsModal,
  theme,
  toggleTheme,
  logout,
  onShowAuth,
}) => {
  return (
    <aside
      style={{
        width: isSidebarCollapsed ? '78px' : '290px',
        backgroundColor: 'rgb(var(--surface))',
        borderLeft: '1px solid rgb(var(--outline) / 0.15)',
        padding: isSidebarCollapsed ? '24px 10px' : '24px 20px',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        transition: 'width 0.3s cubic-bezier(0.4, 0, 0.2, 1), padding 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
        height: '100%',
        overflowY: 'auto'
      }}
      className="desktop-sidebar"
    >
      <div className="flex flex-col">
        {/* Top bar: standalone notification bell + collapse toggle */}
        <div
          className="sidebar-toggle-container"
          style={{
            display: 'flex',
            alignItems: 'center',
            flexDirection: isSidebarCollapsed ? 'column' : 'row',
            gap: isSidebarCollapsed ? '10px' : '0',
            justifyContent: profile
              ? (isSidebarCollapsed ? 'center' : 'space-between')
              : (isSidebarCollapsed ? 'center' : 'flex-end'),
          }}
        >
          {/* Standalone Notification Bell (logged-in only) — its own place, with an unread count badge */}
          {profile && (
            <button
              onClick={() => setShowNotificationsModal(true)}
              title="الإشعارات والتنبيهات"
              aria-label={unreadCount > 0 ? `الإشعارات والتنبيهات (${unreadCount} غير مقروءة)` : 'الإشعارات والتنبيهات'}
              data-tour="tour-notif-bell"
              className="sidebar-notif-btn hover:scale-105 transition-transform"
              style={{
                position: 'relative',
                width: '40px',
                height: '40px',
                borderRadius: '12px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                background: unreadCount > 0 ? 'rgba(var(--primary), 0.12)' : 'rgb(var(--surface-container-low))',
                border: unreadCount > 0 ? '1px solid rgba(var(--primary), 0.35)' : '1px solid rgb(var(--outline) / 0.12)',
                color: unreadCount > 0 ? 'rgb(var(--primary))' : 'rgb(var(--on-surface-variant))',
              }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: '22px' }}>
                {unreadCount > 0 ? 'notifications_active' : 'notifications'}
              </span>
              {unreadCount > 0 && (
                <span
                  aria-hidden="true"
                  style={{
                    position: 'absolute',
                    top: '-5px',
                    right: '-5px',
                    minWidth: '18px',
                    height: '18px',
                    padding: '0 5px',
                    backgroundColor: 'rgb(var(--error))',
                    color: '#fff',
                    borderRadius: '9px',
                    fontSize: '10px',
                    fontWeight: 800,
                    lineHeight: 1,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    border: '2px solid rgb(var(--surface))',
                    boxShadow: '0 0 8px rgba(239, 68, 68, 0.55)',
                    fontFamily: 'Cairo, sans-serif',
                  }}
                >
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </button>
          )}

          {/* Collapse/Expand Sidebar Toggle Button */}
          <button
            onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
            className={`sidebar-toggle-btn ${isSidebarCollapsed ? 'collapsed' : ''}`}
            title={isSidebarCollapsed ? "توسيع القائمة" : "طي القائمة"}
            aria-label={isSidebarCollapsed ? "توسيع القائمة الجانبية" : "طي القائمة الجانبية"}
          >
            <div className="toggle-icon-wrapper">
              <span className="arrow-line line-top" />
              <span className="arrow-line line-middle" />
              <span className="arrow-line line-bottom" />
            </div>
          </button>
        </div>

        {/* Sidebar Header (Profile or Brand) */}
        {profile ? (
          <div
            className="glassy-profile-card"
            style={{
              marginBottom: '28px',
              padding: isSidebarCollapsed ? '12px 6px' : '20px 16px',
              borderRadius: '16px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              textAlign: 'center',
              gap: isSidebarCollapsed ? '4px' : '12px',
              direction: 'rtl',
              backgroundColor: 'rgba(255, 255, 255, 0.03)',
              border: '1px solid rgba(255, 255, 255, 0.06)'
            }}
          >
            {/* Circular Avatar with Glowing Border */}
            <div style={{ position: 'relative' }}>
              <div
                style={{
                  width: '56px',
                  height: '56px',
                  borderRadius: '50%',
                  overflow: 'hidden',
                  border: '2px solid rgb(var(--primary))',
                  boxShadow: '0 0 15px rgba(16, 185, 129, 0.35)',
                  backgroundColor: 'rgb(var(--surface-dim))',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                {avatarUrl ? (
                  <img src={avatarUrl} alt="صورة شخصية" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                  <span className="icon" style={{ fontSize: '32px', color: 'rgb(var(--primary))' }}>person</span>
                )}
              </div>
              {/* Active Status Pulse Indicator */}
              <div className="status-dot answered" style={{ position: 'absolute', bottom: '3px', left: '3px', width: '10px', height: '10px', marginLeft: 0 }} />
            </div>

            {!isSidebarCollapsed && (
              <div>
                <h3 style={{ fontSize: '14px', fontWeight: '800', color: 'rgb(var(--on-surface))', marginBottom: '4px' }}>
                  {profile.full_name}
                </h3>
                <p style={{ fontSize: '11px', color: 'rgb(var(--on-surface-variant))', fontWeight: 'bold', marginBottom: '2px' }}>
                  {profile.grade}
                </p>
                <span style={{ fontSize: '11px', color: 'rgb(var(--on-surface-variant))' }}>
                  {profile.governorate}
                </span>
              </div>
            )}
          </div>
        ) : (
          /* Fusha Brand Header for Guests */
          <div className="flex items-center" style={{ marginBottom: '40px', direction: 'rtl', justifyContent: isSidebarCollapsed ? 'center' : 'flex-start', gap: isSidebarCollapsed ? '0' : '12px' }}>
            <svg width="38" height="38" viewBox="0 0 42 42" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ filter: 'drop-shadow(0 0 8px rgba(16, 185, 129, 0.45))' }}>
              <circle cx="21" cy="21" r="20" fill="url(#synapse_grad)" stroke="rgba(16, 185, 129, 0.3)" strokeWidth="2"/>
              <path d="M14 15C16.5 12.5 20.5 12.5 23 15C25.5 17.5 24 21.5 21 23C18 24.5 16.5 28.5 19 31C21.5 33.5 25.5 33.5 28 31" stroke="#fff" strokeWidth="3" strokeLinecap="round"/>
              <circle cx="14" cy="15" r="3.5" fill="rgb(var(--fusha-gold-500))"/>
              <circle cx="21" cy="23" r="4" fill="rgb(var(--fusha-teal-400))"/>
              <circle cx="28" cy="31" r="3.5" fill="rgb(var(--fusha-gold-500))"/>
              <defs>
                <linearGradient id="synapse_grad" x1="0" y1="0" x2="42" y2="42" gradientUnits="userSpaceOnUse">
                  <stop offset="0%" stopColor="rgb(var(--primary))"/>
                  <stop offset="100%" stopColor="rgb(var(--surface-container-high))"/>
                </linearGradient>
              </defs>
            </svg>
            {!isSidebarCollapsed && (
              <div>
                <h2 style={{ fontSize: '15px', fontWeight: 800, color: 'rgb(var(--on-surface))', letterSpacing: '0.5px', fontFamily: 'Cairo, sans-serif' }}>فُصْحَى</h2>
                <span style={{ fontSize: '11px', color: 'rgb(var(--on-surface-variant))', fontWeight: '600' }}>منصة فُصْحَى التعليمية</span>
              </div>
            )}
          </div>
        )}

        {/* Navigation Links */}
        <nav className="flex flex-col gap-sm" aria-label="التنقل الرئيسي">
          {([
            { id: 'home', icon: 'home', label: 'الرئيسية' },
            { id: 'explore', icon: 'explore', label: 'كورسات المنصة' },
            { id: 'my-courses', icon: 'school', label: 'الكورسات المشترك بها' },
            { id: 'exams', icon: 'assignment', label: 'الامتحانات' },
            { id: 'qa', icon: 'question_answer', label: 'ابعت سؤالك' },
            { id: 'profile', icon: 'person', label: 'ملفي الشخصي' },
          ] as const).map(item => (
            <button
              key={item.id}
              onClick={() => handleTabClick(item.id)}
              data-tour={`tour-nav-${item.id}`}
              className={`btn w-full sidebar-nav-item ${activeTab === item.id ? 'active' : ''}`}
              style={{
                justifyContent: isSidebarCollapsed ? 'center' : 'flex-start',
                padding: isSidebarCollapsed ? '12px 10px' : '12px 16px',
              }}
              title={item.label}
              aria-label={item.label}
              aria-current={activeTab === item.id ? 'page' : undefined}
            >
              <span className="icon" aria-hidden="true" style={{ marginLeft: isSidebarCollapsed ? '0' : '12px', fontSize: '20px' }}>{item.icon}</span>
              {!isSidebarCollapsed && item.label}
            </button>
          ))}
        </nav>

        {/* Stats section inside the sidebar */}
        {profile && !isSidebarCollapsed && (
          <div data-tour="tour-stats" style={{ marginTop: '24px', padding: '16px 12px', backgroundColor: 'rgb(var(--surface-container-low))', borderRadius: '12px', border: '1px solid rgb(var(--outline) / 0.1)' }}>
            <h4 style={{ fontSize: '11px', color: 'rgb(var(--on-surface-variant))', marginBottom: '12px', fontWeight: 'bold' }}>إحصائياتي الدراسية</h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12px' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'rgb(var(--on-surface-variant))' }}>
                  <span className="icon" style={{ fontSize: '16px', color: 'rgb(var(--primary))' }}>video_library</span>
                  المقررات المفعّلة
                </span>
                <span style={{ fontWeight: 'bold', color: 'rgb(var(--on-surface))' }}>{stats.coursesCount}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12px' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'rgb(var(--on-surface-variant))' }}>
                  <span className="icon" style={{ fontSize: '16px', color: 'rgb(var(--primary))' }}>task_alt</span>
                  الامتحانات المحلولة
                </span>
                <span style={{ fontWeight: 'bold', color: 'rgb(var(--on-surface))' }}>{stats.quizzesCount}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12px' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'rgb(var(--on-surface-variant))' }}>
                  <span className="icon" style={{ fontSize: '16px', color: 'rgb(var(--primary))' }}>help_outline</span>
                  الأسئلة المطروحة
                </span>
                <span style={{ fontWeight: 'bold', color: 'rgb(var(--on-surface))' }}>{stats.questionsCount}</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Footer Area with Theme/Logout */}
      <div className="flex flex-col gap-md" style={{ borderTop: '1px solid rgba(16, 185, 129, 0.1)', paddingTop: '20px' }}>
        {/* Custom Theme Switcher */}
        <div style={{ display: 'flex', alignItems: 'center', backgroundColor: 'rgb(var(--surface-dim))', borderRadius: '12px', padding: '3px', border: '1px solid rgb(var(--outline) / 0.1)', flexDirection: isSidebarCollapsed ? 'column' : 'row', gap: isSidebarCollapsed ? '6px' : '0' }}>
          <button
            onClick={() => theme === 'light' && toggleTheme()}
            style={{
              flex: isSidebarCollapsed ? 'none' : 1,
              width: isSidebarCollapsed ? '36px' : 'auto',
              height: isSidebarCollapsed ? '36px' : 'auto',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              background: theme === 'dark' ? 'linear-gradient(135deg, rgb(16, 185, 129) 0%, rgb(5, 150, 105) 100%)' : 'transparent',
              color: theme === 'dark' ? '#fff' : 'rgb(var(--on-surface-variant))',
              border: 'none',
              borderRadius: '8px',
              padding: '8px 4px',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              fontSize: '12px',
              fontWeight: 'bold',
              fontFamily: 'Cairo, sans-serif'
            }}
            title="الوضع الليلي"
            aria-label="الوضع الليلي"
            aria-pressed={theme === 'dark'}
          >
            <span className={`icon ${theme === 'dark' ? 'animate-moon-swing' : ''}`} style={{ fontSize: '18px', color: theme === 'dark' ? 'rgb(var(--fusha-gold-500))' : 'inherit' }}>dark_mode</span>
            {!isSidebarCollapsed && 'الوضع الليلي'}
          </button>
          <button
            onClick={() => theme === 'dark' && toggleTheme()}
            style={{
              flex: isSidebarCollapsed ? 'none' : 1,
              width: isSidebarCollapsed ? '36px' : 'auto',
              height: isSidebarCollapsed ? '36px' : 'auto',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              background: theme === 'light' ? 'linear-gradient(135deg, rgb(16, 185, 129) 0%, rgb(5, 150, 105) 100%)' : 'transparent',
              color: theme === 'light' ? '#fff' : 'rgb(var(--on-surface-variant))',
              border: 'none',
              borderRadius: '8px',
              padding: '8px 4px',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              fontSize: '12px',
              fontWeight: 'bold',
              fontFamily: 'Cairo, sans-serif'
            }}
            title="الوضع المضيء"
            aria-label="الوضع المضيء"
            aria-pressed={theme === 'light'}
          >
            <span className={`icon ${theme === 'light' ? 'animate-sun-beam' : ''}`} style={{ fontSize: '18px', color: theme === 'light' ? 'rgb(var(--fusha-gold-500))' : 'inherit' }}>light_mode</span>
            {!isSidebarCollapsed && 'الوضع المضيء'}
          </button>
        </div>

        {profile ? (
          <button
            onClick={logout}
            className="btn w-full"
            style={{
              justifyContent: 'center',
              backgroundColor: 'transparent',
              color: 'rgb(var(--fusha-gold-500))',
              border: '1px solid rgba(239, 68, 68, 0.2)',
              fontSize: '14px',
              fontWeight: '700',
              padding: '12px',
              borderRadius: '10px',
              transition: 'all 0.2s ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = 'rgba(239, 68, 68, 0.1)';
              e.currentTarget.style.borderColor = 'rgba(239, 68, 68, 0.4)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent';
              e.currentTarget.style.borderColor = 'rgba(239, 68, 68, 0.2)';
            }}
            title="تسجيل الخروج"
            aria-label="تسجيل الخروج"
          >
            <span className="icon" style={{ marginLeft: isSidebarCollapsed ? '0' : '8px', fontSize: '18px' }}>logout</span>
            {!isSidebarCollapsed && 'تسجيل الخروج'}
          </button>
        ) : (
          <div className="flex w-full" style={{ marginTop: '4px', flexDirection: isSidebarCollapsed ? 'column' : 'row', gap: '8px' }}>
            <button
              onClick={() => onShowAuth?.()}
              className="btn"
              style={{
                flex: isSidebarCollapsed ? 'none' : 1,
                justifyContent: 'center',
                backgroundColor: 'transparent',
                color: 'rgb(var(--on-surface))',
                border: '1px solid rgb(var(--outline-variant) / 0.3)',
                fontSize: '13px',
                fontWeight: 'bold',
                padding: '10px',
                borderRadius: '8px',
                transition: 'all 0.2s ease',
                fontFamily: 'Cairo, sans-serif'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = 'rgba(var(--primary), 0.08)';
                e.currentTarget.style.borderColor = 'rgba(var(--primary), 0.4)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'transparent';
                e.currentTarget.style.borderColor = 'rgb(var(--outline-variant) / 0.3)';
              }}
              title="تسجيل الدخول"
              aria-label="تسجيل الدخول"
            >
              {isSidebarCollapsed ? <span className="icon" style={{ fontSize: '18px' }}>login</span> : 'دخول'}
            </button>
            <button
              onClick={() => onShowAuth?.()}
              className="btn"
              style={{
                flex: isSidebarCollapsed ? 'none' : 1,
                justifyContent: 'center',
                backgroundColor: 'rgb(var(--primary))',
                color: '#fff',
                border: 'none',
                fontSize: '13px',
                fontWeight: 'bold',
                padding: '10px',
                borderRadius: '8px',
                transition: 'all 0.2s ease',
                boxShadow: '0 4px 10px rgba(var(--primary), 0.35)',
                fontFamily: 'Cairo, sans-serif'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = 'rgb(var(--primary))';
                e.currentTarget.style.boxShadow = '0 0 15px rgba(var(--primary), 0.6)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'rgb(var(--primary))';
                e.currentTarget.style.boxShadow = '0 4px 10px rgba(var(--primary), 0.35)';
              }}
              title="إنشاء حساب جديد"
              aria-label="إنشاء حساب جديد"
            >
              {isSidebarCollapsed ? <span className="icon" style={{ fontSize: '18px' }}>person_add</span> : 'تسجيل'}
            </button>
          </div>
        )}

        {/* Copyright Section */}
        {!isSidebarCollapsed && (
          <div
            style={{
              marginTop: 'auto',
              paddingTop: '20px',
              textAlign: 'center',
              fontSize: '11px',
              color: 'rgb(var(--on-surface-variant))',
              textDecoration: 'none',
              transition: 'all 0.2s ease',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              fontFamily: 'Cairo, sans-serif',
              fontWeight: '600',
              borderTop: '1px solid rgb(var(--outline) / 0.1)'
            }}
            onMouseEnter={(e) => {
              const children = e.currentTarget.children;
              if (children[0]) (children[0] as HTMLElement).style.color = 'rgb(var(--fusha-teal-400))';
              if (children[1]) (children[1] as HTMLElement).style.color = 'rgb(var(--on-surface))';
              if (children[2]) (children[2] as HTMLElement).style.color = 'rgb(var(--fusha-sage-400))';
            }}
            onMouseLeave={(e) => {
              const children = e.currentTarget.children;
              if (children[0]) (children[0] as HTMLElement).style.color = 'rgb(var(--on-surface-variant))';
              if (children[1]) (children[1] as HTMLElement).style.color = 'rgb(var(--on-surface-variant))';
              if (children[2]) (children[2] as HTMLElement).style.color = 'rgb(var(--fusha-teal-400))';
            }}
          >
            <span className="icon" style={{ fontSize: '13px', color: 'rgb(var(--on-surface-variant))', transition: 'color 0.2s' }}>copyright</span>
            <span style={{ color: 'rgb(var(--on-surface-variant))', transition: 'color 0.2s' }}>حقوق النشر والتشغيل محفوظة لـ </span>
            <span style={{ color: 'rgb(var(--fusha-teal-400))', fontWeight: '800', transition: 'color 0.2s' }}>منصة فُصْحَى</span>
          </div>
        )}
      </div>
    </aside>
  );
};

export default Sidebar;
