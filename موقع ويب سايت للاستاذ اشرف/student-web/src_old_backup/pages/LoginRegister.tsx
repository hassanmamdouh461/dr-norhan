import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { ApiService, getDeviceId } from '../services/api';
import { forgotPassword } from '../services/auth';
import { useTheme } from '../context/ThemeContext';
import teacherPortrait from '../assets/teacher_portrait.webp';
import { ZoomableImage } from '../components/ZoomableImage';
import { optimizedCoverUrl } from '../utils/img';







const governorates = [
  'القاهرة', 'الجيزة', 'الإسكندرية', 'القليوبية', 'الدقهلية',
  'الشرقية', 'المنوفية', 'الغربية', 'البحيرة', 'دمياط',
  'كفر الشيخ', 'الفيوم', 'بني سويف', 'المنيا',
  'أسيوط', 'سوهاج', 'قنا', 'الأقصر', 'أسوان', 'البحر الأحمر',
  'الوادي الجديد', 'مطروح', 'شمال سيناء', 'جنوب سيناء', 'السويس', 'الإسماعيلية', 'بورسعيد'
];

interface LoginRegisterProps {
  onBrowseAsGuest?: () => void;
}

export const LoginRegister: React.FC<LoginRegisterProps> = ({ onBrowseAsGuest }) => {
  const { theme } = useTheme();
  const isDarkMode = theme === 'dark';
  const {
    user,
    login,
    register,
    completeProfileSetup,
    needsProfileSetup,
    error,
    clearError
  } = useAuth();

  const themeBg = isDarkMode ? 'rgb(var(--fusha-teal-900))' : 'rgb(var(--fusha-canvas-light))';
  const themeText = isDarkMode ? '#fff' : 'rgb(var(--fusha-teal-900))';
  const borderLight = isDarkMode ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.08)';
  const cardBg = isDarkMode ? 'rgba(20, 21, 28, 0.45)' : 'rgba(255, 255, 255, 0.85)';
  const cardBorder = isDarkMode ? '1px solid rgba(255, 255, 255, 0.06)' : '1px solid rgba(52, 211, 153, 0.15)';
  const secondaryText = isDarkMode ? 'rgb(var(--fusha-sand-300))' : 'rgb(var(--fusha-teal-500))';
  const inputBorderDefault = isDarkMode ? 'rgba(255, 255, 255, 0.15)' : 'rgba(52, 211, 153, 0.2)';
  const inputBgColor = isDarkMode ? 'transparent' : 'rgb(var(--fusha-white))';
  const inputTextColor = isDarkMode ? 'rgb(var(--fusha-white))' : 'rgb(var(--fusha-teal-900))';

  const navigate = useNavigate();
  const location = useLocation();

  const [publicCourses, setPublicCourses] = useState<any[]>([]);
  const [loadingCourses, setLoadingCourses] = useState<boolean>(true);
  const [publicExams, setPublicExams] = useState<any[]>([]);
  const [loadingExams, setLoadingExams] = useState<boolean>(true);

  const [activePublicExamId, setActivePublicExamId] = useState<string | null>(null);
  const [publicExamData, setPublicExamData] = useState<any | null>(null);
  const [publicExamAnswers, setPublicExamAnswers] = useState<Record<string, string>>({});
  const [publicExamResult, setPublicExamResult] = useState<any | null>(null);
  const [loadingPublicExam, setLoadingPublicExam] = useState<boolean>(false);
  const [submittingPublicExam, setSubmittingPublicExam] = useState<boolean>(false);
  const [publicExamError, setPublicExamError] = useState<string | null>(null);

  const handleOpenPublicExam = async (examId: string) => {
    setLoadingPublicExam(true);
    setPublicExamError(null);
    setPublicExamAnswers({});
    setPublicExamResult(null);
    setActivePublicExamId(examId);
    try {
      const res = await ApiService.getPublicExamDetails(examId);
      setPublicExamData(res);
    } catch (err: any) {
      setPublicExamError(err.message || 'فشل تحميل بيانات الامتحان');
    } finally {
      setLoadingPublicExam(false);
    }
  };

  const handleClosePublicExam = () => {
    setActivePublicExamId(null);
    setPublicExamData(null);
    setPublicExamAnswers({});
    setPublicExamResult(null);
    setPublicExamError(null);
  };

  const handleSubmitPublicExam = async () => {
    if (!activePublicExamId) return;
    setSubmittingPublicExam(true);
    setPublicExamError(null);
    try {
      const res = await ApiService.submitPublicExamAnswers(activePublicExamId, publicExamAnswers);
      setPublicExamResult(res);
    } catch (err: any) {
      setPublicExamError(err.message || 'فشل تسليم الامتحان');
    } finally {
      setSubmittingPublicExam(false);
    }
  };

  useEffect(() => {
    const loadShowcaseData = async () => {
      try {
        const [coursesRes, examsRes] = await Promise.all([
          ApiService.getCourses(1),
          ApiService.getPublicExams()
        ]);
        if (coursesRes && coursesRes.courses) {
          setPublicCourses(coursesRes.courses.slice(0, 3));
        }
        if (examsRes && examsRes.exams) {
          setPublicExams(examsRes.exams.slice(0, 4));
        }
      } catch (err) {
        console.error("Failed to load showcase data:", err);
      } finally {
        setLoadingCourses(false);
        setLoadingExams(false);
      }
    };
    loadShowcaseData();
  }, []);

  const handleBrowseAsGuest = onBrowseAsGuest || (() => navigate('/dashboard/home'));

  useEffect(() => {
    if (user && !needsProfileSetup) {
      // إن وصل الطالب هنا عبر حارس ProtectedRoute، نُعيده إلى الصفحة التي
      // كان يقصدها بدل أن نهبط به على الرئيسية.
      const from = (location.state as { from?: string } | null)?.from;
      navigate(from && from !== '/login' ? from : '/dashboard/home', { replace: true });
    }
  }, [user, needsProfileSetup, navigate, location.state]);

  useEffect(() => {
    document.title = 'تسجيل الدخول | فُصْحَى';
    return () => {
      document.title = 'فُصْحَى | منصة الأستاذ أشرف سليم - اللغة العربية للثانوية العامة';
    };
  }, []);

  const [isSignUp, setIsSignUp] = useState(false);
  const [isForgotPassword, setIsForgotPassword] = useState(false);
  const [showDeviceResetDialog, setShowDeviceResetDialog] = useState(false);
  const [deviceResetReason, setDeviceResetReason] = useState('');
  const [deviceResetSuccess, setDeviceResetSuccess] = useState(false);
  const [deviceResetError, setDeviceResetError] = useState('');
  const [resetLoading, setResetLoading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);


  // Form Fields
  const [emailOrPhone, setEmailOrPhone] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [confirmPassword, setConfirmPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [parentPhone, setParentPhone] = useState('');
  const [selectedGender, setSelectedGender] = useState('ذكر');
  
  const [academicYears, setAcademicYears] = useState<string[]>([
    'الصف الأول الثانوي',
    'الصف الثاني الثانوي',
    'الصف الثالث الثانوي',
    'طلاب الـ IG',
  ]);
  const [branches, setBranches] = useState<string[]>([]);
  
  const [selectedGrade, setSelectedGrade] = useState('الصف الأول الثانوي');
  const [selectedSpec, setSelectedSpec] = useState('عام');
  const [selectedGov, setSelectedGov] = useState('القاهرة');

  useEffect(() => {
    const loadSettings = async () => {
      try {
        const res = await ApiService.getPublicSettings();
        if (res) {
          if (res.academic_years && res.academic_years.length > 0) {
            setAcademicYears(res.academic_years);
            setSelectedGrade(res.academic_years[0]);
            
            // Set initial spec based on loaded settings
            const firstGrade = res.academic_years[0];
            const initialSpecs = res.branches && res.branches.length > 0
              ? res.branches
              : (firstGrade === 'الصف الأول الثانوي' ? ['عام', 'أزهر'] : ['عام', 'أزهر', 'علمي', 'أدبي']);
            setSelectedSpec(initialSpecs[0]);
          }
          if (res.branches && res.branches.length > 0) {
            setBranches(res.branches);
          }
        }
      } catch (err) {
        console.error("Failed to load public settings in login page:", err);
      }
    };
    loadSettings();
  }, []);

  // Forgot password flow
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotSent, setForgotSent] = useState(false);

  const getSpecializations = (grade: string) => {
    let allowed: string[] = [];
    if (grade.includes('الأول')) {
      allowed = ['عام', 'أزهر'];
    } else if (grade.includes('الثاني')) {
      allowed = ['عام', 'أزهر', 'علمي', 'أدبي'];
    } else if (grade.includes('الثالث')) {
      allowed = ['عام', 'أزهر', 'علمي علوم', 'علمي رياضة', 'أدبي'];
    } else if (grade.includes('IG') || grade.toLowerCase().includes('ig')) {
      allowed = ['OL', 'AS', 'A-Level', 'علمي', 'أدبي'];
    } else {
      return branches && branches.length > 0 ? branches : ['عام'];
    }

    if (branches && branches.length > 0) {
      const filtered = branches.filter(b => allowed.includes(b));
      return filtered.length > 0 ? filtered : ['عام'];
    }

    return allowed;
  };

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    clearError();
    setLoading(true);

    try {
      if (!emailOrPhone || !password) {
        throw new Error('يرجى ملء جميع الحقول المطلوبة');
      }
      await login(emailOrPhone, password);
    } catch (err: any) {
      console.error(err);
      if (err.code === 'DEVICE_LIMIT_EXCEEDED' || (err.message && err.message.includes('الأجهزة'))) {
        setShowDeviceResetDialog(true);
      } else {
        setFormError(err.message || 'فشل تسجيل الدخول. يرجى مراجعة الحقول.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSignUpSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    clearError();
    setLoading(true);

    try {
      if (!fullName || !email || !phone || !parentPhone || !password || !confirmPassword) {
        throw new Error('يرجى ملء جميع الحقول المطلوبة');
      }
      if (!isEmailValid(email)) {
        throw new Error('يرجى إدخال بريد إلكتروني صحيح');
      }
      if (password !== confirmPassword) {
        throw new Error('كلمتا المرور غير متطابقتين');
      }
      if (phone.length < 10) {
        throw new Error('رقم الهاتف غير صالح');
      }
      if (parentPhone.length < 10) {
        throw new Error('رقم هاتف ولي الأمر غير صالح');
      }

      await register({
        phone,
        email: email.trim(),
        fullName,
        parentPhone,
        grade: selectedGrade,
        branch: selectedSpec,
        governorate: selectedGov,
        password,
      });
    } catch (err: any) {
      console.error(err);
      setFormError(err.message || 'فشل التسجيل. حاول مرة أخرى.');
    } finally {
      setLoading(false);
    }
  };

  const handleProfileSetupSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    clearError();
    setLoading(true);

    try {
      if (!fullName || !phone || !parentPhone) {
        throw new Error('يرجى ملء جميع الحقول المطلوبة');
      }
      await completeProfileSetup({
        fullName,
        phone,
        parentPhone,
        grade: selectedGrade,
        branch: selectedSpec,
        governorate: selectedGov,
      });
    } catch (err: any) {
      console.error(err);
      setFormError(err.message || 'فشل إكمال إعداد الملف الشخصي.');
    } finally {
      setLoading(false);
    }
  };

  const handleDeviceResetSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setResetLoading(true);
    setDeviceResetError('');
    try {
      if (deviceResetReason.trim().length < 5) {
        throw new Error('يرجى كتابة سبب صحيح (5 أحرف على الأقل)');
      }

      await ApiService.submitDeviceResetRequest({
        device_id: getDeviceId(),
        platform: 'web',
        model: navigator.userAgent.substring(0, 50),
        reason: deviceResetReason,
      });

      setDeviceResetSuccess(true);
    } catch (err: any) {
      console.error(err);
      setDeviceResetError(err.message || 'فشل إرسال طلب إعادة التعيين');
    } finally {
      setResetLoading(false);
    }
  };

  const handleForgotPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const identifier = forgotEmail.trim();

      // /auth/forgot-password يستقبل بريداً فقط — لا يوجد استعادة برقم الهاتف.
      if (!identifier || !identifier.includes('@')) {
        throw new Error('يرجى إدخال البريد الإلكتروني المسجَّل على الحساب لاستعادة كلمة المرور.');
      }

      await forgotPassword(identifier);
      setForgotSent(true);
    } catch (err: any) {
      console.error(err);
      setFormError(err.message || 'تعذر إرسال رابط استعادة كلمة المرور');
    } finally {
      setLoading(false);
    }
  };

  // Validation helpers
  const isPhoneValid = (num: string) => /^01[0125][0-9]{8}$/.test(num);
  const isParentPhoneValid = (num: string) => /^01[0125][0-9]{8}$/.test(num) && num !== phone;
  // الحد الأدنى 8 رموز — مطابق لـ registerSchema في backend/src/routes/auth.ts.
  // أي تخفيف هنا يُنتج 400 VALIDATION_ERROR من الخادم بلا رسالة مفهومة للطالب.
  const isPasswordValid = (pw: string) => pw.length >= 8;
  const isConfirmPasswordValid = (cpw: string) => cpw === password && cpw.length >= 8;
  const isFullNameValid = (name: string) => name.trim().split(' ').filter(Boolean).length >= 3;
  const isEmailValid = (mail: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(mail.trim());

  const activeError = formError || error;

  if (needsProfileSetup) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-md" style={{ direction: 'rtl' }}>
        <div className="card card-glass w-full" style={{ maxWidth: '500px' }}>
          <h2 className="title-medium text-center" style={{ marginBottom: '16px', color: 'rgb(var(--primary))' }}>إكمال إعداد حساب الطالب</h2>
          <p className="body-small text-center" style={{ marginBottom: '24px' }}>يرجى ملء البيانات التالية لتفعيل حسابك على المنصة بنجاح.</p>
          
          {activeError && (
            <div className="badge badge-danger w-full justify-center" style={{ padding: '12px', marginBottom: '16px' }}>
              {activeError}
            </div>
          )}

          <form onSubmit={handleProfileSetupSubmit} className="flex flex-col">
            <div className="form-group">
              <label className="form-label">الاسم بالكامل</label>
              <div className="input-container">
                <input
                  type="text"
                  className="input-text"
                  placeholder="أدخل اسمك الحقيقي بالكامل"
                  value={fullName}
                  onChange={e => setFullName(e.target.value)}
                  required
                />
                <span className="icon input-icon-right">person</span>
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">رقم الهاتف (الخاص بك)</label>
              <div className="input-container">
                <input
                  type="tel"
                  className="input-text"
                  placeholder="رقم الموبايل الشخصي"
                  value={phone}
                  onChange={e => setPhone(e.target.value)}
                  required
                />
                <span className="icon input-icon-right">phone_iphone</span>
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">رقم هاتف ولي الأمر</label>
              <div className="input-container">
                <input
                  type="tel"
                  className="input-text"
                  placeholder="رقم موبايل ولي الأمر للطوارئ"
                  value={parentPhone}
                  onChange={e => setParentPhone(e.target.value)}
                  required
                />
                <span className="icon input-icon-right">family_restroom</span>
              </div>
            </div>

            <div className="grid-2 gap-md" style={{ marginBottom: '16px' }}>
              <div className="form-group">
                <label className="form-label">الصف الدراسي</label>
                <select
                  className="select"
                  value={selectedGrade}
                  onChange={e => {
                    setSelectedGrade(e.target.value);
                    const specs = getSpecializations(e.target.value);
                    setSelectedSpec(specs[0]);
                  }}
                >
                  {academicYears.map(g => <option key={g} value={g}>{g}</option>)}
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">التخصص / الشعبة</label>
                <select
                  className="select"
                  value={selectedSpec}
                  onChange={e => setSelectedSpec(e.target.value)}
                >
                  {getSpecializations(selectedGrade).map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
            </div>

            <div className="form-group" style={{ marginBottom: '24px' }}>
              <label className="form-label">المحافظة</label>
              <select
                className="select"
                value={selectedGov}
                onChange={e => setSelectedGov(e.target.value)}
              >
                {governorates.map(gov => <option key={gov} value={gov}>{gov}</option>)}
              </select>
            </div>

            <button type="submit" className="btn btn-primary w-full" disabled={loading}>
              {loading ? 'جاري الحفظ...' : 'حفظ وإكمال التسجيل'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="login-landing-container" style={{ 
      minHeight: '100vh', 
      backgroundColor: themeBg, 
      color: themeText, 
      direction: 'rtl',
      overflowX: 'hidden'
    }}>
      
      {/* ── SECTION 1: HERO & AUTH PORTAL — "Emerald Manuscript" theme ── */}
      <style>{`
        /* ═══ Entrance choreography ═══ */
        .hero-reveal {
          opacity: 0;
          transform: translateY(20px);
          animation: heroReveal 0.75s cubic-bezier(0.22, 1, 0.36, 1) forwards;
        }
        @keyframes heroReveal {
          to { opacity: 1; transform: none; }
        }

        /* ═══ Floating calligraphic words (code-drawn, theme-aware) ═══ */
        .hero-floating-words { position: absolute; inset: 0; pointer-events: none; z-index: 1; overflow: hidden; }
        .hero-floating-words .fw {
          position: absolute;
          font-family: 'Amiri', 'Cairo', serif;
          font-weight: 700;
          color: var(--lh-word);
          animation: fwDrift 16s ease-in-out infinite alternate;
          user-select: none;
        }
        .fw-1 { top: 9%;  left: 6%;  font-size: 58px; animation-delay: 0s; }
        .fw-2 { top: 34%; left: 2%;  font-size: 40px; animation-delay: -4s; }
        .fw-3 { bottom: 22%; left: 10%; font-size: 66px; animation-delay: -8s; }
        .fw-4 { top: 6%;  right: 30%; font-size: 38px; animation-delay: -2s; }
        .fw-5 { bottom: 12%; right: 4%; font-size: 46px; animation-delay: -6s; }
        .fw-6 { top: 46%; left: 26%; font-size: 34px; animation-delay: -10s; }
        @keyframes fwDrift {
          from { transform: translateY(0) rotate(-2deg); }
          to   { transform: translateY(-22px) rotate(2deg); }
        }

        /* ═══ Display headline (Amiri manuscript voice) ═══ */
        .hero-display-title {
          font-family: 'Amiri', 'Cairo', serif;
          font-size: clamp(40px, 4.6vw, 64px);
          line-height: 1.35;
          font-weight: 700;
          margin: 0;
          color: var(--lh-ink);
        }
        .hero-display-title .em {
          background: linear-gradient(120deg, rgb(var(--fusha-teal-400)) 0%, rgb(var(--fusha-teal-400)) 45%, var(--lh-gold) 100%);
          -webkit-background-clip: text;
          background-clip: text;
          color: transparent;
        }
        .hero-gold-divider {
          width: 150px;
          height: 3px;
          margin-top: 14px;
          border-radius: 3px;
          background: linear-gradient(90deg, var(--lh-gold) 0%, rgba(52, 211, 153,0.7) 60%, transparent 100%);
          position: relative;
        }
        .hero-gold-divider::after {
          content: '';
          position: absolute;
          inset-inline-start: -10px;
          top: -2.5px;
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background: var(--lh-gold);
          box-shadow: 0 0 10px var(--lh-gold);
        }

        /* ═══ Teacher arch frame (manuscript arch) ═══ */
        .teacher-arch-frame {
          position: relative;
          width: clamp(225px, 20vw, 280px);
          padding: 9px;
          border-radius: 170px 170px 28px 28px;
          background: linear-gradient(165deg, var(--lh-gold-line) 0%, rgba(52, 211, 153,0.55) 45%, rgba(52, 211, 153,0.08) 100%);
          box-shadow: 0 30px 60px rgba(0,0,0,0.25);
        }
        .teacher-arch-inner {
          height: clamp(245px, 22vw, 305px);
          border-radius: 162px 162px 21px 21px;
          overflow: hidden;
          position: relative;
          background:
            radial-gradient(130% 90% at 50% 8%, rgba(52, 211, 153,0.4) 0%, transparent 55%),
            linear-gradient(180deg, var(--lh-arch-top) 0%, var(--lh-arch-bottom) 100%);
          border: 1px solid var(--lh-line);
        }
        .teacher-arch-inner img {
          position: absolute;
          bottom: 0;
          left: 50%;
          transform: translateX(-44%);
          height: 104%;
          max-width: none;
          object-fit: contain;
          filter: drop-shadow(0 16px 28px rgba(0,0,0,0.4));
        }
        .teacher-arch-badge {
          position: absolute;
          bottom: -18px;
          right: 50%;
          transform: translateX(50%);
          white-space: nowrap;
          background: var(--lh-badge-bg);
          backdrop-filter: blur(12px);
          border: 1px solid var(--lh-gold-line);
          color: var(--lh-ink);
          border-radius: 999px;
          padding: 8px 18px;
          font-size: 12.5px;
          font-weight: 800;
          font-family: 'Cairo', sans-serif;
          display: flex;
          align-items: center;
          gap: 6px;
          box-shadow: 0 12px 28px rgba(0,0,0,0.3);
          z-index: 3;
        }
        .teacher-arch-badge .material-symbols-outlined { font-size: 17px; color: var(--lh-gold); }

        /* ═══ Auth card with emerald→gold hairline ═══ */
        .auth-card {
          position: relative;
          width: 100%;
          max-width: 440px;
          background: var(--lh-card-bg);
          backdrop-filter: blur(22px);
          -webkit-backdrop-filter: blur(22px);
          border-radius: 26px;
          padding: clamp(22px, 2.4vw, 32px) clamp(18px, 2.2vw, 30px);
          box-shadow: var(--lh-card-shadow);
        }
        .auth-card::before {
          content: '';
          position: absolute;
          inset: 0;
          border-radius: 26px;
          padding: 1.5px;
          background: linear-gradient(155deg,
            rgba(52, 211, 153,0.85) 0%,
            var(--lh-gold-line) 30%,
            rgba(52, 211, 153,0.12) 60%,
            var(--lh-gold-line) 100%);
          -webkit-mask: linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0);
          -webkit-mask-composite: xor;
          mask-composite: exclude;
          pointer-events: none;
        }

        /* Segmented login/signup switcher */
        .auth-tabs {
          display: flex;
          gap: 4px;
          background: var(--lh-tabs-bg);
          border: 1px solid var(--lh-line);
          border-radius: 13px;
          padding: 4px;
          margin-bottom: 22px;
        }
        .auth-tabs button {
          flex: 1;
          height: 40px;
          border: none;
          border-radius: 10px;
          background: transparent;
          color: var(--lh-ink-soft);
          font-family: 'Cairo', sans-serif;
          font-weight: 700;
          font-size: 13.5px;
          cursor: pointer;
          transition: all 0.25s ease;
        }
        .auth-tabs button.active {
          background: linear-gradient(135deg, rgb(var(--fusha-teal-400)) 0%, rgb(var(--fusha-teal-400)) 100%);
          color: #fff;
          box-shadow: 0 6px 16px rgba(52, 211, 153,0.35);
        }
        .auth-card-heading {
          font-size: 22px;
          font-weight: 800;
          color: var(--lh-ink);
          text-align: right;
          margin: 0;
          font-family: 'Cairo', sans-serif;
        }
        .auth-card-subheading {
          font-size: 12.5px;
          color: var(--lh-ink-soft);
          text-align: right;
          margin: 4px 0 0 0;
          line-height: 1.7;
        }

        /* ═══ Form controls ═══ */
        .exact-hero-input {
          width: 100%;
          height: 48px;
          background: var(--lh-input-bg);
          border: 1px solid var(--lh-line);
          border-radius: 12px;
          color: var(--lh-ink);
          font-size: 14px;
          padding: 0 44px 0 44px;
          transition: border-color 0.2s, box-shadow 0.2s, background 0.2s;
          text-align: right;
          font-family: 'Cairo', sans-serif;
        }
        .exact-hero-input:focus {
          border-color: rgb(var(--fusha-teal-400));
          box-shadow: 0 0 0 3px rgba(52, 211, 153, 0.16);
          background: var(--lh-input-bg-focus);
          outline: none;
        }
        .exact-hero-input::placeholder { color: var(--lh-placeholder); }
        .exact-hero-select {
          width: 100%;
          height: 48px;
          background: var(--lh-input-bg);
          border: 1px solid var(--lh-line);
          border-radius: 12px;
          color: var(--lh-ink);
          font-size: 13.5px;
          padding: 0 14px;
          transition: border-color 0.2s, box-shadow 0.2s;
          text-align: right;
          cursor: pointer;
          appearance: none;
          font-family: 'Cairo', sans-serif;
        }
        .exact-hero-select:focus {
          border-color: rgb(var(--fusha-teal-400));
          box-shadow: 0 0 0 3px rgba(52, 211, 153, 0.16);
          outline: none;
        }
        .exact-hero-label {
          font-size: 12.5px;
          color: var(--lh-ink-soft);
          font-weight: 700;
          margin-bottom: 7px;
          display: block;
          text-align: right;
          font-family: 'Cairo', sans-serif;
        }
        .exact-hero-btn {
          width: 100%;
          height: 50px;
          background: linear-gradient(135deg, rgb(var(--fusha-teal-400)) 0%, rgb(var(--fusha-teal-400)) 100%);
          color: rgb(var(--fusha-white));
          font-weight: 800;
          font-size: 15px;
          border-radius: 13px;
          border: none;
          cursor: pointer;
          transition: transform 0.2s ease, box-shadow 0.2s ease, filter 0.2s ease;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          font-family: 'Cairo', sans-serif;
          box-shadow: 0 10px 24px rgba(52, 211, 153, 0.35), inset 0 1px 0 rgba(255,255,255,0.22);
        }
        .exact-hero-btn:hover {
          transform: translateY(-2px);
          filter: brightness(1.06);
          box-shadow: 0 14px 32px rgba(52, 211, 153, 0.45), inset 0 1px 0 rgba(255,255,255,0.22);
        }
        .exact-hero-btn:active { transform: translateY(0); }
        .exact-hero-btn:disabled {
          filter: grayscale(0.4) opacity(0.55);
          cursor: not-allowed;
          transform: none;
        }
        .exact-hero-link {
          font-size: 13px;
          color: var(--lh-ink-soft);
          cursor: pointer;
          transition: color 0.2s ease;
          text-decoration: none;
          font-family: 'Cairo', sans-serif;
        }
        .exact-hero-link:hover { color: rgb(var(--fusha-teal-400)); }

        /* ═══ Bottom trust strip — anchors the empty viewport bottom ═══ */
        .hero-trust-strip {
          position: relative;
          z-index: 10;
          margin-top: auto;
          width: 100%;
          max-width: 1280px;
          padding: 18px 24px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          flex-wrap: wrap;
          gap: 16px;
          border-top: 1px solid var(--lh-line);
        }
        .hero-trust-items { display: flex; gap: 28px; flex-wrap: wrap; }
        .hero-trust-item {
          display: flex;
          align-items: center;
          gap: 8px;
          color: var(--lh-ink-soft);
          font-size: 13px;
          font-weight: 700;
          font-family: 'Cairo', sans-serif;
        }
        .hero-trust-item .material-symbols-outlined { font-size: 18px; color: var(--lh-gold); }
        .hero-trust-socials { display: flex; gap: 16px; align-items: center; }
        .hero-trust-socials a { color: var(--lh-ink-soft); display: flex; transition: color 0.2s, transform 0.2s; }
        .hero-trust-socials a:hover { transform: translateY(-2px); }

        @keyframes phraseFadeIn {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }

        @media (prefers-reduced-motion: reduce) {
          .hero-reveal { animation: none; opacity: 1; transform: none; }
          .hero-floating-words .fw { animation: none; }
        }

        /* ═══ Mobile ═══ */
        @media (max-width: 1024px) {
          .hero-floating-words { display: none; }
          .exact-calligraphy-watermark {
            width: 100% !important;
            opacity: 0.1 !important;
            background-position: center !important;
            mask-image: none !important;
            -webkit-mask-image: none !important;
          }
          .login-hero-auth-wrapper {
            grid-template-columns: 1fr !important;
            display: flex !important;
            flex-direction: column !important;
            align-items: center !important;
            gap: 40px !important;
            padding: 0 20px !important;
          }
          .login-hero-intro-column {
            align-items: center !important;
            text-align: center !important;
            width: 100% !important;
            gap: 28px !important;
          }
          .exact-branding-header {
            justify-content: center !important;
            width: 100% !important;
            flex-wrap: wrap !important;
            gap: 12px !important;
          }
          .exact-branding-header span {
            font-size: 13px !important;
            text-align: center !important;
            white-space: normal !important;
            line-height: 1.6 !important;
          }
          .exact-hero-title-container { text-align: center !important; width: 100% !important; }
          .hero-display-title { font-size: 40px !important; text-align: center !important; }
          .hero-gold-divider { margin-left: auto; margin-right: auto; }
          .exact-hero-subtitle-line { justify-content: center !important; flex-wrap: wrap; height: auto !important; }
          .exact-teacher-portrait-container { justify-content: center !important; width: 100% !important; display: flex !important; }
          .teacher-arch-frame { width: 240px; }
          .teacher-arch-inner { height: 262px; }
          .login-auth-form-column { width: 100% !important; display: flex !important; justify-content: center !important; }
          .hero-trust-strip { justify-content: center; text-align: center; }
        }
      `}</style>

      {/* ── SECTION 1: HERO & AUTH PORTAL — "Emerald Manuscript" ── */}
      <section
        className="login-hero-auth-section"
        style={{
          position: 'relative',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          minHeight: '100vh',
          overflow: 'hidden',
          padding: 'clamp(28px, 5vh, 56px) 0 0 0',
          borderBottom: isDarkMode ? '1px solid rgba(255, 255, 255, 0.05)' : '1px solid rgba(0, 0, 0, 0.05)',
          background: isDarkMode
            ? 'radial-gradient(1100px 700px at 80% 15%, rgb(var(--fusha-teal-800)) 0%, transparent 55%), radial-gradient(900px 600px at 10% 90%, rgba(220, 187, 109, 0.06) 0%, transparent 55%), linear-gradient(180deg, rgb(var(--fusha-teal-900)) 0%, rgb(var(--fusha-teal-900)) 100%)'
            : 'radial-gradient(1100px 700px at 80% 15%, rgb(var(--fusha-sage-100)) 0%, transparent 55%), radial-gradient(900px 600px at 10% 90%, rgba(154, 123, 45, 0.08) 0%, transparent 55%), linear-gradient(180deg, rgb(var(--fusha-canvas-light)) 0%, rgb(var(--fusha-teal-50)) 100%)',
          ...({
            '--lh-ink': isDarkMode ? 'rgb(var(--fusha-sand-50))' : 'rgb(var(--fusha-teal-900))',
            '--lh-ink-soft': isDarkMode ? 'rgba(233, 242, 237, 0.65)' : 'rgba(11, 31, 23, 0.65)',
            '--lh-gold': isDarkMode ? 'rgb(var(--fusha-gold-400))' : 'rgb(var(--fusha-gold-700))',
            '--lh-gold-line': isDarkMode ? 'rgba(220, 187, 109, 0.45)' : 'rgba(154, 123, 45, 0.4)',
            '--lh-line': isDarkMode ? 'rgba(255, 255, 255, 0.09)' : 'rgba(11, 31, 23, 0.12)',
            '--lh-word': isDarkMode ? 'rgba(216, 234, 225, 0.07)' : 'rgba(11, 63, 45, 0.08)',
            '--lh-card-bg': isDarkMode ? 'rgba(9, 17, 13, 0.74)' : 'rgba(255, 255, 255, 0.86)',
            '--lh-card-shadow': isDarkMode
              ? '0 40px 90px rgba(0, 0, 0, 0.55), 0 0 60px rgba(52, 211, 153, 0.10)'
              : '0 30px 60px rgba(13, 60, 44, 0.14), 0 0 40px rgba(52, 211, 153, 0.10)',
            '--lh-input-bg': isDarkMode ? 'rgba(5, 11, 8, 0.55)' : 'rgba(255, 255, 255, 0.75)',
            '--lh-input-bg-focus': isDarkMode ? 'rgba(5, 11, 8, 0.9)' : 'rgb(var(--fusha-white))',
            '--lh-placeholder': isDarkMode ? 'rgba(255, 255, 255, 0.3)' : 'rgba(11, 31, 23, 0.35)',
            '--lh-tabs-bg': isDarkMode ? 'rgba(255, 255, 255, 0.04)' : 'rgba(11, 31, 23, 0.05)',
            '--lh-badge-bg': isDarkMode ? 'rgba(7, 14, 10, 0.88)' : 'rgba(255, 255, 255, 0.92)',
            '--lh-arch-top': isDarkMode ? 'rgb(var(--fusha-teal-800))' : 'rgb(var(--fusha-teal-100))',
            '--lh-arch-bottom': isDarkMode ? 'rgb(var(--fusha-teal-900))' : 'rgb(var(--fusha-sand-300))',
          } as React.CSSProperties)
        }}
      >
        {/* Calligraphy watermark — subtle, masked so it never fights the content */}
        <div
          className="exact-calligraphy-watermark"
          style={{
            position: 'absolute',
            top: 0,
            insetInlineStart: 0,
            bottom: 0,
            width: '55%',
            backgroundImage: 'var(--hero-bg-gradient)',
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            opacity: isDarkMode ? 0.16 : 0.1,
            pointerEvents: 'none',
            mixBlendMode: isDarkMode ? 'screen' : 'multiply',
            zIndex: 0,
            WebkitMaskImage: 'linear-gradient(to left, black 25%, transparent 90%)',
            maskImage: 'linear-gradient(to left, black 25%, transparent 90%)'
          }}
        />

        {/* Code-drawn floating calligraphy words (crisp + theme-aware) */}
        <div className="hero-floating-words" aria-hidden="true">
          <span className="fw fw-1">نحو</span>
          <span className="fw fw-2">صرف</span>
          <span className="fw fw-3">بلاغة</span>
          <span className="fw fw-4">أدب</span>
          <span className="fw fw-5">نص</span>
          <span className="fw fw-6">قراءة</span>
        </div>

        {/* Ambient glows: emerald (reading side) + manuscript gold (form side) */}
        <div style={{
          position: 'absolute',
          top: '12%',
          insetInlineEnd: '18%',
          width: '340px',
          height: '340px',
          background: 'radial-gradient(circle, rgba(55, 105, 92, 0.14) 0%, transparent 70%)',
          borderRadius: '50%',
          filter: 'blur(70px)',
          pointerEvents: 'none',
          zIndex: 1
        }} />
        <div style={{
          position: 'absolute',
          bottom: '8%',
          insetInlineStart: '12%',
          width: '300px',
          height: '300px',
          background: `radial-gradient(circle, ${isDarkMode ? 'rgba(232, 181, 74, 0.10)' : 'rgba(184, 132, 34, 0.12)'} 0%, transparent 70%)`,
          borderRadius: '50%',
          filter: 'blur(70px)',
          pointerEvents: 'none',
          zIndex: 1
        }} />

        <div className="login-hero-auth-wrapper" style={{ zIndex: 10, marginTop: 'auto', marginBottom: 'auto' }}>
          {/* Right Column: Welcoming Text & Teacher Arch Portrait */}
          <div className="login-hero-intro-column" style={{ display: 'flex', flexDirection: 'column', gap: '34px', textAlign: 'right' }}>
            {/* Welcoming Title (Amiri manuscript display) */}
            <div className="exact-hero-title-container hero-reveal" style={{ animationDelay: '0.15s' }}>
              <h1 className="hero-display-title">
                <span style={{ display: 'block' }}>منصتك الأولى لتعلم</span>
                <span className="em" style={{ display: 'block' }}>اللغة العربية</span>
              </h1>
              <div className="hero-gold-divider" aria-hidden="true" />
            </div>

            {/* Teacher portrait in a manuscript arch frame */}
            <div className="exact-teacher-portrait-container hero-reveal" style={{ display: 'flex', justifyContent: 'flex-start', overflow: 'visible', animationDelay: '0.3s', paddingBottom: '22px' }}>
              <div className="teacher-arch-frame">
                <div className="teacher-arch-inner">
                  <img src={teacherPortrait} alt="الأستاذ أشرف سليم على منصة فُصْحَى" />
                </div>
                <div className="teacher-arch-badge">
                  <span className="material-symbols-outlined" aria-hidden="true">verified</span>
                  فُصْحَى · أستاذ اللغة العربية
                </div>
              </div>
            </div>
          </div>

          {/* Left Column: Auth Card with emerald→gold hairline */}
          <div className="login-auth-form-column" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
            <div className="auth-card hero-reveal" style={{ animationDelay: '0.2s' }}>
              
              {activeError && (
                <div style={{ 
                  background: 'rgba(239, 68, 68, 0.1)', 
                  border: '1px solid rgba(239, 68, 68, 0.2)', 
                  color: isDarkMode ? 'rgb(var(--fusha-gold-500))' : 'rgb(var(--fusha-gold-700))',
                  borderRadius: '10px',
                  padding: '12px', 
                  fontSize: '13px', 
                  textAlign: 'center', 
                  marginBottom: '20px', 
                  fontWeight: '600' 
                }}>
                  {activeError}
                </div>
              )}

              {/* ── Forgot Password Form ── */}
              {isForgotPassword ? (
                <form onSubmit={handleForgotPasswordSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  <h2 className="auth-card-heading">استعادة كلمة المرور</h2>
                  <p className="auth-card-subheading" style={{ margin: 0 }}>
                    أدخل رقم الموبايل أو بريدك الإلكتروني لإرسال رابط إعادة تعيين كلمة المرور.
                  </p>
                  
                  {forgotSent ? (
                    <div style={{ 
                      background: 'rgba(52, 211, 153, 0.1)', 
                      border: '1px solid rgba(52, 211, 153, 0.2)', 
                      color: 'rgb(var(--fusha-teal-400))', 
                      borderRadius: '10px', 
                      padding: '12px', 
                      fontSize: '13px', 
                      textAlign: 'center', 
                      fontWeight: '600' 
                    }}>
                      تم إرسال رابط إعادة التعيين بنجاح. تفقد بريدك الإلكتروني.
                    </div>
                  ) : (
                    <div>
                      <label className="exact-hero-label">البريد الإلكتروني</label>
                      <div style={{ position: 'relative' }}>
                        <input
                          type="email"
                          className="exact-hero-input"
                          placeholder="أدخل البريد الإلكتروني المسجَّل على حسابك"
                          value={forgotEmail}
                          onChange={e => setForgotEmail(e.target.value)}
                          autoComplete="email"
                          required
                        />
                        <span className="material-symbols-outlined" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--lh-ink-soft)', fontSize: '18px', pointerEvents: 'none' }}>
                          mail
                        </span>
                      </div>
                    </div>
                  )}

                  <button type="submit" className="exact-hero-btn" disabled={loading || forgotSent}>
                    {loading ? 'جاري الإرسال...' : 'إرسال الرابط'}
                  </button>

                  <button type="button" className="exact-hero-btn" onClick={() => setIsForgotPassword(false)} style={{ background: 'transparent', border: '1.5px solid var(--lh-line)', color: 'var(--lh-ink)', boxShadow: 'none' }}>
                    العودة لتسجيل الدخول
                  </button>
                </form>
              ) : isSignUp ? (
                /* ── Register Form ── */
                <form onSubmit={handleSignUpSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  <div className="auth-tabs" role="tablist" aria-label="نوع الدخول">
                    <button type="button" role="tab" aria-selected="false" onClick={() => setIsSignUp(false)}>تسجيل الدخول</button>
                    <button type="button" className="active" role="tab" aria-selected="true">حساب جديد</button>
                    <button type="button" role="tab" aria-selected="false" onClick={handleBrowseAsGuest}>استكشف المنصة</button>
                  </div>
                  <div>
                    <h2 className="auth-card-heading">انضم لعائلة المنصة ✨</h2>
                    <p className="auth-card-subheading">دقيقة واحدة وتكون جاهزاً لأول محاضرة.</p>
                  </div>
                  
                  <div>
                    <label className="exact-hero-label">الاسم بالكامل</label>
                    <div style={{ position: 'relative' }}>
                      <input
                        type="text"
                        className="exact-hero-input"
                        placeholder="الاسم ثلاثياً باللغة العربية"
                        value={fullName}
                        onChange={e => setFullName(e.target.value)}
                        required
                      />
                      <span className="material-symbols-outlined" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--lh-ink-soft)', fontSize: '18px', pointerEvents: 'none' }}>
                        person
                      </span>
                    </div>
                    {fullName && !isFullNameValid(fullName) && (
                      <p style={{ color: isDarkMode ? 'rgb(var(--fusha-gold-500))' : 'rgb(var(--fusha-gold-700))', fontSize: '11px', marginTop: '4px', textAlign: 'right', margin: 0 }}>
                        ⚠️ يرجى إدخال اسمك ثلاثياً باللغة العربية على الأقل.
                      </p>
                    )}
                  </div>

                  <div>
                    <label className="exact-hero-label">البريد الإلكتروني</label>
                    <div style={{ position: 'relative' }}>
                      <input
                        type="email"
                        className="exact-hero-input"
                        placeholder="مثال: student@example.com"
                        value={email}
                        onChange={e => setEmail(e.target.value)}
                        autoComplete="email"
                        required
                      />
                      <span className="material-symbols-outlined" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--lh-ink-soft)', fontSize: '18px', pointerEvents: 'none' }}>
                        mail
                      </span>
                    </div>
                    {email && !isEmailValid(email) && (
                      <p style={{ color: isDarkMode ? 'rgb(var(--fusha-gold-500))' : 'rgb(var(--fusha-gold-700))', fontSize: '11px', marginTop: '4px', textAlign: 'right', margin: 0 }}>
                        ⚠️ يرجى إدخال بريد إلكتروني صحيح — عليه ستصلك رسالة استعادة كلمة المرور.
                      </p>
                    )}
                  </div>

                  <div>
                    <label className="exact-hero-label">رقم الهاتف (الموبايل)</label>
                    <div style={{ position: 'relative' }}>
                      <input
                        type="tel"
                        className="exact-hero-input"
                        placeholder="مثال: 01012345678"
                        value={phone}
                        onChange={e => setPhone(e.target.value)}
                        required
                      />
                      <span className="material-symbols-outlined" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--lh-ink-soft)', fontSize: '18px', pointerEvents: 'none' }}>
                        phone_iphone
                      </span>
                    </div>
                    {phone && !isPhoneValid(phone) && (
                      <p style={{ color: isDarkMode ? 'rgb(var(--fusha-gold-500))' : 'rgb(var(--fusha-gold-700))', fontSize: '11px', marginTop: '4px', textAlign: 'right', margin: 0 }}>
                        ⚠️ رقم المحمول يجب أن يبدأ بـ 01 ويتكون من 11 رقماً.
                      </p>
                    )}
                  </div>

                  <div>
                    <label className="exact-hero-label">رقم هاتف ولي الأمر</label>
                    <div style={{ position: 'relative' }}>
                      <input
                        type="tel"
                        className="exact-hero-input"
                        placeholder="رقم ولي الأمر للطوارئ"
                        value={parentPhone}
                        onChange={e => setParentPhone(e.target.value)}
                        required
                      />
                      <span className="material-symbols-outlined" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--lh-ink-soft)', fontSize: '18px', pointerEvents: 'none' }}>
                        family_restroom
                      </span>
                    </div>
                    {parentPhone && !isParentPhoneValid(parentPhone) && (
                      <p style={{ color: isDarkMode ? 'rgb(var(--fusha-gold-500))' : 'rgb(var(--fusha-gold-700))', fontSize: '11px', marginTop: '4px', textAlign: 'right', margin: 0 }}>
                        ⚠️ يجب أن يكون رقماً صحيحاً ومختلفاً عن رقم هاتفك.
                      </p>
                    )}
                  </div>

                  <div>
                    <label className="exact-hero-label">كلمة المرور</label>
                    <div style={{ position: 'relative' }}>
                      <input
                        type="password"
                        className="exact-hero-input"
                        placeholder="8 رموز على الأقل"
                        value={password}
                        onChange={e => setPassword(e.target.value)}
                        required
                        minLength={8}
                      />
                      <span className="material-symbols-outlined" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--lh-ink-soft)', fontSize: '18px', pointerEvents: 'none' }}>
                        lock
                      </span>
                    </div>
                  </div>

                  <div>
                    <label className="exact-hero-label">تأكيد كلمة المرور</label>
                    <div style={{ position: 'relative' }}>
                      <input
                        type="password"
                        className="exact-hero-input"
                        placeholder="أعد كتابة كلمة المرور"
                        value={confirmPassword}
                        onChange={e => setConfirmPassword(e.target.value)}
                        required
                      />
                      <span className="material-symbols-outlined" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--lh-ink-soft)', fontSize: '18px', pointerEvents: 'none' }}>
                        lock
                      </span>
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                    <div>
                      <label className="exact-hero-label">الصف الدراسي</label>
                      <select
                        className="exact-hero-select"
                        value={selectedGrade}
                        onChange={e => {
                          setSelectedGrade(e.target.value);
                          const specs = getSpecializations(e.target.value);
                          setSelectedSpec(specs[0]);
                        }}
                      >
                        {academicYears.map(g => <option key={g} value={g} style={{ color: 'rgb(var(--fusha-teal-900))', backgroundColor: 'rgb(var(--fusha-white))' }}>{g}</option>)}
                      </select>
                    </div>

                    <div>
                      <label className="exact-hero-label">التخصص</label>
                      <select
                        className="exact-hero-select"
                        value={selectedSpec}
                        onChange={e => setSelectedSpec(e.target.value)}
                      >
                        {getSpecializations(selectedGrade).map(s => <option key={s} value={s} style={{ color: 'rgb(var(--fusha-teal-900))', backgroundColor: 'rgb(var(--fusha-white))' }}>{s}</option>)}
                      </select>
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                    <div>
                      <label className="exact-hero-label">النوع</label>
                      <select
                        className="exact-hero-select"
                        value={selectedGender}
                        onChange={e => setSelectedGender(e.target.value)}
                      >
                        <option value="ذكر" style={{ color: 'rgb(var(--fusha-teal-900))', backgroundColor: 'rgb(var(--fusha-white))' }}>ذكر</option>
                        <option value="أنثى" style={{ color: 'rgb(var(--fusha-teal-900))', backgroundColor: 'rgb(var(--fusha-white))' }}>أنثى</option>
                      </select>
                    </div>

                    <div>
                      <label className="exact-hero-label">المحافظة</label>
                      <select
                        className="exact-hero-select"
                        value={selectedGov}
                        onChange={e => setSelectedGov(e.target.value)}
                      >
                        {governorates.map(gov => <option key={gov} value={gov} style={{ color: 'rgb(var(--fusha-teal-900))', backgroundColor: 'rgb(var(--fusha-white))' }}>{gov}</option>)}
                      </select>
                    </div>
                  </div>

                  <button
                    type="submit"
                    className="exact-hero-btn"
                    disabled={loading || !isFullNameValid(fullName) || !isEmailValid(email) || !isPhoneValid(phone) || !isParentPhoneValid(parentPhone) || !isPasswordValid(password) || !isConfirmPasswordValid(confirmPassword)}
                    style={{ marginTop: '6px' }}
                  >
                    {loading ? 'جاري إنشاء الحساب...' : 'إنشاء حساب جديد'}
                  </button>

                  <div style={{ borderTop: '1px solid var(--lh-line)', paddingTop: '10px', display: 'flex', justifyContent: 'center' }}>
                    <span
                      onClick={handleBrowseAsGuest}
                      style={{ fontSize: '13px', color: 'rgb(var(--fusha-teal-400))', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
                    >
                      <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>explore</span>
                      استكشف المنصة
                    </span>
                  </div>
                </form>
              ) : (
                /* ── Login Form ── */
                <form onSubmit={handleLoginSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
                  <div className="auth-tabs" role="tablist" aria-label="نوع الدخول">
                    <button type="button" className="active" role="tab" aria-selected="true">تسجيل الدخول</button>
                    <button type="button" role="tab" aria-selected="false" onClick={() => setIsSignUp(true)}>حساب جديد</button>
                    <button type="button" role="tab" aria-selected="false" onClick={handleBrowseAsGuest}>استكشف المنصة</button>
                  </div>
                  <div>
                    <h2 className="auth-card-heading">أهلاً بعودتك! 👋</h2>
                    <p className="auth-card-subheading">سجّل دخولك وكمّل رحلتك نحو الدرجة النهائية.</p>
                  </div>

                  <div>
                    <label className="exact-hero-label">رقم الهاتف أو البريد</label>
                    <div style={{ position: 'relative' }}>
                      <input
                        type="text"
                        className="exact-hero-input"
                        placeholder="رقم الهاتف أو البريد"
                        value={emailOrPhone}
                        onChange={e => setEmailOrPhone(e.target.value)}
                        required
                      />
                      <span className="material-symbols-outlined" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--lh-ink-soft)', fontSize: '18px', pointerEvents: 'none' }}>
                        person
                      </span>
                    </div>
                  </div>

                  <div>
                    <label className="exact-hero-label">كلمة المرور</label>
                    <div style={{ position: 'relative' }}>
                      <input
                        type={showPassword ? 'text' : 'password'}
                        className="exact-hero-input"
                        placeholder="••••••••"
                        value={password}
                        onChange={e => setPassword(e.target.value)}
                        required
                        style={{ paddingLeft: '42px', paddingRight: '42px' }}
                      />
                      <span className="material-symbols-outlined" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--lh-ink-soft)', fontSize: '18px', pointerEvents: 'none' }}>
                        lock
                      </span>
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        style={{
                          position: 'absolute',
                          right: '12px',
                          top: '50%',
                          transform: 'translateY(-50%)',
                          background: 'none',
                          border: 'none',
                          padding: 0,
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center'
                        }}
                      >
                        <span className="material-symbols-outlined" style={{ color: 'var(--lh-ink-soft)', fontSize: '18px' }}>
                          {showPassword ? 'visibility' : 'visibility_off'}
                        </span>
                      </button>
                    </div>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginTop: '4px' }}>
                    <button type="submit" className="exact-hero-btn" disabled={loading}>
                      {loading ? 'جاري تسجيل الدخول...' : 'تسجيل الدخول'}
                    </button>

                    <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
                      <span
                        onClick={() => setIsForgotPassword(true)}
                        className="exact-hero-link"
                      >
                        نسيت كلمة المرور؟
                      </span>
                    </div>
                  </div>

                  <div style={{ borderTop: '1px solid var(--lh-line)', paddingTop: '16px', display: 'flex', justifyContent: 'center' }}>
                    <span
                      onClick={handleBrowseAsGuest}
                      style={{ fontSize: '13px', color: 'rgb(var(--fusha-teal-400))', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
                    >
                      <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>explore</span>
                      استكشف المنصة
                    </span>
                  </div>
                </form>
              )}
            </div>
          </div>
        </div>

        {/* ── Trust strip: anchors the hero bottom instead of dead space ── */}
        <div className="hero-trust-strip hero-reveal" style={{ animationDelay: '0.45s' }}>
          <div className="hero-trust-items">
            <div className="hero-trust-item">
              <span className="material-symbols-outlined" aria-hidden="true">menu_book</span>
              منهج الثانوية العامة كاملاً
            </div>
            <div className="hero-trust-item">
              <span className="material-symbols-outlined" aria-hidden="true">quiz</span>
              امتحانات بتصحيح فوري
            </div>
            <div className="hero-trust-item">
              <span className="material-symbols-outlined" aria-hidden="true">forum</span>
              دعم مباشر من فريق المنصة
            </div>
          </div>
          <div className="hero-trust-socials">
            <a href="https://facebook.com" target="_blank" rel="noopener noreferrer" aria-label="صفحتنا على فيسبوك" title="فيسبوك">
              <svg width="18" height="18" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path d="M22 12c0-5.52-4.48-10-10-10S2 6.48 2 12c0 4.84 3.44 8.87 8 9.8V15H8v-3h2V9.5C10 7.57 11.57 6 13.5 6H16v3h-2c-.55 0-1 .45-1 1v2h3v3h-3v6.95c4.56-.93 8-4.96 8-9.75z"/>
              </svg>
            </a>
            <a href="https://youtube.com" target="_blank" rel="noopener noreferrer" aria-label="قناتنا على يوتيوب" title="يوتيوب">
              <svg width="18" height="18" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path d="M23.498 6.163a3.003 3.003 0 0 0-2.11-2.11C19.518 3.545 12 3.545 12 3.545s-7.518 0-9.388.508a3.003 3.003 0 0 0-2.11 2.11C0 8.033 0 12 0 12s0 3.967.502 5.837a3.003 3.003 0 0 0 2.11 2.11c1.87.508 9.388.508 9.388.508s7.518 0 9.388-.508a3.003 3.003 0 0 0 2.11-2.11C24 15.967 24 12 24 12s0-3.967-.502-5.837zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
              </svg>
            </a>
            <a href="https://telegram.org" target="_blank" rel="noopener noreferrer" aria-label="قناتنا على تليجرام" title="تليجرام">
              <svg width="18" height="18" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.64 6.8c-.15 1.58-.8 5.42-1.13 7.19-.14.75-.42 1-.68 1.03-.58.05-1.02-.38-1.58-.75-.88-.58-1.38-.94-2.23-1.5-.99-.65-.35-1.01.22-1.59.15-.15 2.71-2.48 2.76-2.69a.2.2 0 0 0-.05-.18c-.06-.05-.14-.03-.21-.02-.09.02-1.49.95-4.22 2.79-.4.27-.76.41-1.08.4-.36-.01-1.04-.2-1.55-.37-.63-.2-1.12-.31-1.08-.66.02-.18.27-.36.74-.55 2.92-1.27 4.86-2.11 5.83-2.51 2.78-1.16 3.35-1.36 3.73-1.37.08 0 .27.02.39.12.1.08.13.19.14.27-.01.06.01.24 0 .24z"/>
              </svg>
            </a>
          </div>
        </div>
      </section>

      {/* ── SECTION 2: PLATFORM ADVANTAGES SURROUNDING THE TEACHER ── */}
      <section 
        className="login-teacher-surround-section"
        style={{ 
          backgroundColor: isDarkMode ? 'rgb(var(--fusha-teal-900))' : 'rgb(var(--fusha-white))',
          borderBottom: `1px solid ${borderLight}`
        }}
      >
        <div style={{ textAlign: 'center', marginBottom: '60px', padding: '0 24px' }}>
          <span style={{ fontSize: '12px', color: 'rgb(var(--primary))', fontWeight: '900', textTransform: 'uppercase', letterSpacing: '1px' }}>مزايا المنصة الأكاديمية</span>
          <h2 style={{ fontSize: '32px', fontWeight: '900', marginTop: '8px', color: themeText, fontFamily: 'Cairo, sans-serif' }}>منظومة تعليمية متطورة لضمان التفوق</h2>
          <p style={{ fontSize: '15px', color: secondaryText, marginTop: '8px', maxWidth: '600px', marginLeft: 'auto', marginRight: 'auto' }}>
            كافة الأدوات والحلول التكنولوجية الذكية لتبسيط فهم لغتك العربية وبناء مهارات لغوية حقيقية.
          </p>
        </div>

        <div className="login-teacher-surround-wrapper">
          {/* Right/Left columns in Arabic RTL context */}
          <div className="login-surround-column">
            {/* Card 1 */}
            <div className="login-surround-card card-gold">
              <div className="login-surround-card-icon">
                <span className="material-symbols-outlined">menu_book</span>
              </div>
              <div className="login-surround-card-details">
                <h3 className="login-surround-card-title" style={{ color: themeText }}>منهج كامل وشرح وافي</h3>
                <p className="login-surround-card-desc" style={{ color: secondaryText }}>
                  شرح تفصيلي ومبسط يعتمد على بناء المفاهيم اللغوية خطوة بخطوة بطرق مبتكرة تضمن الفهم الكامل.
                </p>
              </div>
            </div>

            {/* Card 2 */}
            <div className="login-surround-card card-teal">
              <div className="login-surround-card-icon">
                <span className="material-symbols-outlined">assignment_turned_in</span>
              </div>
              <div className="login-surround-card-details">
                <h3 className="login-surround-card-title" style={{ color: themeText }}>تدريبات وامتحانات دورية</h3>
                <p className="login-surround-card-desc" style={{ color: secondaryText }}>
                  اختبارات وتدريبات تفاعلية عقب كل محاضرة لقياس استيعابك وتحديد نقاط قوتك وضعفك مباشرة.
                </p>
              </div>
            </div>
          </div>

          {/* Center Column: Teacher Portrait with Ring Overlay */}
          <div className="login-teacher-center-column">
            <div className="login-teacher-portal-glow"></div>
            <div className="login-teacher-portal-ring">
              <div className="login-teacher-portal-inner">
                <img src={teacherPortrait} alt="فُصْحَى" />
              </div>
            </div>
          </div>

          {/* Left/Right columns in Arabic RTL context */}
          <div className="login-surround-column">
            {/* Card 3 */}
            <div className="login-surround-card card-purple">
              <div className="login-surround-card-icon">
                <span className="material-symbols-outlined">schema</span>
              </div>
              <div className="login-surround-card-details">
                <h3 className="login-surround-card-title" style={{ color: themeText }}>ملخصات وخرائط ذهنية</h3>
                <p className="login-surround-card-desc" style={{ color: secondaryText }}>
                  كتيبات ملخصة وخرائط ذهنية ذكية لتسهيل الحفظ السريع واسترجاع المعلومات ليلة الامتحان.
                </p>
              </div>
            </div>

            {/* Card 4 */}
            <div className="login-surround-card card-rose">
              <div className="login-surround-card-icon">
                <span className="material-symbols-outlined">supervised_user_circle</span>
              </div>
              <div className="login-surround-card-details">
                <h3 className="login-surround-card-title" style={{ color: themeText }}>متابعة أولياء الأمور</h3>
                <p className="login-surround-card-desc" style={{ color: secondaryText }}>
                  تقارير دورية ومباشرة تصل لولي الأمر بخصوص مستويات الطالب الأكاديمية وحضوره ودرجاته أولاً بأول.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── SECTION 3: FREE COURSE PREVIEWS & DASHBOARD ROUTING ── */}
      <section 
        className="login-free-content-section" 
        style={{ 
          backgroundColor: isDarkMode ? 'rgb(var(--fusha-teal-900))' : 'rgb(var(--fusha-canvas-light))'
        }}
      >
        <div className="login-section-container">
          <div className="login-section-header" style={{ textAlign: 'center', marginBottom: '48px' }}>
            <h2 style={{ fontSize: '32px', fontWeight: '900', marginTop: '8px', color: themeText, fontFamily: 'Cairo, sans-serif' }}>المحاضرات المتاحة دون الاشتراك</h2>
          </div>

          {loadingCourses ? (
            <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap', justifyContent: 'center' }}>
              {[1, 2, 3].map((n) => (
                <div key={n} style={{ width: '320px', height: '220px', borderRadius: '16px', background: isDarkMode ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.03)', border: cardBorder }} className="skeleton-shimmer" />
              ))}
            </div>
          ) : publicCourses.length > 0 ? (
            <div className="login-courses-grid">
              {publicCourses.map((course) => (
                <div key={course.id} className="login-course-card" onClick={() => navigate(`/courses/${course.id}`)} style={{ border: cardBorder, background: cardBg }}>
                  <img src={optimizedCoverUrl(course.cover_image, 400) || 'https://images.unsplash.com/photo-1456513080510-7bf3a84b82f8?auto=format&fit=crop&w=400&q=80'} alt={course.title} loading="lazy" width={400} height={110} className="login-course-cover" />
                  <div className="login-course-content">
                    <h4 className="login-course-title" style={{ color: themeText }}>{course.title}</h4>
                    <span style={{ fontSize: '11px', color: 'rgb(var(--primary))', fontWeight: '800', marginTop: '4px' }}>{course.grade}</span>
                    <div className="login-course-meta">
                      <span>{course.lessons_count || 0} درس</span>
                      <span className="login-course-btn">تصفح مجاناً</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ padding: '36px', textAlign: 'center', background: isDarkMode ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.02)', borderRadius: '16px', border: cardBorder, maxWidth: '500px', marginLeft: 'auto', marginRight: 'auto' }}>
              <p style={{ fontSize: '14px', color: secondaryText, margin: 0 }}>متاح تصفح المنصة كزائر لاستكشاف الملازم والمحاضرات.</p>
            </div>
          )}

          {/* ── SUBSECTION: FREE EXAMS ── */}
          <div className="login-section-header" style={{ textAlign: 'center', marginTop: '64px', marginBottom: '32px' }}>
            <h2 style={{ fontSize: '28px', fontWeight: '900', color: themeText, fontFamily: 'Cairo, sans-serif' }}>الامتحانات التجريبية والمجانية</h2>
            <p style={{ fontSize: '14px', color: secondaryText, marginTop: '6px' }}>
              اختبر مستواك فوراً وبدون تسجيل دخول في الامتحانات التفاعلية المجانية
            </p>
          </div>

          {loadingExams ? (
            <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap', justifyContent: 'center' }}>
              {[1, 2].map((n) => (
                <div key={n} style={{ width: '380px', height: '140px', borderRadius: '16px', background: isDarkMode ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.03)', border: cardBorder }} className="skeleton-shimmer" />
              ))}
            </div>
          ) : publicExams.length > 0 ? (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '20px', width: '100%', maxWidth: '1100px', margin: '0 auto' }}>
              {publicExams.map((exam) => (
                <div 
                  key={exam.id} 
                  onClick={() => handleOpenPublicExam(exam.id)}
                  style={{ 
                    border: cardBorder, 
                    background: cardBg,
                    borderRadius: '16px',
                    cursor: 'pointer',
                    display: 'flex',
                    flexDirection: 'column',
                    overflow: 'hidden',
                    transition: 'transform 0.2s, box-shadow 0.2s',
                    textAlign: 'right'
                  }}
                  className="login-course-card"
                >
                  <img
                    src={optimizedCoverUrl(exam.cover_image, 400) || 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&w=400&q=80'}
                    alt={exam.title}
                    loading="lazy"
                    width={400}
                    height={140}
                    style={{ width: '100%', height: '140px', objectFit: 'cover' }}
                  />
                  <div style={{ padding: '16px', flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                    <div>
                      <div style={{ display: 'inline-block', background: 'rgba(52, 211, 153, 0.1)', color: 'rgb(var(--primary))', fontSize: '11px', fontWeight: '900', padding: '2px 8px', borderRadius: '4px', marginBottom: '8px' }}>
                        امتحان مجاني
                      </div>
                      <h4 style={{ fontSize: '15px', fontWeight: '800', color: themeText, margin: 0, lineHeight: '1.4' }}>{exam.title}</h4>
                      <p style={{ fontSize: '11px', color: secondaryText, marginTop: '4px', margin: 0 }}>المقرر: {exam.course_title}</p>
                    </div>
                    
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '16px', paddingTop: '12px', borderTop: isDarkMode ? '1px solid rgba(255,255,255,0.05)' : '1px solid rgba(0,0,0,0.05)' }}>
                      <div style={{ display: 'flex', gap: '8px', fontSize: '11px', color: secondaryText }}>
                        <span className="flex items-center gap-0.5">
                          <span className="material-symbols-outlined" style={{ fontSize: '13px' }}>grade</span>
                          {exam.max_score} درجة
                        </span>
                        {exam.time_limit_mins && (
                          <span className="flex items-center gap-0.5">
                            <span className="material-symbols-outlined" style={{ fontSize: '13px' }}>timer</span>
                            {exam.time_limit_mins} دقيقة
                          </span>
                        )}
                      </div>
                      <span style={{ fontSize: '11px', color: 'rgb(var(--primary))', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '2px' }}>
                        ابدأ الحل
                        <span className="material-symbols-outlined" style={{ fontSize: '14px', transform: 'rotate(180deg)' }}>arrow_right_alt</span>
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ padding: '36px', textAlign: 'center', background: isDarkMode ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.02)', borderRadius: '16px', border: cardBorder, maxWidth: '500px', margin: '0 auto' }}>
              <p style={{ fontSize: '14px', color: secondaryText, margin: 0 }}>لا توجد امتحانات تجريبية مجانية متاحة حالياً.</p>
            </div>
          )}

          {/* Central Call-To-Action to Go to Dashboard/Home */}
          <div className="login-dashboard-redirect">
            <button 
              className="login-dashboard-cta-btn" 
              onClick={() => navigate('/dashboard/home')}
            >
              <span>انتقل إلى لوحة التحكم واستكشف المنصة</span>
              <span className="icon material-symbols-outlined" style={{ transform: 'rotate(180deg)', marginRight: '4px' }}>arrow_forward</span>
            </button>
            <p style={{ fontSize: '13px', color: secondaryText, marginTop: '8px' }}>أو تصفح المقررات، الملازم، وجداول الامتحانات كزائر غير مسجل</p>
          </div>
        </div>
      </section>

      {/* ── FOOTER Redesign ── */}
      <footer className="login-premium-footer" style={{ borderTop: `1px solid ${borderLight}`, backgroundColor: isDarkMode ? 'rgb(var(--fusha-teal-900))' : 'rgb(var(--fusha-teal-50))' }}>
        <div className="login-section-container" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px' }}>
          <span style={{ fontSize: '13.5px', color: secondaryText, fontWeight: '700' }}>
            حقوق النشر والتشغيل محفوظة لـ{' '}
            <span style={{ color: 'rgb(var(--primary))', fontWeight: 'bold' }}>منصة فُصْحَى</span>
          </span>
          <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap', justifyContent: 'center', alignItems: 'center' }}>
            {/* رابط نسبي — يُخدَم من نفس النطاق بعد ربط الـ Worker */}
            <a href="/files/apk" style={{ fontSize: '13.5px', color: 'rgb(var(--primary))', textDecoration: 'none', fontWeight: 'bold' }}>تحميل منصة الطالب (APK)</a>
            <span style={{ color: borderLight }}>|</span>
            <span style={{ fontSize: '13.5px', color: secondaryText }}>شريكك الأقوى للدرجة النهائية في اللغة العربية</span>
          </div>
        </div>
      </footer>

      {/* ── Device Reset Request Modal ── */}
      {showDeviceResetDialog && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ padding: '24px', direction: 'rtl', backgroundColor: isDarkMode ? 'rgb(var(--surface-container-high))' : 'rgb(var(--fusha-white))', border: cardBorder, color: themeText }}>
            <div className="flex items-center gap-md" style={{ marginBottom: '16px' }}>
              <span className="icon" style={{ fontSize: '32px', color: 'rgb(var(--error))' }}>lock</span>
              <h3 className="title-small" style={{ margin: 0, color: themeText }}>تجاوز حد الأجهزة المسموح بها</h3>
            </div>
            
            {deviceResetSuccess ? (
              <div className="flex flex-col items-center">
                <div className="badge badge-success w-full justify-center" style={{ padding: '12px', marginBottom: '20px' }}>
                  تم تقديم طلب إعادة تعيين الأجهزة بنجاح.
                </div>
                <p className="body-small text-center" style={{ marginBottom: '20px', color: secondaryText }}>
                  طلبك قيد المراجعة حالياً من قِبل الأستاذ أو المساعدين. سيتم فك ارتباط الأجهزة السابقة قريباً لتتمكن من تشغيل حسابك من هذا المتصفح.
                </p>
                <button
                  className="btn btn-primary w-full"
                  onClick={() => {
                    setShowDeviceResetDialog(false);
                    setDeviceResetSuccess(false);
                    setDeviceResetReason('');
                  }}
                >
                  حسناً
                </button>
              </div>
            ) : (
              <form onSubmit={handleDeviceResetSubmit}>
                <p className="body-small" style={{ marginBottom: '16px', lineHeight: '1.6', color: secondaryText }}>
                  لقد سجلت الدخول مسبقاً من عدد الأجهزة/المتصفحات المسموح به لحسابك. لفك ارتباط الأجهزة السابقة واستخدام حسابك على هذا المتصفح الجديد، يرجى كتابة سبب التغيير لتقديمه للإدارة:
                </p>

                <div className="form-group" style={{ marginBottom: '20px' }}>
                  <textarea
                    className="input-text"
                    style={{ height: '80px', paddingRight: '16px', resize: 'none', backgroundColor: inputBgColor, color: inputTextColor, borderColor: inputBorderDefault }}
                    placeholder="مثال: قمت بتغيير المتصفح الخاص بي / مسحت الكاش بالخطأ..."
                    value={deviceResetReason}
                    onChange={e => setDeviceResetReason(e.target.value)}
                    required
                  />
                </div>

                {deviceResetError && (
                  <p role="alert" style={{ fontSize: '12px', color: 'rgb(var(--error))', marginBottom: '16px', fontWeight: 'bold' }}>
                    {deviceResetError}
                  </p>
                )}

                <div className="flex gap-md">
                  <button type="submit" className="btn btn-primary flex-1" disabled={resetLoading}>
                    {resetLoading ? 'جاري الإرسال...' : 'تقديم طلب التعيين'}
                  </button>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => {
                      setShowDeviceResetDialog(false);
                      setDeviceResetReason('');
                    }}
                    style={{ backgroundColor: isDarkMode ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)', color: themeText, border: 'none' }}
                  >
                    إلغاء
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
      {/* ── Public Free Exam Solver Modal ── */}
      {activePublicExamId && (
        <div className="modal-overlay" style={{ zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
          <div 
            className="modal-content" 
            style={{ 
              maxWidth: '800px', 
              width: '100%', 
              maxHeight: '90vh', 
              overflowY: 'auto', 
              borderRadius: '24px', 
              padding: '28px', 
              direction: 'rtl', 
              backgroundColor: isDarkMode ? 'rgb(var(--surface-container-high))' : 'rgb(var(--fusha-white))', 
              border: cardBorder, 
              color: themeText,
              boxShadow: '0 20px 50px rgba(0,0,0,0.3)',
              position: 'relative'
            }}
          >
            {/* Modal Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: isDarkMode ? '1px solid rgba(255,255,255,0.08)' : '1px solid rgba(0,0,0,0.08)', paddingBottom: '16px', marginBottom: '20px' }}>
              <div>
                <span style={{ fontSize: '11px', color: 'rgb(var(--primary))', fontWeight: '900', textTransform: 'uppercase' }}>امتحان تجريبي مجاني</span>
                <h3 style={{ fontSize: '20px', fontWeight: '900', margin: '4px 0 0 0', color: themeText }}>
                  {publicExamData?.exam?.title || 'جاري تحميل الامتحان...'}
                </h3>
              </div>
              <button 
                onClick={handleClosePublicExam} 
                style={{ 
                  background: 'none', 
                  border: 'none', 
                  color: secondaryText, 
                  cursor: 'pointer', 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'center',
                  padding: '8px',
                  borderRadius: '50%',
                  backgroundColor: isDarkMode ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.03)'
                }}
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            {loadingPublicExam ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '64px 0', gap: '16px' }}>
                <span className="material-symbols-outlined animate-spin text-primary" style={{ fontSize: '48px', color: 'rgb(var(--primary))' }}>sync</span>
                <p style={{ fontSize: '14px', color: secondaryText, margin: 0 }}>جاري تحميل أسئلة الامتحان...</p>
              </div>
            ) : publicExamError ? (
              <div style={{ textAlign: 'center', padding: '32px 0' }}>
                <span className="material-symbols-outlined" style={{ fontSize: '48px', color: 'rgb(var(--error))', marginBottom: '12px' }}>error</span>
                <p style={{ fontSize: '14.5px', color: themeText, fontWeight: '700' }}>{publicExamError}</p>
                <button className="btn btn-primary" onClick={handleClosePublicExam} style={{ marginTop: '16px' }}>حسناً</button>
              </div>
            ) : publicExamResult ? (
              /* Submissions Results Screen */
              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                <div 
                  style={{ 
                    textAlign: 'center', 
                    padding: '24px', 
                    borderRadius: '16px', 
                    background: 'rgba(52, 211, 153, 0.08)', 
                    border: '1px solid rgba(52, 211, 153, 0.2)',
                    marginBottom: '24px'
                  }}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: '48px', color: 'rgb(var(--primary))', marginBottom: '8px' }}>check_circle</span>
                  <h4 style={{ fontSize: '18px', fontWeight: '900', margin: '0 0 8px 0', color: themeText }}>اكتمل تسليم محاولتك بنجاح!</h4>
                  <div style={{ fontSize: '24px', fontWeight: '900', color: 'rgb(var(--primary))' }}>
                    درجتك: {publicExamResult.score} / {publicExamResult.max_score}
                  </div>
                  <p style={{ fontSize: '13px', color: secondaryText, marginTop: '8px', margin: 0 }}>
                    مراجعة تفصيلية لإجاباتك مع الحلول النموذجية معروضة بالأسفل:
                  </p>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                  {publicExamData?.questions?.map((q: any, idx: number) => {
                    const graded = publicExamResult.gradedQuestions?.[q.id];
                    const isCorrect = graded?.correct ?? false;
                    const chosen = graded?.chosenOption;
                    const correct = graded?.correctOption;

                    return (
                      <div 
                        key={q.id} 
                        style={{ 
                          border: isCorrect ? '1px solid rgba(52, 211, 153, 0.2)' : '1px solid rgba(239, 68, 68, 0.2)',
                          background: isCorrect ? 'rgba(52, 211, 153, 0.02)' : 'rgba(239, 68, 68, 0.02)',
                          padding: '20px', 
                          borderRadius: '16px',
                          textAlign: 'right'
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '16px' }}>
                          <span style={{ fontSize: '13px', fontWeight: 'bold', color: secondaryText }}>السؤال {idx + 1}</span>
                          <span 
                            style={{ 
                              fontSize: '11px', 
                              fontWeight: '900', 
                              padding: '2px 8px', 
                              borderRadius: '8px',
                              background: isCorrect ? 'rgba(52, 211, 153, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                              color: isCorrect ? 'rgb(var(--fusha-teal-400))' : 'rgb(var(--fusha-gold-700))'
                            }}
                          >
                            {isCorrect ? 'إجابة صحيحة' : 'إجابة خاطئة'}
                          </span>
                        </div>
                        <p style={{ fontSize: '14.5px', fontWeight: '800', marginTop: '10px', color: themeText, lineHeight: '1.6' }}>{q.question_text}</p>
                        {q.image_url && <ZoomableImage src={q.image_url} alt="" style={{ maxWidth: '100%', maxHeight: '200px', borderRadius: '8px', marginTop: '10px' }} />}
                        
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginTop: '16px' }}>
                          {q.options?.map((opt: string) => {
                            const isChosen = opt === chosen;
                            const isCorrectOpt = opt === correct;
                            let optBg = 'transparent';
                            let optBorder = isDarkMode ? '1px solid rgba(255,255,255,0.08)' : '1px solid rgba(0,0,0,0.08)';
                            let optColor = themeText;

                            if (isCorrectOpt) {
                              optBg = 'rgba(52, 211, 153, 0.15)';
                              optBorder = '1px solid rgb(var(--fusha-teal-400))';
                              optColor = 'rgb(var(--fusha-teal-400))';
                            } else if (isChosen && !isCorrectOpt) {
                              optBg = 'rgba(239, 68, 68, 0.15)';
                              optBorder = '1px solid rgb(var(--fusha-gold-700))';
                              optColor = 'rgb(var(--fusha-gold-700))';
                            }

                            return (
                              <div key={opt} style={{ padding: '10px 14px', borderRadius: '10px', border: optBorder, backgroundColor: optBg, color: optColor, fontSize: '13px', fontWeight: '700' }}>
                                {opt}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div style={{ display: 'flex', gap: '12px', marginTop: '32px' }}>
                  <button 
                    className="btn btn-primary flex-1" 
                    onClick={handleClosePublicExam}
                  >
                    إغلاق المراجعة
                  </button>
                  <button 
                    className="btn btn-secondary" 
                    onClick={() => {
                      if (publicExamData?.exam?.id) {
                        handleOpenPublicExam(publicExamData.exam.id);
                      }
                    }}
                    style={{ backgroundColor: isDarkMode ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)', color: themeText, border: 'none' }}
                  >
                    إعادة المحاولة
                  </button>
                </div>
              </div>
            ) : (
              /* Quiz Solving Screen */
              <div style={{ textAlign: 'right' }}>
                <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', marginBottom: '24px', fontSize: '12px', color: secondaryText }}>
                  <span className="flex items-center gap-1">
                    <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>checklist</span>
                    عدد الأسئلة: {publicExamData?.questions?.length || 0}
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>grade</span>
                    الدرجة النهائية: {publicExamData?.exam?.max_score || 0} درجة
                  </span>
                  {publicExamData?.exam?.time_limit_mins && (
                    <span className="flex items-center gap-1">
                      <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>timer</span>
                      الزمن: {publicExamData.exam.time_limit_mins} دقيقة
                    </span>
                  )}
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                  {publicExamData?.questions?.map((q: any, idx: number) => (
                    <div 
                      key={q.id} 
                      style={{ 
                        border: isDarkMode ? '1px solid rgba(255,255,255,0.05)' : '1px solid rgba(0,0,0,0.05)', 
                        background: isDarkMode ? 'rgba(255,255,255,0.01)' : 'rgba(0,0,0,0.01)', 
                        padding: '20px', 
                        borderRadius: '16px' 
                      }}
                    >
                      <span style={{ fontSize: '12px', fontWeight: 'bold', color: 'rgb(var(--primary))' }}>السؤال {idx + 1}</span>
                      <p style={{ fontSize: '14.5px', fontWeight: '800', marginTop: '8px', color: themeText, lineHeight: '1.6' }}>{q.question_text}</p>
                      {q.image_url && <ZoomableImage src={q.image_url} alt="" style={{ maxWidth: '100%', maxHeight: '240px', borderRadius: '8px', marginTop: '10px' }} />}
                      
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginTop: '16px' }}>
                        {q.options?.map((opt: string) => {
                          const isSelected = publicExamAnswers[q.id] === opt;
                          return (
                            <button
                              key={opt}
                              onClick={() => {
                                setPublicExamAnswers(prev => ({
                                  ...prev,
                                  [q.id]: opt
                                }));
                              }}
                              style={{
                                padding: '12px 16px',
                                borderRadius: '10px',
                                border: isSelected ? '2px solid rgb(var(--primary))' : isDarkMode ? '1px solid rgba(255,255,255,0.08)' : '1px solid rgba(0,0,0,0.08)',
                                backgroundColor: isSelected ? 'rgba(52, 211, 153, 0.08)' : 'transparent',
                                color: isSelected ? 'rgb(var(--primary))' : themeText,
                                fontSize: '13px',
                                fontWeight: '700',
                                cursor: 'pointer',
                                transition: 'all 0.15s ease',
                                textAlign: 'right'
                              }}
                            >
                              {opt}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>

                <div style={{ borderTop: isDarkMode ? '1px solid rgba(255,255,255,0.08)' : '1px solid rgba(0,0,0,0.08)', marginTop: '32px', paddingTop: '20px', display: 'flex', gap: '12px' }}>
                  <button 
                    className="btn btn-primary flex-1" 
                    onClick={handleSubmitPublicExam}
                    disabled={submittingPublicExam || Object.keys(publicExamAnswers).length === 0}
                  >
                    {submittingPublicExam ? 'جاري تصحيح الإجابات...' : 'تسليم الإجابات وعرض النتيجة'}
                  </button>
                  <button 
                    className="btn btn-secondary" 
                    onClick={handleClosePublicExam}
                    disabled={submittingPublicExam}
                    style={{ backgroundColor: isDarkMode ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)', color: themeText, border: 'none' }}
                  >
                    إلغاء
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default LoginRegister;

