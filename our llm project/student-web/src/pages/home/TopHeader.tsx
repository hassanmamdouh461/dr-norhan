import type { FC } from 'react';
import type { TabId } from './types';

interface TopHeaderProps {
  activeTab: TabId;
  profile: any | null;
  unreadCount: number;
  setShowNotificationsModal: (v: boolean) => void;
}

/** Desktop-only top header banner shown above every tab except "home". */
export const TopHeader: FC<TopHeaderProps> = ({ activeTab, profile, unreadCount, setShowNotificationsModal }) => {
  if (activeTab === 'home') return null;

  return (
    <div className="desktop-top-header" style={{ display: 'none', justifyContent: 'space-between', alignItems: 'center', marginBottom: '28px', direction: 'rtl' }}>
      {/* Right Side: Welcome message or Active tab title */}
      <div>
        <h1 style={{ fontSize: '20px', fontWeight: '900', color: 'rgb(var(--on-surface))', fontFamily: 'Cairo, sans-serif', margin: 0 }}>
          {activeTab === 'explore' && 'كورسات المنصة'}
          {activeTab === 'my-courses' && 'الكورسات المشترك بها'}
          {activeTab === 'exams' && 'الامتحانات'}
          {activeTab === 'qa' && 'ابعت سؤالك'}
          {activeTab === 'profile' && 'الملف الشخصي'}
        </h1>
      </div>

      {/* Left Side: Streak & Notification Actions */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        {profile && (
          <>
            {/* Daily Streak Indicator (only when real data exists) */}
            {Boolean(profile.streak_count) && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                backgroundColor: 'rgba(255, 107, 107, 0.08)',
                border: '1px solid rgba(255, 107, 107, 0.25)',
                padding: '8px 14px',
                borderRadius: '12px',
                color: '#ff6b6b',
                fontWeight: 'bold',
                fontSize: '13px'
              }}
              title="أيام التعلم المتتالية"
            >
              <span className="material-symbols-outlined animate-pulse" style={{ fontSize: '18px', color: '#ff6b6b' }}>local_fire_department</span>
              <span>{profile.streak_count} يوم متتالي</span>
            </div>
            )}

            {/* Notifications Bell */}
            <button
              onClick={() => setShowNotificationsModal(true)}
              className="btn"
              style={{
                padding: '10px 14px',
                borderRadius: '12px',
                backgroundColor: 'rgba(var(--on-surface), 0.04)',
                border: '1px solid rgba(var(--on-surface), 0.06)',
                color: 'rgb(var(--on-surface))',
                position: 'relative',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                transition: 'all 0.2s'
              }}
              onMouseEnter={(e) => e.currentTarget.style.borderColor = 'rgba(16, 185, 129, 0.3)'}
              onMouseLeave={(e) => e.currentTarget.style.borderColor = 'rgba(var(--on-surface), 0.06)'}
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
          </>
        )}
      </div>

    </div>
  );
};
