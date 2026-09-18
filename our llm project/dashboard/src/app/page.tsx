'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

export default function HomeRedirect() {
  const router = useRouter();

  useEffect(() => {
    // Check if there is an active session
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        router.replace('/dashboard');
      } else {
        router.replace('/login');
      }
    });
  }, [router]);

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center gap-4 text-slate-400">
      <div className="relative w-12 h-12">
        <div className="absolute inset-0 rounded-full border-2 border-indigo-500/20" />
        <div className="absolute inset-0 rounded-full border-2 border-indigo-500 border-t-transparent animate-spin" />
      </div>
      <p className="text-xs font-medium animate-pulse">جاري توجيهك...</p>
    </div>
  );
}
