import type { FC } from 'react';
import { SkeletonCourseGrid } from '../../../components/Skeleton';
import type { ShowToastFn } from '../types';
import { GuidedTour, type TourStep } from '../../../components/GuidedTour';
import CourseCoverFallback from '../../../components/CourseCoverFallback';
import { optimizedCoverUrl, parseCoverPosition } from '../../../utils/img';

const EXPLORE_TOUR_STEPS: TourStep[] = [
  { selector: '[data-tour="tour-explore-search"]', title: 'البحث والتصفية', text: 'ابحث عن مقرر بالاسم، أو صفِّ النتائج حسب صفك الدراسي لعرض المقررات المناسبة لك فقط.' },
  { selector: '[data-tour="tour-explore-results"]', title: 'المقررات المتاحة', text: 'كل كارت يوضح السعر ومحتوى المقرر — اضغط للاطلاع على التفاصيل، أو زر "تفعيل" لإدخال كود الاشتراك مباشرة.' },
];

interface ExploreTabProps {
  loading: boolean;
  loadError: boolean;
  courses: any[];
  loadData: () => Promise<void>;
  searchQuery: string;
  setSearchQuery: (v: string) => void;
  gradeFilter: string;
  setGradeFilter: (v: string) => void;
  academicYears: string[];
  enrolledIds: Set<string>;
  onSelectCourse: (courseId: string) => void;
  profile: any | null;
  onShowAuth?: () => void;
  showToast: ShowToastFn;
  setSelectedCourseForRedeem: (course: any | null) => void;
  setShowRedeemModal: (v: boolean) => void;
}

/** Explore tab: search + grade filter over the full public course catalogue. */
export const ExploreTab: FC<ExploreTabProps> = ({
  loading,
  loadError,
  courses,
  loadData,
  searchQuery,
  setSearchQuery,
  gradeFilter,
  setGradeFilter,
  academicYears,
  enrolledIds,
  onSelectCourse,
  profile,
  onShowAuth,
  showToast,
  setSelectedCourseForRedeem,
  setShowRedeemModal,
}) => {
  const filteredExploreCourses = courses.filter(c =>
    c.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="flex flex-col gap-lg">
      <div className="flex justify-between items-center" style={{ width: '100%' }}>
        <h2 className="title-medium" style={{ margin: 0 }}>استكشف جميع المقررات</h2>
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

      {/* Search and Filters */}
      <div className="flex gap-md" style={{ flexWrap: 'wrap' }} data-tour="tour-explore-search">
        <div className="input-container" style={{ flex: 1, minWidth: '250px' }}>
          <input
            type="text"
            className="input-text"
            placeholder="ابحث عن مقرر دراسي..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
          />
          <span className="icon input-icon-right">search</span>
        </div>
        <select
          className="select"
          style={{ width: '220px' }}
          value={gradeFilter}
          onChange={e => setGradeFilter(e.target.value)}
        >
          <option value="">جميع الصفوف الدراسية</option>
          {academicYears.map(g => (
            <option key={g} value={g}>{g}</option>
          ))}
        </select>
      </div>

      {/* Courses grid */}
      <div data-tour="tour-explore-results">
      {loading && courses.length === 0 ? (
        <SkeletonCourseGrid count={6} />
      ) : loadError && filteredExploreCourses.length === 0 ? (
        <div className="card text-center" style={{ padding: '40px' }}>
          <span className="icon" style={{ fontSize: '42px', color: 'rgb(var(--error))', marginBottom: '12px' }}>wifi_off</span>
          <p className="body-medium" style={{ fontWeight: 'bold', marginBottom: '16px' }}>تعذر تحميل المقررات. تحقق من اتصالك بالإنترنت.</p>
          <button className="btn btn-primary" onClick={() => loadData()}>إعادة المحاولة</button>
        </div>
      ) : filteredExploreCourses.length === 0 ? (
        <p className="body-medium text-center" style={{ padding: '40px' }}>لا توجد مقررات تطابق معايير البحث.</p>
      ) : (
        <div className="grid-3 gap-md">
          {filteredExploreCourses.map(course => {
            const isEnrolled = enrolledIds.has(course.id);
            return (
              <div
                key={course.id}
                className="premium-course-card flex flex-col justify-between"
                onClick={() => onSelectCourse(course.id)}
              >
                <div>
                  <div style={{ position: 'relative', height: '160px', overflow: 'hidden', borderRadius: '10px', marginBottom: '12px', background: 'rgb(var(--surface-dim))' }}>
                    {/* Price Badge */}
                    <div style={{
                      position: 'absolute',
                      top: '10px',
                      right: '10px',
                      backgroundColor: course.is_free ? 'rgba(16, 185, 129, 0.9)' : 'rgba(var(--primary), 0.9)',
                      color: '#fff',
                      padding: '4px 10px',
                      borderRadius: '20px',
                      fontSize: '11px',
                      fontWeight: 'bold',
                      zIndex: 3,
                      boxShadow: '0 2px 8px rgba(0,0,0,0.3)'
                    }}>
                      {course.is_free ? 'مجاني' : `${course.reference_price || 0} ج.م`}
                    </div>
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
                  <p className="body-small" style={{ marginBottom: '12px', color: 'rgb(var(--on-surface-variant))' }}>{course.description || 'شرح شامل للمقرر الدراسي'}</p>
                </div>

                <div className="flex items-center justify-between" style={{ borderTop: '1px solid rgb(var(--outline) / 0.1)', paddingTop: '10px', marginTop: '6px' }}>
                  {isEnrolled ? (
                    <button
                      className="btn btn-secondary"
                      onClick={(e) => { e.stopPropagation(); onSelectCourse(course.id); }}
                      style={{
                        padding: '8px 16px',
                        borderRadius: '8px',
                        fontSize: '12px',
                        fontWeight: 'bold',
                      }}
                    >
                      مفتوح (ابدأ الدراسة)
                    </button>
                  ) : (
                    <button
                      className="btn"
                      style={{
                        backgroundColor: 'rgb(var(--primary))',
                        color: '#fff',
                        border: 'none',
                        padding: '8px 16px',
                        borderRadius: '8px',
                        fontSize: '12px',
                        fontWeight: 'bold',
                        boxShadow: '0 4px 10px rgba(var(--primary), 0.3)'
                      }}
                      onClick={(e) => {
                        e.stopPropagation();
                        if (!profile) {
                          showToast('warning', 'تنبيه', 'هذا المحتوى يتطلب تسجيل الدخول والاشتراك.');
                          onShowAuth?.();
                          return;
                        }
                        setSelectedCourseForRedeem(course);
                        setShowRedeemModal(true);
                      }}
                    >
                      <span className="icon" style={{ fontSize: '14px', marginLeft: '4px' }}>vpn_key</span>
                      تفعيل
                    </button>
                  )}
                  <span style={{ fontSize: '12px', fontWeight: 'bold', color: 'rgb(var(--on-surface-variant))' }}>{course.lessons_count || 0} محاضرة</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
      </div>

      <GuidedTour steps={EXPLORE_TOUR_STEPS} storageKey="explore_tab_tour_seen_v1" active={!loading} />
    </div>
  );
};
