'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { api, apiPost, apiPatch } from '@/lib/api';
import QuestionBankPanel from './QuestionBankPanel';

interface Question {
  id: string; 
  body: string; 
  status: string; 
  is_pinned: number; 
  upvotes: number;
  student_name: string; 
  student_phone: string; 
  lesson_title: string | null; 
  course_title: string | null;
  answers_count: number; 
  created_at: string;
}

interface Answer {
  id: string;
  body: string;
  author_name: string;
  author_role: string;
  is_accepted: number;
  created_at: string;
  image_url?: string;
}

type ListMeta = { page: number; limit: number; total: number; has_more: boolean };

export default function QuestionsPage() {
  const [mode, setMode] = useState<'inbox' | 'bank'>('inbox');
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('open'); // open, answered, closed
  const [selectedQuestionId, setSelectedQuestionId] = useState<string | null>(null);
  const [answers, setAnswers] = useState<Answer[]>([]);
  const [loadingAnswers, setLoadingAnswers] = useState(false);
  const [answerText, setAnswerText] = useState('');
  const [attachedImageUrl, setAttachedImageUrl] = useState<string | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const selectionRef = useRef<{ id: string | null; generation: number }>({ id: null, generation: 0 });
  const answersRequestRef = useRef(0);
  const replyRequestRef = useRef(0);
  const replyInFlightRef = useRef(false);
  const draftRef = useRef<{ body: string; image_url: string | null }>({ body: '', image_url: null });

  const updateAnswerText = (body: string) => {
    if (draftRef.current.body !== body) draftRef.current = { ...draftRef.current, body };
    setAnswerText(body);
  };

  const updateAttachedImage = (image_url: string | null) => {
    if (draftRef.current.image_url !== image_url) draftRef.current = { ...draftRef.current, image_url };
    setAttachedImageUrl(image_url);
  };

  const isCurrentSelection = (selection: typeof selectionRef.current) =>
    selectionRef.current.id === selection.id && selectionRef.current.generation === selection.generation;

  const changeSelection = (id: string | null) => {
    const selection = { id, generation: selectionRef.current.generation + 1 };
    selectionRef.current = selection;
    ++answersRequestRef.current;
    ++replyRequestRef.current;
    replyInFlightRef.current = false;
    setSelectedQuestionId(id);
    updateAnswerText('');
    updateAttachedImage(null);
    setAnswers([]);
    setLoadingAnswers(false);
    setSubmitting(false);
    setUploadingImage(false);
    setError('');
    return selection;
  };

  useEffect(() => () => {
    selectionRef.current = { id: null, generation: selectionRef.current.generation + 1 };
  }, []);

  const fetchQuestions = useCallback(async (pageNum: number = 1, append: boolean = false) => {
    if (append) setLoadingMore(true); else setLoading(true);
    try {
      const data = await api<{ questions: Question[]; meta?: ListMeta }>(`/admin/questions?status=${statusFilter}&page=${pageNum}&limit=20`);
      setQuestions((prev) => append ? [...prev, ...(data.questions || [])] : (data.questions || []));
      setHasMore(!!data.meta?.has_more);
      setPage(pageNum);
    } catch (e: any) {
      if (!append) setQuestions([]);
      setError(e.message || 'فشل جلب قائمة الأسئلة');
    } finally {
      if (append) setLoadingMore(false); else setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    fetchQuestions(1, false);
  }, [fetchQuestions]);

  const loadMoreQuestions = () => {
    if (loadingMore || !hasMore) return;
    fetchQuestions(page + 1, true);
  };

  const selectQuestion = async (questionId: string) => {
    const selection = changeSelection(questionId);
    const request = ++answersRequestRef.current;
    const isCurrentRequest = () => isCurrentSelection(selection) && request === answersRequestRef.current;
    setLoadingAnswers(true);
    try {
      const data = await api<{ answers: Answer[] }>(`/questions/${questionId}`);
      if (isCurrentRequest()) setAnswers(data.answers || []);
    } catch (e: any) {
      if (isCurrentRequest()) setAnswers([]);
    } finally {
      if (isCurrentRequest()) setLoadingAnswers(false);
    }
  };

  const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const selection = selectionRef.current;

    setUploadingImage(true);
    setError('');
    try {
      // 1. Get presigned R2 upload URL
      const { upload_url, public_url } = await apiPost<{ upload_url: string; public_url: string }>(
        '/admin/questions/answer-image-url',
        { filename: file.name, mime_type: file.type }
      );

      // 2. Upload file to R2 directly
      const response = await fetch(upload_url, {
        method: 'PUT',
        body: file,
        headers: {
          'Content-Type': file.type || 'image/jpeg',
        },
      });

      if (!response.ok) {
        throw new Error('فشل رفع الصورة إلى السيرفر');
      }

      if (isCurrentSelection(selection)) updateAttachedImage(public_url);
    } catch (e: any) {
      if (isCurrentSelection(selection)) setError(e.message || 'حدث خطأ أثناء رفع الصورة المرفقة');
    } finally {
      if (isCurrentSelection(selection)) {
        setUploadingImage(false);
        e.target.value = '';
      }
    }
  };

  const submitAnswer = async (questionId: string) => {
    const selection = selectionRef.current;
    const submittedDraft = draftRef.current;
    if (selection.id !== questionId || replyInFlightRef.current || loadingAnswers ||
        (!submittedDraft.body.trim() && !submittedDraft.image_url)) return;
    const request = ++replyRequestRef.current;
    const isCurrentReply = () => isCurrentSelection(selection) && request === replyRequestRef.current;
    replyInFlightRef.current = true;
    setSubmitting(true);
    setError('');
    try {
      // The request belongs to this question even if the user navigates away.
      await apiPost(`/admin/questions/${questionId}/answer`, submittedDraft);

      if (isCurrentReply()) {
        const newAnswer: Answer = {
          id: 'a-new-' + Date.now(),
          body: submittedDraft.body,
          author_name: 'فريق فُصْحَى',
          author_role: 'admin',
          is_accepted: 1,
          created_at: new Date().toISOString(),
          image_url: submittedDraft.image_url || undefined
        };
        setAnswers(prev => [...prev, newAnswer]);
        if (draftRef.current === submittedDraft) {
          updateAnswerText('');
          updateAttachedImage(null);
        }
      }

      // Reflect server success for the original question, never the current selection.
      setQuestions(prev => prev.map(q => {
        if (q.id === questionId) {
          return {
            ...q,
            answers_count: q.answers_count + 1,
            status: 'answered'
          };
        }
        return q;
      }));
    } catch (e: any) {
      if (isCurrentReply() && draftRef.current === submittedDraft) {
        setError(e.message || 'فشل إرسال الرد. حاول مرة أخرى.');
      }
    } finally {
      if (isCurrentReply()) {
        replyInFlightRef.current = false;
        setSubmitting(false);
      }
    }
  };

  const togglePin = async (q: Question) => {
    const nextPinVal = q.is_pinned === 1 ? 0 : 1;
    try {
      await apiPatch(`/admin/questions/${q.id}`, { is_pinned: nextPinVal });
      setQuestions(prev => prev.map(item => item.id === q.id ? { ...item, is_pinned: nextPinVal } : item));
    } catch (e: any) {
      setError(e.message || 'فشل تحديث حالة التثبيت. حاول مرة أخرى.');
    }
  };

  const hideQuestion = async (questionId: string) => {
    if (!confirm('هل تريد إخفاء هذا السؤال؟ لن يظهر للطلاب الآخرين في التطبيق.')) return;
    const selection = selectionRef.current;
    try {
      await apiPatch(`/admin/questions/${questionId}`, { status: 'hidden' });
      setQuestions(prev => prev.filter(item => item.id !== questionId));
      if (isCurrentSelection(selection) && selection.id === questionId) {
        changeSelection(null);
      }
    } catch (e: any) {
      if (isCurrentSelection(selection)) setError(e.message || 'فشل إخفاء السؤال. حاول مرة أخرى.');
    }
  };

  const resolveQuestion = async (questionId: string) => {
    const selection = selectionRef.current;
    try {
      await apiPatch(`/admin/questions/${questionId}`, { status: 'closed' });
      setQuestions(prev => prev.map(item => item.id === questionId ? { ...item, status: 'closed' } : item));
      if (isCurrentSelection(selection)) {
        if (selection.id === questionId) changeSelection(null);
        fetchQuestions(1, false);
      }
    } catch (e: any) {
      if (isCurrentSelection(selection)) setError(e.message || 'فشل تعليم السؤال كمحلول. حاول مرة أخرى.');
    }
  };

  const insertFormat = (prefix: string, suffix: string = '') => {
    const textarea = document.getElementById('reply-textarea') as HTMLTextAreaElement;
    if (!textarea) return;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const text = textarea.value;
    const selectedText = text.substring(start, end);
    const replacement = prefix + selectedText + suffix;
    updateAnswerText(text.substring(0, start) + replacement + text.substring(end));
    
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + prefix.length, start + prefix.length + selectedText.length);
    }, 0);
  };

  const timeAgo = (dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return `منذ ${mins} دقيقة`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `منذ ${hours} ساعة`;
    const days = Math.floor(hours / 24);
    return `منذ ${days} يوم`;
  };

  const searchedQuestions = questions.filter(q => 
    q.body.toLowerCase().includes(searchQuery.toLowerCase()) ||
    q.student_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (q.course_title || '').toLowerCase().includes(searchQuery.toLowerCase())
  );

  const selectedQuestion = questions.find(q => q.id === selectedQuestionId);

  const formatTextWithMath = (text: string) => {
    return <span className="whitespace-pre-wrap">{text}</span>;
  };

  return (
    <div className="space-y-6 select-none text-on-surface" dir="rtl">

      {/* Mode switcher */}
      <div className="flex flex-wrap items-center gap-2 rounded-fusha-md border border-outline-variant bg-surface p-2 shadow-fusha-sm">
        <button
          type="button"
          onClick={() => setMode('inbox')}
          className={`flex min-h-12 flex-1 items-center justify-center gap-2 rounded-fusha-sm px-4 text-label-md transition ${
            mode === 'inbox'
              ? 'bg-primary text-on-primary'
              : 'text-on-surface-variant hover:bg-surface-container'
          }`}
        >
          <span className="material-symbols-outlined text-lg">forum</span>
          <span>أسئلة الطلاب</span>
        </button>
        <button
          type="button"
          onClick={() => setMode('bank')}
          className={`flex min-h-12 flex-1 items-center justify-center gap-2 rounded-fusha-sm px-4 text-label-md transition ${
            mode === 'bank'
              ? 'bg-primary text-on-primary'
              : 'text-on-surface-variant hover:bg-surface-container'
          }`}
        >
          <span className="material-symbols-outlined text-lg">library_books</span>
          <span>بنك الأسئلة</span>
        </button>
      </div>

      {mode === 'bank' ? (
        <QuestionBankPanel />
      ) : (
      <div className="flex h-[calc(100vh-220px)] flex-col space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-outline-variant pb-4">
        <div>
          <h1 className="font-display-lg text-2xl font-bold text-on-surface flex items-center gap-2">
            <span className="material-symbols-outlined text-primary text-2xl">forum</span>
            <span>صندوق أسئلة واستفسارات الطلاب</span>
          </h1>
          <p className="font-body-sm text-on-surface-variant text-xs mt-1">تلقي ومراجعة الأسئلة العلمية، الإجابة عنها، ودعم كتابة الرموز والمعادلات الرياضية</p>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-lg bg-error-container/20 border border-error-container text-error text-xs flex items-center justify-between">
          <span>{error}</span>
          <button onClick={() => setError('')} className="underline font-bold hover:text-on-surface transition">إغلاق</button>
        </div>
      )}

      {/* Main Container: Split List & Detail */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-3 gap-6 overflow-hidden min-h-0">
        
        {/* Left Side: Questions List (1 Column) */}
        <div className="lg:col-span-1 bg-surface border border-outline-variant shadow-sm rounded-xl flex flex-col overflow-hidden">
          
          {/* Search and Filters */}
          <div className="p-4 border-b border-outline-variant bg-surface-container-low/50 space-y-3">
            <div className="relative">
              <input 
                placeholder="البحث في الأسئلة أو الطلاب..." 
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full pe-4 ps-10 py-2.5 bg-surface border border-outline-variant focus:border-primary focus:ring-1 focus:ring-primary rounded-lg text-xs text-on-surface placeholder:text-outline focus:outline-none transition text-start shadow-sm" 
              />
              <span className="material-symbols-outlined absolute start-3 top-2 text-on-surface-variant text-lg">search</span>
            </div>

            <div className="flex gap-2">
              <button 
                onClick={() => setStatusFilter('open')} 
                className={`flex-1 py-1.5 rounded-lg text-xs font-semibold border transition ${
                  statusFilter === 'open' 
                    ? 'bg-primary text-on-primary border-primary' 
                    : 'bg-surface border-outline-variant text-on-surface-variant hover:bg-surface-container'
                }`}
              >
                بانتظار الرد
              </button>
              <button 
                onClick={() => setStatusFilter('answered')} 
                className={`flex-1 py-1.5 rounded-lg text-xs font-semibold border transition ${
                  statusFilter === 'answered' 
                    ? 'bg-primary text-on-primary border-primary' 
                    : 'bg-surface border-outline-variant text-on-surface-variant hover:bg-surface-container'
                }`}
              >
                تمت إجابتها
              </button>
            </div>
          </div>

          {/* List scrollable area */}
          <div className="flex-1 overflow-y-auto divide-y divide-outline-variant/60 custom-scrollbar">
            {loading ? (
              <div className="text-center py-10">
                <span className="material-symbols-outlined animate-spin text-primary text-2xl">sync</span>
              </div>
            ) : searchedQuestions.length === 0 ? (
              <div className="text-center py-10 text-xs text-on-surface-variant">لا توجد أسئلة تطابق الفلتر الحالي</div>
            ) : searchedQuestions.map(q => (
              <div 
                key={q.id} 
                onClick={() => selectQuestion(q.id)}
                className={`p-4 cursor-pointer transition select-none relative hover:bg-surface-container-low/50 ${
                  selectedQuestionId === q.id ? 'bg-primary/5 hover:bg-primary/5' : ''
                }`}
              >
                {q.is_pinned === 1 && (
                  <span className="material-symbols-outlined text-[14px] text-primary absolute end-3 top-3" style={{ fontVariationSettings: "'FILL' 1" }}>
                    push_pin
                  </span>
                )}
                
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-xs text-on-surface max-w-[120px] truncate">{q.student_name}</span>
                    <span className="text-[9px] px-2 py-0.5 bg-surface-container border border-outline-variant text-on-surface-variant rounded-md truncate max-w-[150px]">
                      {q.course_title}
                    </span>
                  </div>
                  <p className="text-xs text-on-surface-variant line-clamp-2 leading-relaxed">{q.body}</p>
                  
                  <div className="flex justify-between items-center text-[10px] text-outline">
                    <span className="flex items-center gap-1">
                      <span className="material-symbols-outlined text-[12px]">schedule</span>
                      <span>{timeAgo(q.created_at)}</span>
                    </span>
                    <span className="flex items-center gap-1 font-bold text-primary">
                      <span className="material-symbols-outlined text-[12px]">forum</span>
                      <span>{q.answers_count} إجابة</span>
                    </span>
                  </div>
                </div>
              </div>
            ))}
            {hasMore && (
              <div className="p-3 text-center">
                <button
                  onClick={loadMoreQuestions}
                  disabled={loadingMore}
                  className="w-full rounded-lg border border-outline-variant bg-surface py-2 text-xs font-bold text-on-surface-variant transition hover:border-primary/40 hover:text-primary disabled:opacity-50"
                >
                  {loadingMore ? (
                    <span className="material-symbols-outlined animate-spin align-middle text-sm">sync</span>
                  ) : (
                    'تحميل المزيد'
                  )}
                </button>
              </div>
            )}
          </div>

        </div>

        {/* Right Side: Conversation Panel (2 Columns) */}
        <div className="lg:col-span-2 bg-surface border border-outline-variant shadow-sm rounded-xl flex flex-col overflow-hidden h-full">
          
          {selectedQuestion ? (
            <div className="flex flex-col h-full overflow-hidden">
              
              {/* Detail Header */}
              <div className="p-4 border-b border-outline-variant bg-surface-container-low/50 flex justify-between items-center gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-sm">
                    {selectedQuestion.student_name[0]}
                  </div>
                  <div>
                    <h3 className="text-xs font-bold text-on-surface">{selectedQuestion.student_name}</h3>
                    <p className="text-[10px] text-on-surface-variant mt-0.5 font-mono">{selectedQuestion.student_phone}</p>
                  </div>
                </div>

                <div className="flex items-center gap-1.5">
                  <button 
                    onClick={() => togglePin(selectedQuestion)}
                    title={selectedQuestion.is_pinned === 1 ? 'إلغاء التثبيت' : 'تثبيت السؤال'}
                    className={`p-2 rounded-lg transition ${
                      selectedQuestion.is_pinned === 1 
                        ? 'text-primary bg-primary/10 border border-primary/20' 
                        : 'text-on-surface-variant hover:text-primary hover:bg-surface-container'
                    }`}
                  >
                    <span 
                      className="material-symbols-outlined text-base"
                      style={selectedQuestion.is_pinned === 1 ? { fontVariationSettings: "'FILL' 1" } : undefined}
                    >
                      push_pin
                    </span>
                  </button>
                  <button 
                    onClick={() => resolveQuestion(selectedQuestion.id)}
                    title="تعليم كمحلول ومكتمل"
                    className="p-2 text-on-surface-variant hover:text-primary hover:bg-surface-container rounded-lg transition"
                  >
                    <span className="material-symbols-outlined text-base">check_circle</span>
                  </button>
                  <button 
                    onClick={() => hideQuestion(selectedQuestion.id)}
                    title="إخفاء السؤال من بقية الطلاب"
                    className="p-2 text-on-surface-variant hover:text-error hover:bg-error-container/20 rounded-lg transition"
                  >
                    <span className="material-symbols-outlined text-base">visibility_off</span>
                  </button>
                </div>
              </div>

              {/* Scrollable Conversation History */}
              <div className="flex-1 p-6 overflow-y-auto space-y-6 custom-scrollbar bg-surface-container-lowest/40">
                
                {/* Student's original question post */}
                <div className="bg-surface border border-outline-variant rounded-xl p-5 space-y-3 shadow-sm max-w-[90%] md:max-w-[80%]">
                  <div className="flex justify-between items-center text-[10px] text-outline border-b border-outline-variant/60 pb-2">
                    <span className="font-bold text-on-surface-variant">الدرس: {selectedQuestion.lesson_title || 'عام'}</span>
                    <span>{timeAgo(selectedQuestion.created_at)}</span>
                  </div>
                  <div className="text-xs text-on-surface leading-relaxed text-start">
                    {formatTextWithMath(selectedQuestion.body)}
                  </div>
                </div>

                {/* Answers timeline */}
                {loadingAnswers ? (
                  <div className="text-center py-4">
                    <span className="material-symbols-outlined animate-spin text-primary">sync</span>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {answers.map(ans => {
                      const isAdmin = ans.author_role === 'admin';
                      return (
                        <div 
                          key={ans.id} 
                          className={`flex flex-col space-y-1.5 max-w-[90%] md:max-w-[80%] ${
                            isAdmin ? 'ms-auto items-end' : 'me-auto items-start'
                          }`}
                        >
                          <div className={`rounded-xl p-4 border text-xs leading-relaxed text-start ${
                            isAdmin 
                              ? 'bg-primary-fixed text-on-primary-fixed border-primary/20 shadow-sm'
                              : 'bg-surface border-outline-variant shadow-sm text-on-surface'
                          }`}>
                            <div className="flex justify-between items-center text-[9px] text-outline mb-2 border-b border-outline-variant/40 pb-1 gap-4">
                              <span className="font-bold text-on-surface-variant">{ans.author_name}</span>
                              <span>{timeAgo(ans.created_at)}</span>
                            </div>
                            <div>{formatTextWithMath(ans.body)}</div>
                            {ans.image_url && (
                              <div className="mt-2 max-w-[200px] border border-outline-variant rounded-lg overflow-hidden">
                                <a href={ans.image_url} target="_blank" rel="noopener noreferrer">
                                  <img 
                                    src={ans.image_url} 
                                    alt="مرفق الإجابة" 
                                    className="max-w-full max-h-[150px] object-cover hover:scale-105 transition duration-300"
                                  />
                                </a>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

              </div>

              {/* Reply/Editor Action Panel */}
              <div className="p-4 border-t border-outline-variant bg-surface-container-low/50 space-y-3 shrink-0">
                {/* Formatting Tools */}
                <div className="flex items-center gap-1 bg-surface border border-outline-variant shadow-sm rounded-lg p-1.5">
                  <button 
                    onClick={() => insertFormat('**', '**')} 
                    title="نص عريض"
                    className="p-1 text-on-surface-variant hover:text-primary hover:bg-surface-container rounded transition flex items-center justify-center"
                  >
                    <span className="material-symbols-outlined text-base">format_bold</span>
                  </button>
                  <button 
                    onClick={() => insertFormat('*', '*')} 
                    title="نص مائل"
                    className="p-1 text-on-surface-variant hover:text-primary hover:bg-surface-container rounded transition flex items-center justify-center"
                  >
                    <span className="material-symbols-outlined text-base">format_italic</span>
                  </button>
                  
                  <div className="border-s border-outline-variant h-5 mx-1" />
                  
                  <button 
                    onClick={() => document.getElementById('image-attachment-input')?.click()} 
                    title="إرفاق صورة مع الإجابة"
                    disabled={uploadingImage}
                    className="p-1.5 text-on-surface-variant hover:text-primary hover:bg-surface-container rounded transition flex items-center justify-center gap-1 shrink-0"
                  >
                    <span className="material-symbols-outlined text-base">image</span>
                    <span className="text-[10px] font-bold">إرفاق صورة</span>
                  </button>
                  <input 
                    type="file" 
                    id="image-attachment-input" 
                    accept="image/*" 
                    onChange={handleImageChange} 
                    className="hidden" 
                  />
                </div>

                {/* Image attachment preview */}
                {(attachedImageUrl || uploadingImage) && (
                  <div className="flex items-center gap-3 bg-surface border border-outline-variant rounded-xl p-2.5 shadow-sm">
                    {uploadingImage ? (
                      <div className="flex items-center gap-2 text-xs text-on-surface-variant font-semibold">
                        <span className="material-symbols-outlined animate-spin text-sm">sync</span>
                        <span>جاري رفع الصورة المرفقة...</span>
                      </div>
                    ) : attachedImageUrl ? (
                      <div className="flex items-center justify-between w-full">
                        <div className="flex items-center gap-2">
                          <img 
                            src={attachedImageUrl} 
                            alt="مرفق" 
                            className="w-12 h-12 object-cover rounded-lg border border-outline-variant"
                          />
                          <span className="text-[10px] text-on-surface-variant">تم إرفاق صورة مع الإجابة</span>
                        </div>
                        <button 
                          onClick={() => updateAttachedImage(null)} 
                          className="p-1 text-error hover:bg-error-container/20 rounded-full transition flex items-center justify-center"
                          title="إلغاء المرفق"
                        >
                          <span className="material-symbols-outlined text-sm">delete</span>
                        </button>
                      </div>
                    ) : null}
                  </div>
                )}

                {/* Reply Input Box */}
                <div className="flex items-end gap-2 bg-surface border border-outline-variant focus-within:border-primary focus-within:ring-1 focus-within:ring-primary rounded-xl p-2.5 shadow-sm transition duration-300">
                  <textarea 
                    id="reply-textarea"
                    placeholder="اكتب ردك العلمي هنا..."
                    rows={2}
                    value={answerText}
                    onChange={e => updateAnswerText(e.target.value)}
                    className="flex-1 bg-transparent text-xs text-on-surface placeholder:text-outline outline-none resize-none text-start"
                  />
                  <button 
                    onClick={() => submitAnswer(selectedQuestion.id)}
                    disabled={submitting || loadingAnswers || (!answerText.trim() && !attachedImageUrl)}
                    className="px-5 py-3 bg-primary hover:bg-primary-container text-on-primary disabled:opacity-40 disabled:pointer-events-none rounded-xl text-xs font-bold transition flex items-center gap-1.5 self-end shrink-0 shadow-ambient"
                  >
                    {submitting ? (
                      <span className="material-symbols-outlined animate-spin text-sm">sync</span>
                    ) : (
                      <span className="material-symbols-outlined text-sm rtl:rotate-180">send</span>
                    )}
                    <span>إرسال الرد</span>
                  </button>
                </div>
              </div>

            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-center p-10 bg-surface-container-lowest/30">
              <span className="material-symbols-outlined text-on-surface-variant/30 text-5xl mb-3 block">forum</span>
              <p className="text-sm font-bold text-on-surface-variant">الرجاء اختيار أحد الأسئلة من القائمة لاستعراض التفاصيل وإرسال الإجابة</p>
            </div>
          )}

        </div>

      </div>
      </div>
      )}

    </div>
  );
}
