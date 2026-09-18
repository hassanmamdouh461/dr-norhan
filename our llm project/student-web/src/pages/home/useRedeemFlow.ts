import { useState } from 'react';
import type { FormEvent } from 'react';
import { ApiService } from '../../services/api';
import type { ShowToastFn } from './types';

/** "Redeem course code" modal state and submit handler. */
export function useRedeemFlow(loadData: () => Promise<void>, showToast: ShowToastFn) {
  const [redeemCode, setRedeemCode] = useState('');
  const [showRedeemModal, setShowRedeemModal] = useState(false);
  const [redeeming, setRedeeming] = useState(false);
  const [selectedCourseForRedeem, setSelectedCourseForRedeem] = useState<any | null>(null);

  const handleRedeemSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!redeemCode.trim()) return;
    setRedeeming(true);
    try {
      const res = await ApiService.redeemCode(redeemCode.trim(), selectedCourseForRedeem?.id);
      showToast('success', res.message || 'تم تفعيل الكورس بنجاح!');
      setShowRedeemModal(false);
      setRedeemCode('');
      loadData();
    } catch (err: any) {
      showToast('error', err.message || 'فشل تفعيل الكود، يرجى المحاولة لاحقاً');
    } finally {
      setRedeeming(false);
    }
  };

  return {
    redeemCode,
    setRedeemCode,
    showRedeemModal,
    setShowRedeemModal,
    redeeming,
    selectedCourseForRedeem,
    setSelectedCourseForRedeem,
    handleRedeemSubmit,
  };
}
