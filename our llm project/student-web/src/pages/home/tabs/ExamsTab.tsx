import type { FC } from 'react';
import { SkeletonExamCard } from '../../../components/Skeleton';
import { GuidedTour, type TourStep } from '../../../components/GuidedTour';

const EXAMS_TOUR_STEPS: TourStep[] = [
  { selector: '[data-tour="tour-exams-results"]', title: 'حل الامتحانات', text: 'الشارة الصفراء تعني امتحان لم يُحل بعد، والخضراء/الحمراء توضح نتيجتك بعد التسليم. اضغط "بدء حل الامتحان" للدخول.' },
];

interface ExamsTabProps {
  loading: boolean;
  loadError?: boolean;
  exams: any[];
  loadData: () => Promise<void>;
  handleOpenExam: (examId: string) => void;
}

/** Exams tab: list of standalone exams the student can solve or review. */
export const ExamsTab: FC<ExamsTabProps> = ({ loading, loadError, exams, loadData, handleOpenExam }) => {
  return (
    <div className="flex flex-col gap-xl" style={{ direction: 'rtl' }}>
      <div className="flex justify-between items-start" style={{ width: '100%', borderBottom: '1px solid rgb(var(--outline-variant) / 0.1)', paddingBottom: '16px' }}>
        <div>
          <h2 className="title-medium" style={{ color: 'rgb(var(--on-background))', fontWeight: '800', marginBottom: '6px', margin: 0 }}>الامتحانات العامة والتقييمات 📝</h2>
          <p className="body-medium" style={{ color: 'rgb(var(--on-surface-variant))', fontSize: '13px', margin: 0 }}>
            هنا تجد كافة الامتحانات الشاملة والتقييمات الدورية المتاحة لمستواك الدراسي.
          </p>
        </div>
        <button
          onClick={() => loadData()}
          className="btn flex items-center gap-xs"
          style={{
            padding: '6px 12px',
            fontSize: '12px',
            backgroundColor: 'rgb(var(--surface-container-low))',
            border: '1px solid rgb(var(--outline-variant) / 0.15)',
            borderRadius: '8px',
            color: 'rgb(var(--on-surface))',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '6px'
          }}
          title="تحديث البيانات"
        >
          <span className="icon" style={{ fontSize: '16px' }}>refresh</span>
          تحديث
        </button>
      </div>

      <div data-tour="tour-exams-results">
      {loading && exams.length === 0 ? (
        <div className="grid-2 gap-lg">
          <SkeletonExamCard />
          <SkeletonExamCard />
          <SkeletonExamCard />
          <SkeletonExamCard />
        </div>
      ) : loadError && exams.length === 0 ? (
        <div className="card text-center" style={{ padding: '40px' }}>
          <span className="icon" style={{ fontSize: '42px', color: 'rgb(var(--error))', marginBottom: '12px' }}>wifi_off</span>
          <p className="body-medium" style={{ fontWeight: 'bold', marginBottom: '16px' }}>تعذر تحميل الامتحانات. تحقق من اتصالك بالإنترنت.</p>
          <button className="btn btn-primary" onClick={() => loadData()}>إعادة المحاولة</button>
        </div>
      ) : exams.length === 0 ? (
        <div className="card flex flex-col items-center justify-center text-center" style={{ padding: '40px 20px' }}>
          <span className="icon text-primary animate-pulse" style={{ fontSize: '42px', color: 'rgb(var(--primary))', marginBottom: '12px' }}>quiz</span>
          <h3 style={{ fontSize: '16px', fontWeight: '700', color: 'rgb(var(--on-surface))', marginBottom: '8px' }}>لا توجد امتحانات متاحة حالياً</h3>
          <p style={{ fontSize: '13px', color: 'rgb(var(--on-surface-variant))', maxWidth: '360px', margin: '0 auto' }}>
            بمجرد قيام المدرس برفع امتحانات عامة للمقررات المشترك بها، ستظهر لك هنا مباشرة للحل والتقييم.
          </p>
        </div>
      ) : (
        <div className="grid-2 gap-lg">
          {exams.map((exam: any) => {
            const hasAttempt = exam.student_score !== null && exam.student_score !== undefined;
            const scorePercentage = hasAttempt ? ((exam.student_score / exam.max_score) * 100).toFixed(0) : '0';
            const isPassed = hasAttempt && parseInt(scorePercentage) >= 50;

            return (
              <div
                key={exam.id}
                className="card flex flex-col justify-between"
                style={{
                  padding: '24px',
                  transition: 'all 0.3s ease',
                }}
              >
                <div>
                  <div className="flex justify-between items-start" style={{ marginBottom: '12px' }}>
                    <span className="badge" style={{ backgroundColor: 'rgba(var(--primary), 0.08)', color: 'rgb(var(--primary))', border: '1px solid rgba(var(--primary), 0.15)', fontSize: '11px', padding: '4px 10px', borderRadius: '6px' }}>
                      {exam.course_title}
                    </span>

                    {hasAttempt ? (
                      <span className="badge" style={{ backgroundColor: isPassed ? 'rgb(var(--success) / 0.1)' : 'rgb(var(--error) / 0.1)', color: isPassed ? 'rgb(var(--success))' : 'rgb(var(--error))', border: `1px solid ${isPassed ? 'rgb(var(--success) / 0.2)' : 'rgb(var(--error) / 0.2)'}`, fontSize: '11px', padding: '4px 10px', borderRadius: '6px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <span className="icon" style={{ fontSize: '14px' }}>{isPassed ? 'check_circle' : 'cancel'}</span>
                        تم الحل: {scorePercentage}%
                      </span>
                    ) : (
                      <span className="badge" style={{ backgroundColor: 'rgb(var(--warning) / 0.1)', color: 'rgb(var(--warning))', border: '1px solid rgb(var(--warning) / 0.2)', fontSize: '11px', padding: '4px 10px', borderRadius: '6px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <span className="status-dot answered" style={{ width: '6px', height: '6px', backgroundColor: 'rgb(var(--warning))', boxShadow: '0 0 8px rgb(var(--warning))', marginLeft: 0 }} />
                        مطلوب حله
                      </span>
                    )}
                  </div>

                  <h3 style={{ fontSize: '16px', fontWeight: '800', color: 'rgb(var(--on-surface))', marginBottom: '8px', lineHeight: '1.5' }}>
                    {exam.title}
                  </h3>
                  <p style={{ fontSize: '12px', color: 'rgb(var(--on-surface-variant))', marginBottom: '20px' }}>
                    الدرجة الكلية للامتحان: <strong style={{ color: 'rgb(var(--on-surface))' }}>{exam.max_score} درجة</strong>
                  </p>
                </div>

                <div style={{ borderTop: '1px solid rgb(var(--outline-variant) / 0.15)', paddingTop: '16px' }}>
                  {hasAttempt ? (
                    <div className="flex justify-between items-center">
                      <span style={{ fontSize: '12px', color: 'rgb(var(--on-surface-variant))' }}>
                        درجتك: <strong style={{ color: isPassed ? 'rgb(var(--success))' : 'rgb(var(--error))', fontSize: '14px' }}>{exam.student_score} / {exam.max_score}</strong>
                      </span>
                      <button
                        className="btn btn-secondary"
                        style={{ padding: '8px 16px', fontSize: '12px', borderRadius: '8px' }}
                        onClick={() => handleOpenExam(exam.id)}
                      >
                        عرض الإجابات
                      </button>
                    </div>
                  ) : (
                    <button
                      className="btn btn-primary w-full"
                      style={{ padding: '10px', fontSize: '13px', fontWeight: 'bold', borderRadius: '8px', boxShadow: '0 4px 12px rgba(var(--primary), 0.25)' }}
                      onClick={() => handleOpenExam(exam.id)}
                    >
                      بدء حل الامتحان الآن
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
      </div>

      <GuidedTour steps={EXAMS_TOUR_STEPS} storageKey="exams_tab_tour_seen_v1" active={!loading} />
    </div>
  );
};
