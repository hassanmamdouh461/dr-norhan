import type { FC } from 'react';
import { SkeletonCourseGrid } from '../../../components/Skeleton';
import { GuidedTour, type TourStep } from '../../../components/GuidedTour';
import CourseCoverFallback from '../../../components/CourseCoverFallback';
import { optimizedCoverUrl, parseCoverPosition } from '../../../utils/img';

const MY_COURSES_TOUR_STEPS: TourStep[] = [
  { selector: '[data-tour="tour-mycourses-results"]', title: 'مقرراتك المفعّلة', text: 'نسبة الإنجاز تُحسب من عدد الدروس التي أنهيتها فعليًا. اضغط على أي مقرر لمتابعة الدراسة من حيث توقفت.' },
];

interface MyCoursesTabProps {
  loading: boolean;
  loadError?: boolean;
  myCourses: any[];
  loadData: () => Promise<void>;
  onSelectCourse: (courseId: string) => void;
  setShowRedeemModal: (v: boolean) => void;
}

/** My Courses tab: the student's activated courses with real watch progress. */
export const MyCoursesTab: FC<MyCoursesTabProps> = ({
  loading,
  loadError,
  myCourses,
  loadData,
  onSelectCourse,
  setShowRedeemModal,
}) => {
  return (
    <div className="flex flex-col gap-lg">
      <div className="flex justify-between items-center" style={{ width: '100%' }}>
        <h2 className="title-medium" style={{ margin: 0 }}>الكورسات المشترك بها</h2>
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

      <div data-tour="tour-mycourses-results">
      {loading && myCourses.length === 0 ? (
        <SkeletonCourseGrid count={3} />
      ) : loadError && myCourses.length === 0 ? (
        <div className="card text-center" style={{ padding: '40px' }}>
          <span className="icon" style={{ fontSize: '42px', color: 'rgb(var(--error))', marginBottom: '12px' }}>wifi_off</span>
          <p className="body-medium" style={{ fontWeight: 'bold', marginBottom: '16px' }}>تعذر تحميل مقرراتك. تحقق من اتصالك بالإنترنت.</p>
          <button className="btn btn-primary" onClick={() => loadData()}>إعادة المحاولة</button>
        </div>
      ) : myCourses.length === 0 ? (
        <div className="card text-center" style={{ padding: '60px' }}>
          <span className="icon" style={{ fontSize: '56px', color: 'rgb(var(--on-surface-variant))', marginBottom: '16px' }}>school</span>
          <p className="body-large" style={{ fontWeight: 'bold' }}>لم تشترك في أي مقرر بعد.</p>
          <p className="body-small" style={{ marginBottom: '24px' }}>قم بتفعيل مقرر دراسي باستخدام الكود لتتمكن من البدء.</p>
          <button className="btn btn-primary" onClick={() => setShowRedeemModal(true)}>تفعيل كود</button>
        </div>
      ) : (
        <div className="grid-3 gap-md">
          {myCourses.map(course => {
            // Real progress: server-side count of lessons the student actually
            // completed (lesson_progress.is_completed), not the index of the
            // last-opened lesson — jumping ahead no longer inflates the percentage.
            const totalLessons = course.total_lessons ?? course.lessons_count ?? 0;
            const completedLessons = course.completed_lessons ?? 0;
            const progressPercent = totalLessons > 0 ? Math.round((completedLessons / totalLessons) * 100) : null;
            return (
            <div
              key={course.id}
              className="premium-course-card flex flex-col justify-between"
              onClick={() => onSelectCourse(course.id)}
            >
              <div>
                <div style={{ position: 'relative', height: '160px', overflow: 'hidden', borderRadius: '10px', marginBottom: '12px', background: 'rgb(var(--surface-dim))' }}>
                  {course.cover_image || course.cover_url ? (
                    <img src={optimizedCoverUrl(course.cover_image || course.cover_url, 400)} alt={course.title} loading="lazy" width={400} height={160} style={{ width: '100%', height: '100%', objectFit: 'cover', ...parseCoverPosition(course.cover_image || course.cover_url) }} />
                  ) : (
                    <div style={{ width: '100%', height: '100%', position: 'relative', overflow: 'hidden' }}>
                      <CourseCoverFallback />
                    </div>
                  )}
                  <div className="play-overlay-container">
                    <div className="play-button-pill">
                      <span className="icon" style={{ color: '#fff', fontSize: '24px', marginRight: '-2px' }}>play_arrow</span>
                    </div>
                  </div>
                </div>
                <h4 className="body-large" style={{ fontWeight: '800', color: 'rgb(var(--on-surface))', marginBottom: '6px', fontSize: '15px' }}>{course.title}</h4>
                <p className="body-small" style={{ marginBottom: '12px', color: 'rgb(var(--on-surface-variant))' }}>{course.description || 'كورس شرح وتدريبات المنهج بالكامل'}</p>
              </div>

              <div style={{ marginTop: '12px', borderTop: '1px solid rgb(var(--outline) / 0.1)', paddingTop: '10px' }}>
                <div className="flex justify-between" style={{ fontSize: '11px', marginBottom: '6px', fontWeight: 'bold' }}>
                  <span>نسبة الإنجاز</span>
                  <span style={{ color: 'rgb(var(--success))' }}>
                    {progressPercent === null ? 'مفعّل للدراسة' : `${progressPercent}%`}
                  </span>
                </div>
                <div style={{ height: '6px', backgroundColor: 'rgb(var(--surface-dim))', borderRadius: '3px', overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${progressPercent ?? 0}%`, backgroundColor: 'rgb(var(--primary))', transition: 'width 0.4s ease' }}></div>
                </div>
              </div>
            </div>
            );
          })}
        </div>
      )}
      </div>

      <GuidedTour steps={MY_COURSES_TOUR_STEPS} storageKey="mycourses_tab_tour_seen_v1" active={!loading} />
    </div>
  );
};
