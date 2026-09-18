'use client';

import React, { useState, useEffect, useRef } from 'react';
import { apiGet, apiPatch } from '@/lib/api';
import { FlaskConical, Upload, Save, User, Mail, Shield, AlertCircle, CheckCircle, Loader2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';

export default function SettingsPage() {
  const [profile, setProfile] = useState<any>(null);
  const [fullName, setFullName] = useState('');
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [status, setStatus] = useState<{ type: 'success' | 'error' | null; message: string }>({ type: null, message: '' });

  // General settings state
  const [academicYears, setAcademicYears] = useState<string[]>([]);
  const [branches, setBranches] = useState<string[]>([]);
  const [savingGeneral, setSavingGeneral] = useState(false);
  const [generalStatus, setGeneralStatus] = useState<{ type: 'success' | 'error' | null; message: string }>({ type: null, message: '' });

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const fetchProfileAndSettings = async () => {
      try {
        setLoading(true);
        const data = await apiGet<any>('/auth/me');
        if (data) {
          setProfile(data);
          setFullName(data.full_name || '');
          
          // If admin, fetch general settings
          if (data.role === 'admin') {
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
          }
        }
      } catch (err: any) {
        console.error("Failed to fetch settings profile or app settings:", err);
        setStatus({ type: 'error', message: err.message || 'فشل تحميل بيانات الملف الشخصي أو الإعدادات' });
      } finally {
        setLoading(false);
      }
    };

    fetchProfileAndSettings();
  }, []);

  const handleUpdateName = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim()) return;

    setUpdating(true);
    setStatus({ type: null, message: '' });

    try {
      const updated = await apiPatch<any>('/auth/me', { full_name: fullName.trim() });
      if (updated) {
        setProfile(updated);
        setStatus({ type: 'success', message: 'تم تحديث الاسم بنجاح!' });
        
        // Sync local storage session
        const cached = localStorage.getItem('chemistry_dashboard_session');
        if (cached) {
          const parsed = JSON.parse(cached);
          parsed.user.full_name = updated.full_name;
          localStorage.setItem('chemistry_dashboard_session', JSON.stringify(parsed));
        }

        // Optional page refresh to update sidebar/header instantly
        setTimeout(() => {
          window.location.reload();
        }, 1000);
      }
    } catch (err: any) {
      console.error(err);
      setStatus({ type: 'error', message: err.message || 'حدث خطأ أثناء تحديث الملف الشخصي' });
    } finally {
      setUpdating(false);
    }
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate size (< 5MB) and type
    if (file.size > 5 * 1024 * 1024) {
      setStatus({ type: 'error', message: 'حجم الصورة كبير جداً. الحد الأقصى المسموح به هو 5 ميجابايت' });
      return;
    }

    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      setStatus({ type: 'error', message: 'نوع الملف غير مدعوم. يرجى اختيار صورة بصيغة JPEG أو PNG أو WEBP' });
      return;
    }

    setUploading(true);
    setStatus({ type: null, message: '' });

    try {
      const arrayBuffer = await file.arrayBuffer();
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      
      const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'https://api.alhadaba-chemistry.synapticstudio.tech';
      
      const response = await fetch(`${API_BASE}/auth/me/avatar`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': file.type,
          'X-Requested-With': 'XMLHttpRequest',
        },
        body: arrayBuffer,
      });

      if (!response.ok) {
        const errJson = await response.json().catch(() => ({ error: { message: 'فشل رفع الصورة' } }));
        throw new Error(errJson.error?.message || 'فشل رفع الصورة الشخصية');
      }

      const resData = await response.json();
      if (resData.ok && resData.avatar_url) {
        setProfile((prev: any) => ({ ...prev, avatar_url: resData.avatar_url }));
        setStatus({ type: 'success', message: 'تم تحديث الصورة الشخصية بنجاح!' });
        
        // Sync local storage session
        const cached = localStorage.getItem('chemistry_dashboard_session');
        if (cached) {
          const parsed = JSON.parse(cached);
          parsed.user.avatar_url = resData.avatar_url;
          localStorage.setItem('chemistry_dashboard_session', JSON.stringify(parsed));
        }

        // Immediately reload to propagate avatar changes everywhere
        setTimeout(() => {
          window.location.reload();
        }, 1000);
      }
    } catch (err: any) {
      console.error(err);
      setStatus({ type: 'error', message: err.message || 'حدث خطأ أثناء رفع الصورة الشخصية' });
    } finally {
      setUploading(false);
    }
  };

  const triggerFileSelect = () => {
    fileInputRef.current?.click();
  };



  const getBranchesForYear = (yearName: string): string[] => {
    const name = yearName.trim();
    if (name.includes('الأول') || name.includes('أولى')) {
      return ['عام', 'أزهر'];
    }
    if (name.includes('الثاني') || name.includes('ثانية')) {
      return ['عام', 'أزهر', 'علمي', 'أدبي'];
    }
    if (name.includes('الثالث') || name.includes('ثالثة')) {
      return ['عام', 'أزهر', 'علمي علوم', 'علمي رياضة', 'أدبي'];
    }
    if (name.toLowerCase().includes('ig')) {
      return ['OL', 'AS', 'A-Level', 'علمي', 'أدبي'];
    }
    return ['عام']; // Default fallback
  };

  const handleSaveGeneralSettings = async () => {
    setSavingGeneral(true);
    setGeneralStatus({ type: null, message: '' });
    try {
      await apiPatch('/admin/settings', {
        academic_years: JSON.stringify(academicYears),
        branches: JSON.stringify(branches)
      });
      setGeneralStatus({ type: 'success', message: 'تم حفظ إعدادات المنصة العامة بنجاح!' });
    } catch (err: any) {
      console.error(err);
      setGeneralStatus({ type: 'error', message: err.message || 'حدث خطأ أثناء حفظ إعدادات المنصة' });
    } finally {
      setSavingGeneral(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4 font-body-md animate-pulse">
        <Loader2 className="w-10 h-10 text-primary animate-spin" />
        <p className="text-sm text-on-surface-variant">جاري تحميل إعدادات الحساب...</p>
      </div>
    );
  }

  const defaultAvatar = '/images/default_avatar.png';

  return (
    <div className="max-w-2xl mx-auto space-y-6 font-body-md rtl">
      
      {/* Settings Card */}
      <div className="bg-surface-container-lowest rounded-2xl border border-outline-variant shadow-ambient p-6 md:p-8">
        
        {/* Title */}
        <div className="border-b border-outline-variant/30 pb-4 mb-6">
          <h2 className="text-xl font-bold text-on-surface flex items-center gap-2">
            <span className="material-symbols-outlined text-primary text-[24px]">manage_accounts</span>
            <span>إعدادات الحساب الشخصي</span>
          </h2>
          <p className="text-xs text-on-surface-variant mt-1">تعديل الملف الشخصي للمعلم وإدارة تفاصيل الحساب</p>
        </div>

        {status.type && (
          <div className={`p-4 rounded-xl flex items-start gap-3 text-xs mb-6 animate-in fade-in duration-200 ${
            status.type === 'success' 
              ? 'bg-teal-50 dark:bg-teal-950/20 text-teal-700 dark:text-teal-300 border border-teal-500/20' 
              : 'bg-error-container/20 text-error border border-error/20'
          }`}>
            {status.type === 'success' ? <CheckCircle className="shrink-0" size={16} /> : <AlertCircle className="shrink-0" size={16} />}
            <span>{status.message}</span>
          </div>
        )}

        {/* Profile Avatar Selection Card */}
        <div className="flex flex-col sm:flex-row items-center gap-6 p-6 rounded-xl bg-surface-container-low border border-outline-variant/40 mb-8">
          <div className="relative group cursor-pointer" onClick={triggerFileSelect}>
            <div className="w-24 h-24 rounded-full overflow-hidden border-2 border-primary/40 shadow-ambient bg-white flex items-center justify-center">
              <img 
                src={profile?.avatar_url || defaultAvatar} 
                alt="Teacher Profile Avatar" 
                className="w-full h-full object-cover"
              />
            </div>
            <div className="absolute inset-0 bg-black/45 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200">
              <Upload size={20} className="text-white" />
            </div>
            {uploading && (
              <div className="absolute inset-0 bg-black/60 rounded-full flex items-center justify-center">
                <Loader2 size={24} className="text-white animate-spin" />
              </div>
            )}
          </div>

          <div className="text-center sm:text-right space-y-2 flex-1">
            <h3 className="text-sm font-bold text-on-surface">الصورة الشخصية للمعلم</h3>
            <p className="text-[11px] text-on-surface-variant leading-relaxed max-w-sm">
              اختر صورة شخصية مناسبة لتظهر للطلاب بالمنصة وفي لوحة التحكم. يدعم صيغ PNG, JPEG, WEBP وبحجم أقصى ٥ ميجابايت.
            </p>
            <input 
              type="file" 
              ref={fileInputRef} 
              onChange={handleAvatarUpload} 
              className="hidden" 
              accept="image/jpeg,image/png,image/webp"
            />
            <button 
              type="button" 
              onClick={triggerFileSelect} 
              disabled={uploading}
              className="px-4 py-2 border border-outline-variant hover:bg-surface text-xs font-semibold rounded-lg transition-colors flex items-center justify-center gap-2 mx-auto sm:mr-0 disabled:opacity-50"
            >
              <Upload size={14} />
              <span>{uploading ? 'جاري الرفع...' : 'رفع صورة جديدة'}</span>
            </button>
          </div>
        </div>

        {/* Profile details form */}
        <form onSubmit={handleUpdateName} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            
            {/* Full Name input */}
            <div className="space-y-2">
              <label className="block text-xs font-bold text-on-surface mr-1 flex items-center gap-1.5">
                <User size={14} className="text-primary" />
                <span>الاسم الكامل</span>
              </label>
              <input 
                type="text" 
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="w-full px-4 py-3 border border-outline-variant rounded-xl bg-surface text-sm focus:ring-2 focus:ring-primary focus:border-primary outline-none transition-shadow"
                placeholder="الأستاذ المشرف"
                required
              />
            </div>

            {/* Email (Readonly) */}
            <div className="space-y-2">
              <label className="block text-xs font-bold text-on-surface mr-1 flex items-center gap-1.5">
                <Mail size={14} className="text-slate-400" />
                <span>البريد الإلكتروني (غير قابل للتعديل)</span>
              </label>
              <div className="w-full px-4 py-3 border border-outline-variant/60 rounded-xl bg-surface-container/50 text-slate-400 text-sm flex items-center cursor-not-allowed select-all">
                {profile?.email || 'admin@chemistry.com'}
              </div>
            </div>

            {/* Role (Readonly) */}
            <div className="space-y-2">
              <label className="block text-xs font-bold text-on-surface mr-1 flex items-center gap-1.5">
                <Shield size={14} className="text-slate-400" />
                <span>رتبة الحساب في النظام</span>
              </label>
              <div className="w-full px-4 py-3 border border-outline-variant/60 rounded-xl bg-surface-container/50 text-slate-400 text-sm flex items-center cursor-not-allowed select-all capitalize">
                {profile?.role === 'admin' ? 'مدير المنصة الأساسي (Admin)' : 'مساعد مشرف (Assistant)'}
              </div>
            </div>

            {/* Platform indicator (Readonly) */}
            <div className="space-y-2">
              <label className="block text-xs font-bold text-on-surface mr-1 flex items-center gap-1.5">
                <FlaskConical size={14} className="text-slate-400" />
                <span>المنصة التعليمية المرتبطة</span>
              </label>
              <div className="w-full px-4 py-3 border border-outline-variant/60 rounded-xl bg-surface-container/50 text-slate-400 text-sm flex items-center cursor-not-allowed select-all capitalize">
                المنصة الطلابية
              </div>
            </div>

          </div>

          <div className="border-t border-outline-variant/30 pt-6 mt-8 flex justify-end">
            <button
              type="submit"
              disabled={updating || !fullName.trim() || fullName.trim() === profile?.full_name}
              className="bg-primary disabled:bg-outline-variant disabled:text-on-surface-variant text-on-primary px-8 py-3 rounded-xl font-label-md text-sm font-bold hover:bg-primary-container transition-colors shadow-ambient flex items-center gap-2"
            >
              {updating ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  <span>جاري الحفظ...</span>
                </>
              ) : (
                <>
                  <Save size={16} />
                  <span>حفظ التعديلات</span>
                </>
              )}
            </button>
          </div>
        </form>

      </div>

      {profile?.role === 'admin' && (
        <div className="bg-surface-container-lowest rounded-2xl border border-outline-variant shadow-ambient p-6 md:p-8">
          {/* Title */}
          <div className="border-b border-outline-variant/30 pb-4 mb-6">
            <h2 className="text-xl font-bold text-on-surface flex items-center gap-2">
              <span className="material-symbols-outlined text-primary text-[24px]">settings_suggest</span>
              <span>إعدادات الصفوف والشعب الدراسية</span>
            </h2>
            <p className="text-xs text-on-surface-variant mt-1">تحديد الاختيارات التي تظهر للطلاب والمحتوى بالمنصة</p>
          </div>

          {generalStatus.type && (
            <div className={`p-4 rounded-xl flex items-start gap-3 text-xs mb-6 animate-in fade-in duration-200 ${
              generalStatus.type === 'success' 
                ? 'bg-teal-50 dark:bg-teal-950/20 text-teal-700 dark:text-teal-300 border border-teal-500/20' 
                : 'bg-error-container/20 text-error border border-error/20'
            }`}>
              {generalStatus.type === 'success' ? <CheckCircle className="shrink-0" size={16} /> : <AlertCircle className="shrink-0" size={16} />}
              <span>{generalStatus.message}</span>
            </div>
          )}

          <div className="space-y-6">
            {/* Academic Years Toggle Selection */}
            <div className="space-y-3">
              <label className="block text-xs font-bold text-on-surface">الصفوف الدراسية النشطة بالمنصة</label>
              <p className="text-[11px] text-on-surface-variant">انقر على الصف الدراسي لتفعيله أو تعطيلها للطلاب</p>
              
              <div className="flex flex-wrap gap-3 pt-1">
                {['الصف الأول الثانوي', 'الصف الثاني الثانوي', 'الصف الثالث الثانوي', 'طلاب الـ IG'].map((year) => {
                  const isActive = academicYears.includes(year);
                  return (
                    <button
                      type="button"
                      key={year}
                      onClick={() => {
                        if (isActive) {
                          setAcademicYears(prev => prev.filter(y => y !== year));
                        } else {
                          const ordered = ['الصف الأول الثانوي', 'الصف الثاني الثانوي', 'الصف الثالث الثانوي', 'طلاب الـ IG'];
                          setAcademicYears(prev => {
                            const next = [...prev, year];
                            return ordered.filter(y => next.includes(y));
                          });
                        }
                      }}
                      className={`px-4 py-2.5 rounded-xl text-xs font-semibold border transition-all flex items-center gap-2 cursor-pointer select-none ${
                        isActive 
                          ? 'bg-primary/10 border-primary text-primary dark:bg-primary/20 shadow-sm' 
                          : 'bg-surface border-outline-variant text-on-surface-variant hover:border-outline hover:text-on-surface'
                      }`}
                    >
                      <span className="material-symbols-outlined text-[16px]">
                        {isActive ? 'check_box' : 'check_box_outline_blank'}
                      </span>
                      <span>{year}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Branches Grouped Selection */}
            <div className="space-y-4 pt-4 border-t border-outline-variant/30">
              <label className="block text-xs font-bold text-on-surface">تحديد الشعب والتخصصات النشطة لكل صف</label>
              <p className="text-[11px] text-on-surface-variant">انقر على الشعبة لتفعيلها أو تعطيلها للطلاب في هذا الصف الدراسي</p>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {academicYears.length === 0 ? (
                  <p className="text-xs text-on-surface-variant italic col-span-3">لا توجد صفوف دراسية مضافة. يرجى إضافة صف أولاً لتحديد الشعب المتاحة له.</p>
                ) : (
                  academicYears.map((year) => {
                    const options = getBranchesForYear(year);
                    return (
                      <div key={year} className="bg-surface-container-low p-4 rounded-xl border border-outline-variant/40 space-y-3">
                        <div className="flex items-center gap-2">
                          <span className="material-symbols-outlined text-sm text-primary">school</span>
                          <h4 className="text-xs font-bold text-on-surface">{year}</h4>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {options.map((option) => {
                            const isActive = branches.includes(option);
                            return (
                              <button
                                type="button"
                                key={option}
                                onClick={() => {
                                  if (isActive) {
                                    setBranches(prev => prev.filter(b => b !== option));
                                  } else {
                                    setBranches(prev => [...prev, option]);
                                  }
                                }}
                                className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all flex items-center gap-1.5 cursor-pointer select-none ${
                                  isActive 
                                    ? 'bg-primary/10 border-primary text-primary dark:bg-primary/20' 
                                    : 'bg-surface border-outline-variant text-on-surface-variant hover:border-outline hover:text-on-surface'
                                }`}
                              >
                                <span className="material-symbols-outlined text-[14px]">
                                  {isActive ? 'check_circle' : 'radio_button_unchecked'}
                                </span>
                                <span>{option}</span>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* Save Button */}
            <div className="border-t border-outline-variant/30 pt-6 mt-8 flex justify-end">
              <button
                type="button"
                onClick={handleSaveGeneralSettings}
                disabled={savingGeneral}
                className="bg-primary disabled:bg-outline-variant disabled:text-on-surface-variant text-on-primary px-8 py-3 rounded-xl font-label-md text-sm font-bold hover:bg-primary-container transition-colors shadow-ambient flex items-center gap-2"
              >
                {savingGeneral ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    <span>جاري الحفظ...</span>
                  </>
                ) : (
                  <>
                    <Save size={16} />
                    <span>حفظ إعدادات المنصة</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
