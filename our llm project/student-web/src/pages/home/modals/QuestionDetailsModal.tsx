import type { FC } from 'react';
import Modal from '../../../components/ui/Modal';

interface QuestionDetailsModalProps {
  selectedQuestion: any;
  onClose: () => void;
}

/** Shows a single question's body plus the teacher/assistant answers thread. */
export const QuestionDetailsModal: FC<QuestionDetailsModalProps> = ({ selectedQuestion, onClose }) => {
  return (
    <Modal ariaLabel="تفاصيل السؤال والردود" onClose={onClose} contentStyle={{ padding: '24px', maxWidth: '600px' }}>
      <div className="flex justify-between items-center" style={{ marginBottom: '20px', borderBottom: '1px solid rgb(var(--outline))', paddingBottom: '12px' }}>
        <h3 className="title-small">تفاصيل السؤال والردود</h3>
        <button
          className="btn btn-secondary"
          style={{ padding: '6px 12px', minWidth: 0 }}
          onClick={onClose}
        >
          إغلاق
        </button>
      </div>

      <div style={{ marginBottom: '20px' }}>
        <div className="flex gap-sm items-center" style={{ marginBottom: '8px' }}>
          <span className="icon" style={{ color: 'rgb(var(--primary))' }}>help_outline</span>
          <span style={{ fontWeight: 'bold' }}>سؤالك:</span>
        </div>
        <p className="card-flat body-medium" style={{ backgroundColor: 'rgb(var(--surface-container-low))' }}>{selectedQuestion.question?.body}</p>
      </div>

      <div>
        <h4 style={{ fontSize: '13px', marginBottom: '12px', color: 'rgb(var(--on-surface-variant))' }}>ردود الأستاذ والمساعدين:</h4>
        {selectedQuestion.answers?.length === 0 ? (
          <p className="body-small" style={{ color: 'rgb(var(--on-surface-variant))', fontStyle: 'italic' }}>لا توجد ردود بعد. يرجى الانتظار حتى يقوم الأستاذ أو مساعدوه بالرد.</p>
        ) : (
          <div className="flex flex-col gap-sm">
            {selectedQuestion.answers?.map((ans: any) => (
              <div key={ans.id} className="card-flat" style={{ borderRight: '3px solid rgb(var(--primary))' }}>
                <div className="flex justify-between items-center" style={{ marginBottom: '4px' }}>
                  <span style={{ fontWeight: 'bold', fontSize: '12px', color: 'rgb(var(--primary))' }}>{ans.author_name} (إدارة المنصة)</span>
                  <span style={{ fontSize: '11px' }}>{new Date(ans.created_at).toLocaleDateString('ar-EG')}</span>
                </div>
                <p className="body-medium" style={{ whiteSpace: 'pre-line' }}>{ans.body}</p>
                {ans.image_url && (
                  <div style={{ marginTop: '8px' }}>
                    <img 
                      src={ans.image_url} 
                      alt="مرفق الإجابة" 
                      style={{ maxWidth: '100%', maxHeight: '300px', borderRadius: '8px', cursor: 'pointer', objectFit: 'contain' }}
                      onClick={() => window.open(ans.image_url, '_blank')}
                    />
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </Modal>
  );
};
