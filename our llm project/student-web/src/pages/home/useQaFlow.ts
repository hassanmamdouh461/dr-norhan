import { useState } from 'react';
import type { FormEvent } from 'react';
import { ApiService } from '../../services/api';
import type { ShowToastFn } from './types';

/** Q&A tab + "ask a question" / "question details" modals state and handlers. */
export function useQaFlow(questions: any[], loadData: () => Promise<void>, showToast: ShowToastFn) {
  const [qaSearch, setQaSearch] = useState('');
  const [qaFilter, setQaFilter] = useState<'all' | 'answered' | 'pending'>('all');

  const [showAskModal, setShowAskModal] = useState(false);
  const [questionBody, setQuestionBody] = useState('');
  const [selectedQuestion, setSelectedQuestion] = useState<any | null>(null);

  const filteredQuestions = questions.filter(q => {
    const matchesSearch = q.body.toLowerCase().includes(qaSearch.toLowerCase()) ||
                          (q.lesson_title && q.lesson_title.toLowerCase().includes(qaSearch.toLowerCase()));

    if (qaFilter === 'answered') {
      return matchesSearch && q.status === 'answered';
    }
    if (qaFilter === 'pending') {
      return matchesSearch && q.status !== 'answered';
    }
    return matchesSearch;
  });

  const handleAskQuestion = async (e: FormEvent) => {
    e.preventDefault();
    if (!questionBody.trim() || questionBody.trim().length < 5) {
      showToast('warning', 'تنبيه', 'يرجى كتابة سؤال صحيح (5 أحرف على الأقل)');
      return;
    }
    try {
      await ApiService.askQuestion({
        body: questionBody.trim(),
      });
      showToast('success', 'تم إرسال سؤالك بنجاح.');
      setQuestionBody('');
      setShowAskModal(false);
      loadData();
    } catch (err: any) {
      showToast('error', err.message || 'تعذر إرسال السؤال');
    }
  };

  const handleOpenQuestionDetails = async (id: string) => {
    try {
      const res = await ApiService.getQuestionDetails(id);
      setSelectedQuestion(res);
    } catch (err: any) {
      showToast('error', err.message || 'تعذر تحميل إجابات السؤال');
    }
  };

  return {
    qaSearch,
    setQaSearch,
    qaFilter,
    setQaFilter,
    filteredQuestions,
    showAskModal,
    setShowAskModal,
    questionBody,
    setQuestionBody,
    selectedQuestion,
    setSelectedQuestion,
    handleAskQuestion,
    handleOpenQuestionDetails,
  };
}
