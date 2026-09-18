import { useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { ApiService } from '../../services/api';
import type { ConfirmDialogState, ShowToastFn } from './types';
import { clearExamDraft, isSubmittedAttempt, restoreExamAnswers, saveExamDraft } from './assessmentContract';

/**
 * Standalone exam-taking flow: opening an exam, answering, autosaving progress
 * to localStorage, and submitting (manually or via the modal's own timeout).
 * The countdown timer itself is owned by the ExamModal component.
 */
export function useExamFlow(
  showToast: ShowToastFn,
  loadData: () => Promise<void>,
  setConfirmDialog: (dialog: ConfirmDialogState | null) => void,
  setLoading: (v: boolean) => void,
) {
  const [selectedExam, setSelectedExam] = useState<any | null>(null);
  const [examQuestions, setExamQuestions] = useState<any[]>([]);
  const [examAttempt, setExamAttempt] = useState<any | null>(null);
  const [examAnswers, setExamAnswers] = useState<Record<string, string>>({});
  const [showExamModal, setShowExamModal] = useState(false);
  const [submittingExam, setSubmittingExam] = useState(false);
  const submissionLock = useRef(false);

  // Storage can be unavailable; keep the in-memory draft usable in that case.
  useEffect(() => {
    if (selectedExam && !isSubmittedAttempt(examAttempt) && Object.keys(examAnswers).length > 0) {
      saveExamDraft(selectedExam.id, examAnswers);
    }
  }, [examAnswers, selectedExam, examAttempt]);

  const handleOpenExam = async (examId: string) => {
    setLoading(true);
    try {
      const res = await ApiService.getExamDetails(examId);
      setSelectedExam(res.exam);
      setExamQuestions(res.questions || []);
      setExamAttempt(res.attempt || null);
      setExamAnswers(restoreExamAnswers(res.attempt, examId));
      submissionLock.current = false;
      setShowExamModal(true);
    } catch (err: any) {
      showToast('error', err.message || 'فشل تحميل تفاصيل الامتحان');
    } finally {
      setLoading(false);
    }
  };

  const resetExamModalState = () => {
    setShowExamModal(false);
    setSelectedExam(null);
    setExamQuestions([]);
    setExamAttempt(null);
    setExamAnswers({});
  };

  /** Close guard: the exam timer keeps running server-side, so warn before closing mid-exam */
  const handleCloseExamModal = () => {
    if (submissionLock.current) return;
    const inProgress = selectedExam && !isSubmittedAttempt(examAttempt) && examQuestions.length > 0;
    if (inProgress) {
      const saved = saveExamDraft(selectedExam.id, examAnswers);
      setConfirmDialog({
        show: true,
        title: 'إغلاق الامتحان مؤقتاً؟',
        message: saved
          ? 'إجاباتك محفوظة على هذا الجهاز ويمكنك المتابعة لاحقاً، لكن انتبه: مؤقت الامتحان يستمر في العد حتى أثناء الإغلاق.'
          : 'تعذّر حفظ إجاباتك على هذا الجهاز. إذا أغلقت الامتحان فقد تفقد إجاباتك، ومؤقت الامتحان يستمر في العد حتى أثناء الإغلاق.',
        confirmLabel: 'إغلاق ومتابعة لاحقاً',
        onConfirm: () => {
          if (submissionLock.current) return;
          setConfirmDialog(null);
          resetExamModalState();
        }
      });
      return;
    }
    resetExamModalState();
  };

  const handleSubmitExam = async (isTimeout = false) => {
    if (!selectedExam || isSubmittedAttempt(examAttempt) || submissionLock.current) return;
    submissionLock.current = true;
    setSubmittingExam(true);
    setConfirmDialog(null);
    try {
      const res = await ApiService.submitExamAnswers(selectedExam.id, examAnswers);
      clearExamDraft(selectedExam.id);
      if (isTimeout) {
        showToast('warning', 'انتهى الوقت', `انتهى الوقت المحدد للامتحان! تم تسليم إجاباتك تلقائياً. درجتك: ${res.score} / ${res.max_score}`);
      } else {
        showToast('success', 'تم تسليم الامتحان', `تم تسليم الامتحان بنجاح! درجتك: ${res.score} / ${res.max_score}`);
      }
      resetExamModalState();
      void loadData().catch(() => showToast('error', 'تم التسليم، لكن تعذّر تحديث قائمة الامتحانات'));
    } catch (err: any) {
      submissionLock.current = false;
      showToast('error', err.message || 'فشل تسليم الامتحان');
    } finally {
      setSubmittingExam(false);
    }
  };

  /** Manual submit with a warning when questions are still unanswered */
  const handleManualSubmitExam = (e: FormEvent) => {
    e.preventDefault();
    if (!selectedExam || isSubmittedAttempt(examAttempt) || submissionLock.current) return;
    const answeredCount = examQuestions.filter(q => examAnswers[q.id]).length;
    const unanswered = examQuestions.length - answeredCount;
    if (unanswered > 0) {
      setConfirmDialog({
        show: true,
        title: 'أسئلة بدون إجابة',
        message: `لديك ${unanswered} من الأسئلة لم تُجب عنها بعد. هل تريد تسليم الامتحان على أي حال؟`,
        confirmLabel: 'تسليم على أي حال',
        onConfirm: () => {
          setConfirmDialog(null);
          handleSubmitExam(false);
        }
      });
      return;
    }
    handleSubmitExam(false);
  };

  return {
    selectedExam,
    examQuestions,
    examAttempt,
    examAnswers,
    setExamAnswers,
    showExamModal,
    submittingExam,
    handleOpenExam,
    handleCloseExamModal,
    handleSubmitExam,
    handleManualSubmitExam,
  };
}
