import { useEffect, useState } from 'react';
import type { FC } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { useToast } from '../context/ToastContext';

import { EnableNotificationsPrompt } from './home/EnableNotificationsPrompt';
import { GuidedTour, type TourStep } from '../components/GuidedTour';
import { Sidebar } from './home/Sidebar';
import { MobileHeader, MobileBottomNav } from './home/MobileNav';
import { TopHeader } from './home/TopHeader';
import { Footer } from './home/Footer';

import { HomeTab } from './home/tabs/HomeTab';
import { ExploreTab } from './home/tabs/ExploreTab';
import { MyCoursesTab } from './home/tabs/MyCoursesTab';
import { ExamsTab } from './home/tabs/ExamsTab';
import { QaTab } from './home/tabs/QaTab';
import { ProfileTab } from './home/tabs/ProfileTab';

import { AskQuestionModal } from './home/modals/AskQuestionModal';
import { QuestionDetailsModal } from './home/modals/QuestionDetailsModal';
import { RedeemCodeModal } from './home/modals/RedeemCodeModal';
import { NotificationsModal } from './home/modals/NotificationsModal';
import { ExamModal } from './home/modals/ExamModal';
import { ConfirmDialog } from './home/modals/ConfirmDialog';

import { useHomeData } from './home/useHomeData';
import { useNotifications } from './home/useNotifications';
import { useExamFlow } from './home/useExamFlow';
import { useQaFlow } from './home/useQaFlow';
import { useRedeemFlow } from './home/useRedeemFlow';
import { useProfileForm } from './home/useProfileForm';
import type { ConfirmDialogState, HomeProps, TabId } from './home/types';

const HOME_TOUR_STEPS: TourStep[] = [
  { selector: '[data-tour="tour-notif-bell"]', title: 'الإشعارات', text: 'من هنا توصلك كل الإشعارات والتنبيهات الجديدة الخاصة بمقرراتك وامتحاناتك.' },
  { selector: '[data-tour="tour-nav-home"]', title: 'الرئيسية', text: 'صفحتك الرئيسية: أهم المقررات، ومتابعة سريعة لما تبقّى لك لإكماله.' },
  { selector: '[data-tour="tour-nav-explore"]', title: 'كورسات المنصة', text: 'تصفح كل المقررات الدراسية المتاحة على المنصة ومعرفة تفاصيلها.' },
  { selector: '[data-tour="tour-nav-my-courses"]', title: 'الكورسات المشترك بها', text: 'هنا تجد المقررات التي فعّلتها ومتابعة تقدمك في كل درس.' },
  { selector: '[data-tour="tour-nav-exams"]', title: 'الامتحانات', text: 'حل الامتحانات والواجبات الدورية وشاهد نتائجك فور التسليم.' },
  { selector: '[data-tour="tour-nav-qa"]', title: 'ابعت سؤالك', text: 'اطرح سؤالك هنا وسيتم الرد عليك من فريق الدعم الأكاديمي.' },
  { selector: '[data-tour="tour-nav-profile"]', title: 'ملفي الشخصي', text: 'بياناتك، الأجهزة المربوطة، وسجل عملياتك المالية ودرجاتك كلها من هنا.' },
  { selector: '[data-tour="tour-stats"]', title: 'إحصائياتي', text: 'ملخص سريع لعدد مقرراتك المفعّلة والامتحانات التي حللتها وأسئلتك المطروحة.' },
];

export const Home: FC<HomeProps> = ({ onSelectCourse, onShowAuth, onSelectLesson }) => {
  const { profile, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();

  // Params and routing for tabs
  const { tab } = useParams<{ tab: string }>();
  const navigate = useNavigate();
  const activeTab = (tab as TabId) || 'home';

  const { showToast } = useToast();

  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  // Online/Offline status
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Custom confirmation dialog state, shared by the exam flow and profile/device handlers
  const [confirmDialog, setConfirmDialog] = useState<ConfirmDialogState | null>(null);

  // Explore tab search text lives here (not inside ExploreTab) so it survives tab switches,
  // since Home never unmounts between tabs (only the `:tab` route param changes).
  const [searchQuery, setSearchQuery] = useState('');

  // Dynamic page title per tab
  useEffect(() => {
    const titles: Record<string, string> = {
      home: 'الرئيسية',
      explore: 'كورسات المنصة',
      'my-courses': 'الكورسات المشترك بها',
      exams: 'الامتحانات',
      qa: 'ابعت سؤالك',
      profile: 'ملفي الشخصي',
    };
    document.title = `${titles[activeTab] || 'الرئيسية'} | الهضبة`;
  }, [activeTab]);

  const {
    notifications,
    unreadCount,
    showNotificationsModal,
    setShowNotificationsModal,
    fetchNotificationsList,
    markNotificationAsRead,
  } = useNotifications(profile);

  const {
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
    loadProfileData,
    loadExamsData,
  } = useHomeData(profile, fetchNotificationsList);

  // Deferred per-tab data: financials/devices/reset-requests and exams are only
  // fetched the first time their tab is opened (cached afterwards).
  useEffect(() => {
    if (activeTab === 'profile') loadProfileData();
    if (activeTab === 'exams') loadExamsData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, profile?.id]);

  // Exams are deferred/cached — anything that needs fresh exam scores (manual
  // refresh, post-submission reload) must force-refetch them alongside the rest.
  const refreshWithExams = async () => {
    await Promise.all([loadData(), loadExamsData(true)]);
  };

  const {
    selectedExam,
    examQuestions,
    examAttempt,
    examAnswers,
    setExamAnswers,
    showExamModal,
    submittingExam,
    handleOpenExam,
    handleCloseExamModal,
    handleSubmitExam,
    handleManualSubmitExam,
  } = useExamFlow(showToast, refreshWithExams, setConfirmDialog, setLoading);

  const {
    qaSearch,
    setQaSearch,
    qaFilter,
    setQaFilter,
    filteredQuestions,
    showAskModal,
    setShowAskModal,
    questionBody,
    setQuestionBody,
    selectedQuestion,
    setSelectedQuestion,
    handleAskQuestion,
    handleOpenQuestionDetails,
  } = useQaFlow(questions, loadData, showToast);

  const {
    redeemCode,
    setRedeemCode,
    showRedeemModal,
    setShowRedeemModal,
    redeeming,
    selectedCourseForRedeem,
    setSelectedCourseForRedeem,
    handleRedeemSubmit,
  } = useRedeemFlow(refreshWithExams, showToast);

  const {
    editName, setEditName,
    editPhone, setEditPhone,
    editParentPhone, setEditParentPhone,
    editGov, setEditGov,
    editGrade, setEditGrade,
    editBranch, setEditBranch,
    academicYears,
    getFilteredBranches,
    updatingProfile,
    handleUpdateProfile,
    avatarUrl,
    isUploadingAvatar,
    handleAvatarChange,
    handleUnbindDevice,
  } = useProfileForm(profile, loadData, showToast, setConfirmDialog);

  // Filtered suggested courses (shared by the Home and Explore tabs)
  const enrolledIds = new Set([
    ...myCourses.map(c => c.id),
    ...courses.filter(c => c.is_free).map(c => c.id)
  ]);
  const trackedCourses = courses.filter(c => enrolledIds.has(c.id));

  const handleTabClick = (tab: TabId) => {
    if (tab === 'home' || tab === 'explore') {
      navigate(`/dashboard/${tab}`);
    } else {
      if (!profile) {
        showToast('warning', 'تنبيه', 'يرجى تسجيل الدخول أولاً للوصول إلى هذا القسم.');
        onShowAuth?.();
      } else {
        navigate(`/dashboard/${tab}`);
      }
    }
  };

  const closeRedeemModal = () => {
    setShowRedeemModal(false);
    setRedeemCode('');
    setSelectedCourseForRedeem(null);
  };

  return (
    <div className="home-layout-container" style={{ direction: 'rtl', display: 'flex', height: '100vh', overflow: 'hidden' }}>

      {/* ── Sidebar (Right Side in RTL) ── */}
      <Sidebar
        profile={profile}
        isSidebarCollapsed={isSidebarCollapsed}
        setIsSidebarCollapsed={setIsSidebarCollapsed}
        activeTab={activeTab}
        handleTabClick={handleTabClick}
        stats={stats}
        avatarUrl={avatarUrl}
        unreadCount={unreadCount}
        setShowNotificationsModal={setShowNotificationsModal}
        theme={theme}
        toggleTheme={toggleTheme}
        logout={logout}
        onShowAuth={onShowAuth}
      />

      {/* First-login walkthrough of the sidebar/home interface — shown once per account */}
      <GuidedTour steps={HOME_TOUR_STEPS} storageKey="home_tour_seen_v3" persistence="local" active={!!profile} />

      {/* ── Main Content Area ── */}
      <main className="chemistry-matrix-bg" style={{ flex: 1, backgroundColor: 'rgb(var(--background))', overflowY: 'auto', padding: 'var(--main-pad)', height: '100%' }}>

        {/* Offline Banner Indicator */}
        {!isOnline && (
          <div
            style={{
              backgroundColor: 'rgb(var(--error))',
              color: '#fff',
              padding: '12px 24px',
              textAlign: 'center',
              borderRadius: '12px',
              marginBottom: '20px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '10px',
              fontFamily: 'Cairo, sans-serif',
              fontWeight: 'bold',
              boxShadow: '0 4px 15px rgba(239, 68, 68, 0.3)',
              direction: 'rtl'
            }}
          >
            <span className="material-symbols-outlined">wifi_off</span>
            <span>أنت تتصفح المنصة دون اتصال بالإنترنت حالياً. قد لا تكون بعض المميزات متاحة.</span>
          </div>
        )}

        {/* Post-login "enable notifications" nudge — discoverable, dismissible, best-effort */}
        <EnableNotificationsPrompt profile={profile} />

        {/* Desktop Top Header Banner (Only visible on larger screens) */}
        <TopHeader
          activeTab={activeTab}
          profile={profile}
          unreadCount={unreadCount}
          setShowNotificationsModal={setShowNotificationsModal}
        />

        {/* Mobile Header Banner (Alternative Navigation for small screens) */}
        <MobileHeader
          profile={profile}
          logout={logout}
          theme={theme}
          toggleTheme={toggleTheme}
          unreadCount={unreadCount}
          setShowNotificationsModal={setShowNotificationsModal}
        />

        {/* Loading Indicator */}
        {loading && (
          <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '3px', zIndex: 100 }}>
            <div className="shimmer-loading" style={{ height: '100%' }}></div>
          </div>
        )}

        {/* ── TAB 1: HOME TAB ── */}
        {activeTab === 'home' && (
          <HomeTab
            loading={loading}
            loadError={loadError}
            courses={courses}
            exams={exams}
            loadData={loadData}
            profile={profile}
            enrolledIds={enrolledIds}
            trackedCourses={trackedCourses}
            enrolledCoursesDetails={enrolledCoursesDetails}
            playbackLogs={playbackLogs}
            onSelectCourse={onSelectCourse}
            onSelectLesson={onSelectLesson}
            onShowAuth={onShowAuth}
            showToast={showToast}
            setSelectedCourseForRedeem={setSelectedCourseForRedeem}
            setShowRedeemModal={setShowRedeemModal}
            handleTabClick={handleTabClick}
          />
        )}

        {/* ── TAB 2: EXPLORE TAB ── */}
        {activeTab === 'explore' && (
          <ExploreTab
            loading={loading}
            loadError={loadError}
            courses={courses}
            loadData={loadData}
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
            gradeFilter={gradeFilter}
            setGradeFilter={setGradeFilter}
            academicYears={academicYears}
            enrolledIds={enrolledIds}
            onSelectCourse={onSelectCourse}
            profile={profile}
            onShowAuth={onShowAuth}
            showToast={showToast}
            setSelectedCourseForRedeem={setSelectedCourseForRedeem}
            setShowRedeemModal={setShowRedeemModal}
          />
        )}

        {/* ── TAB 3: MY COURSES TAB ── */}
        {activeTab === 'my-courses' && (
          <MyCoursesTab
            loading={loading}
            loadError={loadError}
            myCourses={myCourses}
            loadData={loadData}
            onSelectCourse={onSelectCourse}
            setShowRedeemModal={setShowRedeemModal}
          />
        )}

        {/* ── TAB 6: EXAMS TAB ── */}
        {activeTab === 'exams' && (
          <ExamsTab
            loading={loading}
            loadError={loadError}
            exams={exams}
            loadData={refreshWithExams}
            handleOpenExam={handleOpenExam}
          />
        )}

        {/* ── TAB 4: Q&A TAB ── */}
        {activeTab === 'qa' && (
          <QaTab
            loading={loading}
            loadError={loadError}
            questions={questions}
            filteredQuestions={filteredQuestions}
            loadData={loadData}
            qaSearch={qaSearch}
            setQaSearch={setQaSearch}
            qaFilter={qaFilter}
            setQaFilter={setQaFilter}
            setShowAskModal={setShowAskModal}
            handleOpenQuestionDetails={handleOpenQuestionDetails}
          />
        )}

        {/* ── TAB 5: PROFILE TAB ── */}
        {activeTab === 'profile' && (
          <ProfileTab
            loading={loading}
            profile={profile}
            avatarUrl={avatarUrl}
            handleAvatarChange={handleAvatarChange}
            isUploadingAvatar={isUploadingAvatar}
            stats={stats}
            editName={editName} setEditName={setEditName}
            editPhone={editPhone} setEditPhone={setEditPhone}
            editParentPhone={editParentPhone} setEditParentPhone={setEditParentPhone}
            editGov={editGov} setEditGov={setEditGov}
            editGrade={editGrade} setEditGrade={setEditGrade}
            editBranch={editBranch} setEditBranch={setEditBranch}
            academicYears={academicYears}
            getFilteredBranches={getFilteredBranches}
            handleUpdateProfile={handleUpdateProfile}
            updatingProfile={updatingProfile}
            devices={devices}
            handleUnbindDevice={handleUnbindDevice}
            resetRequests={resetRequests}
            financials={financials}
            quizzes={quizzes}
            playbackLogs={playbackLogs}
          />
        )}

        {/* ── Premium Platform Footer ── */}
        <Footer />
      </main>

      {/* ── Ask a Question Modal ── */}
      {showAskModal && (
        <AskQuestionModal
          questionBody={questionBody}
          setQuestionBody={setQuestionBody}
          handleAskQuestion={handleAskQuestion}
          onClose={() => setShowAskModal(false)}
        />
      )}

      {/* ── Question Details Modal ── */}
      {selectedQuestion && (
        <QuestionDetailsModal
          selectedQuestion={selectedQuestion}
          onClose={() => setSelectedQuestion(null)}
        />
      )}

      {/* ── Redeem Code Modal ── */}
      {showRedeemModal && (
        <RedeemCodeModal
          redeemCode={redeemCode}
          setRedeemCode={setRedeemCode}
          redeeming={redeeming}
          selectedCourseForRedeem={selectedCourseForRedeem}
          handleRedeemSubmit={handleRedeemSubmit}
          onClose={closeRedeemModal}
        />
      )}

      {/* ── Notifications Modal ── */}
      {showNotificationsModal && (
        <NotificationsModal
          notifications={notifications}
          markNotificationAsRead={markNotificationAsRead}
          onClose={() => setShowNotificationsModal(false)}
        />
      )}

      {/* ── Standalone Exam Solver Modal ── */}
      {showExamModal && selectedExam && (
        <ExamModal
          selectedExam={selectedExam}
          examQuestions={examQuestions}
          examAttempt={examAttempt}
          examAnswers={examAnswers}
          setExamAnswers={setExamAnswers}
          submittingExam={submittingExam}
          onClose={handleCloseExamModal}
          onManualSubmit={handleManualSubmitExam}
          onTimeout={() => handleSubmitExam(true)}
        />
      )}

      {/* ── Custom Confirmation Dialog Modal ── */}
      <ConfirmDialog confirmDialog={confirmDialog} onCancel={() => setConfirmDialog(null)} />

      {/* ── Mobile Bottom Navigation Bar ── */}
      <MobileBottomNav activeTab={activeTab} handleTabClick={handleTabClick} />
    </div>
  );
};

export default Home;
