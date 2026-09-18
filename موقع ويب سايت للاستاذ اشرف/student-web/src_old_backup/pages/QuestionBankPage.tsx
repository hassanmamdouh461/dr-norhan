import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ApiService } from '../services/api';
import './QuestionBank.css';

// ══════════════════════════════════════════════════════════════════
// بنك الأسئلة — تصفّح + وضع التدريب (واجهة الطالب)
//
// الأمان: واجهة الطالب تقرأ من /question-bank/public/* المحجوبة الإجابات،
// فلا يصل مفتاح الإجابة ولا الشرح إلى المتصفح إلا بعد محاولة، عبر
// POST /question-bank/public/check. لذلك لا يُصحَّح أي سؤال في العميل.
//
// كل النصوص عربية، كل الاتجاهات منطقية (RTL)، وكل الألوان من منظومة
// فُصحى عبر متغيّرات RGB: rgb(var(--token))
// ══════════════════════════════════════════════════════════════════

const PAGE_SIZE = 12;
const RING_RADIUS = 52;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;

const TYPE_FILTERS = [
  { value: 'mcq', label: 'اختيار من متعدد' },
  { value: 'true_false', label: 'صح أو خطأ' },
  { value: 'short_answer', label: 'إجابة قصيرة' },
  { value: 'essay', label: 'سؤال مقالي' },
  { value: 'matching', label: 'توصيل' },
  { value: 'fill_blank', label: 'أكمل الفراغ' },
  { value: 'ordering', label: 'ترتيب' },
  { value: 'poetry_analysis', label: 'تحليل شعري' },
];

const TYPE_LABEL: Record<string, string> = TYPE_FILTERS.reduce<Record<string, string>>(
  (acc, t) => {
    acc[t.value] = t.label;
    return acc;
  },
  {}
);

const DIFFICULTY_FILTERS = [
  { value: 'easy', label: 'سهل' },
  { value: 'medium', label: 'متوسط' },
  { value: 'hard', label: 'صعب' },
];

const DIFFICULTY_LABEL: Record<string, string> = {
  easy: 'سهل',
  medium: 'متوسط',
  hard: 'صعب',
};

/** شريحة الحالة المناسبة لكل مستوى صعوبة: سهل → نجاح، متوسط → تحذير، صعب → خطأ. */
const DIFFICULTY_CLASS: Record<string, string> = {
  easy: 'qb-badge--success',
  medium: 'qb-badge--warning',
  hard: 'qb-badge--error',
};

/** أنواع نثق في تصحيحها آلياً؛ ما عداها يُعرض للمقارنة الذاتية. */
const AUTO_GRADED_TYPES = ['mcq', 'true_false', 'short_answer', 'fill_blank'];

const COUNT_OPTIONS = [5, 10, 20];

const AR_LETTERS = ['أ', 'ب', 'ج', 'د', 'ه', 'و', 'ز', 'ح', 'ط', 'ي'];

// ── Types ────────────────────────────────────────────────────────────
export interface BankQuestion {
  id: string;
  type: string;
  difficulty: string;
  question_text: string;
  image_url: string | null;
  options: string[] | null;
  points: number;
  tags: string[];
  source: string | null;
  /** يُملأ فقط بعد تصحيح الخادم — لا يأتي من واجهة التصفّح أبداً. */
  correct_answer?: unknown;
  explanation?: string | null;
}

type AnswerValue =
  | { kind: 'choice'; index: number }
  | { kind: 'text'; text: string }
  | { kind: 'order'; order: number[] };

type Grade = 'correct' | 'wrong' | 'review';

interface CheckResult {
  correct: boolean | null;
  correctAnswer: unknown;
  explanation: string | null;
  message?: string;
  error?: string;
}

export interface QuestionBankPageProps {
  onBack?: () => void;
}

// ── Helpers ──────────────────────────────────────────────────────────
function parseJsonField<T>(raw: unknown, fallback: T): T {
  if (raw === null || raw === undefined) return fallback;
  if (typeof raw === 'string') {
    try {
      return JSON.parse(raw) as T;
    } catch {
      return fallback;
    }
  }
  return raw as T;
}

function normalizeQuestion(raw: any): BankQuestion {
  const tags = parseJsonField<string[] | null>(raw?.tags ?? raw?.tags_json, null);
  return {
    id: String(raw?.id ?? ''),
    type: String(raw?.type ?? 'mcq'),
    difficulty: String(raw?.difficulty ?? 'medium'),
    question_text: String(raw?.question_text ?? ''),
    image_url: raw?.image_url ?? null,
    options: parseJsonField<string[] | null>(raw?.options ?? raw?.options_json, null),
    points: Number(raw?.points ?? 1) || 1,
    tags: Array.isArray(tags) ? tags : [],
    source: raw?.source ?? null,
  };
}

/** تطبيع عربي للمقارنة: بلا تشكيل، أ/إ/آ → ا، ى → ي، ة → ه. */
function normalizeAr(value: string): string {
  return value
    .replace(/[\u064B-\u0652\u0670\u0640]/g, '')
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه')
    .replace(/ؤ/g, 'و')
    .replace(/ئ/g, 'ي')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

const TRUE_WORDS = new Set(['صح', 'ص', 'true', '1', 'نعم', 'صحح']);
const FALSE_WORDS = new Set(['خطأ', 'خ', 'false', '0', 'لا', 'خطا']);

function toBooleanAnswer(value: unknown): boolean | null {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value === 1 ? true : value === 0 ? false : null;
  if (typeof value === 'string') {
    const s = value.trim().toLowerCase();
    if (TRUE_WORDS.has(s)) return true;
    if (FALSE_WORDS.has(s)) return false;
  }
  return null;
}

/**
 * هل هذا الخيار هو الإجابة الصحيحة؟
 * يعمل على مفتاح الإجابة كما يعيده /public/check بعد التصحيح.
 */
function isOptionCorrect(question: BankQuestion, index: number): boolean {
  const options = question.options || [];
  const answer: any = question.correct_answer;
  const text = options[index] ?? '';
  if (answer === null || answer === undefined) return false;

  if (typeof answer === 'number') return answer === index;

  if (typeof answer === 'boolean') return (answer ? 0 : 1) === index;

  if (typeof answer === 'string') {
    const raw = answer.trim();
    const norm = normalizeAr(raw);
    if (/^\d+$/.test(raw)) return Number(raw) === index;
    if (normalizeAr(text) === norm) return true;
    const bool = toBooleanAnswer(raw);
    if (bool === true) return index === 0;
    if (bool === false) return index === 1;
    const letter = AR_LETTERS.indexOf(raw);
    if (letter >= 0) return letter === index;
    return false;
  }

  if (Array.isArray(answer)) {
    return answer.some((entry) =>
      typeof entry === 'number' ? entry === index : normalizeAr(String(entry)) === normalizeAr(text)
    );
  }

  if (typeof answer === 'object') {
    if (typeof answer.option_index === 'number') return answer.option_index === index;
    if (typeof answer.option_text === 'string') {
      return normalizeAr(answer.option_text) === normalizeAr(text);
    }
    if ('value' in answer) {
      const bool = toBooleanAnswer(answer.value);
      if (bool === true) return index === 0;
      if (bool === false) return index === 1;
    }
    const candidates = [answer.index, answer.correct, answer.answer];
    if (candidates.some((v) => typeof v === 'number' && v === index)) return true;
    return candidates.some((v) => typeof v === 'string' && normalizeAr(v) === normalizeAr(text));
  }

  return false;
}

/** نص الإجابة النموذجية كما يُعرض للطالب بعد التصحيح. */
function modelAnswerText(answer: unknown): string {
  if (answer === null || answer === undefined) return '';
  if (typeof answer === 'string') return answer;
  if (typeof answer === 'number' || typeof answer === 'boolean') return String(answer);
  if (Array.isArray(answer)) return answer.map((v) => String(v)).join(' · ');
  if (typeof answer === 'object') {
    return Object.entries(answer as Record<string, unknown>)
      .map(([key, value]) => `${key}: ${String(value)}`)
      .join('\n');
  }
  return String(answer);
}

/** الحمولة التي يُرسلها العميل إلى /public/check لكل نوع سؤال. */
function toServerAnswer(question: BankQuestion, answer: AnswerValue | undefined): unknown {
  if (!answer) return null;

  if (question.type === 'mcq') {
    return answer.kind === 'choice' ? answer.index : null;
  }
  if (question.type === 'true_false') {
    return answer.kind === 'choice' ? answer.index === 0 : null;
  }
  if (question.type === 'ordering') {
    if (answer.kind !== 'order') return null;
    return (question.options || [])
      .map((item, i) => ({ item, position: answer.order[i] }))
      .filter((entry) => entry.position >= 0)
      .sort((a, b) => a.position - b.position)
      .map((entry) => entry.item);
  }
  return answer.kind === 'text' ? answer.text : null;
}

/**
 * نتيجة السؤال كما يقرّرها الخادم. الأنواع غير المؤتمتة (مقالي، توصيل،
 * ترتيب، تحليل شعري) تُعرض للمقارنة الذاتية بدل وسمها «خاطئة» ظلماً.
 */
function gradeFromCheck(type: string, result: CheckResult | undefined): Grade | null {
  if (!result || result.error) return null;
  if (result.correct === true) return 'correct';
  if (result.correct === false) {
    return AUTO_GRADED_TYPES.includes(type) ? 'wrong' : 'review';
  }
  return 'review';
}

function hasAnswer(answer: AnswerValue | undefined): boolean {
  if (!answer) return false;
  if (answer.kind === 'choice') return Number.isInteger(answer.index);
  if (answer.kind === 'text') return answer.text.trim().length > 0;
  if (answer.kind === 'order') return answer.order.length > 0 && answer.order.every((p) => p >= 0);
  return false;
}

function isChoiceType(type: string): boolean {
  return type === 'mcq' || type === 'true_false';
}

function isTextType(type: string): boolean {
  return type === 'short_answer' || type === 'essay' || type === 'fill_blank' || type === 'poetry_analysis';
}

function optionLabel(index: number): string {
  return AR_LETTERS[index] ?? String(index + 1);
}

// ── Component ────────────────────────────────────────────────────────
const QuestionBankPage: React.FC<QuestionBankPageProps> = ({ onBack }) => {
  const [mode, setMode] = useState<'browse' | 'practice' | 'result'>('browse');

  // ── Browse state ──
  const [query, setQuery] = useState('');
  const [debounced, setDebounced] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [difficultyFilter, setDifficultyFilter] = useState('');
  const [tagFilter, setTagFilter] = useState('');
  const [sourceFilter, setSourceFilter] = useState('');
  const [page, setPage] = useState(1);

  const [results, setResults] = useState<BankQuestion[]>([]);
  const [total, setTotal] = useState(0);
  const [tags, setTags] = useState<string[]>([]);
  const [sources, setSources] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [revealed, setRevealed] = useState<Record<string, boolean>>({});
  const [reloadKey, setReloadKey] = useState(0);

  // ── Answer / grading state (shared by browse + practice) ──
  const [answers, setAnswers] = useState<Record<string, AnswerValue>>({});
  const [checks, setChecks] = useState<Record<string, CheckResult>>({});
  const [checking, setChecking] = useState<Record<string, boolean>>({});
  const [submitted, setSubmitted] = useState<Record<string, boolean>>({});

  // ── Practice state ──
  const [showConfig, setShowConfig] = useState(false);
  const [practiceCount, setPracticeCount] = useState(10);
  const [practiceType, setPracticeType] = useState('');
  const [practiceDifficulty, setPracticeDifficulty] = useState('');
  const [practiceTag, setPracticeTag] = useState('');
  const [practiceQuestions, setPracticeQuestions] = useState<BankQuestion[]>([]);
  const [practiceIndex, setPracticeIndex] = useState(0);
  const [practiceLoading, setPracticeLoading] = useState(false);
  const [practiceError, setPracticeError] = useState('');
  const [notice, setNotice] = useState('');
  const [confirmExit, setConfirmExit] = useState(false);

  const requestIdRef = useRef(0);

  useEffect(() => {
    document.title = 'بنك الأسئلة | فُصحى';
    return () => {
      document.title = 'فُصحى | اللغة العربية للثانوية العامة';
    };
  }, []);

  // وسوم البنك — تُحمّل مرة واحدة لبناء قائمة التصفية
  useEffect(() => {
    ApiService.getPublicQuestionBankTags()
      .then((res: any) => {
        const list = Array.isArray(res?.tags) ? res.tags : [];
        setTags(list.map((t: any) => String(typeof t === 'string' ? t : t?.tag)).filter(Boolean));
      })
      .catch(() => {
        /* التصفية بالوسم ميزة إضافية — البنك يعمل بدونها */
      });
  }, []);

  // Debounce
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(query.trim()), 280);
    return () => clearTimeout(timer);
  }, [query]);

  // إعادة الصفحة إلى الأولى عند تغيّر أي تصفية
  useEffect(() => {
    setPage(1);
  }, [debounced, typeFilter, difficultyFilter, tagFilter, sourceFilter]);

  // ── Browse fetch ──
  useEffect(() => {
    if (mode !== 'browse') return;

    const requestId = ++requestIdRef.current;
    setLoading(true);
    setError('');

    ApiService.getPublicQuestionBank({
      q: debounced || undefined,
      type: typeFilter || undefined,
      difficulty: difficultyFilter || undefined,
      tag: tagFilter || undefined,
      page,
      limit: PAGE_SIZE,
      sort: 'created_at',
      order: 'desc',
    })
      .then((res: any) => {
        if (requestId !== requestIdRef.current) return;
        const rows: any[] = Array.isArray(res?.questions) ? res.questions : [];
        const list = rows.map(normalizeQuestion);
        setResults(list);
        setTotal(Number(res?.meta?.total ?? res?.total ?? 0) || 0);

        // المصدر لا يُصفّيه الخادم بعد — نجمّع القيم الظاهرة ونصفّيها محلياً.
        setSources((prev) => {
          const merged = new Set(prev);
          list.forEach((q) => {
            if (q.source) merged.add(q.source);
          });
          return [...merged].sort((a, b) => a.localeCompare(b, 'ar'));
        });
      })
      .catch((err: any) => {
        if (requestId !== requestIdRef.current) return;
        setResults([]);
        setTotal(0);
        setError(err?.message || 'تعذّر تحميل بنك الأسئلة. يرجى المحاولة مرة أخرى.');
      })
      .finally(() => {
        if (requestId !== requestIdRef.current) return;
        setLoading(false);
      });
  }, [debounced, typeFilter, difficultyFilter, tagFilter, page, reloadKey, mode]);

  const visibleResults = useMemo(
    () => (sourceFilter ? results.filter((q) => q.source === sourceFilter) : results),
    [results, sourceFilter]
  );

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const hasFilters = !!(debounced || typeFilter || difficultyFilter || tagFilter || sourceFilter);

  const clearFilters = useCallback(() => {
    setQuery('');
    setDebounced('');
    setTypeFilter('');
    setDifficultyFilter('');
    setTagFilter('');
    setSourceFilter('');
    setPage(1);
  }, []);

  // ── Grading through the server ──
  const runCheck = useCallback((question: BankQuestion, answer: unknown) => {
    const id = question.id;
    setChecking((prev) => ({ ...prev, [id]: true }));

    ApiService.checkPublicAnswer(id, answer)
      .then((res: any) => {
        setChecks((prev) => ({
          ...prev,
          [id]: {
            correct: typeof res?.correct === 'boolean' ? res.correct : null,
            correctAnswer: res?.correct_answer ?? null,
            explanation: res?.explanation ?? null,
            message: typeof res?.message === 'string' ? res.message : undefined,
          },
        }));
      })
      .catch((err: any) => {
        setChecks((prev) => ({
          ...prev,
          [id]: {
            correct: null,
            correctAnswer: null,
            explanation: null,
            error: err?.message || 'تعذّر تصحيح الإجابة. يرجى المحاولة مرة أخرى.',
          },
        }));
      })
      .finally(() => {
        setChecking((prev) => ({ ...prev, [id]: false }));
      });
  }, []);

  const setAnswer = useCallback((id: string, value: AnswerValue) => {
    setAnswers((prev) => ({ ...prev, [id]: value }));
  }, []);

  // ── Practice ──
  const startPractice = useCallback(() => {
    setPracticeLoading(true);
    setPracticeError('');
    setNotice('');
    setShowConfig(false);

    ApiService.getPublicRandomQuestions({
      count: practiceCount,
      type: practiceType || undefined,
      difficulty: practiceDifficulty || undefined,
      tags: practiceTag ? [practiceTag] : undefined,
    })
      .then((res: any) => {
        const rows: any[] = Array.isArray(res?.questions) ? res.questions : [];
        const list = rows.map(normalizeQuestion);
        if (list.length === 0) {
          setPracticeError('لا توجد أسئلة تطابق المعايير المحددة. جرّب توسيع التصفية.');
          setShowConfig(true);
          return;
        }
        setPracticeQuestions(list);
        setPracticeIndex(0);
        setAnswers({});
        setChecks({});
        setSubmitted({});
        setMode('practice');
        if (typeof res?.message === 'string') setNotice(res.message);
      })
      .catch((err: any) => {
        setPracticeError(err?.message || 'تعذّر بدء التدريب. يرجى المحاولة مرة أخرى.');
        setShowConfig(true);
      })
      .finally(() => {
        setPracticeLoading(false);
      });
  }, [practiceCount, practiceType, practiceDifficulty, practiceTag]);

  const exitPractice = useCallback(() => {
    setMode('browse');
    setConfirmExit(false);
    setPracticeQuestions([]);
    setAnswers({});
    setChecks({});
    setSubmitted({});
    setNotice('');
    setShowConfig(false);
  }, []);

  const currentQuestion: BankQuestion | undefined = practiceQuestions[practiceIndex];

  const optionList = useMemo(() => {
    if (!currentQuestion) return [];
    if (currentQuestion.options && currentQuestion.options.length) return currentQuestion.options;
    if (currentQuestion.type === 'true_false') return ['صح', 'خطأ'];
    return [];
  }, [currentQuestion]);

  const currentAnswer = currentQuestion ? answers[currentQuestion.id] : undefined;
  const currentCheck = currentQuestion ? checks[currentQuestion.id] : undefined;
  const isRevealed = currentQuestion ? !!submitted[currentQuestion.id] : false;
  const currentGrade = currentQuestion ? gradeFromCheck(currentQuestion.type, currentCheck) : null;

  /** السؤال بعد أن أُرفق به مفتاح الإجابة القادم من الخادم. */
  const gradedQuestion = useMemo(() => {
    if (!currentQuestion || !currentCheck) return currentQuestion;
    return {
      ...currentQuestion,
      correct_answer: currentCheck.correctAnswer,
      explanation: currentCheck.explanation,
    };
  }, [currentQuestion, currentCheck]);

  const submitCurrent = useCallback(() => {
    if (!currentQuestion) return;
    setSubmitted((prev) => ({ ...prev, [currentQuestion.id]: true }));
    if (!checks[currentQuestion.id]) {
      runCheck(currentQuestion, toServerAnswer(currentQuestion, currentAnswer));
    }
  }, [currentQuestion, currentAnswer, checks, runCheck]);

  const goNext = useCallback(() => {
    if (practiceIndex < practiceQuestions.length - 1) {
      setPracticeIndex((i) => i + 1);
    } else {
      setMode('result');
    }
  }, [practiceIndex, practiceQuestions.length]);

  const goPrev = useCallback(() => {
    setPracticeIndex((i) => Math.max(0, i - 1));
  }, []);

  // ── Result tally ──
  const tally = useMemo(() => {
    let correct = 0;
    let wrong = 0;
    let review = 0;
    let unanswered = 0;
    for (const question of practiceQuestions) {
      const grade = submitted[question.id] ? gradeFromCheck(question.type, checks[question.id]) : null;
      if (grade === 'correct') correct += 1;
      else if (grade === 'wrong') wrong += 1;
      else if (grade === 'review') review += 1;
      else unanswered += 1;
    }
    const percent = practiceQuestions.length
      ? Math.round((correct / practiceQuestions.length) * 100)
      : 0;
    return { correct, wrong, review, unanswered, percent };
  }, [practiceQuestions, checks, submitted]);

  // ══════════════════════════════════════════════════════════════════
  // Render helpers
  // ══════════════════════════════════════════════════════════════════
  const renderBadges = (question: BankQuestion) => (
    <div className="qb-badges">
      <span className="qb-badge qb-badge--type">{TYPE_LABEL[question.type] || question.type}</span>
      <span className={`qb-badge ${DIFFICULTY_CLASS[question.difficulty] || 'qb-badge--warning'}`}>
        {DIFFICULTY_LABEL[question.difficulty] || question.difficulty}
      </span>
      {question.points > 1 && (
        <span className="qb-badge qb-badge--neutral">{question.points} درجات</span>
      )}
      {question.source && <span className="qb-badge qb-badge--source">{question.source}</span>}
    </div>
  );

  /** لوح الإجابة النموذجية + الشرح — لا يُعرض إلا بمفتاح قادم من الخادم. */
  const renderAnswerBlock = (question: BankQuestion) => {
    const options = question.options || [];
    const correctIndex = isChoiceType(question.type)
      ? options.findIndex((_, i) => isOptionCorrect(question, i))
      : -1;
    const asText = modelAnswerText(question.correct_answer);

    return (
      <div className="qb-reveal">
        <span className="qb-reveal__label">الإجابة الصحيحة</span>
        {correctIndex >= 0 ? (
          <p className="qb-reveal__value">
            {optionLabel(correctIndex)}
            {' — '}
            {options[correctIndex]}
          </p>
        ) : (
          <p className="qb-reveal__value qb-reveal__value--pre">{asText || '—'}</p>
        )}
        {question.explanation && (
          <>
            <span className="qb-reveal__label">الشرح</span>
            <p className="qb-reveal__text">{question.explanation}</p>
          </>
        )}
      </div>
    );
  };

  const renderSkeletons = () => (
    <div className="qb-skeleton-grid" aria-hidden="true">
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <div key={i} className="qb-skeleton-card" />
      ))}
    </div>
  );

  const renderEmpty = () => (
    <div className="qb-state" role="status">
      <span className="icon qb-state__icon" aria-hidden="true">
        {hasFilters ? 'search_off' : 'inbox'}
      </span>
      <h3 className="qb-state__title">
        {hasFilters ? 'لا توجد أسئلة مطابقة' : 'البنك ينتظر أول سؤال'}
      </h3>
      <p className="qb-state__text">
        {hasFilters
          ? 'جرّب تخفيف التصفية أو البحث بكلمة مختلفة من نص السؤال.'
          : 'سيُضاف إليه كل سؤال من امتحانات الوزارة والنماذج التدريبية، مرتّباً بالوسم والصعوبة.'}
      </p>
      {hasFilters && (
        <button type="button" className="qb-chip" onClick={clearFilters}>
          <span className="icon" aria-hidden="true">
            filter_alt_off
          </span>
          مسح التصفية
        </button>
      )}
    </div>
  );

  const renderError = () => (
    <div className="qb-state qb-state--error" role="alert">
      <span className="icon qb-state__icon" aria-hidden="true">
        cloud_off
      </span>
      <h3 className="qb-state__title">تعذّر تحميل الأسئلة</h3>
      <p className="qb-state__text">{error}</p>
      <button type="button" className="qb-chip" onClick={() => setReloadKey((k) => k + 1)}>
        <span className="icon" aria-hidden="true">
          refresh
        </span>
        إعادة المحاولة
      </button>
    </div>
  );

  // ── Browse ──
  const renderBrowse = () => (
    <>
      <div className="qb-toolbar">
        <div className="qb-search" role="search">
          <div className="qb-search__field">
            <span className="icon qb-search__icon" aria-hidden="true">
              search
            </span>
            <input
              type="search"
              className="qb-search__input"
              value={query}
              placeholder="ابحث في نص السؤال… مثال: الاستعارة"
              aria-label="ابحث في بنك الأسئلة"
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') setDebounced(query.trim());
              }}
            />
          </div>
          <button
            type="button"
            className="qb-btn qb-btn--primary qb-btn--compact"
            onClick={() => {
              setPracticeError('');
              setShowConfig((v) => !v);
            }}
            aria-expanded={showConfig}
          >
            <span className="icon" aria-hidden="true">
              fitness_center
            </span>
            ابدأ تدريب
          </button>
        </div>

        {showConfig && (
          <div className="qb-config" aria-label="إعدادات التدريب">
            <div className="qb-config__row">
              <div className="qb-field">
                <span className="qb-field__label" id="qb-count-label">
                  عدد الأسئلة
                </span>
                <div className="qb-config__counts">
                  {COUNT_OPTIONS.map((count) => (
                    <button
                      key={count}
                      type="button"
                      className="qb-chip"
                      aria-pressed={practiceCount === count}
                      onClick={() => setPracticeCount(count)}
                    >
                      {count}
                    </button>
                  ))}
                </div>
              </div>

              <div className="qb-field">
                <label className="qb-field__label" htmlFor="qb-practice-type">
                  النوع
                </label>
                <div className="qb-select">
                  <select
                    id="qb-practice-type"
                    className="qb-select__control"
                    value={practiceType}
                    onChange={(e) => setPracticeType(e.target.value)}
                  >
                    <option value="">كل الأنواع</option>
                    {TYPE_FILTERS.map((t) => (
                      <option key={t.value} value={t.value}>
                        {t.label}
                      </option>
                    ))}
                  </select>
                  <span className="icon qb-select__chevron" aria-hidden="true">
                    expand_more
                  </span>
                </div>
              </div>

              <div className="qb-field">
                <label className="qb-field__label" htmlFor="qb-practice-difficulty">
                  الصعوبة
                </label>
                <div className="qb-select">
                  <select
                    id="qb-practice-difficulty"
                    className="qb-select__control"
                    value={practiceDifficulty}
                    onChange={(e) => setPracticeDifficulty(e.target.value)}
                  >
                    <option value="">كل المستويات</option>
                    {DIFFICULTY_FILTERS.map((d) => (
                      <option key={d.value} value={d.value}>
                        {d.label}
                      </option>
                    ))}
                  </select>
                  <span className="icon qb-select__chevron" aria-hidden="true">
                    expand_more
                  </span>
                </div>
              </div>

              <div className="qb-field">
                <label className="qb-field__label" htmlFor="qb-practice-tag">
                  الوسم
                </label>
                <div className="qb-select">
                  <select
                    id="qb-practice-tag"
                    className="qb-select__control"
                    value={practiceTag}
                    onChange={(e) => setPracticeTag(e.target.value)}
                  >
                    <option value="">كل الوسوم</option>
                    {tags.map((tag) => (
                      <option key={tag} value={tag}>
                        {tag}
                      </option>
                    ))}
                  </select>
                  <span className="icon qb-select__chevron" aria-hidden="true">
                    expand_more
                  </span>
                </div>
              </div>
            </div>

            {practiceError && (
              <p className="qb-hint qb-hint--error" role="alert">
                {practiceError}
              </p>
            )}

            <div className="qb-config__actions">
              <button
                type="button"
                className="qb-btn qb-btn--primary"
                onClick={startPractice}
                disabled={practiceLoading}
              >
                <span className="icon" aria-hidden="true">
                  play_arrow
                </span>
                {practiceLoading ? 'جارٍ التحضير…' : 'ابدأ'}
              </button>
              <button type="button" className="qb-btn qb-btn--ghost" onClick={() => setShowConfig(false)}>
                إلغاء
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="qb-filters" role="group" aria-label="تصفية الأسئلة">
        <div className="qb-select">
          <select
            className="qb-select__control"
            value={typeFilter}
            aria-label="النوع"
            onChange={(e) => setTypeFilter(e.target.value)}
          >
            <option value="">النوع: الكل</option>
            {TYPE_FILTERS.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
          <span className="icon qb-select__chevron" aria-hidden="true">
            expand_more
          </span>
        </div>

        <div className="qb-select">
          <select
            className="qb-select__control"
            value={difficultyFilter}
            aria-label="مستوى الصعوبة"
            onChange={(e) => setDifficultyFilter(e.target.value)}
          >
            <option value="">الصعوبة: الكل</option>
            {DIFFICULTY_FILTERS.map((d) => (
              <option key={d.value} value={d.value}>
                {d.label}
              </option>
            ))}
          </select>
          <span className="icon qb-select__chevron" aria-hidden="true">
            expand_more
          </span>
        </div>

        <div className="qb-select">
          <select
            className="qb-select__control"
            value={tagFilter}
            aria-label="الوسم"
            onChange={(e) => setTagFilter(e.target.value)}
          >
            <option value="">الوسم: الكل</option>
            {tags.map((tag) => (
              <option key={tag} value={tag}>
                {tag}
              </option>
            ))}
          </select>
          <span className="icon qb-select__chevron" aria-hidden="true">
            expand_more
          </span>
        </div>

        <div className="qb-select">
          <select
            className="qb-select__control"
            value={sourceFilter}
            aria-label="المصدر"
            onChange={(e) => setSourceFilter(e.target.value)}
          >
            <option value="">المصدر: الكل</option>
            {sources.map((source) => (
              <option key={source} value={source}>
                {source}
              </option>
            ))}
          </select>
          <span className="icon qb-select__chevron" aria-hidden="true">
            expand_more
          </span>
        </div>

        {hasFilters && (
          <button type="button" className="qb-link-btn" onClick={clearFilters}>
            مسح التصفية
          </button>
        )}
      </div>

      <div className="qb-meta" aria-live="polite">
        {loading ? 'جارٍ التحميل…' : `${total} سؤالًا`}
        {!loading && hasFilters && visibleResults.length !== results.length && (
          <span className="qb-meta__note"> · {visibleResults.length} في هذه الصفحة بعد تصفية المصدر</span>
        )}
      </div>

      {loading && renderSkeletons()}

      {!loading && error && renderError()}

      {!loading && !error && visibleResults.length === 0 && renderEmpty()}

      {!loading && !error && visibleResults.length > 0 && (
        <div className="qb-grid">
          {visibleResults.map((question) => {
            const check = checks[question.id];
            const isOpen = !!revealed[question.id] && !!check;
            const isPending = !!checking[question.id];
            const graded: BankQuestion = check
              ? { ...question, correct_answer: check.correctAnswer, explanation: check.explanation }
              : question;

            return (
              <article key={question.id} className="qb-card">
                {renderBadges(question)}

                {question.image_url && (
                  <img className="qb-card__image" src={question.image_url} alt="صورة السؤال" loading="lazy" />
                )}

                <p
                  className={`qb-card__text ${
                    question.type === 'poetry_analysis' ? 'qb-card__text--poetry' : ''
                  }`}
                >
                  {question.question_text}
                </p>

                {isChoiceType(question.type) && !!question.options?.length && (
                  <ul className="qb-card__options">
                    {question.options.map((option, i) => (
                      <li
                        key={i}
                        className={`qb-card__option ${
                          isOpen && isOptionCorrect(graded, i) ? 'qb-card__option--correct' : ''
                        }`}
                      >
                        <span className="qb-card__option-key">{optionLabel(i)}</span>
                        <span>{option}</span>
                      </li>
                    ))}
                  </ul>
                )}

                {!!question.tags.length && (
                  <div className="qb-tags">
                    {question.tags.map((tag) => (
                      <span key={tag} className="qb-tag">
                        {tag}
                      </span>
                    ))}
                  </div>
                )}

                {check?.error && (
                  <p className="qb-hint qb-hint--error" role="alert">
                    {check.error}
                  </p>
                )}

                <button
                  type="button"
                  className="qb-reveal-btn"
                  aria-expanded={isOpen}
                  disabled={isPending}
                  onClick={() => {
                    if (check) {
                      setRevealed((prev) => ({ ...prev, [question.id]: !isOpen }));
                      return;
                    }
                    // مفتاح الإجابة مخفي عن الطالب — لا يُكشف إلا بتصحيح الخادم.
                    runCheck(question, null);
                    setRevealed((prev) => ({ ...prev, [question.id]: true }));
                  }}
                >
                  <span className="icon" aria-hidden="true">
                    {isPending ? 'hourglass_top' : isOpen ? 'visibility_off' : 'visibility'}
                  </span>
                  {isPending
                    ? 'جارٍ الكشف…'
                    : isOpen
                      ? 'إخفاء الإجابة والشرح'
                      : 'إظهار الإجابة والشرح'}
                </button>

                {isOpen && renderAnswerBlock(graded)}
              </article>
            );
          })}
        </div>
      )}

      {!loading && !error && totalPages > 1 && (
        <nav className="qb-pagination" aria-label="صفحات النتائج">
          <button
            type="button"
            className="qb-btn qb-btn--ghost"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1}
          >
            <span className="icon" aria-hidden="true">
              chevron_right
            </span>
            السابق
          </button>
          <span className="qb-pagination__label">
            صفحة {page} من {totalPages}
          </span>
          <button
            type="button"
            className="qb-btn qb-btn--ghost"
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page >= totalPages}
          >
            التالي
            <span className="icon" aria-hidden="true">
              chevron_left
            </span>
          </button>
        </nav>
      )}
    </>
  );

  // ── Practice: one question per screen ──
  const renderPractice = () => {
    if (!currentQuestion) return null;
    const question = currentQuestion;
    const isLast = practiceIndex === practiceQuestions.length - 1;
    const progress = Math.round(((practiceIndex + 1) / practiceQuestions.length) * 100);
    const isPending = !!checking[question.id];

    return (
      <div className="qb-practice">
        <div className="qb-practice__head">
          <button
            type="button"
            className="qb-icon-btn"
            aria-label="الخروج من التدريب"
            onClick={() => setConfirmExit(true)}
          >
            <span className="icon" aria-hidden="true">
              close
            </span>
          </button>

          <div className="qb-progress" aria-hidden="true">
            <div className="qb-progress__fill" style={{ width: `${progress}%` }} />
          </div>

          <span className="qb-practice__counter">
            السؤال {practiceIndex + 1} من {practiceQuestions.length}
          </span>
        </div>

        {confirmExit && (
          <div className="qb-confirm" role="alertdialog" aria-label="تأكيد الخروج">
            <p className="qb-confirm__text">هل تريد الخروج؟ لن تُحفظ إجاباتك.</p>
            <div className="qb-confirm__actions">
              <button type="button" className="qb-btn qb-btn--ghost" onClick={() => setConfirmExit(false)}>
                متابعة التدريب
              </button>
              <button type="button" className="qb-btn qb-btn--danger" onClick={exitPractice}>
                خروج
              </button>
            </div>
          </div>
        )}

        {notice && (
          <p className="qb-notice" role="status">
            <span className="icon" aria-hidden="true">
              info
            </span>
            {notice}
          </p>
        )}

        <article className="qb-question">
          {renderBadges(question)}

          {question.image_url && (
            <img className="qb-card__image" src={question.image_url} alt="صورة السؤال" loading="lazy" />
          )}

          <h2
            className={`qb-question__stem ${
              question.type === 'poetry_analysis' ? 'qb-question__stem--poetry' : ''
            }`}
          >
            {question.question_text}
          </h2>

          {/* اختيار من متعدد / صح أو خطأ */}
          {isChoiceType(question.type) && optionList.length > 0 && (
            <div className="qb-options" role="radiogroup" aria-label="الإجابات">
              {optionList.map((option, i) => {
                const isSelected = currentAnswer?.kind === 'choice' && currentAnswer.index === i;
                const isCorrect = isRevealed && !!gradedQuestion && isOptionCorrect(gradedQuestion, i);

                // أولوية الحالة: صحيح ← اختيار الطالب الخاطئ ← مختار ← افتراضي
                let stateClass = '';
                if (isCorrect) stateClass = 'qb-option--correct';
                else if (isRevealed && isSelected) stateClass = 'qb-option--wrong';
                else if (isSelected) stateClass = 'qb-option--selected';

                return (
                  <button
                    key={i}
                    type="button"
                    role="radio"
                    aria-checked={isSelected}
                    disabled={isRevealed}
                    className={`qb-option ${stateClass}`}
                    onClick={() => setAnswer(question.id, { kind: 'choice', index: i })}
                  >
                    <span className="qb-option__key">{optionLabel(i)}</span>
                    <span className="qb-option__text">{option}</span>
                    {isCorrect && (
                      <span className="icon qb-option__mark" aria-hidden="true">
                        check_circle
                      </span>
                    )}
                    {isRevealed && !isCorrect && isSelected && (
                      <span className="icon qb-option__mark" aria-hidden="true">
                        cancel
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          )}

          {/* إجابة نصية */}
          {isTextType(question.type) && (
            <div className="qb-field">
              <label className="qb-field__label" htmlFor={`qb-answer-${question.id}`}>
                {question.type === 'fill_blank' ? 'أكمل الفراغ' : 'إجابتك'}
              </label>
              <textarea
                id={`qb-answer-${question.id}`}
                className="qb-textarea"
                rows={question.type === 'essay' || question.type === 'poetry_analysis' ? 6 : 3}
                value={currentAnswer?.kind === 'text' ? currentAnswer.text : ''}
                disabled={isRevealed}
                placeholder="اكتب إجابتك هنا…"
                onChange={(e) => setAnswer(question.id, { kind: 'text', text: e.target.value })}
              />
            </div>
          )}

          {/* ترتيب — عناصر السؤال كما يرسلها الخادم، والترتيب الصحيح مخفي */}
          {question.type === 'ordering' && !!question.options?.length && (
            <div className="qb-match">
              <span className="qb-field__label">رتّب العناصر التالية</span>
              {question.options.map((item, itemIndex) => {
                const position =
                  currentAnswer?.kind === 'order' ? currentAnswer.order[itemIndex] : undefined;
                return (
                  <div key={item} className="qb-match__row">
                    <span className="qb-match__left">{item}</span>
                    <div className="qb-select qb-select--tight">
                      <select
                        className="qb-select__control"
                        value={position === undefined || position < 0 ? '' : String(position)}
                        disabled={isRevealed}
                        aria-label={`حدد ترتيب «${item}»`}
                        onChange={(e) => {
                          const nextOrder: number[] =
                            currentAnswer?.kind === 'order'
                              ? [...currentAnswer.order]
                              : (question.options || []).map(() => -1);
                          nextOrder[itemIndex] = e.target.value === '' ? -1 : Number(e.target.value);
                          setAnswer(question.id, { kind: 'order', order: nextOrder });
                        }}
                      >
                        <option value="">اختر…</option>
                        {(question.options || []).map((_, pos) => (
                          <option key={pos} value={pos}>
                            {pos + 1}
                          </option>
                        ))}
                      </select>
                      <span className="icon qb-select__chevron" aria-hidden="true">
                        expand_more
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* توصيل ومقالي: إجابة نصية تُقارَن بالنموذج */}
          {question.type === 'matching' && (
            <div className="qb-field">
              {!!question.options?.length && (
                <ul className="qb-card__options">
                  {question.options.map((option, i) => (
                    <li key={i} className="qb-card__option">
                      <span className="qb-card__option-key">{optionLabel(i)}</span>
                      <span>{option}</span>
                    </li>
                  ))}
                </ul>
              )}
              <label className="qb-field__label" htmlFor={`qb-answer-${question.id}`}>
                اكتب التوصيل الصحيح
              </label>
              <textarea
                id={`qb-answer-${question.id}`}
                className="qb-textarea"
                rows={3}
                value={currentAnswer?.kind === 'text' ? currentAnswer.text : ''}
                disabled={isRevealed}
                placeholder="مثال: أ ← ١، ب ← ٢…"
                onChange={(e) => setAnswer(question.id, { kind: 'text', text: e.target.value })}
              />
            </div>
          )}

          {/* لوح التغذية الراجعة */}
          {isRevealed && (
            <div
              className={`qb-feedback ${
                currentGrade === 'correct'
                  ? 'qb-feedback--correct'
                  : currentGrade === 'wrong'
                    ? 'qb-feedback--wrong'
                    : 'qb-feedback--review'
              }`}
            >
              {isPending ? (
                <span className="qb-feedback__title">
                  <span className="icon" aria-hidden="true">
                    hourglass_top
                  </span>
                  جارٍ التصحيح…
                </span>
              ) : currentCheck?.error ? (
                <span className="qb-feedback__title qb-hint--error">{currentCheck.error}</span>
              ) : (
                <>
                  <span className="qb-feedback__title">
                    <span className="icon" aria-hidden="true">
                      {currentGrade === 'correct'
                        ? 'check_circle'
                        : currentGrade === 'wrong'
                          ? 'cancel'
                          : 'lightbulb'}
                    </span>
                    {currentGrade === 'correct'
                      ? 'إجابة صحيحة'
                      : currentGrade === 'wrong'
                        ? 'إجابة خاطئة'
                        : 'قارن إجابتك بالنموذج'}
                  </span>
                  {currentCheck?.message && <p className="qb-hint">{currentCheck.message}</p>}
                  {gradedQuestion && renderAnswerBlock(gradedQuestion)}
                </>
              )}
            </div>
          )}
        </article>

        <div className="qb-navbar">
          <button
            type="button"
            className="qb-btn qb-btn--ghost"
            onClick={goPrev}
            disabled={practiceIndex === 0}
          >
            <span className="icon" aria-hidden="true">
              chevron_right
            </span>
            السابق
          </button>

          {!isRevealed ? (
            <button
              type="button"
              className="qb-btn qb-btn--primary"
              onClick={submitCurrent}
              disabled={!hasAnswer(currentAnswer)}
            >
              تأكيد الإجابة
            </button>
          ) : (
            <button type="button" className="qb-btn qb-btn--primary" onClick={goNext} disabled={isPending}>
              {isLast ? 'إنهاء التدريب' : 'التالي'}
              <span className="icon" aria-hidden="true">
                chevron_left
              </span>
            </button>
          )}
        </div>
      </div>
    );
  };

  // ── Result ──
  const renderResult = () => {
    const dashOffset = RING_CIRCUMFERENCE * (1 - tally.percent / 100);

    return (
      <div className="qb-result">
        <section className="qb-result__hero">
          <svg
            className="qb-ring"
            viewBox="0 0 120 120"
            role="img"
            aria-label={`النتيجة ${tally.percent} بالمئة`}
          >
            <circle className="qb-ring__track" cx="60" cy="60" r={RING_RADIUS} />
            <circle
              className="qb-ring__fill"
              cx="60"
              cy="60"
              r={RING_RADIUS}
              strokeDasharray={RING_CIRCUMFERENCE}
              strokeDashoffset={dashOffset}
            />
          </svg>
          <div className="qb-result__score">
            <span className="qb-result__percent">{tally.percent}%</span>
            <h2 className="qb-result__title">
              {tally.correct} من {practiceQuestions.length}
            </h2>
            <p className="qb-result__lead">
              {tally.percent >= 85
                ? 'أداء ممتاز — أتقنتَ هذا الجزء.'
                : tally.percent >= 60
                  ? 'أداء جيد — راجع الأسئلة التي أخطأتَ فيها.'
                  : 'لا بأس — راجع الشرح وأعد المحاولة.'}
            </p>
          </div>
        </section>

        <div className="qb-result__stats">
          <div className="qb-stat qb-stat--success">
            <span className="qb-stat__value">{tally.correct}</span>
            <span className="qb-stat__label">صحيحة</span>
          </div>
          <div className="qb-stat qb-stat--error">
            <span className="qb-stat__value">{tally.wrong}</span>
            <span className="qb-stat__label">خاطئة</span>
          </div>
          <div className="qb-stat qb-stat--warning">
            <span className="qb-stat__value">{tally.review}</span>
            <span className="qb-stat__label">تحتاج مراجعة</span>
          </div>
          <div className="qb-stat qb-stat--neutral">
            <span className="qb-stat__value">{tally.unanswered}</span>
            <span className="qb-stat__label">لم تُجب</span>
          </div>
        </div>

        <section className="qb-review" aria-label="مراجعة الإجابات">
          <h3 className="qb-review__title">مراجعة الأسئلة</h3>
          <ol className="qb-review__list">
            {practiceQuestions.map((question, i) => {
              const grade = submitted[question.id]
                ? gradeFromCheck(question.type, checks[question.id])
                : null;
              const chipClass =
                grade === 'correct'
                  ? 'qb-badge--success'
                  : grade === 'wrong'
                    ? 'qb-badge--error'
                    : grade === 'review'
                      ? 'qb-badge--warning'
                      : 'qb-badge--neutral';

              return (
                <li key={question.id} className="qb-review__item">
                  <button
                    type="button"
                    className="qb-review__btn"
                    onClick={() => {
                      setPracticeIndex(i);
                      setMode('practice');
                    }}
                  >
                    <span className="qb-review__index">{i + 1}</span>
                    <span className="qb-review__body">
                      <span className="qb-review__text">{question.question_text}</span>
                      <span className="qb-badges">
                        <span className={`qb-badge ${chipClass}`}>
                          {grade === 'correct'
                            ? 'صحيحة'
                            : grade === 'wrong'
                              ? 'خاطئة'
                              : grade === 'review'
                                ? 'راجع النموذج'
                                : 'لم تُجب'}
                        </span>
                        <span className="qb-badge qb-badge--type">
                          {TYPE_LABEL[question.type] || question.type}
                        </span>
                      </span>
                    </span>
                    <span className="icon qb-review__chevron" aria-hidden="true">
                      chevron_left
                    </span>
                  </button>
                </li>
              );
            })}
          </ol>
        </section>

        <div className="qb-result__actions">
          <button
            type="button"
            className="qb-btn qb-btn--primary"
            onClick={() => {
              setAnswers({});
              setChecks({});
              setSubmitted({});
              setPracticeIndex(0);
              setMode('practice');
            }}
          >
            <span className="icon" aria-hidden="true">
              replay
            </span>
            إعادة المحاولة
          </button>
          <button type="button" className="qb-btn qb-btn--ghost" onClick={exitPractice}>
            العودة للبنك
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="qb-page">
      <header className="qb-header">
        {onBack && (
          <button type="button" className="qb-link-btn qb-header__back" onClick={onBack}>
            <span className="icon" aria-hidden="true">
              arrow_forward
            </span>
            العودة
          </button>
        )}
        <h1 className="qb-header__title">بنك الأسئلة</h1>
        <p className="qb-header__lead">
          كل ما ورد في امتحانات الثانوية العامة — مصنّفاً بالنوع والصعوبة والوسم. تصفّح بحرية،
          أو ابدأ تدريباً قصيراً بسؤال واحد على الشاشة.
        </p>
        <div className="qb-header__divider" />
      </header>

      {mode === 'browse' && renderBrowse()}
      {mode === 'practice' && renderPractice()}
      {mode === 'result' && renderResult()}
    </div>
  );
};

export default QuestionBankPage;
export { QuestionBankPage };
