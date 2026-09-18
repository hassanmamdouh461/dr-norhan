import { CONTACT_CHIPS, FOOTER_LINKS } from './landingData';

export const SiteFooter: React.FC = () => (
  <>
    <section id="contact" className="landing-cta-band" aria-labelledby="cta-heading">
      <div className="landing-container">
        <h2 id="cta-heading">جاهز لتبدأ رحلتك مع فُصحى؟</h2>
        <p>
          انضم اليوم إلى أكثر من 12,000 طالب وطالبة يستخدمون فُصحى للتحضير لامتحان
          الثانوية العامة، وتواصل معنا في أي وقت إذا احتجت مساعدة.
        </p>
        <div className="landing-contact-chips">
          {CONTACT_CHIPS.map((c) => (
            <a
              key={c.label}
              href={c.href}
              className={`landing-contact-chip${c.isWhatsapp ? ' is-whatsapp' : ''}`}
            >
              <span className="material-symbols-outlined" aria-hidden="true">{c.icon}</span>
              {c.label}
            </a>
          ))}
        </div>
      </div>
    </section>

    <footer className="landing-footer" aria-labelledby="footer-heading">
      <h2 id="footer-heading" className="fusha-sr-only">ذيل الصفحة</h2>
      <div className="landing-container">
        <div className="landing-footer-grid">
          <div className="landing-footer-brand">
            <h4>فُصْحَى</h4>
            <p>{FOOTER_LINKS.brand}</p>
          </div>
          {FOOTER_LINKS.columns.map((col) => (
            <div key={col.title}>
              <h4>{col.title}</h4>
              <ul>
                {col.links.map((l) => (
                  <li key={l.label}>
                    <a href={l.href}>{l.label}</a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="landing-footer-bottom">
          <span>{FOOTER_LINKS.legal}</span>
          <span>{FOOTER_LINKS.attribution}</span>
        </div>
      </div>
    </footer>

    <a
      className="landing-fab"
      href="https://wa.me/201000000000"
      target="_blank"
      rel="noopener noreferrer"
      aria-label="تواصل عبر واتساب"
    >
      <span className="material-symbols-outlined" aria-hidden="true">chat</span>
    </a>
  </>
);