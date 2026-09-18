'use client';

import { useState, useRef } from 'react';
import { apiPost } from '@/lib/api';
import { CourseFormData } from '../types';

interface CourseFormModalProps {
  mode: 'create' | 'edit';
  isOpen: boolean;
  busy?: boolean;
  error?: string;
  formData: CourseFormData;
  setFormData: React.Dispatch<React.SetStateAction<CourseFormData>>;
  academicYears: string[];
  branches: string[];
  onSubmit: () => void;
  onCancel: () => void;
  setError: (msg: string) => void;
}

export default function CourseFormModal({
  mode,
  isOpen,
  busy = false,
  error = '',
  formData,
  setFormData,
  academicYears,
  branches,
  onSubmit,
  onCancel,
  setError,
}: CourseFormModalProps) {
  const [isUploading, setIsUploading] = useState(false);
  const uploadingRef = useRef(false);
  const [uploadProgress, setUploadProgress] = useState<string | null>(null);
  const isBusy = busy || isUploading;

  const handleSubmit = () => {
    if (busy || uploadingRef.current) return;
    setUploadProgress(null);
    onSubmit();
  };

  const handleCancel = () => {
    if (busy || uploadingRef.current) return;
    setUploadProgress(null);
    onCancel();
  };

  // Extract crop position and zoom from cover_url query parameters
  let parsedX = 50;
  let parsedY = 50;
  let parsedZoom = 100;
  if (formData.cover_url) {
    const match = formData.cover_url.match(/[?&]pos=([^&]+)/);
    if (match && match[1]) {
      const parts = match[1].split(',');
      parsedX = parseInt(parts[0]) || 50;
      parsedY = parseInt(parts[1]) || 50;
      parsedZoom = parseInt(parts[2]) || 100;
    }
  }

  const updatePosition = (x: number, y: number, zoomVal: number) => {
    const cleanUrl = formData.cover_url.split('?')[0];
    setFormData(prev => ({
      ...prev,
      cover_url: `${cleanUrl}?pos=${x},${y},${zoomVal}`
    }));
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    e.preventDefault();
    const startX = e.clientX;
    const startY = e.clientY;
    const startPosX = parsedX;
    const startPosY = parsedY;
    
    const handleMouseMove = (moveEvent: MouseEvent) => {
      const dx = moveEvent.clientX - startX;
      const dy = moveEvent.clientY - startY;
      // Drag sensitivity: 1px = 0.3%
      const nextX = Math.max(0, Math.min(100, Math.round(startPosX - dx * 0.3)));
      const nextY = Math.max(0, Math.min(100, Math.round(startPosY - dy * 0.3)));
      updatePosition(nextX, nextY, parsedZoom);
    };
    
    const handleMouseUp = () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
    
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  };

  const handleTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    const touch = e.touches[0];
    if (!touch) return;
    const startX = touch.clientX;
    const startY = touch.clientY;
    const startPosX = parsedX;
    const startPosY = parsedY;
    
    const handleTouchMove = (moveEvent: TouchEvent) => {
      const moveTouch = moveEvent.touches[0];
      if (!moveTouch) return;
      const dx = moveTouch.clientX - startX;
      const dy = moveTouch.clientY - startY;
      const nextX = Math.max(0, Math.min(100, Math.round(startPosX - dx * 0.3)));
      const nextY = Math.max(0, Math.min(100, Math.round(startPosY - dy * 0.3)));
      updatePosition(nextX, nextY, parsedZoom);
    };
    
    const handleTouchEnd = () => {
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', handleTouchEnd);
    };
    
    window.addEventListener('touchmove', handleTouchMove);
    window.addEventListener('touchend', handleTouchEnd);
  };

  const handleCoverUpload = async (file: File) => {
    if (busy || uploadingRef.current) return;
    uploadingRef.current = true;
    setIsUploading(true);
    try {
      setError('');
      setUploadProgress('جاري طلب رابط رفع غلاف الفصل الدراسي...');

      const { upload_url, public_url } = await apiPost<{ upload_url: string; public_url: string }>(
        '/admin/courses/cover-upload-url',
        { filename: file.name, mime_type: file.type }
      );

      setUploadProgress('جاري رفع صورة الغلاف...');
      const response = await fetch(upload_url, {
        method: 'PUT',
        body: file,
        headers: {
          'Content-Type': file.type || 'image/jpeg',
        },
      });

      if (!response.ok) {
        throw new Error('فشل رفع الصورة إلى السيرفر');
      }

      setUploadProgress('🎉 تم رفع الصورة بنجاح!');
      setFormData(prev => ({ ...prev, cover_url: public_url }));

    } catch (e: any) {
      setError(e.message || 'حدث خطأ أثناء رفع صورة الغلاف');
      setUploadProgress(null);
    } finally {
      uploadingRef.current = false;
      setIsUploading(false);
    }
  };

  if (!isOpen) return null;

  const isCreate = mode === 'create';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-in fade-in duration-200">
      <div
        className="bg-surface-container-lowest border border-outline-variant rounded-2xl p-6 max-w-lg w-full max-h-[calc(100vh-2rem)] overflow-y-auto space-y-5 shadow-ambient animate-in zoom-in-95 duration-200"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-outline-variant pb-3">
          <h3 className="text-sm font-bold text-on-surface flex items-center gap-2">
            <span className="material-symbols-outlined text-primary text-base">{isCreate ? 'menu_book' : 'edit'}</span>
            <span>{isCreate ? 'إنشاء فصل دراسي جديد' : 'تعديل الفصل الدراسي'}</span>
          </h3>
          <button
            onClick={handleCancel}
            disabled={isBusy}
            className="text-on-surface-variant hover:text-on-surface transition flex items-center"
          >
            <span className="material-symbols-outlined text-base">close</span>
          </button>
        </div>

        {isCreate && (
          <div className="grid grid-cols-3 gap-2 border-b border-outline-variant pb-4 text-center text-[11px] font-bold">
            <div className="rounded-lg bg-primary/10 px-2 py-2 text-primary"><span className="block text-base">1</span>إعداد الدورة</div>
            <div className="rounded-lg bg-surface-container-low px-2 py-2 text-on-surface-variant"><span className="block text-base">2</span>إضافة المحتوى</div>
            <div className="rounded-lg bg-surface-container-low px-2 py-2 text-on-surface-variant"><span className="block text-base">3</span>مراجعة ونشر</div>
          </div>
        )}

        {error && (
          <div role="alert" className="p-3 rounded-lg bg-error-container/20 border border-error-container text-error text-xs text-start">
            {error}
          </div>
        )}

        <fieldset disabled={busy} className="space-y-4 text-start">
          <div className="space-y-1.5">
            <label className="text-[11px] font-bold text-on-surface-variant ms-1">اسم الفصل الدراسي</label>
            <input
              placeholder={isCreate ? 'مثال: كورس النحو والصرف للصف الثالث الثانوي...' : 'اسم الفصل الدراسي...'}
              value={formData.title}
              onChange={e => setFormData({ ...formData, title: e.target.value })}
              className="w-full px-4 py-2.5 bg-surface-container-low border border-outline-variant focus:border-primary focus:ring-1 focus:ring-primary rounded-xl text-xs text-on-surface placeholder:text-outline focus:outline-none transition text-start"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-[11px] font-bold text-on-surface-variant ms-1">المرحلة الدراسية / الصف</label>
            <select
              value={formData.grade}
              onChange={e => setFormData({ ...formData, grade: e.target.value })}
              className="w-full px-4 py-2.5 bg-surface-container-low border border-outline-variant focus:border-primary focus:ring-1 focus:ring-primary rounded-xl text-xs text-on-surface focus:outline-none transition text-start"
            >
              <option value="">اختر الصف الدراسي...</option>
              {academicYears.map((year, idx) => (
                <option key={idx} value={year}>{year}</option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="text-[11px] font-bold text-on-surface-variant ms-1">الشعبة الدراسية / المسار</label>
            <select
              value={formData.branch}
              onChange={e => setFormData({ ...formData, branch: e.target.value })}
              className="w-full px-4 py-2.5 bg-surface-container-low border border-outline-variant focus:border-primary focus:ring-1 focus:ring-primary rounded-xl text-xs text-on-surface focus:outline-none transition text-start"
            >
              <option value="">اختر الشعبة...</option>
              {branches.map((b, idx) => (
                <option key={idx} value={b}>{b}</option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="text-[11px] font-bold text-on-surface-variant ms-1">الوصف التعريفي للفصل الدراسي</label>
            <textarea
              placeholder={isCreate ? 'اكتب نبذة مختصرة عن الدروس والمواضيع التي يغطيها هذا الفصل الدراسي...' : 'نبذة مختصرة عن الفصل الدراسي...'}
              value={formData.description}
              rows={3}
              onChange={e => setFormData({ ...formData, description: e.target.value })}
              className="w-full px-4 py-2.5 bg-surface-container-low border border-outline-variant focus:border-primary focus:ring-1 focus:ring-primary rounded-xl text-xs text-on-surface placeholder:text-outline focus:outline-none transition resize-none text-start"
            />
          </div>

          {/* Cover Image Uploader with simulation and alignment dragging */}
          <div className="space-y-3">
            <label className="text-[11px] font-bold text-on-surface-variant ms-1 block">صورة غلاف الفصل الدراسي</label>
            
            {/* Preferred Dimensions Notice */}
            <div className="text-[10px] bg-primary/5 text-primary border border-primary/10 rounded-xl p-2.5 leading-relaxed text-start font-medium">
              💡 <b>المقاس المفضّل لصور الغلاف:</b> الأبعاد المثالية هي <b>800 × 500 بكسل</b> (بنسبة عرض إلى ارتفاع <b>16:9</b>) لكي تظهر الكروت بأعلى دقة وجاذبية وتتناسب تماماً مع التصميم.
            </div>

            {formData.cover_url ? (
              <div className="space-y-3">
                {/* Simulation card container */}
                <div className="border border-outline-variant rounded-xl p-3 bg-surface-container-low space-y-3 text-start">
                  <div className="text-[10px] font-bold text-primary flex items-center gap-1 justify-end">
                    <span>اسحب الصورة داخل الكارت لتعديل موضع العرض</span>
                    <span className="material-symbols-outlined text-xs">open_with</span>
                  </div>

                  {/* Simulated student platform card */}
                  <div className="border border-outline-variant/40 rounded-xl overflow-hidden bg-surface-container-lowest shadow-sm flex flex-col justify-between p-3 select-none mx-auto max-w-[280px]">
                    <div>
                      {/* Simulated Card Image */}
                      <div 
                        onMouseDown={handleMouseDown}
                        onTouchStart={handleTouchStart}
                        className="relative overflow-hidden rounded-lg bg-surface-dim cursor-grab active:cursor-grabbing group"
                        style={{ height: '120px', position: 'relative' }}
                      >
                        <img 
                          src={formData.cover_url} 
                          alt="Simulated Cover" 
                          className="w-full h-full object-cover pointer-events-none transition-transform duration-75 ease-out"
                          style={{ 
                            objectPosition: `${parsedX}% ${parsedY}%`,
                            transform: `scale(${parsedZoom / 100})`,
                            transformOrigin: 'center center'
                          }} 
                        />
                        {/* Overlay text */}
                        <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition flex items-center justify-center pointer-events-none">
                          <span className="bg-black/60 text-white text-[9px] px-2 py-0.5 rounded-full flex items-center gap-1">
                            <span className="material-symbols-outlined text-[11px]">open_with</span>
                            اسحب للتعديل
                          </span>
                        </div>
                      </div>
                      
                      {/* Simulated Title/Desc */}
                      <div className="mt-2.5 space-y-0.5">
                        <h4 className="text-[11px] font-extrabold text-on-surface line-clamp-1">{formData.title || 'اسم الفصل الدراسي تجريبي'}</h4>
                        <p className="text-[9px] text-on-surface-variant line-clamp-1 leading-normal">{formData.description || 'كورس شرح وتدريبات المنهج بالكامل...'}</p>
                      </div>
                    </div>
                    
                    {/* Simulated progress */}
                    <div className="mt-3 pt-2 border-t border-outline-variant/10">
                      <div className="flex justify-between text-[8px] font-bold mb-0.5">
                        <span>نسبة الإنجاز</span>
                        <span className="text-success">75%</span>
                      </div>
                      <div className="h-1 bg-surface-dim rounded-full overflow-hidden">
                        <div className="h-full w-[75%] bg-primary"></div>
                      </div>
                    </div>
                  </div>

                  {/* Alignment Sliders */}
                  <div className="space-y-2 pt-2 border-t border-outline-variant/30 text-[10px]">
                    <div className="flex items-center gap-2">
                      <span className="text-on-surface-variant min-w-[85px] text-start font-medium">تكبير/تصغير ({parsedZoom}%)</span>
                      <input 
                        type="range" 
                        min="100" 
                        max="250" 
                        value={parsedZoom} 
                        onChange={e => updatePosition(parsedX, parsedY, parseInt(e.target.value))}
                        className="flex-1 accent-primary h-1 bg-outline-variant rounded-lg cursor-pointer"
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-on-surface-variant min-w-[85px] text-start font-medium">أفقي ({parsedX}%)</span>
                      <input 
                        type="range" 
                        min="0" 
                        max="100" 
                        value={parsedX} 
                        onChange={e => updatePosition(parseInt(e.target.value), parsedY, parsedZoom)}
                        className="flex-1 accent-primary h-1 bg-outline-variant rounded-lg cursor-pointer"
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-on-surface-variant min-w-[85px] text-start font-medium">رأسي ({parsedY}%)</span>
                      <input 
                        type="range" 
                        min="0" 
                        max="100" 
                        value={parsedY} 
                        onChange={e => updatePosition(parsedX, parseInt(e.target.value), parsedZoom)}
                        className="flex-1 accent-primary h-1 bg-outline-variant rounded-lg cursor-pointer"
                      />
                    </div>
                    <div className="flex justify-between items-center pt-1">
                      <button
                        type="button"
                        onClick={() => setFormData(prev => ({ ...prev, cover_url: '' }))}
                        className="text-red-500 hover:text-red-600 font-bold hover:underline flex items-center gap-0.5"
                      >
                        <span className="material-symbols-outlined text-xs">delete</span>
                        <span>حذف الصورة</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => updatePosition(50, 50, 100)}
                        className="text-primary font-bold hover:underline"
                      >
                        إعادة تعيين الافتراضي
                      </button>
                    </div>
                  </div>
                </div>

                {/* Button to replace the cover image */}
                <div className="relative">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={e => {
                      const file = e.target.files?.[0];
                      if (file) handleCoverUpload(file);
                    }}
                    className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                    disabled={isBusy}
                  />
                  <button
                    type="button"
                    className="px-4 py-2 border border-outline-variant rounded-xl text-xs font-bold text-on-surface hover:bg-surface-container-low transition w-full text-center"
                  >
                    تغيير صورة الغلاف
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-3">
                <div className="relative w-20 h-14 rounded-lg border border-dashed border-outline-variant shrink-0 bg-surface-container-low flex items-center justify-center text-on-surface-variant/40">
                  <span className="material-symbols-outlined text-lg">image</span>
                </div>
                <div className="flex-1 relative">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={e => {
                      const file = e.target.files?.[0];
                      if (file) handleCoverUpload(file);
                    }}
                    className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                    disabled={isBusy}
                  />
                  <button
                    type="button"
                    className="px-4 py-2.5 border border-outline-variant rounded-xl text-xs font-bold text-on-surface hover:bg-surface-container-low transition w-full text-center"
                  >
                    اختر صورة الغلاف
                  </button>
                </div>
              </div>
            )}

            {/* Upload progress message */}
            {uploadProgress && (
              <div className="text-[10px] text-primary font-semibold text-center mt-1">
                {uploadProgress}
              </div>
            )}
          </div>

          <label className="flex items-center gap-2 select-none cursor-pointer p-1.5 border border-outline-variant rounded-xl bg-surface-container-low/50 justify-start">
            <input
              type="checkbox"
              checked={formData.is_free}
              onChange={e => setFormData({ ...formData, is_free: e.target.checked })}
              className="rounded border-outline-variant text-primary focus:ring-primary"
            />
            <span className="text-xs text-on-surface font-semibold ms-1">
              {isCreate ? 'جعل الفصل الدراسي بالكامل مجاني للجميع' : 'جعل الكورس بالكامل مجاني للجميع'}
            </span>
          </label>

          {!formData.is_free && (
            <div className="space-y-1 text-start">
              <label className="text-[11px] font-bold text-on-surface-variant ms-1">سعر الكورس (بالجنيه المصري)</label>
              <input
                type="number"
                value={formData.reference_price || ''}
                onChange={e => setFormData({ ...formData, reference_price: parseInt(e.target.value) || 0 })}
                placeholder="مثال: 150"
                className="w-full px-3.5 py-2 text-xs border border-outline-variant rounded-xl focus:outline-none focus:border-primary/40 focus:ring-4 focus:ring-primary/5 text-start font-medium"
              />
            </div>
          )}
        </fieldset>

        <div className="flex gap-3 pt-2">
          <button
            onClick={handleSubmit}
            disabled={isBusy}
            aria-busy={isBusy}
            className="flex-1 py-2.5 bg-primary hover:bg-primary-container text-on-primary font-bold rounded-lg text-xs transition duration-300 disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {isCreate ? 'حفظ والمتابعة لإضافة المحتوى' : 'تحديث وحفظ التعديلات'}
          </button>
          <button
            onClick={handleCancel}
            disabled={isBusy}
            className="px-5 py-2.5 bg-surface border border-outline-variant text-on-surface-variant rounded-lg text-xs hover:bg-surface-container-low transition duration-300"
          >
            إلغاء
          </button>
        </div>
      </div>
    </div>
  );
}
