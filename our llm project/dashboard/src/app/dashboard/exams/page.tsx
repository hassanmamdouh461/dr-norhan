'use client';

import { useState, useEffect, useRef } from 'react';
import { api, apiGet, apiPost, apiPatch, apiDelete } from '@/lib/api';
import { examMetaFields, isExamMetaDirty, toLocalDateTimeInput, type ExamMetaBaseline, type ExamMetaDraft } from './exam-metadata';

type ExamSelection = { id: string | null; generation: number };

interface Course {
  id: string;
  title: string;
}

interface Exam {
  id: string;
  course_id: string;
  title: string;
  max_score: number;
  is_published: number;
  is_free?: number;
  cover_image?: string | null;
  randomize_questions?: number;
  start_time?: string | null;
  end_time?: string | null;
  time_limit_mins?: number | null;
  course_title?: string;
  created_at: string;
}

interface Question {
  id: string;
  quiz_id: string;
  question_text: string | null;
  image_url?: string;
  options: string[];
  correct_option: string;
  score: number;
  sort_order: number;
}

interface StudentGrade {
  student_id: string;
  student_name: string;
  student_phone: string;
  grades: Record<string, number | null>;
  total_score: number;
}

export default function ExamsPage() {
  const [activeTab, setActiveTab] = useState<'manage' | 'grades'>('manage');
  const [courses, setCourses] = useState<Course[]>([]);
  const [exams, setExams] = useState<Exam[]>([]);
  const [selectedExamId, setSelectedExamId] = useState<string | null>(null);
  
  // Selected Exam Details
  const [examTitle, setExamTitle] = useState('');
  const [examCourseId, setExamCourseId] = useState('');
  const [examMaxScore, setExamMaxScore] = useState(100);
  const [examIsPublished, setExamIsPublished] = useState(false);
  const [examRandomizeQuestions, setExamRandomizeQuestions] = useState(false);
  const [examIsFree, setExamIsFree] = useState(false);
  const [examCoverImage, setExamCoverImage] = useState('');
  const [uploadingCover, setUploadingCover] = useState(false);
  const [examStartTime, setExamStartTime] = useState('');
  const [examEndTime, setExamEndTime] = useState('');
  const [examTimeLimitMins, setExamTimeLimitMins] = useState<number | ''>('');
  
  // Question Builder States
  const [questions, setQuestions] = useState<Question[]>([]);
  const [editingQuestionId, setEditingQuestionId] = useState<string | null>(null);
  const [questionText, setQuestionText] = useState('');
  const [questionImageUrl, setQuestionImageUrl] = useState('');
  const [questionOptions, setQuestionOptions] = useState<string[]>(['أ', 'ب', 'ج', 'د']);
  const [correctOptionIdx, setCorrectOptionIdx] = useState<number | null>(null);
  const [questionScore, setQuestionScore] = useState(1);
  const [questionSortOrder, setQuestionSortOrder] = useState(0);
  
  // Analytics Grade Sheet States
  const [gradeExams, setGradeExams] = useState<any[]>([]);
  const [studentGrades, setStudentGrades] = useState<StudentGrade[]>([]);
  const [gradesSearch, setGradesSearch] = useState('');
  
  // Common States
  const [loading, setLoading] = useState(false);
  const [savingMeta, setSavingMeta] = useState(false);
  const [savingQuestion, setSavingQuestion] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const fileInputRef = useRef<HTMLInputElement>(null);
  const examSelectionRef = useRef<ExamSelection>({ id: null, generation: 0 });
  const examMetaBaselineRef = useRef<ExamMetaBaseline | null>(null);
  const metaSaveRequestRef = useRef(0);
  const metaSaveInFlightRef = useRef<ExamSelection | null>(null);
  const examListRequestRef = useRef(0);
  const examQuestionsRequestRef = useRef(0);
  const confirmedExamsRef = useRef(new Map<string, { exam: Exam; request: number; pendingList: boolean }>());
  const pendingMetaDraftRef = useRef<ExamMetaDraft | null>(null);
  const pendingExamSavesRef = useRef(new Set<string>());
  const [pendingExamIds, setPendingExamIds] = useState<string[]>([]);

  const setExamSavePending = (id: string, pending: boolean) => {
    if (pending) pendingExamSavesRef.current.add(id);
    else pendingExamSavesRef.current.delete(id);
    setPendingExamIds(Array.from(pendingExamSavesRef.current));
  };

  const isCurrentExam = (selection: ExamSelection) =>
    examSelectionRef.current.id === selection.id && examSelectionRef.current.generation === selection.generation;

  const beginExamSelection = (id: string | null) => {
    const selection = { id, generation: examSelectionRef.current.generation + 1 };
    examSelectionRef.current = selection;
    examMetaBaselineRef.current = null;
    pendingMetaDraftRef.current = null;
    metaSaveInFlightRef.current = null;
    ++metaSaveRequestRef.current;
    ++examListRequestRef.current;
    ++examQuestionsRequestRef.current;
    setSelectedExamId(id);
    setQuestions([]);
    resetQuestionForm();
    setAutoSaveStatus('idle');
    setSavingMeta(false);
    setSavingQuestion(false);
    setUploadingImage(false);
    setUploadingCover(false);
    setLoading(false);
    setError('');
    setSuccess('');
    return selection;
  };

  const reconcileSavedExam = (exam: Exam, request: number) => {
    // A confirmed mutation belongs to the shared list, not the active editor.
    ++examListRequestRef.current;
    const previous = confirmedExamsRef.current.get(exam.id);
    if (previous && previous.request > request) return;
    confirmedExamsRef.current.set(exam.id, { exam, request, pendingList: true });
    setExams(current => current.some(item => item.id === exam.id)
      ? current.map(item => item.id === exam.id ? exam : item)
      : [...current, exam]);
  };

  const refreshExamList = async (selection: ExamSelection) => {
    const request = ++examListRequestRef.current;
    try {
      const res = await apiGet<{ exams: Exam[] }>('/admin/exams');
      if (isCurrentExam(selection) && request === examListRequestRef.current) {
        const next = new Map((res?.exams || []).map(exam => [exam.id, exam]));
        const savedFields: (keyof Exam)[] = [
          'title', 'course_id', 'max_score', 'is_published', 'randomize_questions',
          'is_free', 'cover_image', 'start_time', 'end_time', 'time_limit_mins',
        ];
        confirmedExamsRef.current.forEach((confirmed, id) => {
          const listed = next.get(id);
          // Preserve POST data until a list acknowledges it, then accept fresh snapshots normally.
          if (confirmed.pendingList && (!listed || !savedFields.every(key => Object.is(listed[key], confirmed.exam[key])))) {
            next.set(id, confirmed.exam);
          } else if (listed) {
            confirmedExamsRef.current.set(id, { ...confirmed, exam: listed, pendingList: false });
          } else {
            confirmedExamsRef.current.delete(id);
          }
        });
        setExams(Array.from(next.values()));
      }
    } catch (err) {
      if (isCurrentExam(selection) && request === examListRequestRef.current) throw err;
    }
  };

  const refreshSavedExamList = async (selection: ExamSelection) => {
    try {
      await refreshExamList(selection);
    } catch (err) {
      // The mutation is already committed and reconciled; this is not a save failure.
      console.error('Exam list refresh failed:', err);
    }
  };

  useEffect(() => () => {
    examSelectionRef.current = { id: null, generation: examSelectionRef.current.generation + 1 };
  }, []);

  useEffect(() => {
    loadInitialData();
  }, []);

  useEffect(() => {
    if (activeTab === 'grades') {
      loadGrades();
    }
  }, [activeTab]);

  const loadInitialData = async () => {
    const selection = examSelectionRef.current;
    setLoading(true);
    setError('');
    try {
      const coursesRes = await apiGet<{ courses: Course[] }>('/courses');
      if (!isCurrentExam(selection)) return;
      setCourses(coursesRes?.courses || []);
      if (coursesRes?.courses?.length > 0 && !selection.id) {
        setExamCourseId(coursesRes.courses[0].id);
      }
      await refreshExamList(selection);
    } catch (err: any) {
      if (isCurrentExam(selection)) setError(err.message || 'فشل تحميل البيانات');
    } finally {
      if (isCurrentExam(selection)) setLoading(false);
    }
  };

  const loadGrades = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await apiGet<{ exams: any[]; students: StudentGrade[] }>('/admin/exams/grades');
      setGradeExams(res?.exams || []);
      setStudentGrades(res?.students || []);
    } catch (err: any) {
      setError(err.message || 'فشل تحميل كشف الدرجات');
    } finally {
      setLoading(false);
    }
  };

  const handleSelectExam = async (exam: Exam) => {
    // The per-exam lock survives navigation; never hydrate an editor from a pending save's old data.
    if (pendingExamSavesRef.current.has(exam.id)) return;
    exam = confirmedExamsRef.current.get(exam.id)?.exam ?? exam;
    const selection = beginExamSelection(exam.id);
    const draft: ExamMetaDraft = {
      title: exam.title,
      course_id: exam.course_id,
      max_score: exam.max_score,
      is_published: exam.is_published === 1,
      randomize_questions: exam.randomize_questions === 1,
      is_free: exam.is_free === 1,
      cover_image: exam.cover_image || '',
      start_time: toLocalDateTimeInput(exam.start_time),
      end_time: toLocalDateTimeInput(exam.end_time),
      time_limit_mins: exam.time_limit_mins ?? '',
    };
    examMetaBaselineRef.current = { draft, start_time: exam.start_time ?? null, end_time: exam.end_time ?? null };
    setExamTitle(draft.title);
    setExamCourseId(draft.course_id);
    setExamMaxScore(draft.max_score);
    setExamIsPublished(draft.is_published);
    setExamRandomizeQuestions(draft.randomize_questions);
    setExamIsFree(draft.is_free);
    setExamCoverImage(draft.cover_image);
    setExamStartTime(draft.start_time);
    setExamEndTime(draft.end_time);
    setExamTimeLimitMins(draft.time_limit_mins);

    const request = ++examQuestionsRequestRef.current;
    try {
      const res = await apiGet<{ quiz: any; questions: Question[] }>(`/admin/quizzes/${exam.id}`);
      if (!isCurrentExam(selection) || request !== examQuestionsRequestRef.current) return;
      setQuestions(res?.questions || []);
    } catch (err: any) {
      if (isCurrentExam(selection) && request === examQuestionsRequestRef.current) {
        setError(err.message || 'تعذر تحميل أسئلة الامتحان');
      }
    }
  };

  const [autoSaveStatus, setAutoSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [metaSaveRevision, setMetaSaveRevision] = useState(0);
  const questionInputRef = useRef<HTMLTextAreaElement>(null);

  const examDraft: ExamMetaDraft = {
    title: examTitle,
    course_id: examCourseId,
    max_score: examMaxScore,
    is_published: examIsPublished,
    randomize_questions: examRandomizeQuestions,
    is_free: examIsFree,
    cover_image: examCoverImage,
    start_time: examStartTime,
    end_time: examEndTime,
    time_limit_mins: examTimeLimitMins,
  };

  // Hydration is the clean baseline; only actual edits schedule a save.
  useEffect(() => {
    const baseline = examMetaBaselineRef.current;
    const selection = examSelectionRef.current;
    pendingMetaDraftRef.current = examDraft;
    if (!selectedExamId || metaSaveInFlightRef.current === selection || !baseline || !isExamMetaDirty(examDraft, baseline)) return;

    const timer = setTimeout(() => {
      if (isCurrentExam(selection)) void saveExamMeta(examDraft, selection);
    }, 1200);

    return () => clearTimeout(timer);
  }, [
    selectedExamId,
    metaSaveRevision,
    examTitle,
    examCourseId,
    examMaxScore,
    examIsPublished,
    examRandomizeQuestions,
    examIsFree,
    examCoverImage,
    examStartTime,
    examEndTime,
    examTimeLimitMins
  ]);

  const saveExamMeta = async (draft: ExamMetaDraft, selection: ExamSelection, manual = false) => {
    const baseline = examMetaBaselineRef.current;
    if (!selection.id || !isCurrentExam(selection) || !draft.title.trim() || !draft.course_id ||
        pendingExamSavesRef.current.has(selection.id) || metaSaveInFlightRef.current === selection ||
        !baseline || !isExamMetaDirty(draft, baseline)) return;
    const request = ++metaSaveRequestRef.current;
    const isCurrentSave = () => isCurrentExam(selection) && request === metaSaveRequestRef.current;
    let saved = false;
    metaSaveInFlightRef.current = selection;
    ++examListRequestRef.current;
    setSavingMeta(true);
    setAutoSaveStatus('saving');
    if (manual) {
      setError('');
      setSuccess('');
    }
    try {
      const fields = examMetaFields(draft, baseline);
      setExamSavePending(selection.id, true);
      try {
        const res = await apiPost<{ exam: Exam }>('/admin/exams', { id: selection.id, ...fields });
        reconcileSavedExam(res.exam, request);
      } finally {
        // Release only this exam, after reconciliation, without waiting for the optional list GET.
        setExamSavePending(selection.id, false);
      }
      if (!isCurrentSave()) return;
      examMetaBaselineRef.current = { draft, start_time: fields.start_time, end_time: fields.end_time };
      saved = true;
      setAutoSaveStatus('saved');
      if (manual) {
        setSuccess('تم حفظ إعدادات الامتحان بنجاح!');
        setTimeout(() => { if (isCurrentSave()) setSuccess(''); }, 3000);
      }
      await refreshSavedExamList(selection);
      if (!isCurrentSave()) return;
      setTimeout(() => { if (isCurrentSave()) setAutoSaveStatus('idle'); }, 2000);
    } catch (err: any) {
      if (!isCurrentSave()) return;
      setAutoSaveStatus('error');
      if (manual) setError(err.message || 'فشل حفظ إعدادات الامتحان');
      console.error('Exam save failed:', err);
    } finally {
      if (isCurrentSave()) {
        metaSaveInFlightRef.current = null;
        setSavingMeta(false);
        const pending = pendingMetaDraftRef.current;
        if (saved || (pending && isExamMetaDirty(pending, { ...baseline, draft }))) {
          setMetaSaveRevision(value => value + 1);
        }
      }
    }
  };

  const resetQuestionForm = () => {
    setEditingQuestionId(null);
    setQuestionText('');
    setQuestionImageUrl('');
    setQuestionOptions(['أ', 'ب', 'ج', 'د']);
    setCorrectOptionIdx(null);
    setQuestionScore(1);
    setQuestionSortOrder(questions.length);
  };

  const handleSaveExamMeta = async (e: React.FormEvent) => {
    e.preventDefault();
    const selection = examSelectionRef.current;
    if (selection.id) {
      await saveExamMeta(examDraft, selection, true);
      return;
    }
    if (!examTitle.trim() || !examCourseId || metaSaveInFlightRef.current === selection) return;

    const request = ++metaSaveRequestRef.current;
    metaSaveInFlightRef.current = selection;
    setSavingMeta(true);
    setError('');
    setSuccess('');
    try {
      const res = await apiPost<{ exam: Exam }>('/admin/exams', examMetaFields(examDraft, null));
      reconcileSavedExam(res.exam, request);
      if (!isCurrentExam(selection)) return;
      // Retain the created identity before any fallible follow-up request.
      void handleSelectExam(res.exam);
      const createdSelection = examSelectionRef.current;
      setSuccess('تم حفظ إعدادات الامتحان بنجاح!');
      setTimeout(() => { if (isCurrentExam(createdSelection)) setSuccess(''); }, 3000);
      await refreshSavedExamList(createdSelection);
    } catch (err: any) {
      if (isCurrentExam(selection)) setError(err.message || 'فشل حفظ إعدادات الامتحان');
    } finally {
      if (isCurrentExam(selection)) {
        metaSaveInFlightRef.current = null;
        setSavingMeta(false);
      }
    }
  };

  const handleDeleteExam = async () => {
    let selection = examSelectionRef.current;
    if (!selection.id) return;
    if (!confirm('هل أنت متأكد من حذف هذا الامتحان بالكامل وجميع الأسئلة والدرجات المرتبطة به؟')) return;

    setLoading(true);
    setError('');
    try {
      await apiDelete(`/admin/quizzes/${selection.id}`);
      confirmedExamsRef.current.delete(selection.id);
      ++examListRequestRef.current;
      const deletedId = selection.id;
      setExams(current => current.filter(exam => exam.id !== deletedId));
      if (!isCurrentExam(selection)) return;
      selection = beginExamSelection(null);
      await refreshExamList(selection);
      if (!isCurrentExam(selection)) return;
      setSuccess('تم حذف الامتحان بنجاح');
      setTimeout(() => { if (isCurrentExam(selection)) setSuccess(''); }, 3000);
    } catch (err: any) {
      if (isCurrentExam(selection)) setError(err.message || 'فشل حذف الامتحان');
    } finally {
      if (isCurrentExam(selection)) setLoading(false);
    }
  };

  const handleUploadQuestionImage = async (file: File) => {
    const selection = examSelectionRef.current;
    setUploadingImage(true);
    setError('');
    try {
      const { upload_url, public_url } = await apiPost<{ upload_url: string; public_url: string }>(
        '/admin/quizzes/question-image-url',
        { filename: file.name, mime_type: file.type }
      );

      // Perform PUT upload to R2
      const response = await fetch(upload_url, {
        method: 'PUT',
        headers: { 'Content-Type': file.type },
        body: file
      });

      if (!response.ok) {
        throw new Error('فشل رفع الصورة إلى التخزين السحابي');
      }

      if (!isCurrentExam(selection)) return;
      setQuestionImageUrl(public_url);
      setSuccess('تم رفع الصورة بنجاح');
      setTimeout(() => { if (isCurrentExam(selection)) setSuccess(''); }, 3000);
    } catch (err: any) {
      if (isCurrentExam(selection)) setError(err.message || 'فشل رفع الصورة');
    } finally {
      if (isCurrentExam(selection)) setUploadingImage(false);
    }
  };

  const handleUploadExamCover = async (file: File) => {
    const selection = examSelectionRef.current;
    setUploadingCover(true);
    setError('');
    try {
      const { upload_url, public_url } = await apiPost<{ upload_url: string; public_url: string }>(
        '/admin/quizzes/question-image-url',
        { filename: file.name, mime_type: file.type }
      );

      // Perform PUT upload to R2
      const response = await fetch(upload_url, {
        method: 'PUT',
        headers: { 'Content-Type': file.type },
        body: file
      });

      if (!response.ok) {
        throw new Error('فشل رفع صورة الغلاف');
      }

      if (!isCurrentExam(selection)) return;
      setExamCoverImage(public_url);
      setSuccess('تم رفع صورة غلاف الامتحان بنجاح');
      setTimeout(() => { if (isCurrentExam(selection)) setSuccess(''); }, 3000);
    } catch (err: any) {
      if (isCurrentExam(selection)) setError(err.message || 'فشل رفع صورة الغلاف');
    } finally {
      if (isCurrentExam(selection)) setUploadingCover(false);
    }
  };

  const handleSaveQuestion = async () => {
    const selection = examSelectionRef.current;
    if (!selection.id || savingQuestion) return;
    if (!questionText.trim() && !questionImageUrl.trim()) {
      setError('يرجى كتابة نص السؤال أو رفع صورة للسؤال');
      return;
    }
    if (correctOptionIdx === null) {
      setError('يرجى تحديد الخيار الصحيح');
      return;
    }

    const correctOptionValue = questionOptions[correctOptionIdx];
    if (!correctOptionValue?.trim()) {
      setError('الخيار الصحيح المحدد لا يحتوي على نص');
      return;
    }

    const request = ++examQuestionsRequestRef.current;
    const isCurrentRequest = () => isCurrentExam(selection) && request === examQuestionsRequestRef.current;
    setSavingQuestion(true);
    setError('');
    try {
      if (editingQuestionId) {
        // Update Question
        await apiPatch(`/admin/quizzes/questions/${editingQuestionId}`, {
          question_text: questionText,
          image_url: questionImageUrl || null,
          options: questionOptions,
          correct_option: correctOptionValue,
          score: questionScore,
          sort_order: questionSortOrder
        });
      } else {
        // Insert New Question
        await apiPost(`/admin/quizzes/${selection.id}/questions`, {
          question_text: questionText,
          image_url: questionImageUrl || null,
          options: questionOptions,
          correct_option: correctOptionValue,
          score: questionScore,
          sort_order: questionSortOrder
        });
      }

      if (!isCurrentRequest()) return;
      const res = await apiGet<{ quiz: any; questions: Question[] }>(`/admin/quizzes/${selection.id}`);
      if (!isCurrentRequest()) return;
      setQuestions(res?.questions || []);
      resetQuestionForm();
      setSuccess('تم حفظ السؤال بنجاح');
      setTimeout(() => { if (isCurrentRequest()) setSuccess(''); }, 3000);

      setTimeout(() => {
        if (isCurrentRequest()) questionInputRef.current?.focus();
      }, 50);
    } catch (err: any) {
      if (isCurrentRequest()) setError(err.message || 'فشل حفظ السؤال');
    } finally {
      if (isCurrentExam(selection)) setSavingQuestion(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.ctrlKey && e.key === 'Enter') {
      e.preventDefault();
      handleSaveQuestion();
    }
  };

  const handleEditQuestion = (q: Question) => {
    setEditingQuestionId(q.id);
    setQuestionText(q.question_text || '');
    setQuestionImageUrl(q.image_url || '');
    setQuestionOptions(q.options || ['أ', 'ب', 'ج', 'د']);
    
    // Find correct option index
    const idx = q.options.indexOf(q.correct_option);
    setCorrectOptionIdx(idx !== -1 ? idx : null);
    
    setQuestionScore(q.score);
    setQuestionSortOrder(q.sort_order);
  };

  const handleDeleteQuestion = async (qId: string) => {
    const selection = examSelectionRef.current;
    if (!selection.id || !confirm('هل أنت متأكد من حذف هذا السؤال؟')) return;
    const request = ++examQuestionsRequestRef.current;
    const isCurrentRequest = () => isCurrentExam(selection) && request === examQuestionsRequestRef.current;
    setError('');
    try {
      await apiDelete(`/admin/quizzes/questions/${qId}`);
      if (!isCurrentRequest()) return;
      const res = await apiGet<{ quiz: any; questions: Question[] }>(`/admin/quizzes/${selection.id}`);
      if (!isCurrentRequest()) return;
      setQuestions(res?.questions || []);
      if (editingQuestionId === qId) resetQuestionForm();
    } catch (err: any) {
      if (isCurrentRequest()) setError(err.message || 'فشل حذف السؤال');
    }
  };

  const filteredGrades = studentGrades.filter(s =>
    s.student_name.toLowerCase().includes(gradesSearch.toLowerCase()) ||
    s.student_phone.includes(gradesSearch)
  );

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6 select-none" style={{ direction: 'rtl' }}>
      {/* Page Header */}
      <div className="flex justify-between items-center flex-wrap gap-4 border-b border-outline-variant pb-6">
        <div>
          <h1 className="text-2xl font-black text-on-background flex items-center gap-3 font-cairo">
            <span className="material-symbols-outlined text-primary text-3xl">assignment</span>
            منظومة الامتحانات العامة والتقييمات
          </h1>
          <p className="text-on-surface-variant text-xs mt-1">رفع وإدارة الامتحانات الشاملة ومتابعة درجات وتحليلات الطلاب.</p>
        </div>

        {/* Tab Switcher */}
        <div className="flex bg-surface-container-low p-1 rounded-xl border border-outline-variant shadow-sm">
          <button
            onClick={() => setActiveTab('manage')}
            className={`px-5 py-2 rounded-lg text-xs font-bold transition-all duration-200 flex items-center gap-2 ${
              activeTab === 'manage'
                ? 'bg-primary text-on-primary shadow-md shadow-primary/20'
                : 'text-on-surface-variant hover:text-on-surface'
            }`}
          >
            <span className="material-symbols-outlined text-base">assignment</span>
            إدارة الامتحانات
          </button>
          <button
            onClick={() => setActiveTab('grades')}
            className={`px-5 py-2 rounded-lg text-xs font-bold transition-all duration-200 flex items-center gap-2 ${
              activeTab === 'grades'
                ? 'bg-primary text-on-primary shadow-md shadow-primary/20'
                : 'text-on-surface-variant hover:text-on-surface'
            }`}
          >
            <span className="material-symbols-outlined text-base">monitoring</span>
            درجات ونتائج الطلاب
          </button>
        </div>
      </div>

      {/* Alerts */}
      {error && (
        <div className="p-4 rounded-xl bg-error/10 text-error border border-error/20 flex items-center gap-3 animate-error-shake">
          <span className="material-symbols-outlined">error</span>
          <span className="text-xs font-bold">{error}</span>
        </div>
      )}
      {success && (
        <div className="p-4 rounded-xl bg-success-container/30 text-success border border-success-container flex items-center gap-3">
          <span className="material-symbols-outlined">check_circle</span>
          <span className="text-xs font-bold">{success}</span>
        </div>
      )}

      {activeTab === 'manage' ? (
        // ==================== TAB 1: MANAGE EXAMS ====================
        selectedExamId === null ? (
          /* View A: Exams Grid & Quick Creator */
          <div className="space-y-6">
            {/* Quick Creator Card */}
            <div className="bg-surface border border-outline-variant p-6 rounded-2xl shadow-sm space-y-4">
              <h2 className="text-md font-bold text-on-background flex items-center gap-2">
                <span className="material-symbols-outlined text-primary">add_circle</span>
                إنشاء امتحان عام جديد
              </h2>
              
              <form onSubmit={handleSaveExamMeta} className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-on-surface-variant">عنوان الامتحان</label>
                  <input
                    type="text"
                    required
                    placeholder="مثال: امتحان الباب الأول الشامل"
                    className="w-full px-3 py-2 text-xs rounded-xl border border-outline-variantbg-transparent text-on-background focus:outline-none focus:border-primary transition"
                    value={examTitle}
                    onChange={e => setExamTitle(e.target.value)}
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-on-surface-variant">المقرر الدراسي</label>
                  <select
                    className="w-full px-3 py-2 text-xs rounded-xl border border-outline-variantbg-transparent text-on-background focus:outline-none focus:border-primary transition"
                    value={examCourseId}
                    onChange={e => setExamCourseId(e.target.value)}
                  >
                    {courses.map(c => (
                      <option key={c.id} value={c.id}>{c.title}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-on-surface-variant">الدرجة النهائية</label>
                  <input
                    type="number"
                    required
                    min={1}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-outline-variantbg-transparent text-on-background focus:outline-none focus:border-primary transition"
                    value={examMaxScore}
                    onChange={e => setExamMaxScore(parseInt(e.target.value))}
                  />
                </div>

                <div className="flex gap-3">
                  <button
                    type="submit"
                    disabled={savingMeta}
                    className="flex-1 px-4 py-2.5 bg-primary hover:bg-primary/90 text-on-primary text-xs font-bold rounded-xl shadow-md shadow-primary/10 transition flex items-center justify-center gap-1"
                  >
                    <span className="material-symbols-outlined text-sm">save</span>
                    {savingMeta ? 'جاري الإنشاء...' : 'إنشاء البدء'}
                  </button>
                </div>
              </form>
            </div>

            {/* Exams Grid */}
            <div className="space-y-4">
              <h3 className="text-sm font-bold text-on-surface-variant flex items-center gap-2">
                <span className="material-symbols-outlined text-base">list_alt</span>
                الامتحانات الحالية المتاحة ({exams.length})
              </h3>

              {exams.length === 0 ? (
                <div className="bg-surface border border-dashed border-outline-variantp-12 rounded-2xl text-center">
                  <span className="material-symbols-outlined text-4xl text-on-surface-variant/40 mb-3">assignment_late</span>
                  <h4 className="text-sm font-bold text-on-background">لا توجد امتحانات مضافة بعد</h4>
                  <p className="text-xs text-on-surface-variant mt-1">قم بتعبئة النموذج أعلاه لإنشاء أول امتحان عام لطلابك.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {exams.map(exam => (
                    <button
                      type="button"
                      key={exam.id}
                      onClick={() => handleSelectExam(exam)}
                      disabled={pendingExamIds.includes(exam.id)}
                      aria-busy={pendingExamIds.includes(exam.id)}
                      className="group bg-surface border border-outline-variant p-5 rounded-2xl hover:border-primary/30 hover:shadow-md transition cursor-pointer disabled:cursor-wait disabled:opacity-60 text-right flex flex-col justify-between"
                    >
                      <div className="space-y-2">
                        <div className="flex justify-between items-start gap-2">
                          <span className="text-[10px] px-2 py-0.5 rounded-md bg-surface-container-low text-on-surface-variant font-bold border border-outline-variant">
                            {exam.course_title}
                          </span>
                          <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                            exam.is_published === 1
                              ? 'bg-success-container/30 text-success'
                              : 'bg-warning-container/30 text-warning'
                          }`}>
                            {exam.is_published === 1 ? 'منشور للطلاب' : 'مسودة'}
                          </span>
                        </div>

                        <h4 className="text-sm font-black text-on-background group-hover:text-primary transition font-cairo">
                          {exam.title}
                        </h4>
                      </div>

                      <div className="mt-6 pt-3 border-t border-outline-variant flex justify-between items-center text-xs">
                        <span className="text-on-surface-variant font-bold">
                          الدرجة: <strong className="text-on-background">{exam.max_score}</strong>
                        </span>

                        <span className="text-primary font-bold flex items-center gap-0.5 group-hover:translate-x-[-2px] transition-transform">
                          {pendingExamIds.includes(exam.id) ? 'Saving changes...' : 'إدارة الأسئلة'}
                          <span className={`material-symbols-outlined text-sm ${pendingExamIds.includes(exam.id) ? 'animate-spin' : ''}`}>
                            {pendingExamIds.includes(exam.id) ? 'sync' : 'arrow_back'}
                          </span>
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        ) : (
          /* View B: Active Exam Builder Workspace */
          <div className="space-y-6">
            {/* Active Exam Header Banner */}
            <div className="bg-gradient-to-r from-primary to-accent text-on-primary p-6 rounded-2xl shadow-lg shadow-primary/10 flex justify-between items-center flex-wrap gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <button
                    onClick={() => beginExamSelection(null)}
                    className="flex items-center gap-1 text-xs font-bold bg-white/10 hover:bg-white/20 text-on-primary px-3 py-1.5 rounded-lg transition"
                  >
                    <span className="material-symbols-outlined text-xs">arrow_forward</span>
                    العودة لجميع الامتحانات
                  </button>
                  <span className="text-[10px] bg-white/20 text-white px-2 py-0.5 rounded-md font-bold">
                    {courses.find(c => c.id === examCourseId)?.title || 'مقرر دراسي'}
                  </span>
                </div>
                <h2 className="text-lg font-black font-cairo mt-2">{examTitle}</h2>
              </div>

              <div className="flex items-center gap-3">
                <div className="text-left bg-black/10 px-4 py-2 rounded-xl border border-white/5">
                  <span className="text-[10px] text-white/70 block">أسئلة الامتحان</span>
                  <strong className="text-md font-black">{questions.length} أسئلة</strong>
                </div>
                <div className="text-left bg-black/10 px-4 py-2 rounded-xl border border-white/5">
                  <span className="text-[10px] text-white/70 block">الدرجة الكلية</span>
                  <strong className="text-md font-black">{examMaxScore} درجة</strong>
                </div>
              </div>
            </div>

            {/* Split Workspace */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Right Column: Settings & Question Form */}
              <div className="lg:col-span-1 space-y-6">
                
                {/* Exam Meta Settings */}
                <div className="bg-surface border border-outline-variant p-5 rounded-2xl shadow-sm space-y-4">
                  <h3 className="text-sm font-bold text-on-background border-b border-outline-variant pb-2 flex items-center justify-between">
                    <span className="flex items-center gap-2">
                      <span className="material-symbols-outlined text-primary text-base">settings</span>
                      إعدادات الامتحان
                    </span>
                    {selectedExamId && (
                      <span className="text-[10px] font-medium flex items-center gap-1">
                        {autoSaveStatus === 'saving' && (
                          <span className="text-warning flex items-center gap-1">
                            <span className="material-symbols-outlined animate-spin text-xs">sync</span>
                            جاري الحفظ تلقائياً...
                          </span>
                        )}
                        {autoSaveStatus === 'saved' && (
                          <span className="text-success flex items-center gap-1">
                            <span className="material-symbols-outlined text-xs">check_circle</span>
                            تم الحفظ تلقائياً
                          </span>
                        )}
                        {autoSaveStatus === 'error' && (
                          <span className="text-error flex items-center gap-1">
                            <span className="material-symbols-outlined text-xs">error</span>
                            فشل الحفظ التلقائي
                          </span>
                        )}
                      </span>
                    )}
                  </h3>

                  <form onSubmit={handleSaveExamMeta} className="space-y-3">
                    <div className="space-y-1">
                      <label className="text-[11px] font-bold text-on-surface-variant">عنوان الامتحان</label>
                      <input
                        type="text"
                        required
                        className="w-full px-3 py-1.5 text-xs rounded-lg border border-outline-variantbg-transparent text-on-background focus:outline-none focus:border-primary transition"
                        value={examTitle}
                        onChange={e => setExamTitle(e.target.value)}
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-[11px] font-bold text-on-surface-variant">صورة غلاف الامتحان</label>
                      <div className="flex gap-2 items-center">
                        <input
                          type="text"
                          placeholder="رابط الصورة (اختياري) أو قم بالرفع..."
                          className="flex-1 px-3 py-1.5 text-xs rounded-lg border border-outline-variantbg-transparent text-on-background focus:outline-none focus:border-primary transition"
                          value={examCoverImage}
                          onChange={e => setExamCoverImage(e.target.value)}
                        />
                        <label className="cursor-pointer px-3 py-1.5 bg-primary/10 hover:bg-primary/20 text-primary text-xs font-bold rounded-lg transition flex items-center gap-1 select-none">
                          <span className="material-symbols-outlined text-xs">upload</span>
                          {uploadingCover ? 'جاري الرفع...' : 'رفع غلاف'}
                          <input
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={e => {
                              const file = e.target.files?.[0];
                              if (file) handleUploadExamCover(file);
                            }}
                            disabled={uploadingCover}
                          />
                        </label>
                      </div>
                      {examCoverImage && (
                        <div style={{ position: 'relative', width: '120px', height: '70px', borderRadius: '8px', overflow: 'hidden', marginTop: '6px', border: '1px solid rgba(255,255,255,0.1)' }}>
                          <img src={examCoverImage} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                          <button
                            type="button"
                            onClick={() => setExamCoverImage('')}
                            style={{ position: 'absolute', top: '2px', left: '2px', background: 'rgba(0,0,0,0.6)', color: '#fff', border: 'none', borderRadius: '50%', width: '18px', height: '18px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', fontSize: '10px' }}
                          >
                            ×
                          </button>
                        </div>
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <label className="text-[11px] font-bold text-on-surface-variant">الدرجة النهائية</label>
                        <input
                          type="number"
                          required
                          min={1}
                          className="w-full px-3 py-1.5 text-xs rounded-lg border border-outline-variantbg-transparent text-on-background focus:outline-none focus:border-primary transition"
                          value={examMaxScore}
                          onChange={e => setExamMaxScore(parseInt(e.target.value))}
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="text-[11px] font-bold text-on-surface-variant">المقرر</label>
                        <select
                          className="w-full px-3 py-1.5 text-xs rounded-lg border border-outline-variantbg-transparent text-on-background focus:outline-none focus:border-primary transition"
                          value={examCourseId}
                          onChange={e => setExamCourseId(e.target.value)}
                        >
                          {courses.map(c => (
                            <option key={c.id} value={c.id}>{c.title}</option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <label className="text-[11px] font-bold text-on-surface-variant">مؤقت الامتحان (بالدقائق)</label>
                        <input
                          type="number"
                          placeholder="مثال: 60"
                          className="w-full px-3 py-1.5 text-xs rounded-lg border border-outline-variantbg-transparent text-on-background focus:outline-none focus:border-primary transition"
                          value={examTimeLimitMins}
                          onChange={e => setExamTimeLimitMins(e.target.value ? parseInt(e.target.value) : '')}
                        />
                      </div>

                      <div className="space-y-1 flex items-end">
                        <div className="flex items-center gap-2 pb-2">
                          <input
                            type="checkbox"
                            id="randomizeQuestions"
                            className="w-4 h-4 text-primary bg-transparent rounded border-outline-variant focus:ring-primary"
                            checked={examRandomizeQuestions}
                            onChange={e => setExamRandomizeQuestions(e.target.checked)}
                          />
                          <label htmlFor="randomizeQuestions" className="text-xs font-bold text-on-background cursor-pointer select-none">
                            ترتيب عشوائي للأسئلة
                          </label>
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <label className="text-[11px] font-bold text-on-surface-variant">تاريخ فتح الامتحان</label>
                        <input
                          type="datetime-local"
                          className="w-full px-3 py-1.5 text-xs rounded-lg border border-outline-variantbg-transparent text-on-background focus:outline-none focus:border-primary transition"
                          value={examStartTime}
                          onChange={e => setExamStartTime(e.target.value)}
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="text-[11px] font-bold text-on-surface-variant">تاريخ إغلاق الامتحان</label>
                        <input
                          type="datetime-local"
                          className="w-full px-3 py-1.5 text-xs rounded-lg border border-outline-variantbg-transparent text-on-background focus:outline-none focus:border-primary transition"
                          value={examEndTime}
                          onChange={e => setExamEndTime(e.target.value)}
                        />
                      </div>
                    </div>

                    <div className="flex items-center gap-2 py-1">
                      <input
                        type="checkbox"
                        id="isPublished"
                        className="w-4 h-4 text-primary bg-transparent rounded border-outline-variant focus:ring-primary"
                        checked={examIsPublished}
                        onChange={e => setExamIsPublished(e.target.checked)}
                      />
                      <label htmlFor="isPublished" className="text-xs font-bold text-on-background cursor-pointer select-none">
                        نشر الامتحان للطلاب الآن
                      </label>
                    </div>

                    <div className="flex items-center gap-2 py-1">
                      <input
                        type="checkbox"
                        id="isFree"
                        className="w-4 h-4 text-primary bg-transparent rounded border-outline-variant focus:ring-primary"
                        checked={examIsFree}
                        onChange={e => setExamIsFree(e.target.checked)}
                      />
                      <label htmlFor="isFree" className="text-xs font-bold text-on-background cursor-pointer select-none">
                        عرض كـ امتحان مجاني في صفحة الهبوط (لا يتطلب تسجيل دخول)
                      </label>
                    </div>

                    <button
                      type="submit"
                      disabled={savingMeta}
                      className="w-full py-2 bg-primary hover:bg-primary/90 text-on-primary text-xs font-bold rounded-xl shadow-md shadow-primary/10 transition"
                    >
                      {savingMeta ? 'جاري الحفظ...' : 'تحديث الإعدادات'}
                    </button>
                  </form>
                </div>

                {/* Question Builder */}
                <div className="bg-surface border border-outline-variant p-5 rounded-2xl shadow-sm space-y-4">
                  <div className="flex justify-between items-center border-b border-outline-variant pb-2">
                    <h3 className="text-sm font-bold text-on-background flex items-center gap-2">
                      <span className="material-symbols-outlined text-primary text-base">quiz</span>
                      {editingQuestionId ? 'تعديل هذا السؤال' : 'إضافة سؤال جديد'}
                    </h3>
                    {editingQuestionId && (
                      <button
                        onClick={resetQuestionForm}
                        className="text-[10px] font-bold text-primary hover:underline"
                      >
                        إلغاء التعديل
                      </button>
                    )}
                  </div>

                  <div className="space-y-4">
                    <div className="space-y-1">
                      <label className="text-[11px] font-bold text-on-surface-variant">نص السؤال</label>
                      <textarea
                        ref={questionInputRef}
                        required
                        placeholder="اكتب نص السؤال هنا بالتفصيل..."
                        className="w-full px-3 py-2 text-xs rounded-xl border border-outline-variantbg-transparent text-on-background focus:outline-none focus:border-primary transition h-20 resize-none"
                        value={questionText}
                        onChange={e => setQuestionText(e.target.value)}
                        onKeyDown={handleKeyDown}
                      />
                    </div>

                    {/* Image Upload */}
                    <div className="space-y-1">
                      <label className="text-[11px] font-bold text-on-surface-variant">صورة توضيحية للسؤال (اختياري)</label>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          placeholder="رابط الصورة المباشر..."
                          className="flex-1 px-3 py-1.5 text-xs rounded-lg border border-outline-variantbg-transparent text-on-background focus:outline-none focus:border-primary transition"
                          value={questionImageUrl}
                          onChange={e => setQuestionImageUrl(e.target.value)}
                        />
                        <button
                          type="button"
                          onClick={() => fileInputRef.current?.click()}
                          disabled={uploadingImage}
                          className="px-3 py-1.5 bg-surface-container hover:bg-surface-container-high text-on-background text-xs font-bold rounded-lg transition flex items-center gap-1"
                        >
                          <span className="material-symbols-outlined text-sm">cloud_upload</span>
                          {uploadingImage ? '..' : 'رفع'}
                        </button>
                        <input
                          type="file"
                          ref={fileInputRef}
                          accept="image/*"
                          className="hidden"
                          onChange={e => {
                            const file = e.target.files?.[0];
                            if (file) handleUploadQuestionImage(file);
                          }}
                        />
                      </div>
                      {questionImageUrl && (
                        <div className="mt-2 relative inline-block">
                          <img src={questionImageUrl} alt="معاينة" className="max-h-20 rounded-lg border border-outline-variantobject-cover" />
                          <button
                            type="button"
                            onClick={() => setQuestionImageUrl('')}
                            className="absolute -top-1.5 -left-1.5 bg-error text-on-error rounded-full w-4.5 h-4.5 flex items-center justify-center shadow-md hover:bg-error/95 text-[10px]"
                          >
                            ×
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Options Builder */}
                    <div className="space-y-2">
                      <label className="text-[11px] font-bold text-on-surface-variant block">الخيارات وتحديد الإجابة الصحيحة</label>
                      <div className="space-y-2">
                        {questionOptions.map((opt, idx) => (
                          <div key={idx} className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => setCorrectOptionIdx(idx)}
                              className={`w-8 h-8 rounded-lg flex items-center justify-center transition ${
                                correctOptionIdx === idx
                                  ? 'bg-success text-on-success shadow-sm'
                                  : 'bg-surface-container hover:bg-surface-container-high text-on-surface-variant'
                              }`}
                              title="تحديد كإجابة صحيحة"
                            >
                              <span className="text-xs font-bold">
                                {idx === 0 ? 'أ' : idx === 1 ? 'ب' : idx === 2 ? 'ج' : 'د'}
                              </span>
                            </button>
                            <input
                              type="text"
                              required
                              placeholder={`الخيار رقم ${idx + 1}`}
                              className="flex-1 px-3 py-1.5 text-xs rounded-lg border border-outline-variantbg-transparent text-on-background focus:outline-none focus:border-primary transition"
                              value={opt}
                              onChange={e => {
                                const copy = [...questionOptions];
                                copy[idx] = e.target.value;
                                setQuestionOptions(copy);
                              }}
                              onKeyDown={handleKeyDown}
                            />
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Score and Sort Order */}
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <label className="text-[11px] font-bold text-on-surface-variant">درجة السؤال</label>
                        <input
                          type="number"
                          min={1}
                          className="w-full px-3 py-1.5 text-xs rounded-lg border border-outline-variantbg-transparent text-on-background focus:outline-none focus:border-primary transition"
                          value={questionScore}
                          onChange={e => setQuestionScore(parseInt(e.target.value) || 1)}
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[11px] font-bold text-on-surface-variant">الترتيب</label>
                        <input
                          type="number"
                          className="w-full px-3 py-1.5 text-xs rounded-lg border border-outline-variantbg-transparent text-on-background focus:outline-none focus:border-primary transition"
                          value={questionSortOrder}
                          onChange={e => setQuestionSortOrder(parseInt(e.target.value) || 0)}
                        />
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={handleSaveQuestion}
                      disabled={savingQuestion}
                      className="w-full py-2.5 bg-primary hover:bg-primary/90 text-on-primary text-xs font-bold rounded-xl shadow-md shadow-primary/10 transition flex items-center justify-center gap-1.5"
                    >
                      <span className="material-symbols-outlined text-sm">save</span>
                      {savingQuestion ? 'جاري الحفظ...' : editingQuestionId ? 'تحديث بيانات السؤال' : 'حفظ وإضافة السؤال للورقة'}
                    </button>
                  </div>
                </div>
              </div>

              {/* Left Column: Questions List */}
              <div className="lg:col-span-2 space-y-4">
                <div className="flex justify-between items-center">
                  <h3 className="text-sm font-bold text-on-surface-variant flex items-center gap-2">
                    <span className="material-symbols-outlined text-base">ballot</span>
                    الأسئلة المضافة للورقة حالياً ({questions.length})
                  </h3>

                  <button
                    onClick={handleDeleteExam}
                    className="px-3 py-1.5 bg-error/10 hover:bg-error/20 text-error text-[11px] font-bold rounded-lg transition flex items-center gap-1"
                  >
                    <span className="material-symbols-outlined text-xs">delete</span>
                    حذف الامتحان بالكامل
                  </button>
                </div>

                <div className="space-y-3 max-h-[750px] overflow-y-auto pr-1">
                  {questions.length === 0 ? (
                    <div className="bg-surface border border-dashed border-outline-variantp-12 rounded-2xl text-center">
                      <span className="material-symbols-outlined text-4xl text-on-surface-variant/40 mb-3">quiz</span>
                      <h4 className="text-sm font-bold text-on-background">لا توجد أسئلة في هذا الامتحان</h4>
                      <p className="text-xs text-on-surface-variant mt-1">استخدم نموذج إضافة الأسئلة على اليمين لبدء بناء ورقة الأسئلة.</p>
                    </div>
                  ) : (
                    questions.map((q, idx) => (
                      <div
                        key={q.id}
                        className="bg-surface border border-outline-variant p-5 rounded-2xl shadow-sm space-y-4 relative group hover:border-outline transition"
                      >
                        <div className="flex justify-between items-center">
                          <span className="text-xs font-bold text-primary">
                            سؤال {idx + 1} • <strong className="text-on-surface-variant font-medium">({q.score} درجات)</strong>
                          </span>

                          <div className="flex gap-1.5 opacity-40 group-hover:opacity-100 transition">
                            <button
                              onClick={() => handleEditQuestion(q)}
                              className="p-1 hover:bg-surface-container-low text-primary rounded-lg transition"
                              title="تعديل"
                            >
                              <span className="material-symbols-outlined text-base">edit</span>
                            </button>
                            <button
                              onClick={() => handleDeleteQuestion(q.id)}
                              className="p-1 hover:bg-surface-container-low text-error rounded-lg transition"
                              title="حذف"
                            >
                              <span className="material-symbols-outlined text-base">delete</span>
                            </button>
                          </div>
                        </div>

                        <p className="text-sm font-extrabold text-on-background leading-relaxed font-cairo">
                          {q.question_text || '(سؤال بصورة)'}
                        </p>

                        {q.image_url && (
                          <img src={q.image_url} alt="توضيحية للسؤال" className="max-h-36 rounded-xl object-contain border border-outline-variant" />
                        )}

                        {/* Options Grid */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs bg-surface-container-low p-3 rounded-xl">
                          {q.options?.map((opt: string, i: number) => {
                            const isCorrect = opt === q.correct_option;
                            return (
                              <div
                                key={i}
                                className={`flex items-center gap-2 p-2 rounded-lg border ${
                                  isCorrect
                                    ? 'bg-success-container/30 border-success-container text-success font-bold'
                                    : 'border-transparent text-on-surface-variant'
                                }`}
                              >
                                <span className="material-symbols-outlined text-sm">
                                  {isCorrect ? 'check_circle' : 'radio_button_unchecked'}
                                </span>
                                <span>{opt}</span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        )
      ) : (
        // ==================== TAB 2: STUDENT GRADES SHEET ====================
        <div className="bg-surface border border-outline-variant p-6 rounded-2xl shadow-sm space-y-6">
          <div className="flex justify-between items-center flex-wrap gap-4 border-b border-outline-variant pb-4">
            <div>
              <h2 className="text-md font-bold text-on-background">جدول تحليلات ونتائج الامتحانات العامة</h2>
              <p className="text-on-surface-variant text-xs mt-1">يستعرض درجات الطلاب في كافة الامتحانات العامة المنشورة.</p>
            </div>
            
            {/* Grades Search Input */}
            <div className="w-72">
              <input
                type="text"
                placeholder="بحث باسم الطالب أو رقم الهاتف..."
                className="w-full px-3 py-2 text-xs rounded-xl border border-outline-variantbg-transparent text-on-background focus:outline-none focus:border-primary transition"
                value={gradesSearch}
                onChange={e => setGradesSearch(e.target.value)}
              />
            </div>
          </div>

          <div className="overflow-x-auto rounded-xl border border-outline-variant shadow-sm">
            <table className="w-full text-right border-collapse">
              <thead>
                <tr className="bg-surface-container-low text-on-background font-bold text-xs border-b border-outline-variant">
                  <th className="p-4">الاسم بالكامل</th>
                  <th className="p-4">رقم الهاتف</th>
                  {gradeExams.map(exam => (
                    <th key={exam.id} className="p-4 text-center font-bold border-r border-outline-variant/50">
                      {exam.title}
                      <span className="block text-[9px] text-on-surface-variant font-normal mt-0.5">
                        النهائية: {exam.max_score}
                      </span>
                    </th>
                  ))}
                  <th className="p-4 text-center font-black text-primary bg-primary/5">المجموع الكلي</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant text-xs">
                {filteredGrades.length === 0 ? (
                  <tr>
                    <td colSpan={3 + gradeExams.length} className="p-8 text-center text-on-surface-variant italic">
                      لا يوجد نتائج لعرضها حالياً.
                    </td>
                  </tr>
                ) : (
                  filteredGrades.map(student => (
                    <tr key={student.student_id} className="hover:bg-surface-container-low/50 transition-colors">
                      <td className="p-4 font-bold text-on-background">{student.student_name}</td>
                      <td className="p-4 text-on-surface-variant font-medium">{student.student_phone}</td>
                      {gradeExams.map(exam => {
                        const score = student.grades[exam.id];
                        const hasScore = score !== null && score !== undefined;
                        return (
                          <td key={exam.id} className="p-4 text-center border-r border-outline-variant/30">
                            {hasScore ? (
                              <span className="font-bold text-on-background">{score}</span>
                            ) : (
                              <span className="text-on-surface-variant/40 font-normal italic text-[10px]">لم يحل</span>
                            )}
                          </td>
                        );
                      })}
                      <td className="p-4 text-center font-black text-primary bg-primary/5">
                        {student.total_score}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
