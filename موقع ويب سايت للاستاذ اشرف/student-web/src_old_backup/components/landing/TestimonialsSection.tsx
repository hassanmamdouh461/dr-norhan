import { TESTIMONIALS } from './landingData';

const renderStars = (count: number) => {
  const stars: React.ReactElement[] = [];
  for (let i = 0; i < count; i++) {
    stars.push(
      <span key={i} className="material-symbols-outlined" aria-hidden="true">star</span>
    );
  }
  return stars;
};

export const TestimonialsSection: React.FC = () => (
  <section className="landing-section" aria-labelledby="testi-heading">
    <div className="landing-container">
      <div className="landing-section-head">
        <h2 id="testi-heading">آراء طلابنا وأولياء الأمور</h2>
        <p>قصص حقيقية من طلاب الثانوية العامة وأولياء أمورهم عن تجربتهم مع فُصحى.</p>
      </div>
      <div className="landing-testimonials-grid">
        {TESTIMONIALS.map((t) => (
          <article key={t.name} className="landing-testimonial">
            <div className="landing-stars" aria-label={`${t.stars} من 5 نجوم`}>
              {renderStars(t.stars)}
            </div>
            <blockquote>“{t.quote}”</blockquote>
            <div className="landing-testimonial-foot">
              <span className={`landing-avatar${t.isParent ? ' is-parent' : ''}`} aria-hidden="true">
                {t.avatar}
              </span>
              <div>
                <h4>{t.name}</h4>
                <span className="role">{t.role}</span>
              </div>
            </div>
          </article>
        ))}
      </div>
    </div>
  </section>
);