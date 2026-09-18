import { Link } from 'react-router-dom';

export const QuestionBankSection: React.FC = () => (
  <section id="bank" className="landing-section" aria-labelledby="bank-heading">
    <div className="landing-container">
      <div className="landing-tools-grid">
        <article className="landing-tool-card" aria-labelledby="bank-heading">
          <div className="landing-tool-icon" aria-hidden="true">
            <span className="material-symbols-outlined">quiz</span>
          </div>
          <h3 id="bank-heading">بنك الأسئلة والامتحانات</h3>
          <p>
            آلاف الأسئلة المصنّفة بحسب فرع المنهج (النحو، البلاغة، الأدب، القراءة،
            التعبير، وتاريخ الأدب) ومستوى الصعوبة، مع أسئلة مأخوذة من امتحانات الثانوية
            العامة للأعوام السابقة، وأخرى يحرّرها فريق الأستاذ لتطابق مواصفات الامتحان.
          </p>
          <div className="landing-tool-stats">
            <span className="landing-tool-chip">8,000+ سؤال</span>
            <span className="landing-tool-chip">6 فروع للمنهج</span>
            <span className="landing-tool-chip">تصحيح فوري بالشرح</span>
          </div>
          <Link className="landing-btn landing-btn-primary landing-tool-cta" to="/bank">
            ابدأ التدريب الآن
            <span className="material-symbols-outlined landing-btn-icon-end" aria-hidden="true">
              arrow_back
            </span>
          </Link>
        </article>
      </div>
    </div>
  </section>
);