'use client';

import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis } from 'recharts';
import { apiGet, apiPost } from '@/lib/api';
import { isMockMode } from '@/lib/mock-mode';

interface AssistantPermissions {
  can_reset_devices: boolean;
  can_grade_quizzes: boolean;
  can_answer_questions: boolean;
  can_manage_codes: boolean;
  can_manage_courses: boolean;
}

type ListMeta = { page: number; limit: number; total: number; has_more: boolean };

type Overview = {
  total_students?: number;
  total_courses?: number;
  codes_used?: number;
  open_questions?: number;
  active_enrollments?: number;
  total_devices?: number;
  recent_enrollments?: Array<{ date: string; count: number }>;
  top_courses?: Array<{ title: string; count: number }>;
};

type Student = {
  id: string;
  full_name?: string;
  email?: string;
  grade?: string;
  last_seen_at?: string | null;
};

type Question = {
  id: string;
  subject?: string;
  message?: string;
  created_at?: string;
  student_name?: string;
};

type DeviceReset = {
  id: string;
  student_name?: string;
  full_name?: string;
  created_at?: string;
  reason?: string;
};

type NoticeCourse = { id: string; title: string };
type NoticeStudent = { id: string; full_name?: string; phone?: string };

function formatNumber(value: number) {
  return new Intl.NumberFormat('ar-EG').format(value);
}

function formatRelativeTime(value?: string | null) {
  if (!value) return 'لم يسجل نشاطًا بعد';
  const date = new Date(value);
  const minutes = Math.max(0, Math.floor((Date.now() - date.getTime()) / 60000));
  if (minutes < 60) return `منذ ${minutes || 1} دقيقة`;
  if (minutes < 1440) return `منذ ${Math.floor(minutes / 60)} ساعة`;
  return `منذ ${Math.floor(minutes / 1440)} يوم`;
}

function formatChartDay(value: string) {
  try {
    return new Date(value).toLocaleDateString('ar-EG', { month: 'short', day: 'numeric' });
  } catch {
    return value;
  }
}

function EnrollmentChartTooltip({ active, payload }: { active?: boolean; payload?: Array<{ value?: number; payload?: { date: string; count: number } }> }) {
  if (!active || !payload || !payload.length) return null;
  const point = payload[0]?.payload;
  if (!point) return null;
  return (
    <div className="rounded-lg border border-outline-variant bg-surface px-3 py-2 text-xs shadow-ambient">
      <p className="font-bold text-on-surface">{formatNumber(point.count)} تسجيل</p>
      <p className="mt-0.5 text-on-surface-variant">{formatChartDay(point.date)}</p>
    </div>
  );
}

function StatCard({
  title,
  value,
  description,
  icon,
  href,
  tone = 'primary',
}: {
  title: string;
  value: number;
  description: string;
  icon: string;
  href: string;
  tone?: 'primary' | 'violet' | 'amber' | 'slate' | 'rose' | 'teal';
}) {
  const tones = {
    primary: 'border-primary/15 bg-primary/5 text-primary',
    violet: 'border-violet-200 bg-violet-50 text-violet-700',
    amber: 'border-amber-200 bg-amber-50 text-amber-700',
    slate: 'border-slate-200 bg-slate-50 text-slate-700',
    rose: 'border-rose-200 bg-rose-50 text-rose-700',
    teal: 'border-success/25 bg-success-container/30 text-success',
  };

  return (
    <Link
      href={href}
      className="group rounded-lg border border-outline-variant bg-surface p-4 transition-all hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-ambient focus-visible:outline-none"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold text-on-surface-variant">{title}</p>
          <p className="mt-2 text-2xl font-bold text-on-surface">{formatNumber(value)}</p>
        </div>
        <span className={`flex h-10 w-10 items-center justify-center rounded-lg border ${tones[tone]}`}>
          <span className="material-symbols-outlined text-xl">{icon}</span>
        </span>
      </div>
      <p className="mt-3 text-xs leading-5 text-on-surface-variant">{description}</p>
    </Link>
  );
}

export default function DashboardHome() {
  // Signed-in staff member's role + (for assistants) their permission flags. Mirrors the
  // approach in dashboard/layout.tsx: role comes from the cached session in localStorage,
  // permissions come from /admin/me/permissions. Admins implicitly have every permission.
  const [role, setRole] = useState<'admin' | 'assistant'>('admin');
  const [permissions, setPermissions] = useState<AssistantPermissions | null>(null);
  const [roleLoading, setRoleLoading] = useState(true);

  const [overview, setOverview] = useState<Overview>({});
  const [recentStudents, setRecentStudents] = useState<Student[]>([]);
  const [pendingQuestions, setPendingQuestions] = useState<Question[]>([]);
  const [questionsTotal, setQuestionsTotal] = useState(0);
  const [deviceResets, setDeviceResets] = useState<DeviceReset[]>([]);
  const [deviceResetsTotal, setDeviceResetsTotal] = useState(0);
  const [coursesTotal, setCoursesTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [resetLoading, setResetLoading] = useState<string | null>(null);

  const [noticeTitle, setNoticeTitle] = useState('');
  const [noticeBody, setNoticeBody] = useState('');
  const [noticeState, setNoticeState] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
  const [noticeAudience, setNoticeAudience] = useState<'all' | 'course' | 'user'>('all');
  const [noticeCourseId, setNoticeCourseId] = useState('');
  const [noticeCourses, setNoticeCourses] = useState<NoticeCourse[]>([]);
  const [studentQuery, setStudentQuery] = useState('');
  const [studentResults, setStudentResults] = useState<NoticeStudent[]>([]);
  const [studentSearchLoading, setStudentSearchLoading] = useState(false);
  const [selectedNoticeStudent, setSelectedNoticeStudent] = useState<NoticeStudent | null>(null);

  useEffect(() => {
    const loadRole = async () => {
      if (isMockMode()) {
        setRole('admin');
        setRoleLoading(false);
        return;
      }
      try {
        const raw = typeof window !== 'undefined' ? localStorage.getItem('fusha_dashboard_session') : null;
        const parsed = raw ? JSON.parse(raw) : null;
        const currentRole: 'admin' | 'assistant' = parsed?.user?.role === 'assistant' ? 'assistant' : 'admin';
        setRole(currentRole);

        if (currentRole === 'assistant') {
          try {
            const perms = await apiGet<AssistantPermissions>('/admin/me/permissions');
            setPermissions(perms);
          } catch {
            setPermissions({ can_reset_devices: false, can_grade_quizzes: false, can_answer_questions: false, can_manage_codes: false, can_manage_courses: false });
          }
        }
      } catch {
        setRole('admin');
      } finally {
        setRoleLoading(false);
      }
    };

    loadRole();
  }, []);

  const loadAdminDashboard = useCallback(async () => {
    setLoading(true);
    setError('');

    const results = await Promise.allSettled([
      apiGet<Overview>('/admin/analytics/overview'),
      apiGet<{ students?: Student[] }>('/admin/students?page=1&limit=5'),
      apiGet<{ questions?: Question[] }>('/admin/questions?status=open&limit=5'),
      apiGet<{ reset_requests?: DeviceReset[] }>('/admin/device-resets?status=pending'),
    ]);

    const [overviewResult, studentsResult, questionsResult, resetsResult] = results;
    if (overviewResult.status === 'fulfilled') setOverview(overviewResult.value || {});
    if (studentsResult.status === 'fulfilled') setRecentStudents(studentsResult.value.students || []);
    if (questionsResult.status === 'fulfilled') setPendingQuestions(questionsResult.value.questions || []);
    if (resetsResult.status === 'fulfilled') setDeviceResets(resetsResult.value.reset_requests || []);

    if (results.some((result) => result.status === 'rejected')) {
      setError('تعذر تحديث بعض بيانات لوحة التحكم. تحقق من الاتصال ثم أعد المحاولة.');
    }

    setLastUpdated(new Date());
    setLoading(false);
  }, []);

  // Assistants don't have access to /admin/analytics/overview or the notification composer
  // (both are admin-only on the backend). Only fetch the sections their permissions allow.
  const loadAssistantDashboard = useCallback(async () => {
    setLoading(true);
    setError('');

    const jobs: Promise<void>[] = [];
    let hadError = false;

    if (permissions?.can_answer_questions) {
      jobs.push(
        apiGet<{ questions?: Question[]; meta?: ListMeta }>('/admin/questions?status=open&limit=5')
          .then((data) => {
            setPendingQuestions(data.questions || []);
            setQuestionsTotal(data.meta?.total ?? (data.questions || []).length);
          })
          .catch(() => { hadError = true; })
      );
    }

    if (permissions?.can_reset_devices) {
      jobs.push(
        apiGet<{ reset_requests?: DeviceReset[]; meta?: ListMeta }>('/admin/device-resets?status=pending&limit=5')
          .then((data) => {
            setDeviceResets(data.reset_requests || []);
            setDeviceResetsTotal(data.meta?.total ?? (data.reset_requests || []).length);
          })
          .catch(() => { hadError = true; })
      );
    }

    if (permissions?.can_manage_courses) {
      jobs.push(
        apiGet<{ meta?: ListMeta }>('/admin/courses?limit=1')
          .then((data) => setCoursesTotal(data.meta?.total ?? 0))
          .catch(() => { hadError = true; })
      );
    }

    await Promise.all(jobs);

    if (hadError) {
      setError('تعذر تحديث بعض بيانات لوحة التحكم. تحقق من الاتصال ثم أعد المحاولة.');
    }

    setLastUpdated(new Date());
    setLoading(false);
  }, [permissions]);

  const loadDashboardData = useCallback(async () => {
    if (role === 'assistant') {
      await loadAssistantDashboard();
    } else {
      await loadAdminDashboard();
    }
  }, [role, loadAdminDashboard, loadAssistantDashboard]);

  useEffect(() => {
    if (!roleLoading) {
      loadDashboardData();
    }
  }, [roleLoading, loadDashboardData]);

  // Preload the courses list for the announcement composer's "course" audience picker (admin only).
  useEffect(() => {
    if (roleLoading || role !== 'admin' || isMockMode()) return;
    apiGet<{ courses?: NoticeCourse[] }>('/admin/courses?limit=50')
      .then((data) => setNoticeCourses(data.courses || []))
      .catch(() => {});
  }, [role, roleLoading]);

  // Debounced student search for the announcement composer's "user" audience picker (admin only).
  useEffect(() => {
    if (noticeAudience !== 'user' || !studentQuery.trim()) {
      setStudentResults([]);
      return;
    }
    setStudentSearchLoading(true);
    const timeout = setTimeout(() => {
      apiGet<{ students?: NoticeStudent[] }>(`/admin/students?search=${encodeURIComponent(studentQuery.trim())}&limit=5`)
        .then((data) => setStudentResults(data.students || []))
        .catch(() => setStudentResults([]))
        .finally(() => setStudentSearchLoading(false));
    }, 400);
    return () => clearTimeout(timeout);
  }, [studentQuery, noticeAudience]);

  const enrollmentsThisWeek = useMemo(
    () => (overview.recent_enrollments || []).reduce((total, item) => total + Number(item.count || 0), 0),
    [overview.recent_enrollments]
  );

  const chartData = useMemo(() => {
    const data = overview.recent_enrollments || [];
    if (data.length < 2) return null;
    return data.map((item) => ({ date: item.date, count: Number(item.count || 0) }));
  }, [overview.recent_enrollments]);

  const handleReset = async (id: string, action: 'approved' | 'rejected') => {
    const message = action === 'approved' ? 'هل تريد الموافقة على فك ربط أجهزة هذا الطالب؟' : 'هل تريد رفض هذا الطلب؟';
    if (!window.confirm(message)) return;

    setResetLoading(id);
    try {
      await apiPost(`/admin/device-resets/${id}/action`, { action });
      setDeviceResets((current) => current.filter((request) => request.id !== id));
      loadDashboardData();
    } catch (requestError: any) {
      setError(requestError.message || 'تعذر تنفيذ الإجراء. حاول مرة أخرى.');
    } finally {
      setResetLoading(null);
    }
  };

  const sendNotice = async (event: FormEvent) => {
    event.preventDefault();
    if (!noticeTitle.trim() || !noticeBody.trim()) return;
    if (noticeAudience === 'course' && !noticeCourseId) {
      setNoticeState('error');
      setError('يرجى اختيار الكورس المستهدف قبل الإرسال.');
      return;
    }
    if (noticeAudience === 'user' && !selectedNoticeStudent) {
      setNoticeState('error');
      setError('يرجى اختيار الطالب المستهدف قبل الإرسال.');
      return;
    }

    setNoticeState('sending');
    try {
      await apiPost('/admin/notifications/send', {
        audience: noticeAudience,
        course_id: noticeAudience === 'course' ? noticeCourseId : undefined,
        recipient_id: noticeAudience === 'user' ? selectedNoticeStudent?.id : undefined,
        title: noticeTitle.trim(),
        body: noticeBody.trim(),
      });
      setNoticeTitle('');
      setNoticeBody('');
      setNoticeState('sent');
      setNoticeAudience('all');
      setNoticeCourseId('');
      setSelectedNoticeStudent(null);
      setStudentQuery('');
    } catch (requestError: any) {
      setNoticeState('error');
      setError(requestError.message || 'تعذر إرسال التنبيه. حاول مرة أخرى.');
    }
  };

  const stats = [
    { title: 'إجمالي الطلاب', value: overview.total_students || 0, description: 'كل الحسابات المسجلة على المنصة', icon: 'groups', href: '/dashboard/students', tone: 'primary' as const },
    { title: 'تسجيلات آخر 7 أيام', value: enrollmentsThisWeek, description: 'طلاب انضموا أو فعّلوا اشتراكًا حديثًا', icon: 'trending_up', href: '/dashboard/students', tone: 'teal' as const },
    { title: 'الأسئلة المنتظرة', value: overview.open_questions || pendingQuestions.length, description: 'تحتاج ردًا من فريق التدريس', icon: 'forum', href: '/dashboard/questions', tone: 'amber' as const },
    { title: 'طلبات الأجهزة', value: deviceResets.length, description: 'طلبات فك الربط التي تحتاج قرارًا', icon: 'phonelink_erase', href: '/dashboard/device-resets', tone: 'rose' as const },
    { title: 'الدورات المنشورة', value: overview.total_courses || 0, description: 'محتوى متاح للطلاب حاليًا', icon: 'menu_book', href: '/dashboard/courses', tone: 'violet' as const },
    { title: 'رموز مفعّلة', value: overview.codes_used || 0, description: 'أكواد استخدمها الطلاب بنجاح', icon: 'vpn_key', href: '/dashboard/codes', tone: 'slate' as const },
    { title: 'الاشتراكات النشطة', value: overview.active_enrollments || 0, description: 'تسجيلات فعّالة حاليًا عبر كل الكورسات', icon: 'verified', href: '/dashboard/students', tone: 'teal' as const },
    { title: 'الأجهزة المسجلة', value: overview.total_devices || 0, description: 'إجمالي الأجهزة المرتبطة بحسابات الطلاب', icon: 'devices', href: '/dashboard/device-resets', tone: 'slate' as const },
  ];

  if (roleLoading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <span className="material-symbols-outlined animate-spin text-3xl text-primary">progress_activity</span>
      </div>
    );
  }

  // ── Simplified assistant home: only shows sections the assistant's permissions allow. ──
  if (role === 'assistant') {
    const hasAnyPermission = !!(
      permissions?.can_answer_questions ||
      permissions?.can_reset_devices ||
      permissions?.can_manage_courses ||
      permissions?.can_manage_codes
    );

    return (
      <div className="space-y-6 animate-in fade-in duration-300">
        <section className="flex flex-col justify-between gap-4 border-b border-outline-variant pb-5 sm:flex-row sm:items-end">
          <div className="min-w-0">
            <p className="text-xs font-semibold text-primary">مرحبًا بك</p>
            <h1 className="mt-1 text-2xl font-bold leading-tight text-on-surface sm:text-3xl">لوحة المساعد</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-on-surface-variant">لمحة سريعة عن المهام المتاحة لك بحسب الصلاحيات التي منحك إياها المشرف.</p>
          </div>
          <div className="flex items-center gap-3">
            <span className="hidden text-xs text-on-surface-variant sm:inline">{lastUpdated ? `آخر تحديث: ${lastUpdated.toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}` : 'جارٍ تحديث البيانات'}</span>
            <button onClick={loadDashboardData} disabled={loading} className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-outline-variant bg-surface px-4 text-xs font-bold text-on-surface transition hover:border-primary/40 hover:text-primary disabled:opacity-60">
              <span className={`material-symbols-outlined text-base ${loading ? 'animate-spin' : ''}`}>refresh</span>
              تحديث
            </button>
          </div>
        </section>

        {error && (
          <div role="alert" className="flex flex-col gap-3 rounded-lg border border-error/20 bg-error-container/30 p-4 text-sm text-on-error-container sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-2">
              <span className="material-symbols-outlined mt-0.5 text-error">wifi_off</span>
              <span>{error}</span>
            </div>
            <div className="flex gap-3 text-xs font-bold">
              <button onClick={loadDashboardData} className="text-error hover:underline">إعادة المحاولة</button>
              <button onClick={() => setError('')} className="text-on-surface-variant hover:underline">إخفاء</button>
            </div>
          </div>
        )}

        {!hasAnyPermission ? (
          <div className="rounded-lg border border-dashed border-outline-variant bg-surface p-10 text-center text-sm text-on-surface-variant">
            لا توجد صلاحيات مفعّلة لحسابك بعد. تواصل مع المشرف لتفعيل الأقسام التي تحتاجها.
          </div>
        ) : (
          <>
            <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {permissions?.can_answer_questions && (
                <StatCard title="الأسئلة المنتظرة" value={questionsTotal} description="أسئلة الطلاب بانتظار ردك" icon="forum" href="/dashboard/questions" tone="amber" />
              )}
              {permissions?.can_reset_devices && (
                <StatCard title="طلبات الأجهزة" value={deviceResetsTotal} description="طلبات فك ربط بانتظار المراجعة" icon="phonelink_erase" href="/dashboard/device-resets" tone="rose" />
              )}
              {permissions?.can_manage_courses && (
                <StatCard title="الدورات المنشورة" value={coursesTotal} description="يمكنك إدارتها وتحديث محتواها" icon="menu_book" href="/dashboard/courses" tone="violet" />
              )}
            </section>

            <section className="grid grid-cols-1 gap-5 xl:grid-cols-2">
              {permissions?.can_answer_questions && (
                <div className="rounded-lg border border-outline-variant bg-surface">
                  <div className="flex items-center justify-between border-b border-outline-variant p-5">
                    <div><h2 className="text-base font-bold text-on-surface">أسئلة تنتظر الرد</h2><p className="mt-1 text-xs text-on-surface-variant">أعط الأولوية للأسئلة الأقدم.</p></div>
                    <Link href="/dashboard/questions" className="text-xs font-bold text-primary hover:underline">فتح صندوق الأسئلة</Link>
                  </div>
                  {loading ? <div className="h-44 animate-pulse bg-surface-container-low" /> : pendingQuestions.length ? (
                    <div className="divide-y divide-outline-variant">
                      {pendingQuestions.map((question) => (
                        <Link key={question.id} href="/dashboard/questions" className="block px-5 py-4 transition hover:bg-surface-container-low">
                          <p className="truncate text-sm font-bold text-on-surface">{question.subject || question.message || 'سؤال جديد'}</p>
                          <p className="mt-1 truncate text-xs text-on-surface-variant">{question.student_name || 'طالب'} · {formatRelativeTime(question.created_at)}</p>
                        </Link>
                      ))}
                    </div>
                  ) : <div className="p-10 text-center text-sm text-on-surface-variant">لا توجد أسئلة معلقة. عمل ممتاز.</div>}
                </div>
              )}

              {permissions?.can_reset_devices && (
                <div className="rounded-lg border border-outline-variant bg-surface p-5">
                  <div className="flex items-center justify-between border-b border-outline-variant pb-4"><div><h2 className="text-base font-bold text-on-surface">طلبات الأجهزة</h2><p className="mt-1 text-xs text-on-surface-variant">اتخذ قرارك دون مغادرة الصفحة.</p></div><Link href="/dashboard/device-resets" className="text-xs font-bold text-primary hover:underline">الكل</Link></div>
                  {loading ? <div className="mt-4 h-40 animate-pulse rounded-lg bg-surface-container-low" /> : deviceResets.length ? (
                    <div className="mt-3 space-y-3">
                      {deviceResets.slice(0, 5).map((request) => (
                        <div key={request.id} className="rounded-lg border border-outline-variant p-3">
                          <p className="text-xs font-bold text-on-surface">{request.student_name || request.full_name || 'طالب'}</p>
                          <p className="mt-1 text-xs text-on-surface-variant">{request.reason || 'طلب فك ربط جهاز'} · {formatRelativeTime(request.created_at)}</p>
                          <div className="mt-3 flex gap-2">
                            <button disabled={resetLoading === request.id} onClick={() => handleReset(request.id, 'approved')} className="flex-1 rounded-md bg-primary px-3 py-2 text-xs font-bold text-on-primary disabled:opacity-50">موافقة</button>
                            <button disabled={resetLoading === request.id} onClick={() => handleReset(request.id, 'rejected')} className="rounded-md border border-outline-variant px-3 py-2 text-xs font-bold text-on-surface-variant disabled:opacity-50">رفض</button>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : <div className="mt-4 rounded-lg border border-dashed border-outline-variant p-6 text-center text-xs text-on-surface-variant">لا توجد طلبات أجهزة معلّقة الآن.</div>}
                </div>
              )}
            </section>

            {(permissions?.can_manage_courses || permissions?.can_manage_codes) && (
              <section className="rounded-lg border border-outline-variant bg-surface p-5">
                <h2 className="text-base font-bold text-on-surface">اختصارات سريعة</h2>
                <div className="mt-3 flex flex-wrap gap-2">
                  {permissions?.can_manage_courses && (
                    <Link href="/dashboard/courses" className="inline-flex items-center gap-2 rounded-lg border border-outline-variant px-4 py-2 text-xs font-bold text-on-surface transition hover:border-primary/40 hover:text-primary">
                      <span className="material-symbols-outlined text-base">menu_book</span>
                      إدارة الدورات
                    </Link>
                  )}
                  {permissions?.can_manage_codes && (
                    <Link href="/dashboard/codes" className="inline-flex items-center gap-2 rounded-lg border border-outline-variant px-4 py-2 text-xs font-bold text-on-surface transition hover:border-primary/40 hover:text-primary">
                      <span className="material-symbols-outlined text-base">vpn_key</span>
                      رموز التفعيل
                    </Link>
                  )}
                </div>
              </section>
            )}
          </>
        )}
      </div>
    );
  }

  // ── Full admin home ──
  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <section className="flex flex-col justify-between gap-4 border-b border-outline-variant pb-5 sm:flex-row sm:items-end">
        <div className="min-w-0">
          <p className="text-xs font-semibold text-primary">نظرة تشغيلية</p>
          <h1 className="mt-1 text-2xl font-bold leading-tight text-on-surface sm:text-3xl">ما الذي يحتاج متابعة اليوم؟</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-on-surface-variant">تابع القرارات المهمة، الطلاب الجدد، والأسئلة والطلبات المعلّقة من مكان واحد.</p>
        </div>
        <div className="flex items-center gap-3">
          <span className="hidden text-xs text-on-surface-variant sm:inline">{lastUpdated ? `آخر تحديث: ${lastUpdated.toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}` : 'جارٍ تحديث البيانات'}</span>
          <button onClick={loadDashboardData} disabled={loading} className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-outline-variant bg-surface px-4 text-xs font-bold text-on-surface transition hover:border-primary/40 hover:text-primary disabled:opacity-60">
            <span className={`material-symbols-outlined text-base ${loading ? 'animate-spin' : ''}`}>refresh</span>
            تحديث
          </button>
          <Link href="/dashboard/courses" className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-primary px-4 text-xs font-bold text-on-primary shadow-ambient transition hover:bg-primary-container">
            <span className="material-symbols-outlined text-base">add</span>
            دورة جديدة
          </Link>
        </div>
      </section>

      {error && (
        <div role="alert" className="flex flex-col gap-3 rounded-lg border border-error/20 bg-error-container/30 p-4 text-sm text-on-error-container sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-2">
            <span className="material-symbols-outlined mt-0.5 text-error">wifi_off</span>
            <span>{error}</span>
          </div>
          <div className="flex gap-3 text-xs font-bold">
            <button onClick={loadDashboardData} className="text-error hover:underline">إعادة المحاولة</button>
            <button onClick={() => setError('')} className="text-on-surface-variant hover:underline">إخفاء</button>
          </div>
        </div>
      )}

      <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {stats.map((stat) => <StatCard key={stat.title} {...stat} />)}
      </section>

      <section className="grid grid-cols-1 gap-5 xl:grid-cols-3">
        <div className="rounded-lg border border-outline-variant bg-surface p-5 xl:col-span-2">
          <div className="flex flex-wrap items-start justify-between gap-3 border-b border-outline-variant pb-4">
            <div>
              <h2 className="text-base font-bold text-on-surface">نمو التسجيلات</h2>
              <p className="mt-1 text-xs text-on-surface-variant">عدد الاشتراكات والتفعيلات خلال آخر 7 أيام.</p>
            </div>
            <span className="rounded-md bg-primary/10 px-3 py-1.5 text-xs font-bold text-primary">{formatNumber(enrollmentsThisWeek)} تسجيل جديد</span>
          </div>
          {chartData ? (
            <div className="mt-4 h-56 min-w-[280px] w-full" role="img" aria-label="رسم نمو التسجيلات خلال آخر سبعة أيام">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 12, right: 12, left: 12, bottom: 0 }}>
                  <defs>
                    <linearGradient id="enrollmentArea" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="rgb(var(--primary))" stopOpacity={0.26} />
                      <stop offset="100%" stopColor="rgb(var(--primary))" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid vertical={false} stroke="rgb(var(--outline-variant))" />
                  <XAxis
                    dataKey="date"
                    tickFormatter={(value: string) => value.slice(5)}
                    tick={{ fill: 'rgb(var(--on-surface-variant))', fontSize: 11 }}
                    axisLine={{ stroke: 'rgb(var(--outline-variant))' }}
                    tickLine={false}
                  />
                  <Tooltip content={<EnrollmentChartTooltip />} cursor={{ stroke: 'rgb(var(--outline-variant))', strokeWidth: 1 }} />
                  <Area
                    type="monotone"
                    dataKey="count"
                    stroke="rgb(var(--primary))"
                    strokeWidth={3}
                    fill="url(#enrollmentArea)"
                    dot={{ r: 5, fill: 'rgb(var(--surface))', stroke: 'rgb(var(--primary))', strokeWidth: 3 }}
                    activeDot={{ r: 6 }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="mt-4 flex min-h-56 flex-col items-center justify-center rounded-lg border border-dashed border-outline-variant bg-surface-container-low p-6 text-center">
              <span className="material-symbols-outlined text-3xl text-outline">query_stats</span>
              <p className="mt-3 text-sm font-bold text-on-surface">ستظهر الاتجاهات بعد أول تسجيلات</p>
              <p className="mt-1 text-xs text-on-surface-variant">لا توجد بيانات كافية للرسم خلال الفترة الحالية.</p>
            </div>
          )}
        </div>

        <div className="rounded-lg border border-outline-variant bg-surface p-5">
          <div className="flex items-center justify-between border-b border-outline-variant pb-4">
            <div>
              <h2 className="text-base font-bold text-on-surface">إجراءات اليوم</h2>
              <p className="mt-1 text-xs text-on-surface-variant">ابدأ بالأعلى تأثيرًا.</p>
            </div>
            <span className="material-symbols-outlined text-primary">task_alt</span>
          </div>
          <div className="mt-3 space-y-2">
            <Link href="/dashboard/questions" className="flex items-center justify-between gap-3 rounded-lg border border-outline-variant p-3 transition hover:border-amber-300 hover:bg-amber-50/40">
              <span className="flex min-w-0 items-center gap-3"><span className="material-symbols-outlined text-amber-600">forum</span><span className="text-xs font-bold text-on-surface">الرد على الأسئلة المعلّقة</span></span>
              <span className="rounded bg-amber-100 px-2 py-1 text-xs font-bold text-amber-800">{formatNumber(overview.open_questions || pendingQuestions.length)}</span>
            </Link>
            <Link href="/dashboard/device-resets" className="flex items-center justify-between gap-3 rounded-lg border border-outline-variant p-3 transition hover:border-rose-300 hover:bg-rose-50/40">
              <span className="flex min-w-0 items-center gap-3"><span className="material-symbols-outlined text-rose-600">phonelink_erase</span><span className="text-xs font-bold text-on-surface">مراجعة طلبات الأجهزة</span></span>
              <span className="rounded bg-rose-100 px-2 py-1 text-xs font-bold text-rose-800">{formatNumber(deviceResets.length)}</span>
            </Link>
            <Link href="/dashboard/students" className="flex items-center justify-between gap-3 rounded-lg border border-outline-variant p-3 transition hover:border-primary/30 hover:bg-primary/5">
              <span className="flex min-w-0 items-center gap-3"><span className="material-symbols-outlined text-primary">person_search</span><span className="text-xs font-bold text-on-surface">متابعة المسجلين الجدد</span></span>
              <span className="material-symbols-outlined text-on-surface-variant">chevron_left</span>
            </Link>
          </div>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-5 xl:grid-cols-3">
        <div className="rounded-lg border border-outline-variant bg-surface xl:col-span-2">
          <div className="flex items-center justify-between border-b border-outline-variant p-5">
            <div><h2 className="text-base font-bold text-on-surface">طلاب انضموا مؤخرًا</h2><p className="mt-1 text-xs text-on-surface-variant">آخر الحسابات التي تحتاج ترحيبًا أو متابعة.</p></div>
            <Link href="/dashboard/students" className="text-xs font-bold text-primary hover:underline">عرض الطلاب</Link>
          </div>
          {loading ? <div className="h-52 animate-pulse bg-surface-container-low" /> : recentStudents.length ? (
            <div className="divide-y divide-outline-variant">
              {recentStudents.map((student) => (
                <Link key={student.id} href="/dashboard/students" className="flex items-center justify-between gap-4 px-5 py-4 transition hover:bg-surface-container-low">
                  <div className="min-w-0"><p className="truncate text-sm font-bold text-on-surface">{student.full_name || 'طالب جديد'}</p><p className="mt-1 truncate text-xs text-on-surface-variant">{student.grade || 'المرحلة غير محددة'} · {student.email || 'لا يوجد بريد'}</p></div>
                  <span className="shrink-0 text-xs text-on-surface-variant">{formatRelativeTime(student.last_seen_at)}</span>
                </Link>
              ))}
            </div>
          ) : <div className="p-10 text-center text-sm text-on-surface-variant">لا توجد تسجيلات حديثة لعرضها.</div>}
        </div>

        <div className="rounded-lg border border-outline-variant bg-surface p-5">
          <div className="flex items-center justify-between border-b border-outline-variant pb-4"><div><h2 className="text-base font-bold text-on-surface">طلبات الأجهزة</h2><p className="mt-1 text-xs text-on-surface-variant">اتخذ قرارك دون مغادرة الصفحة.</p></div><Link href="/dashboard/device-resets" className="text-xs font-bold text-primary hover:underline">الكل</Link></div>
          {loading ? <div className="mt-4 h-40 animate-pulse rounded-lg bg-surface-container-low" /> : deviceResets.length ? <div className="mt-3 space-y-3">{deviceResets.slice(0, 3).map((request) => <div key={request.id} className="rounded-lg border border-outline-variant p-3"><p className="text-xs font-bold text-on-surface">{request.student_name || request.full_name || 'طالب'}</p><p className="mt-1 text-xs text-on-surface-variant">{request.reason || 'طلب فك ربط جهاز'} · {formatRelativeTime(request.created_at)}</p><div className="mt-3 flex gap-2"><button disabled={resetLoading === request.id} onClick={() => handleReset(request.id, 'approved')} className="flex-1 rounded-md bg-primary px-3 py-2 text-xs font-bold text-on-primary disabled:opacity-50">موافقة</button><button disabled={resetLoading === request.id} onClick={() => handleReset(request.id, 'rejected')} className="rounded-md border border-outline-variant px-3 py-2 text-xs font-bold text-on-surface-variant disabled:opacity-50">رفض</button></div></div>)}</div> : <div className="mt-4 rounded-lg border border-dashed border-outline-variant p-6 text-center text-xs text-on-surface-variant">لا توجد طلبات أجهزة معلّقة الآن.</div>}
        </div>
      </section>

      <section className="rounded-lg border border-outline-variant bg-surface">
        <div className="flex items-center justify-between border-b border-outline-variant p-5">
          <div>
            <h2 className="text-base font-bold text-on-surface">أفضل الكورسات</h2>
            <p className="mt-1 text-xs text-on-surface-variant">الأعلى تسجيلاً بين الطلاب حاليًا (أفضل 5 كورسات).</p>
          </div>
          <Link href="/dashboard/courses" className="text-xs font-bold text-primary hover:underline">إدارة الكورسات</Link>
        </div>
        {loading ? <div className="h-40 animate-pulse bg-surface-container-low" /> : (overview.top_courses || []).length ? (
          <div className="divide-y divide-outline-variant">
            {(overview.top_courses || []).map((course, index) => (
              <div key={`${course.title}-${index}`} className="flex items-center justify-between gap-3 px-5 py-4">
                <div className="flex min-w-0 items-center gap-3">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">{index + 1}</span>
                  <p className="truncate text-sm font-bold text-on-surface">{course.title}</p>
                </div>
                <span className="shrink-0 rounded-md bg-primary/10 px-2.5 py-1 text-xs font-bold text-primary">{formatNumber(course.count)} تسجيل</span>
              </div>
            ))}
          </div>
        ) : <div className="p-10 text-center text-sm text-on-surface-variant">لا توجد بيانات تسجيل كافية لعرض ترتيب الكورسات بعد.</div>}
      </section>

      <section className="grid grid-cols-1 gap-5 xl:grid-cols-2">
        <div className="rounded-lg border border-outline-variant bg-surface">
          <div className="flex items-center justify-between border-b border-outline-variant p-5"><div><h2 className="text-base font-bold text-on-surface">أسئلة تنتظر الرد</h2><p className="mt-1 text-xs text-on-surface-variant">أعط الأولوية للأسئلة الأقدم.</p></div><Link href="/dashboard/questions" className="text-xs font-bold text-primary hover:underline">فتح صندوق الأسئلة</Link></div>
          {loading ? <div className="h-44 animate-pulse bg-surface-container-low" /> : pendingQuestions.length ? <div className="divide-y divide-outline-variant">{pendingQuestions.map((question) => <Link key={question.id} href="/dashboard/questions" className="block px-5 py-4 transition hover:bg-surface-container-low"><p className="truncate text-sm font-bold text-on-surface">{question.subject || question.message || 'سؤال جديد'}</p><p className="mt-1 truncate text-xs text-on-surface-variant">{question.student_name || 'طالب'} · {formatRelativeTime(question.created_at)}</p></Link>)}</div> : <div className="p-10 text-center text-sm text-on-surface-variant">لا توجد أسئلة معلقة. عمل ممتاز.</div>}
        </div>

        <form onSubmit={sendNotice} className="rounded-lg border border-outline-variant bg-surface p-5">
          <div className="flex items-center gap-3 border-b border-outline-variant pb-4"><span className="material-symbols-outlined text-primary">campaign</span><div><h2 className="text-base font-bold text-on-surface">إرسال تنبيه للطلاب</h2><p className="mt-1 text-xs text-on-surface-variant">اختر الفئة المستهدفة ثم أرسل رسالة قصيرة وواضحة.</p></div></div>
          <div className="mt-4 grid gap-3">
            <div className="grid gap-1.5 text-xs font-bold text-on-surface">
              <span>الفئة المستهدفة</span>
              <div className="flex flex-wrap gap-2">
                <button type="button" onClick={() => setNoticeAudience('all')} className={`rounded-lg border px-3 py-2 text-xs font-bold transition ${noticeAudience === 'all' ? 'border-primary bg-primary/10 text-primary' : 'border-outline-variant text-on-surface-variant hover:border-primary/40'}`}>الكل</button>
                <button type="button" onClick={() => setNoticeAudience('course')} className={`rounded-lg border px-3 py-2 text-xs font-bold transition ${noticeAudience === 'course' ? 'border-primary bg-primary/10 text-primary' : 'border-outline-variant text-on-surface-variant hover:border-primary/40'}`}>كورس معيّن</button>
                <button type="button" onClick={() => setNoticeAudience('user')} className={`rounded-lg border px-3 py-2 text-xs font-bold transition ${noticeAudience === 'user' ? 'border-primary bg-primary/10 text-primary' : 'border-outline-variant text-on-surface-variant hover:border-primary/40'}`}>طالب معيّن</button>
              </div>
            </div>

            {noticeAudience === 'course' && (
              <label className="grid gap-1.5 text-xs font-bold text-on-surface">
                <span>الكورس المستهدف</span>
                <select value={noticeCourseId} onChange={(event) => setNoticeCourseId(event.target.value)} className="h-10 rounded-lg border border-outline-variant bg-surface px-3 text-sm font-normal outline-none transition focus:border-primary">
                  <option value="">اختر كورسًا...</option>
                  {noticeCourses.map((course) => <option key={course.id} value={course.id}>{course.title}</option>)}
                </select>
              </label>
            )}

            {noticeAudience === 'user' && (
              <div className="grid gap-1.5 text-xs font-bold text-on-surface">
                <span>البحث عن طالب (بالاسم أو رقم الهاتف)</span>
                {selectedNoticeStudent ? (
                  <div className="flex items-center justify-between rounded-lg border border-primary/30 bg-primary/5 px-3 py-2 text-xs">
                    <span className="font-bold text-on-surface">{selectedNoticeStudent.full_name || 'طالب'} {selectedNoticeStudent.phone ? `· ${selectedNoticeStudent.phone}` : ''}</span>
                    <button type="button" onClick={() => { setSelectedNoticeStudent(null); setStudentQuery(''); }} className="font-bold text-on-surface-variant hover:text-error">تغيير</button>
                  </div>
                ) : (
                  <>
                    <input value={studentQuery} onChange={(event) => setStudentQuery(event.target.value)} placeholder="اكتب اسم الطالب أو رقم هاتفه..." className="h-10 rounded-lg border border-outline-variant bg-surface px-3 text-sm font-normal outline-none transition focus:border-primary" />
                    {studentSearchLoading && <p className="text-[11px] font-normal text-on-surface-variant">جارٍ البحث...</p>}
                    {studentResults.length > 0 && (
                      <div className="max-h-40 divide-y divide-outline-variant overflow-y-auto rounded-lg border border-outline-variant">
                        {studentResults.map((student) => (
                          <button type="button" key={student.id} onClick={() => { setSelectedNoticeStudent(student); setStudentResults([]); }} className="flex w-full items-center justify-between px-3 py-2 text-start text-xs transition hover:bg-surface-container-low">
                            <span className="font-bold text-on-surface">{student.full_name || 'طالب'}</span>
                            <span className="font-normal text-on-surface-variant">{student.phone || ''}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </div>
            )}

            <label className="grid gap-1.5 text-xs font-bold text-on-surface"><span>العنوان</span><input value={noticeTitle} onChange={(event) => setNoticeTitle(event.target.value)} maxLength={80} placeholder="مثال: موعد مراجعة مباشر" className="h-10 rounded-lg border border-outline-variant bg-surface px-3 text-sm font-normal outline-none transition focus:border-primary" /></label>
            <label className="grid gap-1.5 text-xs font-bold text-on-surface"><span>الرسالة</span><textarea value={noticeBody} onChange={(event) => setNoticeBody(event.target.value)} maxLength={240} rows={3} placeholder="اكتب الرسالة التي يحتاج الطلاب معرفتها." className="resize-none rounded-lg border border-outline-variant bg-surface p-3 text-sm font-normal outline-none transition focus:border-primary" /></label>
          </div>
          <div className="mt-4 flex items-center justify-between gap-3">
            <span className={`text-xs ${noticeState === 'sent' ? 'text-success' : noticeState === 'error' ? 'text-error' : 'text-on-surface-variant'}`}>
              {noticeState === 'sent'
                ? 'تم إرسال التنبيه بنجاح.'
                : noticeState === 'error'
                  ? 'تعذر الإرسال، أعد المحاولة.'
                  : noticeAudience === 'all'
                    ? 'سيصل التنبيه لجميع الطلاب النشطين.'
                    : noticeAudience === 'course'
                      ? 'سيصل التنبيه لطلاب الكورس المحدد فقط.'
                      : 'سيصل التنبيه لهذا الطالب فقط.'}
            </span>
            <button
              disabled={
                noticeState === 'sending' ||
                !noticeTitle.trim() ||
                !noticeBody.trim() ||
                (noticeAudience === 'course' && !noticeCourseId) ||
                (noticeAudience === 'user' && !selectedNoticeStudent)
              }
              className="inline-flex h-10 items-center gap-2 rounded-lg bg-primary px-4 text-xs font-bold text-on-primary disabled:opacity-50"
            >
              <span className={`material-symbols-outlined text-base ${noticeState === 'sending' ? 'animate-spin' : ''}`}>{noticeState === 'sending' ? 'sync' : 'send'}</span>
              إرسال
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
