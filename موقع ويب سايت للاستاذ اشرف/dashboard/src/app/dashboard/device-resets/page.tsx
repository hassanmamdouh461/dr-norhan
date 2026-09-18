'use client';

import { useState, useEffect } from 'react';
import { api, apiPost } from '@/lib/api';

interface ResetRequest {
  id: string;
  student_id: string;
  student_name: string;
  student_email: string;
  student_phone: string;
  device_id: string;
  platform: 'android' | 'ios' | 'web';
  model: string | null;
  reason: string;
  proof_image_url: string | null;
  status: 'pending' | 'approved' | 'rejected';
  rejection_reason: string | null;
  created_at: string;
  updated_at: string;
}

type ListMeta = { page: number; limit: number; total: number; has_more: boolean };

export default function DeviceResetsPage() {
  const [requests, setRequests] = useState<ResetRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [statusFilter, setStatusFilter] = useState<'pending' | 'approved' | 'rejected'>('pending');
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  // Rejection modal state
  const [selectedRequest, setSelectedRequest] = useState<ResetRequest | null>(null);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const fetchRequests = async (pageNum: number = 1, append: boolean = false) => {
    if (append) setLoadingMore(true); else setLoading(true);
    setError('');
    try {
      const data = await api<{ reset_requests: ResetRequest[]; meta?: ListMeta }>(`/admin/device-resets?status=${statusFilter}&page=${pageNum}&limit=20`);
      setRequests((prev) => append ? [...prev, ...(data.reset_requests || [])] : (data.reset_requests || []));
      setHasMore(!!data.meta?.has_more);
      setPage(pageNum);
    } catch (e: any) {
      setError(e.message || 'فشل تحميل طلبات فك الأجهزة');
    } finally {
      if (append) setLoadingMore(false); else setLoading(false);
    }
  };

  useEffect(() => {
    fetchRequests(1, false);
  }, [statusFilter]);

  const loadMoreRequests = () => {
    if (loadingMore || !hasMore) return;
    fetchRequests(page + 1, true);
  };

  const handleApprove = async (id: string, name: string) => {
    if (!confirm(`هل أنت متأكد من الموافقة على فك ارتباط أجهزة الطالب "${name}"؟ سيتم حذف جميع أجهزته الحالية ليتمكن من تسجيل الدخول من جهاز جديد.`)) return;
    try {
      await apiPost(`/admin/device-resets/${id}/action`, { action: 'approved' });
      fetchRequests(1, false);
    } catch (e: any) {
      setError(e.message || 'فشل الموافقة على الطلب');
    }
  };

  const handleRejectSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRequest || !rejectReason.trim()) return;
    setSubmitting(true);
    try {
      await apiPost(`/admin/device-resets/${selectedRequest.id}/action`, {
        action: 'rejected',
        rejection_reason: rejectReason,
      });
      setShowRejectModal(false);
      setRejectReason('');
      setSelectedRequest(null);
      fetchRequests(1, false);
    } catch (e: any) {
      setError(e.message || 'فشل رفض الطلب');
    } finally {
      setSubmitting(false);
    }
  };

  const formatDate = (dateStr: string) => {
    try {
      return new Date(dateStr).toLocaleString('ar-EG', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
      });
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="space-y-6 text-on-surface">
      {/* Header */}
      <div>
        <h1 className="font-display-lg text-2xl font-bold flex items-center gap-2">
          <span className="material-symbols-outlined text-primary text-2xl">phonelink_erase</span>
          <span>طابور تذاكر طلبات فك الأجهزة</span>
        </h1>
        <p className="font-body-sm text-on-surface-variant text-xs mt-1">مراجعة طلبات فك ارتباط الهواتف للطلاب الذين تجاوزوا الحد الأقصى للأجهزة وقبولها أو رفضها مع كتابة الأسباب</p>
      </div>

      {error && (
        <div className="p-4 rounded-lg bg-error-container/20 border border-error-container text-error text-xs flex items-center justify-between">
          <span>{error}</span>
          <button onClick={() => setError('')} className="underline font-bold transition">إغلاق</button>
        </div>
      )}

      {/* Tabs / Filters */}
      <div className="flex gap-2 flex-wrap border-b border-outline-variant pb-1">
        {[
          { id: 'pending', label: 'طلبات معلقة', icon: 'pending_actions' },
          { id: 'approved', label: 'طلبات مقبولة', icon: 'check_circle' },
          { id: 'rejected', label: 'طلبات مرفوضة', icon: 'cancel' }
        ].map(tab => (
          <button 
            key={tab.id}
            onClick={() => setStatusFilter(tab.id as any)}
            className={`px-5 py-3 text-xs font-bold transition flex items-center gap-2 border-b-2 -mb-[6px] ${
              statusFilter === tab.id 
                ? 'border-primary text-primary' 
                : 'border-transparent text-on-surface-variant hover:text-on-surface'
            }`}
          >
            <span className="material-symbols-outlined text-base">{tab.icon}</span>
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      {/* Requests Table */}
      <div className="bg-surface-container-lowest border border-outline-variant rounded-xl overflow-hidden shadow-soft">
        <div className="overflow-x-auto">
          <table className="w-full text-start text-xs">
            <thead>
              <tr className="border-b border-outline-variant text-on-surface-variant font-bold bg-surface-container-low">
                <th className="px-5 py-4">بيانات الطالب</th>
                <th className="px-5 py-4 text-center">نظام التشغيل</th>
                <th className="px-5 py-4">موديل الهاتف</th>
                <th className="px-5 py-4">سبب طلب التغيير</th>
                <th className="px-5 py-4 text-center">صورة الإثبات</th>
                <th className="px-5 py-4">تاريخ الطلب</th>
                {statusFilter === 'rejected' && <th className="px-5 py-4">سبب الرفض</th>}
                {statusFilter === 'pending' && <th className="px-5 py-4 text-center">الإجراءات</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant">
              {loading ? (
                <tr>
                  <td colSpan={statusFilter === 'rejected' ? 8 : 7} className="text-center py-20">
                    <span className="material-symbols-outlined animate-spin text-primary text-2xl">sync</span>
                  </td>
                </tr>
              ) : requests.length === 0 ? (
                <tr>
                  <td colSpan={statusFilter === 'rejected' ? 8 : 7} className="text-center py-16 text-on-surface-variant">
                    لا توجد طلبات في هذا القسم حالياً
                  </td>
                </tr>
              ) : requests.map(req => (
                <tr key={req.id} className="hover:bg-surface-container/20 transition duration-150">
                  <td className="px-5 py-4">
                    <div>
                      <p className="text-on-surface font-bold text-xs">{req.student_name}</p>
                      <p className="text-on-surface-variant text-[10px] mt-0.5">{req.student_email} • {req.student_phone}</p>
                    </div>
                  </td>
                  <td className="px-5 py-4 text-center font-mono">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                      req.platform === 'android' ? 'bg-green-500/10 text-green-500' :
                      req.platform === 'ios' ? 'bg-blue-500/10 text-blue-500' :
                      'bg-purple-500/10 text-purple-500'
                    }`}>
                      {req.platform.toUpperCase()}
                    </span>
                  </td>
                  <td className="px-5 py-4 text-on-surface font-semibold">{req.model || '-'}</td>
                  <td className="px-5 py-4 text-on-surface-variant max-w-xs truncate" title={req.reason}>
                    {req.reason}
                  </td>
                  <td className="px-5 py-4 text-center">
                    {req.proof_image_url ? (
                      <a 
                        href={req.proof_image_url} 
                        target="_blank" 
                        rel="noreferrer"
                        className="text-primary hover:underline font-bold text-xs flex items-center justify-center gap-1"
                      >
                        <span className="material-symbols-outlined text-sm">open_in_new</span>
                        <span>عرض الإثبات</span>
                      </a>
                    ) : (
                      <span className="text-outline">لا يوجد</span>
                    )}
                  </td>
                  <td className="px-5 py-4 text-outline text-[10px]">{formatDate(req.created_at)}</td>
                  {statusFilter === 'rejected' && (
                    <td className="px-5 py-4 text-error font-medium">{req.rejection_reason || '-'}</td>
                  )}
                  {statusFilter === 'pending' && (
                    <td className="px-5 py-4">
                      <div className="flex items-center justify-center gap-2">
                        <button 
                          onClick={() => handleApprove(req.id, req.student_name)}
                          className="px-3 py-1.5 bg-success-container/30 hover:bg-success-container text-success font-bold rounded-lg text-[10px] transition duration-150 flex items-center gap-1"
                          title="موافقة وفك ربط الأجهزة"
                        >
                          <span className="material-symbols-outlined text-sm">check</span>
                          <span>موافقة</span>
                        </button>
                        <button 
                          onClick={() => { setSelectedRequest(req); setShowRejectModal(true); }}
                          className="px-3 py-1.5 bg-error-container/20 hover:bg-error-container text-error font-bold rounded-lg text-[10px] transition duration-150 flex items-center gap-1"
                          title="رفض الطلب"
                        >
                          <span className="material-symbols-outlined text-sm">close</span>
                          <span>رفض</span>
                        </button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {hasMore && (
          <div className="border-t border-outline-variant p-4 text-center">
            <button
              onClick={loadMoreRequests}
              disabled={loadingMore}
              className="rounded-lg border border-outline-variant bg-surface px-6 py-2 text-xs font-bold text-on-surface-variant transition hover:border-primary/40 hover:text-primary hover:bg-surface-container disabled:opacity-50"
            >
              {loadingMore ? (
                <span className="material-symbols-outlined animate-spin align-middle text-sm">sync</span>
              ) : (
                'تحميل المزيد'
              )}
            </button>
          </div>
        )}
      </div>

      {/* Reject Ticket Reason Modal */}
      {showRejectModal && selectedRequest && (
        <div 
          className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 animate-in fade-in duration-300"
          onClick={() => setShowRejectModal(false)}
        >
          <form 
            onSubmit={handleRejectSubmit}
            className="bg-surface-container-lowest border border-outline-variant rounded-xl p-6 w-full max-w-md space-y-5 shadow-ambient animate-in zoom-in-95 duration-200"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-outline-variant pb-2">
              <h3 className="text-sm font-bold text-on-surface flex items-center gap-2">
                <span className="material-symbols-outlined text-error text-base">cancel</span>
                <span>رفض طلب فك الأجهزة للطالب</span>
              </h3>
              <button 
                type="button" 
                onClick={() => setShowRejectModal(false)} 
                className="text-on-surface-variant hover:text-on-surface transition flex items-center"
              >
                <span className="material-symbols-outlined text-base">close</span>
              </button>
            </div>

            <div className="space-y-2">
              <p className="text-on-surface-variant text-xs">
                يرجى كتابة سبب رفض طلب الطالب <span className="font-bold text-on-surface">{selectedRequest.student_name}</span>. سيتمكن الطالب من رؤية السبب من تطبيقه.
              </p>
              <textarea 
                required
                rows={4}
                placeholder="مثال: يرجى إرفاق صورة إثبات صحيحة لتغيير الهاتف أو الاتصال بالدعم مباشرة..." 
                value={rejectReason} 
                onChange={e => setRejectReason(e.target.value)}
                className="w-full px-4 py-3 bg-surface-container-low border border-outline-variant focus:border-primary rounded-lg text-xs text-on-surface focus:outline-none transition resize-none" 
              />
            </div>

            <div className="flex gap-3 pt-2">
              <button 
                type="submit" 
                disabled={submitting || !rejectReason.trim()}
                className="flex-1 py-2.5 bg-error text-on-error font-bold rounded-lg text-xs transition duration-300 disabled:opacity-50 flex justify-center items-center gap-1.5"
              >
                {submitting && <span className="material-symbols-outlined animate-spin text-sm">sync</span>}
                <span>رفض الطلب وإرساله</span>
              </button>
              <button 
                type="button" 
                onClick={() => setShowRejectModal(false)} 
                className="px-5 py-2.5 bg-surface border border-outline-variant text-on-surface-variant rounded-lg text-xs transition duration-300"
              >
                إلغاء
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
