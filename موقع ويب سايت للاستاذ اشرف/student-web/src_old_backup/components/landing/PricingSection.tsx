import { PRICING } from './landingData';

interface PricingSectionProps {
  onShowAuth: () => void;
}

export const PricingSection: React.FC<PricingSectionProps> = ({ onShowAuth }) => (
  <section id="pricing" className="landing-section" aria-labelledby="pricing-heading">
    <div className="landing-container">
      <div className="landing-section-head">
        <h2 id="pricing-heading">خطط الاشتراك</h2>
        <p>اختر الخطة التي تناسب صفّك الدراسي وميزانيتك. يمكنك الترقية أو الإلغاء في أي وقت.</p>
      </div>
      <div className="landing-pricing-grid">
        {PRICING.map((p) => (
          <article
            key={p.name}
            className={`landing-price-card${p.featured ? ' is-featured' : ''}`}
            aria-label={`${p.name} بـ ${p.price} جنيه شهريًا`}
          >
            {p.featured && <span className="landing-price-ribbon">الأكثر طلبًا</span>}
            <h3 className="name">{p.name}</h3>
            <div>
              <span className="price">
                {p.price}
                <span className="price-unit">{p.unit}</span>
              </span>
            </div>
            <p className="blurb">{p.blurb}</p>
            <ul className="landing-price-features">
              {p.features.map((f) => (
                <li key={f}>
                  <span className="material-symbols-outlined" aria-hidden="true">check_circle</span>
                  {f}
                </li>
              ))}
            </ul>
            <button
              type="button"
              className={`landing-btn ${p.featured ? 'landing-btn-gold' : 'landing-btn-primary'}`}
              onClick={onShowAuth}
            >
              {p.cta}
            </button>
          </article>
        ))}
      </div>
    </div>
  </section>
);