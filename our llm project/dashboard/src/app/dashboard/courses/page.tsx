'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { api, apiGet, apiPost, apiPatch, apiDelete } from '@/lib/api';
import { Course, Unit, Lesson, DeleteTarget, CourseFormData, NewUnitState, NewLessonState } from './types';
import CourseFormModal from './components/CourseFormModal';
import CourseTree from './components/CourseTree';
import VideoUploadPanel from './components/VideoUploadPanel';
import QuizBuilder from './components/QuizBuilder';
import AttachmentsPanel from './components/AttachmentsPanel';

export default function CoursesPage() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [expandedCourse, setExpandedCourse] = useState<string | null>(null);
  const expandedCourseRef = useRef<string | null>(null);
  const contentsRequestRef = useRef<Record<string, number>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const submittingRef = useRef(false);
  const [videoCourseId, setVideoCourseId] = useState<string | null>(null);
  const [units, setUnits] = useState<Record<string, Unit[]>>({});
  const [lessons, setLessons] = useState<Record<string, Lesson[]>>({});
  const [error, setError] = useState('');
  const [selectedLessonId, setSelectedLessonId] = useState<string | null>(null);

  const [showYoutubeModal, setShowYoutubeModal] = useState(false);
  const [showQuizModal, setShowQuizModal] = useState(false);

  // Attachments / Lesson Files states
  const [showAttachmentsModal, setShowAttachmentsModal] = useState(false);
  const [courseSuccess, setCourseSuccess] = useState('');

  // Delete confirmation modal state
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Form inputs states
  const [academicYears, setAcademicYears] = useState<string[]>([]);
  const [branches, setBranches] = useState<string[]>([]);

  const [newCourse, setNewCourse] = useState<CourseFormData>({ title: '', description: '', grade: '', branch: '', is_free: false, cover_url: '', reference_price: 0 });
  const [newUnit, setNewUnit] = useState<NewUnitState>({ courseId: '', title: '', description: '' });
  const [newLesson, setNewLesson] = useState<NewLessonState>({ unitId: '', title: '', description: '', is_free_preview: false });

  // Edit Course states
  const [showEdit, setShowEdit] = useState(false);
  const [editingCourse, setEditingCourse] = useState<Course | null>(null);
  const [editCourseForm, setEditCourseForm] = useState<CourseFormData>({ title: '', description: '', grade: '', branch: '', is_free: false, cover_url: '', reference_price: 0 });

  const fetchCourses = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await api<{ courses: Course[] }>('/admin/courses');
      setCourses(data.courses || []);
    } catch (e: any) {
      setCourses([]);
      setError(e.message || 'فشل جلب قائمة الكورسات');
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchCourses();
  }, [fetchCourses]);

  const fetchSettings = useCallback(async () => {
    try {
      const res = await apiGet<any>('/admin/settings');
      if (res && res.settings) {
        const yearsVal = res.settings.academic_years;
        const branchesVal = res.settings.branches;

        const parseSetting = (val: string | null | undefined): string[] => {
          if (!val) return [];
          try {
            const parsed = JSON.parse(val);
            if (Array.isArray(parsed)) return parsed;
          } catch {}
          return val.split(',').map(s => s.trim()).filter(Boolean);
        };

        setAcademicYears(parseSetting(yearsVal));
        setBranches(parseSetting(branchesVal));
      }
    } catch (e) {
      console.error("Failed to load settings in courses page:", e);
    }
  }, []);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  const createCourse = async () => {
    if (submittingRef.current) return;
    if (!newCourse.title.trim()) {
      setError('يرجى كتابة عنوان الكورس');
      return;
    }
    submittingRef.current = true;
    setIsSubmitting(true);
    setError('');
    try {
      const payload = {
        ...newCourse,
        reference_price: newCourse.is_free ? 0 : newCourse.reference_price
      };
      await apiPost('/admin/courses', payload);
      setNewCourse({ title: '', description: '', grade: '', branch: '', is_free: false, cover_url: '', reference_price: 0 });
      setShowCreate(false);
      await fetchCourses();
    } catch (e: any) {
      setError(e.message || 'حدث خطأ أثناء حفظ الكورس');
    } finally {
      submittingRef.current = false;
      setIsSubmitting(false);
    }
  };

  const startEditCourse = (course: Course) => {
    if (submittingRef.current) return;
    setError('');
    setEditingCourse(course);
    setEditCourseForm({
      title: course.title,
      description: course.description || '',
      grade: course.grade || '',
      branch: course.branch || '',
      is_free: course.is_free === 1,
      cover_url: course.cover_url || '',
      reference_price: course.reference_price || 0,
    });
    setShowEdit(true);
  };

  const updateCourse = async () => {
    if (submittingRef.current) return;
    if (!editingCourse || !editCourseForm.title.trim()) {
      setError('يرجى كتابة عنوان الكورس');
      return;
    }
    submittingRef.current = true;
    setIsSubmitting(true);
    setError('');
    try {
      await apiPatch(`/admin/courses/${editingCourse.id}`, {
        title: editCourseForm.title,
        description: editCourseForm.description,
        grade: editCourseForm.grade,
        branch: editCourseForm.branch,
        is_free: !!editCourseForm.is_free,
        cover_url: editCourseForm.cover_url,
        reference_price: editCourseForm.is_free ? 0 : editCourseForm.reference_price,
      });
      setShowEdit(false);
      setEditingCourse(null);
      await fetchCourses();
    } catch (e: any) {
      setError(e.message || 'حدث خطأ أثناء تحديث الكورس');
    } finally {
      submittingRef.current = false;
      setIsSubmitting(false);
    }
  };

  const togglePublish = async (course: Course) => {
    try {
      await apiPatch(`/admin/courses/${course.id}`, { is_published: !course.is_published });
      await Promise.all([fetchCourses(), loadCourseContents(course.id)]);
    } catch (e: any) {
      setError(e.message);
    }
  };

  const togglePublishLesson = async (lesson: Lesson) => {
    const courseId = getCourseIdForUnit(lesson.unit_id);
    try {
      await apiPatch(`/admin/lessons/${lesson.id}`, { is_published: !lesson.is_published });
      if (courseId) await loadCourseContents(courseId);
    } catch (e: any) {
      setError(e.message);
    }
  };

  const confirmDeleteLesson = (lessonId: string, lessonTitle: string) => {
    setDeleteTarget({ id: lessonId, title: lessonTitle, type: 'lesson' });
    setShowDeleteConfirm(true);
  };

  const confirmDeleteCourse = (courseId: string, courseTitle: string) => {
    setDeleteTarget({ id: courseId, title: courseTitle, type: 'course' });
    setShowDeleteConfirm(true);
  };

  const loadCourseContents = useCallback(async (courseId: string) => {
    const requestId = (contentsRequestRef.current[courseId] || 0) + 1;
    contentsRequestRef.current[courseId] = requestId;
    try {
      const data = await api<{ units?: (Unit & { lessons?: Lesson[] })[] }>(`/courses/${courseId}`);
      // Cache by the requested course, and never let an older fetch overwrite a refresh.
      if (contentsRequestRef.current[courseId] !== requestId) return;
      setUnits(u => ({ ...u, [courseId]: data.units || [] }));
      const allLessons: Record<string, Lesson[]> = {};
      for (const unit of data.units || []) {
        allLessons[unit.id] = unit.lessons || [];
      }
      setLessons(l => ({ ...l, ...allLessons }));
    } catch (e: any) {
      if (contentsRequestRef.current[courseId] !== requestId || expandedCourseRef.current !== courseId) return;
      setError(e.message || 'فشل جلب محتويات الكورس');
    }
  }, []);

  const expandCourse = async (courseId: string) => {
    const nextCourseId = expandedCourseRef.current === courseId ? null : courseId;
    expandedCourseRef.current = nextCourseId;
    setExpandedCourse(nextCourseId);
    if (nextCourseId && !units[nextCourseId]) {
      await loadCourseContents(nextCourseId);
    }
  };

  const getCourseIdForUnit = (unitId: string) =>
    Object.entries(units).find(([, courseUnits]) => courseUnits.some(unit => unit.id === unitId))?.[0];

  const getCourseIdForLesson = (lessonId: string) => {
    const unitId = Object.keys(lessons).find(id => lessons[id].some(lesson => lesson.id === lessonId));
    return unitId ? getCourseIdForUnit(unitId) : undefined;
  };

  // Bind uploads to their original course even if the selection changes before completion.
  const refreshUploadedCourseContents = useCallback(() => {
    if (videoCourseId) return loadCourseContents(videoCourseId);
  }, [videoCourseId, loadCourseContents]);

  const executeDelete = async () => {
    if (!deleteTarget) return;
    const courseId = deleteTarget.type === 'lesson' ? getCourseIdForLesson(deleteTarget.id) : deleteTarget.id;
    setIsDeleting(true);
    try {
      if (deleteTarget.type === 'lesson') {
        await apiDelete(`/admin/lessons/${deleteTarget.id}`);
        if (courseId) await loadCourseContents(courseId);
      } else if (deleteTarget.type === 'course') {
        await apiDelete(`/admin/courses/${deleteTarget.id}`);
        contentsRequestRef.current[deleteTarget.id] = (contentsRequestRef.current[deleteTarget.id] || 0) + 1;
        setUnits(current => {
          const next = { ...current };
          delete next[deleteTarget.id];
          return next;
        });
        if (expandedCourseRef.current === deleteTarget.id) {
          expandedCourseRef.current = null;
          setExpandedCourse(null);
        }
        await fetchCourses();
      }
      setShowDeleteConfirm(false);
      setDeleteTarget(null);
    } catch (e: any) {
      setError(e.message || 'حدث خطأ أثناء عملية الحذف');
    } finally {
      setIsDeleting(false);
    }
  };

  const createUnit = async (courseId: string) => {
    if (!newUnit.title.trim()) return;
    try {
      await apiPost(`/admin/courses/${courseId}/units`, {
        title: newUnit.title,
        description: newUnit.description
      });
      setNewUnit(current => current.courseId === courseId ? { courseId: '', title: '', description: '' } : current);
      await loadCourseContents(courseId);
    } catch (e: any) {
      setError(e.message);
    }
  };

  const createLesson = async (unitId: string) => {
    if (!newLesson.title.trim()) return;
    const courseId = getCourseIdForUnit(unitId);
    try {
      await apiPost(`/admin/units/${unitId}/lessons`, {
        title: newLesson.title,
        description: newLesson.description,
        is_free_preview: newLesson.is_free_preview,
        is_published: true,
      });
      setNewLesson(current => current.unitId === unitId ? { unitId: '', title: '', description: '', is_free_preview: false } : current);
      if (courseId) await loadCourseContents(courseId);
    } catch (e: any) {
      setError(e.message);
    }
  };

  const openVideoModal = (lessonId: string) => {
    setVideoCourseId(getCourseIdForLesson(lessonId) || null);
    setSelectedLessonId(lessonId);
    setShowYoutubeModal(true);
  };

  const openQuizModal = (lessonId: string) => {
    setSelectedLessonId(lessonId);
    setShowQuizModal(true);
  };

  const openAttachmentsModal = (lessonId: string) => {
    setSelectedLessonId(lessonId);
    setShowAttachmentsModal(true);
  };

  const publishedCourses = courses.filter((course) => Boolean(course.is_published)).length;
  const draftCourses = courses.length - publishedCourses;
  const totalLessons = courses.reduce((total, course) => total + Number(course.lessons_count || 0), 0);

  return (
    <div className="space-y-6 text-on-surface">

      {/* Header Panel */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-display-lg text-xl sm:text-2xl font-bold text-on-surface flex items-center gap-2">
            <span className="material-symbols-outlined text-primary text-2xl">menu_book</span>
            <span>خزانة الفصول الدراسية والمحاضرات</span>
          </h1>
          <p className="font-body-sm text-on-surface-variant text-xs mt-1">بناء الوحدات الدراسية، رفع محاضرات الفيديو، وتأمين المحتوى</p>
        </div>
        <button
          onClick={() => { if (!submittingRef.current) { setError(''); setShowCreate(true); } }}
          disabled={isSubmitting}
          className="w-full sm:w-auto flex items-center justify-center gap-2 px-6 h-12 bg-primary text-on-primary hover:bg-primary-container rounded-lg font-label-md text-label-md transition shadow-ambient"
        >
          <span className="material-symbols-outlined text-base">add</span>
          <span>إنشاء فصل دراسي جديد</span>
        </button>
      </div>

      <section className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="rounded-lg border border-outline-variant bg-surface p-4"><p className="text-xs font-semibold text-on-surface-variant">دورات منشورة</p><p className="mt-2 text-2xl font-bold text-primary">{publishedCourses}</p><p className="mt-1 text-xs text-on-surface-variant">متاحة للطلاب الآن</p></div>
        <div className="rounded-lg border border-outline-variant bg-surface p-4"><p className="text-xs font-semibold text-on-surface-variant">مسودات تحتاج إكمالًا</p><p className="mt-2 text-2xl font-bold text-warning">{draftCourses}</p><p className="mt-1 text-xs text-on-surface-variant">راجع المحتوى قبل النشر</p></div>
        <div className="rounded-lg border border-outline-variant bg-surface p-4"><p className="text-xs font-semibold text-on-surface-variant">إجمالي المحاضرات</p><p className="mt-2 text-2xl font-bold text-tertiary">{totalLessons}</p><p className="mt-1 text-xs text-on-surface-variant">داخل جميع الدورات</p></div>
      </section>

      {error && (
        <div role="alert" className="p-4 rounded-lg bg-error-container/20 border border-error-container text-error text-sm flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between shadow-sm animate-in fade-in duration-300">
          <span>{error}</span>
          <div className="flex gap-3 text-xs font-bold"><button onClick={() => { void fetchCourses(); const courseId = expandedCourseRef.current; if (courseId) void loadCourseContents(courseId); }} className="hover:underline">إعادة المحاولة</button><button onClick={() => setError('')} className="hover:underline">إخفاء</button></div>
        </div>
      )}

      <CourseTree
        courses={courses}
        loading={loading}
        expandedCourse={expandedCourse}
        units={units}
        lessons={lessons}
        newUnit={newUnit}
        setNewUnit={setNewUnit}
        newLesson={newLesson}
        setNewLesson={setNewLesson}
        onExpandCourse={expandCourse}
        onCreateClick={() => { if (!submittingRef.current) { setError(''); setShowCreate(true); } }}
        onTogglePublish={togglePublish}
        onTogglePublishLesson={togglePublishLesson}
        onEditCourse={startEditCourse}
        onDeleteCourse={confirmDeleteCourse}
        onOpenVideoModal={openVideoModal}
        onOpenQuizModal={openQuizModal}
        onOpenAttachmentsModal={openAttachmentsModal}
        onDeleteLesson={confirmDeleteLesson}
        onCreateUnit={createUnit}
        onCreateLesson={createLesson}
      />

      <CourseFormModal
        mode="create"
        isOpen={showCreate}
        formData={newCourse}
        setFormData={setNewCourse}
        academicYears={academicYears}
        branches={branches}
        busy={isSubmitting}
        error={error}
        onSubmit={createCourse}
        onCancel={() => { if (!submittingRef.current) setShowCreate(false); }}
        setError={setError}
      />

      <CourseFormModal
        mode="edit"
        isOpen={showEdit}
        formData={editCourseForm}
        setFormData={setEditCourseForm}
        academicYears={academicYears}
        branches={branches}
        busy={isSubmitting}
        error={error}
        onSubmit={updateCourse}
        onCancel={() => { if (!submittingRef.current) { setShowEdit(false); setEditingCourse(null); } }}
        setError={setError}
      />

      <VideoUploadPanel
        lessonId={selectedLessonId}
        isOpen={showYoutubeModal}
        onClose={() => { setShowYoutubeModal(false); setSelectedLessonId(null); }}
        onUploaded={refreshUploadedCourseContents}
        setGlobalError={setError}
      />

      <QuizBuilder
        lessonId={selectedLessonId}
        isOpen={showQuizModal}
        onClose={() => { setShowQuizModal(false); setSelectedLessonId(null); }}
      />

      <AttachmentsPanel
        lessonId={selectedLessonId}
        isOpen={showAttachmentsModal}
        onClose={() => { setShowAttachmentsModal(false); setSelectedLessonId(null); }}
      />

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && deleteTarget && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
          <div
            className="bg-surface-container-lowest border border-outline-variant rounded-2xl p-6 max-w-sm w-full shadow-ambient animate-in zoom-in-95 duration-200"
            onClick={e => e.stopPropagation()}
          >
            {/* Icon */}
            <div className="flex flex-col items-center gap-4 text-center">
              <div className="w-14 h-14 rounded-full bg-error-container/20 border-2 border-error/20 flex items-center justify-center">
                <span className="material-symbols-outlined text-error text-2xl">warning</span>
              </div>
              <div className="space-y-1.5">
                <h3 className="text-sm font-bold text-on-surface">
                  {deleteTarget.type === 'lesson' ? 'تأكيد حذف المحاضرة' : 'تأكيد حذف الفصل الدراسي'}
                </h3>
                <p className="text-xs text-on-surface-variant leading-relaxed">
                  هل أنت متأكد من رغبتك في حذف:
                </p>
                <p className="text-xs font-bold text-on-surface bg-surface-container-low border border-outline-variant rounded-lg px-3 py-2 mt-2">
                  &quot;{deleteTarget.title}&quot;
                </p>
                <p className="text-[10px] text-error/80 mt-1">
                  {deleteTarget.type === 'lesson'
                    ? 'لن يتمكن الطلاب من الوصول إلى هذه المحاضرة بعد حذفها.'
                    : 'سيتم نقل الفصل الدراسي إلى الأرشيف وإخفاؤه من قائمة الفصول.'}
                </p>
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={executeDelete}
                disabled={isDeleting}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-error hover:bg-error/90 text-on-error font-bold rounded-lg text-xs transition duration-200 disabled:opacity-60 disabled:pointer-events-none"
              >
                {isDeleting ? (
                  <span className="material-symbols-outlined text-sm animate-spin">sync</span>
                ) : (
                  <span className="material-symbols-outlined text-sm">delete</span>
                )}
                <span>{isDeleting ? 'جاري الحذف...' : 'نعم، تأكيد الحذف'}</span>
              </button>
              <button
                onClick={() => { setShowDeleteConfirm(false); setDeleteTarget(null); }}
                disabled={isDeleting}
                className="flex-1 py-2.5 bg-surface border border-outline-variant text-on-surface-variant hover:bg-surface-container-low rounded-lg text-xs font-bold transition duration-200"
              >
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
