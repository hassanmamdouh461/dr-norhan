import React, { useEffect, useState } from 'react';
import { ApiService } from '../services/api';
import { ChemicalParticles } from '../components/ChemicalParticles';
import { SkeletonCourseGrid } from '../components/Skeleton';
import { GuidedTour, type TourStep } from '../components/GuidedTour';
import teacherPortrait from '../assets/teacher_portrait.webp';
import { optimizedCoverUrl } from '../utils/img';

const LANDING_TOUR_STEPS: TourStep[] = [
  { selector: '[data-tour="tour-landing-auth"]', title: 'حسابك على المنصة', text: 'من هنا يمكنك تسجيل الدخول لحسابك أو إنشاء حساب جديد مجاناً.' },
  { selector: '[data-tour="tour-landing-hero"]', title: 'ابدأ رحلتك التعليمية', text: 'نظرة سريعة على أهم ما تقدمه المنصة: محاضرات، امتحانات دورية، ومتابعة مستمرة.' },
  { selector: '[data-tour="tour-landing-features"]', title: 'مميزات المنصة', text: 'تعرّف على أهم الأدوات التي تساعدك على الفهم والمذاكرة بفعالية.' },
  { selector: '[data-tour="tour-landing-courses"]', title: 'المقررات الدراسية', text: 'تصفح المقررات المتاحة حسب صفك الدراسي واشترك في المناسب لك.' },
  { selector: '[data-tour="tour-landing-faq"]', title: 'أسئلة شائعة', text: 'إجابات سريعة على أكثر الاستفسارات تكراراً حول الاشتراك والتفعيل.' },
];

interface LandingPageProps {
  onShowAuth: () => void;
  onSelectCourse: (courseId: string) => void;
}

export const LandingPage: React.FC<LandingPageProps> = ({ onShowAuth, onSelectCourse }) => {
  const [courses, setCourses] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeFaq, setActiveFaq] = useState<number | null>(null);

  useEffect(() => {
    const fetchCourses = async () => {
      setLoading(true);
      try {
        const res = await ApiService.getCourses(1);
        setCourses(res.courses || []);
      } catch (err) {
        console.error('Failed to load landing courses:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchCourses();
  }, []);

  const toggleFaq = (index: number) => {
    setActiveFaq(activeFaq === index ? null : index);
  };

  const faqData = [
    {
      q: 'كيف يمكنني الاشتراك وتفعيل الكورسات؟',
      a: 'يمكنك إنشاء حساب مجاني أولاً، ثم شراء كود التفعيل من نقاط البيع المعتمدة وتفعيله مباشرة من لوحة التحكم الخاصة بك.'
    },
    {
      q: 'هل يمكنني حضور الدروس من أكثر من جهاز؟',
      a: 'لحماية حسابك ومحتوى المنصة، يتم ربط حسابك بجهازك الأساسي الذي تسجل منه لأول مرة. يمكنك طلب إعادة تعيين الجهاز من الدعم الفني عند الضرورة.'
    },
    {
      q: 'هل الشرح يغطي جميع أجزاء منهج الثانوية العامة؟',
      a: 'نعم، المنصة تغطي المنهج كاملاً بالتفصيل، مع مراجعات شاملة بعد كل باب وحل آلاف الأسئلة والامتحانات الوزارية السابقة.'
    },
    {
      q: 'كيف يمكنني التواصل مع المعلم لطرح الأسئلة الصعبة؟',
      a: 'توفر المنصة قسماً مخصصاً للأسئلة والأجوبة (سؤال وجواب) يمكنك من خلاله كتابة سؤالك وسيقوم فريق الدعم الأكاديمي بالإجابة عليك بالتفصيل خلال ساعات.'
    }
  ];

  return (
    <div className="landing-container">

      {/* Guest walkthrough of the landing page sections — re-shown every new tab/session */}
      <GuidedTour steps={LANDING_TOUR_STEPS} storageKey="landing_tour_seen" persistence="session" />

      {/* ── Top Header Navigation ── */}
      <header className="landing-header">
        <div className="flex items-center gap-sm">
          <span className="landing-brand-title">
            كيميا
          </span>
          <span className="badge landing-badge">
            الكيمياء
          </span>
        </div>

        <div className="flex gap-md" data-tour="tour-landing-auth">
          <button
            onClick={onShowAuth}
            className="btn btn-secondary landing-btn"
          >
            تسجيل الدخول
          </button>
          <button
            onClick={onShowAuth}
            className="btn btn-primary landing-btn landing-btn-primary"
          >
            انضم الآن مجاناً
          </button>
        </div>
      </header>

      {/* ── Section 1: Cinematic Hero Section ── */}
      <section className="layout-container landing-hero-section" data-tour="tour-landing-hero">
        <div className="hero-cinematic animate-fade-in-up">
          {/* Particles Canvas in Background */}
          <div className="hero-particles-wrapper">
            <ChemicalParticles />
          </div>

          {/* Right Column: Copy & CTAs */}
          <div className="hero-content-right">
            <div>
              <span className="landing-hero-badge">
                <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>workspace_premium</span>
                منصة الكيمياء الأولى للثانوية العامة 📚
              </span>

              <h1 className="landing-hero-title">
                اتقن الكيمياء.<br />
                تفوّق في امتحانك النهائي.
              </h1>

              <p className="landing-hero-lead">
                انضم لرحلة الشرح التفاعلي المتكامل لمنهج الكيمياء مع كيميا. شروحات مبسطة بأعلى جودة، تدريبات مستمرة، ومتابعة دقيقة لكل فكرة تضمن لك الدرجة النهائية.
              </p>
            </div>

            <div className="flex gap-md" style={{ flexWrap: 'wrap', zIndex: 5 }}>
              <button
                onClick={onShowAuth}
                className="btn btn-primary animate-glow-pulse landing-btn-hero"
              >
                ابدأ رحلة تفوقك مجاناً
              </button>

              <a
                href="#courses"
                className="btn btn-secondary landing-btn-hero-outline"
              >
                تصفح المقررات الدراسية
              </a>
            </div>

            {/* Highlights Bar Glass */}
            <div className="stats-bar-glass">
              <div className="stat-item-glass">
                <div className="stat-val-glass">منهج كامل</div>
                <div className="stat-lbl-glass">شرح تفصيلي لكل الأبواب</div>
              </div>
              <div className="stat-item-glass">
                <div className="stat-val-glass">امتحانات دورية</div>
                <div className="stat-lbl-glass">بتصحيح تلقائي فوري</div>
              </div>
              <div className="stat-item-glass">
                <div className="stat-val-glass">دعم مباشر</div>
                <div className="stat-lbl-glass">سؤال وجواب مع فريق المنصة</div>
              </div>
            </div>
          </div>

          {/* Left Column: Teacher Portrait with Glowing Mask */}
          <div className="hero-image-left">
            <img
              src={teacherPortrait}
              alt="معلم الكيمياء"
            />
            {/* Back Glowing Aura */}
            <div className="teacher-glowing-backdrop" />
          </div>
        </div>
      </section>

      {/* ── Section 2: Features ── */}
      <section className="landing-section landing-section-alt" data-tour="tour-landing-features">
        <div className="layout-container">
          <div className="landing-section-title">
            <h2>لماذا يفضل الطلاب منصة كيميا؟</h2>
            <p>منظومة تعليمية متكاملة مصممة خصيصاً لمساعدتك على إتقان الكيمياء والتميز فيها.</p>
          </div>

          <div className="grid grid-3 gap-lg">
            <div className="card surface-glass landing-feature-card">
              <div className="landing-feature-icon">
                <span className="material-symbols-outlined">menu_book</span>
              </div>
              <h3 className="landing-feature-title">شرح تفاعلي مبسط</h3>
              <p className="landing-feature-desc">
                فيديوهات شرح تفصيلية بتقنية عالية، تستخدم الجداول والرسومات التوضيحية لتفكيك الأفكار الصعبة لأجزاء سهلة الاستيعاب.
              </p>
            </div>

            <div className="card surface-glass landing-feature-card">
              <div className="landing-feature-icon">
                <span className="material-symbols-outlined">edit_document</span>
              </div>
              <h3 className="landing-feature-title">امتحانات وواجبات دورية</h3>
              <p className="landing-feature-desc">
                واجب بعد كل درس وامتحان شامل لكل وحدة، مع تصحيح تلقائي فوري يوضح لك مواطن القوة والضعف في أدائك.
              </p>
            </div>

            <div className="card surface-glass landing-feature-card">
              <div className="landing-feature-icon landing-feature-icon-accent">
                <span className="material-symbols-outlined">forum</span>
              </div>
              <h3 className="landing-feature-title">دعم أكاديمي متواصل</h3>
              <p className="landing-feature-desc">
                منتدى داخلي لطرح الأسئلة ومناقشة الأفكار. فريق من المعيدين المتخصصين يجيب على أسئلتك لتظل دائماً على المسار الصحيح.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── Section 3: Dynamic Courses Preview ── */}
      <section id="courses" className="landing-section" data-tour="tour-landing-courses">
        <div className="layout-container">
          <div className="landing-section-title">
            <h2>المقررات الدراسية المتاحة</h2>
            <p>تصفح الكورسات الخاصة بكل المراحل الدراسية للثانوية العامة.</p>
          </div>

          {loading ? (
            <SkeletonCourseGrid count={3} />
          ) : courses.length === 0 ? (
            <div className="landing-empty-state">لا توجد مقررات دراسية منشورة حالياً.</div>
          ) : (
            <div className="grid grid-3 gap-lg">
              {courses.map((course: any) => (
                <div
                  key={course.id}
                  className="card surface-glass landing-course-card"
                >
                  <div className="landing-course-cover">
                    <div className="landing-course-grade-badge">
                      {course.grade}
                    </div>
                    {course.thumbnail_url ? (
                      <img src={optimizedCoverUrl(course.thumbnail_url, 400)} alt={course.title} loading="lazy" width={400} height={180} />
                    ) : (
                      <div className="landing-course-cover-fallback">
                        <span className="material-symbols-outlined">school</span>
                      </div>
                    )}
                  </div>

                  <div className="landing-course-body">
                    <div>
                      <h3 className="landing-course-title">{course.title}</h3>
                      <p className="landing-course-desc">
                        {course.description || 'لا يوجد وصف متاح للمقرر حالياً.'}
                      </p>
                    </div>

                    <div className="landing-course-footer">
                      <span className="landing-course-price">
                        {course.price_egp > 0 ? `${course.price_egp} ج.م` : 'مجاني'}
                      </span>
                      <button
                        onClick={() => onSelectCourse(course.id)}
                        className="btn btn-primary"
                        style={{ fontSize: '12px', padding: '8px 16px', borderRadius: '8px' }}
                      >
                        عرض التفاصيل
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* ── Section 4: Testimonials ── */}
      <section className="landing-section landing-section-alt">
        <div className="layout-container">
          <div className="landing-section-title">
            <h2>آراء وقصص نجاح طلابنا</h2>
            <p>طلاب العام الماضي يشاركون تجربتهم مع المنصة وكيف وصلوا للدرجات النهائية.</p>
          </div>

          <div className="grid grid-3 gap-lg">
            <div className="card surface-glass landing-testimonial-card">
              <p className="landing-testimonial-quote">
                "الكيمياء بالنسبة لي كانت عقدة حقيقية، خصوصاً الاتزان الكيميائي والمعادلات. بس مع منصة كيميا وطريقتها المنظمة في التبسيط والخرائط الذهنية، فهمت كل الأجزاء الصعبة والحمد لله قفلت المادة في الامتحان."
              </p>
              <div className="landing-testimonial-footer">
                <div className="landing-testimonial-avatar">م</div>
                <div>
                  <h4 className="landing-testimonial-name">محمد أحمد</h4>
                  <span className="landing-testimonial-role">طالب بالصف الثالث الثانوي</span>
                </div>
              </div>
            </div>

            <div className="card surface-glass landing-testimonial-card">
              <p className="landing-testimonial-quote">
                "الواجبات بعد كل درس والامتحان الأسبوعي كان ليهم فضل كبير جداً. تصحيح الواجب التلقائي بيخليني أعرف غلطي فوراً ومكررهوش تاني في الامتحانات الشاملة."
              </p>
              <div className="landing-testimonial-footer">
                <div className="landing-testimonial-avatar">س</div>
                <div>
                  <h4 className="landing-testimonial-name">سارة كريم</h4>
                  <span className="landing-testimonial-role">طالبة بالصف الثالث الثانوي</span>
                </div>
              </div>
            </div>

            <div className="card surface-glass landing-testimonial-card">
              <p className="landing-testimonial-quote">
                "أكتر حاجة متميزة في المنصة هي قسم سؤال وجواب. لما بيقف قدامي أي سؤال في الواجب أو الامتحانات الخارجية، بصوره وأرفعه وبيردوا عليا فوراً بالإجابة بالخطوات والشرح."
              </p>
              <div className="landing-testimonial-footer">
                <div className="landing-testimonial-avatar landing-testimonial-avatar-neutral">ع</div>
                <div>
                  <h4 className="landing-testimonial-name">علي محمود</h4>
                  <span className="landing-testimonial-role">طالب بالصف الثالث الثانوي</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Section 5: FAQ Accordion ── */}
      <section className="landing-section" data-tour="tour-landing-faq">
        <div className="layout-container" style={{ maxWidth: '800px' }}>
          <div className="landing-section-title">
            <h2>الأسئلة الشائعة</h2>
            <p>إجابات سريعة على الاستفسارات التي تدور في ذهنك.</p>
          </div>

          <div className="flex flex-col gap-sm">
            {faqData.map((faq, idx) => {
              const isOpen = activeFaq === idx;
              return (
                <div
                  key={idx}
                  className={`card surface-glass landing-faq-item${isOpen ? ' is-open' : ''}`}
                >
                  <button
                    type="button"
                    onClick={() => toggleFaq(idx)}
                    aria-expanded={isOpen}
                    className="landing-faq-toggle"
                  >
                    <h3 className="landing-faq-question">
                      <span className="material-symbols-outlined" style={{ fontSize: '18px', color: 'rgb(var(--primary))' }} aria-hidden="true">help_outline</span>
                      {faq.q}
                    </h3>
                    <span className={`material-symbols-outlined landing-faq-chevron${isOpen ? ' is-open' : ''}`} aria-hidden="true">
                      keyboard_arrow_down
                    </span>
                  </button>
                  {isOpen && (
                    <div className="landing-faq-answer">
                      {faq.a}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── Section 6: Final CTA ── */}
      <section className="landing-section landing-final-cta">
        <div className="layout-container landing-final-cta-container">
          <h2 className="landing-final-cta-title">ابدأ رحلتك للتفوق الأكاديمي اليوم!</h2>
          <p className="landing-final-cta-lead">
            سجّل حساباً مجاناً الآن وابدأ بمشاهدة الدروس التجريبية المفتوحة مجاناً. لا تدع الكيمياء تقف عقبة أمام حلمك.
          </p>
          <button
            onClick={onShowAuth}
            className="btn btn-primary animate-glow-pulse"
            style={{ fontSize: '15px', padding: '16px 48px', borderRadius: '12px' }}
          >
            سجّل حسابك مجاناً الآن
          </button>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="landing-footer">
        <div className="layout-container">
          <p style={{ margin: 0 }}>
            حقوق النشر والتشغيل محفوظة لـ{' '}
            <a
              href="https://www.synapticstudio.tech/ar"
              target="_blank"
              rel="noopener noreferrer"
              className="landing-footer-link"
            >
              سينابتك ستوديو
            </a>
          </p>
        </div>
      </footer>

    </div>
  );
};
