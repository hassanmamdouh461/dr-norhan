import React, { useState, Suspense, lazy } from 'react';
import { Routes, Route, Navigate, useParams, useNavigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import { ApiService } from './services/api';

// Loader is kept static as it's needed for guards and fallbacks
import Loader from './components/Loader';

// Lazy load pages for efficient code splitting
const LandingPage = lazy(() => import('./pages/LandingPage').then(m => ({ default: m.LandingPage })));
const LoginRegister = lazy(() => import('./pages/LoginRegister').then(m => ({ default: m.LoginRegister })));
const Home = lazy(() => import('./pages/Home').then(m => ({ default: m.Home })));
const CourseDetails = lazy(() => import('./pages/CourseDetails').then(m => ({ default: m.CourseDetails })));
const LessonPlayer = lazy(() => import('./pages/LessonPlayer').then(m => ({ default: m.LessonPlayer })));

/**
 * Route-transition fallback: shown while a lazy page chunk is downloading.
 * Kept intentionally light (brand mark + shimmer bar, not a full spinner)
 * since this appears on every route switch, not just first load — a
 * full-screen spinner there reads as a jarring blank flash rather than a
 * loading state. Auth/session checks (HomeRoute/DashboardRoute below) keep
 * the full <Loader> instead, since those are rarer and longer waits.
 */
const RouteFallback: React.FC = () => (
  <div
    style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      gap: '14px',
      minHeight: '100vh',
      width: '100%',
      backgroundColor: 'rgb(var(--background))',
    }}
  >
    <span
      className="material-symbols-outlined animate-pulse"
      style={{ fontSize: '40px', color: 'rgb(var(--primary))' }}
    >
      school
    </span>
    <div className="shimmer-loading" style={{ width: '120px', height: '4px', borderRadius: '2px' }} />
  </div>
);

/** Landing page wrapper - uses internal navigation */
const LandingPageRoute: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div style={{ minHeight: '100vh', backgroundColor: 'rgb(var(--background))', color: 'rgb(var(--on-background))' }}>
      <LandingPage
        onShowAuth={() => navigate('/login')}
        onSelectCourse={(courseId) => navigate(`/courses/${courseId}`)}
      />
    </div>
  );
};

/** Home route: redirects to /dashboard/home which handles both authenticated and guest views */
const HomeRoute: React.FC = () => {
  const { loading, needsProfileSetup } = useAuth();

  if (loading) {
    return <Loader text="جاري التحميل..." size="large" fullscreen={true} />;
  }

  if (needsProfileSetup) {
    return <LoginRegister />;
  }

  return <Navigate to="/dashboard/home" replace />;
};

/** Wraps CourseDetails with route params */
const CourseDetailsWrapper: React.FC = () => {
  const { courseId } = useParams<{ courseId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();

  if (!courseId) return <Navigate to="/" replace />;

  return (
    <CourseDetails
      courseId={courseId}
      isLoggedIn={!!user}
      onBack={() => navigate('/dashboard/home')}
      onSelectLesson={(lessonId, _title, _type, isFree) => {
        if (!user && !isFree) {
          navigate('/login');
          return;
        }
        navigate(`/courses/${courseId}/${lessonId}`);
      }}
    />
  );
};

/** Wraps LessonPlayer with route params */
/** Wraps LessonPlayer with route params */
const LessonPlayerWrapper: React.FC = () => {
  const { courseId, lessonId } = useParams<{ courseId: string; lessonId: string }>();
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const [lessonData, setLessonData] = useState<{ title: string; type: 'video' | 'pdf'; isFree: boolean }>({
    title: '',
    type: 'video',
    isFree: false
  });

  // Load lesson title from API on mount
  React.useEffect(() => {
    if (!lessonId) return;
    // Try getting lesson details from course data or playback
    ApiService.getCourseDetails(courseId || '').then(res => {
      const foundLesson = res.units?.flatMap((u: any) => u.lessons || []).find((l: any) => l.id === lessonId);
      if (foundLesson) {
        const isFree = foundLesson.is_free_preview === 1 || res.course?.is_free === 1 || res.is_free === 1;
        setLessonData({ title: foundLesson.title || '', type: foundLesson.type || 'video', isFree });
      }
    }).catch(() => {});
  }, [lessonId, courseId]);

  // Auth checking once auth loading completes
  React.useEffect(() => {
    if (loading) return;
    // If the lesson data is loaded and it's NOT free, and the user is NOT logged in, redirect to login
    if (lessonData.title && !lessonData.isFree && !user) {
      navigate('/login');
    }
  }, [user, loading, lessonData, navigate]);

  if (!lessonId) return <Navigate to={courseId ? `/courses/${courseId}` : '/'} replace />;

  return (
    <LessonPlayer
      lessonId={lessonId}
      lessonTitle={lessonData.title}
      onBack={() => navigate(courseId ? `/courses/${courseId}` : '/dashboard/home')}
      onHome={() => navigate('/dashboard/home')}
      onSelectLesson={(id, title, type) => {
        setLessonData({ title, type, isFree: false }); // Reset until loaded
        // Replace (not push) so browsing lessons inside the player doesn't stack
        // history entries — the browser back button then exits the player directly
        // instead of stepping through every previously opened lesson.
        navigate(`/courses/${courseId}/${id}`, { replace: true });
      }}
    />
  );
};

/** Dashboard route: renders the single Home.tsx tab structure with guest-mode rules */
const DashboardRoute: React.FC = () => {
  const { tab } = useParams<{ tab: string }>();
  const { user, needsProfileSetup, loading } = useAuth();
  const navigate = useNavigate();

  if (loading) {
    return <Loader text="جاري التحميل..." size="large" fullscreen={true} />;
  }

  if (needsProfileSetup) {
    return <LoginRegister />;
  }

  const activeTab = tab || 'home';
  const isProtectedTab = ['my-courses', 'exams', 'qa', 'profile'].includes(activeTab);

  if (isProtectedTab && !user) {
    return <Navigate to="/login" replace />;
  }

  return (
    <Home
      onSelectCourse={(courseId) => navigate(`/courses/${courseId}`)}
      onSelectLesson={(lessonId, _title, _type, isFree, courseId) => {
        if (!user && !isFree) {
          navigate('/login');
          return;
        }
        navigate(`/courses/${courseId || 'unknown'}/${lessonId}`);
      }}
      onShowAuth={() => navigate('/login')}
    />
  );
};

function App() {
  return (
    <Suspense fallback={<RouteFallback />}>
      <Routes>
        {/* ── Public Routes ── */}
        <Route path="/login" element={<LoginRegister />} />
        <Route path="/landing" element={<LandingPageRoute />} />
        <Route path="/" element={<HomeRoute />} />

        {/* Course details (publicly accessible, internally protected) */}
        <Route path="/courses/:courseId" element={
          <div style={{ minHeight: '100vh', backgroundColor: 'rgb(var(--background))', color: 'rgb(var(--on-background))' }}>
            <div className="layout-container" style={{ padding: '40px 16px' }}>
              <CourseDetailsWrapper />
            </div>
          </div>
        } />

        {/* Lesson player (publicly accessible, internally protected) */}
        <Route path="/courses/:courseId/:lessonId" element={
          <div style={{ minHeight: '100vh', backgroundColor: 'rgb(var(--background))', color: 'rgb(var(--on-background))' }}>
            <LessonPlayerWrapper />
          </div>
        } />

        {/* ── Dashboard Routing (internal auth checking in wrapper) ── */}
        <Route path="/dashboard/:tab" element={<DashboardRoute />} />
        <Route path="/dashboard" element={<Navigate to="/dashboard/home" replace />} />

        {/* ── Catch All ── */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );
}

export default App;

