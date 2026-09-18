export interface ExamMetaDraft {
  title: string;
  course_id: string;
  max_score: number;
  is_published: boolean;
  randomize_questions: boolean;
  is_free: boolean;
  cover_image: string;
  start_time: string;
  end_time: string;
  time_limit_mins: number | '';
}

export interface ExamMetaBaseline {
  draft: ExamMetaDraft;
  start_time: string | null;
  end_time: string | null;
}

export function toLocalDateTimeInput(value: string | null | undefined): string {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const pad = (part: number) => String(part).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function isExamMetaDirty(draft: ExamMetaDraft, baseline: ExamMetaBaseline): boolean {
  return (Object.keys(draft) as (keyof ExamMetaDraft)[]).some(key => !Object.is(draft[key], baseline.draft[key]));
}

export function examMetaFields(draft: ExamMetaDraft, baseline: ExamMetaBaseline | null) {
  // Keep the original instant and precision unless that local input actually changed.
  const timestamp = (key: 'start_time' | 'end_time') =>
    baseline && draft[key] === baseline.draft[key]
      ? baseline[key]
      : draft[key] ? new Date(draft[key]).toISOString() : null;
  return {
    ...draft,
    cover_image: draft.cover_image || null,
    start_time: timestamp('start_time'),
    end_time: timestamp('end_time'),
    time_limit_mins: draft.time_limit_mins === '' ? null : draft.time_limit_mins,
  };
}
