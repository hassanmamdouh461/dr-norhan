import type { FC } from 'react';
import { useEffect, useState } from 'react';
import { ApiService, getDeviceId } from '../../services/api';
import { getNotificationPermissionState, requestPushPermission } from '../../services/firebase';
import { useToast } from '../../context/ToastContext';

const DISMISS_KEY = 'notif_prompt_dismissed';

interface EnableNotificationsPromptProps {
  /** Logged-in student profile, or null/undefined for guests. */
  profile: any | null | undefined;
}

/**
 * Small dismissible banner shown after login inviting the student to enable
 * browser push notifications, as an explicit, discoverable alternative to the
 * silent permission request already fired at login (see AuthContext). Only
 * ever shown once per session, and never for guests or once a permission
 * decision (granted/denied) already exists.
 */
export const EnableNotificationsPrompt: FC<EnableNotificationsPromptProps> = ({ profile }) => {
  const { showToast } = useToast();
  const [visible, setVisible] = useState(false);
  const [enabling, setEnabling] = useState(false);

  useEffect(() => {
    if (!profile) {
      setVisible(false);
      return;
    }
    try {
      if (sessionStorage.getItem(DISMISS_KEY) === '1') {
        setVisible(false);
        return;
      }
    } catch {
      // sessionStorage unavailable (private mode / disabled) — fall through and still show once.
    }
    setVisible(getNotificationPermissionState() === 'default');
  }, [profile]);

  const dismiss = () => {
    try {
      sessionStorage.setItem(DISMISS_KEY, '1');
    } catch {
      // best-effort only
    }
    setVisible(false);
  };

  const handleEnable = async () => {
    setEnabling(true);
    try {
      const token = await requestPushPermission();
      if (token) {
        try {
          await ApiService.registerDevice({
            device_id: getDeviceId(),
            platform: 'web',
            model: navigator.userAgent.substring(0, 50),
            push_token: token,
          });
        } catch {
          // Registration failure shouldn't block the UX — permission itself succeeded.
        }
        showToast('success', 'تم تفعيل الإشعارات', 'سيصلك الآن إشعارات المنصة على هذا المتصفح.');
      } else {
        showToast('info', 'يمكنك التفعيل لاحقاً', 'يمكنك تفعيل الإشعارات لاحقاً من إعدادات المتصفح أو من صفحة الملف الشخصي.');
      }
    } catch {
      showToast('info', 'يمكنك التفعيل لاحقاً', 'يمكنك تفعيل الإشعارات لاحقاً من إعدادات المتصفح أو من صفحة الملف الشخصي.');
    } finally {
      setEnabling(false);
      dismiss();
    }
  };

  if (!visible) return null;

  return (
    <div
      className="card"
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '16px',
        padding: '16px 20px',
        marginBottom: '20px',
        backgroundColor: 'rgb(var(--surface-container-low))',
        border: '1px solid rgb(var(--primary) / 0.2)',
        direction: 'rtl',
      }}
      role="region"
      aria-label="تفعيل إشعارات المتصفح"
    >
      <div className="flex items-center gap-md" style={{ display: 'flex', alignItems: 'center', gap: '14px', flex: 1, minWidth: '240px' }}>
        <span
          className="icon"
          style={{
            fontSize: '26px',
            color: 'rgb(var(--primary))',
            backgroundColor: 'rgba(var(--primary), 0.1)',
            borderRadius: '50%',
            width: '44px',
            height: '44px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          notifications_active
        </span>
        <p className="body-small" style={{ margin: 0, lineHeight: '1.6', color: 'rgb(var(--on-surface))' }}>
          فعّل الإشعارات لتصلك التنبيهات بأحدث المحاضرات والامتحانات والردود على أسئلتك
        </p>
      </div>

      <div className="flex items-center gap-sm" style={{ display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0 }}>
        <button
          type="button"
          className="btn btn-primary"
          style={{ padding: '10px 20px', fontSize: '13px', borderRadius: '10px' }}
          onClick={handleEnable}
          disabled={enabling}
        >
          {enabling ? 'جاري التفعيل...' : 'تفعيل الإشعارات'}
        </button>
        <button
          type="button"
          onClick={dismiss}
          disabled={enabling}
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            color: 'rgb(var(--on-surface-variant))',
            fontSize: '13px',
            fontWeight: 'bold',
            padding: '8px 6px',
          }}
        >
          لاحقاً
        </button>
      </div>
    </div>
  );
};

export default EnableNotificationsPrompt;
