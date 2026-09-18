'use client';

import { Course, Unit, Lesson, NewUnitState, NewLessonState } from '../types';

function parseCoverPosition(src: string | null | undefined): React.CSSProperties {
  if (!src) return {};
  const match = src.match(/[?&]pos=([^&]+)/);
  if (match && match[1]) {
    const parts = match[1].split(',');
    const x = parts[0];
    const y = parts[1];
    const zoom = parts[2];
    
    const style: React.CSSProperties = {};
    if (x !== undefined && y !== undefined) {
      style.objectPosition = `${x}% ${y}%`;
    }
    if (zoom !== undefined) {
      const zoomVal = parseInt(zoom);
      if (zoomVal && zoomVal !== 100) {
        style.transform = `scale(${zoomVal / 100})`;
        style.transformOrigin = 'center center';
      }
    }
    return style;
  }
  return {};
}

interface CourseTreeProps {
  courses: Course[];
  loading: boolean;
  expandedCourse: string | null;
  units: Record<string, Unit[]>;
  lessons: Record<string, Lesson[]>;
  newUnit: NewUnitState;
  setNewUnit: React.Dispatch<React.SetStateAction<NewUnitState>>;
  newLesson: NewLessonState;
  setNewLesson: React.Dispatch<React.SetStateAction<NewLessonState>>;
  onExpandCourse: (courseId: string) => void;
  onCreateClick: () => void;
  onTogglePublish: (course: Course) => void;
  onTogglePublishLesson: (lesson: Lesson) => void;
  onEditCourse: (course: Course) => void;
  onDeleteCourse: (id: string, title: string) => void;
  onOpenVideoModal: (lessonId: string) => void;
  onOpenQuizModal: (lessonId: string) => void;
  onOpenAttachmentsModal: (lessonId: string) => void;
  onDeleteLesson: (lessonId: string, lessonTitle: string) => void;
  onCreateUnit: (courseId: string) => void;
  onCreateLesson: (unitId: string) => void;
}

export default function CourseTree({
  courses,
  loading,
  expandedCourse,
  units,
  lessons,
  newUnit,
  setNewUnit,
  newLesson,
  setNewLesson,
  onExpandCourse,
  onCreateClick,
  onTogglePublish,
  onTogglePublishLesson,
  onEditCourse,
  onDeleteCourse,
  onOpenVideoModal,
  onOpenQuizModal,
  onOpenAttachmentsModal,
  onDeleteLesson,
  onCreateUnit,
  onCreateLesson,
}: CourseTreeProps) {
  return (
    <div className="space-y-4">
      {loading ? (
        <div className="flex justify-center py-20 bg-surface border border-outline-variant rounded-xl">
          <span className="material-symbols-outlined animate-spin text-primary text-2xl">sync</span>
        </div>
      ) : courses.length === 0 ? (
        <div className="p-8 sm:p-12 text-center bg-surface border border-outline-variant rounded-xl text-on-surface-variant">
          <span className="material-symbols-outlined text-3xl text-primary">school</span>
          <h2 className="mt-3 text-base font-bold text-on-surface">ابدأ ببناء أول دورة</h2>
          <p className="mt-2 text-sm">أنشئ الفصل، أضف الوحدات والمحاضرات، ثم راجع المحتوى وانشره للطلاب.</p>
          <div className="mx-auto mt-6 grid max-w-2xl grid-cols-1 gap-2 text-right sm:grid-cols-3"><span className="rounded-lg bg-surface-container-low p-3 text-xs font-bold text-on-surface"><b className="text-primary">1.</b> بيانات الدورة</span><span className="rounded-lg bg-surface-container-low p-3 text-xs font-bold text-on-surface"><b className="text-primary">2.</b> الوحدات والمحاضرات</span><span className="rounded-lg bg-surface-container-low p-3 text-xs font-bold text-on-surface"><b className="text-primary">3.</b> مراجعة ونشر</span></div>
          <button onClick={onCreateClick} className="mt-6 h-10 rounded-lg bg-primary px-5 text-xs font-bold text-on-primary">إنشاء فصل دراسي</button>
        </div>
      ) : courses.map(course => {
        const isExpanded = expandedCourse === course.id;
        return (
          <div
            key={course.id}
            className="bg-surface border border-outline-variant rounded-xl shadow-soft overflow-hidden transition-all duration-300 hover:shadow-ambient"
          >
            {/* Course Header Bar */}
            <div
              onClick={() => onExpandCourse(course.id)}
              className="p-5 flex items-center justify-between gap-4 cursor-pointer hover:bg-surface-container-lowest/50 transition select-none"
            >
              <div className="flex items-start gap-4 flex-1">
                {course.cover_url ? (
                  <div className="w-16 h-10 rounded-lg border border-outline-variant shrink-0 bg-surface-container overflow-hidden relative">
                    <img
                      src={course.cover_url}
                      alt={course.title}
                      className="w-full h-full object-cover"
                      style={parseCoverPosition(course.cover_url)}
                    />
                  </div>
                ) : (
                  <div className="w-16 h-10 rounded-lg border border-dashed border-outline-variant shrink-0 bg-surface-container-low flex items-center justify-center text-on-surface-variant/40">
                    <span className="material-symbols-outlined text-lg">image</span>
                  </div>
                )}
                <div className="space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h2 className="text-sm font-bold text-on-surface">{course.title}</h2>
                    <span className="px-2 py-0.5 bg-primary/10 border border-primary/20 text-primary rounded-full text-[10px] font-bold">
                      {course.grade}
                    </span>
                    {course.branch && (
                      <span className="px-2 py-0.5 bg-secondary/10 border border-secondary/20 text-secondary rounded-full text-[10px] font-bold">
                        {course.branch}
                      </span>
                    )}
                    {course.is_free === 1 ? (
                      <span className="px-2 py-0.5 bg-tertiary-fixed text-on-tertiary-fixed-variant rounded-full text-[10px] font-bold">
                        مفتوح مجاناً
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 bg-warning-container border border-warning/30 text-on-warning-container rounded-full text-[10px] font-bold">
                        {course.reference_price || 0} ج.م
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-on-surface-variant line-clamp-1 max-w-3xl leading-relaxed">{course.description}</p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div className="hidden sm:flex flex-col text-left font-mono text-[10px] text-on-surface-variant">
                  <span>{course.students_count} طالب مشترك</span>
                  <span>{course.units_count} وحدة | {course.lessons_count} محاضرة</span>
                </div>

                {/* Action Controls */}
                <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
                  <button
                    onClick={() => onTogglePublish(course)}
                    title={course.is_published ? 'إلغاء النشر' : 'نشر الكورس'}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition border ${
                      course.is_published
                        ? 'bg-tertiary-fixed text-on-tertiary-fixed-variant border-tertiary/20'
                        : 'bg-surface-container-low text-on-surface-variant border-outline-variant/60 hover:bg-surface-container'
                    }`}
                  >
                    {course.is_published ? 'منشور' : 'مسودة'}
                  </button>
                  <button
                    onClick={() => onEditCourse(course)}
                    title="تعديل تفاصيل الفصل الدراسي"
                    className="p-2 text-on-surface-variant hover:text-primary hover:bg-primary/10 rounded-lg transition flex items-center justify-center"
                  >
                    <span className="material-symbols-outlined text-base">edit</span>
                  </button>
                  <button
                    onClick={() => onDeleteCourse(course.id, course.title)}
                    title="حذف الفصل الدراسي"
                    className="p-2 text-on-surface-variant hover:text-error hover:bg-error-container/20 rounded-lg transition flex items-center justify-center"
                  >
                    <span className="material-symbols-outlined text-base">delete</span>
                  </button>
                </div>

                <span className={`material-symbols-outlined text-on-surface-variant transition-transform duration-300 ${isExpanded ? 'rotate-180' : ''}`}>
                  expand_more
                </span>
              </div>
            </div>

            {/* Course Units and Lessons List (Collapsible Container) */}
            {isExpanded && (
              <div className="border-t border-outline-variant p-6 bg-surface-container-low/50 space-y-6 animate-in slide-in-from-top-1">

                {/* Units rendering */}
                {units[course.id] && units[course.id].length > 0 ? (
                  <div className="space-y-6">
                    {units[course.id].map(unit => (
                      <div key={unit.id} className="bg-surface border border-outline-variant rounded-xl p-5 space-y-4">
                        <div className="flex justify-between items-center border-b border-outline-variant pb-2">
                          <h3 className="text-xs font-bold text-on-surface flex items-center gap-1.5">
                            <span className="material-symbols-outlined text-primary text-base">layers</span>
                            <span>{unit.title}</span>
                          </h3>
                          <span className="text-[10px] text-on-surface-variant font-mono">
                            معرف الوحدة: #{unit.id.substring(0, 8)}
                          </span>
                        </div>

                        {/* Lessons inside the unit */}
                        <div className="space-y-2">
                          {lessons[unit.id] && lessons[unit.id].length > 0 ? (
                            lessons[unit.id].map(lesson => (
                              <div
                                key={lesson.id}
                                className="flex items-center justify-between gap-4 p-3.5 bg-surface-container-lowest border border-outline-variant/60 rounded-lg hover:border-primary/30 transition duration-150"
                              >
                                <div className="flex items-center gap-3">
                                  <span className="material-symbols-outlined text-secondary text-base">videocam</span>
                                  <div>
                                    <p className="text-xs font-bold text-on-surface">{lesson.title}</p>
                                    <p className="text-[10px] text-on-surface-variant mt-0.5">
                                      {lesson.is_free_preview === 1 ? 'متاحة كمعاينة مجانية' : 'مغلقة (تحتاج رمز تفعيل أو اشتراك)'}
                                    </p>
                                  </div>
                                </div>

                                <div className="flex items-center gap-2">
                                  <button
                                    onClick={() => onTogglePublishLesson(lesson)}
                                    title={lesson.is_published ? 'تحويل الدرس إلى مسودة' : 'نشر الدرس'}
                                    className={`px-3 py-1.5 rounded-lg text-[10px] font-bold transition border ${
                                      lesson.is_published
                                        ? 'bg-tertiary-fixed text-on-tertiary-fixed-variant border-tertiary/20'
                                        : 'bg-surface-container-low text-on-surface-variant border-outline-variant/60 hover:bg-surface-container'
                                    }`}
                                  >
                                    {lesson.is_published ? 'منشور' : 'مسودة'}
                                  </button>
                                  <button
                                    onClick={() => onOpenVideoModal(lesson.id)}
                                    className="flex items-center gap-1.5 px-3 py-1.5 bg-primary/10 border border-primary/20 hover:bg-primary/20 text-primary text-[10px] font-bold rounded-lg transition"
                                  >
                                    <span className="material-symbols-outlined text-xs">cloud_upload</span>
                                    <span>رفع الفيديوهات</span>
                                  </button>
                                  <button
                                    onClick={() => onOpenQuizModal(lesson.id)}
                                    className="flex items-center gap-1.5 px-3 py-1.5 bg-warning-container/40 border border-warning/20 hover:bg-warning-container/70 text-on-warning-container text-[10px] font-bold rounded-lg transition"
                                  >
                                    <span className="material-symbols-outlined text-xs">quiz</span>
                                    <span>الواجبات والامتحانات</span>
                                  </button>
                                  <button
                                    onClick={() => onOpenAttachmentsModal(lesson.id)}
                                    className="flex items-center gap-1.5 px-3 py-1.5 bg-tertiary-container/50 border border-tertiary/20 hover:bg-tertiary-container/80 text-tertiary text-[10px] font-bold rounded-lg transition"
                                  >
                                    <span className="material-symbols-outlined text-xs">attach_file</span>
                                    <span>المرفقات والكتب</span>
                                  </button>
                                  <button
                                    onClick={() => onDeleteLesson(lesson.id, lesson.title)}
                                    title="حذف المحاضرة"
                                    className="flex items-center gap-1 px-2.5 py-1.5 text-error bg-error-container/10 hover:bg-error-container/30 border border-error/20 hover:border-error/40 rounded-lg transition font-bold text-[10px]"
                                  >
                                    <span className="material-symbols-outlined text-xs">delete</span>
                                    <span>حذف</span>
                                  </button>
                                </div>
                              </div>
                            ))
                          ) : (
                            <p className="text-[11px] text-on-surface-variant italic py-2">لا توجد محاضرات في هذه الوحدة بعد.</p>
                          )}

                          {/* Add Lesson inline form */}
                          <div className="border border-dashed border-outline-variant rounded-lg p-3 bg-surface-container-low/50 flex flex-col sm:flex-row items-center gap-3 pt-3">
                            <input
                              placeholder="عنوان المحاضرة الجديدة..."
                              value={newLesson.unitId === unit.id ? newLesson.title : ''}
                              onChange={e => setNewLesson({ unitId: unit.id, title: e.target.value, description: '', is_free_preview: false })}
                              className="w-full sm:flex-1 px-3 py-1.5 bg-surface border border-outline-variant rounded-lg text-xs outline-none focus:border-primary text-right"
                            />
                            <div className="flex items-center gap-3 shrink-0">
                              <label className="flex items-center gap-1.5 text-xs text-on-surface-variant select-none cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={newLesson.unitId === unit.id ? newLesson.is_free_preview : false}
                                  onChange={e => setNewLesson({ unitId: unit.id, title: newLesson.title, description: '', is_free_preview: e.target.checked })}
                                  className="rounded border-outline-variant text-primary focus:ring-primary"
                                />
                                <span>معاينة مجانية</span>
                              </label>
                              <button
                                onClick={() => onCreateLesson(unit.id)}
                                disabled={newLesson.unitId !== unit.id || !newLesson.title.trim()}
                                className="px-4 py-1.5 bg-secondary text-on-secondary font-bold rounded-lg text-[10px] disabled:opacity-40 disabled:pointer-events-none hover:bg-secondary/95 transition flex items-center gap-1"
                              >
                                <span className="material-symbols-outlined text-xs">add</span>
                                <span>إضافة المحاضرة</span>
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-on-surface-variant italic text-center py-4 bg-surface border border-outline-variant rounded-xl">
                    لم يتم إضافة أي وحدات دراسية لهذا الكورس بعد.
                  </p>
                )}

                {/* Add Unit form under the course */}
                <div className="bg-surface border border-outline-variant rounded-xl p-5 space-y-3">
                  <h4 className="text-xs font-bold text-on-surface">إضافة وحدة دراسية جديدة للمسار</h4>
                  <div className="flex flex-col sm:flex-row gap-3">
                    <input
                      placeholder="أدخل عنوان الوحدة الجديدة (مثال: الباب الثاني: التيار المتردد)..."
                      value={newUnit.courseId === course.id ? newUnit.title : ''}
                      onChange={e => setNewUnit({ courseId: course.id, title: e.target.value, description: '' })}
                      className="flex-1 px-4 py-2 bg-surface-container-low border border-outline-variant focus:border-primary focus:ring-1 focus:ring-primary rounded-lg text-xs outline-none transition text-right"
                    />
                    <button
                      onClick={() => onCreateUnit(course.id)}
                      disabled={newUnit.courseId !== course.id || !newUnit.title.trim()}
                      className="px-6 py-2 bg-primary text-on-primary font-bold rounded-lg text-xs disabled:opacity-40 disabled:pointer-events-none hover:bg-primary/95 transition flex items-center gap-1 shrink-0 justify-center"
                    >
                      <span className="material-symbols-outlined text-sm">add</span>
                      <span>إضافة الوحدة</span>
                    </button>
                  </div>
                </div>

              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
