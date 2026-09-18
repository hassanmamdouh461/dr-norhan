'use client';

import { useState, useEffect } from 'react';
import { api, apiPost, apiPatch, apiDelete } from '@/lib/api';

interface Assistant {
  id: string;
  full_name: string;
  email: string;
  phone: string;
  status: string;
  created_at: string;
  can_reset_devices: number;
  can_grade_quizzes: number;
  can_answer_questions: number;
  can_manage_codes: number;
  can_manage_courses: number;
}

export default function AssistantsPage() {
  const [assistants, setAssistants] = useState<Assistant[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  // Create assistant form state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [newFullName, setNewFullName] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [canResetDevices, setCanResetDevices] = useState(false);
  const [canGradeQuizzes, setCanGradeQuizzes] = useState(false);
  const [canAnswerQuestions, setCanAnswerQuestions] = useState(false);
  const [canManageCodes, setCanManageCodes] = useState(false);
  const [canManageCourses, setCanManageCourses] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const fetchAssistants = async () => {
    setLoading(true);
    try {
      const data = await api<{ assistants: Assistant[] }>('/admin/assistants');
      setAssistants(data.assistants || []);
    } catch (e: any) {
      setError(e.message || 'فشل تحميل قائمة المساعدين');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAssistants();
  }, []);

  const handleCreateAssistant = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEmail || !newFullName || !newPassword) return;
    if (newPassword.length < 8) {
      setError('كلمة المرور يجب أن تتكوّن من 8 رموز على الأقل.');
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      await apiPost('/admin/assistants', {
        email: newEmail,
        full_name: newFullName,
        phone: newPhone,
        password: newPassword,
        permissions: {
          can_reset_devices: canResetDevices,
          can_grade_quizzes: canGradeQuizzes,
          can_answer_questions: canAnswerQuestions,
          can_manage_codes: canManageCodes,
          can_manage_courses: canManageCourses,
        }
      });
      setShowCreateModal(false);
      setNewEmail('');
      setNewFullName('');
      setNewPhone('');
      setNewPassword('');
      setCanResetDevices(false);
      setCanGradeQuizzes(false);
      setCanAnswerQuestions(false);
      setCanManageCodes(false);
      setCanManageCourses(false);
      fetchAssistants();
    } catch (e: any) {
      setError(e.message || 'فشل إضافة المساعد');
    } finally {
      setSubmitting(false);
    }
  };

  const handleTogglePermission = async (assistant: Assistant, key: keyof Assistant, currentVal: number) => {
    const updatedVal = currentVal === 1 ? false : true;
    
    // Build update object
    const permissions = {
      can_reset_devices: assistant.can_reset_devices === 1,
      can_grade_quizzes: assistant.can_grade_quizzes === 1,
      can_answer_questions: assistant.can_answer_questions === 1,
      can_manage_codes: assistant.can_manage_codes === 1,
      can_manage_courses: assistant.can_manage_courses === 1,
    };
    
    // Apply local toggle to the key
    const mapping: Record<string, string> = {
      can_reset_devices: 'can_reset_devices',
      can_grade_quizzes: 'can_grade_quizzes',
      can_answer_questions: 'can_answer_questions',
      can_manage_codes: 'can_manage_codes',
      can_manage_courses: 'can_manage_courses'
    };
    
    if (mapping[key as string]) {
      (permissions as any)[mapping[key as string]] = updatedVal;
    }
    
    try {
      await apiPatch(`/admin/assistants/${assistant.id}`, { permissions });
      fetchAssistants();
    } catch (e: any) {
      setError(e.message || 'فشل تحديث الصلاحية');
    }
  };

  const handleDeleteAssistant = async (assistantId: string, fullName: string) => {
    if (!confirm(`هل أنت متأكد من حذف حساب المساعد "${fullName}" بالكامل؟`)) return;
    try {
      await apiDelete(`/admin/assistants/${assistantId}`);
      fetchAssistants();
    } catch (e: any) {
      setError(e.message || 'فشل حذف المساعد');
    }
  };

  return (
    <div className="space-y-6 text-on-surface">
      {/* Header */}
      <div className="flex justify-between items-center flex-wrap gap-4">
        <div>
          <h1 className="font-display-lg text-2xl font-bold flex items-center gap-2">
            <span className="material-symbols-outlined text-primary text-2xl">shield_person</span>
            <span>إدارة المساعدين والوظائف (RBAC)</span>
          </h1>
          <p className="font-body-sm text-on-surface-variant text-xs mt-1">تعيين مساعدين وتحديد صلاحياتهم لإدارة الامتحانات، فك ربط الأجهزة، أو الإجابة عن الأسئلة</p>
        </div>
        <button 
          onClick={() => setShowCreateModal(true)}
          className="px-4 py-2.5 bg-primary hover:bg-primary-container text-on-primary text-xs font-bold rounded-lg transition duration-200 flex items-center gap-1.5"
        >
          <span className="material-symbols-outlined text-sm">person_add</span>
          <span>إضافة مساعد جديد</span>
        </button>
      </div>

      {error && (
        <div className="p-4 rounded-lg bg-error-container/20 border border-error-container text-error text-xs flex items-center justify-between">
          <span>{error}</span>
          <button onClick={() => setError('')} className="underline font-bold transition">إغلاق</button>
        </div>
      )}

      {/* Grid of Assistants */}
      <div className="bg-surface-container-lowest border border-outline-variant rounded-xl overflow-hidden shadow-soft">
        <div className="overflow-x-auto">
          <table className="w-full text-start text-xs">
            <thead>
              <tr className="border-b border-outline-variant text-on-surface-variant font-bold bg-surface-container-low">
                <th className="px-5 py-4">بيانات المساعد</th>
                <th className="px-5 py-4 text-center">فك الأجهزة</th>
                <th className="px-5 py-4 text-center">تصحيح الكويزات</th>
                <th className="px-5 py-4 text-center">إجابة الأسئلة</th>
                <th className="px-5 py-4 text-center">إدارة الأكواد</th>
                <th className="px-5 py-4 text-center">إدارة المحتوى</th>
                <th className="px-5 py-4 text-center">الإجراءات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant">
              {loading ? (
                <tr>
                  <td colSpan={7} className="text-center py-20">
                    <span className="material-symbols-outlined animate-spin text-primary text-2xl">sync</span>
                  </td>
                </tr>
              ) : assistants.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-16 text-on-surface-variant">
                    لا يوجد مساعدون مسجلون حالياً
                  </td>
                </tr>
              ) : assistants.map(assistant => (
                <tr key={assistant.id} className="hover:bg-surface-container/20 transition duration-150">
                  <td className="px-5 py-4">
                    <div>
                      <p className="text-on-surface font-bold text-xs">{assistant.full_name}</p>
                      <p className="text-on-surface-variant text-[10px] mt-0.5">{assistant.email}</p>
                    </div>
                  </td>
                  {/* Permissions Toggles */}
                  {[
                    { key: 'can_reset_devices', val: assistant.can_reset_devices },
                    { key: 'can_grade_quizzes', val: assistant.can_grade_quizzes },
                    { key: 'can_answer_questions', val: assistant.can_answer_questions },
                    { key: 'can_manage_codes', val: assistant.can_manage_codes },
                    { key: 'can_manage_courses', val: assistant.can_manage_courses }
                  ].map(perm => (
                    <td key={perm.key} className="px-5 py-4 text-center">
                      <button 
                        onClick={() => handleTogglePermission(assistant, perm.key as keyof Assistant, perm.val)}
                        className={`w-10 h-6 rounded-full p-0.5 transition-colors duration-200 focus:outline-none flex items-center ${
                          perm.val === 1 ? 'bg-primary justify-end' : 'bg-outline-variant justify-start'
                        }`}
                      >
                        <span className="w-5 h-5 rounded-full bg-white shadow-soft" />
                      </button>
                    </td>
                  ))}
                  {/* Actions */}
                  <td className="px-5 py-4 text-center">
                    <button 
                      onClick={() => handleDeleteAssistant(assistant.id, assistant.full_name)}
                      className="p-2 rounded-lg text-on-surface-variant hover:text-error hover:bg-error-container/20 transition flex items-center justify-center mx-auto"
                      title="حذف حساب المساعد"
                    >
                      <span className="material-symbols-outlined text-base">delete</span>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Invite/Create Assistant Modal */}
      {showCreateModal && (
        <div 
          className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 animate-in fade-in duration-300"
          onClick={() => setShowCreateModal(false)}
        >
          <form 
            onSubmit={handleCreateAssistant}
            className="bg-surface-container-lowest border border-outline-variant rounded-xl p-6 w-full max-w-lg space-y-5 shadow-ambient animate-in zoom-in-95 duration-200"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-outline-variant pb-2">
              <h3 className="text-sm font-bold text-on-surface flex items-center gap-2">
                <span className="material-symbols-outlined text-primary text-base">person_add</span>
                <span>إضافة مساعد جديد للمنصة</span>
              </h3>
              <button 
                type="button" 
                onClick={() => setShowCreateModal(false)} 
                className="text-on-surface-variant hover:text-on-surface transition flex items-center"
              >
                <span className="material-symbols-outlined text-base">close</span>
              </button>
            </div>

            <div className="space-y-3">
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-on-surface-variant">الاسم الكامل</label>
                <input 
                  required
                  placeholder="أدخل اسم المساعد..." 
                  value={newFullName} 
                  onChange={e => setNewFullName(e.target.value)}
                  className="w-full px-4 py-2.5 bg-surface-container-low border border-outline-variant focus:border-primary rounded-lg text-xs text-on-surface focus:outline-none transition" 
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-on-surface-variant">البريد الإلكتروني المسجَّل على حسابه</label>
                <input 
                  required
                  type="email"
                  placeholder="assistant@fusha.edu.eg" 
                  value={newEmail} 
                  onChange={e => setNewEmail(e.target.value)}
                  className="w-full px-4 py-2.5 bg-surface-container-low border border-outline-variant focus:border-primary rounded-lg text-xs text-on-surface focus:outline-none transition" 
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-on-surface-variant">رقم الموبايل (اختياري)</label>
                <input 
                  placeholder="01xxxxxxxxx" 
                  value={newPhone} 
                  onChange={e => setNewPhone(e.target.value)}
                  className="w-full px-4 py-2.5 bg-surface-container-low border border-outline-variant focus:border-primary rounded-lg text-xs text-on-surface focus:outline-none transition" 
                />
              </div>

              {/* كلمة المرور إلزامية: بعد إزالة مزوّد الهوية الخارجي لم يبقَ
                  مصدر للهوية غير كلمة المرور، فبدونها يُنشأ حساب بلا
                  password_hash ولا يستطيع المساعد تسجيل الدخول إطلاقاً
                  (verifyPassword في الـ Worker يردّ false دائماً). */}
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-on-surface-variant">كلمة المرور (8 رموز على الأقل)</label>
                <input 
                  required
                  type="password"
                  minLength={8}
                  autoComplete="new-password"
                  placeholder="كلمة مرور الدخول للمساعد" 
                  value={newPassword} 
                  onChange={e => setNewPassword(e.target.value)}
                  className="w-full px-4 py-2.5 bg-surface-container-low border border-outline-variant focus:border-primary rounded-lg text-xs text-on-surface focus:outline-none transition" 
                />
                <p className="text-[10px] text-on-surface-variant leading-relaxed">
                  سلّم هذه الكلمة للمساعد ليتمكن من الدخول إلى لوحة التحكم.
                </p>
              </div>

              {/* Permissions checkboxes */}
              <div className="space-y-2 pt-2">
                <label className="text-[10px] font-bold text-on-surface-variant">صلاحيات الدور الممنوحة:</label>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  {[
                    { label: 'فك ربط الأجهزة للطلاب', val: canResetDevices, set: setCanResetDevices },
                    { label: 'تصحيح وتقدير الكويزات', val: canGradeQuizzes, set: setCanGradeQuizzes },
                    { label: 'الإجابة على أسئلة الدروس', val: canAnswerQuestions, set: setCanAnswerQuestions },
                    { label: 'توليد وإدارة أكواد الشحن', val: canManageCodes, set: setCanManageCodes },
                    { label: 'إضافة وتعديل الكورسات والدروس', val: canManageCourses, set: setCanManageCourses }
                  ].map((p, idx) => (
                    <label key={idx} className="flex items-center gap-2 p-2 bg-surface-container-low border border-outline-variant rounded-lg cursor-pointer hover:bg-surface-container-high transition">
                      <input 
                        type="checkbox"
                        checked={p.val}
                        onChange={e => p.set(e.target.checked)}
                        className="rounded border-outline-variant text-primary focus:ring-primary w-4 h-4"
                      />
                      <span>{p.label}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <button 
                type="submit" 
                disabled={submitting}
                className="flex-1 py-2.5 bg-primary hover:bg-primary-container text-on-primary font-bold rounded-lg text-xs transition duration-300 disabled:opacity-50 flex justify-center items-center gap-1.5"
              >
                {submitting && <span className="material-symbols-outlined animate-spin text-sm">sync</span>}
                <span>إنشاء وتفعيل الحساب</span>
              </button>
              <button 
                type="button" 
                onClick={() => setShowCreateModal(false)} 
                className="px-5 py-2.5 bg-surface border border-outline-variant text-on-surface-variant rounded-lg text-xs transition duration-300"
              >
                إلغاء
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
