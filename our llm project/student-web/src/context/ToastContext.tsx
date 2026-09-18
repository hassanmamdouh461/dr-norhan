import React, { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react';

type ToastType = 'success' | 'error' | 'info' | 'warning';

interface Toast {
  id: string;
  type: ToastType;
  title: string;
  message?: string;
  duration?: number;
}

interface ToastContextType {
  toasts: Toast[];
  showToast: (type: ToastType, title: string, message?: string, duration?: number) => string;
  dismissToast: (id: string) => void;
  dismissAll: () => void;
  replaceAlert: (type: ToastType, title: string, message?: string) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

let toastCounter = 0;

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const timersRef = useRef<Map<string, any>>(new Map());

  const dismissToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
    const timer = timersRef.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timersRef.current.delete(id);
    }
  }, []);

  const dismissAll = useCallback(() => {
    timersRef.current.forEach(timer => clearTimeout(timer));
    timersRef.current.clear();
    setToasts([]);
  }, []);

  const showToast = useCallback((type: ToastType, title: string, message?: string, duration: number = 4000): string => {
    const id = `toast_${++toastCounter}_${Date.now()}`;
    const toast: Toast = { id, type, title, message, duration };
    
    setToasts(prev => [...prev, toast]);

    if (duration > 0) {
      const timer = setTimeout(() => {
        dismissToast(id);
      }, duration);
      timersRef.current.set(id, timer);
    }

    return id;
  }, [dismissToast]);

  // Replace alert() with a proper toast - helper function
  const replaceAlert = useCallback((type: ToastType, title: string, message?: string) => {
    showToast(type, title, message, 5000);
  }, [showToast]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      timersRef.current.forEach(timer => clearTimeout(timer));
      timersRef.current.clear();
    };
  }, []);

  return (
    <ToastContext.Provider value={{ toasts, showToast, dismissToast, dismissAll, replaceAlert }}>
      {children}
      
      {/* Toast Container */}
      <div
        style={{
          position: 'fixed',
          bottom: '24px',
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 99999,
          display: 'flex',
          flexDirection: 'column-reverse',
          gap: '10px',
          pointerEvents: 'none',
          maxWidth: '420px',
          width: 'calc(100% - 32px)',
          direction: 'rtl',
        }}
      >
        {toasts.map((toast) => (
          <div
            key={toast.id}
            onClick={() => dismissToast(toast.id)}
            style={{
              pointerEvents: 'auto',
              cursor: 'pointer',
              padding: '14px 18px',
              borderRadius: '14px',
              background: toast.type === 'success'
                ? 'linear-gradient(135deg, #065f46 0%, #047857 100%)'
                : toast.type === 'error'
                  ? 'linear-gradient(135deg, #7f1d1d 0%, #991b1b 100%)'
                  : toast.type === 'warning'
                    ? 'linear-gradient(135deg, #713f12 0%, #92400e 100%)'
                    : 'linear-gradient(135deg, #1e3a5f 0%, #1e40af 100%)',
              border: `1px solid ${
                toast.type === 'success' ? 'rgba(52, 211, 153, 0.3)'
                : toast.type === 'error' ? 'rgba(248, 113, 113, 0.3)'
                : toast.type === 'warning' ? 'rgba(251, 191, 36, 0.3)'
                : 'rgba(96, 165, 250, 0.3)'
              }`,
              boxShadow: '0 8px 32px rgba(0,0,0,0.4), 0 2px 8px rgba(0,0,0,0.2)',
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              animation: `slideInUp 0.3s cubic-bezier(0.16, 1, 0.3, 1)`, 
              backdropFilter: 'blur(8px)',
              fontFamily: 'Cairo, sans-serif',
            }}
            role="alert"
            aria-live="polite"
          >
            {/* Icon */}
            <span
              className="material-symbols-outlined"
              style={{
                fontSize: '22px',
                color: toast.type === 'success' ? '#34d399'
                  : toast.type === 'error' ? '#f87171'
                  : toast.type === 'warning' ? '#fbbf24'
                  : '#60a5fa',
                flexShrink: 0,
              }}
            >
              {toast.type === 'success' ? 'check_circle' 
               : toast.type === 'error' ? 'error'
               : toast.type === 'warning' ? 'warning'
               : 'info'}
            </span>

            {/* Text */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{
                margin: 0,
                fontSize: '13px',
                fontWeight: '800',
                color: '#fff',
                lineHeight: '1.4',
              }}>
                {toast.title}
              </p>
              {toast.message && (
                <p style={{
                  margin: '3px 0 0 0',
                  fontSize: '11px',
                  color: 'rgba(255,255,255,0.75)',
                  lineHeight: '1.4',
                }}>
                  {toast.message}
                </p>
              )}
            </div>

            {/* Close button */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                dismissToast(toast.id);
              }}
              style={{
                background: 'rgba(255,255,255,0.08)',
                border: 'none',
                color: 'rgba(255,255,255,0.6)',
                borderRadius: '50%',
                width: '24px',
                height: '24px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                padding: 0,
                flexShrink: 0,
                fontSize: '14px',
                transition: 'all 0.2s',
              }}
              onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.15)'}
              onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.08)'}
              aria-label="إغلاق"
            >
              <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>close</span>
            </button>
          </div>
        ))}
      </div>

      {/* Animation styles */}
      <style>{`
        @keyframes slideInUp {
          from {
            opacity: 0;
            transform: translateY(20px) scale(0.95);
          }
          to {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }
        @keyframes slideOutDown {
          from {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
          to {
            opacity: 0;
            transform: translateY(20px) scale(0.95);
          }
        }
      `}</style>
    </ToastContext.Provider>
  );
};

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
};
