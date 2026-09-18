'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { api, apiPost, apiPatch, apiDelete } from '@/lib/api';

// ── Domain model ──────────────────────────────────────────────────────
type QuestionType =
  | 'mcq'
  | 'true_false'
  | 'short_answer'
  | 'essay'
  | 'matching'
  | 'fill_blank'
  | 'ordering'
  | 'poetry_analysis';

type Difficulty = 'easy' | 'medium' | 'hard';

interface BankQuestion {
  id: string;
  course_id: string | null;
  unit_id: string | null;
  lesson_id: string | null;
  type: QuestionType;
  difficulty: Difficulty;
  bloom_level: string | null;
  question_text: string;
  image_url: string | null;
  options: string[] | null;
  correct_answer: unknown;
  explanation: string | null;
  points: number;
  tags: string[];
  source: string | null;
  usage_count: number;
  is_archived: boolean;
  created_at: string;
  updated_at: string;
}

interface Course {
  id: string;
  title: string;
}

interface Exam {
  id: string;
  title: string;
  course_title?: string;
}

interface TagCount {
  tag: string;
  count: number;
}

const TYPE_LABELS: Record<QuestionType, string> = {
  mcq: 'اختيار من متعدد',
  true_false: 'صح وخطأ',
  short_answer: 'إجابة قصيرة',
  essay: 'مقالي',
  matching: 'صِل',
  fill_blank: 'أكمل الفراغ',
  ordering: 'رتّب',
  poetry_analysis: 'تحليل شعري',
};

const DIFFICULTY_LABELS: Record<Difficulty, string> = {
  easy: 'سهل',
  medium: 'متوسط',
  hard: 'صعب',
};

const BLOOM_LEVELS = ['تذكر', 'فهم', 'تطبيق', 'تحليل', 'تقويم', 'إبداع'];

const TYPES_REQUIRING_OPTIONS: QuestionType[] = ['mcq', 'ordering'];
const TYPES_WITH_TEXT_ANSWER: QuestionType[] = ['short_answer', 'fill_blank', 'poetry_analysis', 'essay'];

const PAGE_SIZE = 20;

// ── Helpers ───────────────────────────────────────────────────────────
function downloadFile(filename: string, content: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

function csvCell(value: unknown): string {
  if (value === null || value === undefined) return '';
  const str = Array.isArray(value) ? value.join(' | ') : String(value);
  const guarded = /^[=+\-@\t\r]/.test(str) ? `'${str}` : str;
  return `"${guarded.replace(/"/g, '""')}"`;
}

function toCsv(rows: BankQuestion[]): string {
  const header = ['id', 'type', 'difficulty', 'question_text', 'options', 'correct_answer', 'explanation', 'points', 'tags', 'source'];
  const lines = [header.join(',')];
  for (const r of rows) {
    lines.push([
      csvCell(r.id),
      csvCell(TYPE_LABELS[r.type] || r.type),
      csvCell(DIFFICULTY_LABELS[r.difficulty] || r.difficulty),
      csvCell(r.question_text),
      csvCell(r.options),
      csvCell(typeof r.correct_answer === 'object' ? JSON.stringify(r.correct_answer) : r.correct_answer),
      csvCell(r.explanation),
      csvCell(r.points),
      csvCell(r.tags),
      csvCell(r.source),
    ].join(','));
  }
  return '\uFEFF' + lines.join('\r\n');
}

function answerToText(answer: unknown): string {
  if (answer === null || answer === undefined) return '';
  if (typeof answer === 'object') {
    const obj = answer as Record<string, unknown>;
    if (typeof obj.text === 'string') return obj.text;
    if (typeof obj.rubric === 'string') return obj.rubric;
    return JSON.stringify(answer);
  }
  return String(answer);
}

function answerToBool(answer: unknown): boolean {
  if (answer && typeof answer === 'object') {
    return Boolean((answer as Record<string, unknown>).value);
  }
  return false;
}

function answerToIndex(answer: unknown): number {
  if (answer && typeof answer === 'object') {
    const idx = (answer as Record<string, unknown>).option_index;
    return typeof idx === 'number' ? idx : -1;
  }
  return -1;
}

function difficultyBadgeClass(difficulty: Difficulty): string {
  if (difficulty === 'easy') return 'bg-success-container text-on-success-container border-success/30';
  if (difficulty === 'hard') return 'bg-error-container text-on-error-container border-error/30';
  return 'bg-warning-container text-on-warning-container border-warning/30';
}

// ── Small presentational pieces ───────────────────────────────────────
function Modal({
  open,
  title,
  onClose,
  children,
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-fusha-teal-900/50 p-4 sm:p-8">
      <div className="w-full max-w-3xl rounded-fusha-lg bg-surface border border-outline-variant shadow-fusha-lg">
        <div className="flex items-center justify-between gap-4 border-b border-outline-variant p-4">
          <h2 className="text-headline-sm font-headline-sm text-on-surface">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="إغلاق"
            className="flex h-12 w-12 items-center justify-center rounded-fusha-md text-on-surface-variant transition hover:bg-surface-container"
          >
            <span className="material-symbols-outlined text-xl">close</span>
          </button>
        </div>
        <div className="p-4">{children}</div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-2">
      <span className="text-label-md text-on-surface-variant">{label}</span>
      {children}
    </label>
  );
}

const inputClass =
  'w-full min-h-12 rounded-fusha-md border border-outline-variant bg-surface px-4 py-2 text-body-md text-on-surface placeholder:text-outline transition focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary';

// ── Main panel ────────────────────────────────────────────────────────
export default function QuestionBankPanel() {
  const [questions, setQuestions] = useState<BankQuestion[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  // Filters
  const [search, setSearch] = useState('');
  const [appliedSearch, setAppliedSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [difficultyFilter, setDifficultyFilter] = useState('');
  const [tagFilter, setTagFilter] = useState('');
  const [courseFilter, setCourseFilter] = useState('');
  const [sort, setSort] = useState('created_at');

  // Reference data
  const [tags, setTags] = useState<TagCount[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [exams, setExams] = useState<Exam[]>([]);

  // Selection (for attaching to an exam)
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [attachExamId, setAttachExamId] = useState('');
  const [attaching, setAttaching] = useState(false);

  // Editor
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    type: 'mcq' as QuestionType,
    difficulty: 'medium' as Difficulty,
    bloom_level: '',
    course_id: '',
    question_text: '',
    image_url: '',
    options: ['', '', '', ''] as string[],
    correctIndex: 0,
    correctBool: true,
    answerText: '',
    answerJson: '',
    explanation: '',
    points: 1,
    tags: '',
    source: '',
  });

  // Bulk import
  const [importOpen, setImportOpen] = useState(false);
  const [importText, setImportText] = useState('');
  const [importing, setImporting] = useState(false);

  // Random pick
  const [randomOpen, setRandomOpen] = useState(false);
  const [randomCount, setRandomCount] = useState(10);
  const [randomType, setRandomType] = useState('');
  const [randomDifficulty, setRandomDifficulty] = useState('');
  const [randomTag, setRandomTag] = useState('');
  const [randomCourseId, setRandomCourseId] = useState('');
  const [randomResults, setRandomResults] = useState<BankQuestion[]>([]);
  const [pickingRandom, setPickingRandom] = useState(false);

  // ── Data loading ────────────────────────────────────────────────────
  const loadQuestions = useCallback(async (pageNum: number) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(pageNum),
        limit: String(PAGE_SIZE),
        sort,
      });
      if (appliedSearch) params.set('q', appliedSearch);
      if (typeFilter) params.set('type', typeFilter);
      if (difficultyFilter) params.set('difficulty', difficultyFilter);
      if (tagFilter) params.set('tag', tagFilter);
      if (courseFilter) params.set('course_id', courseFilter);

      const data = await api<{ questions: BankQuestion[]; meta: { total: number } }>(
        `/question-bank?${params.toString()}`
      );
      setQuestions(data.questions || []);
      setTotal(data.meta?.total || 0);
      setPage(pageNum);
      setError('');
    } catch (e: any) {
      setError(e.message || 'فشل تحميل بنك الأسئلة');
    } finally {
      setLoading(false);
    }
  }, [appliedSearch, typeFilter, difficultyFilter, tagFilter, courseFilter, sort]);

  useEffect(() => {
    loadQuestions(1);
  }, [loadQuestions]);

  useEffect(() => {
    const loadReferences = async () => {
      try {
        const tagData = await api<{ tags: TagCount[] }>('/question-bank/tags');
        setTags(tagData.tags || []);
      } catch {
        setTags([]);
      }
      try {
        const courseData = await api<{ courses: Course[] }>('/courses');
        setCourses(courseData.courses || []);
      } catch {
        setCourses([]);
      }
      try {
        const examData = await api<{ exams: Exam[] }>('/admin/exams');
        setExams(examData.exams || []);
      } catch {
        setExams([]);
      }
    };
    loadReferences();
  }, []);

  // ── Editor ──────────────────────────────────────────────────────────
  const resetForm = () => {
    setForm({
      type: 'mcq',
      difficulty: 'medium',
      bloom_level: '',
      course_id: '',
      question_text: '',
      image_url: '',
      options: ['', '', '', ''],
      correctIndex: 0,
      correctBool: true,
      answerText: '',
      answerJson: '',
      explanation: '',
      points: 1,
      tags: '',
      source: '',
    });
  };

  const openCreate = () => {
    setEditingId(null);
    resetForm();
    setEditorOpen(true);
  };

  const openEdit = (q: BankQuestion) => {
    setEditingId(q.id);
    setForm({
      type: q.type,
      difficulty: q.difficulty,
      bloom_level: q.bloom_level || '',
      course_id: q.course_id || '',
      question_text: q.question_text,
      image_url: q.image_url || '',
      options: q.options && q.options.length > 0 ? [...q.options] : ['', ''],
      correctIndex: answerToIndex(q.correct_answer) >= 0 ? answerToIndex(q.correct_answer) : 0,
      correctBool: answerToBool(q.correct_answer),
      answerText: answerToText(q.correct_answer),
      answerJson: q.correct_answer ? JSON.stringify(q.correct_answer, null, 2) : '',
      explanation: q.explanation || '',
      points: q.points,
      tags: (q.tags || []).join('، '),
      source: q.source || '',
    });
    setEditorOpen(true);
  };

  const buildCorrectAnswer = (): unknown => {
    if (form.type === 'mcq') {
      const optionText = form.options[form.correctIndex] || '';
      return { option_index: form.correctIndex, option_text: optionText };
    }
    if (form.type === 'true_false') {
      return { value: form.correctBool };
    }
    if (form.type === 'matching' || form.type === 'ordering') {
      return form.answerJson.trim() ? JSON.parse(form.answerJson) : null;
    }
    if (form.type === 'essay') {
      return { rubric: form.answerText };
    }
    return { text: form.answerText };
  };

  const saveQuestion = async () => {
    if (!form.question_text.trim()) {
      setError('نص السؤال مطلوب');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const payload = {
        type: form.type,
        difficulty: form.difficulty,
        bloom_level: form.bloom_level || null,
        course_id: form.course_id || null,
        question_text: form.question_text.trim(),
        image_url: form.image_url.trim() || null,
        options: TYPES_REQUIRING_OPTIONS.includes(form.type)
          ? form.options.filter((o) => o.trim().length > 0)
          : null,
        correct_answer: buildCorrectAnswer(),
        explanation: form.explanation.trim() || null,
        points: form.points,
        tags: form.tags.split(/[،,]/).map((t) => t.trim()).filter(Boolean),
        source: form.source.trim() || null,
      };

      if (editingId) {
        await apiPatch(`/question-bank/${editingId}`, payload);
        setNotice('تم حفظ تعديلات السؤال بنجاح');
      } else {
        await apiPost('/question-bank', payload);
        setNotice('تمت إضافة السؤال إلى بنك الأسئلة');
      }
      setEditorOpen(false);
      await loadQuestions(page);
    } catch (e: any) {
      setError(e.message || 'فشل حفظ السؤال. تحقق من البيانات ثم أعد المحاولة.');
    } finally {
      setSaving(false);
    }
  };

  const archiveQuestion = async (q: BankQuestion) => {
    if (!confirm('هل تريد أرشفة هذا السؤال؟ لن يظهر في البحث الافتراضي.')) return;
    try {
      await apiDelete(`/question-bank/${q.id}`);
      setNotice('تم أرشفة السؤال');
      await loadQuestions(page);
    } catch (e: any) {
      setError(e.message || 'فشل أرشفة السؤال');
    }
  };

  // ── Bulk import ─────────────────────────────────────────────────────
  const runImport = async () => {
    let parsed: unknown;
    try {
      parsed = JSON.parse(importText);
    } catch {
      setError('النص غير صالح. يجب أن يكون مصفوفة JSON صحيحة.');
      return;
    }
    const list = Array.isArray(parsed) ? parsed : (parsed as { questions?: unknown[] })?.questions;
    if (!Array.isArray(list) || list.length === 0) {
      setError('لم يتم العثور على أسئلة. أرسل مصفوفة JSON أو كائنًا يحتوي على questions.');
      return;
    }
    setImporting(true);
    setError('');
    try {
      const res = await apiPost<{ created: number }>('/question-bank/bulk', { questions: list });
      setNotice(`تم استيراد ${res.created ?? list.length} سؤالًا بنجاح`);
      setImportOpen(false);
      setImportText('');
      await loadQuestions(1);
    } catch (e: any) {
      setError(e.message || 'فشل استيراد الأسئلة');
    } finally {
      setImporting(false);
    }
  };

  const exportQuestions = async (format: 'json' | 'csv') => {
    try {
      const params = new URLSearchParams();
      if (appliedSearch) params.set('q', appliedSearch);
      if (typeFilter) params.set('type', typeFilter);
      if (difficultyFilter) params.set('difficulty', difficultyFilter);
      if (tagFilter) params.set('tag', tagFilter);
      if (courseFilter) params.set('course_id', courseFilter);

      const data = await api<{ questions: BankQuestion[] }>(`/question-bank/export?${params.toString()}`);
      const rows = data.questions || [];
      if (rows.length === 0) {
        setNotice('لا توجد أسئلة مطابقة للتصدير');
        return;
      }
      const stamp = new Date().toISOString().slice(0, 10);
      if (format === 'csv') {
        downloadFile(`بنك-الأسئلة-${stamp}.csv`, toCsv(rows), 'text/csv;charset=utf-8');
      } else {
        downloadFile(`بنك-الأسئلة-${stamp}.json`, JSON.stringify(rows, null, 2), 'application/json');
      }
      setNotice(`تم تصدير ${rows.length} سؤالًا`);
    } catch (e: any) {
      setError(e.message || 'فشل تصدير الأسئلة');
    }
  };

  // ── Random pick + attach ────────────────────────────────────────────
  const runRandomPick = async () => {
    setPickingRandom(true);
    setError('');
    try {
      const payload: Record<string, unknown> = { count: randomCount };
      if (randomType) payload.type = randomType;
      if (randomDifficulty) payload.difficulty = randomDifficulty;
      if (randomTag) payload.tags = [randomTag];
      if (randomCourseId) payload.course_id = randomCourseId;
      payload.exclude_ids = [];

      const data = await apiPost<{ questions: BankQuestion[] }>('/question-bank/random', payload);
      setRandomResults(data.questions || []);
    } catch (e: any) {
      setError(e.message || 'فشل اختيار الأسئلة العشوائية');
    } finally {
      setPickingRandom(false);
    }
  };

  const attachToExam = async (questionIds: string[]) => {
    if (questionIds.length === 0) {
      setError('اختر سؤالًا واحدًا على الأقل');
      return;
    }
    if (!attachExamId) {
      setError('اختر الامتحان الذي تريد إضافة الأسئلة إليه');
      return;
    }
    setAttaching(true);
    setError('');
    try {
      await apiPost('/question-bank/attach', { quiz_id: attachExamId, question_ids: questionIds });
      const exam = exams.find((e) => e.id === attachExamId);
      setNotice(`تمت إضافة ${questionIds.length} سؤالًا إلى امتحان «${exam?.title || ''}»`);
      setRandomOpen(false);
      setRandomResults([]);
      setSelectedIds([]);
    } catch (e: any) {
      setError(e.message || 'فشل إضافة الأسئلة إلى الامتحان');
    } finally {
      setAttaching(false);
    }
  };

  // ── Derived ─────────────────────────────────────────────────────────
  const totalPages = useMemo(() => Math.max(1, Math.ceil(total / PAGE_SIZE)), [total]);

  const toggleSelected = (id: string) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const optionFieldsVisible = TYPES_REQUIRING_OPTIONS.includes(form.type);
  const jsonAnswerVisible = form.type === 'matching' || form.type === 'ordering';
  const textAnswerVisible = TYPES_WITH_TEXT_ANSWER.includes(form.type);

  return (
    <div className="flex flex-col gap-6" dir="rtl">
      {/* ── Header ── */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="font-headline-md text-xl font-bold text-on-surface">بنك الأسئلة</h2>
          <p className="mt-1 text-body-sm text-on-surface-variant">
            مخزن موحّد للأسئلة يُعاد استخدامه في أكثر من امتحان — مع تصنيف بالنوع والمستوى والوسم
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={openCreate}
            className="flex min-h-12 items-center gap-2 rounded-fusha-md bg-primary px-4 text-label-md text-on-primary transition hover:opacity-90"
          >
            <span className="material-symbols-outlined text-lg">add</span>
            <span>سؤال جديد</span>
          </button>
          <button
            type="button"
            onClick={() => setImportOpen(true)}
            className="flex min-h-12 items-center gap-2 rounded-fusha-md border border-outline-variant bg-surface px-4 text-label-md text-on-surface-variant transition hover:border-primary hover:text-primary"
          >
            <span className="material-symbols-outlined text-lg">upload_file</span>
            <span>استيراد</span>
          </button>
          <button
            type="button"
            onClick={() => exportQuestions('json')}
            className="flex min-h-12 items-center gap-2 rounded-fusha-md border border-outline-variant bg-surface px-4 text-label-md text-on-surface-variant transition hover:border-primary hover:text-primary"
          >
            <span className="material-symbols-outlined text-lg">download</span>
            <span>تصدير JSON</span>
          </button>
          <button
            type="button"
            onClick={() => exportQuestions('csv')}
            className="flex min-h-12 items-center gap-2 rounded-fusha-md border border-outline-variant bg-surface px-4 text-label-md text-on-surface-variant transition hover:border-primary hover:text-primary"
          >
            <span className="material-symbols-outlined text-lg">grid_on</span>
            <span>تصدير CSV</span>
          </button>
          <button
            type="button"
            onClick={() => setRandomOpen(true)}
            className="flex min-h-12 items-center gap-2 rounded-fusha-md bg-accent px-4 text-label-md text-on-accent transition hover:opacity-90"
          >
            <span className="material-symbols-outlined text-lg">casino</span>
            <span>إنشاء امتحان عشوائي</span>
          </button>
        </div>
      </div>

      {/* ── Alerts ── */}
      {error && (
        <div className="flex items-center justify-between gap-4 rounded-fusha-md border border-error/40 bg-error-container p-4 text-body-sm text-on-error-container">
          <span>{error}</span>
          <button type="button" onClick={() => setError('')} className="min-h-12 px-2 font-bold underline">
            إغلاق
          </button>
        </div>
      )}
      {notice && (
        <div className="flex items-center justify-between gap-4 rounded-fusha-md border border-success/40 bg-success-container p-4 text-body-sm text-on-success-container">
          <span>{notice}</span>
          <button type="button" onClick={() => setNotice('')} className="min-h-12 px-2 font-bold underline">
            إغلاق
          </button>
        </div>
      )}

      {/* ── Filters ── */}
      <div className="rounded-fusha-lg border border-outline-variant bg-surface p-4 shadow-fusha-sm">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Field label="بحث في نص السؤال">
            <div className="relative">
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && setAppliedSearch(search)}
                placeholder="مثال: المفعول به"
                className={`${inputClass} ps-10`}
              />
              <span className="material-symbols-outlined pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-outline">
                search
              </span>
            </div>
          </Field>

          <Field label="نوع السؤال">
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className={inputClass}
            >
              <option value="">كل الأنواع</option>
              {Object.entries(TYPE_LABELS).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </Field>

          <Field label="مستوى الصعوبة">
            <select
              value={difficultyFilter}
              onChange={(e) => setDifficultyFilter(e.target.value)}
              className={inputClass}
            >
              <option value="">كل المستويات</option>
              {Object.entries(DIFFICULTY_LABELS).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </Field>

          <Field label="الوسم">
            <select value={tagFilter} onChange={(e) => setTagFilter(e.target.value)} className={inputClass}>
              <option value="">كل الوسوم</option>
              {tags.map((t) => (
                <option key={t.tag} value={t.tag}>{t.tag} ({t.count})</option>
              ))}
            </select>
          </Field>

          <Field label="الكورس">
            <select value={courseFilter} onChange={(e) => setCourseFilter(e.target.value)} className={inputClass}>
              <option value="">كل الكورسات</option>
              {courses.map((c) => (
                <option key={c.id} value={c.id}>{c.title}</option>
              ))}
            </select>
          </Field>

          <Field label="الترتيب">
            <select value={sort} onChange={(e) => setSort(e.target.value)} className={inputClass}>
              <option value="created_at">الأحدث إضافةً</option>
              <option value="usage_count">الأكثر استخدامًا</option>
              <option value="difficulty">حسب الصعوبة</option>
              <option value="points">حسب الدرجات</option>
              <option value="updated_at">آخر تعديل</option>
            </select>
          </Field>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setAppliedSearch(search)}
            className="flex min-h-12 items-center gap-2 rounded-fusha-md bg-primary px-4 text-label-md text-on-primary transition hover:opacity-90"
          >
            <span className="material-symbols-outlined text-lg">filter_alt</span>
            <span>تطبيق الفلاتر</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setSearch('');
              setAppliedSearch('');
              setTypeFilter('');
              setDifficultyFilter('');
              setTagFilter('');
              setCourseFilter('');
              setSort('created_at');
            }}
            className="flex min-h-12 items-center gap-2 rounded-fusha-md border border-outline-variant bg-surface px-4 text-label-md text-on-surface-variant transition hover:border-primary hover:text-primary"
          >
            <span className="material-symbols-outlined text-lg">restart_alt</span>
            <span>إعادة تعيين</span>
          </button>
          <span className="ms-auto text-body-sm text-on-surface-variant">
            إجمالي الأسئلة المطابقة: <strong className="text-on-surface">{total}</strong>
          </span>
        </div>
      </div>

      {/* ── Attach bar ── */}
      <div className="flex flex-wrap items-end gap-4 rounded-fusha-lg border border-accent/40 bg-accent-container p-4">
        <div className="min-w-[240px] flex-1">
          <Field label="إضافة الأسئلة المحددة إلى امتحان">
            <select
              value={attachExamId}
              onChange={(e) => setAttachExamId(e.target.value)}
              className={inputClass}
            >
              <option value="">اختر امتحانًا...</option>
              {exams.map((ex) => (
                <option key={ex.id} value={ex.id}>
                  {ex.title}{ex.course_title ? ` — ${ex.course_title}` : ''}
                </option>
              ))}
            </select>
          </Field>
        </div>
        <button
          type="button"
          onClick={() => attachToExam(selectedIds)}
          disabled={attaching || selectedIds.length === 0}
          className="flex min-h-12 items-center gap-2 rounded-fusha-md bg-primary px-4 text-label-md text-on-primary transition hover:opacity-90 disabled:opacity-40"
        >
          <span className="material-symbols-outlined text-lg">link</span>
          <span>{attaching ? 'جارٍ الإضافة...' : `إضافة (${selectedIds.length})`}</span>
        </button>
      </div>

      {/* ── List ── */}
      {loading ? (
        <div className="flex justify-center rounded-fusha-lg border border-outline-variant bg-surface p-8">
          <span className="material-symbols-outlined animate-spin text-2xl text-primary">sync</span>
        </div>
      ) : questions.length === 0 ? (
        <div className="rounded-fusha-lg border border-outline-variant bg-surface p-8 text-center">
          <span className="material-symbols-outlined mb-2 block text-4xl text-outline">inbox</span>
          <p className="text-body-md text-on-surface-variant">لا توجد أسئلة تطابق الفلاتر الحالية</p>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {questions.map((q) => (
            <article
              key={q.id}
              className="rounded-fusha-lg border border-outline-variant bg-surface p-4 shadow-fusha-sm transition hover:shadow-fusha-md"
            >
              <div className="flex items-start gap-4">
                <input
                  type="checkbox"
                  checked={selectedIds.includes(q.id)}
                  onChange={() => toggleSelected(q.id)}
                  aria-label="تحديد السؤال"
                  className="mt-2 h-4 w-4 shrink-0"
                />
                <div className="flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-fusha-sm bg-secondary-container px-2 py-1 text-label-md text-on-secondary-container">
                      {TYPE_LABELS[q.type] || q.type}
                    </span>
                    <span className={`rounded-fusha-sm border px-2 py-1 text-label-md ${difficultyBadgeClass(q.difficulty)}`}>
                      {DIFFICULTY_LABELS[q.difficulty] || q.difficulty}
                    </span>
                    <span className="rounded-fusha-sm bg-surface-container-high px-2 py-1 text-label-md text-on-surface-variant">
                      {q.points} درجة
                    </span>
                    {q.bloom_level && (
                      <span className="rounded-fusha-sm bg-accent-container px-2 py-1 text-label-md text-on-accent-container">
                        {q.bloom_level}
                      </span>
                    )}
                    <span className="text-body-sm text-outline">استُخدم {q.usage_count} مرة</span>
                  </div>

                  <p className="mt-4 whitespace-pre-wrap text-body-md leading-relaxed text-on-surface">
                    {q.question_text}
                  </p>

                  {q.options && q.options.length > 0 && (
                    <ul className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
                      {q.options.map((opt, idx) => {
                        const isCorrect = q.type === 'mcq' && answerToIndex(q.correct_answer) === idx;
                        return (
                          <li
                            key={idx}
                            className={`rounded-fusha-sm border px-4 py-2 text-body-sm ${
                              isCorrect
                                ? 'border-success/40 bg-success-container text-on-success-container'
                                : 'border-outline-variant text-on-surface-variant'
                            }`}
                          >
                            {opt}
                          </li>
                        );
                      })}
                    </ul>
                  )}

                  {(q.tags || []).length > 0 && (
                    <div className="mt-4 flex flex-wrap gap-2">
                      {q.tags.map((tag) => (
                        <span
                          key={tag}
                          className="rounded-fusha-sm bg-fusha-teal-50 px-2 py-1 text-label-md text-fusha-teal-700"
                        >
                          #{tag}
                        </span>
                      ))}
                    </div>
                  )}

                  <div className="mt-4 flex flex-wrap items-center gap-2 text-body-sm text-on-surface-variant">
                    {q.source && (
                      <span className="flex items-center gap-1">
                        <span className="material-symbols-outlined text-base">source</span>
                        {q.source}
                      </span>
                    )}
                    <span className="ms-auto flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => openEdit(q)}
                        className="flex min-h-12 items-center gap-1 rounded-fusha-md px-4 text-label-md text-primary transition hover:bg-surface-container"
                      >
                        <span className="material-symbols-outlined text-lg">edit</span>
                        تعديل
                      </button>
                      <button
                        type="button"
                        onClick={() => archiveQuestion(q)}
                        className="flex min-h-12 items-center gap-1 rounded-fusha-md px-4 text-label-md text-error transition hover:bg-error-container"
                      >
                        <span className="material-symbols-outlined text-lg">archive</span>
                        أرشفة
                      </button>
                    </span>
                  </div>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}

      {/* ── Pagination ── */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-4">
          <button
            type="button"
            onClick={() => loadQuestions(page - 1)}
            disabled={page <= 1 || loading}
            className="flex min-h-12 items-center gap-2 rounded-fusha-md border border-outline-variant bg-surface px-4 text-label-md text-on-surface-variant transition hover:border-primary hover:text-primary disabled:opacity-40"
          >
            <span className="material-symbols-outlined text-lg">chevron_right</span>
            السابق
          </button>
          <span className="text-body-sm text-on-surface-variant">
            صفحة {page} من {totalPages}
          </span>
          <button
            type="button"
            onClick={() => loadQuestions(page + 1)}
            disabled={page >= totalPages || loading}
            className="flex min-h-12 items-center gap-2 rounded-fusha-md border border-outline-variant bg-surface px-4 text-label-md text-on-surface-variant transition hover:border-primary hover:text-primary disabled:opacity-40"
          >
            التالي
            <span className="material-symbols-outlined text-lg">chevron_left</span>
          </button>
        </div>
      )}

      {/* ── Create / Edit modal ── */}
      <Modal
        open={editorOpen}
        title={editingId ? 'تعديل السؤال' : 'إضافة سؤال إلى بنك الأسئلة'}
        onClose={() => setEditorOpen(false)}
      >
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="نوع السؤال">
              <select
                value={form.type}
                onChange={(e) => setForm({ ...form, type: e.target.value as QuestionType })}
                className={inputClass}
              >
                {Object.entries(TYPE_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </Field>
            <Field label="مستوى الصعوبة">
              <select
                value={form.difficulty}
                onChange={(e) => setForm({ ...form, difficulty: e.target.value as Difficulty })}
                className={inputClass}
              >
                {Object.entries(DIFFICULTY_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </Field>
            <Field label="مستوى بلوم (اختياري)">
              <select
                value={form.bloom_level}
                onChange={(e) => setForm({ ...form, bloom_level: e.target.value })}
                className={inputClass}
              >
                <option value="">بدون</option>
                {BLOOM_LEVELS.map((level) => (
                  <option key={level} value={level}>{level}</option>
                ))}
              </select>
            </Field>
            <Field label="الكورس (اختياري)">
              <select
                value={form.course_id}
                onChange={(e) => setForm({ ...form, course_id: e.target.value })}
                className={inputClass}
              >
                <option value="">غير مرتبط بكورس</option>
                {courses.map((c) => (
                  <option key={c.id} value={c.id}>{c.title}</option>
                ))}
              </select>
            </Field>
          </div>

          <Field label="نص السؤال">
            <textarea
              value={form.question_text}
              onChange={(e) => setForm({ ...form, question_text: e.target.value })}
              rows={4}
              className={inputClass}
              placeholder="اكتب نص السؤال هنا..."
            />
          </Field>

          <Field label="رابط صورة السؤال (اختياري)">
            <input
              value={form.image_url}
              onChange={(e) => setForm({ ...form, image_url: e.target.value })}
              className={inputClass}
              placeholder="https://..."
            />
          </Field>

          {optionFieldsVisible && (
            <div className="flex flex-col gap-2">
              <span className="text-label-md text-on-surface-variant">الخيارات</span>
              {form.options.map((opt, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  {form.type === 'mcq' && (
                    <input
                      type="radio"
                      name="correct-option"
                      checked={form.correctIndex === idx}
                      onChange={() => setForm({ ...form, correctIndex: idx })}
                      aria-label={`تعيين الخيار ${idx + 1} كإجابة صحيحة`}
                      className="h-4 w-4 shrink-0"
                    />
                  )}
                  <input
                    value={opt}
                    onChange={(e) => {
                      const next = [...form.options];
                      next[idx] = e.target.value;
                      setForm({ ...form, options: next });
                    }}
                    className={inputClass}
                    placeholder={`الخيار ${idx + 1}`}
                  />
                  <button
                    type="button"
                    onClick={() => setForm({ ...form, options: form.options.filter((_, i) => i !== idx) })}
                    disabled={form.options.length <= 2}
                    aria-label="حذف الخيار"
                    className="flex h-12 w-12 shrink-0 items-center justify-center rounded-fusha-md text-error transition hover:bg-error-container disabled:opacity-40"
                  >
                    <span className="material-symbols-outlined text-lg">delete</span>
                  </button>
                </div>
              ))}
              <button
                type="button"
                onClick={() => setForm({ ...form, options: [...form.options, ''] })}
                className="flex min-h-12 items-center justify-center gap-2 rounded-fusha-md border border-dashed border-outline-variant text-label-md text-on-surface-variant transition hover:border-primary hover:text-primary"
              >
                <span className="material-symbols-outlined text-lg">add</span>
                إضافة خيار
              </button>
            </div>
          )}

          {form.type === 'true_false' && (
            <Field label="الإجابة الصحيحة">
              <div className="flex gap-4">
                <button
                  type="button"
                  onClick={() => setForm({ ...form, correctBool: true })}
                  className={`min-h-12 flex-1 rounded-fusha-md border text-label-md transition ${
                    form.correctBool ? 'border-success bg-success-container text-on-success-container' : 'border-outline-variant text-on-surface-variant'
                  }`}
                >
                  صح
                </button>
                <button
                  type="button"
                  onClick={() => setForm({ ...form, correctBool: false })}
                  className={`min-h-12 flex-1 rounded-fusha-md border text-label-md transition ${
                    !form.correctBool ? 'border-error bg-error-container text-on-error-container' : 'border-outline-variant text-on-surface-variant'
                  }`}
                >
                  خطأ
                </button>
              </div>
            </Field>
          )}

          {textAnswerVisible && (
            <Field label={form.type === 'essay' ? 'نقاط التقييم (Rubric)' : 'الإجابة النموذجية'}>
              <textarea
                value={form.answerText}
                onChange={(e) => setForm({ ...form, answerText: e.target.value })}
                rows={3}
                className={inputClass}
              />
            </Field>
          )}

          {jsonAnswerVisible && (
            <Field label="الإجابة الصحيحة (JSON)">
              <textarea
                value={form.answerJson}
                onChange={(e) => setForm({ ...form, answerJson: e.target.value })}
                rows={4}
                dir="ltr"
                className={inputClass}
                placeholder='{"order":[0,2,1]}'
              />
            </Field>
          )}

          <Field label="التفسير / الشرح بعد التصحيح (اختياري)">
            <textarea
              value={form.explanation}
              onChange={(e) => setForm({ ...form, explanation: e.target.value })}
              rows={3}
              className={inputClass}
            />
          </Field>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Field label="الدرجات">
              <input
                type="number"
                min={1}
                max={100}
                value={form.points}
                onChange={(e) => setForm({ ...form, points: Number(e.target.value) || 1 })}
                className={inputClass}
              />
            </Field>
            <Field label="الوسوم (يفصل بينها بفاصلة)">
              <input
                value={form.tags}
                onChange={(e) => setForm({ ...form, tags: e.target.value })}
                className={inputClass}
                placeholder="النحو، المفعول به"
              />
            </Field>
            <Field label="المصدر">
              <input
                value={form.source}
                onChange={(e) => setForm({ ...form, source: e.target.value })}
                className={inputClass}
                placeholder="وزاري 2024"
              />
            </Field>
          </div>

          <div className="flex flex-wrap items-center justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setEditorOpen(false)}
              className="flex min-h-12 items-center rounded-fusha-md border border-outline-variant bg-surface px-4 text-label-md text-on-surface-variant transition hover:border-primary"
            >
              إلغاء
            </button>
            <button
              type="button"
              onClick={saveQuestion}
              disabled={saving}
              className="flex min-h-12 items-center gap-2 rounded-fusha-md bg-primary px-4 text-label-md text-on-primary transition hover:opacity-90 disabled:opacity-40"
            >
              {saving && <span className="material-symbols-outlined animate-spin text-lg">sync</span>}
              {editingId ? 'حفظ التعديلات' : 'إضافة السؤال'}
            </button>
          </div>
        </div>
      </Modal>

      {/* ── Bulk import modal ── */}
      <Modal open={importOpen} title="استيراد مجموعة أسئلة" onClose={() => setImportOpen(false)}>
        <div className="flex flex-col gap-4">
          <p className="text-body-sm text-on-surface-variant">
            الصق مصفوفة JSON تحتوي على الأسئلة. كل سؤال يقبل الحقول: question_text، type، difficulty،
            options، correct_answer، explanation، points، tags، source.
          </p>
          <textarea
            value={importText}
            onChange={(e) => setImportText(e.target.value)}
            rows={12}
            dir="ltr"
            className={inputClass}
            placeholder={'[\n  { "question_text": "...", "type": "mcq", "options": ["أ","ب"], "correct_answer": {"option_index":0} }\n]'}
          />
          <div className="flex flex-wrap items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => setImportOpen(false)}
              className="flex min-h-12 items-center rounded-fusha-md border border-outline-variant bg-surface px-4 text-label-md text-on-surface-variant transition hover:border-primary"
            >
              إلغاء
            </button>
            <button
              type="button"
              onClick={runImport}
              disabled={importing || !importText.trim()}
              className="flex min-h-12 items-center gap-2 rounded-fusha-md bg-primary px-4 text-label-md text-on-primary transition hover:opacity-90 disabled:opacity-40"
            >
              {importing && <span className="material-symbols-outlined animate-spin text-lg">sync</span>}
              بدء الاستيراد
            </button>
          </div>
        </div>
      </Modal>

      {/* ── Random pick modal ── */}
      <Modal open={randomOpen} title="إنشاء امتحان عشوائي من بنك الأسئلة" onClose={() => setRandomOpen(false)}>
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="عدد الأسئلة">
              <input
                type="number"
                min={1}
                max={100}
                value={randomCount}
                onChange={(e) => setRandomCount(Number(e.target.value) || 1)}
                className={inputClass}
              />
            </Field>
            <Field label="النوع">
              <select value={randomType} onChange={(e) => setRandomType(e.target.value)} className={inputClass}>
                <option value="">كل الأنواع</option>
                {Object.entries(TYPE_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </Field>
            <Field label="الصعوبة">
              <select value={randomDifficulty} onChange={(e) => setRandomDifficulty(e.target.value)} className={inputClass}>
                <option value="">كل المستويات</option>
                {Object.entries(DIFFICULTY_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </Field>
            <Field label="الوسم">
              <select value={randomTag} onChange={(e) => setRandomTag(e.target.value)} className={inputClass}>
                <option value="">كل الوسوم</option>
                {tags.map((t) => (
                  <option key={t.tag} value={t.tag}>{t.tag}</option>
                ))}
              </select>
            </Field>
            <Field label="الكورس">
              <select value={randomCourseId} onChange={(e) => setRandomCourseId(e.target.value)} className={inputClass}>
                <option value="">كل الكورسات</option>
                {courses.map((c) => (
                  <option key={c.id} value={c.id}>{c.title}</option>
                ))}
              </select>
            </Field>
            <Field label="أضفها إلى امتحان">
              <select value={attachExamId} onChange={(e) => setAttachExamId(e.target.value)} className={inputClass}>
                <option value="">بدون — عرض فقط</option>
                {exams.map((ex) => (
                  <option key={ex.id} value={ex.id}>{ex.title}</option>
                ))}
              </select>
            </Field>
          </div>

          <button
            type="button"
            onClick={runRandomPick}
            disabled={pickingRandom}
            className="flex min-h-12 items-center justify-center gap-2 rounded-fusha-md bg-accent px-4 text-label-md text-on-accent transition hover:opacity-90 disabled:opacity-40"
          >
            {pickingRandom && <span className="material-symbols-outlined animate-spin text-lg">sync</span>}
            اختيار الأسئلة
          </button>

          {randomResults.length > 0 && (
            <div className="flex flex-col gap-2 rounded-fusha-md border border-outline-variant bg-surface-container-low p-4">
              <p className="text-label-md text-on-surface">
                تم اختيار {randomResults.length} سؤالًا:
              </p>
              {randomResults.map((q, idx) => (
                <p key={q.id} className="text-body-sm text-on-surface-variant">
                  {idx + 1}. {q.question_text}
                </p>
              ))}
              {attachExamId && (
                <button
                  type="button"
                  onClick={() => attachToExam(randomResults.map((q) => q.id))}
                  disabled={attaching}
                  className="mt-2 flex min-h-12 items-center justify-center gap-2 rounded-fusha-md bg-primary px-4 text-label-md text-on-primary transition hover:opacity-90 disabled:opacity-40"
                >
                  {attaching && <span className="material-symbols-outlined animate-spin text-lg">sync</span>}
                  إضافة الأسئلة إلى الامتحان
                </button>
              )}
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
}
