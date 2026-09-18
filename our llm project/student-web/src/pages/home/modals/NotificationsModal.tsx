import type { FC } from 'react';
import Modal from '../../../components/ui/Modal';

interface NotificationsModalProps {
  notifications: any[];
  markNotificationAsRead: (id: string) => void;
  onClose: () => void;
}

/** Notifications center modal. */
export const NotificationsModal: FC<NotificationsModalProps> = ({ notifications, markNotificationAsRead, onClose }) => {
  return (
    <Modal ariaLabel="مركز التنبيهات والإشعارات" onClose={onClose} contentStyle={{ padding: '24px', maxWidth: '520px', width: '90%', maxHeight: '75vh', overflowY: 'auto', borderRadius: '16px' }}>
      <div className="flex justify-between items-center" style={{ borderBottom: '1px solid rgba(var(--on-surface), 0.08)', paddingBottom: '16px', marginBottom: '20px' }}>
        <div className="flex items-center gap-sm">
          <span className="material-symbols-outlined text-primary" style={{ fontSize: '24px' }}>notifications</span>
          <h3 className="title-small" style={{ margin: 0 }}>
            مركز التنبيهات والإشعارات
          </h3>
        </div>
        <button
          onClick={onClose}
          style={{ background: 'none', border: 'none', color: 'rgba(var(--on-surface), 0.4)', cursor: 'pointer' }}
          className="hover:text-primary transition-colors"
        >
          <span className="material-symbols-outlined">close</span>
        </button>
      </div>

      <div className="flex flex-col gap-md">
        {notifications.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px 0' }}>
            <span className="material-symbols-outlined text-secondary" style={{ fontSize: '48px', opacity: 0.3, marginBottom: '12px' }}>notifications_off</span>
            <p className="body-medium" style={{ color: 'rgb(var(--on-surface-variant))' }}>لا توجد تنبيهات جديدة حالياً.</p>
            <p className="body-small" style={{ opacity: 0.6 }}>ابقَ مستعداً لتلقي الإشعارات من مدرسك!</p>
          </div>
        ) : (
          <div className="flex flex-col gap-sm" style={{ maxHeight: '50vh', overflowY: 'auto', paddingRight: '4px' }}>
            {notifications.map((n) => {
              const isUnread = n.is_read === 0;
              return (
                <div
                  key={n.id}
                  onClick={() => isUnread && markNotificationAsRead(n.id)}
                  style={{
                    padding: '14px 16px',
                    borderRadius: '12px',
                    background: isUnread ? 'rgba(var(--primary), 0.06)' : 'rgba(var(--on-surface), 0.02)',
                    border: isUnread ? '1px solid rgba(var(--primary), 0.15)' : '1px solid rgba(var(--on-surface), 0.04)',
                    cursor: 'pointer',
                    transition: 'all 0.25s ease',
                    position: 'relative',
                  }}
                  className="hover:bg-surface-container-low"
                >
                  <div className="flex justify-between items-start" style={{ marginBottom: '6px' }}>
                    <span style={{
                      fontSize: '11px',
                      fontWeight: 'bold',
                      color: 'rgb(var(--primary))',
                      background: 'rgba(var(--primary), 0.1)',
                      padding: '2px 8px',
                      borderRadius: '50px'
                    }}>
                      {n.type === 'announcement' ? 'تنويه عام' : n.type === 'new_lesson' ? 'درس جديد' : 'تنبيه نظام'}
                    </span>
                    <span style={{ fontSize: '11px', opacity: 0.5 }}>
                      {new Date(n.sent_at).toLocaleDateString('ar-EG', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  <h4 style={{ fontSize: '13px', fontWeight: '800', color: 'rgb(var(--on-surface))', marginBottom: '4px' }}>
                    {n.title}
                  </h4>
                  <p style={{ fontSize: '11px', color: 'rgb(var(--on-surface-variant))', lineHeight: '1.5' }}>
                    {n.body}
                  </p>
                  {isUnread && (
                    <span style={{
                      position: 'absolute',
                      top: '14px',
                      right: '6px',
                      backgroundColor: 'rgb(var(--primary))',
                      borderRadius: '50%',
                      width: '6px',
                      height: '6px'
                    }} />
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </Modal>
  );
};
