'use client';

import { useEffect, useState } from 'react';
import { apiGet, apiPost, apiDelete } from '@/lib/api';

interface AttachmentsPanelProps {
  lessonId: string | null;
  isOpen: boolean;
  onClose: () => void;
}

export default function AttachmentsPanel({ lessonId, isOpen, onClose }: AttachmentsPanelProps) {
  const [lessonAttachments, setLessonAttachments] = useState<any[]>([]);
  const [attachmentsLoading, setAttachmentsLoading] = useState(false);
  const [isUploadingAttachment, setIsUploadingAttachment] = useState(false);
  const [newAttachmentTitle, setNewAttachmentTitle] = useState('');
  const [selectedAttachmentFile, setSelectedAttachmentFile] = useState<File | null>(null);
  const [attachmentsError, setAttachmentsError] = useState('');
  const [attachmentsSuccess, setAttachmentsSuccess] = useState('');

  const fetchAttachmentsForLesson = async (targetLessonId: string) => {
    try {
      setAttachmentsLoading(true);
      setAttachmentsError('');
      // Call public courses route to get attachments
      const res = await apiGet<any>(`/courses/lessons/${targetLessonId}`);
      setLessonAttachments(res.lesson?.attachments || res.attachments || []);
    } catch (e: any) {
      console.error(e);
      setAttachmentsError(e.message || 'فشل تحميل ملفات المحاضرة');
    } finally {
      setAttachmentsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen && lessonId) {
      fetchAttachmentsForLesson(lessonId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, lessonId]);

  const handleUploadAttachment = async () => {
    if (!lessonId || !selectedAttachmentFile || !newAttachmentTitle.trim()) return;
    try {
      setIsUploadingAttachment(true);
      setAttachmentsError('');

      // 1. Register attachment metadata in backend
      const regResp = await apiPost<any>(`/admin/lessons/${lessonId}/files`, {
        title: newAttachmentTitle.trim(),
        mime_type: selectedAttachmentFile.type || 'application/pdf',
        size_bytes: selectedAttachmentFile.size,
        is_downloadable: false,
        watermark: true
      });

      const { upload } = regResp;
      if (!upload || !upload.upload_url) {
        throw new Error('فشل الحصول على رابط الرفع من الخادم الخلفي');
      }

      // 2. Upload file directly to R2 using PUT
      const uploadRes = await fetch(upload.upload_url, {
        method: 'PUT',
        body: selectedAttachmentFile,
        headers: {
          'Content-Type': selectedAttachmentFile.type || 'application/pdf'
        }
      });

      if (!uploadRes.ok) {
        throw new Error(`فشل رفع الملف إلى التخزين السحابي: HTTP ${uploadRes.status}`);
      }

      setAttachmentsSuccess('تم رفع وإرفاق الملف بنجاح!');
      setTimeout(() => setAttachmentsSuccess(''), 4000);
      setNewAttachmentTitle('');
      setSelectedAttachmentFile(null);

      // Reload attachments
      await fetchAttachmentsForLesson(lessonId);
    } catch (e: any) {
      console.error(e);
      setAttachmentsError(e.message || 'فشل رفع الملف المرفق');
    } finally {
      setIsUploadingAttachment(false);
    }
  };

  const handleDeleteAttachment = async (fileId: string) => {
    if (!lessonId) return;
    if (!confirm('هل أنت متأكد من رغبتك في حذف هذا الملف المرفق؟')) return;

    try {
      setAttachmentsLoading(true);
      setAttachmentsError('');
      setAttachmentsSuccess('');
      await apiDelete(`/admin/lessons/${lessonId}/files/${fileId}`);
      setAttachmentsSuccess('تم حذف الملف بنجاح');
      setTimeout(() => setAttachmentsSuccess(''), 4000);
      await fetchAttachmentsForLesson(lessonId);
    } catch (e: any) {
      console.error(e);
      setAttachmentsError(e.message || 'فشل حذف الملف المرفق');
    } finally {
      setAttachmentsLoading(false);
    }
  };

  const handleClose = () => {
    onClose();
    setNewAttachmentTitle('');
    setSelectedAttachmentFile(null);
    setAttachmentsError('');
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={handleClose}
    >
      <div
        className="bg-surface-container-lowest border border-outline-variant rounded-2xl p-6 max-w-xl w-full space-y-5 shadow-ambient zoom-in-95 duration-200 text-start"
        onClick={e => e.stopPropagation()}
        style={{ direction: 'rtl' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-outline-variant pb-3">
          <h3 className="text-sm font-bold text-on-surface flex items-center gap-2">
            <span className="material-symbols-outlined text-tertiary text-base">attach_file</span>
            <span>إدارة المرفقات والكتب للمحاضرة</span>
          </h3>
          <button
            onClick={handleClose}
            className="text-on-surface-variant hover:text-on-surface transition flex items-center"
          >
            <span className="material-symbols-outlined text-base">close</span>
          </button>
        </div>

        {attachmentsError && (
          <p className="text-[10px] text-error bg-error-container/20 p-2.5 rounded-lg font-semibold">{attachmentsError}</p>
        )}

        {attachmentsSuccess && (
          <p className="text-[10px] text-success bg-success-container/30 p-2.5 rounded-lg font-bold">{attachmentsSuccess}</p>
        )}

        {/* List of attachments */}
        <div className="space-y-2">
          <h4 className="text-xs font-bold text-on-surface-variant">الملفات المرفقة حالياً:</h4>
          {attachmentsLoading ? (
            <p className="text-xs text-on-surface-variant italic py-4 text-center">جاري تحميل المرفقات...</p>
          ) : lessonAttachments.length === 0 ? (
            <p className="text-xs text-on-surface-variant italic py-6 text-center bg-surface-container-low border border-dashed border-outline-variant rounded-xl">
              لا توجد أي مرفقات أو كتب مضافة لهذه المحاضرة بعد.
            </p>
          ) : (
            <div className="border border-outline-variant/60 rounded-xl overflow-hidden divide-y divide-outline-variant">
              {lessonAttachments.map((att) => (
                <div key={att.id} className="flex justify-between items-center p-3 bg-surface-container-low/30">
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-tertiary text-sm">picture_as_pdf</span>
                    <span className="text-xs font-bold text-on-surface">{att.title}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[9px] bg-surface-container px-2 py-0.5 rounded text-on-surface-variant font-mono">
                      {att.type?.toUpperCase() || 'PDF'}
                    </span>
                    <button
                      onClick={() => handleDeleteAttachment(att.id)}
                      className="p-1 hover:bg-error-container/20 text-error rounded transition flex items-center"
                      title="حذف المرفق"
                    >
                      <span className="material-symbols-outlined text-xs">delete</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Upload form */}
        <div className="border-t border-outline-variant pt-4 space-y-4">
          <h4 className="text-xs font-bold text-on-surface flex items-center gap-1">
            <span className="material-symbols-outlined text-xs text-primary">add_circle</span>
            <span>إرفاق ملف جديد:</span>
          </h4>

          <div className="space-y-3">
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-on-surface-variant block">عنوان الملف (يظهر للطلاب)</label>
              <input
                type="text"
                value={newAttachmentTitle}
                onChange={e => setNewAttachmentTitle(e.target.value)}
                placeholder="مثال: مذكرة شرح الباب الأول..."
                className="w-full px-3 py-2 text-xs border border-outline-variant rounded-xl focus:border-primary outline-none text-start"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-bold text-on-surface-variant block">اختر ملف الـ PDF</label>
              <div className="relative border border-dashed border-outline-variant rounded-xl p-4 bg-surface-container-low/50 flex flex-col items-center justify-center cursor-pointer hover:bg-surface-container-low transition">
                <input
                  type="file"
                  accept=".pdf"
                  onChange={e => {
                    const file = e.target.files?.[0];
                    if (file) {
                      setSelectedAttachmentFile(file);
                      if (!newAttachmentTitle.trim()) {
                        setNewAttachmentTitle(file.name.replace(/\.[^/.]+$/, ""));
                      }
                    }
                  }}
                  className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                />
                <span className="material-symbols-outlined text-outline text-2xl mb-1">picture_as_pdf</span>
                <span className="text-xs font-bold text-on-surface-variant">
                  {selectedAttachmentFile ? selectedAttachmentFile.name : 'اسحب أو اختر ملف PDF'}
                </span>
                <span className="text-[9px] text-outline mt-1">أقصى حجم: 100 ميجابايت</span>
              </div>
            </div>

            <button
              onClick={handleUploadAttachment}
              disabled={isUploadingAttachment || !selectedAttachmentFile || !newAttachmentTitle.trim()}
              className="w-full py-2.5 bg-primary hover:bg-primary/95 disabled:opacity-40 disabled:pointer-events-none text-on-primary rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5"
            >
              {isUploadingAttachment ? (
                <>
                  <span className="material-symbols-outlined text-sm animate-spin">sync</span>
                  <span>جاري رفع وتشفير الملف...</span>
                </>
              ) : (
                <>
                  <span className="material-symbols-outlined text-xs">cloud_upload</span>
                  <span>تأكيد الرفع والإرفاق</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
