import { useEffect, useRef, useState } from 'react';
import type { FC, FormEvent } from 'react';
import Modal from '../../../components/ui/Modal';
import ZoomableImage from '../../../components/ZoomableImage';
import { isSubmittedAttempt, startAssessmentCountdown } from '../assessmentContract';

interface ExamModalProps {
  selectedExam: any;
  examQuestions: any[];
  examAttempt: any | null;
  examAnswers: Record<string, string>;
  setExamAnswers: (updater: (prev: Record<string, string>) => Record<string, string>) => void;
  submittingExam: boolean;
  onClose: () => void;
  onManualSubmit: (e: FormEvent) => void;
  onTimeout: () => void;
}

const formatTimeLeft = (seconds: number) => {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
};

/** Standalone exam solver/viewer modal. Owns its own countdown timer. */
export const ExamModal: FC<ExamModalProps> = ({
  selectedExam,
  examQuestions,
  examAttempt,
  examAnswers,
  setExamAnswers,
  submittingExam,
  onClose,
  onManualSubmit,
  onTimeout,
}) => {
  const [examTimeLeft, setExamTimeLeft] = useState<number | null>(null);
  const submitted = isSubmittedAttempt(examAttempt);
  const timeoutRef = useRef(onTimeout);

  useEffect(() => {
    timeoutRef.current = onTimeout;
  }, [onTimeout]);

  useEffect(() => {
    if (!selectedExam || !examAttempt || submitted) {
      setExamTimeLeft(null);
      return;
    }
    return startAssessmentCountdown(
      examAttempt.started_at,
      selectedExam.time_limit_mins,
      setExamTimeLeft,
      () => timeoutRef.current(),
    );
  }, [selectedExam, examAttempt, submitted]);

  return (
    <Modal
      ariaLabel={`امتحان: ${selectedExam.title}`}
      onClose={onClose}
      contentStyle={{ padding: 0, maxWidth: '700px', width: '90%', maxHeight: '85vh', overflowY: 'auto', borderRadius: '16px' }}
    >
      {/* Sticky header keeps the timer and progress visible while scrolling */}
      <div
        className="flex justify-between items-center"
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 5,
          backgroundColor: 'rgb(var(--surface))',
          borderBottom: '1px solid rgb(var(--outline-variant) / 0.15)',
          padding: '16px 24px',
          flexWrap: 'wrap',
          gap: '10px'
        }}
      >
        <div>
          <h3 className="title-small" style={{ color: 'rgb(var(--on-surface))', fontWeight: '800' }}>{selectedExam.title}</h3>
          <p style={{ fontSize: '11px', color: 'rgb(var(--on-surface-variant))', marginTop: '4px' }}>
            الدرجة الكلية: {selectedExam.max_score} درجة • عدد الأسئلة: {examQuestions.length}
          </p>
        </div>
        <div className="flex items-center gap-sm" style={{ flexWrap: 'wrap' }}>
          {!submitted && examQuestions.length > 0 && (
            <div style={{ backgroundColor: 'rgba(var(--on-surface), 0.05)', border: '1px solid rgba(var(--on-surface), 0.08)', padding: '6px 12px', borderRadius: '10px', color: 'rgb(var(--on-surface))', fontSize: '12px', fontWeight: 'bold' }}>
              أجبت {examQuestions.filter(q => examAnswers[q.id]).length} من {examQuestions.length}
            </div>
          )}
          {!submitted && examTimeLeft !== null && (
            <div style={{ backgroundColor: 'rgba(var(--primary), 0.15)', border: '1px solid rgba(var(--primary), 0.3)', padding: '6px 12px', borderRadius: '10px', color: 'rgb(var(--primary))', fontSize: '13px', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>timer</span>
              <span>{formatTimeLeft(examTimeLeft)}</span>
            </div>
          )}
          <button
            className="btn btn-secondary"
            style={{ padding: '6px 12px', minWidth: 0, borderRadius: '8px' }}
            onClick={onClose}
            disabled={submittingExam}
          >
            إغلاق
          </button>
        </div>
      </div>

      <div style={{ padding: '20px 24px' }}>

      {submitted ? (
        // View Graded Exam (Already Submitted)
        <div className="flex flex-col gap-lg">
          <div style={{ backgroundColor: 'rgba(16, 185, 129, 0.08)', border: '1px solid rgba(16, 185, 129, 0.2)', padding: '16px', borderRadius: '12px', textAlign: 'center', marginBottom: '10px' }}>
            <p style={{ fontSize: '14px', color: 'rgb(var(--success))', fontWeight: 'bold' }}>لقد قمت بحل هذا الامتحان مسبقاً</p>
            <p style={{ fontSize: '20px', fontWeight: '800', color: 'rgb(var(--on-surface))', marginTop: '6px' }}>
              درجتك: {examAttempt.score} / {selectedExam.max_score}
            </p>
            <span style={{ fontSize: '11px', color: 'rgb(var(--on-surface-variant))', display: 'block', marginTop: '4px' }}>
              تاريخ التسليم: {new Date(examAttempt.submitted_at).toLocaleString('ar-EG')}
            </span>
          </div>

          <div className="flex flex-col gap-md">
            {examQuestions.map((q, idx) => {
              const studentChoice = examAnswers[q.id] || '';
              return (
                <div key={q.id} style={{ padding: '16px', backgroundColor: 'rgba(var(--on-surface), 0.03)', border: '1px solid rgba(var(--on-surface), 0.06)', borderRadius: '12px' }}>
                  <p style={{ fontSize: '14px', fontWeight: 'bold', color: 'rgb(var(--on-surface))', marginBottom: '12px' }}>
                    {idx + 1}. {q.question_text || '(انظر الصورة)'}
                  </p>
                  {q.image_url && (
                    <ZoomableImage src={q.image_url} alt="سؤال" style={{ maxWidth: '100%', maxHeight: '200px', borderRadius: '8px', marginBottom: '12px', objectFit: 'contain' }} />
                  )}
                  <div className="grid-2 gap-sm">
                    {q.options?.map((opt: string) => {
                      const isSelected = studentChoice === opt;
                      return (
                        <div
                          key={opt}
                          style={{
                            padding: '10px 14px',
                            borderRadius: '8px',
                            fontSize: '13px',
                            backgroundColor: isSelected ? 'rgba(var(--primary), 0.12)' : 'rgba(var(--on-surface), 0.02)',
                            border: isSelected ? '1px solid rgba(var(--primary), 0.3)' : '1px solid rgba(var(--on-surface), 0.06)',
                            color: isSelected ? 'rgb(var(--primary))' : 'rgb(var(--on-surface-variant))',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px'
                          }}
                        >
                          <span className="icon" style={{ fontSize: '16px' }}>{isSelected ? 'radio_button_checked' : 'radio_button_unchecked'}</span>
                          {opt}
                        </div>
                      );
                    })}
                  </div>
                  <p style={{ fontSize: '12px', marginTop: '12px', color: studentChoice === q.correct_option ? 'rgb(var(--success))' : (studentChoice ? 'rgb(var(--error))' : 'rgb(var(--error))') }}>
                    <strong>إجابتك: </strong> {studentChoice || 'لم يتم الحل'}
                  </p>
                  {studentChoice !== q.correct_option && q.correct_option && (
                    <p style={{ fontSize: '12px', marginTop: '4px', color: 'rgb(var(--success))' }}>
                      <strong>الإجابة الصحيحة: </strong> {q.correct_option}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        // Solve Exam Form
        <form onSubmit={onManualSubmit} className="flex flex-col gap-lg">
          <div className="flex flex-col gap-md">
            {examQuestions.map((q, idx) => (
              <div key={q.id} style={{ padding: '20px', backgroundColor: 'rgba(var(--on-surface), 0.03)', border: '1px solid rgba(var(--on-surface), 0.06)', borderRadius: '12px' }}>
                <p style={{ fontSize: '14px', fontWeight: 'bold', color: 'rgb(var(--on-surface))', marginBottom: '12px' }}>
                  {idx + 1}. {q.question_text || '(انظر الصورة)'}
                </p>
                {q.image_url && (
                  <ZoomableImage src={q.image_url} alt="سؤال" style={{ maxWidth: '100%', maxHeight: '200px', borderRadius: '8px', marginBottom: '12px', objectFit: 'contain' }} />
                )}
                <div className="grid-2 gap-sm">
                  {q.options?.map((opt: string) => {
                    const isSelected = examAnswers[q.id] === opt;
                    return (
                      <button
                        type="button"
                        key={opt}
                        disabled={submittingExam}
                        onClick={() => setExamAnswers(prev => ({ ...prev, [q.id]: opt }))}
                        style={{
                          padding: '12px 16px',
                          borderRadius: '8px',
                          fontSize: '13px',
                          textAlign: 'right',
                          backgroundColor: isSelected ? 'rgba(var(--primary), 0.1)' : 'rgba(var(--on-surface), 0.02)',
                          border: isSelected ? '1px solid rgb(var(--primary))' : '1px solid rgba(var(--on-surface), 0.08)',
                          color: 'rgb(var(--on-surface))',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px',
                          transition: 'all 0.2s ease'
                        }}
                      >
                        <span className="icon" style={{ fontSize: '16px', color: isSelected ? 'rgb(var(--primary))' : 'rgb(var(--on-surface-variant))' }}>{isSelected ? 'radio_button_checked' : 'radio_button_unchecked'}</span>
                        {opt}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>

          <div style={{ borderTop: '1px solid rgb(var(--outline-variant) / 0.15)', paddingTop: '20px', display: 'flex', gap: '12px' }}>
            <button type="submit" className="btn btn-primary flex-1" disabled={submittingExam || examQuestions.length === 0} style={{ padding: '12px', borderRadius: '10px', fontWeight: 'bold' }}>
              {submittingExam ? 'جاري تصحيح وتسليم الامتحان...' : 'تسليم الامتحان الآن'}
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={onClose}
              disabled={submittingExam}
              style={{ borderRadius: '10px' }}
            >
              إلغاء
            </button>
          </div>
        </form>
      )}
      </div>
    </Modal>
  );
};
