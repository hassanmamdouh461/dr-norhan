import type { FC } from 'react';
import { SkeletonQuestionCard } from '../../../components/Skeleton';
import { GuidedTour, type TourStep } from '../../../components/GuidedTour';

const QA_TOUR_STEPS: TourStep[] = [
  { selector: '[data-tour="tour-qa-ask"]', title: 'اطرح سؤالك', text: 'اضغط هنا لطرح سؤال جديد على المدرس، وستصلك إشعار فور الرد عليك.' },
  { selector: '[data-tour="tour-qa-filters"]', title: 'البحث والتصفية', text: 'ابحث في أسئلتك السابقة أو صفِّها حسب حالة الإجابة لمتابعة ما ينتظر رد.' },
];

interface QaTabProps {
  loading: boolean;
  loadError?: boolean;
  questions: any[];
  filteredQuestions: any[];
  loadData: () => Promise<void>;
  qaSearch: string;
  setQaSearch: (v: string) => void;
  qaFilter: 'all' | 'answered' | 'pending';
  setQaFilter: (v: 'all' | 'answered' | 'pending') => void;
  setShowAskModal: (v: boolean) => void;
  handleOpenQuestionDetails: (id: string) => void;
}

/** Q&A tab: search/filter over the student's asked questions. */
export const QaTab: FC<QaTabProps> = ({
  loading,
  loadError,
  questions,
  filteredQuestions,
  loadData,
  qaSearch,
  setQaSearch,
  qaFilter,
  setQaFilter,
  setShowAskModal,
  handleOpenQuestionDetails,
}) => {
  return (
    <div className="flex flex-col gap-lg">
      {/* Header section */}
      <div className="flex justify-between items-center flex-wrap gap-md" style={{ borderBottom: '1px solid rgb(var(--outline-variant) / 0.1)', paddingBottom: '20px' }}>
        <div>
          <h2 className="title-medium" style={{ color: 'rgb(var(--on-background))', fontWeight: '800', marginBottom: '6px' }}>منتدى الأسئلة والاستفسارات 💬</h2>
          <p className="body-medium" style={{ color: 'rgb(var(--on-surface-variant))', fontSize: '13px' }}>
            اطرح أسئلتك بخصوص المنهج وسيجيبك الأستاذ المساعد وطاقم العمل في أسرع وقت.
          </p>
        </div>
        <div className="flex gap-sm qa-header-actions" style={{ display: 'flex', gap: '10px' }}>
          <button
            onClick={() => loadData()}
            className="btn flex items-center gap-xs"
            style={{
              padding: '8px 16px',
              fontSize: '13px',
              backgroundColor: 'rgb(var(--surface-container-low))',
              border: '1px solid rgb(var(--outline-variant) / 0.15)',
              borderRadius: '10px',
              color: 'rgb(var(--on-surface))',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
            title="تحديث البيانات"
          >
            <span className="icon" style={{ fontSize: '16px' }}>refresh</span>
            تحديث
          </button>
          <button className="btn btn-primary" onClick={() => setShowAskModal(true)} style={{ borderRadius: '10px', boxShadow: '0 4px 15px rgba(var(--primary), 0.3)' }} data-tour="tour-qa-ask">
            <span className="icon" style={{ marginLeft: '6px' }}>add</span>
            طرح سؤال جديد
          </button>
        </div>
      </div>

      {/* Search & Filter Bar */}
      <div className="flex gap-md flex-wrap" style={{ width: '100%' }} data-tour="tour-qa-filters">
        {/* Search */}
        <div className="form-group flex-1" style={{ minWidth: '260px' }}>
          <div style={{ position: 'relative', width: '100%' }}>
            <input
              type="text"
              className="input-text"
              placeholder="ابحث عن سؤال، درس، أو كلمة مفتاحية..."
              value={qaSearch}
              onChange={e => setQaSearch(e.target.value)}
              style={{ paddingRight: '40px', borderRadius: '10px', backgroundColor: 'rgb(var(--surface-container-low))', border: '1px solid rgb(var(--outline-variant) / 0.15)', color: 'rgb(var(--on-surface))' }}
            />
            <span className="icon" style={{ position: 'absolute', right: '14px', top: '50%', transform: 'translateY(-50%)', color: 'rgb(var(--on-surface-variant))' }}>search</span>
          </div>
        </div>

        {/* Status Filters */}
        <div className="flex gap-xs qa-status-filters" style={{ backgroundColor: 'rgb(var(--surface-container-low))', padding: '4px', borderRadius: '10px', border: '1px solid rgb(var(--outline-variant) / 0.15)' }}>
          {[
            { id: 'all', label: 'الكل' },
            { id: 'answered', label: 'تمت الإجابة' },
            { id: 'pending', label: 'قيد الانتظار' }
          ].map(filter => (
            <button
              key={filter.id}
              onClick={() => setQaFilter(filter.id as any)}
              className="btn"
              style={{
                padding: '8px 16px',
                fontSize: '12px',
                borderRadius: '8px',
                border: 'none',
                backgroundColor: qaFilter === filter.id ? 'rgb(var(--primary))' : 'transparent',
                color: qaFilter === filter.id ? '#fff' : 'rgb(var(--on-surface-variant))',
                fontWeight: qaFilter === filter.id ? 'bold' : 'normal',
                minWidth: 0,
                transition: 'all 0.2s'
              }}
            >
              {filter.label}
            </button>
          ))}
        </div>
      </div>

      {/* Questions List */}
      {loading && questions.length === 0 ? (
        <div className="grid-2 gap-md">
          <SkeletonQuestionCard />
          <SkeletonQuestionCard />
          <SkeletonQuestionCard />
          <SkeletonQuestionCard />
        </div>
      ) : loadError && questions.length === 0 ? (
        <div className="card text-center" style={{ padding: '40px' }}>
          <span className="icon" style={{ fontSize: '42px', color: 'rgb(var(--error))', marginBottom: '12px' }}>wifi_off</span>
          <p className="body-medium" style={{ fontWeight: 'bold', marginBottom: '16px' }}>تعذر تحميل الاستفسارات. تحقق من اتصالك بالإنترنت.</p>
          <button className="btn btn-primary" onClick={() => loadData()}>إعادة المحاولة</button>
        </div>
      ) : filteredQuestions.length === 0 ? (
        <div className="card flex flex-col items-center justify-center text-center" style={{ padding: '60px 20px', backgroundColor: 'rgb(var(--surface-container-low))', border: '1px solid rgb(var(--outline-variant) / 0.15)' }}>
          <span className="icon text-primary animate-float" style={{ fontSize: '48px', color: 'rgb(var(--primary))', marginBottom: '16px' }}>forum</span>
          <h4 className="title-small" style={{ marginBottom: '8px', color: 'rgb(var(--on-surface))' }}>لم يتم العثور على استفسارات</h4>
          <p className="body-medium" style={{ color: 'rgb(var(--on-surface-variant))', maxWidth: '400px', margin: '0 auto 20px' }}>
            {qaSearch ? 'لا توجد نتائج تطابق بحثك الحالي، جرب كلمات أخرى.' : 'كن أول من يطرح سؤالاً في هذا القسم وسنجيبك بالتفصيل!'}
          </p>
          {!qaSearch && (
            <button className="btn btn-secondary" onClick={() => setShowAskModal(true)}>
              طرح سؤال الآن
            </button>
          )}
        </div>
      ) : (
        <div className="grid-2 gap-md" style={{ alignItems: 'stretch' }}>
          {filteredQuestions.map(q => {
            return (
              <div
                key={q.id}
                className={`premium-qa-card ${q.status === 'answered' ? 'status-answered' : 'status-pending'}`}
                onClick={() => handleOpenQuestionDetails(q.id)}
              >
                <div>
                  {/* Header: Date + Status Badge */}
                  <div className="flex justify-between items-center" style={{ marginBottom: '12px', flexWrap: 'wrap', gap: '8px' }}>
                    <div className="flex items-center gap-xs">
                      <span className="icon" style={{ fontSize: '14px', color: 'rgb(var(--on-surface-variant))' }}>schedule</span>
                      <span className="body-small" style={{ color: 'rgb(var(--on-surface-variant))', fontSize: '11px' }}>
                        {new Date(q.created_at).toLocaleDateString('ar-EG', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </span>
                    </div>
                    <span
                      className="badge"
                      style={{
                        backgroundColor: q.status === 'answered' ? 'rgb(var(--success) / 0.12)' : 'rgb(var(--warning) / 0.12)',
                        color: q.status === 'answered' ? 'rgb(var(--success))' : 'rgb(var(--warning))',
                        border: q.status === 'answered' ? '1px solid rgb(var(--success) / 0.2)' : '1px solid rgb(var(--warning) / 0.2)',
                        fontSize: '11px',
                        padding: '4px 10px',
                        borderRadius: '20px',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '2px'
                      }}
                    >
                      <span className={`status-dot ${q.status === 'answered' ? 'answered' : 'pending'}`} />
                      <span>{q.status === 'answered' ? 'تمت الإجابة' : 'قيد الانتظار'}</span>
                    </span>
                  </div>

                  {/* Lesson Title Context Badge */}
                  {q.lesson_title && (
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', backgroundColor: 'rgba(var(--primary), 0.05)', padding: '4px 8px', borderRadius: '6px', marginBottom: '12px', border: '1px solid rgb(var(--outline) / 0.15)' }}>
                      <span className="icon" style={{ fontSize: '12px', color: 'rgb(var(--primary))' }}>play_circle</span>
                      <span style={{ fontSize: '11px', color: 'rgb(var(--on-surface-variant))', fontWeight: 'bold' }}>درس: {q.lesson_title}</span>
                    </div>
                  )}

                  <p className="body-medium text-clamp-3" style={{ fontWeight: '700', lineHeight: '1.6', color: 'rgb(var(--on-surface))', fontSize: '14px', marginBottom: '16px' }}>
                    {q.body}
                  </p>
                </div>

                {/* Footer Actions */}
                <div className="flex justify-between items-center" style={{ borderTop: '1px solid rgb(var(--outline-variant) / 0.1)', paddingTop: '14px', marginTop: 'auto' }}>
                  <span style={{ color: 'rgb(var(--primary))', fontSize: '12px', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    عرض التفاصيل والردود
                    <span className="icon" aria-hidden="true" style={{ fontSize: '14px' }}>arrow_back</span>
                  </span>

                  <div className="flex items-center gap-xs" style={{ color: 'rgb(var(--on-surface-variant))', fontSize: '12px' }}>
                    <span className="icon" style={{ fontSize: '16px' }}>forum</span>
                    <span style={{ fontWeight: '500' }}>{q.answers_count || 0} ردود</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <GuidedTour steps={QA_TOUR_STEPS} storageKey="qa_tab_tour_seen_v1" active={!loading} />
    </div>
  );
};
