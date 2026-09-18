'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getAccessToken } from '@/lib/auth';

export default function HomeRedirect() {
  const router = useRouter();

  useEffect(() => {
    // لا نتحقق من صلاحية الرمز هنا — الحارس في /dashboard/layout يتولّى ذلك
    // ويُجدّد الرمز أو يطرد الجلسة المنتهية. هنا نكتفي بالتوجيه الأولي.
    router.replace(getAccessToken() ? '/dashboard' : '/login');
  }, [router]);

  return (
    <div className="min-h-screen bg-canvas flex flex-col items-center justify-center gap-4 text-on-surface-variant">
      <div className="relative w-12 h-12">
        <div className="absolute inset-0 rounded-full border-2 border-primary/20" />
        <div className="absolute inset-0 rounded-full border-2 border-primary border-t-transparent animate-spin" />
      </div>
      <p className="text-xs font-medium animate-pulse">جاري توجيهك...</p>
    </div>
  );
}
