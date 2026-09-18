import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ApiService } from '../services/api';
import './Dictionary.css';

export interface DictionaryEntry {
  id: string;
  word: string;
  word_normalized?: string;
  root?: string | null;
  type?: string | null;
  meaning: string;
  plural?: string | null;
  singular?: string | null;
  synonyms?: string[];
  antonyms?: string[];
  context?: string | null;
  exam_context?: string | null;
  lesson_id?: string | null;
  unit?: string | null;
  audio_url?: string | null;
  difficulty?: number;
  tags?: string[];
  search_count?: number;
}

interface DictionaryProps {
  onBack?: () => void;
}

const RECENT_KEY = 'fusha_dictionary_recent';
const RECENT_LIMIT = 8;

/** كلمات اليوم — تُعرض عند فتح المعجم قبل كتابة أي شيء. */
const WORDS_OF_THE_DAY = [
  'الطَّلَل',
  'الْمَنِيَّة',
  'الْبَيْدَاء',
  'الْغِلَاب',
  'الْحِلْم',
  'الْكِنَايَة',
];

const FILTER_CHIPS: { label: string; tag?: string }[] = [
  { label: 'الكل' },
  { label: 'الأدب', tag: 'أدب' },
  { label: 'البلاغة', tag: 'بلاغة' },
  { label: 'النثر', tag: 'نثر' },
  { label: 'القرآن', tag: 'قرآن' },
];

const DIFFICULTY_LABEL: Record<number, string> = {
  1: 'سهل',
  2: 'متوسط',
  3: 'صعب',
};

type SpeechRecognitionLike = {
  lang: string;
  interimResults: boolean;
  maxAlternatives: number;
  continuous: boolean;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((event: any) => void) | null;
  onerror: ((event: any) => void) | null;
  onend: (() => void) | null;
};

const Dictionary: React.FC<DictionaryProps> = ({ onBack }) => {
  const [query, setQuery] = useState('');
  const [debounced, setDebounced] = useState('');
  const [activeTag, setActiveTag] = useState<string | undefined>(undefined);

  const [results, setResults] = useState<DictionaryEntry[]>([]);
  const [suggestions, setSuggestions] = useState<{ word: string }[]>([]);
  const [selected, setSelected] = useState<DictionaryEntry | null>(null);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>('');

  const [reloadKey, setReloadKey] = useState(0);
  const [recent, setRecent] = useState<string[]>([]);
  const [popular, setPopular] = useState<DictionaryEntry[]>([]);
  const [showSuggestHint, setShowSuggestHint] = useState(false);

  const [listening, setListening] = useState(false);
  const [interim, setInterim] = useState('');
  const [voiceError, setVoiceError] = useState('');
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);

  const requestIdRef = useRef(0);
  const inputRef = useRef<HTMLInputElement>(null);

  // البحث الصوتي متاح فقط في المتصفحات الداعمة — وإلا يُخفى الزر تماماً
  const SpeechCtor = useMemo(() => {
    if (typeof window === 'undefined') return null;
    const w = window as unknown as Record<string, unknown>;
    return (w.SpeechRecognition || w.webkitSpeechRecognition || null) as
      | (new () => SpeechRecognitionLike)
      | null;
  }, []);
  const voiceSupported = !!SpeechCtor;

  useEffect(() => {
    document.title = 'معجم فُصحى | فُصحى';
    return () => {
      document.title = 'فُصحى | اللغة العربية للثانوية العامة';
    };
  }, []);

  // تحميل البحث الأخير والأكثر بحثاً
  useEffect(() => {
    try {
      const stored = localStorage.getItem(RECENT_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) setRecent(parsed.slice(0, RECENT_LIMIT));
      }
    } catch {
      /* تجاهل — البحث الأخير ميزة تجميلية */
    }

    ApiService.getPopularDictionary(6)
      .then((res: any) => {
        if (res?.entries?.length) setPopular(res.entries);
      })
      .catch(() => {
        /* المعجم يعمل بدونها */
      });
  }, []);

  const persistRecent = useCallback((word: string) => {
    setRecent((prev) => {
      const next = [word, ...prev.filter((w) => w !== word)].slice(0, RECENT_LIMIT);
      try {
        localStorage.setItem(RECENT_KEY, JSON.stringify(next));
      } catch {
        /* تجاهل */
      }
      return next;
    });
  }, []);

  // Debounce
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(query.trim()), 280);
    return () => clearTimeout(timer);
  }, [query]);

  // Search
  useEffect(() => {
    if (!debounced) {
      setResults([]);
      setSuggestions([]);
      setSelected(null);
      setError('');
      setLoading(false);
      return;
    }

    const requestId = ++requestIdRef.current;
    setLoading(true);
    setError('');
    setShowSuggestHint(false);

    ApiService.searchDictionary(debounced, { tag: activeTag, limit: 30 })
      .then((res: any) => {
        if (requestId !== requestIdRef.current) return;
        const entries: DictionaryEntry[] = res?.entries || [];
        setResults(entries);
        setSuggestions(res?.suggestions || []);
        setSelected(entries.length > 0 ? entries[0] : null);
      })
      .catch((err: any) => {
        if (requestId !== requestIdRef.current) return;
        setResults([]);
        setSelected(null);
        setError(err?.message || 'تعذر تحميل نتائج البحث. يرجى المحاولة مرة أخرى.');
      })
      .finally(() => {
        if (requestId !== requestIdRef.current) return;
        setLoading(false);
      });
  }, [debounced, activeTag, reloadKey]);

  const handleSelect = useCallback(
    (entry: DictionaryEntry) => {
      setSelected(entry);
      persistRecent(entry.word);
      setShowSuggestHint(false);
      // يجلب المدخل كاملاً ويزيد عدّاد البحث
      ApiService.getDictionaryEntry(entry.id)
        .then((res: any) => {
          if (res?.entry) setSelected(res.entry);
        })
        .catch(() => {
          /* الإبطال صامت — النتيجة المعروضة كاملة بالفعل */
        });
    },
    [persistRecent]
  );

  const runQuery = useCallback((word: string) => {
    setQuery(word);
    setDebounced(word.trim());
    inputRef.current?.focus();
  }, []);

  const clearSearch = useCallback(() => {
    setQuery('');
    setDebounced('');
    setShowSuggestHint(false);
    inputRef.current?.focus();
  }, []);

  // ── البحث الصوتي ──
  const startListening = useCallback(() => {
    if (!SpeechCtor || recognitionRef.current) return;
    setVoiceError('');
    const recognition = new SpeechCtor();
    recognition.lang = 'ar-EG';
    recognition.interimResults = true;
    recognition.continuous = false;
    recognition.maxAlternatives = 1;

    recognition.onresult = (event: any) => {
      let transcript = '';
      for (let i = 0; i < event.results.length; i++) {
        transcript += event.results[i][0].transcript;
      }
      setInterim(transcript);
      setQuery(transcript);
      if (event.results[event.results.length - 1]?.isFinal) {
        setDebounced(transcript.trim());
      }
    };
    recognition.onerror = () => {
      setVoiceError('تعذّر سماع الصوت. تأكد من إذن الميكروفون.');
      setListening(false);
      setInterim('');
    };
    recognition.onend = () => {
      setListening(false);
      setInterim('');
      recognitionRef.current = null;
    };

    recognitionRef.current = recognition;
    setListening(true);
    try {
      recognition.start();
    } catch {
      setListening(false);
      recognitionRef.current = null;
    }
  }, [SpeechCtor]);

  const stopListening = useCallback(() => {
    const recognition = recognitionRef.current;
    if (!recognition) return;
    try {
      recognition.stop();
    } catch {
      /* تجاهل */
    }
    setListening(false);
  }, []);

  useEffect(() => {
    return () => {
      const recognition = recognitionRef.current;
      if (recognition) {
        try {
          recognition.abort();
        } catch {
          /* تجاهل */
        }
      }
    };
  }, []);

  const playAudio = useCallback((url?: string | null) => {
    if (!url) return;
    try {
      const audio = new Audio(url);
      void audio.play();
    } catch {
      /* تجاهل */
    }
  }, []);

  const wordCards = popular.length > 0 ? popular.map((e) => e.word) : WORDS_OF_THE_DAY;
  const hasQuery = debounced.length > 0;

  const renderCard = () => {
    if (!selected) return null;
    const antonyms = selected.antonyms || [];
    const synonyms = selected.synonyms || [];

    return (
      <article className="dict-card" aria-label={`كلمة ${selected.word}`}>
        <header className="dict-card__header">
          <div className="flex items-center gap-md" style={{ flexWrap: 'wrap' }}>
            <h2 className="dict-card__headword">{selected.word}</h2>
            {selected.type && <span className="dict-badge">{selected.type}</span>}
            {selected.root && (
              <span className="dict-badge dict-badge--root" title="الجذر">
                {selected.root}
              </span>
            )}
            {typeof selected.difficulty === 'number' && (
              <span className="dict-badge">المستوى: {DIFFICULTY_LABEL[selected.difficulty] || 'متوسط'}</span>
            )}
          </div>

          <div className="dict-card__actions">
            {selected.audio_url && (
              <button
                type="button"
                className="dict-icon-btn"
                onClick={() => playAudio(selected.audio_url)}
                aria-label={`استمع إلى نطق ${selected.word}`}
              >
                <span className="icon" aria-hidden="true">volume_up</span>
              </button>
            )}
            {selected.exam_context && <span className="dict-badge dict-badge--exam">{selected.exam_context}</span>}
          </div>
        </header>

        <section className="dict-section">
          <span className="dict-section__label">المعنى</span>
          <p className="dict-section__value">{selected.meaning}</p>
        </section>

        <div className="dict-section dict-grid-2">
          <div>
            <span className="dict-section__label">المفرد</span>
            <span className="dict-section__value">{selected.singular || '—'}</span>
          </div>
          <div>
            <span className="dict-section__label">الجمع</span>
            <span className="dict-section__value">{selected.plural || '—'}</span>
          </div>
        </div>

        <div className="dict-section dict-grid-2">
          <div>
            <span className="dict-section__label">المرادف</span>
            <span className="dict-section__value">{synonyms.length ? synonyms.join('، ') : '—'}</span>
          </div>
          <div>
            <span className="dict-section__label">المضاد</span>
            <span className={`dict-section__value ${antonyms.length ? 'dict-antonym' : 'dict-muted'}`}>
              {antonyms.length ? antonyms.join('، ') : '—'}
            </span>
          </div>
        </div>

        {selected.context && (
          <blockquote className="dict-quote">
            <p className="dict-quote__text">{selected.context}</p>
            <span className="dict-quote__attribution">سياق الورود</span>
          </blockquote>
        )}

        {selected.unit && (
          <p className="dict-muted" style={{ marginBlockStart: 'var(--spacing-md)' }}>
            {selected.unit}
          </p>
        )}

        {!!selected.tags?.length && (
          <div className="dict-tags">
            {selected.tags.map((tag) => (
              <span key={tag} className="dict-tag">
                {tag}
              </span>
            ))}
          </div>
        )}
      </article>
    );
  };

  const renderEmptyStart = () => (
    <div className="dict-state" role="status">
      <span className="icon dict-state__icon" aria-hidden="true">menu_book</span>
      <h3 className="dict-state__title">ابدأ الكتابة…</h3>
      <p className="dict-state__text">
        اكتب الكلمة التي أشكل عليك معناها في بيت الشعر أو قطعة النثر، وسنجده لك حتى لو كتبتها بلا تشكيل
        أو بـ«أ» مختلفة.
      </p>
      <div className="dict-word-chips" aria-label="كلمات اليوم">
        {wordCards.map((word) => (
          <button key={word} type="button" className="dict-chip" onClick={() => runQuery(word)}>
            {word}
          </button>
        ))}
      </div>
    </div>
  );

  const renderNoMatch = () => (
    <div className="dict-state" role="status">
      <span className="icon dict-state__icon" aria-hidden="true">search_off</span>
      <h3 className="dict-state__title">لم نجد «{debounced}»</h3>
      <p className="dict-state__text">جرّب تكتب الكلمة بدون تشكيل، أو بدون «ال» التعريف.</p>

      {suggestions.length > 0 && (
        <div className="dict-suggestions">
          <span className="dict-suggestions__label">هل تقصد…؟</span>
          <div className="dict-suggestions__list">
            {suggestions.map((s) => (
              <button key={s.word} type="button" className="dict-chip" onClick={() => runQuery(s.word)}>
                {s.word}
              </button>
            ))}
          </div>
        </div>
      )}

      <button type="button" className="dict-link-btn" onClick={() => setShowSuggestHint(true)}>
        اقترح إضافة كلمة
      </button>
      {showSuggestHint && (
        <p className="dict-hint">أرسل الكلمة للمعلم من صفحة الأسئلة وسنضيفها إلى المعجم.</p>
      )}
    </div>
  );

  const renderError = () => (
    <div className="dict-state dict-state--error" role="alert">
      <span className="icon dict-state__icon" aria-hidden="true">cloud_off</span>
      <h3 className="dict-state__title">تعذّر تحميل النتائج</h3>
      <p className="dict-state__text">{error}</p>
      <button
        type="button"
        className="dict-chip"
        onClick={() => setReloadKey((k) => k + 1)}
      >
        <span className="icon" aria-hidden="true">refresh</span>
        إعادة المحاولة
      </button>
    </div>
  );

  const renderSkeleton = () => (
    <div className="dict-skeleton-list" aria-hidden="true">
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className="dict-skeleton-row" />
      ))}
    </div>
  );

  return (
    <div className="dict-page">
      <header className="dict-header">
        {onBack && (
          <button type="button" className="dict-link-btn" style={{ alignSelf: 'start' }} onClick={onBack}>
            <span className="icon" aria-hidden="true" style={{ fontSize: '16px', verticalAlign: 'middle' }}>arrow_forward</span>
            {' '}العودة
          </button>
        )}
        <h1 className="dict-header__title">معجم فُصحى</h1>
        <p className="dict-header__lead">
          معاني المفردات الصعبة في الشعر والنثر والبلاغة، بشواهدها الحقيقية وورودها في امتحانات الثانوية العامة.
        </p>
        <div className="dict-header__divider" />
      </header>

      <div className="dict-search" role="search">
        <div className="dict-search__row">
          <div className="dict-search__field">
            <span className="icon dict-search__icon" aria-hidden="true">search</span>
            <input
              ref={inputRef}
              type="search"
              className="dict-search__input"
              value={query}
              placeholder={listening && interim ? interim : 'ابحث عن كلمة… مثال: الطلل'}
              aria-label="ابحث في معجم فُصحى"
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') setDebounced(query.trim());
              }}
            />
          </div>

          {voiceSupported && (
            <button
              type="button"
              className={`dict-icon-btn ${listening ? 'dict-icon-btn--listening' : ''}`}
              onClick={listening ? stopListening : startListening}
              aria-label={listening ? 'إيقاف البحث الصوتي' : 'البحث بالصوت'}
              aria-pressed={listening}
            >
              <span className="icon" aria-hidden="true">{listening ? 'graphic_eq' : 'mic'}</span>
            </button>
          )}

          {query.length > 0 && (
            <button type="button" className="dict-icon-btn dict-icon-btn--ghost" onClick={clearSearch} aria-label="مسح البحث">
              <span className="icon" aria-hidden="true">close</span>
            </button>
          )}
        </div>

        <div className="dict-chips" role="group" aria-label="تصفية النتائج">
          {FILTER_CHIPS.map((chip) => (
            <button
              key={chip.label}
              type="button"
              className="dict-chip"
              aria-pressed={chip.tag === activeTag}
              onClick={() => {
                setActiveTag(chip.tag);
                setReloadKey((k) => k + 1);
              }}
            >
              {chip.label}
            </button>
          ))}
        </div>

        {voiceError && (
          <p className="dict-hint" role="status" style={{ color: 'rgb(var(--error))' }}>
            {voiceError}
          </p>
        )}
        {listening && (
          <p className="dict-hint" role="status">جارٍ الاستماع… تكلّم الآن بالكلمة.</p>
        )}
      </div>

      <div className="dict-layout">
        {/* قائمة النتائج — في جهة البداية (يمين في RTL) */}
        <aside className="dict-rail">
          <div className="dict-rail__head">
            <strong style={{ fontSize: '13px' }}>النتائج</strong>
            <span className="dict-rail__count" aria-live="polite">
              {loading ? 'جارٍ البحث…' : `${results.length} كلمة`}
            </span>
          </div>

          {loading && renderSkeleton()}

          {!loading && !error && results.length === 0 && (
            <p className="dict-rail__count" style={{ padding: 'var(--spacing-md)' }}>
              {hasQuery ? 'لا توجد نتائج مطابقة.' : 'ابدأ بكتابة كلمة للبحث.'}
            </p>
          )}

          {!loading &&
            results.map((entry) => (
              <button
                key={entry.id}
                type="button"
                className="dict-row"
                aria-current={selected?.id === entry.id}
                onClick={() => handleSelect(entry)}
              >
                <span className="dict-row__text">
                  <span className="dict-row__word">{entry.word}</span>
                  <span className="dict-row__meta">
                    {[entry.type, entry.unit].filter(Boolean).join(' · ')}
                  </span>
                </span>
                <span className="icon dict-row__chevron" aria-hidden="true">chevron_left</span>
              </button>
            ))}
        </aside>

        {/* بطاقة الكلمة */}
        <div>
          {loading && !selected ? (
            renderSkeleton()
          ) : error ? (
            renderError()
          ) : selected ? (
            renderCard()
          ) : hasQuery ? (
            renderNoMatch()
          ) : (
            renderEmptyStart()
          )}
        </div>
      </div>

      {recent.length > 0 && (
        <section className="dict-panel" aria-label="عمليات البحث الأخيرة">
          <div className="dict-panel__head">
            <h3 className="dict-panel__title">
              <span className="icon" aria-hidden="true">history</span>
              بحثت مؤخراً
            </h3>
            <button
              type="button"
              className="dict-link-btn"
              onClick={() => {
                setRecent([]);
                try {
                  localStorage.removeItem(RECENT_KEY);
                } catch {
                  /* تجاهل */
                }
              }}
            >
              مسح الكل
            </button>
          </div>
          <div className="dict-word-chips">
            {recent.map((word) => (
              <button key={word} type="button" className="dict-chip" onClick={() => runQuery(word)}>
                {word}
              </button>
            ))}
          </div>
        </section>
      )}
    </div>
  );
};

export default Dictionary;
export { Dictionary };
