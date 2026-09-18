import { useEffect, useRef, useState } from 'react';
import { ApiService } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import ZoomableImage from '../../components/ZoomableImage';
import { isSubmittedAttempt, parseAssessmentAnswers, startAssessmentCountdown } from '../home/assessmentContract';

interface QuizPanelProps {
  lessonId: string;
}

/**
 * Self-contained lesson quiz/homework engine (fetch, timer, solve, submit,
 * review). Split out of LessonPlayer and lazy-loaded only when the student
 * opens the "الواجبات" sidebar tab, so the quiz engine's JS never has to be
 * downloaded/parsed just to watch a video.
 */
export const QuizPanel: React.FC<QuizPanelProps> = ({ lessonId }) => {
  const { user } = useAuth();
  const { showToast } = useToast();

  const [quizLoading, setQuizLoading] = useState(false);
  const [quizData, setQuizData] = useState<any | null>(null);
  const [quizQuestionsList, setQuizQuestionsList] = useState<any[]>([]);
  const [quizAttempt, setQuizAttempt] = useState<any | null>(null);
  const [showSubmitConfirm, setShowSubmitConfirm] = useState(false);
  const [studentAnswers, setStudentAnswers] = useState<Record<string, string>>({});
  const [submittingQuiz, setSubmittingQuiz] = useState(false);
  const [quizError, setQuizError] = useState('');
  const [quizTimeLeft, setQuizTimeLeft] = useState<number | null>(null);
  const submissionLock = useRef(false);
  const quizFetchInFlight = useRef(false);
  const submitted = isSubmittedAttempt(quizAttempt);

  const fetchLessonQuiz = async (lId: string) => {
    if (quizFetchInFlight.current) return;
    quizFetchInFlight.current = true;
    try {
      setQuizLoading(true);
      setQuizError('');
      const res = await ApiService.getLessonQuiz(lId);
      setQuizData(res.quiz);
      setQuizQuestionsList(res.questions || []);
      setQuizAttempt(res.attempt || null);
      const serverAnswers = parseAssessmentAnswers(res.attempt?.answers);
      setStudentAnswers(previous => isSubmittedAttempt(res.attempt)
        ? serverAnswers
        : { ...serverAnswers, ...previous });
    } catch (e: any) {
      console.error(e);
      setQuizError(e.message || 'فشل تحميل الواجب الخاص بالمحاضرة');
    } finally {
      quizFetchInFlight.current = false;
      setQuizLoading(false);
    }
  };

  useEffect(() => {
    submissionLock.current = false;
    setQuizData(null);
    setQuizAttempt(null);
    setStudentAnswers({});
    setShowSubmitConfirm(false);
    if (!user) return;
    fetchLessonQuiz(lessonId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lessonId, user?.id]);

  const handleSubmitQuiz = async (isTimeout = false) => {
    if (!quizData || quizLoading || submitted || submissionLock.current) return;

    if (!isTimeout && quizTimeLeft !== 0 && Object.keys(studentAnswers).length === 0) {
      setQuizError('يرجى الإجابة على الأسئلة أولاً قبل التسليم');
      return;
    }

    submissionLock.current = true;
    try {
      setSubmittingQuiz(true);
      setQuizError('');
      const res = await ApiService.submitQuizAnswers(lessonId, studentAnswers);
      // Keep the accepted result even if the follow-up details request fails.
      setQuizAttempt({ ...quizAttempt, is_submitted: 1, answers: studentAnswers, score: res.score });
      if (isTimeout) {
        showToast('warning', 'انتهى الوقت المحدد للواجب', `تم تسليم إجاباتك تلقائياً. درجتك: ${res.score} / ${res.max_score}`, 8000);
      }
      setShowSubmitConfirm(false);
      await fetchLessonQuiz(lessonId);
    } catch (e: any) {
      submissionLock.current = false;
      console.error(e);
      setQuizError(e.message || 'فشل تسليم الواجب');
    } finally {
      setSubmittingQuiz(false);
    }
  };

  const timeoutRef = useRef(handleSubmitQuiz);
  useEffect(() => {
    timeoutRef.current = handleSubmitQuiz;
  });

  useEffect(() => {
    if (quizLoading || !quizData || !quizAttempt || submitted) {
      setQuizTimeLeft(null);
      return;
    }
    return startAssessmentCountdown(
      quizAttempt.started_at,
      quizData.time_limit_mins,
      setQuizTimeLeft,
      () => { void timeoutRef.current(true); },
    );
  }, [quizLoading, quizData, quizAttempt, submitted]);

  const formatTimeLeft = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  return (
    <div
      className="flex flex-col gap-md"
      style={{
        maxHeight: '400px',
        overflowY: 'auto',
        paddingRight: '4px',
        direction: 'rtl',
        textAlign: 'right'
      }}
    >
      {!user ? (
        <div className="text-center" style={{ padding: '40px 10px', color: 'rgb(var(--on-surface-variant))' }}>
          <span className="material-symbols-outlined" style={{ fontSize: '32px', marginBottom: '8px', color: 'rgb(var(--primary))' }}>lock</span>
          <p className="body-small" style={{ fontWeight: 'bold' }}>يجب تسجيل الدخول لحل الواجبات والاختبارات.</p>
        </div>
      ) : quizLoading ? (
        <div className="flex flex-col items-center justify-center" style={{ padding: '30px 0' }}>
          <span className="material-symbols-outlined animate-spin" style={{ fontSize: '24px', color: 'rgb(var(--primary))' }}>sync</span>
          <p className="body-small" style={{ marginTop: '8px', color: '#9ca3af' }}>جاري تحميل الأسئلة...</p>
        </div>
      ) : quizError && !quizData ? (
        <div style={{ textAlign: 'center', padding: '20px 10px', color: 'rgb(var(--error))' }}>
          <span className="material-symbols-outlined" style={{ fontSize: '24px', marginBottom: '8px' }}>warning</span>
          <p role="alert" className="body-small" style={{ fontWeight: 'bold' }}>{quizError}</p>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => fetchLessonQuiz(lessonId)}
            disabled={quizLoading}
            aria-label="إعادة محاولة تحميل الواجب"
            style={{ marginTop: '12px' }}
          >
            إعادة المحاولة
          </button>
        </div>
      ) : !quizData ? (
        <p className="body-small text-center" style={{ color: 'rgb(var(--on-surface-variant))', fontStyle: 'italic', padding: '20px 0' }}>
          لا يوجد واجب أو اختبار متاح لهذه المحاضرة حالياً.
        </p>
      ) : submitted ? (
        /* Show attempt result */
        <div className="flex flex-col gap-sm" style={{ padding: '10px', backgroundColor: 'rgba(var(--on-surface), 0.02)', borderRadius: '12px', border: '1px solid rgba(var(--on-surface), 0.05)' }}>
          <div className="flex items-center gap-sm" style={{ color: 'rgb(var(--success))', fontWeight: 'bold', fontSize: '13px' }}>
            <span className="icon">check_circle</span>
            <span>تم تسليم الحل بنجاح!</span>
          </div>

          <div className="flex justify-between items-center" style={{ marginTop: '10px', padding: '8px 12px', backgroundColor: 'rgb(var(--surface-container-low))', borderRadius: '8px', border: '1px solid rgb(var(--outline) / 0.1)' }}>
            <span style={{ fontSize: '11px', color: 'rgb(var(--on-surface-variant))' }}>درجتك في هذا الاختبار:</span>
            <span style={{ fontWeight: 'bold', color: 'rgb(var(--success))', fontSize: '15px' }}>
              {quizAttempt.score} / {quizData.max_score}
            </span>
          </div>

          <div className="space-y-3" style={{ marginTop: '15px' }}>
            <p style={{ fontSize: '11px', fontWeight: 'bold', color: 'rgb(var(--on-surface-variant))' }}>مراجعة إجاباتك:</p>
            {quizQuestionsList.map((q, idx) => {
              const studentAnswer = studentAnswers[q.id];
              return (
                <div key={q.id} className="p-3" style={{ backgroundColor: 'rgba(var(--on-surface), 0.01)', borderRadius: '8px', border: '1px solid rgba(var(--on-surface), 0.03)' }}>
                  <p style={{ fontSize: '11px', fontWeight: 'bold', color: 'rgb(var(--on-surface))' }}>س {idx + 1}: {q.question_text || '(سؤال بصورة)'}</p>
                  {q.image_url && <ZoomableImage src={q.image_url} alt="سؤال" style={{ maxWidth: '100%', maxHeight: '100px', objectFit: 'contain', marginTop: '6px' }} />}

                  <p style={{ fontSize: '11px', marginTop: '6px', color: studentAnswer === q.correct_option ? 'rgb(var(--success))' : (studentAnswer ? '#3b82f6' : 'rgb(var(--error))') }}>
                    <strong>إجابتك: </strong> {studentAnswer || 'لم يتم الحل'}
                  </p>
                  {studentAnswer !== q.correct_option && q.correct_option && (
                    <p style={{ fontSize: '11px', marginTop: '4px', color: 'rgb(var(--success))' }}>
                      <strong>الإجابة الصحيحة: </strong> {q.correct_option}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        /* Show Quiz Solver Form */
        <div className="flex flex-col gap-md">
          <div style={{ paddingBottom: '10px', borderBottom: '1px solid rgb(var(--outline) / 0.1)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h4 style={{ fontSize: '13px', fontWeight: 'bold', color: 'rgb(var(--on-surface))' }}>{quizData.title}</h4>
              <p style={{ fontSize: '11px', color: '#aaa', marginTop: '2px' }}>الدرجة الكلية: {quizData.max_score} درجة • الأسئلة: {quizQuestionsList.length}</p>
            </div>
            {quizTimeLeft !== null && (
              <div style={{ backgroundColor: 'rgba(var(--primary), 0.15)', border: '1px solid rgba(var(--primary), 0.3)', padding: '4px 8px', borderRadius: '8px', color: 'rgb(var(--primary))', fontSize: '12px', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <span className="material-symbols-outlined animate-pulse" style={{ fontSize: '16px' }}>timer</span>
                <span>{formatTimeLeft(quizTimeLeft)}</span>
              </div>
            )}
          </div>

          <div className="space-y-4" style={{ marginTop: '10px' }}>
            {quizQuestionsList.map((q, idx) => (
              <div key={q.id} className="p-3 flex flex-col gap-sm" style={{ backgroundColor: 'rgb(var(--surface-dim))', borderRadius: '8px', border: '1px solid rgb(var(--outline) / 0.08)' }}>
                <p style={{ fontSize: '11px', fontWeight: 'bold', color: 'rgb(var(--on-surface))' }}>س {idx + 1}: {q.question_text || '(انظر الصورة)'}</p>

                {q.image_url && (
                  <ZoomableImage src={q.image_url} alt="سؤال" style={{ maxWidth: '100%', maxHeight: '120px', objectFit: 'contain', marginTop: '6px', borderRadius: '4px' }} />
                )}

                <div className="flex flex-col gap-xs" style={{ marginTop: '8px' }}>
                  {q.options.map((opt: string, oIdx: number) => {
                    const isSelected = studentAnswers[q.id] === opt;
                    return (
                      <label
                        key={oIdx}
                        className="flex items-center gap-sm"
                        style={{
                          padding: '6px 8px',
                          borderRadius: '6px',
                          backgroundColor: isSelected ? 'rgba(var(--primary), 0.08)' : 'transparent',
                          border: isSelected ? '1px solid rgba(var(--primary), 0.2)' : '1px solid transparent',
                          cursor: 'pointer',
                          fontSize: '11px',
                          color: isSelected ? 'rgb(var(--primary))' : 'rgb(var(--on-surface))'
                        }}
                      >
                        <input
                          type="radio"
                          name={`question-${q.id}`}
                          checked={isSelected}
                          disabled={submittingQuiz}
                          onChange={() => {
                            setStudentAnswers({
                              ...studentAnswers,
                              [q.id]: opt
                            });
                          }}
                          style={{ accentColor: 'rgb(var(--primary))' }}
                        />
                        <span>{opt}</span>
                      </label>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>

          {quizError && (
            <p style={{ fontSize: '11px', color: 'rgb(var(--error))', marginTop: '8px' }}>{quizError}</p>
          )}

          {!showSubmitConfirm ? (
            <button
              className="btn btn-primary"
              onClick={() => setShowSubmitConfirm(true)}
              disabled={submittingQuiz || (quizTimeLeft !== 0 && Object.keys(studentAnswers).length === 0)}
              style={{
                width: '100%',
                marginTop: '15px',
                padding: '10px',
                fontSize: '11px',
                fontWeight: 'bold',
                backgroundColor: 'rgb(var(--primary))',
                color: '#fff',
                border: 'none',
                borderRadius: '8px',
                cursor: 'pointer'
              }}
            >
              تسليم إجابات الواجب
            </button>
          ) : (
            <div style={{ marginTop: '15px', padding: '10px', backgroundColor: 'rgba(var(--primary), 0.08)', border: '1px solid rgba(var(--primary), 0.2)', borderRadius: '8px', textAlign: 'center' }}>
              <p style={{ fontSize: '11px', color: 'rgb(var(--on-surface))', fontWeight: 'bold', marginBottom: '8px' }}>هل أنت متأكد من تسليم الإجابات؟ لا يمكن التعديل لاحقاً.</p>
              <div className="flex gap-xs justify-center">
                <button
                  className="btn btn-primary"
                  onClick={() => handleSubmitQuiz(false)}
                  disabled={submittingQuiz}
                  style={{ padding: '6px 12px', fontSize: '11px', backgroundColor: 'rgb(var(--primary))', borderRadius: '6px', minWidth: 0 }}
                >
                  {submittingQuiz ? 'جاري التسليم...' : 'تأكيد التسليم'}
                </button>
                <button
                  className="btn btn-secondary"
                  onClick={() => setShowSubmitConfirm(false)}
                  disabled={submittingQuiz}
                  style={{ padding: '6px 12px', fontSize: '11px', borderRadius: '6px', minWidth: 0 }}
                >
                  تراجع
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default QuizPanel;
