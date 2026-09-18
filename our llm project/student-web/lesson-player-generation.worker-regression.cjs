// Offline regression helper: execute the owned source's functions with fake APIs,
// timers and media objects. This is not a browser or React reconciliation test.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { test } = require('node:test');
const ts = require('./node_modules/typescript');

const filename = path.join(__dirname, 'src/pages/LessonPlayer.tsx');
const source = fs.readFileSync(filename, 'utf8');
const ast = ts.createSourceFile(filename, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
let component;
function visit(node) {
  if (ts.isVariableDeclaration(node) && node.name.getText(ast) === 'LessonPlayer') component = node.initializer;
  ts.forEachChild(node, visit);
}
visit(ast);
assert.ok(component);
const functions = new Set([
  'isCurrentInitialization', 'invalidateInitialization', 'logDebug', 'loadCourseLessons',
  'loadLessonDetails', 'initializePlayer', 'setupHlsPlayer', 'handleOpenPdf', 'handleOpenInlinePdf',
]);
const stateNames = [];
const refNames = [];
const declarations = component.body.statements.filter(statement => {
  if (!ts.isVariableStatement(statement)) return false;
  const declaration = statement.declarationList.declarations[0];
  const initializer = declaration.initializer;
  if (ts.isCallExpression(initializer) && initializer.expression.getText(ast) === 'useState') {
    stateNames.push(declaration.name.elements[0].getText(ast));
    return true;
  }
  if (ts.isCallExpression(initializer) && initializer.expression.getText(ast) === 'useRef') {
    refNames.push(declaration.name.getText(ast));
    return true;
  }
  return functions.has(declaration.name.getText(ast));
}).map(statement => statement.getText(ast)).join('\n');
const effects = component.body.statements.filter(ts.isExpressionStatement).map(statement => statement.expression)
  .filter(expression => ts.isCallExpression(expression) && ['useEffect', 'useLayoutEffect'].includes(expression.expression.getText(ast)));
const lifecycle = effects.find(expression => expression.expression.getText(ast) === 'useLayoutEffect' && expression.getText(ast).includes('initializePlayer'));
const quizEffect = effects.find(expression => expression.getText(ast).includes('setQuizLessonId'));
const youtubeEffect = effects.find(expression => expression.getText(ast).includes('new (window as any).YT.Player'));
const heartbeatEffect = effects.find(expression => expression.getText(ast).includes('ApiService.sendHeartbeat'));
assert.ok(lifecycle, 'Lesson invalidation must run at layout commit');
assert.ok(quizEffect);
let quizExpression;
function findQuiz(node) {
  if (ts.isJsxExpression(node) && node.expression?.getText(ast).includes('<QuizPanel')) quizExpression = node.expression;
  ts.forEachChild(node, findQuiz);
}
findQuiz(component.body);
assert.ok(quizExpression);
const compiled = ts.transpileModule([
  declarations.replace("import('hls.js')", '__loadHls()'),
  `globalThis.subject = { ${[...functions].join(', ')},`,
  `lifecycle: ${lifecycle.arguments[0].getText(ast)},`,
  `quizEffect: ${quizEffect.arguments[0].getText(ast)},`,
  `youtubeEffect: ${youtubeEffect.arguments[0].getText(ast)},`,
  `heartbeatEffect: ${heartbeatEffect.arguments[0].getText(ast)},`,
  `quizTree: () => (${quizExpression.getText(ast)}) };`,
].join('\n'), { compilerOptions: { target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.React } }).outputText;

function deferred() {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
async function flush() { for (let i = 0; i < 15; i += 1) await Promise.resolve(); }
function media() {
  const listeners = new Map();
  return {
    listeners, currentTime: 0, duration: 100, plays: 0, pauses: 0,
    addEventListener(name, callback) { listeners.set(name, callback); },
    removeEventListener(name, callback) { if (listeners.get(name) === callback) listeners.delete(name); },
    canPlayType() { return 'probably'; },
    play() { this.plays += 1; return Promise.resolve(); },
    pause() { this.pauses += 1; },
  };
}
function fixture() {
  const state = {}, refs = {}, writes = [], calls = [], timers = new Map(), logs = [], blobs = [], instances = [];
  let timerId = 0;
  class Hls {
    static Events = { MANIFEST_PARSED: 'manifest', ERROR: 'error' };
    static ErrorTypes = { MEDIA_ERROR: 'media', NETWORK_ERROR: 'network' };
    static isSupported() { return true; }
    constructor() { this.events = {}; this.levels = ['720p']; this.currentLevel = 0; instances.push(this); }
    loadSource(url) { this.url = url; }
    attachMedia(video) { this.video = video; }
    on(name, callback) { this.events[name] = callback; }
    destroy() {
      this.destroyed = true;
      if (this.video) this.video.currentTime = 0;
    }
    recoverMediaError() { this.recovered = true; }
    startLoad() { this.started = true; }
  }
  const request = (method, args) => {
    const pending = deferred();
    calls.push({ method, args, ...pending });
    return pending.promise;
  };
  const api = Object.fromEntries(['getPlaybackUrl', 'getLessonDetails', 'getCourseDetails', 'getFileBlob', 'sendPlaybackLog', 'sendHeartbeat']
    .map(method => [method, (...args) => request(method, args)]));
  const window = { location: { href: '' } };
  const storage = new Map();
  function render(lessonId = 'A') {
    let stateIndex = 0, refIndex = 0;
    const context = vm.createContext({
      lessonId, user: { id: 'student' }, profile: { full_name: 'Student', phone: '' }, ApiService: api,
      window, console: Object.fromEntries(['info', 'warn', 'error'].map(level => [level, (...args) => logs.push([level, ...args])])),
      localStorage: { getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value) },
      URL: { createObjectURL: blob => { blobs.push(blob); return `blob:${blobs.length}`; }, revokeObjectURL() {} },
      setTimeout(callback) { const id = ++timerId; timers.set(id, callback); return id; },
      clearTimeout(id) { timers.delete(id); },
      setInterval(callback) { const id = ++timerId; timers.set(id, callback); return id; },
      clearInterval(id) { timers.delete(id); },
      document: { querySelector() { return {}; }, createElement() { return {}; } },
      __loadHls: () => request('loadHls', []),
      useCallback: callback => callback,
      useRef(initial) { const name = refNames[refIndex++]; return refs[name] ??= { current: initial }; },
      useState(initial) {
        const name = stateNames[stateIndex++];
        if (!(name in state)) state[name] = initial;
        return [state[name], value => {
          state[name] = typeof value === 'function' ? value(state[name]) : value;
          writes.push(name);
        }];
      },
      React: { createElement: (type, props, ...children) => ({ type, props: props ?? {}, children }) },
      QuizPanel: 'QuizPanel', Suspense: 'Suspense', SidebarPanelLoader: 'SidebarPanelLoader',
    });
    vm.runInContext(compiled, context);
    refs.videoRef.current ??= media();
    return context.subject;
  }
  const take = method => {
    const call = calls.find(item => item.method === method && !item.taken);
    assert.ok(call, `Expected ${method} request`);
    call.taken = true;
    return call;
  };
  const runTimer = () => {
    assert.equal(timers.size, 1);
    const [id, callback] = [...timers][0];
    timers.delete(id);
    callback();
  };
  return { render, take, runTimer, state, refs, writes, timers, calls, logs, blobs, instances, Hls, window, storage };
}
const playback = (id, provider = 'server') => ({ provider, playback_url: `${id}.${provider === 'hls' ? 'm3u8' : 'mp4'}`, last_position: 8, watermark_text: id });
async function finishInitialization(f, id = 'A', provider = 'server') {
  f.take('getPlaybackUrl').resolve(playback(id, provider));
  await flush();
  f.take('getLessonDetails').resolve({ lesson: { attachments: [] } });
  await flush();
  f.take('sendPlaybackLog').resolve({});
  await flush();
}

for (const reject of [false, true]) {
  test(`stale playback ${reject ? 'authorization error' : 'result'} cannot affect the new lesson`, async () => {
    const f = fixture(), a = f.render('A');
    const old = a.initializePlayer(), request = f.take('getPlaybackUrl');
    a.invalidateInitialization();
    const b = f.render('B'), current = b.initializePlayer();
    await finishInitialization(f, 'B');
    await current;
    const writes = f.writes.length, logs = f.logs.length;
    if (reject) request.reject({ status: 403, message: 'stale denial' });
    else request.resolve(playback('A'));
    await old;
    assert.equal(f.writes.length, writes);
    assert.equal(f.logs.length, logs);
    assert.equal(f.state.playbackData.playback_url, 'B.mp4');
    assert.equal(f.state.watermarkText, 'B');
    assert.equal(f.window.location.href, '');
    assert.equal(f.timers.size, 1);
  });
}

test('current authorization failure still redirects; retry replaces an in-flight request', async () => {
  const f = fixture(), a = f.render();
  const first = a.initializePlayer(), stale = f.take('getPlaybackUrl');
  const retry = a.initializePlayer(), current = f.take('getPlaybackUrl');
  stale.reject({ message: 'old failure' });
  await first;
  assert.equal(f.state.errorMessage, null);
  assert.equal(f.state.loading, true);
  current.reject({ status: 401, message: 'current denial' });
  await retry;
  assert.equal(f.window.location.href, '/login');
});

for (const stage of ['getLessonDetails', 'getCourseDetails', 'sendPlaybackLog']) {
  test(`unmount suppresses completion at ${stage}`, async () => {
    const f = fixture(), a = f.render();
    const cleanup = a.lifecycle();
    f.take('getPlaybackUrl').resolve(playback('A'));
    await flush();
    if (stage !== 'getLessonDetails') {
      f.take('getLessonDetails').resolve({ lesson: { attachments: [], ...(stage === 'getCourseDetails' ? { course_id: 'course-A' } : {}) } });
      await flush();
    }
    const pending = f.take(stage);
    cleanup();
    const writes = f.writes.length, logs = f.logs.length;
    pending.resolve(stage === 'getLessonDetails'
      ? { lesson: { course_id: 'old', attachments: [{ type: 'pdf', url: 'old.pdf', title: 'Old' }] } }
      : stage === 'getCourseDetails' ? { units: [{ lessons: [{ id: 'old' }] }] } : {});
    await flush();
    assert.equal(f.writes.length, writes);
    assert.equal(f.logs.length, logs);
    assert.equal(f.timers.size, 0);
    assert.equal(f.calls.filter(call => call.method === 'getFileBlob').length, 0);
  });
}

for (const detached of [false, true]) {
  test(`unmount persists ${detached ? 'tracked position when the video ref is detached' : 'video position before HLS destruction resets it'}`, async () => {
    const f = fixture(), a = f.render('A');
    const cleanup = a.lifecycle();
    await finishInitialization(f, 'A', 'hls');
    f.runTimer();
    f.take('loadHls').resolve({ default: f.Hls });
    await flush();
    const hls = f.instances[0], video = f.refs.videoRef.current;
    video.currentTime = 73.9;
    f.refs.lastPositionSeconds.current = 42;
    if (detached) f.refs.videoRef.current = null;

    cleanup();

    const expectedPosition = detached ? 42 : 73;
    assert.equal(hls.destroyed, true);
    assert.equal(video.currentTime, 0);
    assert.equal(f.refs.hlsRef.current, null);
    assert.equal(f.storage.get('video_progress_A'), String(expectedPosition));
    assert.deepEqual(f.take('sendPlaybackLog').args, ['A', 'close', expectedPosition]);
  });
}

test('lesson layout cleanup and retry cancel pending setup, including already queued callbacks', async () => {
  for (const retry of [false, true]) {
    const f = fixture(), a = f.render();
    const cleanup = a.lifecycle();
    await finishInitialization(f);
    const callback = [...f.timers.values()][0];
    if (retry) void a.initializePlayer();
    else cleanup();
    assert.equal(f.timers.size, 0);
    callback();
    await flush();
    assert.equal(f.refs.videoRef.current.src, undefined);
    assert.equal(f.refs.videoRef.current.plays, 0);
  }
});

for (const reject of [false, true]) {
  test(`stale lazy HLS import ${reject ? 'rejection' : 'resolution'} cannot set up or fail the new player`, async () => {
    const f = fixture(), a = f.render();
    void a.initializePlayer();
    await finishInitialization(f, 'A', 'hls');
    f.runTimer();
    const imported = f.take('loadHls');
    void a.initializePlayer();
    const writes = f.writes.length, logs = f.logs.length;
    if (reject) imported.reject(new Error('old import failed'));
    else imported.resolve({ default: f.Hls });
    await flush();
    assert.equal(f.instances.length, 0);
    assert.equal(f.writes.length, writes);
    assert.equal(f.logs.length, logs);
    assert.equal(f.state.loading, true);
  });
}

test('current HLS import failure is handled by the retryable error state', async () => {
  const f = fixture(), a = f.render();
  void a.initializePlayer();
  await finishInitialization(f, 'A', 'hls');
  f.runTimer();
  f.take('loadHls').reject(new Error('current import failed'));
  await flush();
  assert.equal(f.state.errorMessage, 'current import failed');
  assert.equal(f.state.loading, false);
});

test('HLS callbacks work while current, then become inert and the instance is destroyed', async () => {
  const f = fixture(), a = f.render();
  void a.initializePlayer();
  await finishInitialization(f, 'A', 'hls');
  f.runTimer();
  f.take('loadHls').resolve({ default: f.Hls });
  await flush();
  const hls = f.instances[0], video = f.refs.videoRef.current;
  hls.events.manifest();
  assert.equal(f.state.currentQuality, 0);
  assert.equal(video.currentTime, 8);
  assert.equal(video.plays, 1);
  void a.initializePlayer();
  const writes = f.writes.length, logs = f.logs.length;
  hls.events.manifest();
  hls.events.error(null, { fatal: true, type: 'media' });
  assert.equal(hls.destroyed, true);
  assert.equal(f.refs.hlsRef.current, null);
  assert.equal(f.writes.length, writes);
  assert.equal(f.logs.length, logs);
  assert.equal(video.plays, 1);
  assert.equal(hls.recovered, undefined);
});

for (const provider of ['server', 'hls']) {
  test(`${provider === 'server' ? 'direct' : 'native HLS'} metadata listeners are removed and stale callbacks cannot seek or play`, async () => {
    const f = fixture(), a = f.render();
    void a.initializePlayer();
    await finishInitialization(f, 'A', provider);
    f.runTimer();
    if (provider === 'hls') {
      f.Hls.isSupported = () => false;
      f.take('loadHls').resolve({ default: f.Hls });
      await flush();
    }
    const video = f.refs.videoRef.current, metadata = video.listeners.get('loadedmetadata');
    metadata();
    assert.equal(video.currentTime, 8);
    assert.equal(video.plays, 1);
    a.invalidateInitialization();
    video.currentTime = 22;
    assert.equal(video.listeners.size, 0);
    metadata();
    assert.equal(video.currentTime, 22);
    assert.equal(video.plays, 1);
  });
}

for (const inline of [false, true]) {
  for (const reject of [false, true]) {
    test(`stale ${inline ? 'inline' : 'modal'} PDF ${reject ? 'error/finally' : 'result/finally'} cannot overwrite current loading or create a blob URL`, async () => {
      const f = fixture(), a = f.render();
      const first = inline ? a.handleOpenInlinePdf('A.pdf', 'A') : a.handleOpenPdf('A.pdf');
      const pending = f.take('getFileBlob');
      a.invalidateInitialization();
      const b = f.render('B');
      const current = inline ? b.handleOpenInlinePdf('B.pdf', 'B') : b.handleOpenPdf('B.pdf');
      const currentRequest = f.take('getFileBlob'), writes = f.writes.length;
      if (reject) pending.reject(new Error('old PDF failed'));
      else pending.resolve({ id: 'A' });
      await first;
      assert.equal(f.writes.length, writes);
      assert.equal(f.state[inline ? 'inlinePdfLoading' : 'pdfLoading'], true);
      assert.equal(f.blobs.length, 0);
      currentRequest.resolve({ id: 'B' });
      await current;
      assert.equal(f.state[inline ? 'inlinePdfLoading' : 'pdfLoading'], false);
      assert.equal(f.blobs.length, 1);
      assert.equal(f.blobs[0].id, 'B');
    });
  }
}

test('YouTube deferred setup and callbacks cannot act after retry invalidation', () => {
  const f = fixture();
  let a = f.render();
  f.state.playbackData = { provider: 'youtube', youtube_id: 'abcdefghijk' };
  f.state.loading = false;
  f.refs.ytContainerRef.current = { appendChild() {}, innerHTML: '' };
  a = f.render();
  const cleanup = a.youtubeEffect();
  assert.equal(f.timers.size, 1);
  a.invalidateInitialization();
  let created = 0;
  f.window.YT = { Player: class { constructor() { created += 1; } } };
  f.runTimer();
  assert.equal(created, 0);
  cleanup();

  f.state.playbackGeneration = f.refs.initializationGenerationRef.current;
  let events;
  f.window.YT = { Player: class { constructor(_id, options) { events = options.events; } destroy() {} } };
  a = f.render();
  const currentCleanup = a.youtubeEffect();
  assert.ok(events);
  a.invalidateInitialization();
  const writes = f.writes.length;
  events.onReady({});
  events.onStateChange({});
  events.onError({ data: 100 });
  assert.equal(f.writes.length, writes);
  currentCleanup();
});

for (const reject of [false, true]) {
  test(`stale heartbeat ${reject ? 'security error' : 'result'} cannot alter the next lesson`, async () => {
    const f = fixture();
    let a = f.render();
    f.state.playbackData = { provider: 'server' };
    f.state.loading = false;
    f.refs.videoRef.current.currentTime = 60;
    a = f.render();
    const cleanup = a.heartbeatEffect();
    f.runTimer();
    const pending = f.take('sendHeartbeat');
    a.invalidateInitialization();
    const writes = f.writes.length, pauses = f.refs.videoRef.current.pauses;
    if (reject) pending.reject({ status: 403, code: 'ACCOUNT_BLOCKED' });
    else pending.resolve({});
    await flush();
    assert.equal(f.writes.length, writes);
    assert.equal(f.refs.lastPositionSeconds.current, 0);
    assert.equal(f.refs.videoRef.current.pauses, pauses);
    cleanup();
  });
}

test('quiz stays lazy, retains its lesson-keyed subtree while hidden, and resets on lesson changes', () => {
  const f = fixture();
  let a = f.render('A');
  a.quizEffect();
  assert.equal(a.quizTree(), false);
  f.state.activeSidebarTab = 'quiz';
  a = f.render('A');
  a.quizEffect();
  const opened = a.quizTree();
  const panel = opened.children[0].children[0];
  assert.equal(panel.type, 'QuizPanel');
  assert.equal(panel.props.key, 'A');
  assert.equal(opened.props.hidden, false);
  for (const tab of ['qa', 'attachments', 'playlist']) {
    f.state.activeSidebarTab = tab;
    a = f.render('A');
    a.quizEffect();
    const hidden = a.quizTree();
    assert.equal(hidden.props.hidden, true);
    assert.equal(hidden.children[0].children[0].props.key, panel.props.key);
    assert.equal(hidden.children[0].children[0].type, panel.type);
  }
  let b = f.render('B');
  assert.equal(b.quizTree(), false);
  b.quizEffect();
  assert.equal(f.state.quizLessonId, null);
  f.state.activeSidebarTab = 'quiz';
  b = f.render('B');
  b.quizEffect();
  assert.equal(b.quizTree().children[0].children[0].props.key, 'B');
  const next = f.render('C');
  next.quizEffect();
  assert.equal(next.quizTree().children[0].children[0].props.key, 'C');
});
