'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { api, apiPost, apiDelete } from '@/lib/api';

interface Batch {
  id: string; 
  name: string; 
  scope_type: string; 
  course_id: string | null; 
  quantity: number;
  access_days: number | null; 
  expires_at: string | null; 
  note: string | null;
  active_count: number; 
  used_count: number; 
  course_title: string | null;
  created_by_name: string; 
  created_at: string;
}

interface Code { 
  id?: string;
  code: string; 
  status: string; 
  used_count: number; 
  max_uses: number; 
  used_by_name: string | null; 
  used_by_phone: string | null; 
  used_at: string | null; 
}

export default function CodesPage() {
  const [batches, setBatches] = useState<Batch[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [showCodes, setShowCodes] = useState<string | null>(null);
  const [batchCodes, setBatchCodes] = useState<Code[]>([]);
  const [generatedCodes, setGeneratedCodes] = useState<string[]>([]);
  const [error, setError] = useState('');
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [copiedAll, setCopiedAll] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [wizardStep, setWizardStep] = useState(1);

  const [form, setForm] = useState({
    name: '', 
    scope_type: 'course', 
    course_id: '', 
    quantity: 10, 
    access_days: 90, 
    note: '',
  });

  const [courses, setCourses] = useState<{ id: string; title: string }[]>([]);

  const fetchBatches = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api<{ batches: Batch[] }>('/admin/codes/batches');
      setBatches(data.batches || []);
    } catch (e: any) { 
      setBatches([]);
      setError(e.message || 'فشل جلب دفعات الأكواد');
    }
    setLoading(false);
  }, []);

  const fetchCourses = useCallback(async () => {
    try {
      const data = await api<{ courses: { id: string; title: string }[] }>('/admin/courses?limit=50');
      setCourses(data.courses || []);
    } catch {
      setCourses([]);
    }
  }, []);

  useEffect(() => { 
    fetchBatches(); 
    fetchCourses(); 
  }, [fetchBatches, fetchCourses]);

  const createBatch = async () => {
    if (!form.name.trim()) {
      setError('يرجى تحديد اسم للدفعة الحالية');
      return;
    }
    if (form.scope_type === 'course' && !form.course_id) {
      setError('يرجى اختيار كورس لربطه بالدفعة');
      return;
    }
    try {
      const payload: Record<string, unknown> = {
        name: form.name, 
        scope_type: form.scope_type, 
        quantity: form.quantity, 
        access_days: form.access_days || undefined, 
        note: form.note || undefined,
      };
      if (form.scope_type === 'course') payload.course_id = form.course_id;

      const data = await apiPost<{ batch_id: string; codes: string[] }>('/admin/codes/batches', payload);
      setGeneratedCodes(data.codes);
      setShowCreate(false);
      fetchBatches();
    } catch (e: any) { 
      setError(e.message || 'حدث خطأ أثناء إنشاء الأكواد'); 
    }
  };

  const viewBatchCodes = async (batchId: string) => {
    if (showCodes === batchId) { 
      setShowCodes(null); 
      return; 
    }
    setShowCodes(batchId);
    try {
      const data = await api<{ codes: Code[] }>(`/admin/codes/batches/${batchId}/codes`);
      setBatchCodes(data.codes || []);
    } catch (e: any) { 
      setBatchCodes([]); 
    }
  };

  const deleteBatch = async (batchId: string) => {
    if (!confirm('هل أنت متأكد من رغبتك في حذف هذه الدفعة بالكامل وكل الأكواد التابعة لها؟ لا يمكن التراجع عن هذا الإجراء.')) return;
    try {
      await apiDelete(`/admin/codes/batches/${batchId}`);
      alert('تم حذف دفعة الأكواد بنجاح.');
      fetchBatches();
    } catch (e: any) {
      setError(e.message || 'فشل في حذف دفعة الأكواد');
    }
  };

  const deleteSingleCode = async (batchId: string, codeId: string | undefined) => {
    if (!codeId) return;
    if (!confirm('هل أنت متأكد من رغبتك في حذف هذا الكود؟')) return;
    try {
      await apiDelete(`/admin/codes/${codeId}`);
      // Refresh codes list for this batch
      const data = await api<{ codes: Code[] }>(`/admin/codes/batches/${batchId}/codes`);
      setBatchCodes(data.codes || []);
      // Refresh batches summary
      fetchBatches();
    } catch (e: any) {
      setError(e.message || 'فشل في حذف الكود');
    }
  };

  const downloadCSV = (batchId: string) => {
    // العنوان نسبي عند عدم ضبط NEXT_PUBLIC_API_URL — يُضبط بعد النشر.
    const apiBase = (process.env.NEXT_PUBLIC_API_URL || 'https://api.fusha.site').replace(/\/+$/, '');
    window.open(`${apiBase}/admin/codes/batches/${batchId}/csv`, '_blank');
  };

  const copyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  const copyAllCodes = () => {
    navigator.clipboard.writeText(generatedCodes.join('\n'));
    setCopiedAll(true);
    setTimeout(() => setCopiedAll(false), 2500);
  };

  const statusBadge = (status: string) => {
    const styles: Record<string, string> = {
      active: 'bg-emerald-50 text-emerald-700 border border-emerald-200',
      used: 'bg-slate-100 text-slate-600 border border-slate-200',
      expired: 'bg-amber-50 text-amber-700 border border-amber-200',
      revoked: 'bg-red-50 text-red-700 border border-red-200',
    };
    const labels: Record<string, string> = { 
      active: 'متاح', 
      used: 'مُستعمل', 
      expired: 'منتهي', 
      revoked: 'ملغي' 
    };
    
    return (
      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${styles[status] || 'bg-slate-100 text-slate-600 border border-slate-200'}`}>
        {labels[status] || status}
      </span>
    );
  };

  // Calculations for Summary Cards
  const totalCodes = batches.reduce((acc, b) => acc + (b.quantity || 0), 0);
  const totalUnused = batches.reduce((acc, b) => acc + (b.active_count || 0), 0);
  const totalUsed = batches.reduce((acc, b) => acc + (b.used_count || 0), 0);

  // Filtering batches based on search
  const filteredBatches = batches.filter(batch => 
    batch.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (batch.course_title || '').toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-8 select-none animate-in fade-in duration-300">
      
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h2 className="font-display-lg text-[30px] font-bold text-on-background leading-tight">إدارة رموز التفعيل</h2>
          <p className="font-body-md text-body-md text-secondary mt-2">إنشاء وتتبع وإدارة الدفعات الخاصة برموز الوصول للطلاب.</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <button 
            onClick={() => {
              if (batches.length > 0) {
                downloadCSV(batches[0].id);
              }
            }}
            className="flex items-center gap-2 px-6 h-12 rounded-lg border border-outline-variant text-secondary hover:bg-surface-container-low transition-colors font-label-md text-label-md"
          >
            <span className="material-symbols-outlined text-base">download</span>
            <span>تصدير التقرير (CSV)</span>
          </button>
          <button 
            onClick={() => { setShowCreate(true); setForm({ ...form, name: '' }); setGeneratedCodes([]); }}
            className="flex items-center gap-2 px-6 h-12 rounded-lg bg-primary text-white hover:bg-primary-container transition-colors font-label-md text-label-md shadow-ambient"
          >
            <span className="material-symbols-outlined text-base">add</span>
            <span>توليد دفعة جديدة</span>
          </button>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-center justify-between shadow-sm">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-red-600 text-base">warning</span>
            <span>{error}</span>
          </div>
          <button onClick={() => setError('')} className="underline font-bold hover:text-red-950 transition">إغلاق</button>
        </div>
      )}

      {/* Generated Codes Output Display */}
      {generatedCodes.length > 0 && (
        <div className="bg-emerald-50/50 border border-emerald-200 rounded-2xl p-6 space-y-4 shadow-ambient animate-in slide-in-from-top-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-emerald-600 text-base">check_circle</span>
              <h3 className="text-sm font-bold text-emerald-800">تم توليد {generatedCodes.length} كود تفعيل بنجاح</h3>
            </div>
            <button 
              onClick={copyAllCodes} 
              className="flex items-center gap-1.5 px-4 py-2 bg-emerald-100 hover:bg-emerald-200 border border-emerald-200 text-emerald-700 rounded-xl text-xs font-bold transition-all"
            >
              <span className="material-symbols-outlined text-sm">
                {copiedAll ? 'check' : 'content_copy'}
              </span>
              <span>{copiedAll ? 'تم نسخ جميع الأكواد!' : 'نسخ كل الأكواد'}</span>
            </button>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-5 gap-2 max-h-52 overflow-y-auto p-3 bg-surface rounded-xl border border-outline-variant/60">
            {generatedCodes.map(code => (
              <button 
                key={code} 
                onClick={() => copyCode(code)}
                className="px-3 py-2.5 bg-surface-container-low hover:bg-primary/10 border border-outline-variant/50 hover:border-primary/30 rounded-lg text-on-surface font-mono text-xs hover:scale-[1.02] active:scale-[0.98] transition-all text-center flex items-center justify-between"
              >
                <span>{code}</span>
                <span className="material-symbols-outlined text-sm">
                  {copiedCode === code ? 'check' : 'content_copy'}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Total Codes */}
        <div className="bg-surface border border-outline-variant rounded-xl p-6 hover:shadow-ambient transition-shadow">
          <div className="flex justify-between items-start mb-4">
            <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center text-primary">
              <span className="material-symbols-outlined text-xl">description</span>
            </div>
            <span className="px-2 py-1 bg-surface-container-high rounded text-on-surface-variant font-label-md text-label-md">إجمالي المولد</span>
          </div>
          <p className="font-body-sm text-body-sm text-on-surface-variant mb-1">إجمالي الرموز النشطة</p>
          <p className="font-display-lg text-[32px] font-bold text-on-background">{totalCodes.toLocaleString('ar-EG')}</p>
        </div>

        {/* Unused Codes */}
        <div className="bg-surface border border-outline-variant rounded-xl p-6 hover:shadow-ambient transition-shadow">
          <div className="flex justify-between items-start mb-4">
            <div className="w-12 h-12 rounded-full bg-emerald-500/10 flex items-center justify-center text-emerald-600">
              <span className="material-symbols-outlined text-xl">check_circle</span>
            </div>
            <span className="px-2 py-1 bg-surface-container-high rounded text-on-surface-variant font-label-md text-label-md">متاح للاستخدام</span>
          </div>
          <p className="font-body-sm text-body-sm text-on-surface-variant mb-1">رموز غير مستخدمة</p>
          <p className="font-display-lg text-[32px] font-bold text-on-background">{totalUnused.toLocaleString('ar-EG')}</p>
        </div>

        {/* Used Codes */}
        <div className="bg-surface border border-outline-variant rounded-xl p-6 hover:shadow-ambient transition-shadow">
          <div className="flex justify-between items-start mb-4">
            <div className="w-12 h-12 rounded-full bg-secondary/15 flex items-center justify-center text-secondary">
              <span className="material-symbols-outlined text-xl">person</span>
            </div>
            <span className="px-2 py-1 bg-surface-container-high rounded text-on-surface-variant font-label-md text-label-md">تاريخي</span>
          </div>
          <p className="font-body-sm text-body-sm text-on-surface-variant mb-1">رموز تم استخدامها</p>
          <p className="font-display-lg text-[32px] font-bold text-on-background">{totalUsed.toLocaleString('ar-EG')}</p>
        </div>
      </div>

      {/* Batches Section */}
      <div className="bg-surface border border-outline-variant rounded-xl overflow-hidden shadow-ambient">
        <div className="p-6 border-b border-outline-variant flex flex-col sm:flex-row justify-between items-start sm:items-center bg-surface-container-low/50 gap-4">
          <h3 className="font-headline-sm text-[20px] font-bold text-on-background">دفعات التفعيل الأخيرة</h3>
          <div className="relative w-full sm:w-64">
            <input 
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full pe-4 ps-10 py-2 bg-surface border border-outline-variant rounded-lg font-body-sm text-body-sm text-on-surface placeholder:text-outline focus:ring-2 focus:ring-primary focus:border-primary outline-none transition-all text-start" 
              placeholder="البحث في الدفعات..." 
              type="text"
            />
            <span className="material-symbols-outlined absolute start-3 top-2.5 text-on-surface-variant text-base">search</span>
          </div>
        </div>

        {/* Bento-style Card List instead of standard table */}
        {loading ? (
          <div className="flex justify-center py-20">
            <span className="material-symbols-outlined animate-spin text-primary text-2xl">sync</span>
          </div>
        ) : (
          <div>
            {filteredBatches.length > 0 ? (
              <div className="p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredBatches.map(batch => {
                  const percentUsed = batch.quantity > 0 ? Math.round((batch.used_count / batch.quantity) * 100) : 0;
                  const isCompleted = batch.used_count === batch.quantity;
                  const inUse = batch.used_count > 0 && !isCompleted;
                  
                  const borderColorClass = isCompleted 
                    ? 'bg-red-500' 
                    : inUse 
                      ? 'bg-primary' 
                      : 'bg-emerald-500';
                  
                  const statusLabel = isCompleted 
                    ? 'منتهية' 
                    : inUse 
                      ? 'قيد الاستخدام' 
                      : 'نشط';

                  const badgeColorClass = isCompleted 
                    ? 'bg-red-50 text-red-700 border border-red-200' 
                    : inUse 
                      ? 'bg-primary/10 text-primary border border-primary/20' 
                      : 'bg-emerald-50 text-emerald-700 border border-emerald-200';

                  return (
                    <div 
                      key={batch.id} 
                      className="border border-outline-variant rounded-lg p-5 hover:shadow-ambient transition-shadow bg-surface relative overflow-hidden group flex flex-col justify-between"
                    >
                      {/* Decorator line */}
                      <div className={`absolute start-0 top-0 bottom-0 w-1 ${borderColorClass}`} />
                      
                      <div>
                        <div className="flex justify-between items-start mb-4">
                          <div>
                            <h4 className="font-label-md text-xs text-secondary">الدفعة #{batch.id.substring(0, 10)}</h4>
                            <p className="font-headline-sm text-base font-bold text-on-background mt-1">{batch.name}</p>
                          </div>
                          <span className={`px-2 py-1 rounded text-xs font-bold ${badgeColorClass}`}>
                            {statusLabel}
                          </span>
                        </div>

                        <div className="mb-4">
                          <div className="flex justify-between font-body-sm text-xs mb-2">
                            <span className="text-secondary">الاستخدام</span>
                            <span className="text-on-background font-bold">{batch.used_count} / {batch.quantity}</span>
                          </div>
                          <div className="w-full h-1.5 bg-surface-container-low rounded-full overflow-hidden">
                            <div 
                              className={`h-full rounded-full transition-all duration-500 ${
                                isCompleted ? 'bg-error' : 'bg-gradient-to-l from-primary to-emerald-400'
                              }`} 
                              style={{ width: `${percentUsed}%` }}
                            />
                          </div>
                        </div>
                      </div>

                      <div className="space-y-4">
                        {batch.note && (
                          <p className="text-[11px] text-on-surface-variant italic bg-surface-container-low p-2 rounded border border-outline-variant/30 truncate" title={batch.note}>
                            {batch.note}
                          </p>
                        )}
                        <div className="flex justify-between items-center pt-3 border-t border-outline-variant/60">
                          <span className="font-body-sm text-xs text-on-surface-variant">
                            تاريخ: {new Date(batch.created_at).toLocaleDateString('ar-EG', { day: 'numeric', month: 'long', year: 'numeric' })}
                          </span>
                          <div className="flex items-center gap-1">
                            <button 
                              onClick={() => viewBatchCodes(batch.id)} 
                              title="عرض الأكواد"
                              className={`p-1.5 rounded-md transition-all flex items-center justify-center ${
                                showCodes === batch.id 
                                ? 'text-primary bg-primary/10 border border-primary/20' 
                                : 'text-on-surface-variant hover:text-primary hover:bg-surface-container border border-transparent'
                              }`}
                            >
                              <span className="material-symbols-outlined text-base">
                                {showCodes === batch.id ? 'visibility_off' : 'visibility'}
                              </span>
                            </button>
                            <button 
                              onClick={() => downloadCSV(batch.id)}
                              title="تحميل ملف الطباعة CSV"
                              className="p-1.5 text-on-surface-variant hover:text-primary hover:bg-surface-container rounded-md border border-transparent transition flex items-center justify-center"
                            >
                              <span className="material-symbols-outlined text-base">download</span>
                            </button>
                            <button 
                              onClick={() => deleteBatch(batch.id)}
                              title="حذف الدفعة بالكامل"
                              className="p-1.5 text-on-surface-variant hover:text-error hover:bg-error-container/20 rounded-md border border-transparent transition flex items-center justify-center"
                            >
                              <span className="material-symbols-outlined text-base">delete</span>
                            </button>
                          </div>
                        </div>

                        {/* Collapsible Codes Details Grid inside the Card */}
                        {showCodes === batch.id && (
                          <div className="border-t border-outline-variant/60 pt-4 mt-2 space-y-2 animate-in slide-in-from-top-1">
                            <h5 className="text-xs font-bold text-on-background">أكواد الدفعة:</h5>
                            <div className="max-h-48 overflow-y-auto space-y-2 ps-1 custom-scrollbar">
                              {batchCodes.length > 0 ? (
                                batchCodes.map(code => (
                                  <div 
                                    key={code.code} 
                                    className="flex items-center justify-between bg-surface-container-low border border-outline-variant/40 rounded-lg px-3 py-2"
                                  >
                                    <div className="flex items-center gap-2">
                                      <button 
                                        onClick={() => copyCode(code.code)} 
                                        className="text-secondary hover:text-primary transition flex items-center justify-center"
                                        title="نسخ الكود"
                                      >
                                        {copiedCode === code.code ? (
                                          <span className="material-symbols-outlined text-sm text-emerald-600 animate-bounce">check</span>
                                        ) : (
                                          <span className="material-symbols-outlined text-sm">content_copy</span>
                                        )}
                                      </button>
                                      <span className="font-mono text-xs text-on-background font-semibold">{code.code}</span>
                                    </div>
                                    <div className="flex items-center gap-1.5">
                                      {statusBadge(code.status)}
                                      {code.used_by_name && (
                                        <span className="text-[9px] text-secondary max-w-[60px] truncate" title={code.used_by_name}>
                                          {code.used_by_name}
                                        </span>
                                      )}
                                      <button 
                                        onClick={() => deleteSingleCode(batch.id, code.id)}
                                        className="text-secondary hover:text-red-600 transition flex items-center justify-center p-0.5 rounded hover:bg-red-50"
                                        title="حذف هذا الكود"
                                      >
                                        <span className="material-symbols-outlined text-[14px]">delete</span>
                                      </button>
                                    </div>
                                  </div>
                                ))
                              ) : (
                                <div className="text-center py-4 text-xs text-secondary">جاري التحميل...</div>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-20 border-b border-outline-variant/50 text-secondary">
                <span className="material-symbols-outlined text-secondary/40 text-4xl mb-3 block">help</span>
                <p className="text-sm font-bold text-secondary">لم يتم العثور على أي دفعات تطابق بحثك</p>
              </div>
            )}
            <div className="p-4 border-t border-outline-variant text-center bg-surface-container-low/20">
              <button 
                onClick={() => setSearchQuery('')}
                className="text-primary font-label-md text-xs font-semibold hover:underline"
              >
                إعادة ضبط البحث وعرض الكل
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Create Batch Modal Wizard */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-in fade-in duration-200">
          <div 
            className="bg-surface-container-lowest border border-outline-variant rounded-2xl p-6 max-w-lg w-full space-y-6 shadow-2xl animate-in zoom-in-95 duration-200 text-on-surface" 
            onClick={e => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-outline-variant/50 pb-4">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                  <span className="material-symbols-outlined text-base">tag</span>
                </div>
                <h3 className="text-sm font-bold text-on-surface">معالج توليد الأكواد</h3>
              </div>
              <button 
                onClick={() => setShowCreate(false)}
                className="p-1.5 text-on-surface-variant hover:bg-surface-container rounded-full transition-colors flex items-center justify-center"
              >
                <span className="material-symbols-outlined text-base">close</span>
              </button>
            </div>

            {/* Wizard Step Progress Indicator */}
            <div className="flex items-center justify-between px-4 py-2 bg-surface-container-low rounded-xl border border-outline-variant/40">
              {[
                { step: 1, label: 'تفاصيل الدفعة' },
                { step: 2, label: 'الكمية والصلاحية' },
                { step: 3, label: 'مراجعة وتأكيد' }
              ].map((s, idx, arr) => (
                <React.Fragment key={s.step}>
                  <div className="flex items-center gap-2">
                    <div 
                      className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold transition-colors ${
                        wizardStep >= s.step 
                          ? 'bg-primary text-on-primary shadow-md shadow-primary/25' 
                          : 'bg-surface-container-high text-on-surface-variant'
                      }`}
                    >
                      {s.step}
                    </div>
                    <span className={`text-[11px] font-bold transition-colors ${
                      wizardStep === s.step ? 'text-primary' : 'text-on-surface-variant'
                    }`}>
                      {s.label}
                    </span>
                  </div>
                  {idx < arr.length - 1 && (
                    <div className={`flex-1 h-0.5 mx-2 ${
                      wizardStep > s.step ? 'bg-primary' : 'bg-outline-variant'
                    }`} />
                  )}
                </React.Fragment>
              ))}
            </div>
            
            {/* Wizard Steps Content */}
            <div className="space-y-4 min-h-[180px]">
              
              {/* STEP 1: Batch Details */}
              {wizardStep === 1 && (
                <div className="space-y-4 animate-in fade-in duration-200">
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-bold text-on-surface-variant ms-1">اسم دفعة الأكواد</label>
                    <input 
                      placeholder="مثال: العناصر الانتقالية - سنتر الأمل (يوليو)" 
                      value={form.name} 
                      onChange={e => setForm({ ...form, name: e.target.value })}
                      className="w-full px-4 py-2.5 bg-surface border border-outline-variant focus:border-primary focus:ring-1 focus:ring-primary rounded-xl text-xs text-on-surface placeholder:text-outline focus:outline-none transition" 
                    />
                  </div>
                  
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-bold text-on-surface-variant ms-1">نطاق عمل الأكواد</label>
                    <select 
                      value={form.scope_type} 
                      onChange={e => setForm({ ...form, scope_type: e.target.value, course_id: '' })}
                      className="w-full px-4 py-2.5 bg-surface border border-outline-variant focus:border-primary rounded-xl text-xs text-on-surface focus:outline-none transition"
                    >
                      <option value="course">كورس دراسي محدد</option>
                      <option value="all">كل الكورسات (كود عام)</option>
                    </select>
                  </div>

                  {form.scope_type === 'course' && (
                    <div className="space-y-1.5 animate-in slide-in-from-top-1">
                      <label className="text-[11px] font-bold text-on-surface-variant ms-1">اختر الكورس المستهدف</label>
                      <select 
                        value={form.course_id} 
                        onChange={e => setForm({ ...form, course_id: e.target.value })}
                        className="w-full px-4 py-2.5 bg-surface border border-outline-variant focus:border-primary rounded-xl text-xs text-on-surface focus:outline-none transition"
                      >
                        <option value="">اختر الكورس الدراسي...</option>
                        {courses.map(c => <option key={c.id} value={c.id}>{c.title}</option>)}
                      </select>
                    </div>
                  )}
                </div>
              )}

              {/* STEP 2: Quantity & Duration */}
              {wizardStep === 2 && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 animate-in fade-in duration-200">
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-bold text-on-surface-variant ms-1">عدد الأكواد المطلوبة</label>
                    <input 
                      type="number" 
                      min={1}
                      max={500}
                      placeholder="مثال: 50" 
                      value={form.quantity} 
                      onChange={e => setForm({ ...form, quantity: Math.max(1, parseInt(e.target.value) || 0) })}
                      className="w-full px-4 py-2.5 bg-surface border border-outline-variant focus:border-primary focus:ring-1 focus:ring-primary rounded-xl text-xs text-on-surface placeholder:text-outline focus:outline-none transition font-mono" 
                    />
                    <span className="text-[9px] text-on-surface-variant block">الحد الأقصى للتوليد دفعة واحدة هو ٥٠٠ كود.</span>
                  </div>
                  
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-bold text-on-surface-variant ms-1">صلاحية الكود بعد التفعيل (بالأيام)</label>
                    <input 
                      type="number" 
                      min={1}
                      placeholder="مثال: 90 يوم" 
                      value={form.access_days} 
                      onChange={e => setForm({ ...form, access_days: Math.max(1, parseInt(e.target.value) || 0) })}
                      className="w-full px-4 py-2.5 bg-surface border border-outline-variant focus:border-primary focus:ring-1 focus:ring-primary rounded-xl text-xs text-on-surface placeholder:text-outline focus:outline-none transition font-mono" 
                    />
                    <span className="text-[9px] text-on-surface-variant block">عدد الأيام المتاحة للطالب لمشاهدة الكورس بعد إدخال الكود.</span>
                  </div>
                </div>
              )}

              {/* STEP 3: Review & Print Notes */}
              {wizardStep === 3 && (
                <div className="space-y-4 animate-in fade-in duration-200">
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-bold text-on-surface-variant ms-1">ملاحظة الطباعة (تطبع على ورقة الكود)</label>
                    <input 
                      placeholder="مثال: تباع في مكتبة الأمل بسعر 50 جنيه" 
                      value={form.note} 
                      onChange={e => setForm({ ...form, note: e.target.value })}
                      className="w-full px-4 py-2.5 bg-surface border border-outline-variant focus:border-primary focus:ring-1 focus:ring-primary rounded-xl text-xs text-on-surface placeholder:text-outline focus:outline-none transition" 
                    />
                  </div>

                  {/* Summary Card */}
                  <div className="p-4 rounded-xl bg-surface-container-low border border-outline-variant/60 space-y-2.5">
                    <h4 className="text-[11px] font-black text-on-surface-variant uppercase tracking-wider">ملخص الدفعة الجاري توليدها:</h4>
                    <div className="grid grid-cols-2 gap-y-2 gap-x-4 text-xs">
                      <div>
                        <span className="text-on-surface-variant block text-[10px]">اسم الدفعة:</span>
                        <span className="font-bold text-on-surface">{form.name}</span>
                      </div>
                      <div>
                        <span className="text-on-surface-variant block text-[10px]">الكورس المستهدف:</span>
                        <span className="font-bold text-primary">
                          {form.scope_type === 'all' 
                            ? 'كل الكورسات (كود عام)' 
                            : (courses.find(c => c.id === form.course_id)?.title || 'لم يتم الاختيار')}
                        </span>
                      </div>
                      <div>
                        <span className="text-on-surface-variant block text-[10px]">الكمية المطلوبة:</span>
                        <span className="font-bold font-mono text-on-surface">{form.quantity} كود تفعيل</span>
                      </div>
                      <div>
                        <span className="text-on-surface-variant block text-[10px]">مدة الصلاحية:</span>
                        <span className="font-bold font-mono text-on-surface">{form.access_days} يوم</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

            </div>

            {/* Wizard Actions Footer */}
            <div className="flex justify-between items-center pt-4 border-t border-outline-variant/50">
              <div>
                {wizardStep > 1 ? (
                  <button 
                    onClick={() => setWizardStep(prev => prev - 1)}
                    className="px-5 py-2.5 rounded-xl text-xs font-bold text-on-surface-variant hover:bg-surface-container transition duration-300"
                  >
                    السابق
                  </button>
                ) : (
                  <button 
                    onClick={() => setShowCreate(false)}
                    className="px-5 py-2.5 rounded-xl text-xs font-bold text-on-surface-variant hover:bg-surface-container transition duration-300"
                  >
                    إلغاء
                  </button>
                )}
              </div>
              
              <div>
                {wizardStep < 3 ? (
                  <button 
                    onClick={() => {
                      if (wizardStep === 1) {
                        if (!form.name.trim()) {
                          alert('يرجى كتابة اسم الدفعة أولاً');
                          return;
                        }
                        if (form.scope_type === 'course' && !form.course_id) {
                          alert('يرجى تحديد الكورس الدراسي المستهدف');
                          return;
                        }
                      }
                      setWizardStep(prev => prev + 1);
                    }}
                    className="px-6 py-2.5 bg-primary hover:bg-primary-container text-on-primary font-bold rounded-xl text-xs shadow-md shadow-primary/20 transition duration-300"
                  >
                    التالي
                  </button>
                ) : (
                  <button 
                    onClick={createBatch}
                    className="px-6 py-2.5 bg-primary hover:bg-primary-container text-on-primary font-bold rounded-xl text-xs shadow-md shadow-primary/20 transition duration-300"
                  >
                    توليد الأكواد الآن ⚡
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
