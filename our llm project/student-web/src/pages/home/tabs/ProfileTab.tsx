import type { ChangeEvent, FC, FormEvent } from 'react';
import { useState } from 'react';
import { SkeletonProfile } from '../../../components/Skeleton';
import { ApiService, getDeviceId } from '../../../services/api';
import { getNotificationPermissionState, requestPushPermission } from '../../../services/firebase';
import { useToast } from '../../../context/ToastContext';
import { GuidedTour, type TourStep } from '../../../components/GuidedTour';

const PROFILE_TOUR_STEPS: TourStep[] = [
  { selector: '[data-tour="tour-profile-edit"]', title: 'البيانات الشخصية', text: 'حدّث بياناتك الشخصية وصفك الدراسي من هنا في أي وقت، ولا تنسَ الضغط على "حفظ التغييرات".' },
  { selector: '[data-tour="tour-profile-push"]', title: 'إشعارات المتصفح', text: 'فعّل الإشعارات لتصلك تنبيهات فورية بالمحاضرات والامتحانات الجديدة حتى عند إغلاق المنصة.' },
  { selector: '[data-tour="tour-profile-devices"]', title: 'الأجهزة المربوطة', text: 'حسابك مسموح له بالدخول من جهازين فقط لضمان الأمان. يمكنك إلغاء ربط أي جهاز من هنا.' },
  { selector: '[data-tour="tour-profile-financials"]', title: 'العمليات المالية', text: 'سجل كامل لكل عمليات تفعيل المقررات والأكواد التي استخدمتها.' },
  { selector: '[data-tour="tour-profile-quizzes"]', title: 'نتائج الامتحانات', text: 'كل درجاتك في الامتحانات والواجبات محفوظة هنا للرجوع إليها لاحقًا.' },
];

const governorates = [
  'القاهرة', 'الجيزة', 'الإسكندرية', 'القليوبية', 'الدقهلية',
  'الشرقية', 'المنوفية', 'الغربية', 'البحيرة', 'دمياط',
  'كفر الشيخ', 'الفيوم', 'بني سويف', 'المنيا',
  'أسيوط', 'سوهاج', 'قنا', 'الأقصر', 'أسوان', 'البحر الأحمر',
  'الوادي الجديد', 'مطروح', 'شمال سيناء', 'جنوب سيناء', 'السويس', 'الإسماعيلية', 'بورسعيد'
];

interface ProfileTabProps {
  loading: boolean;
  profile: any | null;
  avatarUrl: string | null;
  handleAvatarChange: (e: ChangeEvent<HTMLInputElement>) => void;
  isUploadingAvatar: boolean;
  stats: { coursesCount: number; quizzesCount: number; questionsCount: number };
  editName: string;
  setEditName: (v: string) => void;
  editPhone: string;
  setEditPhone: (v: string) => void;
  editParentPhone: string;
  setEditParentPhone: (v: string) => void;
  editGov: string;
  setEditGov: (v: string) => void;
  editGrade: string;
  setEditGrade: (v: string) => void;
  editBranch: string;
  setEditBranch: (v: string) => void;
  academicYears: string[];
  getFilteredBranches: (grade: string) => string[];
  handleUpdateProfile: (e: FormEvent) => void;
  updatingProfile: boolean;
  devices: any[];
  handleUnbindDevice: (id: string) => void;
  resetRequests: any[];
  financials: any[];
  quizzes: any[];
  playbackLogs: any[];
}

/** Profile tab: avatar/profile header, edit form, linked devices, financials, quiz & playback history. */
export const ProfileTab: FC<ProfileTabProps> = ({
  loading,
  profile,
  avatarUrl,
  handleAvatarChange,
  isUploadingAvatar,
  stats,
  editName, setEditName,
  editPhone, setEditPhone,
  editParentPhone, setEditParentPhone,
  editGov, setEditGov,
  editGrade, setEditGrade,
  editBranch, setEditBranch,
  academicYears,
  getFilteredBranches,
  handleUpdateProfile,
  updatingProfile,
  devices,
  handleUnbindDevice,
  resetRequests,
  financials,
  quizzes,
  playbackLogs,
}) => {
  const { showToast } = useToast();
  const [pushPermission, setPushPermission] = useState<NotificationPermission | null>(() => getNotificationPermissionState());
  const [pushLoading, setPushLoading] = useState(false);

  const handleEnablePush = async () => {
    setPushLoading(true);
    try {
      const token = await requestPushPermission();
      setPushPermission(getNotificationPermissionState());
      if (token) {
        await ApiService.registerDevice({
          device_id: getDeviceId(),
          platform: 'web',
          model: navigator.userAgent.substring(0, 50),
          push_token: token,
        });
        showToast('success', 'تم تفعيل الإشعارات', 'سيصلك الآن إشعارات المنصة على هذا المتصفح.');
      } else {
        showToast('warning', 'تعذّر تفعيل الإشعارات', 'يرجى السماح بالإشعارات من إعدادات المتصفح والمحاولة مرة أخرى.');
      }
    } catch {
      showToast('error', 'حدث خطأ', 'تعذّر تفعيل الإشعارات، يرجى المحاولة مرة أخرى.');
    } finally {
      setPushLoading(false);
    }
  };

  return (
    <>
      {loading && !profile && (
        <div className="flex flex-col gap-xl" style={{ direction: 'rtl' }}>
          <SkeletonProfile />
        </div>
      )}

      {profile && (
        <div className="flex flex-col gap-xl" style={{ direction: 'rtl' }}>
          <GuidedTour steps={PROFILE_TOUR_STEPS} storageKey="profile_tab_tour_seen_v1" active={!loading} />

          {/* Redesigned Premium Profile Header */}
          <div
            className="card premium-card"
            style={{
              borderRadius: '20px',
              padding: '32px 24px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '24px'
            }}
          >
            <div className="flex items-center gap-lg flex-wrap">
              {/* Avatar with Upload Trigger */}
              <div className="avatar-container">
                <div
                  style={{
                    width: '110px',
                    height: '110px',
                    borderRadius: '50%',
                    overflow: 'hidden',
                    border: '3px solid rgb(var(--primary))',
                    boxShadow: '0 0 25px rgba(var(--primary), 0.25)',
                    backgroundColor: 'rgb(var(--surface-container-high))',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    position: 'relative'
                  }}
                >
                  {avatarUrl ? (
                    <img src={avatarUrl} alt="صورة شخصية" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : (
                    <span className="icon" style={{ fontSize: '48px', color: 'rgb(var(--primary))' }}>person</span>
                  )}

                  {/* Hover Overlay for Camera Upload */}
                  <div className="avatar-overlay">
                    <span className="icon" style={{ color: '#fff', fontSize: '24px', marginBottom: '2px' }}>photo_camera</span>
                    <span style={{ fontSize: '11px', color: '#ccc', fontWeight: 'bold' }}>تغيير الصورة</span>
                  </div>
                </div>

                {/* File Input */}
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleAvatarChange}
                  style={{
                    position: 'absolute',
                    inset: 0,
                    opacity: 0,
                    cursor: 'pointer',
                    zIndex: 3
                  }}
                  disabled={isUploadingAvatar}
                />

                {/* Uploading Spinner */}
                {isUploadingAvatar && (
                  <div style={{ position: 'absolute', inset: 0, backgroundColor: 'rgba(0,0,0,0.7)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 4 }}>
                    <span className="icon animate-spin" style={{ color: 'rgb(var(--primary))', fontSize: '28px' }}>sync</span>
                  </div>
                )}
              </div>

              <div>
                <h2 style={{ fontSize: '22px', fontWeight: '800', color: 'rgb(var(--on-surface))', marginBottom: '6px' }}>
                  {profile?.full_name}
                </h2>
                <p style={{ fontSize: '13px', color: 'rgb(var(--on-surface-variant))', marginBottom: '12px', fontWeight: 'bold' }}>
                  {profile?.phone}
                </p>
                <div className="flex gap-sm flex-wrap">
                  <span className="badge" style={{ backgroundColor: 'rgba(var(--primary), 0.1)', color: 'rgb(var(--primary))', border: '1px solid rgba(var(--primary), 0.25)', fontSize: '11px', padding: '4px 12px', borderRadius: '20px' }}>
                    {profile?.grade}
                  </span>
                  <span className="badge" style={{ backgroundColor: 'rgba(var(--on-surface), 0.03)', color: 'rgb(var(--on-surface-variant))', border: '1px solid rgba(var(--on-surface), 0.08)', fontSize: '11px', padding: '4px 12px', borderRadius: '20px' }}>
                    {profile?.governorate}
                  </span>
                  <span className="badge" style={{ backgroundColor: 'rgb(var(--success) / 0.1)', color: 'rgb(var(--success))', border: '1px solid rgb(var(--success) / 0.2)', fontSize: '11px', padding: '4px 12px', borderRadius: '20px', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                    <span className="status-dot answered" style={{ width: '5px', height: '5px', marginLeft: 0 }} />
                    حساب نشط
                  </span>
                </div>
              </div>
            </div>

            {/* Quick Info Block */}
            <div className="flex gap-md hide-mobile">
              <div style={{ backgroundColor: 'rgba(var(--on-surface), 0.02)', padding: '12px 20px', borderRadius: '12px', border: '1px solid rgba(var(--on-surface), 0.05)', textAlign: 'center' }}>
                <span style={{ fontSize: '11px', color: 'rgb(var(--on-surface-variant))', display: 'block', marginBottom: '2px' }}>المحاضرات</span>
                <span style={{ fontSize: '20px', fontWeight: '800', color: 'rgb(var(--on-surface))' }}>{stats.coursesCount}</span>
              </div>
              <div style={{ backgroundColor: 'rgba(var(--on-surface), 0.02)', padding: '12px 20px', borderRadius: '12px', border: '1px solid rgba(var(--on-surface), 0.05)', textAlign: 'center' }}>
                <span style={{ fontSize: '11px', color: 'rgb(var(--on-surface-variant))', display: 'block', marginBottom: '2px' }}>الامتحانات</span>
                <span style={{ fontSize: '20px', fontWeight: '800', color: 'rgb(var(--on-surface))' }}>{stats.quizzesCount}</span>
              </div>
            </div>
          </div>

          <div className="grid-2 gap-lg" style={{ alignItems: 'start' }}>
            {/* Profile Edit Form */}
            <div className="card" data-tour="tour-profile-edit">
              <h3 className="title-small" style={{ marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span className="icon" style={{ color: 'rgb(var(--primary))' }}>manage_accounts</span>
                تعديل البيانات الشخصية
              </h3>
              <form onSubmit={handleUpdateProfile} className="flex flex-col gap-md">
                <div className="form-group">
                  <label className="form-label">الاسم بالكامل</label>
                  <input type="text" className="input-text" value={editName} onChange={e => setEditName(e.target.value)} required style={{ borderRadius: '10px', backgroundColor: 'rgb(var(--surface-container-low))', border: '1px solid rgb(var(--outline-variant) / 0.15)', color: 'rgb(var(--on-surface))' }} />
                </div>
                <div className="form-group">
                  <label className="form-label">رقم الهاتف الشخصي</label>
                  <input type="tel" className="input-text" value={editPhone} onChange={e => setEditPhone(e.target.value)} required style={{ borderRadius: '10px', backgroundColor: 'rgb(var(--surface-container-low))', border: '1px solid rgb(var(--outline-variant) / 0.15)', color: 'rgb(var(--on-surface))' }} />
                </div>
                <div className="form-group">
                  <label className="form-label">رقم ولي الأمر</label>
                  <input type="tel" className="input-text" value={editParentPhone} onChange={e => setEditParentPhone(e.target.value)} required style={{ borderRadius: '10px', backgroundColor: 'rgb(var(--surface-container-low))', border: '1px solid rgb(var(--outline-variant) / 0.15)', color: 'rgb(var(--on-surface))' }} />
                </div>
                <div className="grid-2 gap-sm">
                  <div className="form-group">
                    <label className="form-label">المحافظة</label>
                    <select className="select" value={editGov} onChange={e => setEditGov(e.target.value)} style={{ borderRadius: '10px', backgroundColor: 'rgb(var(--surface-container-low))', border: '1px solid rgb(var(--outline-variant) / 0.15)', color: 'rgb(var(--on-surface))' }}>
                      {governorates.map(g => <option key={g} value={g}>{g}</option>)}
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">المرحلة الدراسية</label>
                    <select className="select" value={editGrade} onChange={e => {
                      const newGrade = e.target.value;
                      setEditGrade(newGrade);
                      const allowedSpecs = getFilteredBranches(newGrade);
                      if (!allowedSpecs.includes(editBranch)) {
                        setEditBranch(allowedSpecs[0] || '');
                      }
                    }} style={{ borderRadius: '10px', backgroundColor: 'rgb(var(--surface-container-low))', border: '1px solid rgb(var(--outline-variant) / 0.15)', color: 'rgb(var(--on-surface))' }}>
                      {academicYears.map(g => <option key={g} value={g}>{g}</option>)}
                    </select>
                  </div>
                </div>
                {getFilteredBranches(editGrade).length > 0 && (
                  <div className="form-group" style={{ marginTop: '12px' }}>
                    <label className="form-label">التخصص / الشعبة</label>
                    <select className="select" value={editBranch} onChange={e => setEditBranch(e.target.value)} style={{ borderRadius: '10px', backgroundColor: 'rgb(var(--surface-container-low))', border: '1px solid rgb(var(--outline-variant) / 0.15)', color: 'rgb(var(--on-surface))' }}>
                      <option value="">اختر الشعبة...</option>
                      {getFilteredBranches(editGrade).map(b => <option key={b} value={b}>{b}</option>)}
                    </select>
                  </div>
                )}
                <button type="submit" className="btn btn-primary" disabled={updatingProfile} style={{ marginTop: '12px', borderRadius: '10px' }}>
                  {updatingProfile ? 'جاري الحفظ...' : 'حفظ التغييرات'}
                </button>
              </form>
            </div>

            {/* Security & Linked Devices */}
            <div className="flex flex-col gap-lg">
              {/* Browser Push Notifications Opt-in */}
              <div className="card" data-tour="tour-profile-push">
                <h3 className="title-small" style={{ marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span className="icon" style={{ color: 'rgb(var(--primary))' }}>notifications_active</span>
                  إشعارات المتصفح
                </h3>
                <p className="body-small" style={{ marginBottom: '16px', lineHeight: '1.6' }}>
                  فعّل إشعارات المتصفح لتصلك تنبيهات فورية بالمحاضرات والامتحانات الجديدة حتى عند إغلاق المنصة.
                </p>
                <div className="flex items-center justify-between gap-md flex-wrap">
                  <span
                    className="badge"
                    style={{
                      backgroundColor: pushPermission === 'granted' ? 'rgb(var(--success) / 0.1)' : pushPermission === 'denied' ? 'rgb(var(--error) / 0.1)' : 'rgb(var(--warning) / 0.1)',
                      color: pushPermission === 'granted' ? 'rgb(var(--success))' : pushPermission === 'denied' ? 'rgb(var(--error))' : 'rgb(var(--warning))',
                      border: `1px solid ${pushPermission === 'granted' ? 'rgb(var(--success) / 0.2)' : pushPermission === 'denied' ? 'rgb(var(--error) / 0.2)' : 'rgb(var(--warning) / 0.2)'}`,
                      fontSize: '11px',
                      padding: '4px 12px',
                      borderRadius: '20px'
                    }}
                  >
                    {pushPermission === 'granted' ? 'مفعّلة' : pushPermission === 'denied' ? 'محظورة' : 'غير مفعّلة'}
                  </span>
                  <button
                    type="button"
                    className="btn btn-primary"
                    style={{ padding: '8px 16px', fontSize: '12px', borderRadius: '10px' }}
                    onClick={handleEnablePush}
                    disabled={pushLoading || pushPermission === 'denied'}
                  >
                    {pushLoading ? 'جاري التفعيل...' : pushPermission === 'granted' ? 'إعادة المزامنة' : 'تفعيل إشعارات المتصفح'}
                  </button>
                </div>
                {pushPermission === 'denied' && (
                  <p className="body-small" style={{ marginTop: '10px', color: 'rgb(var(--error))' }}>
                    تم حظر الإشعارات من إعدادات المتصفح. يرجى تفعيلها يدويًا من إعدادات الموقع في المتصفح.
                  </p>
                )}
              </div>

              <div className="card" data-tour="tour-profile-devices">
                <h3 className="title-small" style={{ marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span className="icon" style={{ color: 'rgb(var(--primary))' }}>devices</span>
                  الأجهزة المربوطة بالحساب
                </h3>
                <p className="body-small" style={{ marginBottom: '20px', lineHeight: '1.6' }}>
                  يسمح لك النظام بالدخول من جهازين فقط لضمان أمان حسابك.
                </p>

                <div className="flex flex-col gap-sm">
                  {devices.length === 0 ? (
                    <p className="body-medium" style={{ color: 'rgb(var(--on-surface-variant))', fontStyle: 'italic' }}>لا توجد أجهزة مربوطة.</p>
                  ) : (
                    devices.map(dev => (
                      <div key={dev.id} className="card-flat flex justify-between items-center" style={{ padding: '12px', borderRadius: '10px', backgroundColor: 'rgba(var(--on-surface), 0.03)', border: '1px solid rgba(var(--on-surface), 0.06)' }}>
                        <div className="flex items-center gap-md">
                          <span className="icon" style={{ fontSize: '24px', color: 'rgb(var(--primary))' }}>laptop_mac</span>
                          <div>
                            <p className="body-medium" style={{ fontWeight: 'bold', color: 'rgb(var(--on-surface))', fontSize: '13px' }}>{dev.model || 'متصفح ويب'}</p>
                            <p className="body-small" style={{ fontSize: '11px' }}>رابط الجهاز: {dev.device_id.substring(0, 15)}...</p>
                          </div>
                        </div>
                        <button
                          className="btn btn-error"
                          style={{ padding: '6px 12px', fontSize: '11px', borderRadius: '8px' }}
                          onClick={() => handleUnbindDevice(dev.id)}
                        >
                          إلغاء الربط
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Device Reset Requests List */}
              <div className="card">
                <h3 className="title-small" style={{ marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span className="icon" style={{ color: 'rgb(var(--primary))' }}>history</span>
                  طلبات إعادة تعيين الأجهزة
                </h3>
                <div className="flex flex-col gap-sm">
                  {resetRequests.length === 0 ? (
                    <p className="body-small" style={{ color: 'rgb(var(--on-surface-variant))', fontStyle: 'italic' }}>لا توجد طلبات سابقة.</p>
                  ) : (
                    resetRequests.map((req: any) => (
                      <div key={req.id} className="card-flat flex justify-between items-center" style={{ padding: '12px', borderRadius: '10px', backgroundColor: 'rgba(var(--on-surface), 0.03)', border: '1px solid rgba(var(--on-surface), 0.06)' }}>
                        <div>
                          <p className="body-medium" style={{ fontWeight: 'bold', color: 'rgb(var(--on-surface))', fontSize: '12px' }}>السبب: {req.reason}</p>
                          <span className="body-small" style={{ fontSize: '11px' }}>{new Date(req.created_at).toLocaleDateString('ar-EG')}</span>
                        </div>
                        <span
                          className={`badge`}
                          style={{
                            backgroundColor: req.status === 'approved' ? 'rgb(var(--success) / 0.12)' : req.status === 'pending' ? 'rgb(var(--warning) / 0.12)' : 'rgb(var(--error) / 0.12)',
                            color: req.status === 'approved' ? 'rgb(var(--success))' : req.status === 'pending' ? 'rgb(var(--warning))' : 'rgb(var(--error))',
                            border: req.status === 'approved' ? '1px solid rgb(var(--success) / 0.2)' : req.status === 'pending' ? '1px solid rgb(var(--warning) / 0.2)' : '1px solid rgb(var(--error) / 0.2)',
                            fontSize: '11px',
                            padding: '2px 8px',
                            borderRadius: '6px'
                          }}
                        >
                          {req.status === 'approved' ? 'تمت الموافقة' : req.status === 'pending' ? 'قيد الانتظار' : 'مرفوض'}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Financial Transactions Log */}
          <div className="card" data-tour="tour-profile-financials">
            <h3 className="title-small" style={{ marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span className="icon" style={{ color: 'rgb(var(--primary))' }}>payments</span>
              سجل العمليات المالية وتفعيل الأكواد
            </h3>
            <div className="flex flex-col gap-sm">
              {financials.length === 0 ? (
                <p className="body-small" style={{ color: 'rgb(var(--on-surface-variant))', fontStyle: 'italic' }}>لا توجد عمليات مسجلة.</p>
              ) : (
                financials.map((fin: any) => (
                  <div key={fin.id} className="card-flat flex justify-between items-center" style={{ padding: '12px', borderRadius: '10px', backgroundColor: 'rgba(var(--on-surface), 0.03)', border: '1px solid rgba(var(--on-surface), 0.06)' }}>
                    <div>
                      <p className="body-medium" style={{ fontWeight: 'bold', color: 'rgb(var(--on-surface))', fontSize: '13px' }}>{fin.course_title || 'تفعيل مقرر'}</p>
                      <span className="body-small" style={{ fontSize: '11px' }}>{new Date(fin.created_at).toLocaleDateString('ar-EG')}</span>
                    </div>
                    <div className="flex flex-col items-end">
                      <span className="badge" style={{ backgroundColor: 'rgba(var(--primary), 0.1)', color: 'rgb(var(--primary))', border: '1px solid rgba(var(--primary), 0.2)', fontSize: '11px', padding: '2px 8px', borderRadius: '6px' }}>
                        {fin.amount > 0 ? `+${fin.amount}` : fin.amount} ج.م
                      </span>
                      {fin.code_string && <span style={{ fontSize: '11px', color: 'rgb(var(--on-surface-variant))', marginTop: '4px' }}>كود: {fin.code_string}</span>}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Quiz attempts scores */}
          <div className="card" data-tour="tour-profile-quizzes">
            <h3 className="title-small" style={{ marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span className="icon" style={{ color: 'rgb(var(--primary))' }}>grade</span>
              نتائج ودرجات الامتحانات والواجبات
            </h3>
            <div className="flex flex-col gap-sm">
              {quizzes.length === 0 ? (
                <p className="body-small" style={{ color: 'rgb(var(--on-surface-variant))', fontStyle: 'italic' }}>لم يتم حل أي امتحانات بعد.</p>
              ) : (
                quizzes.map((q: any) => {
                  const pct = ((q.score / q.max_score) * 100).toFixed(0);
                  return (
                    <div key={q.id} className="card-flat flex justify-between items-center" style={{ padding: '12px', borderRadius: '10px', backgroundColor: 'rgba(var(--on-surface), 0.03)', border: '1px solid rgba(var(--on-surface), 0.06)' }}>
                      <div>
                        <p className="body-medium" style={{ fontWeight: 'bold', color: 'rgb(var(--on-surface))', fontSize: '13px' }}>{q.quiz_title}</p>
                        <span className="body-small" style={{ fontSize: '11px' }}>{new Date(q.created_at).toLocaleDateString('ar-EG')}</span>
                      </div>
                      <div className="flex flex-col items-end">
                        <span style={{ fontWeight: 'bold', fontSize: '14px', color: parseInt(pct) >= 50 ? 'rgb(16, 185, 129)' : 'rgb(var(--primary))' }}>{pct}%</span>
                        <span style={{ fontSize: '11px', color: 'rgb(var(--on-surface-variant))' }}>{q.score} / {q.max_score}</span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Playback Logs timeline */}
          <div className="card">
            <h3 className="title-small" style={{ marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span className="icon" style={{ color: 'rgb(var(--primary))' }}>history_edu</span>
              سجل مشاهدة المحاضرات والدورات
            </h3>
            <div className="flex flex-col gap-sm">
              {playbackLogs.length === 0 ? (
                <p className="body-small" style={{ color: 'rgb(var(--on-surface-variant))', fontStyle: 'italic' }}>لا توجد مشاهدات مسجلة بعد.</p>
              ) : (
                playbackLogs.map((log: any) => (
                  <div key={log.id} className="card-flat flex justify-between items-center" style={{ padding: '12px', borderRadius: '10px', backgroundColor: 'rgba(var(--on-surface), 0.03)', border: '1px solid rgba(var(--on-surface), 0.06)' }}>
                    <div>
                      <p className="body-medium" style={{ fontWeight: 'bold', color: 'rgb(var(--on-surface))', fontSize: '13px' }}>{log.lesson_title}</p>
                      <span className="body-small" style={{ fontSize: '11px' }}>{new Date(log.created_at).toLocaleString('ar-EG')}</span>
                    </div>
                    <span
                      className="badge"
                      style={{
                        backgroundColor: log.action === 'open' ? 'rgba(var(--primary), 0.1)' : 'rgb(var(--on-surface) / 0.04)',
                        color: log.action === 'open' ? 'rgb(var(--primary))' : 'rgb(var(--on-surface-variant))',
                        border: log.action === 'open' ? '1px solid rgba(var(--primary), 0.2)' : '1px solid rgb(var(--on-surface) / 0.08)',
                        fontSize: '11px',
                        padding: '4px 10px',
                        borderRadius: '6px'
                      }}
                    >
                      {log.action === 'open' ? 'بدء المشاهدة' : 'مغادرة المشاهدة'} ({log.position_seconds} ثانية)
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
};
