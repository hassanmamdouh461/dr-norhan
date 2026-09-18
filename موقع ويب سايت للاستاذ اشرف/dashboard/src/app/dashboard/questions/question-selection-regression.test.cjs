const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { createPageHarness } = require('../exams/dashboard-page-regression-harness.cjs');

const exposed = [
  'selectQuestion', 'submitAnswer', 'updateAnswerText', 'updateAttachedImage',
  'handleImageChange', 'hideQuestion', 'resolveQuestion', 'selectedQuestionId',
  'answers', 'questions', 'answerText', 'attachedImageUrl', 'loadingAnswers',
  'submitting', 'uploadingImage', 'error',
];
const question = id => ({
  id, body: `Question ${id}`, status: 'open', is_pinned: 0, upvotes: 0,
  student_name: 'Student', student_phone: '', lesson_title: null, course_title: null,
  answers_count: 0, created_at: '2026-01-01T00:00:00Z',
});
async function setup() {
  const h = createPageHarness(path.join(__dirname, 'page.tsx'), exposed);
  await h.settle('GET', '/admin/questions?status=open&page=1&limit=20', {
    questions: [question('A'), question('B')], meta: { has_more: false },
  });
  return h;
}
async function select(h, id) {
  void h.state.selectQuestion(id);
  await h.flush();
  await h.settle('GET', `/questions/${id}`, { answers: [] });
}
async function submit(h, id, body = `Reply ${id}`) {
  h.state.updateAnswerText(body);
  await h.flush();
  void h.state.submitAnswer(id);
  await h.flush();
  return h.pending('POST', `/admin/questions/${id}/answer`);
}

test('stale history success, failure and finally do not alter another question', async () => {
  for (const fail of [false, true]) {
    const h = await setup();
    void h.state.selectQuestion('A');
    await h.flush();
    const oldHistory = h.pending('GET', '/questions/A');
    void h.state.selectQuestion('B');
    await h.flush();
    h.state.updateAnswerText('B draft');
    await h.flush();
    if (fail) oldHistory.reject(new Error('Old history failed'));
    else oldHistory.resolve({ answers: [{ id: 'old-A' }] });
    await h.flush();
    assert.equal(h.state.loadingAnswers, true);
    assert.equal(h.state.answers.length, 0);
    assert.equal(h.state.answerText, 'B draft');
    await h.settle('GET', '/questions/B', { answers: [{ id: 'fresh-B' }] });
    assert.equal(h.state.answers[0].id, 'fresh-B');
    assert.equal(h.state.loadingAnswers, false);
  }
});

test('history is guarded by generation even when the same question is reselected', async () => {
  const h = await setup();
  void h.state.selectQuestion('A');
  await h.flush();
  const oldA = h.pending('GET', '/questions/A');
  await select(h, 'B');
  void h.state.selectQuestion('A');
  await h.flush();
  oldA.resolve({ answers: [{ id: 'old-A' }] });
  await h.flush();
  assert.equal(h.state.loadingAnswers, true);
  assert.equal(h.state.answers.length, 0);
  await h.settle('GET', '/questions/A', { answers: [{ id: 'fresh-A' }] });
  assert.equal(h.state.answers[0].id, 'fresh-A');
});

test('reply success stays with the submitted question while a new reply remains pending', async () => {
  const h = await setup();
  await select(h, 'A');
  const replyA = await submit(h, 'A');
  await select(h, 'B');
  assert.equal(h.state.submitting, false);
  const replyB = await submit(h, 'B');
  replyA.resolve({});
  await h.flush();
  assert.equal(replyA.body.body, 'Reply A');
  assert.equal(h.state.answers.length, 0);
  assert.equal(h.state.answerText, 'Reply B');
  assert.equal(h.state.submitting, true);
  assert.equal(h.state.questions.find(q => q.id === 'A').answers_count, 1);
  assert.equal(h.state.questions.find(q => q.id === 'A').status, 'answered');
  assert.equal(h.state.questions.find(q => q.id === 'B').answers_count, 0);
  replyB.resolve({});
  await h.flush();
  assert.equal(h.state.answers.length, 1);
  assert.equal(h.state.answers[0].body, 'Reply B');
  assert.equal(h.state.answerText, '');
  assert.equal(h.state.submitting, false);
});

test('same-selection reply is appended while edited text, attachment and reverted drafts are preserved', async () => {
  for (const change of ['text', 'image', 'reverted']) {
    const h = await setup();
    await select(h, 'A');
    h.state.updateAttachedImage('/submitted-image.png');
    await h.flush();
    const reply = await submit(h, 'A', 'Submitted');
    if (change === 'image') h.state.updateAttachedImage('/new-draft-image.png');
    else {
      h.state.updateAnswerText('New draft');
      if (change === 'reverted') h.state.updateAnswerText('Submitted');
    }
    await h.flush();
    const currentText = h.state.answerText;
    const currentImage = h.state.attachedImageUrl;
    reply.resolve({});
    await h.flush();
    assert.equal(reply.body.body, 'Submitted');
    assert.equal(reply.body.image_url, '/submitted-image.png');
    assert.equal(h.state.answerText, currentText);
    assert.equal(h.state.attachedImageUrl, currentImage);
    assert.equal(h.state.answers.length, 1);
    assert.equal(h.state.answers[0].body, 'Submitted');
    assert.equal(h.state.answers[0].image_url, '/submitted-image.png');
    assert.equal(h.state.submitting, false);
    assert.equal(h.state.questions[0].answers_count, 1);
  }
});

test('reply completion after A-B-A navigation cannot clear an identical new draft', async () => {
  const h = await setup();
  await select(h, 'A');
  const oldReply = await submit(h, 'A', 'Identical draft');
  await select(h, 'B');
  await select(h, 'A');
  h.state.updateAnswerText('Identical draft');
  await h.flush();
  oldReply.resolve({});
  await h.flush();
  assert.equal(h.state.answerText, 'Identical draft');
  assert.equal(h.state.answers.length, 0);
  assert.equal(h.state.questions[0].answers_count, 1);
});

test('unchanged image-only draft is appended and cleared after successful reply', async () => {
  const h = await setup();
  await select(h, 'A');
  h.state.updateAttachedImage('/answer-image.png');
  await h.flush();
  void h.state.submitAnswer('A');
  await h.flush();
  await h.settle('POST', '/admin/questions/A/answer', {});
  assert.equal(h.state.answers[0].image_url, '/answer-image.png');
  assert.equal(h.state.attachedImageUrl, null);
  assert.equal(h.state.answerText, '');
});

test('old reply failure cannot clear a new request indicator or display its error', async () => {
  const h = await setup();
  await select(h, 'A');
  const replyA = await submit(h, 'A');
  await select(h, 'B');
  await submit(h, 'B');
  replyA.reject(new Error('A reply failed'));
  await h.flush();
  assert.equal(h.state.error, '');
  assert.equal(h.state.submitting, true);
  assert.equal(h.state.answerText, 'Reply B');
  assert.equal(h.state.questions[0].answers_count, 0);
});

test('history must finish before a reply can start and repeated submit is ignored', async () => {
  const h = await setup();
  void h.state.selectQuestion('A');
  await h.flush();
  h.state.updateAnswerText('Reply');
  await h.flush();
  void h.state.submitAnswer('A');
  assert.equal(h.calls.filter(call => call.method === 'POST').length, 0);
  await h.settle('GET', '/questions/A', { answers: [] });
  void h.state.submitAnswer('A');
  void h.state.submitAnswer('A');
  await h.flush();
  assert.equal(h.calls.filter(call => call.method === 'POST').length, 1);
});

test('late image upload does not attach to a new question or clear its upload indicator', async () => {
  const h = await setup();
  await select(h, 'A');
  const eventA = { target: { files: [{ name: 'a.png', type: 'image/png' }], value: 'a.png' } };
  void h.state.handleImageChange(eventA);
  await h.settle('POST', '/admin/questions/answer-image-url', { upload_url: '/upload-a', public_url: '/a.png' });
  await select(h, 'B');
  void h.state.handleImageChange({ target: { files: [{ name: 'b.png', type: 'image/png' }], value: 'b.png' } });
  await h.flush();
  await h.settle('PUT', '/upload-a', { ok: true });
  assert.equal(h.state.attachedImageUrl, null);
  assert.equal(h.state.uploadingImage, true);
});

test('late hide and resolve completions cannot deselect a different question', async () => {
  for (const action of ['hideQuestion', 'resolveQuestion']) {
    const h = await setup();
    await select(h, 'A');
    void h.state[action]('A');
    await select(h, 'B');
    await h.settle('PATCH', '/admin/questions/A', {});
    assert.equal(h.state.selectedQuestionId, 'B');
  }
});
