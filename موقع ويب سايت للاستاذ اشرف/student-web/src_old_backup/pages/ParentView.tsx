import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { apiRequest } from '../services/api';
import './ParentView.css';

interface ParentViewProps {
  onBack: () => void;
}

interface Child {
  id: string;
  full_name: string;
  relation?: string | null;
}

interface CourseProgress {
  course_id: string;
  course_title: string;
  lessons_started: number;
  lessons_completed: number;
  watched_seconds: number;
}

interface ExamRow {
  attempt_id: string;
  quiz_id: string;
  quiz_title: string;
  max_score: number;
  score: number;
  submitted_at: string;
  cohort_avg: number | null;
  cohort_count: number;
}

interface Summary {
  student: { id: string; full_name: string; grade_year?: string | null };
  study: {
    total_seconds: number;
    total_hours: number;
    lessons_started: number;
    lessons_completed: number;
  };
  per_course: CourseProgress[];
  exams: ExamRow[];
}

interface Note {
  id: string;
  body: string;
  created_at: string;
  read_at: string | null;
  author_name: string;
}

const formatDate = (iso: string): string => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-GB', { year: 'numeric', month: '2-digit', day: '2-digit' });
};

const formatHours = (seconds: number): string => {
  const h = Math.floor(seconds / 3600);
  const m = Math.round((seconds % 3600) / 60);
  if (h === 0) return `${m} دقيقة`;
  return `${h} ساعة و ${m} دقيقة`;
};

export const ParentView: React.FC<ParentViewProps> = ({ onBack }) => {
  const [children, setChildren] = useState<Child[]>([]);
  const [activeId, setActiveId] = useState<string>('');
  const [summary, setSummary] = useState<Summary | null>(null);
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>('');

  // تحميل الأبناء المرتبطين بحساب وليّ الأمر
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await apiRequest<{ children: Child[] }>('/parent/children');
        if (!alive) return;
        const list = res?.children || [];
        setChildren(list);
        if (list.length > 0) setActiveId(list[0].id);
        else setLoading(false);
      } catch (e: any) {
        if (!alive) return;
        setError(e?.message?.includes('403')
          ? 'ليس لديك أبناء مرتبطون بهذا الحساب. تواصل مع إدارة المنصة لربط حسابك.'
          : 'تعذّر تحميل بيانات الأبناء.');
        setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  // تحميل الملخّص والملاحظات عند اختيار ابن
  useEffect(() => {
    if (!activeId) return;
    let alive = true;
    setLoading(true);
    setError('');
    (async () => {
      try {
        const [sum, noteRes] = await Promise.all([
          apiRequest<Summary>(`/parent/children/${encodeURIComponent(activeId)}/summary`),
          apiRequest<{ notes: Note[] }>(`/parent/children/${encodeURIComponent(activeId)}/notes`),
        ]);
        if (!alive) return;
        setSummary(sum);
        setNotes(noteRes?.notes || []);
      } catch (e: any) {
        if (!alive) return;
        setError('تعذّر تحميل بيانات هذا الطالب.');
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [activeId]);

  const markRead = useCallback(async () => {
    if (!activeId) return;
    try {
      await apiRequest(`/parent/children/${encodeURIComponent(activeId)}/notes/read`, {
        method: 'POST',
      });
      const now = new Date().toISOString();
      setNotes((prev) => prev.map((n) => (n.read_at ? n : { ...n, read_at: now })));
    } catch {
      /* نترك الحالة كما هي عند الفشل */
    }
  }, [activeId]);

  const averageScore = useMemo(() => {
    if (!summary?.exams?.length) return null;
    const graded = summary.exams.filter((e) => Number(e.max_score) > 0);
    if (!graded.length) return null;
    const total = graded.reduce((acc, e) => acc + (Number(e.score) / Number(e.max_score)) * 100, 0);
    return Math.round(total / graded.length);
  }, [summary]);

  const unreadCount = notes.filter((n) => !n.read_at).length;

  return (
    <div className="pv-page" dir="rtl">
      <div className="pv-shell">
        <div className="pv-header">
          <button className="pv-chip" type="button" onClick={onBack}>
            ← رجوع
          </button>
          <h1 className="pv-title" style={{ marginBlockStart: '16px' }}>
            متابعة وليّ الأمر
          </h1>
          <p className="pv-subtitle">
            متابعة شفافة لساعات المذاكرة الفعلية ونتائج الامتحانات، مع ملاحظات الأستاذ أشرف سليم.
          </p>

          {children.length > 1 && (
            <div className="pv-children" role="group" aria-label="اختيار الطالب">
              {children.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  className="pv-chip"
                  aria-pressed={c.id === activeId}
                  onClick={() => setActiveId(c.id)}
                >
                  {c.full_name}
                  {c.relation ? ` (${c.relation})` : ''}
                </button>
              ))}
            </div>
          )}
        </div>

        {error && (
          <div className="pv-error" role="alert">
            {error}
          </div>
        )}

        {loading && (
          <>
            <div className="pv-skeleton" />
            <div className="pv-skeleton" />
            <div className="pv-skeleton" />
          </>
        )}

        {!loading && !error && children.length === 0 && (
          <div className="pv-empty">
            لا يوجد طالب مرتبط بهذا الحساب بعد. يرجى التواصل مع إدارة المنصة لربط حسابك بابنك.
          </div>
        )}

        {!loading && !error && summary && (
          <>
            {/* الإحصائيات */}
            <div className="pv-stats">
              <div className="pv-card">
                <div className="pv-stat-label">إجمالي ساعات المذاكرة</div>
                <div className="pv-stat-value">
                  {summary.study.total_hours}
                  <span className="pv-stat-unit">ساعة</span>
                </div>
                <div className="pv-stat-label" style={{ marginBlockStart: '8px' }}>
                  {formatHours(summary.study.total_seconds)}
                </div>
              </div>

              <div className="pv-card">
                <div className="pv-stat-label">الدروس المكتملة</div>
                <div className="pv-stat-value">
                  {summary.study.lessons_completed}
                  <span className="pv-stat-unit">من {summary.study.lessons_started}</span>
                </div>
              </div>

              <div className="pv-card">
                <div className="pv-stat-label">الامتحانات المؤداة</div>
                <div className="pv-stat-value">{summary.exams.length}</div>
              </div>

              <div className="pv-card">
                <div className="pv-stat-label">متوسط النسبة المئوية</div>
                <div className="pv-stat-value">
                  {averageScore === null ? '—' : averageScore}
                  {averageScore !== null && <span className="pv-stat-unit">%</span>}
                </div>
              </div>
            </div>

            {/* التقدّم لكل كورس */}
            {summary.per_course.length > 0 && (
              <section className="pv-section">
                <h2 className="pv-section-title">التقدّم في المواد</h2>
                <div className="pv-card">
                  {summary.per_course.map((c) => {
                    const total = Math.max(Number(c.lessons_started) || 0, 1);
                    const done = Number(c.lessons_completed) || 0;
                    const pct = Math.min(100, Math.round((done / total) * 100));
                    return (
                      <div className="pv-course" key={c.course_id}>
                        <div className="pv-course-head">
                          <span className="pv-course-name">{c.course_title}</span>
                          <span className="pv-course-meta">
                            {done} / {Number(c.lessons_started) || 0} درس · {pct}%
                          </span>
                        </div>
                        <div
                          className="pv-track"
                          role="progressbar"
                          aria-valuenow={pct}
                          aria-valuemin={0}
                          aria-valuemax={100}
                          aria-label={`نسبة إتمام ${c.course_title}`}
                        >
                          <div className="pv-fill" style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            )}

            {/* الدرجات مقابل متوسط الدفعة */}
            <section className="pv-section">
              <h2 className="pv-section-title">نتائج الامتحانات مقارنةً بمتوسط الطلاب</h2>
              {summary.exams.length === 0 ? (
                <div className="pv-empty">لم يؤدِّ الطالب أي امتحان بعد.</div>
              ) : (
                <div className="pv-table-wrap">
                  <table className="pv-table">
                    <thead>
                      <tr>
                        <th scope="col">الامتحان</th>
                        <th scope="col">درجة الطالب</th>
                        <th scope="col">متوسط الطلاب</th>
                        <th scope="col">الفرق</th>
                        <th scope="col">التاريخ</th>
                      </tr>
                    </thead>
                    <tbody>
                      {summary.exams.map((e) => {
                        const score = Number(e.score) || 0;
                        const max = Number(e.max_score) || 0;
                        const cohort = e.cohort_avg === null ? null : Number(e.cohort_avg);
                        const diff = cohort === null ? null : score - cohort;
                        return (
                          <tr key={e.attempt_id}>
                            <td>{e.quiz_title}</td>
                            <td className="pv-num">
                              {score} / {max}
                            </td>
                            <td className="pv-num">{cohort === null ? '—' : cohort.toFixed(1)}</td>
                            <td className="pv-num">
                              {diff === null ? (
                                '—'
                              ) : (
                                <span className={diff >= 0 ? 'pv-above' : 'pv-below'}>
                                  {diff >= 0 ? '+' : ''}
                                  {diff.toFixed(1)}
                                </span>
                              )}
                            </td>
                            <td className="pv-num">{formatDate(e.submitted_at)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            {/* ملاحظات الأستاذ */}
            <section className="pv-section">
              <h2 className="pv-section-title">
                ملاحظات الأستاذ {unreadCount > 0 ? `(${unreadCount} جديدة)` : ''}
              </h2>
              {notes.length === 0 ? (
                <div className="pv-empty">لا توجد ملاحظات حتى الآن.</div>
              ) : (
                <>
                  {notes.map((n) => (
                    <div className={`pv-note${n.read_at ? '' : ' unread'}`} key={n.id}>
                      <div className="pv-note-body">{n.body}</div>
                      <div className="pv-note-meta">
                        {n.author_name} · {formatDate(n.created_at)}
                        {!n.read_at && ' · جديدة'}
                      </div>
                    </div>
                  ))}
                  {unreadCount > 0 && (
                    <button className="pv-mark-read" type="button" onClick={markRead}>
                      تعليم الكل كمقروء
                    </button>
                  )}
                </>
              )}
            </section>
          </>
        )}
      </div>
    </div>
  );
};

export default ParentView;
