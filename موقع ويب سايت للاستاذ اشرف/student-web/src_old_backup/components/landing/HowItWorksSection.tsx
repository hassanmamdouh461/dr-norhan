import { HOW_STEPS } from './landingData';

export const HowItWorksSection: React.FC = () => (
  <section id="how" className="landing-section" aria-labelledby="how-heading">
    <div className="landing-container">
      <div className="landing-section-head">
        <h2 id="how-heading">طريق التعلّم في فُصحى</h2>
        <p>ثلاث خطوات بسيطة تنقلك من أينما تبدأ إلى حيث تريد أن تكون.</p>
      </div>
      <div className="landing-how-grid">
        {HOW_STEPS.map((step, idx) => (
          <article key={step.title} className="landing-how-step">
            <div className="landing-how-num" aria-hidden="true">{idx + 1}</div>
            <h3>{step.title}</h3>
            <p>{step.text}</p>
          </article>
        ))}
      </div>
    </div>
  </section>
);