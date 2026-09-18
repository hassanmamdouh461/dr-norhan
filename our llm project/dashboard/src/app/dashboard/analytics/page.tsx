'use client';

import { useState, useEffect } from 'react';
import { api } from '@/lib/api';

interface LaggingStudent {
  id: string;
  full_name: string;
  email: string;
  phone: string;
  grade: string;
  governorate: string;
  last_view_at: string | null;
  avg_quiz_grade: number | null;
}

interface VideoEngagement {
  id: string;
  title: string;
  course_title: string;
  total_viewers: number;
  avg_watched_seconds: number;
  avg_completion_percentage: number;
}

interface AssistantKpi {
  id: string;
  full_name: string;
  email: string;
  questions_answered: number;
  resets_handled: number;
}

export default function AnalyticsPage() {
  const [laggingStudents, setLaggingStudents] = useState<LaggingStudent[]>([]);
  const [videoEngagement, setVideoEngagement] = useState<VideoEngagement[]>([]);
  const [assistantKpis, setAssistantKpis] = useState<AssistantKpi[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeSubTab, setActiveSubTab] = useState<'lagging' | 'videos' | 'assistants'>('lagging');

  const fetchAnalytics = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await api<{
        lagging_students: LaggingStudent[];
        video_engagement: VideoEngagement[];
        assistant_kpis: AssistantKpi[];
      }>('/admin/analytics/advanced');
      
      setLaggingStudents(data.lagging_students || []);
      setVideoEngagement(data.video_engagement || []);
      setAssistantKpis(data.assistant_kpis || []);
    } catch (e: any) {
      setError(e.message || 'فشل تحميل التقارير الإحصائية المتقدمة');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAnalytics();
  }, []);

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return 'لم يشاهد مطلقاً';
    try {
      return new Date(dateStr).toLocaleDateString('ar-EG', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      });
    } catch {
      return dateStr;
    }
  };

  const formatSeconds = (sec: number | null) => {
    // avg_watched_seconds is NULL when a lesson has no real viewers yet
    const min = Math.floor((sec || 0) / 60);
    return `${min} دقيقة`;
  };

  return (
    <div className="space-y-6 text-on-surface">
      {/* Header */}
      <div>
        <h1 className="font-display-lg text-2xl font-bold flex items-center gap-2">
          <span className="material-symbols-outlined text-primary text-2xl">monitoring</span>
          <span>قسم الإحصائيات والتحليلات المتقدمة</span>
        </h1>
        <p className="font-body-sm text-on-surface-variant text-xs mt-1">مؤشرات الأداء الأكاديمي، كشف الطلاب المتعثرين، تتبع تفاعل الفيديوهات، ومراقبة أداء المساعدين</p>
      </div>

      {error && (
        <div className="p-4 rounded-lg bg-error-container/20 border border-error-container text-error text-xs flex items-center justify-between">
          <span>{error}</span>
          <button onClick={() => setError('')} className="underline font-bold transition">إغلاق</button>
        </div>
      )}

      {/* Advanced Navigation Sub Tabs */}
      <div className="flex gap-2 flex-wrap border-b border-outline-variant pb-1">
        <button 
          onClick={() => setActiveSubTab('lagging')}
          className={`px-5 py-3 text-xs font-bold transition flex items-center gap-2 border-b-2 -mb-[6px] ${
            activeSubTab === 'lagging' 
              ? 'border-primary text-primary' 
              : 'border-transparent text-on-surface-variant hover:text-on-surface'
          }`}
        >
          <span className="material-symbols-outlined text-base">person_search</span>
          <span>الطلاب المتعثرين والخاملين</span>
        </button>
        <button 
          onClick={() => setActiveSubTab('videos')}
          className={`px-5 py-3 text-xs font-bold transition flex items-center gap-2 border-b-2 -mb-[6px] ${
            activeSubTab === 'videos' 
              ? 'border-primary text-primary' 
              : 'border-transparent text-on-surface-variant hover:text-on-surface'
          }`}
        >
          <span className="material-symbols-outlined text-base">video_library</span>
          <span>تفاعل ونسب إكمال المحاضرات</span>
        </button>
        <button 
          onClick={() => setActiveSubTab('assistants')}
          className={`px-5 py-3 text-xs font-bold transition flex items-center gap-2 border-b-2 -mb-[6px] ${
            activeSubTab === 'assistants' 
              ? 'border-primary text-primary' 
              : 'border-transparent text-on-surface-variant hover:text-on-surface'
          }`}
        >
          <span className="material-symbols-outlined text-base">support_agent</span>
          <span>إنتاجية وأداء المساعدين</span>
        </button>
      </div>

      {loading ? (
        <div className="py-32 flex justify-center items-center">
          <span className="material-symbols-outlined animate-spin text-primary text-3xl">sync</span>
        </div>
      ) : (
        <div className="space-y-4">
          
          {/* TAB 1: LAGGING STUDENTS */}
          {activeSubTab === 'lagging' && (
            <div className="bg-surface-container-lowest border border-outline-variant rounded-xl overflow-hidden">
              <div className="p-4 bg-surface-container-low border-b border-outline-variant">
                <h3 className="text-xs font-bold text-on-surface">قائمة الطلاب الأكثر احتياجاً للمتابعة</h3>
                <p className="text-[10px] text-on-surface-variant mt-0.5">تضم الطلاب الذين لم يشاهدوا أي محاضرات منذ 7 أيام أو متوسط درجاتهم في الكويزات أقل من 50%</p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-right text-xs">
                  <thead>
                    <tr className="border-b border-outline-variant text-on-surface-variant font-bold bg-surface-container-low">
                      <th className="px-5 py-3">اسم الطالب</th>
                      <th className="px-5 py-3">المرحلة الدراسية</th>
                      <th className="px-5 py-3">المحافظة</th>
                      <th className="px-5 py-3">آخر مشاهدة محاضرة</th>
                      <th className="px-5 py-3 text-center">متوسط درجات الكويزات</th>
                      <th className="px-5 py-3 text-center">حالة المؤشر</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-outline-variant">
                    {laggingStudents.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="text-center py-10 text-on-surface-variant">لا توجد حالات تعثر مكتشفة حالياً، أداء الطلاب ممتاز!</td>
                      </tr>
                    ) : laggingStudents.map(student => {
                      const score = student.avg_quiz_grade !== null ? Math.round(student.avg_quiz_grade) : null;
                      const isLowGrade = score !== null && score < 50;
                      return (
                        <tr key={student.id} className="hover:bg-surface-container/20 transition duration-150">
                          <td className="px-5 py-3">
                            <div>
                              <p className="text-on-surface font-bold">{student.full_name}</p>
                              <p className="text-[10px] text-on-surface-variant mt-0.5">{reqPhone(student.phone)} • {student.email}</p>
                            </div>
                          </td>
                          <td className="px-5 py-3 text-on-surface-variant">{student.grade}</td>
                          <td className="px-5 py-3 text-on-surface-variant">{student.governorate}</td>
                          <td className="px-5 py-3 text-on-surface-variant font-mono">{formatDate(student.last_view_at)}</td>
                          <td className="px-5 py-3 text-center font-bold font-mono">
                            {score !== null ? (
                              <span className={isLowGrade ? 'text-error' : 'text-primary'}>%{score}</span>
                            ) : (
                              <span className="text-outline">لا توجد اختبارات</span>
                            )}
                          </td>
                          <td className="px-5 py-3 text-center">
                            <span className="px-2 py-0.5 bg-error-container/20 text-error border border-error-container/30 text-[9px] font-bold rounded">
                              متعثر دراسياً
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 2: VIDEO ENGAGEMENT */}
          {activeSubTab === 'videos' && (
            <div className="bg-surface-container-lowest border border-outline-variant rounded-xl overflow-hidden">
              <div className="p-4 bg-surface-container-low border-b border-outline-variant">
                <h3 className="text-xs font-bold text-on-surface">إحصائيات تفاعل واكتمال مشاهدة المحاضرات</h3>
                <p className="text-[10px] text-on-surface-variant mt-0.5">يعرض متوسط مدة المشاهدة ونسبة اكمل المحاضرة للوقوف على جودة وتأثير المحتوى العلمي</p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-right text-xs">
                  <thead>
                    <tr className="border-b border-outline-variant text-on-surface-variant font-bold bg-surface-container-low">
                      <th className="px-5 py-3">اسم المحاضرة / الكورس</th>
                      <th className="px-5 py-3 text-center">عدد المشاهدين</th>
                      <th className="px-5 py-3 text-center">متوسط مدة المشاهدة</th>
                      <th className="px-5 py-3">متوسط نسبة إكمال الفيديو</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-outline-variant">
                    {videoEngagement.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="text-center py-10 text-on-surface-variant">لا توجد إحصائيات مشاهدات مسجلة بعد</td>
                      </tr>
                    ) : videoEngagement.map(video => {
                      const pct = Math.round(video.avg_completion_percentage || 0);
                      return (
                        <tr key={video.id} className="hover:bg-surface-container/20 transition duration-150">
                          <td className="px-5 py-3">
                            <div>
                              <p className="text-on-surface font-bold">{video.title}</p>
                              <p className="text-[10px] text-on-surface-variant mt-0.5">{video.course_title}</p>
                            </div>
                          </td>
                          <td className="px-5 py-3 text-center font-bold text-primary font-mono">{video.total_viewers} طالب</td>
                          <td className="px-5 py-3 text-center font-mono">{formatSeconds(video.avg_watched_seconds)}</td>
                          <td className="px-5 py-3 align-middle">
                            <div className="flex items-center gap-3">
                              <span className="font-bold font-mono text-[10px] text-primary w-8">%{pct}</span>
                              <div className="w-32 bg-outline-variant h-1.5 rounded-full overflow-hidden">
                                <div className="bg-primary h-full rounded-full" style={{ width: `${Math.min(pct, 100)}%` }} />
                              </div>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 3: ASSISTANT KPIS */}
          {activeSubTab === 'assistants' && (
            <div className="bg-surface-container-lowest border border-outline-variant rounded-xl overflow-hidden">
              <div className="p-4 bg-surface-container-low border-b border-outline-variant">
                <h3 className="text-xs font-bold text-on-surface">إحصائيات إنتاجية ومعدلات أداء المساعدين</h3>
                <p className="text-[10px] text-on-surface-variant mt-0.5">تتبع وتقييم مساهمة كل مساعد في حل المشاكل الفنية والإجابة عن أسئلة الطلاب</p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-right text-xs">
                  <thead>
                    <tr className="border-b border-outline-variant text-on-surface-variant font-bold bg-surface-container-low">
                      <th className="px-5 py-3">اسم المساعد</th>
                      <th className="px-5 py-3">البريد الإلكتروني</th>
                      <th className="px-5 py-3 text-center">الأسئلة العلمية المجابة</th>
                      <th className="px-5 py-3 text-center">طلبات فك الأجهزة المعالجة</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-outline-variant">
                    {assistantKpis.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="text-center py-10 text-on-surface-variant">لا توجد بيانات إنتاجية للمساعدين بعد</td>
                      </tr>
                    ) : assistantKpis.map(asst => (
                      <tr key={asst.id} className="hover:bg-surface-container/20 transition duration-150">
                        <td className="px-5 py-3 font-bold text-on-surface">{asst.full_name}</td>
                        <td className="px-5 py-3 text-on-surface-variant font-mono">{asst.email}</td>
                        <td className="px-5 py-3 text-center font-bold text-primary font-mono">{asst.questions_answered} سؤال</td>
                        <td className="px-5 py-3 text-center font-bold text-primary font-mono">{asst.resets_handled} طلب</td>
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
  );
}

function reqPhone(phone: string | null) {
  return phone || '-';
}
