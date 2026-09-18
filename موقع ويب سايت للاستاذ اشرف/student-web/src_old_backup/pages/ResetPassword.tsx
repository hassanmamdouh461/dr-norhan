import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { resetPassword } from '../services/auth';
import './ResetPassword.css';

/**
 * صفحة تعيين كلمة مرور جديدة.
 *
 * يصل الطالب إليها من رابط الاستعادة الذي يرسله الخادم إلى بريده، ويكون
 * الرابط على الشكل: `/reset-password?token=<token>`.
 * لا نقرأ الرمز من مسار الـ URL (`/reset-password/:token`) لأن الخادم يتحكم
 * في شكل الرابط المُرسَل، والـ query هو الشكل الأكثر شيوعاً في روابط البريد.
 */
export const ResetPassword: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const token = searchParams.get('token') || '';

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!token) {
      setError('رابط استعادة كلمة المرور غير صالح أو منتهي الصلاحية. يرجى طلب رابط جديد.');
    }
  }, [token]);

  // الحد الأدنى 8 رموز — مطابق لـ resetSchema في backend/src/routes/auth.ts.
  const isPasswordValid = (pw: string) => pw.length >= 8;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!token) {
      setError('رابط استعادة كلمة المرور غير صالح أو منتهي الصلاحية. يرجى طلب رابط جديد.');
      return;
    }
    if (!isPasswordValid(password)) {
      setError('كلمة المرور يجب أن تتكوّن من 8 رموز على الأقل.');
      return;
    }
    if (password !== confirmPassword) {
      setError('كلمتا المرور غير متطابقتين.');
      return;
    }

    setLoading(true);
    try {
      await resetPassword(token, password);
      setDone(true);
    } catch (err: any) {
      console.error(err);
      setError(
        err?.message ||
          'تعذر تعيين كلمة المرور. قد يكون الرابط منتهي الصلاحية — يرجى طلب رابط جديد.',
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="rp-shell" dir="rtl">
      <div className="rp-card">
        <div className="rp-brand">
          <span className="material-symbols-outlined rp-brand-icon" aria-hidden="true">lock_reset</span>
          <h1 className="rp-title">تعيين كلمة مرور جديدة</h1>
          <p className="rp-subtitle">
            اختر كلمة مرور قوية لحسابك على منصة فُصْحَى، ثم تابع رحلتك من حيث توقفت.
          </p>
        </div>

        {done ? (
          <>
            <div className="rp-alert rp-alert-success" role="status">
              تم تعيين كلمة المرور بنجاح. يمكنك الآن تسجيل الدخول بكلمة المرور الجديدة.
            </div>
            <button type="button" className="rp-btn" onClick={() => navigate('/login', { replace: true })}>
              الانتقال إلى تسجيل الدخول
            </button>
          </>
        ) : (
          <form onSubmit={handleSubmit} className="rp-form" noValidate>
            {error && (
              <div className="rp-alert rp-alert-error" role="alert">
                {error}
              </div>
            )}

            <div>
              <label className="rp-label" htmlFor="rp-password">كلمة المرور الجديدة</label>
              <input
                id="rp-password"
                type="password"
                className="rp-input"
                placeholder="8 رموز على الأقل"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="new-password"
                required
                minLength={8}
              />
            </div>

            <div>
              <label className="rp-label" htmlFor="rp-confirm">تأكيد كلمة المرور</label>
              <input
                id="rp-confirm"
                type="password"
                className="rp-input"
                placeholder="أعد كتابة كلمة المرور"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                autoComplete="new-password"
                required
              />
            </div>

            <button
              type="submit"
              className="rp-btn"
              disabled={loading || !token || !isPasswordValid(password) || password !== confirmPassword}
            >
              {loading ? 'جاري الحفظ...' : 'حفظ كلمة المرور'}
            </button>
          </form>
        )}

        <p className="rp-footer">
          تذكرت كلمة المرور؟ <Link to="/login">العودة لتسجيل الدخول</Link>
        </p>
      </div>
    </div>
  );
};

export default ResetPassword;
