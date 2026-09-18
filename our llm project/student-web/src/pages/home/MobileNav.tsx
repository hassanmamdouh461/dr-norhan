import type { FC } from 'react';
import type { TabId } from './types';

interface MobileHeaderProps {
  profile: any | null;
  logout: () => void;
  theme: 'light' | 'dark';
  toggleTheme: () => void;
  unreadCount: number;
  setShowNotificationsModal: (v: boolean) => void;
}

/** Mobile-only top header banner (alternative navigation for small screens). */
export const MobileHeader: FC<MobileHeaderProps> = ({
  profile,
  logout,
  theme,
  toggleTheme,
  unreadCount,
  setShowNotificationsModal,
}) => {
  return (
    <div className="mobile-header" style={{ display: 'none', marginBottom: '24px', justifyContent: 'space-between', alignItems: 'center', direction: 'rtl' }}>
      <div className="flex gap-sm items-center">
        {/* Logout Button (Leftmost) */}
        <button
          onClick={logout}
          className="btn"
          style={{
            padding: '10px 14px',
            borderRadius: '12px',
            backgroundColor: 'rgba(239, 68, 68, 0.15)',
            color: 'rgb(239, 68, 68)',
            border: 'none',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer'
          }}
          title="تسجيل الخروج"
          aria-label="تسجيل الخروج"
        >
          <span className="icon" style={{ fontSize: '20px' }}>logout</span>
        </button>

        {/* Theme Toggle Button */}
        <button
          onClick={toggleTheme}
          className="btn"
          style={{
            padding: '10px 14px',
            borderRadius: '12px',
            backgroundColor: 'rgba(var(--on-surface), 0.05)',
            border: '1px solid rgba(var(--on-surface), 0.08)',
            color: '#ffd23f',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            overflow: 'hidden',
            cursor: 'pointer'
          }}
          title="تبديل المظهر"
          aria-label="تبديل المظهر بين الوضع الليلي والمضيء"
        >
          {theme === 'dark' ? (
            <span className="icon animate-sun-beam" style={{ color: '#ffd23f', fontSize: '20px' }}>light_mode</span>
          ) : (
            <span className="icon animate-moon-swing" style={{ color: '#ffd23f', fontSize: '20px' }}>dark_mode</span>
          )}
        </button>

        {/* Notification Bell Button */}
        {profile && (
          <button
            onClick={() => setShowNotificationsModal(true)}
            className="btn"
            data-tour="tour-notif-bell"
            style={{
              padding: '10px 14px',
              borderRadius: '12px',
              backgroundColor: 'rgba(var(--on-surface), 0.05)',
              border: '1px solid rgba(var(--on-surface), 0.08)',
              color: 'rgb(var(--on-surface))',
              position: 'relative',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer'
            }}
            title="التنبيهات"
            aria-label={unreadCount > 0 ? `التنبيهات (${unreadCount} غير مقروءة)` : 'التنبيهات'}
          >
            <span className="material-symbols-outlined" style={{ fontSize: '20px', color: unreadCount > 0 ? 'rgb(var(--primary))' : 'rgb(var(--on-surface-variant))' }}>
              {unreadCount > 0 ? 'notifications_active' : 'notifications'}
            </span>
            {unreadCount > 0 && (
              <span style={{
                position: 'absolute',
                top: '6px',
                right: '6px',
                backgroundColor: 'rgb(var(--primary))',
                borderRadius: '50%',
                width: '7px',
                height: '7px',
                boxShadow: '0 0 6px rgb(var(--primary))'
              }} />
            )}
          </button>
        )}
        {/* Mobile Daily Streak Indicator (only when real data exists) */}
        {profile && Boolean(profile.streak_count) && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              backgroundColor: 'rgba(255, 107, 107, 0.08)',
              border: '1px solid rgba(255, 107, 107, 0.25)',
              padding: '8px 12px',
              borderRadius: '12px',
              color: '#ff6b6b',
              fontWeight: 'bold',
              fontSize: '12px'
            }}
            title="أيام التعلم المتتالية"
          >
            <span className="material-symbols-outlined" style={{ fontSize: '16px', color: '#ff6b6b' }}>local_fire_department</span>
            <span>{profile.streak_count}🔥</span>
          </div>
        )}
      </div>

      {/* Platform Title (Rightmost) */}
      <div className="flex items-center gap-sm">
        <h2 style={{ fontSize: '15px', fontFamily: 'Cairo, sans-serif', fontWeight: 'bold', color: 'rgb(var(--on-surface))' }}>الهضبة</h2>
        <span className="icon" style={{ color: 'rgb(var(--primary))', fontSize: '22px' }}>school</span>
      </div>
    </div>
  );
};

interface MobileBottomNavProps {
  activeTab: TabId;
  handleTabClick: (tab: TabId) => void;
}

/** Mobile-only bottom tab navigation bar. */
export const MobileBottomNav: FC<MobileBottomNavProps> = ({ activeTab, handleTabClick }) => {
  return (
    <nav className="mobile-bottom-nav">
      <button
        onClick={() => handleTabClick('home')}
        className={`mobile-bottom-nav-item ${activeTab === 'home' ? 'active' : ''}`}
        data-tour="tour-nav-home"
      >
        <span className="icon">home</span>
        <span>الرئيسية</span>
      </button>

      <button
        onClick={() => handleTabClick('explore')}
        className={`mobile-bottom-nav-item ${activeTab === 'explore' ? 'active' : ''}`}
        data-tour="tour-nav-explore"
      >
        <span className="icon">explore</span>
        <span>كورسات المنصة</span>
      </button>

      <button
        onClick={() => handleTabClick('my-courses')}
        className={`mobile-bottom-nav-item ${activeTab === 'my-courses' ? 'active' : ''}`}
        data-tour="tour-nav-my-courses"
      >
        <span className="icon">school</span>
        <span>الكورسات المشترك بها</span>
      </button>

      <button
        onClick={() => handleTabClick('exams')}
        className={`mobile-bottom-nav-item ${activeTab === 'exams' ? 'active' : ''}`}
        data-tour="tour-nav-exams"
      >
        <span className="icon">assignment</span>
        <span>الامتحانات</span>
      </button>

      <button
        onClick={() => handleTabClick('qa')}
        className={`mobile-bottom-nav-item ${activeTab === 'qa' ? 'active' : ''}`}
        data-tour="tour-nav-qa"
      >
        <span className="icon">question_answer</span>
        <span>ابعت سؤالك</span>
      </button>

      <button
        onClick={() => handleTabClick('profile')}
        className={`mobile-bottom-nav-item ${activeTab === 'profile' ? 'active' : ''}`}
        data-tour="tour-nav-profile"
      >
        <span className="icon">person</span>
        <span>ملفي</span>
      </button>
    </nav>
  );
};
