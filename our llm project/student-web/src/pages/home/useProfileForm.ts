import { useEffect, useState } from 'react';
import type { ChangeEvent, FormEvent } from 'react';
import { ApiService } from '../../services/api';
import type { ConfirmDialogState, ShowToastFn } from './types';

/**
 * Profile tab state: the edit form, avatar upload, academic years/branches
 * (loaded from public settings), and the linked-device unbind flow.
 */
export function useProfileForm(
  profile: any | null,
  loadData: () => Promise<void>,
  showToast: ShowToastFn,
  setConfirmDialog: (dialog: ConfirmDialogState | null) => void,
) {
  // Profile Edit State
  const [editName, setEditName] = useState(profile?.full_name || '');
  const [editPhone, setEditPhone] = useState(profile?.phone || '');
  const [editParentPhone, setEditParentPhone] = useState(profile?.parent_phone || '');
  const [editGov, setEditGov] = useState(profile?.governorate || '');

  const [academicYears, setAcademicYears] = useState<string[]>([
    'الصف الأول الثانوي',
    'الصف الثاني الثانوي',
    'الصف الثالث الثانوي',
    'طلاب الـ IG',
  ]);
  const [branches, setBranches] = useState<string[]>([]);
  const [editBranch, setEditBranch] = useState(profile?.branch || '');

  const [editGrade, setEditGrade] = useState(profile?.grade || 'الصف الأول الثانوي');
  const [updatingProfile, setUpdatingProfile] = useState(false);

  // Profile Avatar State
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);

  useEffect(() => {
    if (profile) {
      setEditName(profile.full_name || '');
      setEditPhone(profile.phone || '');
      setEditParentPhone(profile.parent_phone || '');
      setEditGov(profile.governorate || '');
      setEditGrade(profile.grade || 'الصف الأول الثانوي');
      setEditBranch(profile.branch || '');

      const cached = localStorage.getItem(`student_avatar_${profile.id}`) || profile.avatar_url;
      setAvatarUrl(cached || null);
    } else {
      setAvatarUrl(null);
    }
  }, [profile]);

  useEffect(() => {
    const loadSettings = async () => {
      try {
        const res = await ApiService.getPublicSettings();
        if (res) {
          if (res.academic_years && res.academic_years.length > 0) {
            setAcademicYears(res.academic_years);
          }
          if (res.branches && res.branches.length > 0) {
            setBranches(res.branches);
          }
        }
      } catch (err) {
        console.error("Failed to load public settings on home page:", err);
      }
    };
    loadSettings();
  }, []);

  const getFilteredBranches = (grade: string) => {
    let allowed: string[] = [];
    if (grade.includes('الأول')) {
      allowed = ['عام', 'أزهر'];
    } else if (grade.includes('الثاني')) {
      allowed = ['عام', 'أزهر', 'علمي', 'أدبي'];
    } else if (grade.includes('الثالث')) {
      allowed = ['عام', 'أزهر', 'علمي علوم', 'علمي رياضة', 'أدبي'];
    } else if (grade.includes('IG') || grade.toLowerCase().includes('ig')) {
      allowed = ['OL', 'AS', 'A-Level', 'علمي', 'أدبي'];
    } else {
      return branches && branches.length > 0 ? branches : ['عام'];
    }

    if (branches && branches.length > 0) {
      const filtered = branches.filter(b => allowed.includes(b));
      return filtered.length > 0 ? filtered : ['عام'];
    }

    return allowed;
  };

  const handleUpdateProfile = async (e: FormEvent) => {
    e.preventDefault();
    setUpdatingProfile(true);
    try {
      await ApiService.updateProfile({
        full_name: editName,
        phone: editPhone,
        parent_phone: editParentPhone,
        grade: editGrade,
        branch: editBranch,
        governorate: editGov,
      });
      showToast('success', 'تم تحديث الملف الشخصي بنجاح');
      loadData();
    } catch (err: any) {
      showToast('error', err.message || 'فشل تحديث الملف الشخصي');
    } finally {
      setUpdatingProfile(false);
    }
  };

  const handleAvatarChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // 1. Show immediate local preview
    const reader = new FileReader();
    reader.onloadend = () => {
      setAvatarUrl(reader.result as string);
      if (profile) {
        localStorage.setItem(`student_avatar_${profile.id}`, reader.result as string);
      }
    };
    reader.readAsDataURL(file);

    // 2. Try uploading to backend
    setIsUploadingAvatar(true);
    try {
      const res = await ApiService.uploadAvatar(file);
      if (res && res.avatar_url) {
        setAvatarUrl(res.avatar_url);
        if (profile) {
          localStorage.setItem(`student_avatar_${profile.id}`, res.avatar_url);
        }
      }
    } catch (err) {
      console.warn("Backend avatar upload fell back to local storage:", err);
    } finally {
      setIsUploadingAvatar(false);
    }
  };

  const handleUnbindDevice = (id: string) => {
    setConfirmDialog({
      show: true,
      title: 'حذف الجهاز من الحساب',
      message: 'هل أنت متأكد من رغبتك في حذف هذا الجهاز؟ سيتم فك ارتباطه فوراً.',
      onConfirm: async () => {
        try {
          await ApiService.deleteDevice(id);
          showToast('success', 'تم حذف الجهاز بنجاح.');
          loadData();
        } catch (err: any) {
          showToast('error', err.message || 'فشل حذف الجهاز');
        } finally {
          setConfirmDialog(null);
        }
      }
    });
  };

  return {
    editName, setEditName,
    editPhone, setEditPhone,
    editParentPhone, setEditParentPhone,
    editGov, setEditGov,
    editGrade, setEditGrade,
    editBranch, setEditBranch,
    academicYears,
    branches,
    getFilteredBranches,
    updatingProfile,
    handleUpdateProfile,
    avatarUrl,
    isUploadingAvatar,
    handleAvatarChange,
    handleUnbindDevice,
  };
}
