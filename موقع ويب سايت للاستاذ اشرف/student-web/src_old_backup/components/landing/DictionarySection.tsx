import { Link } from 'react-router-dom';

export const DictionarySection: React.FC = () => (
  <section id="dictionary" className="landing-section" aria-labelledby="dict-heading">
    <div className="landing-container">
      <div className="landing-tools-grid">
        <article className="landing-tool-card is-dictionary" aria-labelledby="dict-heading">
          <div className="landing-tool-icon" aria-hidden="true">
            <span className="material-symbols-outlined">menu_book</span>
          </div>
          <h3 id="dict-heading">معجم فُصحى للمفردات</h3>
          <p>
            معجم عربي متخصّص يضم المفردات الصعبة والبلاغية التي ترد في نصوص القراءة والأدب،
            مع معانيها، وأمثلة من سياقات ورودها في امتحانات الثانوية العامة،
            ومرادفاتها إن وُجدت. صُمّم خصيصًا ليكون رفيق الطالب في المراجعة.
          </p>
          <div className="landing-tool-stats">
            <span className="landing-tool-chip">+2,500 مدخل</span>
            <span className="landing-tool-chip">سياقات من أسئلة الوزارة</span>
            <span className="landing-tool-chip">بحث ذكي بالعربية</span>
          </div>
          <Link className="landing-btn landing-btn-primary landing-tool-cta" to="/dictionary">
            افتح معجم فُصحى
            <span className="material-symbols-outlined landing-btn-icon-end" aria-hidden="true">
              arrow_back
            </span>
          </Link>
        </article>
      </div>
    </div>
  </section>
);