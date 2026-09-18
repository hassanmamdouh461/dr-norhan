import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Loader from './Loader';

interface ProtectedRouteProps {
  children: React.ReactNode;
  /** الوجهة عند عدم وجود جلسة. الافتراضي: صفحة تسجيل الدخول. */
  redirectTo?: string;
}

/**
 * حارس مسارات موحّد: لا يعرض المحتوى إلا بجلسة صالحة.
 *
 * - أثناء التحقق من الجلسة يعرض مُحمِّلاً بدل وميض الشاشة المحمية.
 * - عند غياب الجلسة يُوجِّه إلى /login ويحفظ الوجهة الأصلية في `state.from`
 *   حتى يستطيع الطالب العودة إليها بعد الدخول بدل أن يهبط على الرئيسية.
 */
export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
  children,
  redirectTo = '/login',
}) => {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return <Loader text="جاري التحقق من الجلسة..." size="large" fullscreen={true} />;
  }

  if (!user) {
    return (
      <Navigate
        to={redirectTo}
        replace
        state={{ from: `${location.pathname}${location.search}` }}
      />
    );
  }

  return <>{children}</>;
};

export default ProtectedRoute;
