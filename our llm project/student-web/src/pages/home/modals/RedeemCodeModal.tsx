import type { FC, FormEvent } from 'react';
import Modal from '../../../components/ui/Modal';

interface RedeemCodeModalProps {
  redeemCode: string;
  setRedeemCode: (v: string) => void;
  redeeming: boolean;
  selectedCourseForRedeem: any | null;
  handleRedeemSubmit: (e: FormEvent) => void;
  onClose: () => void;
}

/** "Redeem a course activation code" modal. */
export const RedeemCodeModal: FC<RedeemCodeModalProps> = ({
  redeemCode,
  setRedeemCode,
  redeeming,
  selectedCourseForRedeem,
  handleRedeemSubmit,
  onClose,
}) => {
  return (
    <Modal
      ariaLabel="تفعيل مقرر جديد بكود"
      onClose={onClose}
      contentStyle={{ padding: '24px' }}
    >
      <h3 className="title-small" style={{ marginBottom: '8px' }}>
        تفعيل مقرر جديد بكود
      </h3>
      <p className="body-small" style={{ marginBottom: '20px' }}>
        {selectedCourseForRedeem ? `أنت تقوم بتفعيل كورس: "${selectedCourseForRedeem.title}"` : 'يرجى إدخال الكود المكون من 12 رمزاً لتفعيل المقرر الدراسي بالكامل.'}
      </p>
      <form onSubmit={handleRedeemSubmit} className="flex flex-col">
        <div className="form-group" style={{ marginBottom: '24px' }}>
          <label className="form-label">كود التفعيل</label>
          <div className="input-container">
            <input
              type="text"
              className="input-text"
              placeholder="مثال: XXXX-XXXX-XXXX"
              value={redeemCode}
              onChange={e => setRedeemCode(e.target.value)}
              required
            />
            <span className="icon input-icon-right">vpn_key</span>
          </div>
        </div>
        <div className="flex gap-md">
          <button type="submit" className="btn btn-primary flex-1" disabled={redeeming}>
            {redeeming ? 'جاري التحقق والتفعيل...' : 'تأكيد التفعيل'}
          </button>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={onClose}
          >
            إلغاء
          </button>
        </div>
      </form>
    </Modal>
  );
};
