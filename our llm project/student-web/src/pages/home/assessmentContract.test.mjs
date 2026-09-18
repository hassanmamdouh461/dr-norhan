import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { compileFunction } from 'node:vm';
import ts from 'typescript';

// Offline hook/effect and JSX harness: no DOM, network, application bootstrap, or new dependencies.
function createHarness() {
  const cells = [];
  let cursor = 0;
  let effects = [];
  let dirty = false;
  let render;
  let output;
  const react = {
    useState(initial) {
      const index = cursor++;
      if (!(index in cells)) cells[index] = typeof initial === 'function' ? initial() : initial;
      return [cells[index], value => {
        const next = typeof value === 'function' ? value(cells[index]) : value;
        if (!Object.is(next, cells[index])) { cells[index] = next; dirty = true; }
      }];
    },
    useRef(initial) {
      const index = cursor++;
      return cells[index] ??= { current: initial };
    },
    useEffect(effect, deps) {
      const index = cursor++;
      const previous = cells[index];
      if (!previous || !deps || deps.some((value, i) => !Object.is(value, previous.deps?.[i]))) {
        cells[index] = { deps, cleanup: previous?.cleanup };
        effects.push(() => {
          cells[index].cleanup?.();
          cells[index].cleanup = effect();
        });
      }
    },
  };
  return {
    react,
    mount(callback) { render = callback; return this.flush(); },
    flush() {
      let count = 0;
      do {
        assert.ok(++count < 30, 'effects should settle');
        dirty = false;
        cursor = 0;
        effects = [];
        output = render();
        effects.forEach(effect => effect());
      } while (dirty);
      return output;
    },
    unmount() { cells.forEach(cell => cell?.cleanup?.()); },
  };
}

function environment() {
  const hooks = createHarness();
  const storage = new Map();
  const timers = new Map();
  const api = {};
  const toasts = [];
  const auth = { user: { id: 'student' } };
  let now = Date.parse('2026-01-01T00:00:00Z');
  let timerId = 0;
  const localStorage = {
    getItem: key => storage.get(key) ?? null,
    setItem: (key, value) => storage.set(key, value),
    removeItem: key => storage.delete(key),
  };
  const cache = new Map();
  const jsx = (type, props) => ({ type, props });
  function load(relative) {
    if (cache.has(relative)) return cache.get(relative);
    const source = readFileSync(new URL(relative, import.meta.url), 'utf8');
    const code = ts.transpileModule(source, {
      compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022 },
      fileName: relative,
    }).outputText;
    const exports = {};
    const require = name => {
      if (name === 'react') return hooks.react;
      if (name === 'react/jsx-runtime') return { jsx, jsxs: jsx };
      if (name.endsWith('/assessmentContract')) return load('./assessmentContract.ts');
      if (name.endsWith('/services/api')) return { ApiService: api };
      if (name.endsWith('/AuthContext')) return { useAuth: () => auth };
      if (name.endsWith('/ToastContext')) return { useToast: () => ({ showToast: (...args) => toasts.push(args) }) };
      if (name.endsWith('/Modal') || name.endsWith('/ZoomableImage')) return { default: name };
      throw new Error(`Unexpected import: ${name}`);
    };
    compileFunction(code, ['require', 'exports', 'localStorage', 'setInterval', 'clearInterval', 'Date', 'console'])(
      require, exports, localStorage,
      callback => { timers.set(++timerId, callback); return timerId; },
      id => timers.delete(id),
      class extends Date { static now() { return now; } },
      { error() {} },
    );
    cache.set(relative, exports);
    return exports;
  }
  return {
    hooks, api, auth, storage, localStorage, timers, toasts, load,
    advance(ms) { now += ms; [...timers.values()].forEach(callback => callback()); },
  };
}

const deferred = () => {
  let resolve;
  let reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
};
const settle = async () => { for (let i = 0; i < 6; i++) await Promise.resolve(); };
const question = { id: 'q1', question_text: 'Question', options: ['A', 'B'], correct_option: 'A' };
const exam = { id: 'exam', title: 'Assessment', max_score: 1, time_limit_mins: 1 };
const draft = { is_submitted: 0, started_at: '2026-01-01T00:00:00Z', answers: {} };
function nodes(tree, predicate) {
  if (Array.isArray(tree)) return tree.flatMap(child => nodes(child, predicate));
  if (!tree || typeof tree !== 'object') return [];
  return [...(predicate(tree) ? [tree] : []), ...nodes(tree.props?.children, predicate)];
}
function button(tree, text) {
  const found = nodes(tree, node => node.type === 'button' && (
    node.props.children === text || (Array.isArray(node.props.children) && node.props.children.includes(text))
  ))[0];
  assert.ok(found, `Missing button: ${text}`);
  return found.props;
}
const radios = tree => nodes(tree, node => node.type === 'input' && node.props.type === 'radio');

async function examFlow(attempt = draft, setup = () => {}) {
  const env = environment();
  env.api.getExamDetails = async () => ({ exam, questions: [question], attempt });
  let confirm;
  let refreshes = 0;
  setup(env);
  const { useExamFlow } = env.load('./useExamFlow.ts');
  env.hooks.mount(() => useExamFlow((...args) => env.toasts.push(args), async () => { refreshes++; }, value => { confirm = value; }, () => {}));
  await env.hooks.flush().handleOpenExam(exam.id);
  env.hooks.flush();
  return { ...env, get confirm() { return confirm; }, get refreshes() { return refreshes; } };
}

async function quizPanel(attempt = draft, setup = () => {}) {
  const env = environment();
  env.api.getLessonQuiz = async () => ({ quiz: exam, questions: [question], attempt });
  setup(env);
  const { QuizPanel } = env.load('../player/QuizPanel.tsx');
  env.hooks.mount(() => QuizPanel({ lessonId: 'lesson' }));
  await settle();
  env.hooks.flush();
  return env;
}

test('only numeric is_submitted === 1 is final', () => {
  const { isSubmittedAttempt } = environment().load('./assessmentContract.ts');
  for (const value of [null, undefined, {}, draft, { is_submitted: '1' }, { is_submitted: true }]) {
    assert.equal(isSubmittedAttempt(value), false);
  }
  assert.equal(isSubmittedAttempt({ is_submitted: 1 }), true);
});

test('answer validation rejects arrays, malformed JSON, primitives, and non-string values', () => {
  const { parseAssessmentAnswers } = environment().load('./assessmentContract.ts');
  for (const value of ['["A"]', ['A'], '{', 'null', '1', 'true', '"A"', null, { q1: 1 }, { q1: {} }, new Date()]) {
    assert.deepEqual(parseAssessmentAnswers(value), {});
  }
  assert.deepEqual(parseAssessmentAnswers('{"q1":"A"}'), { q1: 'A' });
  assert.deepEqual(parseAssessmentAnswers({ q1: 'A' }), { q1: 'A' });
});

test('draft restore merges server answers with newer local edits, including empty server answers', () => {
  const env = environment();
  const { restoreExamAnswers } = env.load('./assessmentContract.ts');
  env.storage.set('exam_answers_exam', '{"q1":"B"}');
  assert.deepEqual(restoreExamAnswers(draft, 'exam'), { q1: 'B' });
  assert.deepEqual(restoreExamAnswers({ ...draft, answers: { q1: 'A', q2: 'A' } }, 'exam'), { q1: 'B', q2: 'A' });
  assert.deepEqual(restoreExamAnswers(null, 'exam'), { q1: 'B' });
  assert.deepEqual(restoreExamAnswers({ is_submitted: 1, answers: { q1: 'A' } }, 'exam'), { q1: 'A' });
});

test('invalid saved answers and storage read/write/delete failures are safe', () => {
  const env = environment();
  const helper = env.load('./assessmentContract.ts');
  for (const invalid of ['{', '["B"]', '{"q1":null}']) {
    env.storage.set('exam_answers_exam', invalid);
    assert.deepEqual(helper.restoreExamAnswers({ ...draft, answers: { q1: 'A' } }, 'exam'), { q1: 'A' });
  }
  for (const method of ['getItem', 'setItem', 'removeItem']) env.localStorage[method] = () => { throw new Error('Storage blocked'); };
  assert.deepEqual(helper.restoreExamAnswers({ ...draft, answers: { q1: 'A' } }, 'exam'), { q1: 'A' });
  assert.equal(helper.saveExamDraft('exam', { q1: 'A' }), false);
  assert.doesNotThrow(() => helper.clearExamDraft('exam'));
});

test('countdown uses server start, cleans up, and submits an already-expired attempt once', () => {
  const env = environment();
  const { startAssessmentCountdown } = env.load('./assessmentContract.ts');
  const ticks = [];
  let timeouts = 0;
  const cleanup = startAssessmentCountdown(draft.started_at, 1, value => ticks.push(value), () => timeouts++);
  assert.equal(ticks.at(-1), 60);
  env.advance(20_000);
  assert.equal(ticks.at(-1), 40);
  env.advance(40_000);
  assert.equal(ticks.at(-1), 0);
  assert.equal(timeouts, 1);
  assert.equal(env.timers.size, 0);
  cleanup();
  startAssessmentCountdown(draft.started_at, 1, () => {}, () => timeouts++);
  assert.equal(timeouts, 2);
  assert.equal(env.timers.size, 0);
  startAssessmentCountdown('invalid', 1, value => assert.equal(value, null), () => assert.fail('invalid start timed out'));
  startAssessmentCountdown(draft.started_at, 0, value => assert.equal(value, null), () => assert.fail('untimed exam timed out'));
});

test('exam draft restores, autosaves, warns before close, and survives reopen', async () => {
  const env = await examFlow(draft, env => env.storage.set('exam_answers_exam', '{"q1":"B"}'));
  assert.deepEqual(env.hooks.flush().examAnswers, { q1: 'B' });
  env.hooks.flush().setExamAnswers({ q1: 'A' });
  env.hooks.flush().handleCloseExamModal();
  assert.equal(env.storage.get('exam_answers_exam'), '{"q1":"A"}');
  assert.ok(env.confirm);
  env.confirm.onConfirm();
  assert.equal(env.hooks.flush().showExamModal, false);
  await env.hooks.flush().handleOpenExam('exam');
  assert.deepEqual(env.hooks.flush().examAnswers, { q1: 'A' });
});

test('unanswered draft also warns on close and blocked storage does not claim answers are saved', async () => {
  const env = await examFlow(draft, env => { env.localStorage.setItem = () => { throw new Error('Quota'); }; });
  env.hooks.flush().handleCloseExamModal();
  assert.match(env.confirm.message, /تعذّر حفظ/);
  assert.equal(env.hooks.flush().showExamModal, true);
});

test('submitted exam ignores local drafts, cannot submit, and closes without warning', async () => {
  const env = await examFlow({ is_submitted: 1, answers: { q1: 'A' } }, env => env.storage.set('exam_answers_exam', '{"q1":"B"}'));
  env.api.submitExamAnswers = () => assert.fail('submitted exam must not submit');
  const flow = env.hooks.flush();
  assert.deepEqual(flow.examAnswers, { q1: 'A' });
  await flow.handleSubmitExam(true);
  flow.handleManualSubmitExam({ preventDefault() {} });
  flow.handleCloseExamModal();
  assert.equal(env.confirm, undefined);
  assert.equal(env.hooks.flush().showExamModal, false);
  assert.equal(env.storage.get('exam_answers_exam'), '{"q1":"B"}');
});

test('exam same-tick manual/timeout submissions lock immediately; failures retain answers and can retry', async () => {
  const env = await examFlow();
  env.hooks.flush().setExamAnswers({ q1: 'A' });
  let flow = env.hooks.flush();
  const request = deferred();
  let calls = 0;
  env.api.submitExamAnswers = (_id, answers) => { calls++; assert.deepEqual(answers, { q1: 'A' }); return request.promise; };
  const pending = flow.handleSubmitExam(true);
  flow.handleManualSubmitExam({ preventDefault() {} });
  await flow.handleSubmitExam(false);
  flow.handleCloseExamModal();
  assert.equal(calls, 1);
  assert.equal(env.confirm, null);
  request.reject(new Error('Offline'));
  await pending;
  flow = env.hooks.flush();
  assert.deepEqual(flow.examAnswers, { q1: 'A' });
  assert.equal(flow.showExamModal, true);
  assert.equal(flow.submittingExam, false);
  assert.equal(env.storage.get('exam_answers_exam'), '{"q1":"A"}');
  env.api.submitExamAnswers = async () => { calls++; return { score: 1, max_score: 1 }; };
  env.localStorage.removeItem = () => { throw new Error('Blocked'); };
  await flow.handleSubmitExam(false);
  await flow.handleSubmitExam(true);
  assert.equal(calls, 2, 'stale callbacks must stay locked after success');
  assert.equal(env.hooks.flush().showExamModal, false);
  assert.equal(env.refreshes, 1);
  assert.equal(env.toasts.at(-1)[0], 'success');
});

test('exam timeout dismisses pending manual confirmation and ignores its stale callback after success', async () => {
  const env = await examFlow();
  const flow = env.hooks.flush();
  flow.handleManualSubmitExam({ preventDefault() {} });
  const confirm = env.confirm;
  let calls = 0;
  env.api.submitExamAnswers = async () => { calls++; return { score: 0, max_score: 1 }; };
  await flow.handleSubmitExam(true);
  confirm.onConfirm();
  await settle();
  assert.equal(calls, 1);
  assert.equal(env.confirm, null);
});

test('ExamModal renders an editable draft and uses the latest timeout callback without restarting its timer', () => {
  const env = environment();
  const { ExamModal } = env.load('./modals/ExamModal.tsx');
  let latest = 0;
  let old = 0;
  const props = { selectedExam: exam, examQuestions: [question], examAttempt: draft, examAnswers: {}, setExamAnswers() {}, submittingExam: false, onClose() {}, onManualSubmit() {}, onTimeout: () => old++ };
  let tree = env.hooks.mount(() => ExamModal(props));
  assert.equal(nodes(tree, node => node.type === 'form').length, 1);
  assert.equal(button(tree, 'A').disabled, false);
  const timer = [...env.timers.keys()][0];
  props.examAnswers = { q1: 'B' };
  props.onTimeout = () => latest++;
  env.hooks.flush();
  assert.equal([...env.timers.keys()][0], timer);
  env.advance(60_000);
  assert.equal(old, 0);
  assert.equal(latest, 1);
  props.examAnswers = { q1: 'A' };
  env.hooks.flush();
  assert.equal(latest, 1, 'answer edits do not repeatedly autosubmit after expiry');
  props.examAttempt = { is_submitted: 1, score: 1, submitted_at: draft.started_at };
  tree = env.hooks.flush();
  assert.equal(nodes(tree, node => node.type === 'form').length, 0);
  assert.equal(env.timers.size, 0);
});

test('QuizPanel initial load failure retries successfully without duplicate in-flight requests', async () => {
  const request = deferred();
  let calls = 0;
  const env = await quizPanel(draft, env => {
    env.api.getLessonQuiz = async lessonId => {
      assert.equal(lessonId, 'lesson');
      calls++;
      if (calls === 1) throw new Error('Temporary load failure');
      return request.promise;
    };
  });
  const tree = env.hooks.flush();
  assert.equal(calls, 1);
  assert.ok(nodes(tree, node => node.props.role === 'alert' && node.props.children === 'Temporary load failure').length);
  const retry = button(tree, 'إعادة المحاولة');
  assert.equal(retry.type, 'button');
  assert.equal(retry['aria-label'], 'إعادة محاولة تحميل الواجب');
  assert.equal(retry.disabled, false);
  const pending = retry.onClick();
  await retry.onClick();
  assert.equal(calls, 2, 'same-tick retry clicks must share the in-flight guard');
  assert.equal(radios(env.hooks.flush()).length, 0);
  await retry.onClick();
  assert.equal(calls, 2, 'stale retry callbacks cannot duplicate a pending request');
  request.resolve({ quiz: exam, questions: [question], attempt: { ...draft, answers: { q1: 'B' } } });
  await pending;
  const loaded = env.hooks.flush();
  assert.equal(radios(loaded).length, 2);
  assert.equal(radios(loaded)[1].props.checked, true);
  assert.equal(radios(loaded)[1].props.disabled, false);
  assert.equal(nodes(loaded, node => node.props.role === 'alert').length, 0);
  assert.equal(env.timers.size, 1);
  env.hooks.unmount();
});

test('QuizPanel releases the load guard after a failed retry and permits another retry', async () => {
  let calls = 0;
  const env = await quizPanel(draft, env => {
    env.api.getLessonQuiz = async () => {
      calls++;
      if (calls <= 2) throw new Error('Temporary load failure');
      return { quiz: exam, questions: [question], attempt: draft };
    };
  });
  await button(env.hooks.flush(), 'إعادة المحاولة').onClick();
  assert.equal(calls, 2);
  await button(env.hooks.flush(), 'إعادة المحاولة').onClick();
  assert.equal(calls, 3);
  assert.equal(radios(env.hooks.flush()).length, 2);
  env.hooks.unmount();
});

test('QuizPanel same-quiz reload preserves local draft edits but submitted answers remain authoritative', async () => {
  const env = await quizPanel(draft, env => {
    env.api.getLessonQuiz = async () => { throw new Error('Initial failure'); };
  });
  const reload = button(env.hooks.flush(), 'إعادة المحاولة').onClick;
  env.api.getLessonQuiz = async () => ({ quiz: exam, questions: [question], attempt: draft });
  await reload();
  radios(env.hooks.flush())[1].props.onChange();
  env.hooks.flush();
  env.api.getLessonQuiz = async () => { throw new Error('Reload failure'); };
  await reload();
  assert.equal(radios(env.hooks.flush())[1].props.checked, true);
  env.api.getLessonQuiz = async () => ({ quiz: exam, questions: [question], attempt: { ...draft, answers: { q1: 'A' } } });
  await reload();
  assert.equal(radios(env.hooks.flush())[1].props.checked, true, 'newer local draft wins over server draft');
  env.api.getLessonQuiz = async () => ({ quiz: exam, questions: [question], attempt: { ...draft, is_submitted: 1, answers: { q1: 'A' } } });
  await reload();
  const submitted = env.hooks.flush();
  assert.equal(radios(submitted).length, 0);
  assert.ok(nodes(submitted, node => node.type === 'p' && Array.isArray(node.props.children) && node.props.children.includes('A')).length);
  env.hooks.unmount();
});

test('QuizPanel restores draft answers, renders editable inputs, and keeps a live countdown', async () => {
  const env = await quizPanel({ ...draft, answers: { q1: 'B' } });
  let tree = env.hooks.flush();
  assert.equal(radios(tree).length, 2);
  assert.equal(radios(tree)[1].props.checked, true);
  assert.equal(radios(tree)[0].props.disabled, false);
  const timer = [...env.timers.keys()][0];
  radios(tree)[0].props.onChange();
  tree = env.hooks.flush();
  assert.equal(radios(tree)[0].props.checked, true);
  assert.equal([...env.timers.keys()][0], timer);
  env.hooks.unmount();
  assert.equal(env.timers.size, 0);
});

test('QuizPanel renders results and no timer only for submitted attempts', async () => {
  const env = await quizPanel({ ...draft, is_submitted: 1, score: 1, answers: { q1: 'A' } });
  assert.equal(radios(env.hooks.flush()).length, 0);
  assert.equal(env.timers.size, 0);
});

test('quiz timeout/manual race sends latest answers once and failed submission remains editable for retry', async () => {
  const request = deferred();
  let calls = 0;
  const env = await quizPanel(draft, env => {
    env.api.submitQuizAnswers = (_id, answers) => { calls++; assert.deepEqual(answers, { q1: 'B' }); return request.promise; };
  });
  radios(env.hooks.flush())[1].props.onChange();
  button(env.hooks.flush(), 'تسليم إجابات الواجب').onClick();
  const confirm = button(env.hooks.flush(), 'تأكيد التسليم').onClick;
  env.advance(60_000);
  await confirm();
  assert.equal(calls, 1);
  request.reject(new Error('Offline'));
  await settle();
  let tree = env.hooks.flush();
  assert.equal(radios(tree)[1].props.checked, true);
  assert.equal(radios(tree)[1].props.disabled, false);
  assert.ok(nodes(tree, node => node.type === 'p' && node.props.children === 'Offline').length);
  radios(tree)[0].props.onChange();
  env.hooks.flush();
  assert.equal(calls, 1, 'answer edits after timeout must not trigger an automatic retry');
  env.api.submitQuizAnswers = async () => { calls++; return { score: 1, max_score: 1 }; };
  env.api.getLessonQuiz = async () => { throw new Error('Refresh failed'); };
  const retry = button(env.hooks.flush(), 'تأكيد التسليم').onClick;
  await retry();
  await retry();
  tree = env.hooks.flush();
  assert.equal(calls, 2);
  assert.equal(radios(tree).length, 0, 'accepted result survives refresh failure');
  assert.equal(env.timers.size, 0);
});

test('already-expired empty quiz submits once and permits manual retry after failure', async () => {
  let calls = 0;
  const env = await quizPanel({ ...draft, started_at: '2025-12-31T23:00:00Z' }, env => {
    env.api.submitQuizAnswers = async (_id, answers) => { calls++; assert.deepEqual(answers, {}); throw new Error('Offline'); };
  });
  await settle();
  const tree = env.hooks.flush();
  assert.equal(calls, 1);
  assert.equal(env.timers.size, 0);
  const submit = button(tree, 'تسليم إجابات الواجب');
  assert.equal(submit.disabled, false);
  submit.onClick();
  await button(env.hooks.flush(), 'تأكيد التسليم').onClick();
  assert.equal(calls, 2);
});

test('exam manual-first timeout race stays locked and a successful submission clears the saved draft', async () => {
  const request = deferred();
  let calls = 0;
  const env = await examFlow({ ...draft, answers: { q1: 'A' } });
  env.api.submitExamAnswers = () => { calls++; return request.promise; };
  const flow = env.hooks.flush();
  flow.handleManualSubmitExam({ preventDefault() {} });
  await flow.handleSubmitExam(true);
  assert.equal(calls, 1);
  request.resolve({ score: 1, max_score: 1 });
  await settle();
  assert.equal(env.hooks.flush().showExamModal, false);
  assert.equal(env.storage.has('exam_answers_exam'), false);
});

test('quiz manual-first timeout race stays locked through successful result refresh', async () => {
  const request = deferred();
  let calls = 0;
  const env = await quizPanel({ ...draft, answers: { q1: 'A' } });
  env.api.submitQuizAnswers = () => { calls++; return request.promise; };
  button(env.hooks.flush(), 'تسليم إجابات الواجب').onClick();
  const pending = button(env.hooks.flush(), 'تأكيد التسليم').onClick();
  env.advance(60_000);
  assert.equal(calls, 1);
  env.api.getLessonQuiz = async () => ({ quiz: exam, questions: [question], attempt: { ...draft, is_submitted: 1, score: 1, answers: { q1: 'A' } } });
  request.resolve({ score: 1, max_score: 1 });
  await pending;
  assert.equal(radios(env.hooks.flush()).length, 0);
  assert.equal(env.timers.size, 0);
});

test('ExamModal handles an already-expired draft without an interval initialization error', () => {
  const env = environment();
  const { ExamModal } = env.load('./modals/ExamModal.tsx');
  let calls = 0;
  const attempt = { ...draft, started_at: '2025-12-31T23:00:00Z' };
  env.hooks.mount(() => ExamModal({
    selectedExam: exam, examQuestions: [question],
    examAttempt: attempt, examAnswers: {},
    setExamAnswers() {}, submittingExam: false, onClose() {}, onManualSubmit() {}, onTimeout: () => calls++,
  }));
  assert.equal(calls, 1);
  assert.equal(env.timers.size, 0);
});

test('activation is wired to the existing forced exam refresh callback', () => {
  const source = readFileSync(new URL('../Home.tsx', import.meta.url), 'utf8');
  assert.match(source, /useRedeemFlow\(refreshWithExams, showToast\)/);
  assert.match(source, /Promise\.all\(\[loadData\(\), loadExamsData\(true\)\]\)/);
});
