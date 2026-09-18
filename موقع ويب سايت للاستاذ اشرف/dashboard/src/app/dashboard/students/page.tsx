'use client';

import { useState, useEffect, useCallback } from 'react';
import { api, apiPatch, apiDelete, apiPost } from '@/lib/api';

interface Student {
  id: string; 
  full_name: string; 
  email: string; 
  phone: string; 
  grade: string; 
  governorate: string;
  status: string; 
  max_devices: number; 
  enrollments_count: number; 
  devices_count: number;
  created_at: string; 
  last_seen_at: string | null;
  student_code: string | null;
}

interface Course {
  id: string;
  title: string;
  grade: string;
}

interface Device {
  id: string;
  device_id: string;
  platform: string;
  model: string | null;
  is_trusted: number;
  is_rooted: number;
  last_login_at: string | null;
  created_at: string;
}

export default function StudentsPage() {
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState('');
  
  // Student detail modal state
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [activeTab, setActiveTab] = useState<'financials' | 'playback' | 'quizzes' | 'devices'>('financials');

  const [financials, setFinancials] = useState<any[]>([]);
  const [playbackLogs, setPlaybackLogs] = useState<any[]>([]);
  const [quizAttempts, setQuizAttempts] = useState<any[]>([]);
  const [devices, setDevices] = useState<Device[]>([]);
  const [devicesLoading, setDevicesLoading] = useState(false);
  const [deviceActionId, setDeviceActionId] = useState<string | null>(null);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [courses, setCourses] = useState<Course[]>([]);

  // Manual transaction form state
  const [txAmount, setTxAmount] = useState('');
  const [txCourseId, setTxCourseId] = useState('');
  const [txNote, setTxNote] = useState('');
  const [txLoading, setTxLoading] = useState(false);

  // Manual course enrollment state
  const [enrollCourseId, setEnrollCourseId] = useState('');
  const [showEnrollModal, setShowEnrollModal] = useState(false);

  const fetchStudents = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      let q = `/admin/students?page=${page}&limit=20`;
      if (search) q += `&search=${encodeURIComponent(search)}`;
      if (statusFilter) q += `&status=${statusFilter}`;
      const data = await api<{ students: Student[]; meta: { total: number } }>(q);
      setStudents(data.students || []);
      setTotal(data.meta?.total || 0);
    } catch (e: any) { 
      setStudents([]);
      setTotal(0);
      setError(e.message || 'فشل جلب قائمة الطلاب');
    }
    setLoading(false);
  }, [page, search, statusFilter]);

  const fetchCoursesList = async () => {
    try {
      const data = await api<{ courses: Course[] }>('/admin/courses?limit=50');
      setCourses(data.courses || []);
    } catch (e: any) {
      if (e.message !== 'Mock Mode Active') {
        console.error('Failed to fetch courses list', e);
      }
      setCourses([]);
    }
  };

  useEffect(() => { 
    fetchStudents(); 
    fetchCoursesList();
  }, [fetchStudents]);

  const fetchStudentDetails = useCallback(async (studentId: string) => {
    setDetailsLoading(true);
    try {
      const [finData, playData, quizData] = await Promise.all([
        api<{ financials: any[] }>(`/admin/students/${studentId}/financials`),
        api<{ playback_logs: any[] }>(`/admin/students/${studentId}/playback-logs`),
        api<{ quiz_attempts: any[] }>(`/admin/students/${studentId}/quiz-attempts`),
      ]);
      setFinancials(finData.financials || []);
      setPlaybackLogs(playData.playback_logs || []);
      setQuizAttempts(quizData.quiz_attempts || []);
    } catch (e: any) {
      setError(e.message || 'فشل في تحميل تفاصيل الطالب');
    } finally {
      setDetailsLoading(false);
    }
  }, []);

  const handleAddTransaction = async () => {
    if (!selectedStudent || !txAmount) return;
    setTxLoading(true);
    try {
      const amountVal = Math.round(parseFloat(txAmount) * 100);
      await apiPost(`/admin/students/${selectedStudent.id}/financials`, {
        course_id: txCourseId || null,
        amount: amountVal,
        note: txNote,
      });
      setTxAmount('');
      setTxCourseId('');
      setTxNote('');
      
      // Refresh financials list
      const finData = await api<{ financials: any[] }>(`/admin/students/${selectedStudent.id}/financials`);
      setFinancials(finData.financials || []);
    } catch (e: any) {
      setError(e.message || 'فشل في إضافة المعاملة المالية');
    } finally {
      setTxLoading(false);
    }
  };

  const toggleBlock = async (student: Student) => {
    const newStatus = student.status === 'active' ? 'blocked' : 'active';
    if (newStatus === 'blocked' && !confirm(`هل تريد حظر الطالب ${student.full_name || ''} ومنعه من المشاهدة؟`)) return;
    try {
      await apiPatch(`/admin/students/${student.id}`, { status: newStatus });
      fetchStudents();
    } catch (e: any) {
      setError(e.message);
    }
  };

  const unbindDevices = async (studentId: string) => {
    if (!confirm('هل تريد فك ربط أجهزة هذا الطالب؟ سيتمكن من تسجيل الدخول من جهاز جديد.')) return;
    try {
      await apiDelete(`/admin/students/${studentId}/devices`);
      fetchStudents();
      if (selectedStudent?.id === studentId) {
        setDevices([]);
      }
    } catch (e: any) {
      setError(e.message);
    }
  };

  const fetchDevices = useCallback(async (studentId: string) => {
    setDevicesLoading(true);
    try {
      const data = await api<{ devices: Device[] }>(`/admin/students/${studentId}/devices`);
      setDevices(data.devices || []);
    } catch (e: any) {
      setDevices([]);
      setError(e.message || 'فشل تحميل أجهزة الطالب');
    } finally {
      setDevicesLoading(false);
    }
  }, []);

  const unbindSingleDevice = async (studentId: string, deviceId: string) => {
    if (!confirm('هل تريد فك ربط هذا الجهاز فقط؟ سيتمكن الطالب من استخدام جهاز بديل بدلاً منه.')) return;
    setDeviceActionId(deviceId);
    try {
      await apiDelete(`/admin/students/${studentId}/devices/${deviceId}`);
      await fetchDevices(studentId);
      fetchStudents();
    } catch (e: any) {
      setError(e.message || 'فشل فك ربط الجهاز');
    } finally {
      setDeviceActionId(null);
    }
  };

  const deleteStudent = async (student: Student) => {
    if (!confirm(`تحذير هام جداً ⚠️\n\nهل أنت متأكد تماماً من حذف الطالب "${student.full_name || ''}" نهائياً من المنصة؟\n\nهذا الإجراء سيقوم بمسح كافة بيانات الطالب، بما في ذلك الأجهزة المسجلة، سجلات المشاهدة، محاولات الامتحانات، المعاملات المالية، والاشتراكات. ولا يمكن التراجع عن هذا الإجراء!`)) return;
    
    const confirmationWord = prompt(`لتأكيد حذف الطالب، يرجى كتابة كلمة "حذف" في المربع أدناه:`);
    if (confirmationWord !== 'حذف') {
      alert('لم يتم كتابة كلمة التأكيد بشكل صحيح. تم إلغاء عملية الحذف.');
      return;
    }

    try {
      await apiDelete(`/admin/students/${student.id}`);
      fetchStudents();
    } catch (e: any) {
      setError(e.message || 'فشل مسح بيانات الطالب من المنصة');
    }
  };

  const enrollStudent = async () => {
    if (!selectedStudent || !enrollCourseId) return;
    try {
      await apiPost(`/admin/students/${selectedStudent.id}/enroll`, { course_id: enrollCourseId });
      setShowEnrollModal(false);
      setEnrollCourseId('');
      fetchStudents();
    } catch (e: any) {
      setError(e.message || 'فشل تسجيل الطالب في الكورس');
    }
  };

  const timeAgo = (dateStr: string | null) => {
    if (!dateStr) return 'لم يسجل دخول بعد';
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return `منذ ${mins} دقيقة`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `منذ ${hours} ساعة`;
    const days = Math.floor(hours / 24);
    return `منذ ${days} يوم`;
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '-';
    try {
      return new Date(dateStr).toLocaleString('ar-EG', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
      });
    } catch {
      return dateStr;
    }
  };

  const formatSeconds = (totalSeconds: number) => {
    const min = Math.floor(totalSeconds / 60);
    const sec = totalSeconds % 60;
    return `${min}:${sec.toString().padStart(2, '0')}`;
  };

  const activeStudents = students.filter((student) => student.status === 'active').length;
  const blockedStudents = students.filter((student) => student.status === 'blocked').length;
  const devicesAtLimit = students.filter((student) => student.devices_count >= student.max_devices).length;

  return (
    <div className="space-y-6 animate-in fade-in duration-300 text-on-surface">
      
      {/* Header */}
      <div>
        <h1 className="font-display-lg text-2xl font-bold text-on-surface flex items-center gap-2">
          <span className="material-symbols-outlined text-primary text-2xl">group</span>
          <span>سجل الطلاب والاشتراكات</span>
        </h1>
        <p className="font-body-sm text-on-surface-variant text-xs mt-1">إدارة الأجهزة النشطة للطلاب، حظر الحسابات المشبوهة، ومتابعة سجلات المشاهدة والأقسام المالية</p>
      </div>

      {error && (
        <div role="alert" className="p-4 rounded-lg bg-error-container/20 border border-error-container text-error text-sm flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <span>{error}</span>
          <div className="flex gap-3 text-xs font-bold">
            <button onClick={fetchStudents} className="hover:underline">إعادة المحاولة</button>
            <button onClick={() => setError('')} className="hover:underline">إخفاء</button>
          </div>
        </div>
      )}

      <section className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="rounded-lg border border-outline-variant bg-surface p-4"><p className="text-xs font-semibold text-on-surface-variant">حسابات نشطة في النتائج</p><p className="mt-2 text-2xl font-bold text-primary">{activeStudents}</p></div>
        <div className="rounded-lg border border-outline-variant bg-surface p-4"><p className="text-xs font-semibold text-on-surface-variant">حسابات محظورة</p><p className="mt-2 text-2xl font-bold text-error">{blockedStudents}</p></div>
        <div className="rounded-lg border border-outline-variant bg-surface p-4"><p className="text-xs font-semibold text-on-surface-variant">أجهزة وصلت للحد</p><p className="mt-2 text-2xl font-bold text-amber-700">{devicesAtLimit}</p></div>
      </section>

      {/* Advanced Filters */}
      <div className="flex gap-3 flex-col sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
        <div className="flex w-full flex-col gap-3 sm:flex-1 sm:flex-row">
          <div className="relative flex-1">
            <span className="material-symbols-outlined absolute start-3.5 top-3.5 text-outline text-lg">search</span>
            <input 
              placeholder="ابحث بالاسم، الهاتف، كود الطالب، أو البريد الإلكتروني..." 
              value={search} 
              onChange={e => { setSearch(e.target.value); setPage(1); }}
              className="w-full pe-4 ps-10 py-3 bg-surface-container-low border border-outline-variant focus:border-primary focus:ring-1 focus:ring-primary rounded-lg text-xs text-on-surface placeholder:text-outline focus:outline-none transition" 
            />
          </div>
          <select 
            value={statusFilter} 
            onChange={e => { setStatusFilter(e.target.value); setPage(1); }}
            className="w-full sm:w-40 px-4 py-3 bg-surface-container-low border border-outline-variant rounded-lg text-xs text-on-surface-variant focus:outline-none focus:border-primary transition"
          >
            <option value="">كل الحالات</option>
            <option value="active">النشطين فقط</option>
            <option value="blocked">المحظورين فقط</option>
          </select>
        </div>
        <div className="w-full sm:w-auto text-xs text-on-surface-variant font-bold bg-surface border border-outline-variant px-4 py-3 rounded-lg">
          إجمالي المسجلين: <span className="text-primary font-mono font-bold">{total}</span> طالب
        </div>
      </div>

      <div className="space-y-3 md:hidden">
        {loading ? [1, 2, 3].map((item) => <div key={item} className="h-40 animate-pulse rounded-lg bg-surface-container" />) : students.length === 0 ? (
          <div className="rounded-lg border border-dashed border-outline-variant bg-surface p-8 text-center text-sm text-on-surface-variant">لا توجد بيانات مطابقة لبحثك.</div>
        ) : students.map((student) => (
          <article key={student.id} className="rounded-lg border border-outline-variant bg-surface p-4 shadow-soft">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0"><h2 className="truncate text-sm font-bold text-on-surface">{student.full_name || 'بدون اسم'}</h2><p className="mt-1 truncate text-xs text-on-surface-variant">{student.email || 'لا يوجد بريد إلكتروني'}</p></div>
              <span className={`shrink-0 rounded-md px-2 py-1 text-xs font-bold ${student.status === 'active' ? 'bg-tertiary-fixed text-on-tertiary-fixed-variant' : 'bg-error-container text-on-error-container'}`}>{student.status === 'active' ? 'نشط' : 'محظور'}</span>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-3 text-xs"><div><p className="text-on-surface-variant">المرحلة</p><p className="mt-1 font-bold text-on-surface">{student.grade || '-'}</p></div><div><p className="text-on-surface-variant">آخر نشاط</p><p className="mt-1 font-bold text-on-surface">{timeAgo(student.last_seen_at)}</p></div><div><p className="text-on-surface-variant">الدورات</p><p className="mt-1 font-bold text-on-surface">{student.enrollments_count}</p></div><div><p className="text-on-surface-variant">الأجهزة</p><p className="mt-1 font-bold text-on-surface">{student.devices_count}/{student.max_devices}</p></div></div>
            <div className="mt-4 grid grid-cols-3 gap-2"><button onClick={() => { setSelectedStudent(student); setShowDetailsModal(true); setActiveTab('financials'); fetchStudentDetails(student.id); }} className="rounded-md border border-outline-variant px-2 py-2 text-xs font-bold text-on-surface">التفاصيل</button><button onClick={() => toggleBlock(student)} className="rounded-md border border-outline-variant px-2 py-2 text-xs font-bold text-on-surface">{student.status === 'active' ? 'حظر' : 'فك الحظر'}</button><button onClick={() => unbindDevices(student.id)} className="rounded-md bg-primary/10 px-2 py-2 text-xs font-bold text-primary">فك الأجهزة</button></div>
          </article>
        ))}
      </div>

      {/* Students Data Grid/Table */}
      <div className="hidden md:block bg-surface-container-lowest border border-outline-variant rounded-xl overflow-hidden shadow-soft">
        <div className="overflow-x-auto">
          <table className="w-full text-start text-xs">
            <thead>
              <tr className="border-b border-outline-variant text-on-surface-variant font-bold bg-surface-container-low">
                <th className="px-5 py-4">بيانات الطالب</th>
                <th className="px-5 py-4">رقم الهاتف</th>
                <th className="px-5 py-4">المرحلة الدراسية</th>
                <th className="px-5 py-4 text-center">الكورسات</th>
                <th className="px-5 py-4 text-center">ربط الأجهزة</th>
                <th className="px-5 py-4">آخر تفاعل</th>
                <th className="px-5 py-4 text-center">حالة الحساب</th>
                <th className="px-5 py-4 text-center">إجراءات التحكم</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant">
              {loading ? (
                <tr>
                  <td colSpan={8} className="text-center py-20">
                    <span className="material-symbols-outlined animate-spin text-primary text-2xl">sync</span>
                  </td>
                </tr>
              ) : students.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center py-16 text-on-surface-variant">
                    لا توجد بيانات مطابقة لبحثك
                  </td>
                </tr>
              ) : students.map(student => (
                <tr key={student.id} className="hover:bg-surface-container/30 transition duration-150">
                  <td className="px-5 py-4">
                    <div>
                      <p className="text-on-surface font-bold text-xs">{student.full_name || 'بدون اسم'}</p>
                      <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                        <p className="text-on-surface-variant text-[10px]">{student.email}</p>
                        {student.student_code && (
                          <>
                            <span className="text-outline text-[10px]">•</span>
                            <span className="text-primary font-mono text-[9px] font-bold bg-primary/10 border border-primary/20 px-1.5 py-0.5 rounded">
                              كود: {student.student_code}
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-4 text-on-surface-variant font-mono">{student.phone || '-'}</td>
                  <td className="px-5 py-4 text-on-surface-variant">{student.grade || '-'}</td>
                  <td className="px-5 py-4 text-center">
                    <span className="text-primary font-bold text-xs bg-primary/10 border border-primary/20 px-2 py-0.5 rounded">
                      {student.enrollments_count}
                    </span>
                  </td>
                  <td className="px-5 py-4 text-center font-mono">
                    <span className="text-on-surface font-bold text-xs flex items-center justify-center gap-1">
                      <span className="material-symbols-outlined text-sm opacity-60 text-on-surface-variant">smartphone</span>
                      <span>{student.devices_count}/{student.max_devices}</span>
                    </span>
                  </td>
                  <td className="px-5 py-4 text-outline text-[10px]">{timeAgo(student.last_seen_at)}</td>
                  <td className="px-5 py-4 text-center">
                    <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold ${
                      student.status === 'active' 
                        ? 'bg-tertiary-fixed text-on-tertiary-fixed-variant' 
                        : 'bg-error-container text-on-error-container'
                    }`}>
                      {student.status === 'active' ? 'نشط' : 'محظور'}
                    </span>
                  </td>
                  <td className="px-5 py-4">
                    <div className="flex items-center justify-center gap-1">
                      <button 
                        onClick={() => { 
                          setSelectedStudent(student); 
                          setShowDetailsModal(true); 
                          setActiveTab('financials');
                          fetchStudentDetails(student.id); 
                        }} 
                        title="تفاصيل وسجلات الطالب"
                        className="p-2 rounded-lg text-on-surface-variant hover:text-primary hover:bg-primary/10 transition flex items-center justify-center"
                      >
                        <span className="material-symbols-outlined text-base">visibility</span>
                      </button>
                      <button 
                        onClick={() => toggleBlock(student)} 
                        title={student.status === 'active' ? 'حظر الطالب' : 'فك حظر الطالب'}
                        className={`p-2 rounded-lg transition-all flex items-center justify-center ${
                          student.status === 'active' 
                            ? 'text-on-surface-variant hover:text-error hover:bg-error-container/20' 
                            : 'text-on-surface-variant hover:text-primary hover:bg-primary/10'
                        }`}
                      >
                        <span className="material-symbols-outlined text-base">
                          {student.status === 'active' ? 'block' : 'check_circle'}
                        </span>
                      </button>
                      <button 
                        onClick={() => unbindDevices(student.id)} 
                        title="فك ربط أجهزة الطالب"
                        className="p-2 rounded-lg text-on-surface-variant hover:text-primary hover:bg-primary/10 transition flex items-center justify-center"
                      >
                        <span className="material-symbols-outlined text-base">link_off</span>
                      </button>
                      <button 
                        onClick={() => { setSelectedStudent(student); setShowEnrollModal(true); }} 
                        title="تسجيل يدوي بكورس"
                        className="p-2 rounded-lg text-on-surface-variant hover:text-primary hover:bg-primary/10 transition flex items-center justify-center"
                      >
                        <span className="material-symbols-outlined text-base">person_add</span>
                      </button>
                      <button 
                        onClick={() => deleteStudent(student)} 
                        title="مسح بيانات الطالب نهائياً"
                        className="p-2 rounded-lg text-on-surface-variant hover:text-error hover:bg-error-container/20 transition flex items-center justify-center"
                      >
                        <span className="material-symbols-outlined text-base">delete</span>
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Dynamic Pagination Controls */}
        {total > 20 && (
          <div className="flex items-center justify-between px-5 py-4 border-t border-outline-variant bg-surface-container-low select-none">
            <button 
              onClick={() => setPage(p => Math.max(1, p - 1))} 
              disabled={page <= 1}
              className="flex items-center gap-1.5 px-4 py-2 bg-surface hover:bg-surface-container border border-outline-variant text-on-surface-variant rounded-lg disabled:opacity-30 disabled:cursor-not-allowed text-xs transition duration-300"
            >
              <span className="material-symbols-outlined text-sm">chevron_right</span>
              <span>السابق</span>
            </button>
            <span className="text-on-surface-variant text-xs font-semibold">صفحة {page} من {Math.ceil(total / 20)}</span>
            <button 
              onClick={() => setPage(p => p + 1)} 
              disabled={page * 20 >= total}
              className="flex items-center gap-1.5 px-4 py-2 bg-surface hover:bg-surface-container border border-outline-variant text-on-surface-variant rounded-lg disabled:opacity-30 disabled:cursor-not-allowed text-xs transition duration-300"
            >
              <span>التالي</span>
              <span className="material-symbols-outlined text-sm">chevron_left</span>
            </button>
          </div>
        )}
      </div>

      {/* Student Details and Tracking Modal */}
      {showDetailsModal && selectedStudent && (
        <div 
          className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 animate-in fade-in duration-300"
          onClick={() => setShowDetailsModal(false)}
        >
          <div 
            className="bg-surface-container-lowest border border-outline-variant rounded-xl p-6 w-full max-w-4xl max-h-[85vh] overflow-y-auto space-y-6 shadow-ambient animate-in zoom-in-95 duration-200" 
            onClick={e => e.stopPropagation()}
          >
            {/* Header info */}
            <div className="flex justify-between items-start border-b border-outline-variant pb-4">
              <div className="space-y-1">
                <h2 className="text-lg font-bold text-on-surface flex items-center gap-2">
                  <span className="material-symbols-outlined text-primary text-xl">account_box</span>
                  <span>{selectedStudent.full_name}</span>
                </h2>
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-on-surface-variant">
                  <span>الهاتف: <b className="font-mono text-on-surface">{selectedStudent.phone || '-'}</b></span>
                  <span>المرحلة: <b className="text-on-surface">{selectedStudent.grade || '-'}</b></span>
                  <span>المحافظة: <b className="text-on-surface">{selectedStudent.governorate || '-'}</b></span>
                  {selectedStudent.student_code && (
                    <span className="text-primary font-bold">كود الطالب: <span className="font-mono bg-primary/10 px-1.5 py-0.5 rounded">{selectedStudent.student_code}</span></span>
                  )}
                </div>
              </div>
              <button 
                onClick={() => setShowDetailsModal(false)}
                className="p-1 rounded-lg text-on-surface-variant hover:bg-surface-container-high transition"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            {/* Tab switchers */}
            <div className="flex border-b border-outline-variant">
              <button 
                onClick={() => setActiveTab('financials')}
                className={`px-5 py-3 text-xs font-bold transition flex items-center gap-2 border-b-2 ${
                  activeTab === 'financials' 
                    ? 'border-primary text-primary' 
                    : 'border-transparent text-on-surface-variant hover:text-on-surface'
                }`}
              >
                <span className="material-symbols-outlined text-base">account_balance_wallet</span>
                <span>التعاملات المالية</span>
              </button>
              <button 
                onClick={() => setActiveTab('playback')}
                className={`px-5 py-3 text-xs font-bold transition flex items-center gap-2 border-b-2 ${
                  activeTab === 'playback' 
                    ? 'border-primary text-primary' 
                    : 'border-transparent text-on-surface-variant hover:text-on-surface'
                }`}
              >
                <span className="material-symbols-outlined text-base">history</span>
                <span>سجل نشاط تشغيل المحاضرات</span>
              </button>
              <button 
                onClick={() => setActiveTab('quizzes')}
                className={`px-5 py-3 text-xs font-bold transition flex items-center gap-2 border-b-2 ${
                  activeTab === 'quizzes' 
                    ? 'border-primary text-primary' 
                    : 'border-transparent text-on-surface-variant hover:text-on-surface'
                }`}
              >
                <span className="material-symbols-outlined text-base">quiz</span>
                <span>درجات الكويزات والامتحانات</span>
              </button>
              <button
                onClick={() => { setActiveTab('devices'); fetchDevices(selectedStudent.id); }}
                className={`px-5 py-3 text-xs font-bold transition flex items-center gap-2 border-b-2 ${
                  activeTab === 'devices'
                    ? 'border-primary text-primary'
                    : 'border-transparent text-on-surface-variant hover:text-on-surface'
                }`}
              >
                <span className="material-symbols-outlined text-base">devices</span>
                <span>الأجهزة</span>
              </button>
            </div>

            {/* Content Loader */}
            {detailsLoading ? (
              <div className="py-20 flex justify-center items-center">
                <span className="material-symbols-outlined animate-spin text-primary text-3xl">sync</span>
              </div>
            ) : (
              <div className="space-y-4">
                
                {/* 1. FINANCIALS TAB */}
                {activeTab === 'financials' && (
                  <div className="space-y-6">
                    {/* Add Manual Payment Transaction */}
                    <div className="p-4 bg-surface-container-low border border-outline-variant rounded-xl space-y-4">
                      <h4 className="text-xs font-bold text-on-surface flex items-center gap-1.5">
                        <span className="material-symbols-outlined text-primary text-base">price_change</span>
                        <span>شحن رصيد / إضافة معاملة مالية يدوية</span>
                      </h4>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        <div className="space-y-1">
                          <label className="text-[10px] font-bold text-on-surface-variant ms-1">المبلغ (جنيه مصري ج.م)</label>
                          <input 
                            type="number"
                            placeholder="مثال: 150"
                            value={txAmount}
                            onChange={e => setTxAmount(e.target.value)}
                            className="w-full px-4 py-2.5 bg-surface-container-lowest border border-outline-variant rounded-lg text-xs focus:outline-none focus:border-primary transition"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[10px] font-bold text-on-surface-variant ms-1">ربط بكورس (اختياري)</label>
                          <select 
                            value={txCourseId}
                            onChange={e => setTxCourseId(e.target.value)}
                            className="w-full px-4 py-2.5 bg-surface-container-lowest border border-outline-variant rounded-lg text-xs focus:outline-none focus:border-primary transition"
                          >
                            <option value="">شحن عام للحساب</option>
                            {courses.map(c => (
                              <option key={c.id} value={c.id}>({c.grade}) - {c.title}</option>
                            ))}
                          </select>
                        </div>
                        <div className="space-y-1">
                          <label className="text-[10px] font-bold text-on-surface-variant ms-1">ملاحظة المعاملة</label>
                          <input 
                            placeholder="مثال: اشتراك الشهر يدوياً بالمركز"
                            value={txNote}
                            onChange={e => setTxNote(e.target.value)}
                            className="w-full px-4 py-2.5 bg-surface-container-lowest border border-outline-variant rounded-lg text-xs focus:outline-none focus:border-primary transition"
                          />
                        </div>
                      </div>
                      <div className="flex justify-end">
                        <button 
                          onClick={handleAddTransaction}
                          disabled={txLoading || !txAmount}
                          className="px-6 py-2 bg-primary text-on-primary font-bold rounded-lg text-xs disabled:opacity-50 transition duration-150 flex items-center gap-1.5"
                        >
                          {txLoading ? (
                            <span className="material-symbols-outlined animate-spin text-sm">sync</span>
                          ) : (
                            <span className="material-symbols-outlined text-sm">add</span>
                          )}
                          <span>تسجيل المعاملة وتحديث الرصيد</span>
                        </button>
                      </div>
                    </div>

                    {/* Financial History Table */}
                    <div className="border border-outline-variant rounded-xl overflow-hidden">
                      <table className="w-full text-start text-xs">
                        <thead>
                          <tr className="bg-surface-container-low border-b border-outline-variant text-on-surface-variant font-bold">
                            <th className="px-4 py-3">البيان / الكورس</th>
                            <th className="px-4 py-3">نوع المعاملة</th>
                            <th className="px-4 py-3">القيمة</th>
                            <th className="px-4 py-3">كود التفعيل</th>
                            <th className="px-4 py-3">الملاحظات</th>
                            <th className="px-4 py-3">التوقيت</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-outline-variant">
                          {financials.length === 0 ? (
                            <tr>
                              <td colSpan={6} className="text-center py-10 text-on-surface-variant">لا توجد تعاملات مالية مسجلة بعد</td>
                            </tr>
                          ) : financials.map((item) => {
                            const typeStr = item.transaction_type === 'code_redeem'
                              ? 'تفعيل كود شحن'
                              : item.transaction_type === 'manual_admin'
                                ? 'يدوي من الإدارة'
                                : 'دفع إلكتروني';
                            return (
                              <tr key={item.id} className="hover:bg-surface-container/20">
                                <td className="px-4 py-3 font-bold">{item.course_title || 'شحن رصيد عام'}</td>
                                <td className="px-4 py-3 text-on-surface-variant">{typeStr}</td>
                                <td className="px-4 py-3 text-primary font-bold font-mono">{(item.amount / 100).toFixed(0)} ج.م</td>
                                <td className="px-4 py-3 font-mono text-[10px]">{item.code_string || '-'}</td>
                                <td className="px-4 py-3 text-on-surface-variant text-[11px]">{item.note || '-'}</td>
                                <td className="px-4 py-3 text-[10px] text-outline">{formatDate(item.created_at)}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* 2. PLAYBACK LOGS TAB */}
                {activeTab === 'playback' && (
                  <div className="border border-outline-variant rounded-xl overflow-hidden">
                    <table className="w-full text-start text-xs">
                      <thead>
                        <tr className="bg-surface-container-low border-b border-outline-variant text-on-surface-variant font-bold">
                          <th className="px-4 py-3">اسم الدرس / الفيديو</th>
                          <th className="px-4 py-3 text-center">الحدث</th>
                          <th className="px-4 py-3 text-center">اللقطة الحالية</th>
                          <th className="px-4 py-3">توقيت الحدث</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-outline-variant">
                        {playbackLogs.length === 0 ? (
                          <tr>
                            <td colSpan={4} className="text-center py-10 text-on-surface-variant">لا يوجد سجل تشغيل محاضرات بعد لهذا الطالب</td>
                          </tr>
                        ) : playbackLogs.map((item) => (
                          <tr key={item.id} className="hover:bg-surface-container/20">
                            <td className="px-4 py-3 font-bold">{item.lesson_title || 'محاضرة'}</td>
                            <td className="px-4 py-3 text-center">
                              <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                item.action === 'open' 
                                  ? 'bg-success-container/30 text-success' 
                                  : 'bg-warning-container/30 text-warning'
                              }`}>
                                {item.action === 'open' ? 'فتح المشاهدة' : 'إغلاق الفيديو'}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-center font-mono font-bold text-on-surface">
                              {formatSeconds(item.position_seconds)}
                            </td>
                            <td className="px-4 py-3 text-[10px] text-outline">{formatDate(item.created_at)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {/* 3. QUIZZES TAB */}
                {activeTab === 'quizzes' && (
                  <div className="border border-outline-variant rounded-xl overflow-hidden">
                    <table className="w-full text-start text-xs">
                      <thead>
                        <tr className="bg-surface-container-low border-b border-outline-variant text-on-surface-variant font-bold">
                          <th className="px-4 py-3">اسم الامتحان / الكويز</th>
                          <th className="px-4 py-3 text-center">الدرجة</th>
                          <th className="px-4 py-3 text-center">النسبة المئوية</th>
                          <th className="px-4 py-3 text-center">حالة الاجتياز</th>
                          <th className="px-4 py-3">تاريخ التقديم</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-outline-variant">
                        {quizAttempts.length === 0 ? (
                          <tr>
                            <td colSpan={5} className="text-center py-10 text-on-surface-variant">لم يدخل الطالب أي امتحانات قصيرة بعد</td>
                          </tr>
                        ) : quizAttempts.map((item) => {
                          const percent = Math.round((item.score / item.max_score) * 100);
                          const isPassed = percent >= 50;
                          return (
                            <tr key={item.id} className="hover:bg-surface-container/20">
                              <td className="px-4 py-3 font-bold">{item.quiz_title}</td>
                              <td className="px-4 py-3 text-center font-mono font-bold">{item.score} / {item.max_score}</td>
                              <td className="px-4 py-3 text-center font-mono font-bold text-primary">%{percent}</td>
                              <td className="px-4 py-3 text-center">
                                <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                  isPassed 
                                    ? 'bg-success-container/30 text-success' 
                                    : 'bg-error-container/30 text-error'
                                }`}>
                                  {isPassed ? 'ناجح' : 'راسب'}
                                </span>
                              </td>
                              <td className="px-4 py-3 text-[10px] text-outline">{formatDate(item.submitted_at)}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}

                {/* 4. DEVICES TAB */}
                {activeTab === 'devices' && (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <p className="text-[11px] text-on-surface-variant">الأجهزة المرتبطة بحساب الطالب حاليًا. يمكنك فك ربط جهاز واحد دون التأثير على الباقي.</p>
                      <button
                        onClick={() => unbindDevices(selectedStudent.id)}
                        className="shrink-0 rounded-lg border border-error/30 bg-error-container/10 px-3 py-1.5 text-[10px] font-bold text-error transition hover:bg-error-container/20"
                      >
                        فك ربط كل الأجهزة
                      </button>
                    </div>
                    <div className="border border-outline-variant rounded-xl overflow-hidden">
                      <table className="w-full text-start text-xs">
                        <thead>
                          <tr className="bg-surface-container-low border-b border-outline-variant text-on-surface-variant font-bold">
                            <th className="px-4 py-3">الموديل</th>
                            <th className="px-4 py-3 text-center">النظام</th>
                            <th className="px-4 py-3 text-center">الحالة</th>
                            <th className="px-4 py-3">آخر تسجيل دخول</th>
                            <th className="px-4 py-3 text-center">الإجراء</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-outline-variant">
                          {devicesLoading ? (
                            <tr>
                              <td colSpan={5} className="text-center py-10">
                                <span className="material-symbols-outlined animate-spin text-primary text-xl">sync</span>
                              </td>
                            </tr>
                          ) : devices.length === 0 ? (
                            <tr>
                              <td colSpan={5} className="text-center py-10 text-on-surface-variant">لا توجد أجهزة مسجلة لهذا الطالب</td>
                            </tr>
                          ) : devices.map((device) => (
                            <tr key={device.id} className="hover:bg-surface-container/20">
                              <td className="px-4 py-3 font-bold">{device.model || 'غير معروف'}</td>
                              <td className="px-4 py-3 text-center font-mono uppercase">{device.platform}</td>
                              <td className="px-4 py-3 text-center">
                                <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                  device.is_trusted
                                    ? 'bg-success-container/30 text-success'
                                    : 'bg-warning-container/30 text-warning'
                                }`}>
                                  {device.is_trusted ? 'موثوق' : 'غير موثوق'}
                                </span>
                              </td>
                              <td className="px-4 py-3 text-[10px] text-outline">{formatDate(device.last_login_at || '')}</td>
                              <td className="px-4 py-3 text-center">
                                <button
                                  onClick={() => unbindSingleDevice(selectedStudent.id, device.id)}
                                  disabled={deviceActionId === device.id}
                                  className="px-3 py-1.5 bg-error-container/20 hover:bg-error-container text-error font-bold rounded-lg text-[10px] transition duration-150 disabled:opacity-50"
                                >
                                  {deviceActionId === device.id ? (
                                    <span className="material-symbols-outlined animate-spin text-sm align-middle">sync</span>
                                  ) : (
                                    'فك الربط'
                                  )}
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

              </div>
            )}
          </div>
        </div>
      )}

      {/* Hand-rolled Manual Enrollment Modal */}
      {showEnrollModal && selectedStudent && (
        <div 
          className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 animate-in fade-in duration-300" 
          onClick={() => setShowEnrollModal(false)}
        >
          <div 
            className="bg-surface-container-lowest border border-outline-variant rounded-xl p-6 w-full max-w-md space-y-5 shadow-ambient animate-in zoom-in-95 duration-200" 
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-outline-variant pb-2">
              <h3 className="text-sm font-bold text-on-surface flex items-center gap-2">
                <span className="material-symbols-outlined text-primary text-base">person_add</span>
                <span>تسجيل دورة يدوي للطالب</span>
              </h3>
              <button onClick={() => setShowEnrollModal(false)} className="text-on-surface-variant hover:text-on-surface transition flex items-center">
                <span className="material-symbols-outlined text-base">close</span>
              </button>
            </div>
            
            <p className="text-on-surface-variant text-xs leading-relaxed">
              سيتم الاشتراك الفوري للطالب <span className="text-primary font-bold">{selectedStudent.full_name}</span> في الدورة المحددة أدناه دون استخدام أكواد.
            </p>
            
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-on-surface-variant ms-1">الدورة الدراسية</label>
              <select 
                value={enrollCourseId}
                onChange={e => setEnrollCourseId(e.target.value)}
                className="w-full px-4 py-3 bg-surface-container-low border border-outline-variant focus:border-primary focus:ring-1 focus:ring-primary rounded-lg text-xs text-on-surface focus:outline-none transition"
              >
                <option value="">اختر الدورة من القائمة...</option>
                {courses.map(c => (
                  <option key={c.id} value={c.id}>({c.grade}) - {c.title}</option>
                ))}
              </select>
            </div>

            <div className="flex gap-3 pt-2">
              <button 
                onClick={enrollStudent} 
                disabled={!enrollCourseId}
                className="flex-1 py-2.5 bg-primary hover:bg-primary-container text-on-primary font-bold rounded-lg text-xs transition duration-300 disabled:opacity-50"
              >
                تأكيد الاشتراك
              </button>
              <button 
                onClick={() => setShowEnrollModal(false)} 
                className="px-5 py-2.5 bg-surface border border-outline-variant text-on-surface-variant rounded-lg text-xs transition duration-300"
              >
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
