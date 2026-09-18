export interface Course {
  id: string;
  title: string;
  slug: string;
  description: string;
  grade: string;
  branch?: string;
  is_published: number;
  is_free: number;
  is_archived: number;
  students_count: number;
  units_count: number;
  lessons_count: number;
  sort_order: number;
  created_at: string;
  cover_url?: string;
  reference_price?: number;
}

export interface Unit {
  id: string;
  course_id: string;
  title: string;
  description: string;
  sort_order: number;
  is_published: number;
}

export interface Lesson {
  id: string;
  unit_id: string;
  title: string;
  description: string;
  sort_order: number;
  is_published: number;
  is_free_preview: number;
  duration_seconds: number | null;
  video_status?: 'ready' | 'processing' | 'uploading' | 'error' | null;
  video_provider?: string | null;
}

export interface VideoProgressState {
  status: 'uploading' | 'processing' | 'ready' | 'error';
  percent: number;
  text?: string;
}

export interface DeleteTarget {
  id: string;
  title: string;
  type: 'lesson' | 'course';
}

export interface CourseFormData {
  title: string;
  description: string;
  grade: string;
  branch: string;
  is_free: boolean;
  cover_url: string;
  reference_price: number;
}

export interface NewUnitState {
  courseId: string;
  title: string;
  description: string;
}

export interface NewLessonState {
  unitId: string;
  title: string;
  description: string;
  is_free_preview: boolean;
}
