import { useEffect, useRef, useState } from 'react';
import { ApiService } from '../../services/api';

/**
 * Module-level cache (outside the hook/component) so switching tabs — which keeps
 * the Home component mounted since it's the same route — never refetches data that
 * was already loaded during this session.
 */
let cachedHomeData: {
  courses: any[] | null;
  myCourses: any[] | null;
  questions: any[] | null;
  financials: any[] | null;
  devices: any[] | null;
  quizzes: any[] | null;
  playbackLogs: any[] | null;
  resetRequests: any[] | null;
  exams: any[] | null;
  stats: any | null;
  enrolledCoursesDetails: any[] | null;
} = {
  courses: null,
  myCourses: null,
  questions: null,
  financials: null,
  devices: null,
  quizzes: null,
  playbackLogs: null,
  resetRequests: null,
  exams: null,
  stats: null,
  enrolledCoursesDetails: null,
};

/**
 * Shared data-loading hook for the Home page: courses, enrollment, financials,
 * devices, quiz attempts, playback logs, device reset requests, exams and stats.
 * Owns `loadData` / `loadCourses` plus the module-level cache described above.
 *
 * `fetchNotificationsList` is injected so this hook can kick off a non-blocking
 * notifications refresh at the exact same point the original inline code did,
 * without owning the notifications feature itself.
 */
export function useHomeData(profile: any | null, fetchNotificationsList: () => void) {
  const [courses, setCourses] = useState<any[]>(cachedHomeData.courses || []);
  const [myCourses, setMyCourses] = useState<any[]>(cachedHomeData.myCourses || []);
  const [questions, setQuestions] = useState<any[]>(cachedHomeData.questions || []);
  const [financials, setFinancials] = useState<any[]>(cachedHomeData.financials || []);
  const [devices, setDevices] = useState<any[]>(cachedHomeData.devices || []);
  const [quizzes, setQuizzes] = useState<any[]>(cachedHomeData.quizzes || []);
  const [playbackLogs, setPlaybackLogs] = useState<any[]>(cachedHomeData.playbackLogs || []);
  const [resetRequests, setResetRequests] = useState<any[]>(cachedHomeData.resetRequests || []);
  const [enrolledCoursesDetails, setEnrolledCoursesDetails] = useState<any[]>(cachedHomeData.enrolledCoursesDetails || []);

  const [exams, setExams] = useState<any[]>(cachedHomeData.exams || []);

  const [stats, setStats] = useState(cachedHomeData.stats || {
    coursesCount: 0,
    quizzesCount: 0,
    questionsCount: 0,
  });

  const [loading, setLoading] = useState(() => !cachedHomeData.courses);
  const [loadError, setLoadError] = useState(false);
  const [gradeFilter, setGradeFilter] = useState('');

  // Clear cached protected data on logout so the next account on this
  // device never sees the previous student's data
  useEffect(() => {
    if (!profile) {
      cachedHomeData.myCourses = null;
      cachedHomeData.questions = null;
      cachedHomeData.financials = null;
      cachedHomeData.devices = null;
      cachedHomeData.quizzes = null;
      cachedHomeData.playbackLogs = null;
      cachedHomeData.resetRequests = null;
      cachedHomeData.exams = null;
      cachedHomeData.stats = null;
      cachedHomeData.enrolledCoursesDetails = null;
      setMyCourses([]);
      setQuestions([]);
      setFinancials([]);
      setDevices([]);
      setQuizzes([]);
      setPlaybackLogs([]);
      setResetRequests([]);
      setExams([]);
      setEnrolledCoursesDetails([]);
      setStats({ coursesCount: 0, quizzesCount: 0, questionsCount: 0 });
    }
  }, [profile]);

  const loadCourses = async () => {
    const coursesRes = await ApiService.getCourses(1, gradeFilter || undefined);
    const coursesList = coursesRes.courses || [];
    setCourses(coursesList);
    cachedHomeData.courses = coursesList;
    return coursesList;
  };

  // Profile-tab data (financials / devices / reset requests) is only fetched
  // when the student actually opens that tab — not on every page load.
  const loadProfileData = async (force = false) => {
    if (!profile) return;
    if (!force && cachedHomeData.financials && cachedHomeData.devices && cachedHomeData.resetRequests) return;
    try {
      const [finRes, devRes, resetRes] = await Promise.all([
        ApiService.getMyFinancials().catch(() => ({ financials: [] })),
        ApiService.getMyDevices().catch(() => ({ devices: [] })),
        ApiService.getMyDeviceResetRequests().catch(() => ({ reset_requests: [] })),
      ]);
      const financialsList = finRes.financials || [];
      setFinancials(financialsList);
      cachedHomeData.financials = financialsList;

      const devicesList = devRes.devices || [];
      setDevices(devicesList);
      cachedHomeData.devices = devicesList;

      const resetRequestsList = resetRes.reset_requests || [];
      setResetRequests(resetRequestsList);
      cachedHomeData.resetRequests = resetRequestsList;
    } catch (err) {
      console.error('Error loading profile tab data:', err);
    }
  };

  // Exams are fetched on first open of the exams tab (HomeTab also shows a
  // small exams teaser, so this is additionally triggered there when needed).
  const loadExamsData = async (force = false) => {
    if (!profile) return;
    if (!force && cachedHomeData.exams) return;
    try {
      const examsRes = await ApiService.getExams().catch(() => ({ exams: [] }));
      const examsList = examsRes.exams || [];
      setExams(examsList);
      cachedHomeData.exams = examsList;
    } catch (err) {
      console.error('Error loading exams data:', err);
    }
  };

  const loadData = async () => {
    const hasCache = !!cachedHomeData.courses;
    if (!hasCache) {
      setLoading(true);
    }
    setLoadError(false);
    try {
      // Public courses and (for logged-in students) the profile-dependent
      // batch used to run sequentially — courses awaited first, only then
      // starting the 4-request batch. Firing them together in one Promise.all
      // shaves that wait off first render since neither depends on the other.
      const requests: Promise<any>[] = [loadCourses()];
      if (profile) {
        requests.push(
          ApiService.getMyCourses(),
          ApiService.getQuestions().catch(() => ({ questions: [] })),
          ApiService.getMyQuizAttempts().catch(() => ({ quiz_attempts: [] })),
          ApiService.getMyPlaybackLogs().catch(() => ({ playback_logs: [] })),
        );
      }
      const [coursesList, myCoursesRes, questionsRes, quizRes, logsRes] = await Promise.all(requests);

      // Load only what the home tab and sidebar stats need — profile-tab data
      // (financials/devices/reset requests) and exams are deferred to their tabs.
      if (profile) {
        const myCoursesList = myCoursesRes.courses || [];
        setMyCourses(myCoursesList);
        cachedHomeData.myCourses = myCoursesList;

        const questionsList = questionsRes.questions || [];
        setQuestions(questionsList);
        cachedHomeData.questions = questionsList;

        const quizzesList = quizRes.quiz_attempts || [];
        setQuizzes(quizzesList);
        cachedHomeData.quizzes = quizzesList;

        const playbackLogsList = logsRes.playback_logs || [];
        setPlaybackLogs(playbackLogsList);
        cachedHomeData.playbackLogs = playbackLogsList;

        const currentStats = {
          coursesCount: myCoursesList.length,
          quizzesCount: quizzesList.length,
          questionsCount: questionsList.length,
        };
        setStats(currentStats);
        cachedHomeData.stats = currentStats;

        // Non-blocking: notifications + course details for the progress tracker
        fetchNotificationsList();

        const allEnrolledIds = Array.from(new Set([
          ...myCoursesList.map((c: any) => c.id),
          ...coursesList.filter((c: any) => c.is_free).map((c: any) => c.id)
        ]));
        Promise.all(allEnrolledIds.map((id: any) => ApiService.getCourseDetails(id).catch(() => null)))
          .then(detailsResults => {
            // Keep the course fields AND a flattened lessons array — the progress
            // tracker needs per-lesson is_completed/duration, which live under
            // res.units[].lessons in the API response (res.course alone has none).
            const validDetails = detailsResults.filter(Boolean).map((res: any) => ({
              ...res.course,
              lessons: (res.units || []).flatMap((u: any) => u.lessons || []),
            }));
            setEnrolledCoursesDetails(validDetails);
            cachedHomeData.enrolledCoursesDetails = validDetails;
          })
          .catch(err => console.error('Error loading enrolled courses details for progress tracker:', err));
      }
    } catch (err) {
      console.error('Error loading homepage data:', err);
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  };

  // Full load on mount / when auth state changes
  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.id]);

  // Grade filter change only refetches the public course list
  const gradeFilterInitialized = useRef(false);
  useEffect(() => {
    if (!gradeFilterInitialized.current) {
      gradeFilterInitialized.current = true;
      return;
    }
    loadCourses().catch(err => {
      console.error('Error loading filtered courses:', err);
      setLoadError(true);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gradeFilter]);

  return {
    courses,
    myCourses,
    questions,
    financials,
    devices,
    quizzes,
    playbackLogs,
    resetRequests,
    enrolledCoursesDetails,
    exams,
    stats,
    loading,
    setLoading,
    loadError,
    gradeFilter,
    setGradeFilter,
    loadData,
    loadCourses,
    loadProfileData,
    loadExamsData,
  };
}
