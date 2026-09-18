import { useEffect, useState } from 'react';
import type { FC } from 'react';
import { SkeletonCourseGrid } from '../../../components/Skeleton';
import teacherPortraitLight from '../../../assets/teacher_dashboard.webp';
import teacherPortraitDark from '../../../assets/teacher_dashboard_dark.webp';
import teacherPortraitMobile from '../../../assets/teacher_dashboard_mobile.webp';
import CourseCoverFallback from '../../../components/CourseCoverFallback';
import { optimizedCoverUrl, parseCoverPosition } from '../../../utils/img';
import { useTheme } from '../../../context/ThemeContext';
import type { ShowToastFn, TabId } from '../types';

interface HomeTabProps {
  loading: boolean;
  loadError: boolean;
  courses: any[];
  exams: any[];
  loadData: () => Promise<void>;
  profile: any | null;
  enrolledIds: Set<string>;
  trackedCourses: any[];
  enrolledCoursesDetails: any[];
  playbackLogs: any[];
  onSelectCourse: (courseId: string) => void;
  onSelectLesson?: (lessonId: string, title: string, type: 'video' | 'pdf', isFree?: boolean, courseId?: string) => void;
  onShowAuth?: () => void;
  showToast: ShowToastFn;
  setSelectedCourseForRedeem: (course: any | null) => void;
  setShowRedeemModal: (v: boolean) => void;
  handleTabClick: (tab: TabId) => void;
}

const hooks = [
  'تبسطلك الكيمياء 📖',
  'تضمنلك الدرجة النهائية 🏆',
  'تتابع مستواك خطوة بخطوة 📈',
  'تأمّن طريقك للنجاح 🚀'
];

const platformNotes = [
  {
    id: 0,
    type: 'yellow',
    icon: 'menu_book',
    title: 'محاضرات تفاعلية',
    desc: 'شرح لغوي شامل ومبسط يربط المفاهيم.',
  },
  {
    id: 1,
    type: 'green',
    icon: 'quiz',
    title: 'امتحانات فورية',
    desc: 'اختبارات قياس مستوى بعد كل محاضرة.',
  },
  {
    id: 2,
    type: 'cyan',
    icon: 'forum',
    title: 'تواصل مباشر',
    desc: 'طرح الأسئلة وتلقي إجابات سريعة ومباشرة.',
  },
  {
    id: 3,
    type: 'purple',
    icon: 'schema',
    title: 'خرائط ذهنية',
    desc: 'كتيبات ملخصة بصرياً لسرعة التذكر والمراجعة.',
  },
  {
    id: 4,
    type: 'rose',
    icon: 'analytics',
    title: 'متابعة مستمرة',
    desc: 'تقارير دورية لولي الأمر لمتابعة الدرجات.',
  },
];

/** Home tab: hero banner, courses ribbon, "continue your journey" sidebar, platform features. */
export const HomeTab: FC<HomeTabProps> = ({
  loading,
  loadError,
  courses,
  exams,
  loadData,
  profile,
  enrolledIds,
  enrolledCoursesDetails,
  playbackLogs,
  onSelectCourse,
  onSelectLesson,
  onShowAuth,
  showToast,
  setSelectedCourseForRedeem,
  setShowRedeemModal,
  handleTabClick,
}) => {
  // Respect users who prefer reduced motion (rotating texts/images are disabled)
  const prefersReducedMotion = typeof window !== 'undefined'
    && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const [currentHookIdx, setCurrentHookIdx] = useState(0);
  const [hookFade, setHookFade] = useState(true);
  const { theme } = useTheme();

  // Track viewport width to swap the mobile-specific portrait asset
  const [isMobile, setIsMobile] = useState(() =>
    typeof window !== 'undefined' ? window.matchMedia('(max-width: 1024px)').matches : false
  );

  useEffect(() => {
    const mql = window.matchMedia('(max-width: 1024px)');
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mql.addEventListener('change', handler);
    return () => mql.removeEventListener('change', handler);
  }, []);



  const handleScrollToCourses = () => {
    const coursesSection = document.querySelector('.title-small');
    if (coursesSection) {
      coursesSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  useEffect(() => {
    if (prefersReducedMotion) return;
    const timer = setInterval(() => {
      setHookFade(false);
      setTimeout(() => {
        setCurrentHookIdx((prev) => (prev + 1) % hooks.length);
        setHookFade(true);
      }, 300);
    }, 4000);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Poses effect removed since we are showing a static centered image

  // ── Continue What's Left (Resume Card) Logic ──
  const resumeCardData = (() => {
    if (!profile || !playbackLogs || playbackLogs.length === 0 || !enrolledCoursesDetails || enrolledCoursesDetails.length === 0) {
      return null;
    }

    // 1. Sort logs to find the most recently watched lesson
    const sortedLogs = [...playbackLogs].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    const latestLog = sortedLogs[0];
    if (!latestLog) return null;

    // 2. Find the course of this lesson
    let activeCourse = enrolledCoursesDetails.find(d => d.id === latestLog.course_id);
    if (!activeCourse) {
      // Fallback: search for the lesson in all enrolled courses
      activeCourse = enrolledCoursesDetails.find(d => 
        (d.lessons || []).some((l: any) => l.id === latestLog.lesson_id)
      );
    }
    if (!activeCourse) return null;

    const lessons = activeCourse.lessons || [];
    const lastIndex = lessons.findIndex((l: any) => l.id === latestLog.lesson_id);
    if (lastIndex === -1) return null;

    const lastWatchedLesson = lessons[lastIndex];

    // 3. Check if completed or remaining time < 10 mins (600 seconds)
    const isCompleted = lastWatchedLesson.is_completed === 1 || 
      (lastWatchedLesson.duration_seconds > 0 && 
       (lastWatchedLesson.duration_seconds - lastWatchedLesson.last_position) < 600);

    let targetLesson = lastWatchedLesson;
    let isNext = false;

    if (isCompleted && lastIndex + 1 < lessons.length) {
      targetLesson = lessons[lastIndex + 1];
      isNext = true;
    }

    // Calculate lecture completion percentage
    const duration = targetLesson.duration_seconds || 0;
    const position = targetLesson.last_position || 0;
    const progressPercent = duration > 0 ? Math.min(100, Math.max(0, Math.round((position / duration) * 100))) : (targetLesson.is_completed ? 100 : 0);

    const remainingSeconds = Math.max(0, duration - position);
    const remainingMinutes = Math.ceil(remainingSeconds / 60);

    return {
      course: activeCourse,
      lesson: targetLesson,
      isNext,
      progressPercent,
      remainingMinutes,
      isCompleted: targetLesson.is_completed === 1
    };
  })();

  // Extract latest added items (courses and exams) — currently unused in the UI,
  // kept verbatim from the original implementation.
  const latestUpdates: any[] = [];
  if (courses && courses.length > 0) {
    courses.slice(0, 2).forEach(c => {
      latestUpdates.push({
        id: c.id,
        title: c.title,
        type: 'course',
        badge: 'مقرر جديد'
      });
    });
  }
  if (exams && exams.length > 0) {
    exams.slice(0, 2).forEach(e => {
      latestUpdates.push({
        id: e.id,
        title: e.title,
        type: 'exam',
        badge: 'امتحان شامل'
      });
    });
  }

  return (
    <div className="flex flex-col gap-xl">
      <div className="animate-fade-in-up hero-premium-card">
        {/* Single responsive hero tree: shared content (badge, heading, rotating
            hook, lead, CTAs) renders once; the pegboard and portrait-glow are
            purely decorative and hidden on mobile via CSS (see index.css). */}
        <div className="hero-layout">
          {/* Spacer to prevent pegboard overlap with the absolute positioned teacher portrait (desktop only) */}
          <div className="hero-spacer" aria-hidden="true" />

          {/* Centered Pegboard Column — decorative, desktop only (Renders in the middle because of RTL) */}
          <div className="hero-pegboard-column" aria-hidden="true">
            <div className="hero-wooden-pegboard">
              {/* Hanging ropes tying the board to the top of the hero */}
              <div className="pegboard-hanger">
                <span className="pegboard-rope" />
                <span className="pegboard-rope" />
              </div>
              <h3 className="pegboard-board-title">منصة الهضبة</h3>
              <div className="pegboard-notes-container">
                {/* Note 1: Yellow */}
                <div className="pegboard-note-card pegboard-note-yellow pegboard-note-1">
                  <div className="pegboard-peg" />
                  <h4>منهج كامل وشرح وافي</h4>
                  <p>شرح تفصيلي ومبسط يعتمد على بناء المفاهيم الكيميائية خطوة بخطوة.</p>
                </div>
                {/* Note 2: Green */}
                <div className="pegboard-note-card pegboard-note-green pegboard-note-2">
                  <div className="pegboard-peg" />
                  <h4>تدريبات وامتحانات دورية</h4>
                  <p>امتحانات وتدريبات عقب كل محاضرة لقياس استيعابك.</p>
                </div>
                {/* Note 3: Purple */}
                <div className="pegboard-note-card pegboard-note-purple pegboard-note-3">
                  <div className="pegboard-peg" />
                  <h4>ملخصات وخرائط ذهنية</h4>
                  <p>كتيبات ملخصة وخرائط لتسهيل الفهم والاستذكار السريع.</p>
                </div>
                {/* Note 4: Rose */}
                <div className="pegboard-note-card pegboard-note-rose pegboard-note-4">
                  <div className="pegboard-peg" />
                  <h4>متابعة أولياء الأمور</h4>
                  <p>تقارير دورية لمستويات الطالب وتفاصيل درجاته وتقدمه.</p>
                </div>
              </div>
            </div>
          </div>

          {/* Shared hero content: badge, heading, rotating hook, lead copy, CTAs */}
          <div className="hero-left-container">
            <span className="hero-badge hero-reveal" style={{ animationDelay: '0.05s' }}>
              <span className="material-symbols-outlined animate-pulse hero-badge-icon">workspace_premium</span>
              منصة كيميا التعليمية الرسمية من الهضبة
            </span>

            <div className="hero-reveal" style={{ animationDelay: '0.15s' }}>
              <h1 className="hero-main-title hero-title-shadow">
                منصتك الأولى لتعلم وفهم <span className="hero-title-em" style={{ textShadow: 'none' }}>الكيمياء</span>
              </h1>
              <div className="hero-hook-wrap">
                <h2
                  className="hero-sub-title hero-hook-text"
                  style={{
                    opacity: hookFade ? 1 : 0,
                    transform: hookFade ? 'translateY(0)' : 'translateY(-10px)',
                  }}
                >
                  {hooks[currentHookIdx]}
                </h2>
              </div>
              <div className="manuscript-divider" aria-hidden="true" />
            </div>

            <p className="hero-lead hero-reveal" style={{ color: 'var(--hero-text-secondary)', margin: '20px 0 0 0', maxWidth: '560px', animationDelay: '0.25s' }}>
              رحلتك نحو <strong className="hero-lead-strong">الدرجة النهائية في الكيمياء</strong> تبدأ من هنا! نقدم لك تجربة تعليمية استثنائية تجمع بين الفهم المبسط والمشاهدة الذكية لتضمن تفوقك الدراسي.
            </p>

            {/* Action buttons: DOM order matches the desktop look (outline button on the
                right, primary on the left); the mobile media query flips this visually
                via `order` so mobile shows the primary CTA on the right instead. */}
            <div className="hero-buttons-horizontal-row hero-reveal" style={{ animationDelay: '0.35s' }}>
              <button
                onClick={() => setShowRedeemModal(true)}
                className="btn btn-secondary hero-cta hero-cta-secondary"
              >
                تفعيل كود مقرر
              </button>
              <button
                onClick={() => handleTabClick('explore')}
                className="btn btn-primary hero-cta hero-cta-primary"
              >
                ابدأ التعلم الآن
              </button>
            </div>
          </div>

          {/* Teacher portrait column — sizing/position adapt responsively via CSS;
              the glow/orb behind it is decorative and mobile-only. */}
          <div className="hero-portrait-column">
            <div className="hero-portrait-glow" aria-hidden="true" />
            <div className="hero-portrait-orb" aria-hidden="true">
              <div className="hero-portrait-orb-reflection" />
            </div>

            <img
              src={isMobile ? teacherPortraitMobile : (theme === 'dark' ? teacherPortraitDark : teacherPortraitLight)}
              alt="كيميا"
              className={`portrait-teacher-img pose-active dashboard-portrait-pointing${!isMobile ? (theme === 'dark' ? ' portrait-dark' : ' portrait-light') : ''}`}
              loading="eager"
              fetchPriority="high"
            />
          </div>
        </div>

        {/* SCROLL DOWN INDICATOR BUTTON (desktop layout only) */}
        <button className="hero-scroll-down-btn" onClick={handleScrollToCourses} title="انتقل للمحاضرات">
          <span className="material-symbols-outlined">keyboard_double_arrow_down</span>
        </button>
      </div>

      {/* Main Content Layout: Courses Ribbon */}
      <div style={{ width: '100%', direction: 'rtl', marginTop: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <div>
          <h3 className="title-small" style={{ marginBottom: '2px', fontWeight: '800' }}>المقررات الدراسية المتاحة</h3>
          <div className="manuscript-divider" style={{ width: '90px', marginTop: '4px' }} aria-hidden="true" />
        </div>

        {loading && courses.length === 0 ? (
          <SkeletonCourseGrid count={3} />
        ) : loadError && courses.length === 0 ? (
          <div className="text-center" style={{ padding: '40px', background: 'rgb(var(--surface-container-low))', borderRadius: '16px', border: '1px solid rgb(var(--outline-variant) / 0.15)' }}>
            <span className="icon" style={{ fontSize: '42px', color: 'rgb(var(--error))', marginBottom: '12px', display: 'block' }}>wifi_off</span>
            <p className="body-medium" style={{ fontWeight: 'bold', marginBottom: '16px' }}>تعذر تحميل المقررات. تحقق من اتصالك بالإنترنت.</p>
            <button className="btn btn-primary" onClick={() => loadData()}>إعادة المحاولة</button>
          </div>
        ) : courses.length === 0 ? (
          <p className="body-medium text-center" style={{ padding: '40px', background: 'rgb(var(--surface-container-low))', borderRadius: '16px', border: '1px solid rgb(var(--outline-variant) / 0.15)' }}>
            لا توجد مقررات دراسية متاحة حالياً.
          </p>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(270px, 1fr))', gap: '20px' }}>
            
            {/* Resume Card (Continue What's Left) - Rendered as first item in the grid */}
            {resumeCardData && (
              <div
                className="premium-course-card flex flex-col justify-between"
                onClick={() => {
                  if (onSelectLesson) {
                    const l = resumeCardData.lesson;
                    onSelectLesson(l.id, l.title, l.type, l.is_free, resumeCardData.course.id);
                  }
                }}
                style={{
                  borderRadius: '16px',
                  padding: '16px',
                  transition: 'transform 0.2s, box-shadow 0.2s',
                  cursor: 'pointer',
                  border: '1px solid rgba(var(--primary), 0.3)',
                  boxShadow: '0 4px 20px rgba(var(--primary), 0.1)',
                  position: 'relative'
                }}
              >
                <div>
                  <div style={{ position: 'relative', height: '160px', overflow: 'hidden', borderRadius: '12px', marginBottom: '14px', background: 'rgb(var(--surface-dim))' }}>
                    {/* Special Continue Tag */}
                    <div style={{
                      position: 'absolute',
                      top: '10px',
                      right: '10px',
                      backgroundColor: 'rgb(var(--primary))',
                      color: '#fff',
                      padding: '4px 12px',
                      borderRadius: '20px',
                      fontSize: '11px',
                      fontWeight: 'bold',
                      zIndex: 3,
                      boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px'
                    }}>
                      <span className="material-symbols-outlined" style={{ fontSize: '12px' }}>ads_click</span>
                      <span>كمل اللي باقي لك</span>
                    </div>
                    {resumeCardData.course.cover_image || resumeCardData.course.cover_url ? (
                       <img src={optimizedCoverUrl(resumeCardData.course.cover_image || resumeCardData.course.cover_url, 400)} alt={resumeCardData.course.title} loading="lazy" width={400} height={160} style={{ width: '100%', height: '100%', objectFit: 'cover', ...parseCoverPosition(resumeCardData.course.cover_image || resumeCardData.course.cover_url) }} />
                    ) : (
                      <div style={{ width: '100%', height: '100%', position: 'relative', overflow: 'hidden' }}>
                        <CourseCoverFallback />
                      </div>
                    )}
                  </div>
                  <span style={{ fontSize: '11px', fontWeight: 'bold', color: 'rgb(var(--primary))', display: 'block', marginBottom: '4px' }}>
                    مقرر: {resumeCardData.course.title}
                  </span>
                  <h4 className="body-large" style={{ fontWeight: '800', color: 'rgb(var(--on-surface))', marginBottom: '8px', fontSize: '15px' }}>
                    {resumeCardData.isNext ? 'المحاضرة التالية: ' : 'آخر محاضرة: '} {resumeCardData.lesson.title}
                  </h4>
                  
                  {/* Progress bar */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginBottom: '12px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'rgb(var(--on-surface-variant))', fontWeight: 'bold' }}>
                      <span>نسبة إكمال المحاضرة</span>
                      <span>{resumeCardData.progressPercent}%</span>
                    </div>
                    <div style={{ width: '100%', height: '6px', backgroundColor: 'rgba(var(--on-surface), 0.08)', borderRadius: '999px', overflow: 'hidden' }}>
                      <div style={{ width: `${resumeCardData.progressPercent}%`, height: '100%', backgroundColor: 'rgb(var(--primary))', borderRadius: '999px', transition: 'width 0.3s ease' }} />
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between" style={{ borderTop: '1px solid rgb(var(--outline) / 0.1)', paddingTop: '12px', marginTop: '8px' }}>
                  <button
                    className="btn btn-primary"
                    style={{
                      padding: '8px 20px',
                      borderRadius: '8px',
                      fontSize: '11px',
                      fontWeight: 'bold',
                      backgroundColor: 'rgb(var(--primary))',
                      color: '#fff',
                      border: 'none',
                      boxShadow: '0 4px 10px rgba(16, 185, 129, 0.3)',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px'
                    }}
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>play_arrow</span>
                    <span>{resumeCardData.isNext ? 'ابدأ الآن' : 'استئناف المشاهدة'}</span>
                  </button>
                  
                  {resumeCardData.lesson.type === 'video' && resumeCardData.remainingMinutes > 0 && !resumeCardData.isNext && (
                    <span style={{ fontSize: '10px', color: 'rgb(var(--on-surface-variant))', fontWeight: 'bold' }}>
                      متبقي {resumeCardData.remainingMinutes} دقيقة
                    </span>
                  )}
                </div>
              </div>
            )}

            {courses.map(course => {
              const isEnrolled = enrolledIds.has(course.id);
              return (
                <div
                  key={course.id}
                  className="premium-course-card flex flex-col justify-between"
                  onClick={() => onSelectCourse(course.id)}
                  style={{
                    borderRadius: '16px',
                    padding: '16px',
                    transition: 'transform 0.2s, box-shadow 0.2s',
                    cursor: 'pointer'
                  }}
                >
                  <div>
                    <div style={{ position: 'relative', height: '160px', overflow: 'hidden', borderRadius: '12px', marginBottom: '14px', background: 'rgb(var(--surface-dim))' }}>
                      {/* Price / Enrolled Badge */}
                      <div style={{
                        position: 'absolute',
                        top: '10px',
                        right: '10px',
                        backgroundColor: isEnrolled ? 'rgb(var(--primary))' : (course.is_free ? 'rgb(var(--primary))' : 'rgba(20, 20, 22, 0.85)'),
                        color: '#fff',
                        padding: '4px 12px',
                        borderRadius: '20px',
                        fontSize: '11px',
                        fontWeight: 'bold',
                        zIndex: 3,
                        boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
                        border: !isEnrolled && !course.is_free ? '1px solid rgba(255,255,255,0.12)' : 'none'
                      }}>
                        {isEnrolled ? 'معي' : (course.is_free ? 'مجاني' : `${course.reference_price || 0} ج.م`)}
                      </div>
                      {course.cover_image || course.cover_url ? (
                         <img src={optimizedCoverUrl(course.cover_image || course.cover_url, 400)} alt={course.title} loading="lazy" width={400} height={160} style={{ width: '100%', height: '100%', objectFit: 'cover', ...parseCoverPosition(course.cover_image || course.cover_url) }} />
                      ) : (
                        <div style={{ width: '100%', height: '100%', position: 'relative', overflow: 'hidden' }}>
                          <CourseCoverFallback />
                        </div>
                      )}
                    </div>
                    <h4 className="body-large" style={{ fontWeight: '800', color: 'rgb(var(--on-surface))', marginBottom: '6px', fontSize: '15px' }}>{course.title}</h4>
                    <p className="body-small" style={{ marginBottom: '12px', color: 'rgb(var(--on-surface-variant))', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', textOverflow: 'ellipsis', height: '34px', lineHeight: '1.4' }}>{course.description || 'شرح شامل للمقرر الدراسي بكل تفاصيله'}</p>
                  </div>

                  <div className="flex items-center justify-between" style={{ borderTop: '1px solid rgb(var(--outline) / 0.1)', paddingTop: '12px', marginTop: '8px' }}>
                    {isEnrolled ? (
                      <button
                        className="btn btn-primary"
                        onClick={(e) => { e.stopPropagation(); onSelectCourse(course.id); }}
                        style={{
                          padding: '8px 20px',
                          borderRadius: '8px',
                          fontSize: '11px',
                          fontWeight: 'bold',
                          backgroundColor: 'rgb(var(--primary))',
                          color: '#fff',
                          border: 'none',
                          boxShadow: '0 4px 10px rgba(16, 185, 129, 0.3)',
                          cursor: 'pointer'
                        }}
                      >
                        ابدأ الدراسة
                      </button>
                    ) : (
                      <button
                        className="btn"
                        style={{
                          backgroundColor: 'rgb(var(--surface-container-high))',
                          color: 'rgb(var(--on-surface))',
                          border: '1px solid rgb(var(--outline-variant) / 0.25)',
                          padding: '8px 20px',
                          borderRadius: '8px',
                          fontSize: '11px',
                          fontWeight: 'bold',
                          cursor: 'pointer',
                          transition: 'all 0.2s ease'
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.backgroundColor = 'rgba(16, 185, 129, 0.08)';
                          e.currentTarget.style.borderColor = 'rgb(var(--primary))';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.backgroundColor = 'rgb(var(--surface-container-high))';
                          e.currentTarget.style.borderColor = 'rgb(var(--outline-variant) / 0.25)';
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
                        <span className="icon" style={{ fontSize: '13px', marginLeft: '4px' }}>vpn_key</span>
                        تفعيل مقرر
                      </button>
                    )}
                    <span style={{ fontSize: '11px', fontWeight: 'bold', color: 'rgb(var(--on-surface-variant))' }}>{course.lessons_count || 0} محاضرة</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Section 2: Platform Features (Sticky Notes Taped to Background) ── */}
      <div className="mobile-only-features" style={{ marginTop: '48px', marginBottom: '24px', width: '100%' }}>
        <h3 className="title-small" style={{ marginBottom: '16px', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span className="material-symbols-outlined" style={{ color: 'rgb(var(--primary))', fontSize: '20px' }}>widgets</span>
          مميزات المنصة التعليمية
        </h3>

        <div className="taped-notes-container">
          {platformNotes.map((note, index) => (
            <div
              key={note.id}
              className={`taped-note-card taped-note-${note.type} taped-note-${index + 1}`}
            >
              <div className="tape" />
              <div className="note-icon-circle">
                <span className="material-symbols-outlined note-icon">{note.icon}</span>
              </div>
              <h4 style={{ fontWeight: '900', fontSize: '14px', marginBottom: '6px' }}>{note.title}</h4>
              <p style={{ fontSize: '11px', lineHeight: '1.6', fontWeight: '600', margin: 0 }}>{note.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
