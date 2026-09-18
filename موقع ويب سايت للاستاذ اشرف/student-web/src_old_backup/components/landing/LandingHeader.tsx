import { useEffect, useState } from 'react';
import { NAV_LINKS } from './landingData';

interface LandingHeaderProps {
  onShowAuth: () => void;
  transparent?: boolean;
}

/**
 * هيدر الصفحة العامة — كبسولة عائمة مع شريط تقدّم قراءة مدمج.
 * الشريط يقرأ نسبة التمرير ويُحدّث عرضه عبر متغيّر CSS مباشرة (بلا إعادة رسم
 * لكل إطار)، ويحترم `prefers-reduced-motion` عبر CSS لا عبر JS.
 */
export const LandingHeader: React.FC<LandingHeaderProps> = ({ onShowAuth, transparent = false }) => {
  const [scrolled, setScrolled] = useState(false);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    let frame = 0;

    const measure = () => {
      frame = 0;
      const doc = document.documentElement;
      const scrollable = doc.scrollHeight - doc.clientHeight;
      setScrolled(window.scrollY > 32);
      setProgress(scrollable > 0 ? Math.min(1, window.scrollY / scrollable) : 0);
    };

    // نُجمّع أحداث التمرير في إطار واحد بدل حساب التخطيط عند كل حدث.
    const onScroll = () => {
      if (frame) return;
      frame = window.requestAnimationFrame(measure);
    };

    measure();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll, { passive: true });
    return () => {
      if (frame) window.cancelAnimationFrame(frame);
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
    };
  }, []);

  const isTransparent = transparent && !scrolled;

  const handleNavClick = (e: React.MouseEvent<HTMLAnchorElement>, id: string) => {
    const target = document.getElementById(id);
    if (target) {
      e.preventDefault();
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  return (
    <header
      className={`landing-header${isTransparent ? ' is-transparent' : ''}${scrolled ? ' is-scrolled' : ''}`}
    >
      <a className="landing-brand" href="#top" aria-label="الصفحة الرئيسية لـ فُصحى">
        <span className="landing-brand-mark" aria-hidden="true">ف</span>
        <span className="landing-brand-wordmark">
          <span className="landing-brand-name">فُصْحَى</span>
          <span className="landing-brand-tag">للثانوية العامة</span>
        </span>
      </a>

      <nav className="landing-nav" aria-label="تنقل رئيسي">
        {NAV_LINKS.map((link) => (
          <a
            key={link.id}
            href={`#${link.id}`}
            onClick={(e) => handleNavClick(e, link.id)}
          >
            {link.label}
          </a>
        ))}
      </nav>

      <div className="landing-header-actions">
        <button
          type="button"
          className="landing-btn landing-btn-ghost"
          onClick={onShowAuth}
        >
          تسجيل الدخول
        </button>
        <button
          type="button"
          className="landing-btn landing-btn-primary"
          onClick={onShowAuth}
        >
          ابدأ الآن
        </button>
      </div>

      <div className="landing-header-progress" aria-hidden="true">
        <span style={{ width: `${progress * 100}%` }} />
      </div>
    </header>
  );
};
