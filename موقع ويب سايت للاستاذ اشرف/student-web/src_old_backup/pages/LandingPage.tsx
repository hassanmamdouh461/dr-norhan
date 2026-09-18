import '../components/landing/landing.css';
import { LandingHeader } from '../components/landing/LandingHeader';
import { HeroSection } from '../components/landing/HeroSection';
import { ValuePropsSection } from '../components/landing/ValuePropsSection';
import { CurriculumSection } from '../components/landing/CurriculumSection';
import { HowItWorksSection } from '../components/landing/HowItWorksSection';
import { SampleLessonSection } from '../components/landing/SampleLessonSection';
import { QuestionBankSection } from '../components/landing/QuestionBankSection';
import { DictionarySection } from '../components/landing/DictionarySection';
import { TestimonialsSection } from '../components/landing/TestimonialsSection';
import { PricingSection } from '../components/landing/PricingSection';
import { FaqSection } from '../components/landing/FaqSection';
import { SiteFooter } from '../components/landing/SiteFooter';

interface LandingPageProps {
  onShowAuth: () => void;
  onSelectCourse: (courseId: string) => void;
}

export const LandingPage: React.FC<LandingPageProps> = ({ onShowAuth, onSelectCourse }) => {
  return (
    <div className="landing-root" lang="ar" dir="rtl">
      <a href="#hero-heading" className="landing-skip">
        تخطَّ إلى المحتوى
      </a>

      <LandingHeader onShowAuth={onShowAuth} transparent />

      <main>
        <HeroSection onShowAuth={onShowAuth} />
        <ValuePropsSection />
        <CurriculumSection onSelectCourse={onSelectCourse} />
        <HowItWorksSection />
        <SampleLessonSection />
        <QuestionBankSection />
        <DictionarySection />
        <TestimonialsSection />
        <PricingSection onShowAuth={onShowAuth} />
        <FaqSection />
      </main>

      <SiteFooter />
    </div>
  );
};