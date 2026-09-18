import { SAMPLE_BULLETS } from './landingData';

export const SampleLessonSection: React.FC = () => (
  <section id="lesson" className="landing-section landing-sample" aria-labelledby="sample-heading">
    <div className="landing-container">
      <div className="landing-section-head">
        <h2 id="sample-heading">شاهد كيف نُعلّم</h2>
        <p>عيّنة من محاضرة "البلاغة — علم المعاني"، كما يحضرها طلابنا أسبوعيًا.</p>
      </div>
      <div className="landing-sample-grid">
        <div
          className="landing-sample-video"
          role="img"
          aria-label="معاينة محاضرة نموذجية في البلاغة"
        >
          <div className="landing-sample-poster" aria-hidden="true">
            <span>البلاغة — علم المعاني</span>
          </div>
          <button type="button" className="landing-sample-play" aria-label="تشغيل المحاضرة النموذجية">
            <span className="material-symbols-outlined" aria-hidden="true">play_arrow</span>
          </button>
        </div>

        <ul className="landing-sample-bullets">
          {SAMPLE_BULLETS.map((b) => (
            <li key={b.strong}>
              <span className="material-symbols-outlined" aria-hidden="true">check_circle</span>
              <div>
                <strong>{b.strong}</strong>
                <span>{b.span}</span>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  </section>
);