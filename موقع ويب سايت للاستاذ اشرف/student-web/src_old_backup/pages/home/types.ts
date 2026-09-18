import type { useToast } from '../../context/ToastContext';

// Shared types for the Home page module split.

export type TabId = 'home' | 'explore' | 'my-courses' | 'qa' | 'profile' | 'exams';

/** Type of the `showToast` function returned by useToast(), reused across the split-out hooks. */
export type ShowToastFn = ReturnType<typeof useToast>['showToast'];

export interface HomeProps {
  onSelectCourse: (courseId: string) => void;
  onSelectLesson?: (lessonId: string, title: string, type: 'video' | 'pdf', isFree?: boolean, courseId?: string) => void;
  onShowAuth?: () => void;
}

export interface ConfirmDialogState {
  show: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  onConfirm: () => void;
}
