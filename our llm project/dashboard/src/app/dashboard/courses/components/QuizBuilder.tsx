'use client';

import { useEffect, useState } from 'react';
import { apiGet, apiPost, apiPatch, apiDelete } from '@/lib/api';

interface QuizBuilderProps {
  lessonId: string | null;
  isOpen: boolean;
  onClose: () => void;
}

export default function QuizBuilder({ lessonId, isOpen, onClose }: QuizBuilderProps) {
  const [quizId, setQuizId] = useState<string | null>(null);
  const [quizTitle, setQuizTitle] = useState('واجب المحاضرة');
  const [quizMaxScore, setQuizMaxScore] = useState(10);
  const [quizIsPublished, setQuizIsPublished] = useState(true);
  const [quizQuestions, setQuizQuestions] = useState<any[]>([]);
  const [isSavingQuizMeta, setIsSavingQuizMeta] = useState(false);

  // Question form states
  const [editingQuestionId, setEditingQuestionId] = useState<string | null>(null);
  const [questionText, setQuestionText] = useState('');
  const [questionImageUrl, setQuestionImageUrl] = useState('');
  const [questionOptions, setQuestionOptions] = useState<string[]>(['', '', '', '']);
  const [questionCorrectOption, setQuestionCorrectOption] = useState('');
  const [correctOptionIdx, setCorrectOptionIdx] = useState<number | null>(null);
  const [questionScore, setQuestionScore] = useState(1);
  const [isUploadingQuestionImage, setIsUploadingQuestionImage] = useState(false);
  const [isSavingQuestion, setIsSavingQuestion] = useState(false);
  const [quizError, setQuizError] = useState('');
  const [quizSuccess, setQuizSuccess] = useState('');

  const resetQuestionForm = () => {
    setEditingQuestionId(null);
    setQuestionText('');
    setQuestionImageUrl('');
    setQuestionOptions(['', '', '', '']);
    setQuestionCorrectOption('');
    setCorrectOptionIdx(null);
    setQuestionScore(1);
    setQuizError('');
  };

  const fetchQuizForLesson = async (targetLessonId: string) => {
    try {
      setQuizError('');
      const res = await apiGet<{ quizzes: any[] }>(`/admin/lessons/${targetLessonId}/quizzes`);
      if (res.quizzes && res.quizzes.length > 0) {
        const q = res.quizzes[0];
        setQuizId(q.id);
        setQuizTitle(q.title);
        setQuizMaxScore(q.max_score);
        setQuizIsPublished(q.is_published === 1);

        // Fetch questions
        const details = await apiGet<{ quiz: any, questions: any[] }>(`/admin/quizzes/${q.id}`);
        setQuizQuestions(details.questions || []);
      } else {
        // Automatically create a default quiz draft for the user so they can immediately add questions!
        const defaultQuiz = await apiPost<{ quiz: any }>(`/admin/lessons/${targetLessonId}/quizzes`, {
          title: 'واجب المحاضرة',
          max_score: 10,
          is_published: true,
        });
        setQuizId(defaultQuiz.quiz.id);
        setQuizTitle(defaultQuiz.quiz.title);
        setQuizMaxScore(defaultQuiz.quiz.max_score);
        setQuizIsPublished(defaultQuiz.quiz.is_published === 1 || defaultQuiz.quiz.is_published === true);
        setQuizQuestions([]);
      }
      resetQuestionForm();
    } catch (e: any) {
      console.error(e);
      setQuizError(e.message || 'حدث خطأ أثناء تحميل تفاصيل الواجب');
    }
  };

  useEffect(() => {
    if (isOpen && lessonId) {
      fetchQuizForLesson(lessonId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, lessonId]);

  const handleSaveQuizMeta = async () => {
    if (!lessonId) return;
    try {
      setIsSavingQuizMeta(true);
      setQuizError('');
      setQuizSuccess('');
      const res = await apiPost<{ quiz: any }>(`/admin/lessons/${lessonId}/quizzes`, {
        title: quizTitle,
        max_score: quizMaxScore,
        is_published: quizIsPublished,
      });
      setQuizId(res.quiz.id);
      setQuizSuccess('تم حفظ إعدادات الواجب بنجاح!');
      setTimeout(() => setQuizSuccess(''), 4000);
    } catch (e: any) {
      console.error(e);
      setQuizError(e.message || 'حدث خطأ أثناء حفظ إعدادات الواجب');
    } finally {
      setIsSavingQuizMeta(false);
    }
  };

  const handleUploadQuestionImage = async (file: File) => {
    try {
      setIsUploadingQuestionImage(true);
      setQuizError('');
      const { upload_url, public_url } = await apiPost<{ upload_url: string; public_url: string }>(
        '/admin/quizzes/question-image-url',
        { filename: file.name, mime_type: file.type }
      );

      await fetch(upload_url, {
        method: 'PUT',
        headers: { 'Content-Type': file.type },
        body: file,
      });

      setQuestionImageUrl(public_url);
    } catch (e: any) {
      console.error(e);
      setQuizError(e.message || 'فشل رفع صورة السؤال');
    } finally {
      setIsUploadingQuestionImage(false);
    }
  };

  const handleSaveQuestion = async () => {
    if (!quizId) {
      setQuizError('يرجى حفظ إعدادات الواجب أولاً قبل إضافة أسئلة');
      return;
    }

    // Resolve options (use default A, B, C, D if empty)
    const resolvedOptions = questionOptions.map((o, idx) => o.trim() || ['A', 'B', 'C', 'D'][idx]);

    if (correctOptionIdx === null) {
      setQuizError('يرجى تحديد الإجابة الصحيحة من بين الخيارات');
      return;
    }

    const correctOptionText = resolvedOptions[correctOptionIdx];

    try {
      setIsSavingQuestion(true);
      setQuizError('');
      setQuizSuccess('');

      const payload = {
        question_text: questionText.trim() || null,
        image_url: questionImageUrl.trim() || null,
        options: resolvedOptions,
        correct_option: correctOptionText,
        score: questionScore,
      };

      if (editingQuestionId) {
        await apiPatch(`/admin/quizzes/questions/${editingQuestionId}`, payload);
      } else {
        await apiPost(`/admin/quizzes/${quizId}/questions`, payload);
      }

      // Reload questions
      const details = await apiGet<{ questions: any[] }>(`/admin/quizzes/${quizId}`);
      setQuizQuestions(details.questions || []);
      resetQuestionForm();

      setQuizSuccess('تم حفظ السؤال بنجاح!');
      setTimeout(() => setQuizSuccess(''), 4000);
    } catch (e: any) {
      console.error(e);
      setQuizError(e.message || 'حدث خطأ أثناء حفظ السؤال');
    } finally {
      setIsSavingQuestion(false);
    }
  };

  const handleDeleteQuestion = async (qId: string) => {
    if (!confirm('هل أنت متأكد من رغبتك في حذف هذا السؤال؟')) return;
    try {
      setQuizError('');
      await apiDelete(`/admin/quizzes/questions/${qId}`);
      setQuizQuestions(quizQuestions.filter(q => q.id !== qId));
    } catch (e: any) {
      console.error(e);
      setQuizError(e.message || 'فشل حذف السؤال');
    }
  };

  const handleEditQuestionClick = (q: any) => {
    setEditingQuestionId(q.id);
    setQuestionText(q.question_text || '');
    setQuestionImageUrl(q.image_url || '');
    const opts = [...q.options];
    while (opts.length < 4) opts.push('');
    setQuestionOptions(opts);
    setQuestionCorrectOption(q.correct_option);

    // Find index of correct option
    const idx = opts.findIndex((o, i) => {
      const resolved = o.trim() || ['A', 'B', 'C', 'D'][i];
      return resolved === q.correct_option?.trim();
    });
    setCorrectOptionIdx(idx !== -1 ? idx : null);

    setQuestionScore(q.score || 1);
    setQuizError('');
  };

  const handleClose = () => {
    onClose();
    resetQuestionForm();
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-in fade-in duration-200 overflow-y-auto"
      onClick={handleClose}
    >
      <div
        className="bg-surface-container-lowest border border-outline-variant rounded-2xl p-6 max-w-4xl w-full space-y-6 shadow-ambient animate-in zoom-in-95 duration-200 my-8 max-h-[90vh] overflow-y-auto text-right"
        onClick={e => e.stopPropagation()}
        style={{ direction: 'rtl' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-outline-variant pb-3">
          <h3 className="text-sm font-bold text-on-surface flex items-center gap-2">
            <span className="material-symbols-outlined text-warning text-base">quiz</span>
            <span>إدارة واجب واسئلة المحاضرة</span>
          </h3>
          <button
            onClick={handleClose}
            className="text-on-surface-variant hover:text-on-surface transition flex items-center"
          >
            <span className="material-symbols-outlined text-base">close</span>
          </button>
        </div>

        {quizError && (
          <div className="p-3 bg-error-container/20 border border-error-container text-error text-xs rounded-xl flex items-center justify-between">
            <span>{quizError}</span>
            <button onClick={() => setQuizError('')} className="material-symbols-outlined text-sm font-bold">close</button>
          </div>
        )}

        {quizSuccess && (
          <div className="p-3 bg-success-container/30 border border-success-container text-success text-xs rounded-xl flex items-center justify-between">
            <span>{quizSuccess}</span>
            <button onClick={() => setQuizSuccess('')} className="material-symbols-outlined text-sm font-bold">close</button>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-12 gap-6">

          {/* Right Side: Quiz Meta and Existing Questions List */}
          <div className="md:col-span-6 space-y-5">
            <div className="bg-surface-container-low border border-outline-variant rounded-xl p-4 space-y-4">
              <h4 className="text-xs font-bold text-on-surface flex items-center gap-1.5 justify-end">
                <span>إعدادات الواجب العامة</span>
                <span className="material-symbols-outlined text-xs text-primary">settings</span>
              </h4>

              <div className="space-y-3">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-on-surface-variant">عنوان الواجب / الاختبار</label>
                  <input
                    type="text"
                    value={quizTitle}
                    onChange={e => setQuizTitle(e.target.value)}
                    placeholder="مثال: واجب المحاضرة الأولى"
                    className="w-full px-3 py-2 text-xs border border-outline-variant rounded-xl focus:border-primary outline-none"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-on-surface-variant">الدرجة الكلية (القصوى)</label>
                    <input
                      type="number"
                      value={quizMaxScore}
                      onChange={e => setQuizMaxScore(parseInt(e.target.value) || 10)}
                      className="w-full px-3 py-2 text-xs border border-outline-variant rounded-xl focus:border-primary outline-none"
                      min={1}
                    />
                  </div>

                  <div className="flex items-center justify-start gap-2 pt-5 select-none">
                    <input
                      type="checkbox"
                      id="quiz-published-check"
                      checked={quizIsPublished}
                      onChange={e => setQuizIsPublished(e.target.checked)}
                      className="rounded border-outline-variant text-primary focus:ring-primary h-4 w-4"
                    />
                    <label htmlFor="quiz-published-check" className="text-xs font-semibold text-on-surface cursor-pointer">نشر للطلاب</label>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleSaveQuizMeta}
                  disabled={isSavingQuizMeta || !quizTitle.trim()}
                  className="w-full py-2 bg-primary text-on-primary hover:bg-primary/95 text-xs font-bold rounded-xl transition disabled:opacity-50"
                >
                  {isSavingQuizMeta ? 'جاري الحفظ...' : quizId ? 'تحديث إعدادات الواجب' : 'إنشاء وتفعيل الواجب'}
                </button>
              </div>
            </div>

            <div className="space-y-3">
              <h4 className="text-xs font-bold text-on-surface flex items-center gap-1.5 justify-end">
                <span>الأسئلة الحالية ({quizQuestions.length})</span>
                <span className="material-symbols-outlined text-xs text-primary">format_list_bulleted</span>
              </h4>

              {!quizId ? (
                <p className="text-[10px] text-on-surface-variant italic bg-surface-container-low border border-outline-variant rounded-xl p-4 text-center">
                  يرجى إنشاء وحفظ إعدادات الواجب أولاً لتتمكن من إضافة أسئلة.
                </p>
              ) : quizQuestions.length === 0 ? (
                <p className="text-[10px] text-on-surface-variant italic bg-surface-container-low border border-outline-variant rounded-xl p-4 text-center">
                  لا توجد أسئلة مضافة لهذا الواجب بعد. استخدم النموذج المقابل لإضافة أسئلة.
                </p>
              ) : (
                <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
                  {quizQuestions.map((q, idx) => (
                    <div key={q.id} className="p-3 bg-surface-container-low hover:bg-surface-container border border-outline-variant/60 rounded-xl flex items-start justify-between gap-3">
                      <div className="space-y-1">
                        <p className="text-[11px] font-bold text-on-surface text-right">س {idx + 1}: {q.question_text || '(سؤال بصورة فقط)'}</p>
                        {q.image_url && (
                          <img src={q.image_url} alt="سؤال" className="h-10 object-contain rounded border border-outline-variant bg-surface" />
                        )}
                        <div className="flex flex-row-reverse flex-wrap gap-2 pt-1 text-[9px] text-on-surface-variant">
                          <span className="bg-success-container/40 text-success px-2 py-0.5 rounded font-semibold border border-success-container">
                            الإجابة الصحيحة: {q.correct_option}
                          </span>
                          <span className="bg-surface-container text-on-surface-variant px-2 py-0.5 rounded font-mono">
                            نقاط: {q.score}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => handleEditQuestionClick(q)}
                          className="p-1 hover:bg-primary/10 text-primary rounded transition flex items-center"
                          title="تعديل السؤال"
                        >
                          <span className="material-symbols-outlined text-sm">edit</span>
                        </button>
                        <button
                          onClick={() => handleDeleteQuestion(q.id)}
                          className="p-1 hover:bg-error-container/20 text-error rounded transition flex items-center"
                          title="حذف السؤال"
                        >
                          <span className="material-symbols-outlined text-sm">delete</span>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Left Side: Question Form */}
          <div className="md:col-span-6 border-r md:border-r border-outline-variant pr-0 md:pr-6 space-y-4">
            <h4 className="text-xs font-bold text-on-surface flex items-center gap-1.5 justify-end">
              <span>{editingQuestionId ? 'تعديل السؤال المحدد' : 'إضافة سؤال جديد'}</span>
              <span className="material-symbols-outlined text-xs text-primary">add_box</span>
            </h4>

            <div className="space-y-3">
              {/* Question text */}
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-on-surface-variant">نص السؤال</label>
                <textarea
                  value={questionText}
                  onChange={e => setQuestionText(e.target.value)}
                  placeholder="اكتب نص السؤال هنا..."
                  rows={2}
                  className="w-full px-3 py-2 text-xs border border-outline-variant rounded-xl focus:border-primary outline-none resize-none"
                />
              </div>

              {/* Question Image */}
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-on-surface-variant">أرفق صورة للسؤال (اختياري)</label>
                <div className="flex gap-2">
                  <div className="flex-1 relative border border-dashed border-outline-variant rounded-xl p-2 bg-surface-container-low flex items-center justify-center cursor-pointer hover:bg-surface-container transition min-h-[40px]">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={e => {
                        const file = e.target.files?.[0];
                        if (file) handleUploadQuestionImage(file);
                      }}
                      className="absolute inset-0 opacity-0 cursor-pointer"
                      disabled={isUploadingQuestionImage}
                    />
                    {isUploadingQuestionImage ? (
                      <div className="flex items-center gap-1.5 text-xs text-on-surface-variant">
                        <span className="material-symbols-outlined text-sm animate-spin">sync</span>
                        <span>جاري الرفع...</span>
                      </div>
                    ) : questionImageUrl ? (
                      <div className="flex items-center gap-1 text-xs text-success font-bold truncate max-w-[200px]">
                        <span className="material-symbols-outlined text-sm">check_circle</span>
                        <span>تم رفع الصورة</span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1 text-[10px] text-on-surface-variant">
                        <span className="material-symbols-outlined text-sm text-primary">image</span>
                        <span>اضغط لاختيار صورة السؤال</span>
                      </div>
                    )}
                  </div>

                  {questionImageUrl && (
                    <div className="relative group">
                      <img src={questionImageUrl} alt="معاينة" className="w-10 h-10 object-cover rounded border border-outline-variant" />
                      <button
                        onClick={() => setQuestionImageUrl('')}
                        className="absolute -top-1.5 -left-1.5 bg-error text-on-error rounded-full w-4 h-4 flex items-center justify-center text-[10px]"
                      >
                        ×
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Choices Inputs */}
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-on-surface-variant block">الخيارات (الاختيارات)</label>
                <div className="space-y-2">
                  {questionOptions.map((opt, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <span className="text-xs font-bold text-on-surface-variant w-4 text-center font-mono">
                        {['A', 'B', 'C', 'D'][idx]}
                      </span>
                      <input
                        type="text"
                        value={opt}
                        onChange={e => {
                          const copy = [...questionOptions];
                          copy[idx] = e.target.value;
                          setQuestionOptions(copy);
                        }}
                        placeholder={['A', 'B', 'C', 'D'][idx]}
                        className="flex-1 px-3 py-2 text-xs border border-outline-variant rounded-xl focus:border-primary outline-none text-right placeholder-outline font-semibold"
                      />
                      <input
                        type="radio"
                        name="correct-option-radio"
                        checked={correctOptionIdx === idx}
                        onChange={() => setCorrectOptionIdx(idx)}
                        className="text-primary focus:ring-primary h-4 w-4 cursor-pointer"
                        title="تحديد كإجابة صحيحة"
                      />
                    </div>
                  ))}
                </div>
              </div>

              {/* Score & Save Button */}
              <div className="grid grid-cols-2 gap-3 pt-2">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-on-surface-variant">النقاط / الدرجة</label>
                  <input
                    type="number"
                    value={questionScore}
                    onChange={e => setQuestionScore(parseInt(e.target.value) || 1)}
                    className="w-full px-3 py-1.5 text-xs border border-outline-variant rounded-xl focus:border-primary outline-none"
                    min={1}
                  />
                </div>

                <div className="flex items-end gap-2">
                  <button
                    type="button"
                    onClick={handleSaveQuestion}
                    disabled={isSavingQuestion || !quizId}
                    className="w-full py-2 bg-primary hover:bg-primary/90 text-on-primary text-xs font-bold rounded-xl transition disabled:opacity-50"
                  >
                    {isSavingQuestion ? 'جاري الحفظ...' : editingQuestionId ? 'حفظ التعديلات' : 'إضافة السؤال'}
                  </button>

                  {editingQuestionId && (
                    <button
                      type="button"
                      onClick={resetQuestionForm}
                      className="py-2 px-3 bg-surface-container hover:bg-surface-container-high text-on-surface-variant text-xs font-bold rounded-xl transition"
                    >
                      إلغاء
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
