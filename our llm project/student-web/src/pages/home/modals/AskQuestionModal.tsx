import type { FC, FormEvent } from 'react';
import Modal from '../../../components/ui/Modal';

interface AskQuestionModalProps {
  questionBody: string;
  setQuestionBody: (v: string) => void;
  handleAskQuestion: (e: FormEvent) => void;
  onClose: () => void;
}

/** "Ask a new question" modal for the Q&A tab. */
export const AskQuestionModal: FC<AskQuestionModalProps> = ({ questionBody, setQuestionBody, handleAskQuestion, onClose }) => {
  return (
    <Modal ariaLabel="طرح سؤال جديد" onClose={onClose} contentStyle={{ padding: '24px' }}>
      <h3 className="title-small" style={{ marginBottom: '16px' }}>طرح سؤال جديد</h3>
      <form onSubmit={handleAskQuestion} className="flex flex-col">
        <div className="form-group" style={{ marginBottom: '20px' }}>
          <label className="form-label">اكتب سؤالك بوضوح</label>
          <textarea
            className="input-text"
            style={{ height: '120px', paddingRight: '16px', resize: 'none' }}
            placeholder="مثال: ما الفرق بين الحال والتمييز؟ وكيف أفرّق بينهما في الإعراب؟"
            value={questionBody}
            onChange={e => setQuestionBody(e.target.value)}
            required
          />
        </div>
        <div className="flex gap-md">
          <button type="submit" className="btn btn-primary flex-1">إرسال السؤال</button>
          <button type="button" className="btn btn-secondary" onClick={onClose}>إلغاء</button>
        </div>
      </form>
    </Modal>
  );
};
