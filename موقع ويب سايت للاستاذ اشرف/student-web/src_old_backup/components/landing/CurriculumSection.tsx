import { CURRICULUM_BRANCHES } from './landingData';

interface CurriculumSectionProps {
  onSelectCourse: (courseId: string) => void;
}

export const CurriculumSection: React.FC<CurriculumSectionProps> = ({ onSelectCourse }) => (
  <section id="curriculum" className="landing-section" aria-labelledby="curr-heading">
    <div className="landing-container">
      <div className="landing-section-head">
        <h2 id="curr-heading">فروع منهج اللغة العربية في فُصحى</h2>
        <p>ستة فروع أساسية للمنهج، شرحها كاملًا، وتمارينها مرتّبة من السهل إلى الصعب في كل فرع على حدة.</p>
      </div>
      <div className="landing-curriculum-grid">
        {CURRICULUM_BRANCHES.map((b) => (
          <a
            key={b.title}
            href="#pricing"
            className="landing-branch-card"
            onClick={(e) => {
              e.preventDefault();
              onSelectCourse(`branch-${b.title}`);
            }}
          >
            <span className="landing-branch-icon" aria-hidden="true">
              <span className="material-symbols-outlined">{b.icon}</span>
            </span>
            <span className="landing-branch-text">
              <h3>{b.title}</h3>
              <p>{b.text}</p>
            </span>
          </a>
        ))}
      </div>
    </div>
  </section>
);