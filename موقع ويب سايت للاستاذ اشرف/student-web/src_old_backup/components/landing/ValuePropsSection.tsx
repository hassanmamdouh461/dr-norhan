import { VALUE_PROPS } from './landingData';

export const ValuePropsSection: React.FC = () => (
  <section id="why" className="landing-section" aria-labelledby="why-heading">
    <div className="landing-container">
      <div className="landing-section-head">
        <h2 id="why-heading">لماذا فُصحى؟</h2>
        <p>أربع ركائز تجعل من فُصحى اختيار طلاب الثانوية العامة الأول في مصر لتعلّم اللغة العربية.</p>
      </div>
      <div className="landing-value-grid">
        {VALUE_PROPS.map((v) => (
          <article key={v.title} className="landing-value-card">
            <div className={`landing-value-icon ${v.iconTone}`}>
              <span className="material-symbols-outlined" aria-hidden="true">{v.icon}</span>
            </div>
            <h3>{v.title}</h3>
            <p>{v.text}</p>
          </article>
        ))}
      </div>
    </div>
  </section>
);