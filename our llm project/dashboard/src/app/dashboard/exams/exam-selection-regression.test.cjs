const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { createPageHarness } = require('./dashboard-page-regression-harness.cjs');
const { toLocalDateTimeInput, examMetaFields, isExamMetaDirty } = require('./exam-metadata.ts');

process.env.TZ = 'America/New_York';
const fields = [
  'handleSelectExam', 'beginExamSelection', 'handleSaveExamMeta', 'handleSaveQuestion',
  'handleUploadExamCover', 'selectedExamId', 'examStartTime', 'examEndTime', 'examTitle',
  'setExamTitle', 'setExamMaxScore', 'setExamStartTime', 'setQuestionText', 'setCorrectOptionIdx',
  'questionText', 'questions', 'exams', 'autoSaveStatus', 'savingMeta', 'savingQuestion',
  'error', 'success', 'examCoverImage', 'refreshExamList', 'examSelectionRef', 'pendingExamIds',
];
const exam = (id = 'A') => ({
  id, title: `Exam ${id}`, course_id: 'course', max_score: 100, is_published: 0,
  is_free: 0, randomize_questions: 0, cover_image: null,
  start_time: '2026-07-12T14:35:42.123Z', end_time: '2026-12-12T16:45:59.987+00:00',
  time_limit_mins: 60, created_at: '2026-01-01T00:00:00Z',
});
async function setup() {
  const h = createPageHarness(path.join(__dirname, 'page.tsx'), fields);
  await h.settle('GET', '/courses', { courses: [{ id: 'course', title: 'Course' }] });
  await h.settle('GET', '/admin/exams', { exams: [exam('A'), exam('B')] });
  return h;
}
async function select(h, value) {
  void h.state.handleSelectExam(value);
  await h.flush();
  await h.settle('GET', `/admin/quizzes/${value.id}`, { questions: [] });
}
const posts = h => h.calls.filter(call => call.method === 'POST' && call.url === '/admin/exams');

test('local input uses the timestamp timezone offset and preserves fold instants verbatim', () => {
  const fixtures = [
    ['UTC', '2026-07-12T14:35:42.123Z', '2026-07-12T14:35'],
    ['America/New_York', '2026-07-12T14:35:42.123Z', '2026-07-12T10:35'],
    ['America/New_York', '2026-12-12T16:45:59.987Z', '2026-12-12T11:45'],
    ['Asia/Kathmandu', '2026-07-12T23:35:42.123Z', '2026-07-13T05:20'],
  ];
  for (const [zone, stored, expected] of fixtures) {
    process.env.TZ = zone;
    assert.equal(toLocalDateTimeInput(stored), expected);
  }
  process.env.TZ = 'America/New_York';
  for (const stored of ['2026-11-01T05:30:47.123Z', '2026-11-01T06:30:47.123Z']) {
    const draft = {
      title: 'Exam', course_id: 'course', max_score: 100, is_published: false,
      randomize_questions: false, is_free: false, cover_image: '',
      start_time: toLocalDateTimeInput(stored), end_time: '', time_limit_mins: '',
    };
    const baseline = { draft, start_time: stored, end_time: null };
    assert.equal(draft.start_time, '2026-11-01T01:30');
    assert.equal(isExamMetaDirty({ ...draft }, baseline), false);
    assert.equal(isExamMetaDirty({ ...draft, title: 'Edited' }, baseline), true);
    assert.equal(examMetaFields({ ...draft, title: 'Edited' }, baseline).start_time, stored);
    assert.equal(examMetaFields({ ...draft, start_time: '' }, baseline).start_time, null);
  }
  assert.equal(toLocalDateTimeInput(null), '');
});

test('selection and reverted edits do not save; unrelated edits retain exact schedule', async () => {
  const h = await setup();
  await select(h, exam());
  assert.equal(h.state.examStartTime, '2026-07-12T10:35');
  assert.equal(h.state.examEndTime, '2026-12-12T11:45');
  await h.advance(5000);
  assert.equal(posts(h).length, 0);
  h.state.setExamTitle('Temporary');
  await h.flush();
  h.state.setExamTitle('Exam A');
  await h.flush();
  await h.advance(1200);
  assert.equal(posts(h).length, 0);
  h.state.setExamMaxScore(120);
  await h.flush();
  await h.advance(1200);
  const saved = posts(h)[0];
  assert.equal(saved.body.start_time, exam().start_time);
  assert.equal(saved.body.end_time, exam().end_time);
  saved.resolve({ exam: { ...exam(), max_score: 120 } });
  await h.flush();
  await h.settle('GET', '/admin/exams', { exams: [exam()] });
  await h.advance(5000);
  assert.equal(posts(h).length, 1);
  h.state.setExamStartTime('2026-07-12T11:20');
  await h.flush();
  void h.state.handleSaveExamMeta({ preventDefault() {} });
  await h.flush();
  assert.equal(posts(h)[1].body.start_time, '2026-07-12T15:20:00.000Z');
  assert.equal(posts(h)[1].body.end_time, exam().end_time);
});

test('edits made during a save are serialized against the acknowledged baseline', async () => {
  const h = await setup();
  await select(h, exam());
  h.state.setExamTitle('First edit');
  await h.flush();
  await h.advance(1200);
  h.state.setExamTitle('Exam A');
  await h.flush();
  await h.advance(3000);
  assert.equal(posts(h).length, 1);
  await h.settle('POST', '/admin/exams', { exam: { ...exam(), title: 'First edit' } });
  await h.settle('GET', '/admin/exams', { exams: [{ ...exam(), title: 'First edit' }] });
  await h.advance(1200);
  assert.equal(posts(h).length, 2);
  assert.equal(posts(h)[1].body.title, 'Exam A');
  assert.equal(posts(h)[1].body.start_time, exam().start_time);
});

test('failed saves do not retry forever without a new edit', async () => {
  const h = await setup();
  await select(h, exam());
  h.state.setExamTitle('Edited');
  await h.flush();
  await h.advance(1200);
  posts(h)[0].reject(new Error('Save failed'));
  await h.flush();
  assert.equal(h.state.autoSaveStatus, 'error');
  await h.advance(10000);
  assert.equal(posts(h).length, 1);
});

test('newer edits queued during a failed save resume once, without retrying unchanged failures', async () => {
  const h = await setup();
  await select(h, exam());
  h.state.setExamTitle('First edit');
  await h.flush();
  await h.advance(1200);
  h.state.setExamTitle('Newer edit');
  h.state.setExamStartTime('2026-07-12T11:20');
  await h.flush();
  await h.advance(3000);
  assert.equal(posts(h).length, 1);
  posts(h)[0].reject(new Error('First save failed'));
  await h.flush();
  await h.advance(1200);
  assert.equal(posts(h).length, 2);
  assert.equal(posts(h)[1].body.title, 'Newer edit');
  assert.equal(posts(h)[1].body.start_time, '2026-07-12T15:20:00.000Z');
  assert.equal(posts(h)[1].body.end_time, exam().end_time);
  posts(h)[1].reject(new Error('Newer save failed'));
  await h.flush();
  await h.advance(10000);
  assert.equal(posts(h).length, 2);
});

test('failed save does not retry when queued edits return to the same payload or clean baseline', async () => {
  for (const title of ['First edit', 'Exam A']) {
    const h = await setup();
    await select(h, exam());
    h.state.setExamTitle('First edit');
    await h.flush();
    await h.advance(1200);
    h.state.setExamTitle('Intermediate edit');
    await h.flush();
    h.state.setExamTitle(title);
    await h.flush();
    posts(h)[0].reject(new Error('Save failed'));
    await h.flush();
    await h.advance(10000);
    assert.equal(posts(h).length, 1);
  }
});

test('navigation during save reconciles the shared list and reopened values, rejecting older list data', async () => {
  const h = await setup();
  const staleExam = h.state.exams.find(item => item.id === 'A');
  await select(h, staleExam);
  h.state.setExamTitle('Confirmed title');
  h.state.setExamStartTime('2026-07-12T11:20');
  await h.flush();
  await h.advance(1200);
  h.state.beginExamSelection(null);
  await h.flush();
  void h.state.refreshExamList(h.state.examSelectionRef.current);
  const oldList = h.pending('GET', '/admin/exams');
  const confirmed = { ...exam(), title: 'Confirmed title', start_time: '2026-07-12T15:20:00.000Z' };
  await h.settle('POST', '/admin/exams', { exam: confirmed });
  assert.equal(h.state.selectedExamId, null);
  assert.equal(h.state.autoSaveStatus, 'idle');
  assert.equal(h.state.exams.find(item => item.id === 'A').title, 'Confirmed title');
  oldList.resolve({ exams: [exam(), exam('B')] });
  await h.flush();
  assert.equal(h.state.exams.find(item => item.id === 'A').title, 'Confirmed title');
  await select(h, staleExam);
  assert.equal(h.state.examTitle, 'Confirmed title');
  assert.equal(h.state.examStartTime, '2026-07-12T11:20');
  await h.advance(5000);
  assert.equal(posts(h).length, 1);
  h.state.setExamMaxScore(120);
  await h.flush();
  await h.advance(1200);
  assert.equal(posts(h)[1].body.title, 'Confirmed title');
  assert.equal(posts(h)[1].body.start_time, confirmed.start_time);
  assert.equal(posts(h)[1].body.end_time, confirmed.end_time);
});

test('confirmed cache protects delayed snapshots and accepts fresh lists after acknowledgement', async () => {
  const h = await setup();
  await select(h, exam());
  h.state.setExamTitle('Confirmed title');
  await h.flush();
  await h.advance(1200);
  const confirmed = { ...exam(), title: 'Confirmed title' };
  await h.settle('POST', '/admin/exams', { exam: confirmed });
  await h.settle('GET', '/admin/exams', { exams: [exam(), exam('B')] });
  assert.equal(h.state.exams[0].title, 'Confirmed title');
  h.state.beginExamSelection(null);
  await h.flush();
  void h.state.refreshExamList(h.state.examSelectionRef.current);
  await h.settle('GET', '/admin/exams', { exams: [confirmed, exam('B')] });
  void h.state.refreshExamList(h.state.examSelectionRef.current);
  await h.settle('GET', '/admin/exams', { exams: [{ ...confirmed, title: 'Later server edit' }, exam('B')] });
  assert.equal(h.state.exams[0].title, 'Later server edit');
  await select(h, h.state.exams[0]);
  assert.equal(h.state.examTitle, 'Later server edit');
});

test('reopening A before its title POST completes is blocked and a later score save retains the title', async () => {
  const h = await setup();
  const staleA = h.state.exams[0];
  await select(h, staleA);
  h.state.setExamTitle('Saved A title');
  await h.flush();
  await h.advance(1200);
  const titleSave = posts(h)[0];
  assert.equal(h.state.pendingExamIds.includes('A'), true);
  h.state.beginExamSelection(null);
  await h.flush();
  const historyCount = h.calls.filter(call => call.url === '/admin/quizzes/A').length;
  await h.state.handleSelectExam(staleA);
  await h.flush();
  assert.equal(h.state.selectedExamId, null);
  assert.equal(h.state.pendingExamIds.includes('A'), true);
  assert.equal(h.calls.filter(call => call.url === '/admin/quizzes/A').length, historyCount);
  titleSave.resolve({ exam: { ...exam(), title: 'Saved A title' } });
  await h.flush();
  assert.equal(h.state.pendingExamIds.includes('A'), false);
  await select(h, staleA);
  assert.equal(h.state.examTitle, 'Saved A title');
  h.state.setExamMaxScore(120);
  await h.flush();
  await h.advance(1200);
  assert.equal(posts(h).length, 2);
  assert.equal(posts(h)[1].body.id, 'A');
  assert.equal(posts(h)[1].body.title, 'Saved A title');
  assert.equal(posts(h)[1].body.max_score, 120);
  assert.equal(posts(h)[1].body.start_time, exam().start_time);
  assert.equal(posts(h)[1].body.end_time, exam().end_time);
});

test('different exams can save concurrently and each completion releases only its own pending state', async () => {
  for (const order of [['A', 'B'], ['B', 'A']]) {
    const h = await setup();
    await select(h, exam('A'));
    h.state.setExamTitle('Saved A title');
    await h.flush();
    void h.state.handleSaveExamMeta({ preventDefault() {} });
    h.state.beginExamSelection(null);
    await h.flush();
    assert.equal(h.state.pendingExamIds.includes('A'), true);
    assert.equal(h.state.pendingExamIds.includes('B'), false);
    await select(h, exam('B'));
    h.state.setExamTitle('Saved B title');
    await h.flush();
    void h.state.handleSaveExamMeta({ preventDefault() {} });
    await h.flush();
    assert.equal(posts(h).length, 2);
    assert.equal(posts(h)[0].body.id, 'A');
    assert.equal(posts(h)[1].body.id, 'B');
    assert.equal(h.state.pendingExamIds.length, 2);
    h.state.beginExamSelection(null);
    await h.flush();
    for (const id of ['A', 'B']) {
      await h.state.handleSelectExam(exam(id));
      assert.equal(h.state.selectedExamId, null);
    }
    const [first, second] = order;
    posts(h).find(call => call.body.id === first).resolve({ exam: { ...exam(first), title: `Saved ${first} title` } });
    await h.flush();
    assert.equal(h.state.pendingExamIds.includes(first), false);
    assert.equal(h.state.pendingExamIds.includes(second), true);
    await select(h, exam(first));
    assert.equal(h.state.examTitle, `Saved ${first} title`);
    await h.state.handleSelectExam(exam(second));
    assert.equal(h.state.selectedExamId, first);
    posts(h).find(call => call.body.id === second).resolve({ exam: { ...exam(second), title: `Saved ${second} title` } });
    await h.flush();
    assert.equal(h.state.pendingExamIds.length, 0);
    assert.equal(h.state.selectedExamId, first);
    assert.equal(h.state.examTitle, `Saved ${first} title`);
    await select(h, exam(second));
    assert.equal(h.state.examTitle, `Saved ${second} title`);
  }
});

test('a rejected POST releases the navigated-away exam without retrying or locking another exam', async () => {
  const h = await setup();
  await select(h, exam('A'));
  h.state.setExamTitle('Failed title');
  await h.flush();
  await h.advance(1200);
  h.state.beginExamSelection(null);
  await h.flush();
  await h.state.handleSelectExam(exam('A'));
  assert.equal(h.state.selectedExamId, null);
  posts(h)[0].reject(new Error('Save failed'));
  await h.flush();
  assert.equal(h.state.pendingExamIds.length, 0);
  assert.equal(h.state.error, '');
  await select(h, exam('A'));
  assert.equal(h.state.examTitle, 'Exam A');
  await h.advance(5000);
  assert.equal(posts(h).length, 1);
});

test('reopening is unlocked after POST reconciliation even while the optional list request is pending', async () => {
  const h = await setup();
  await select(h, exam('A'));
  h.state.setExamTitle('Confirmed before GET');
  await h.flush();
  await h.advance(1200);
  await h.settle('POST', '/admin/exams', { exam: { ...exam(), title: 'Confirmed before GET' } });
  const pendingList = h.pending('GET', '/admin/exams');
  assert.equal(h.state.pendingExamIds.length, 0);
  h.state.beginExamSelection(null);
  await h.flush();
  await select(h, exam('A'));
  assert.equal(h.state.examTitle, 'Confirmed before GET');
  h.state.setExamMaxScore(150);
  await h.flush();
  await h.advance(1200);
  assert.equal(posts(h)[1].body.title, 'Confirmed before GET');
  assert.equal(posts(h)[1].body.max_score, 150);
  pendingList.reject(new Error('Old GET failed'));
  await h.flush();
  assert.equal(h.state.pendingExamIds.includes('A'), true);
  assert.equal(h.state.autoSaveStatus, 'saving');
});

test('newer work queued behind a failed save can succeed and becomes the clean baseline', async () => {
  const h = await setup();
  await select(h, exam());
  h.state.setExamTitle('Failed edit');
  await h.flush();
  await h.advance(1200);
  h.state.setExamTitle('Queued edit');
  await h.flush();
  posts(h)[0].reject(new Error('Save failed'));
  await h.flush();
  await h.advance(1200);
  const queued = { ...exam(), title: 'Queued edit' };
  await h.settle('POST', '/admin/exams', { exam: queued });
  await h.settle('GET', '/admin/exams', { exams: [queued, exam('B')] });
  await h.advance(10000);
  assert.equal(posts(h).length, 2);
  assert.equal(h.state.exams[0].title, 'Queued edit');
  assert.equal(h.state.autoSaveStatus, 'idle');
  assert.equal(h.state.savingMeta, false);
});

test('a successful save remains confirmed when the follow-up list request fails', async () => {
  const h = await setup();
  await select(h, exam());
  h.state.setExamTitle('Confirmed title');
  await h.flush();
  void h.state.handleSaveExamMeta({ preventDefault() {} });
  await h.flush();
  await h.settle('POST', '/admin/exams', { exam: { ...exam(), title: 'Confirmed title' } });
  h.pending('GET', '/admin/exams').reject(new Error('List unavailable'));
  await h.flush();
  assert.equal(h.state.autoSaveStatus, 'saved');
  assert.equal(h.state.error, '');
  assert.notEqual(h.state.success, '');
  assert.equal(h.state.savingMeta, false);
  await select(h, h.state.exams.find(item => item.id === 'A'));
  assert.equal(h.state.examTitle, 'Confirmed title');
  await h.advance(5000);
  assert.equal(posts(h).length, 1);
});

test('create retains the POST identity before list failure so retries cannot create duplicates', async () => {
  const h = await setup();
  h.state.setExamTitle('New exam');
  await h.flush();
  void h.state.handleSaveExamMeta({ preventDefault() {} });
  await h.flush();
  const created = { ...exam('Created'), title: 'New exam' };
  await h.settle('POST', '/admin/exams', { exam: created });
  assert.equal(h.state.selectedExamId, 'Created');
  assert.equal(h.state.exams.find(item => item.id === 'Created').title, 'New exam');
  h.pending('GET', '/admin/exams').reject(new Error('List unavailable'));
  await h.flush();
  await h.settle('GET', '/admin/quizzes/Created', { questions: [] });
  assert.equal(h.state.selectedExamId, 'Created');
  assert.equal(h.state.error, '');
  assert.notEqual(h.state.success, '');
  assert.equal(h.state.savingMeta, false);
  void h.state.handleSaveExamMeta({ preventDefault() {} });
  await h.flush();
  await h.advance(5000);
  assert.equal(posts(h).length, 1);
  h.state.setExamTitle('Edited created exam');
  await h.flush();
  void h.state.handleSaveExamMeta({ preventDefault() {} });
  await h.flush();
  assert.equal(posts(h).length, 2);
  assert.equal(posts(h)[1].body.id, 'Created');
});

test('late exam question loads cannot overwrite a new selection or clear its draft', async () => {
  const h = await setup();
  void h.state.handleSelectExam(exam('A'));
  const oldA = h.pending('GET', '/admin/quizzes/A');
  await h.flush();
  await select(h, exam('B'));
  void h.state.handleSelectExam(exam('A'));
  await h.flush();
  h.state.setQuestionText('New draft');
  await h.flush();
  oldA.resolve({ questions: [{ id: 'stale' }] });
  await h.flush();
  assert.equal(h.state.questions.length, 0);
  assert.equal(h.state.questionText, 'New draft');
  await h.settle('GET', '/admin/quizzes/A', { questions: [{ id: 'fresh' }] });
  assert.equal(h.state.questions[0].id, 'fresh');
  assert.equal(h.state.questionText, 'New draft');
});

test('late save success and error cannot affect a new exam or a reselection', async () => {
  for (const fail of [false, true]) {
    const h = await setup();
    await select(h, exam());
    h.state.setExamTitle('Edited');
    await h.flush();
    await h.advance(1200);
    const oldSave = posts(h)[0];
    await select(h, exam('B'));
    await h.state.handleSelectExam(exam('A'));
    assert.equal(h.state.selectedExamId, 'B');
    if (fail) oldSave.reject(new Error('Old failure')); else oldSave.resolve({ exam: { ...exam(), title: 'Edited' } });
    await h.flush();
    assert.equal(h.state.selectedExamId, 'B');
    assert.equal(h.state.examTitle, 'Exam B');
    await select(h, exam('A'));
    assert.equal(h.state.examTitle, fail ? 'Exam A' : 'Edited');
    assert.equal(h.state.autoSaveStatus, 'idle');
    assert.equal(h.state.error, '');
    assert.equal(h.state.savingMeta, false);
    assert.equal(h.calls.filter(call => call.url === '/admin/exams' && call.method === 'GET').length, 1);
  }
});

test('late list refresh and saved-status timer cannot alter a newly selected exam', async () => {
  const h = await setup();
  await select(h, exam());
  h.state.setExamTitle('Edited A');
  await h.flush();
  await h.advance(1200);
  await h.settle('POST', '/admin/exams', { exam: exam() });
  const oldList = h.pending('GET', '/admin/exams');
  await select(h, exam('B'));
  oldList.resolve({ exams: [{ ...exam(), title: 'Stale list' }] });
  await h.flush();
  assert.equal(h.state.exams.length, 2);
  assert.equal(h.state.autoSaveStatus, 'idle');
  h.state.setExamTitle('Edited B');
  await h.flush();
  await h.advance(1200);
  assert.equal(h.state.autoSaveStatus, 'saving');
  await h.advance(5000);
  assert.equal(h.state.autoSaveStatus, 'saving');
});

test('an already scheduled saved-status reset cannot clear the next exam saving state', async () => {
  const h = await setup();
  await select(h, exam());
  h.state.setExamTitle('Edited A');
  await h.flush();
  await h.advance(1200);
  await h.settle('POST', '/admin/exams', { exam: exam() });
  await h.settle('GET', '/admin/exams', { exams: [exam(), exam('B')] });
  assert.equal(h.state.autoSaveStatus, 'saved');
  await select(h, exam('B'));
  h.state.setExamTitle('Edited B');
  await h.flush();
  await h.advance(1200);
  assert.equal(h.state.autoSaveStatus, 'saving');
  await h.advance(1000);
  assert.equal(h.state.autoSaveStatus, 'saving');
});

test('a pending post-save question reload cannot replace the new exam questions', async () => {
  const h = await setup();
  await select(h, exam());
  h.state.setQuestionText('Question A');
  h.state.setCorrectOptionIdx(0);
  await h.flush();
  void h.state.handleSaveQuestion();
  await h.settle('POST', '/admin/quizzes/A/questions', {});
  const oldReload = h.pending('GET', '/admin/quizzes/A');
  await select(h, exam('B'));
  h.state.setQuestionText('New B draft');
  await h.flush();
  oldReload.resolve({ questions: [{ id: 'A-only' }] });
  await h.flush();
  assert.equal(h.state.questions.length, 0);
  assert.equal(h.state.questionText, 'New B draft');
  assert.equal(h.state.success, '');
});

test('late question saves and cover uploads do not modify another exam', async () => {
  const h = await setup();
  await select(h, exam());
  h.state.setQuestionText('Question A');
  h.state.setCorrectOptionIdx(0);
  await h.flush();
  void h.state.handleSaveQuestion();
  void h.state.handleUploadExamCover({ name: 'cover.png', type: 'image/png' });
  await h.settle('POST', '/admin/quizzes/question-image-url', { upload_url: '/upload', public_url: '/cover-a.png' });
  await select(h, exam('B'));
  h.state.setQuestionText('Question B draft');
  await h.flush();
  await h.settle('POST', '/admin/quizzes/A/questions', {});
  await h.settle('PUT', '/upload', { ok: true });
  assert.equal(h.state.questionText, 'Question B draft');
  assert.equal(h.state.examCoverImage, '');
  assert.equal(h.state.success, '');
  assert.equal(h.state.savingQuestion, false);
  await h.advance(3000);
  assert.equal(posts(h).length, 0);
});

test('a pending create cannot select its new exam after the user opens another', async () => {
  const h = await setup();
  h.state.setExamTitle('New exam');
  await h.flush();
  void h.state.handleSaveExamMeta({ preventDefault() {} });
  await h.flush();
  await select(h, exam('B'));
  await h.settle('POST', '/admin/exams', { exam: exam('Created') });
  assert.equal(h.state.exams.find(item => item.id === 'Created').title, 'Exam Created');
  assert.equal(h.state.selectedExamId, 'B');
  assert.equal(h.state.success, '');
  assert.equal(h.state.savingMeta, false);
});
