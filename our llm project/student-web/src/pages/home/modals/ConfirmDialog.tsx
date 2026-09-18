import type { FC } from 'react';
import Modal from '../../../components/ui/Modal';
import type { ConfirmDialogState } from '../types';

interface ConfirmDialogProps {
  confirmDialog: ConfirmDialogState | null;
  onCancel: () => void;
}

/** Generic destructive-action confirmation dialog (device unbind, exam close/submit warnings, ...).
 * Routed through the shared Modal component for role=dialog/aria-modal/focus handling and
 * Escape/click-outside-to-cancel, with an elevated overlay z-index so it can stack above an
 * already-open modal (e.g. the exam modal it's confirming a close/submit action for). */
export const ConfirmDialog: FC<ConfirmDialogProps> = ({ confirmDialog, onCancel }) => {
  if (!confirmDialog || !confirmDialog.show) return null;

  return (
    <Modal
      onClose={onCancel}
      ariaLabel={confirmDialog.title}
      overlayStyle={{ zIndex: 999999 }}
      contentStyle={{ padding: '28px', maxWidth: '400px', textAlign: 'center', borderRadius: '16px' }}
    >
      <div className="flex items-center justify-center" style={{ marginBottom: '16px', color: 'rgb(var(--error))' }}>
        <span className="material-symbols-outlined animate-bounce" style={{ fontSize: '48px' }}>warning</span>
      </div>
      <h3 className="title-small" style={{ marginBottom: '12px', fontSize: '18px', fontWeight: 'bold', color: 'rgb(var(--on-surface))' }}>
        {confirmDialog.title}
      </h3>
      <p className="body-small" style={{ marginBottom: '24px', color: 'rgb(var(--on-surface-variant))', lineHeight: '1.6' }}>
        {confirmDialog.message}
      </p>
      <div className="flex justify-center gap-md" style={{ direction: 'rtl', display: 'flex', gap: '12px' }}>
        <button
          className="btn btn-primary"
          style={{
            backgroundColor: 'rgb(var(--error))',
            color: '#fff',
            border: 'none',
            padding: '10px 24px',
            borderRadius: '8px',
            fontWeight: 'bold',
            cursor: 'pointer'
          }}
          onClick={confirmDialog.onConfirm}
        >
          {confirmDialog.confirmLabel || 'تأكيد الحذف'}
        </button>
        <button
          className="btn btn-secondary"
          style={{
            backgroundColor: 'rgba(var(--on-surface), 0.08)',
            color: 'rgb(var(--on-surface))',
            border: '1px solid rgba(var(--on-surface), 0.12)',
            padding: '10px 24px',
            borderRadius: '8px',
            fontWeight: 'bold',
            cursor: 'pointer'
          }}
          onClick={onCancel}
        >
          إلغاء
        </button>
      </div>
    </Modal>
  );
};
