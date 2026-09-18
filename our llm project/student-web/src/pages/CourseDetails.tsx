import React, { useEffect, useState } from 'react';
import { ApiService } from '../services/api';
import Loader from '../components/Loader';
import CourseCoverFallback from '../components/CourseCoverFallback';
import Modal from '../components/ui/Modal';
import { GuidedTour, type TourStep } from '../components/GuidedTour';
import { optimizedCoverUrl, parseCoverPosition } from '../utils/img';

const COURSE_TOUR_STEPS: TourStep[] = [
  { selector: '[data-tour="tour-course-info"]', title: 'بيانات المقرر', text: 'هنا تجد وصف المقرر وعدد وحداته ومحاضراته، وحالة تفعيله في حسابك.' },
  { selector: '[data-tour="tour-course-curriculum"]', title: 'الدروس', text: 'اضغط على أي محاضرة للبدء بمشاهدتها. المحاضرات المقفلة تحتاج تفعيل الكود أولاً.' },
  { selector: '[data-tour="tour-course-enroll"]', title: 'التفعيل والاشتراك', text: 'من هنا تفعّل المقرر بكود الاشتراك، وتطّلع على أهم المميزات التي يشملها.' },
];

interface CourseDetailsProps {
  courseId: string;
  isLoggedIn?: boolean;
  onBack: () => void;
  onSelectLesson: (lessonId: string, title: string, type: 'video' | 'pdf', isFree?: boolean) => void;
}

export const CourseDetails: React.FC<CourseDetailsProps> = ({
  courseId,
  isLoggedIn = false,
  onBack,
  onSelectLesson,
}) => {
  const [course, setCourse] = useState<any | null>(null);
  const [units, setUnits] = useState<any[]>([]);
  const [progress, setProgress] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);

  const [redeemCode, setRedeemCode] = useState('');
  const [showRedeemModal, setShowRedeemModal] = useState(false);
  const [redeeming, setRedeeming] = useState(false);
  const [redeemError, setRedeemError] = useState('');
  const [redeemSuccess, setRedeemSuccess] = useState('');

  const loadCourseData = async () => {
    setLoading(true);
    try {
      const details = await ApiService.getCourseDetails(courseId);
      setCourse(details.course || details);
      setUnits(details.units || []);

      if (isLoggedIn) {
        const prog = await ApiService.getCourseProgress(courseId).catch(() => null);
        if (prog) {
          setProgress(prog.progress || prog);
        }
      }
    } catch (err) {
      console.error('Error loading course details:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCourseData();
  }, [courseId]);

  useEffect(() => {
    if (course?.title) {
      document.title = `${course.title} | كيميا`;
    }
    return () => {
      document.title = 'كيميا | منصة الهضبة - الكيمياء للثانوية العامة';
    };
  }, [course?.title]);

  const handleRedeemSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!redeemCode.trim()) return;
    setRedeeming(true);
    setRedeemError('');
    setRedeemSuccess('');
    try {
      const res = await ApiService.redeemCode(redeemCode.trim(), course.id);
      setRedeemSuccess(res.message || 'تم تفعيل الكورس بنجاح!');
      setRedeemCode('');
      loadCourseData();
      setTimeout(() => {
        setShowRedeemModal(false);
        setRedeemSuccess('');
      }, 2000);
    } catch (err: any) {
      setRedeemError(err.message || 'كود غير صحيح أو منتهي الصلاحية');
    } finally {
      setRedeeming(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center" style={{ minHeight: '300px' }}>
        <Loader text="جاري تحميل تفاصيل المقرر" size="medium" />
      </div>
    );
  }

  if (!course) {
    return (
      <div className="card text-center" style={{ padding: '40px' }}>
        <span className="icon" style={{ fontSize: '48px', color: 'rgb(var(--error))', marginBottom: '16px' }}>error</span>
        <h3 className="title-small">المقرر غير متوفر</h3>
        <button className="btn btn-secondary" onClick={onBack} style={{ marginTop: '16px' }}>العودة للرئيسية</button>
      </div>
    );
  }

  const isEnrolled = progress?.is_subscribed || course.is_free === 1 || course.is_enrolled === 1 || course.is_enrolled === true;

  return (
    <div style={{ direction: 'rtl' }} className="flex flex-col gap-lg">
      <GuidedTour steps={COURSE_TOUR_STEPS} storageKey="course_details_tour_seen_v1" active={!loading} />

      {/* Back Button */}
      <div className="flex items-center">
        <button className="btn btn-secondary" onClick={onBack}>
          <span className="icon" aria-hidden="true">arrow_forward</span>
          العودة للرئيسية
        </button>
      </div>

      <div className="course-details-grid">
        
        {/* Right side: Course curriculum and progress */}
        <div className="course-details-main">
          
          {/* Course Info Card */}
          <div className="card flex-col gap-sm" style={{ padding: '28px' }} data-tour="tour-course-info">
            <div className="flex items-center gap-md" style={{ marginBottom: '8px', flexWrap: 'wrap' }}>
              <h2 className="title-medium" style={{ margin: 0, fontWeight: '800', color: 'rgb(var(--on-surface))' }}>{course.title}</h2>
              <span className={`badge ${isEnrolled ? 'badge-success' : 'badge-warning'}`}>
                {course.is_free === 1 ? 'مجاني بالكامل' : isEnrolled ? 'مفعّل لحسابك' : 'يحتاج كود تفعيل'}
              </span>
            </div>
            <p className="body-medium" style={{ color: 'rgb(var(--on-surface-variant))', lineHeight: '1.7', marginBottom: '12px' }}>
              {course.description || 'شرح شامل للمقرر الدراسي بأسلوب تفاعلي حديث.'}
            </p>
            <div className="flex gap-md" style={{ color: 'rgb(var(--on-surface-variant))', fontSize: '12px', fontWeight: '500' }}>
              <div className="flex items-center gap-xs">
                <span className="icon" style={{ fontSize: '16px' }}>menu_book</span>
                <span>{units.length} وحدات دراسية</span>
              </div>
              <div className="flex items-center gap-xs">
                <span className="icon" style={{ fontSize: '16px' }}>play_circle</span>
                <span>{units.reduce((acc, u) => acc + (u.lessons?.length || 0), 0)} محاضرة</span>
              </div>
            </div>
          </div>

          {/* Progress tracker if enrolled */}
          {isEnrolled && progress && (
            <div className="card flex-col gap-sm" style={{ padding: '20px' }}>
              <div className="flex justify-between items-center" style={{ fontWeight: 'bold' }}>
                <span style={{ fontSize: '13px' }}>نسبة إنجازك في المقرر الدراسي</span>
                <span style={{ color: 'rgb(var(--primary))', fontSize: '14px' }}>{progress.percentage || 0}%</span>
              </div>
              <div style={{ height: '8px', backgroundColor: 'rgb(var(--surface-container-highest))', borderRadius: '4px', overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${progress.percentage || 0}%`, backgroundColor: 'rgb(var(--primary))', transition: 'width 0.5s ease-in-out' }}></div>
              </div>
              <span style={{ fontSize: '11px', color: 'rgb(var(--on-surface-variant))' }}>
                أنجزت {progress.completed || 0} من أصل {progress.total_lessons || 0} محاضرات
              </span>
            </div>
          )}

          {/* Units Accordion */}
          <div className="flex flex-col gap-md" data-tour="tour-course-curriculum">
            <h3 className="title-small" style={{ fontWeight: '800' }}>الدروس</h3>
            
            {units.length === 0 ? (
              <p className="body-medium" style={{ fontStyle: 'italic', color: 'rgb(var(--on-surface-variant))' }}>لم يتم رفع وحدات أو محاضرات لهذا المقرر بعد.</p>
            ) : (
              units.map((unit, uIdx) => (
                <div key={unit.id} className="card flex-col" style={{ padding: '0px', overflow: 'hidden', backgroundColor: 'rgb(var(--surface-container-low))', border: '1px solid rgb(var(--outline) / 0.15)' }}>
                  {/* Unit Header */}
                  <div
                    style={{
                      backgroundColor: 'rgb(var(--surface-dim))',
                      padding: '16px 20px',
                      borderBottom: '1px solid rgb(var(--outline) / 0.1)',
                    }}
                    className="flex justify-between items-center"
                  >
                    <div>
                      <h4 style={{ fontSize: '14px', fontWeight: '800', color: 'rgb(var(--on-surface))' }}>الوحدة {uIdx + 1}: {unit.title}</h4>
                      {unit.description && <p style={{ fontSize: '11px', color: 'rgb(var(--on-surface-variant))', marginTop: '2px' }}>{unit.description}</p>}
                    </div>
                    <div className="flex items-center gap-sm">
                      <span className="badge badge-primary" style={{ backgroundColor: 'rgba(var(--primary), 0.1)', color: 'rgb(var(--primary))', border: '1px solid rgba(var(--primary), 0.2)' }}>{unit.lessons?.length || 0} محاضرات</span>
                    </div>
                  </div>

                  {/* Unit Lessons */}
                  <div className="flex flex-col">
                    {(!unit.lessons || unit.lessons.length === 0) ? (
                      <div style={{ padding: '16px 20px', fontSize: '12px', color: 'rgb(var(--on-surface-variant))', fontStyle: 'italic' }}>لا توجد محاضرات في هذه الوحدة بعد.</div>
                    ) : (
                      unit.lessons.map((lesson: any) => {
                        const isFreePreview = lesson.is_free_preview === 1 || lesson.is_free_preview === true;
                        const isFreeLesson = isFreePreview || course.is_free === 1 || course.is_free === true;
                        const canAccess = isEnrolled || isFreeLesson;
                        const isPdf = lesson.type === 'pdf';

                        return (
                          <div
                            key={lesson.id}
                            style={{
                              padding: '14px 20px',
                              borderBottom: '1px solid rgb(var(--outline) / 0.08)',
                              cursor: 'pointer',
                              opacity: canAccess ? 1 : 0.7,
                            }}
                            className="flex justify-between items-center hover-lesson-row"
                            onClick={() => {
                              if (canAccess) {
                                onSelectLesson(lesson.id, lesson.title, isPdf ? 'pdf' : 'video', isFreeLesson);
                              } else {
                                if (!isLoggedIn) {
                                  onSelectLesson(lesson.id, lesson.title, isPdf ? 'pdf' : 'video', isFreeLesson);
                                } else {
                                  setShowRedeemModal(true);
                                }
                              }
                            }}
                          >
                            <div className="flex items-center gap-md">
                              <div
                                style={{
                                  width: '32px',
                                  height: '32px',
                                  borderRadius: '50%',
                                  backgroundColor: canAccess ? 'rgba(var(--primary), 0.12)' : 'rgb(var(--surface-dim))',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                }}
                              >
                                <span className="icon" style={{ fontSize: '18px', color: canAccess ? 'rgb(var(--primary))' : 'inherit' }}>
                                  {isPdf ? 'picture_as_pdf' : 'play_circle'}
                                </span>
                              </div>
                              <div>
                                <span style={{ fontWeight: 'bold', fontSize: '13px', color: 'rgb(var(--on-surface))' }}>{lesson.title}</span>
                                {lesson.duration_seconds && (
                                  <span style={{ fontSize: '11px', color: 'rgb(var(--on-surface-variant))', marginRight: '8px' }}>
                                    ({Math.floor(lesson.duration_seconds / 60)} دقيقة)
                                  </span>
                                )}
                              </div>
                            </div>

                            <div className="flex items-center gap-sm">
                              {isFreePreview && !isEnrolled && (
                                <span className="badge badge-accent" style={{ fontSize: '11px' }}>عرض تجريبي مجاني</span>
                              )}
                              {!canAccess ? (
                                <span className="icon" style={{ fontSize: '18px', color: 'rgb(var(--on-surface-variant))' }}>lock</span>
                              ) : lesson.is_completed === 1 ? (
                                <span className="icon" style={{ fontSize: '18px', color: 'rgb(16 185 129)' }}>check_circle</span>
                              ) : (
                                <span className="icon" style={{ fontSize: '18px', color: 'rgb(var(--primary))' }}>play_arrow</span>
                              )}
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              ))
            )}
          </div>

        </div>

        {/* Left side: Sticky enrollment & cover card */}
        <div className="course-details-sidebar">
          <div className="card flex-col" style={{ padding: '16px', backgroundColor: 'rgb(var(--surface-container-low))', border: '1px solid rgb(var(--outline) / 0.15)' }} data-tour="tour-course-enroll">
            
            {/* Cover image container */}
            <div style={{ position: 'relative', height: '180px', overflow: 'hidden', borderRadius: '12px', marginBottom: '16px', background: 'rgb(var(--surface-dim))' }}>
              {course.cover_image || course.cover_url ? (
                <img src={optimizedCoverUrl(course.cover_image || course.cover_url, 400)} alt={course.title} loading="lazy" width={400} height={180} style={{ width: '100%', height: '100%', objectFit: 'cover', ...parseCoverPosition(course.cover_image || course.cover_url) }} />
              ) : (
                <div style={{ width: '100%', height: '100%', position: 'relative', overflow: 'hidden' }}>
                  <CourseCoverFallback />
                </div>
              )}
            </div>

            {/* Price & Activate Box */}
            <div className="flex-col gap-sm" style={{ marginBottom: '16px' }}>
              <span style={{ fontSize: '12px', color: 'rgb(var(--on-surface-variant))' }}>قيمة الاشتراك المطلوب لتفعيل هذا المقرر:</span>
              <div className="flex items-baseline gap-xs">
                <span style={{ fontSize: '28px', fontWeight: '800', color: 'rgb(var(--on-surface))' }}>{course.is_free ? 'مجاني' : `${course.reference_price || 0}`}</span>
                {!course.is_free && <span style={{ fontSize: '14px', color: 'rgb(var(--on-surface-variant))', fontWeight: 'bold' }}>ج.م فقط</span>}
              </div>
            </div>

            {/* Activate button */}
            {isEnrolled ? (
              <div style={{
                padding: '12px',
                borderRadius: '10px',
                backgroundColor: 'rgb(var(--success) / 0.1)',
                border: '1px solid rgb(var(--success) / 0.2)',
                color: 'rgb(var(--success))',
                textAlign: 'center',
                fontWeight: 'bold',
                fontSize: '13px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px'
              }}>
                <span className="icon">check_circle</span>
                المقرر مفعّل بالكامل في حسابك
              </div>
            ) : (
              <button
                className="btn btn-primary w-full"
                style={{
                  padding: '14px',
                  fontSize: '14px',
                  fontWeight: 'bold',
                  boxShadow: '0 4px 15px rgba(var(--primary), 0.4)'
                }}
                onClick={() => setShowRedeemModal(true)}
              >
                <span className="icon">vpn_key</span>
                تفعيل المقرر بكود
              </button>
            )}

            {/* Features list */}
            <div className="flex-col gap-sm" style={{ marginTop: '20px', borderTop: '1px solid rgb(var(--outline) / 0.1)', paddingTop: '16px' }}>
              <span style={{ fontSize: '11px', fontWeight: '800', color: 'rgb(var(--on-surface))', marginBottom: '4px' }}>يشتمل هذا المقرر الدراسي على:</span>
              
              <div className="flex items-center gap-sm" style={{ fontSize: '11px', color: 'rgb(var(--on-surface-variant))' }}>
                <span className="icon" style={{ fontSize: '14px', color: 'rgb(var(--primary))' }}>smart_display</span>
                <span>شرح فيديو عالي الدقة محمي بالكامل</span>
              </div>
              
              <div className="flex items-center gap-sm" style={{ fontSize: '11px', color: 'rgb(var(--on-surface-variant))' }}>
                <span className="icon" style={{ fontSize: '14px', color: 'rgb(var(--primary))' }}>picture_as_pdf</span>
                <span>ملخصات ومذكرات واختبارات PDF</span>
              </div>

              <div className="flex items-center gap-sm" style={{ fontSize: '11px', color: 'rgb(var(--on-surface-variant))' }}>
                <span className="icon" style={{ fontSize: '14px', color: 'rgb(var(--primary))' }}>forum</span>
                <span>منتدى أسئلة واستفسارات تفاعلي مع المعلم</span>
              </div>

              <div className="flex items-center gap-sm" style={{ fontSize: '11px', color: 'rgb(var(--on-surface-variant))' }}>
                <span className="icon" style={{ fontSize: '14px', color: 'rgb(var(--primary))' }}>devices</span>
                <span>صلاحية وصول آمنة من جهازك المعتمد</span>
              </div>
            </div>

          </div>
        </div>

      </div>

      {/* ── Redeem Code Modal ── */}
      {showRedeemModal && (
        <Modal
          ariaLabel="تفعيل مقرر بكود"
          onClose={() => {
            setShowRedeemModal(false);
            setRedeemCode('');
          }}
          contentStyle={{ padding: '24px' }}
        >
            <h3 className="title-small" style={{ marginBottom: '8px' }}>تفعيل مقرر بكود</h3>
            <p className="body-small" style={{ marginBottom: '20px' }}>
              أنت تقوم بتفعيل المقرر الدراسي: <strong>"{course.title}"</strong>. يرجى إدخال كود التفعيل المكون من 12 رمزاً:
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
              {redeemError && (
                <p style={{ fontSize: '11px', color: 'rgb(var(--error))', marginBottom: '16px', fontWeight: 'bold', textAlign: 'right' }}>{redeemError}</p>
              )}
              {redeemSuccess && (
                <p style={{ fontSize: '11px', color: 'rgb(var(--success))', marginBottom: '16px', fontWeight: 'bold', textAlign: 'right' }}>{redeemSuccess}</p>
              )}
              <div className="flex gap-md">
                <button type="submit" className="btn btn-primary flex-1" disabled={redeeming}>
                  {redeeming ? 'جاري التحقق والتفعيل...' : 'تأكيد التفعيل'}
                </button>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => {
                    setShowRedeemModal(false);
                    setRedeemCode('');
                  }}
                >
                  إلغاء
                </button>
              </div>
            </form>
        </Modal>
      )}
    </div>
  );
};

export default CourseDetails;

