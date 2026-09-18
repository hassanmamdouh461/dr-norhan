import { useState } from 'react';
import { FAQ_ITEMS } from './landingData';

export const FaqSection: React.FC = () => {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  return (
    <section id="faq" className="landing-section" aria-labelledby="faq-heading">
      <div className="landing-container">
        <div className="landing-section-head">
          <h2 id="faq-heading">الأسئلة الشائعة</h2>
          <p>إجابات سريعة على أكثر الأسئلة التي تصلنا من الطلاب وأولياء الأمور.</p>
        </div>
        <div className="landing-faq" role="list">
          {FAQ_ITEMS.map((item, idx) => {
            const isOpen = openIndex === idx;
            const panelId = `faq-panel-${idx}`;
            const btnId = `faq-btn-${idx}`;
            return (
              <div
                key={item.q}
                className={`landing-faq-row${isOpen ? ' is-open' : ''}`}
                role="listitem"
              >
                <button
                  id={btnId}
                  type="button"
                  className="landing-faq-toggle"
                  aria-expanded={isOpen}
                  aria-controls={panelId}
                  onClick={() => setOpenIndex(isOpen ? null : idx)}
                >
                  <h3 className="landing-faq-q">{item.q}</h3>
                  <span
                    className="material-symbols-outlined landing-faq-chev"
                    aria-hidden="true"
                  >
                    expand_more
                  </span>
                </button>
                {isOpen && (
                  <div id={panelId} role="region" aria-labelledby={btnId} className="landing-faq-a">
                    {item.a}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
};