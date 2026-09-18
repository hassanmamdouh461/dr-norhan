import { useEffect, useState } from 'react';
import { ApiService } from '../../services/api';
import { useAuth } from '../../context/AuthContext';

interface QaPanelProps {
  lessonId: string;
}

/**
 * Self-contained per-lesson Q&A panel (ask a question, list answers). Split
 * out of LessonPlayer and lazy-loaded only when the student opens the
 * "الاستفسارات" sidebar tab.
 */
export const QaPanel: React.FC<QaPanelProps> = ({ lessonId }) => {
  const { user } = useAuth();

  const [questions, setQuestions] = useState<any[]>([]);
  const [newQuestionBody, setNewQuestionBody] = useState('');
  const [submittingQuestion, setSubmittingQuestion] = useState(false);
  const [qaError, setQaError] = useState('');
  const [qaSuccess, setQaSuccess] = useState('');

  useEffect(() => {
    if (!user) {
      setQuestions([]);
      return;
    }
    ApiService.getQuestions({ lessonId })
      .then(res => setQuestions(res.questions || []))
      .catch(err => console.error('Failed to load lesson Q&A questions:', err));
  }, [lessonId, user]);

  const handlePostQuestion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newQuestionBody.trim() || newQuestionBody.trim().length < 5) {
      setQaError('يجب أن يحتوي السؤال على 5 أحرف على الأقل.');
      return;
    }

    // 30s hidden/inline rate limit check
    const lastSent = parseInt(localStorage.getItem('fusha_last_question_time') || '0');
    const now = Date.now();
    if (now - lastSent < 30000) {
      const remaining = Math.ceil((30000 - (now - lastSent)) / 1000);
      setQaError(`يرجى الانتظار ${remaining} ثانية قبل طرح سؤال آخر لتجنب الإرسال المتكرر.`);
      return;
    }

    setSubmittingQuestion(true);
    setQaError('');
    setQaSuccess('');
    try {
      await ApiService.askQuestion({
        body: newQuestionBody.trim(),
        lesson_id: lessonId,
      });
      setNewQuestionBody('');
      localStorage.setItem('fusha_last_question_time', Date.now().toString());

      const questionsRes = await ApiService.getQuestions({ lessonId });
      setQuestions(questionsRes.questions || []);
      setQaSuccess('تم إرسال سؤالك للمدرس بنجاح!');
      setTimeout(() => setQaSuccess(''), 5000);
    } catch (err: any) {
      setQaError(err.message || 'تعذر إرسال السؤال');
    } finally {
      setSubmittingQuestion(false);
    }
  };

  return (
    <div className="flex flex-col gap-md" style={{ overflowY: 'auto', maxHeight: '450px', paddingLeft: '4px' }}>
      {!user ? (
        <div className="text-center" style={{ padding: '40px 10px', color: 'rgb(var(--on-surface-variant))' }}>
          <span className="material-symbols-outlined" style={{ fontSize: '32px', marginBottom: '8px', color: 'rgb(var(--primary))' }}>lock</span>
          <p className="body-small" style={{ fontWeight: 'bold' }}>يجب تسجيل الدخول لطرح الأسئلة ومتابعة الاستفسارات.</p>
        </div>
      ) : (
        <>
          {/* Ask form */}
          <form onSubmit={handlePostQuestion} style={{ borderBottom: '1px solid rgb(var(--outline) / 0.1)', paddingBottom: '12px' }}>
            <div className="flex-col gap-xs">
              <span style={{ fontSize: '11px', fontWeight: 'bold', color: 'rgb(var(--on-surface))' }}>اطرح سؤالاً عن الشرح:</span>
              <div className="flex gap-sm">
                <input
                  type="text"
                  className="input-text"
                  placeholder="اكتب سؤالك هنا للأستاذ..."
                  value={newQuestionBody}
                  onChange={e => setNewQuestionBody(e.target.value)}
                  style={{ padding: '8px 12px', fontSize: '11px', borderRadius: '8px' }}
                  required
                />
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={submittingQuestion}
                  style={{ padding: '8px 12px', fontSize: '11px', borderRadius: '8px', minWidth: 0 }}
                >
                  {submittingQuestion ? '..' : 'إرسال'}
                </button>
              </div>
              {qaError && (
                <p style={{ fontSize: '11px', color: 'rgb(var(--error))', marginTop: '6px', fontWeight: 'bold', textAlign: 'right' }}>{qaError}</p>
              )}
              {qaSuccess && (
                <p style={{ fontSize: '11px', color: 'rgb(var(--success))', marginTop: '6px', fontWeight: 'bold', textAlign: 'right' }}>{qaSuccess}</p>
              )}
            </div>
          </form>

          {/* Questions list */}
          {questions.length === 0 ? (
            <p className="body-small text-center" style={{ color: 'rgb(var(--on-surface-variant))', fontStyle: 'italic', padding: '20px 0' }}>لا توجد استفسارات سابقة. كن أول من يسأل!</p>
          ) : (
            <div className="flex flex-col gap-sm">
              {questions.map(q => (
                <div
                  key={q.id}
                  className="flex-col"
                  style={{
                    padding: '10px',
                    borderRadius: '8px',
                    backgroundColor: 'rgb(var(--surface-dim))',
                    borderRight: q.status === 'answered' ? '3px solid rgb(var(--success))' : '3px solid rgb(var(--primary))',
                  }}
                >
                  <div className="flex justify-between items-center" style={{ marginBottom: '6px' }}>
                    <span style={{ fontWeight: 'bold', fontSize: '11px', color: 'rgb(var(--on-surface-variant))' }}>سؤال طالب</span>
                    <span className={`badge ${q.status === 'answered' ? 'badge-success' : 'badge-primary'}`} style={{ fontSize: '8px', padding: '1px 4px' }}>
                      {q.status === 'answered' ? 'تمت الإجابة' : 'قيد الانتظار'}
                    </span>
                  </div>
                  <p className="body-small" style={{ color: 'rgb(var(--on-surface))', fontSize: '11px', lineHeight: '1.5' }}>{q.body}</p>

                  {/* Answer */}
                  {q.status === 'answered' && q.answers && q.answers.length > 0 && (
                    <div style={{ marginTop: '8px', padding: '6px 8px', borderRight: '2px solid rgb(var(--primary))', backgroundColor: 'rgb(var(--surface-container-high))', borderRadius: '4px' }}>
                      {q.answers.map((ans: any) => (
                        <div key={ans.id}>
                          <span style={{ fontWeight: 'bold', fontSize: '11px', color: 'rgb(var(--primary))' }}>{ans.author_name} (الإدارة):</span>
                          <p className="body-small" style={{ fontSize: '11px', color: 'rgb(var(--on-surface-variant))', marginTop: '1px' }}>{ans.body}</p>
                          {ans.image_url && (
                            <div style={{ marginTop: '6px' }}>
                              <img 
                                src={ans.image_url} 
                                alt="مرفق الإجابة" 
                                style={{ maxWidth: '100%', maxHeight: '180px', borderRadius: '6px', cursor: 'pointer', objectFit: 'contain' }}
                                onClick={() => window.open(ans.image_url, '_blank')}
                              />
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default QaPanel;
