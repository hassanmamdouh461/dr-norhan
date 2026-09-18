import teacherHero from '../../assets/teacher_hero.webp';
import { TRUST_STATS } from './landingData';

interface HeroSectionProps {
  onShowAuth: () => void;
}

export const HeroSection: React.FC<HeroSectionProps> = ({ onShowAuth }) => {
  return (
    <>
      <section id="top" className="landing-hero" aria-labelledby="hero-heading">
        <div className="landing-hero-pattern" aria-hidden="true" />
        <div className="landing-container landing-hero-grid">
          <div className="landing-hero-copy">
            <span className="landing-eyebrow">
              <span className="material-symbols-outlined" aria-hidden="true">workspace_premium</span>
              الأستاذ أشرف سليم · لغة عربية للثانوية العامة
            </span>
            <h1 id="hero-heading">
              أتقن <span className="accent-word">اللغة العربية</span>،
              <br />
              وتفوّق في امتحان الثانوية العامة.
            </h1>
            <p className="landing-hero-lead">
              منصة فُصحى تأخذ بيدك خطوة بخطوة عبر منهج اللغة العربية كاملًا:
              شرحًا وافيًا للنحو والبلاغة، وتذوّقًا للأدب والنصوص،
              وتدريبًا مستمرًا على أسئلة الوزارة بأسلوب سلس لا يُنسى.
            </p>
            <div className="landing-hero-ctas">
              <button
                type="button"
                className="landing-btn landing-btn-gold"
                onClick={onShowAuth}
              >
                ابدأ مجاناً
                <span className="material-symbols-outlined landing-btn-icon-end" aria-hidden="true">
                  arrow_back
                </span>
              </button>
              <a
                href="#lesson"
                className="landing-btn landing-btn-ghost-dark"
              >
                <span className="material-symbols-outlined" aria-hidden="true">play_circle</span>
                شاهد نموذج محاضرة
              </a>
            </div>
          </div>

          <div className="landing-hero-portrait" aria-hidden="true">
            <div className="landing-hero-portrait-glow" />
            <div className="landing-hero-portrait-frame">
              <img
                src={teacherHero}
                alt=""
                loading="eager"
                decoding="async"
              />
            </div>
          </div>
        </div>
      </section>

      <section className="landing-trust" aria-label="إحصائيات الثقة">
        <div className="landing-container landing-trust-grid">
          {TRUST_STATS.map((s) => (
            <div key={s.lbl} className="landing-trust-stat">
              <span className="num">{s.num}</span>
              <span className="lbl">{s.lbl}</span>
            </div>
          ))}
        </div>
      </section>
    </>
  );
};