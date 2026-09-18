type AssessmentAttempt = { is_submitted?: unknown; answers?: unknown } | null | undefined;

export const isSubmittedAttempt = (attempt: AssessmentAttempt) => attempt?.is_submitted === 1;

export function parseAssessmentAnswers(value: unknown): Record<string, string> {
  try {
    const answers = typeof value === 'string' ? JSON.parse(value) : value;
    if (!answers || typeof answers !== 'object' || Array.isArray(answers)) return {};
    const prototype = Object.getPrototypeOf(answers);
    if (prototype !== Object.prototype && prototype !== null) return {};
    if (!Object.values(answers).every(answer => typeof answer === 'string')) return {};
    return { ...answers };
  } catch {
    return {};
  }
}

export function restoreExamAnswers(attempt: AssessmentAttempt, examId: string): Record<string, string> {
  const serverAnswers = parseAssessmentAnswers(attempt?.answers);
  if (isSubmittedAttempt(attempt)) return serverAnswers;
  try {
    const savedAnswers = parseAssessmentAnswers(localStorage.getItem(`exam_answers_${examId}`));
    // Local edits are newer than server draft answers; submitted answers stay authoritative.
    return { ...serverAnswers, ...savedAnswers };
  } catch {
    return serverAnswers;
  }
}

export function saveExamDraft(examId: string, answers: Record<string, string>): boolean {
  try {
    localStorage.setItem(`exam_answers_${examId}`, JSON.stringify(answers));
    return true;
  } catch {
    return false;
  }
}

export function clearExamDraft(examId: string): void {
  try {
    localStorage.removeItem(`exam_answers_${examId}`);
  } catch {
    // A storage failure must not turn an accepted submission into a failed one.
  }
}

export function startAssessmentCountdown(
  startedAt: string,
  timeLimitMins: number,
  onTick: (remaining: number | null) => void,
  onTimeout: () => void,
): () => void {
  const startTime = new Date(startedAt).getTime();
  const limitMs = timeLimitMins * 60 * 1000;
  if (!Number.isFinite(startTime) || !Number.isFinite(limitMs) || limitMs <= 0) {
    onTick(null);
    return () => {};
  }

  const updateTimer = () => {
    const remaining = Math.max(0, Math.floor((limitMs - (Date.now() - startTime)) / 1000));
    onTick(remaining);
    if (remaining === 0) {
      clearInterval(timerId);
      onTimeout();
    }
  };

  // Initialize before the first tick: opening an expired attempt can submit immediately.
  const timerId = setInterval(updateTimer, 1000);
  updateTimer();
  return () => clearInterval(timerId);
}
