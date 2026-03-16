import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, User, Lock, Download, Trash2, Save, AlertTriangle, BarChart3, Crown, Plus } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../lib/api';
import useAuthStore from '../store/authStore';
import ConfirmDialog from '../components/ConfirmDialog';
import { useTheme } from '../context/ThemeContext';
import { usePageTitle } from '../lib/usePageTitle';
import { useI18n } from '../lib/i18n';

export default function ProfilePage() {
  const { t } = useI18n();
  usePageTitle(t('profile_heading'));
  const { isDark } = useTheme();
  const navigate = useNavigate();
  const { user, fetchUser, logout } = useAuthStore();

  // Profile form
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [saving, setSaving] = useState(false);

  // Password form
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [changingPassword, setChangingPassword] = useState(false);

  // LGPD
  const [exporting, setExporting] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [deletingAccount, setDeletingAccount] = useState(false);

  useEffect(() => {
    if (user) {
      setFullName(user.full_name || '');
      setPhone(user.phone || '');
      setCompanyName(user.company_name || '');
    }
  }, [user]);

  const handleSaveProfile = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.patch('/auth/me', { full_name: fullName, phone, company_name: companyName });
      toast.success(t('profile_updated'));
      fetchUser();
    } catch (err) {
      toast.error(err.response?.data?.detail || t('profile_error_update'));
    } finally {
      setSaving(false);
    }
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    if (newPassword.length < 8) return toast.error(t('profile_pw_min_length'));
    if (!/[A-Z]/.test(newPassword)) return toast.error(t('profile_pw_uppercase'));
    if (!/[0-9]/.test(newPassword)) return toast.error(t('profile_pw_number'));
    if (newPassword !== confirmNewPassword) return toast.error(t('profile_pw_mismatch'));

    setChangingPassword(true);
    try {
      await api.post('/auth/me/change-password', {
        current_password: currentPassword,
        new_password: newPassword,
      });
      toast.success(t('profile_pw_changed'));
      setCurrentPassword('');
      setNewPassword('');
      setConfirmNewPassword('');
    } catch (err) {
      toast.error(err.response?.data?.detail || t('profile_error_pw'));
    } finally {
      setChangingPassword(false);
    }
  };

  const handleExportData = async () => {
    setExporting(true);
    try {
      const res = await api.get('/auth/export-data');
      const blob = new Blob([JSON.stringify(res.data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'my-data-valuora.json';
      a.click();
      URL.revokeObjectURL(url);
      toast.success(t('profile_data_exported'));
    } catch {
      toast.error(t('profile_error_export'));
    } finally {
      setExporting(false);
    }
  };

  const handleDeleteAccount = async () => {
    setDeletingAccount(true);
    try {
      await api.delete('/auth/me');
      toast.success(t('profile_account_deleted'));
      logout();
      navigate('/');
    } catch (err) {
      toast.error(err.response?.data?.detail || t('profile_error_delete'));
    } finally {
      setDeletingAccount(false);
      setDeleteConfirm(false);
    }
  };

  const inputClass = `w-full px-4 py-3 border rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none transition ${isDark ? 'bg-slate-800 border-slate-700 text-white placeholder-slate-500' : 'bg-white border-slate-200 text-slate-900 placeholder-slate-400'}`;

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-4 mb-8">
        <button
          onClick={() => navigate('/dashboard')}
          className={`p-2 rounded-xl transition ${isDark ? 'hover:bg-slate-800 text-slate-400' : 'hover:bg-slate-100 text-slate-500'}`}
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h1 className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>{t('profile_heading')}</h1>
          <p className={`text-sm mt-1 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
            {t('profile_subtitle')}
          </p>
        </div>
      </div>

      {/* Avatar + Plan Card */}
      {(() => {
        const initials = user?.full_name
          ? user.full_name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase()
          : (user?.email?.[0] || 'U').toUpperCase();
        return (
          <div className={`rounded-2xl border p-5 mb-6 ${isDark ? 'bg-slate-900/60 border-slate-800' : 'bg-white border-slate-200 shadow-sm'}`}>
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-full bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center text-white font-bold text-xl flex-shrink-0">
                {initials}
              </div>
              <div className="flex-1 min-w-0">
                <p className={`font-bold text-lg truncate ${isDark ? 'text-white' : 'text-slate-900'}`}>{user?.full_name || '—'}</p>
                <p className={`text-sm truncate ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{user?.email}</p>
                <span className={`inline-flex items-center gap-1 mt-1 px-2.5 py-0.5 rounded-full text-xs font-semibold ${user?.is_admin ? 'bg-purple-500/15 text-purple-400' : 'bg-emerald-500/15 text-emerald-500'}`}>
                  <Crown className="w-3 h-3" />
                  {user?.is_admin ? 'Admin' : user?.plan ? (user.plan.charAt(0).toUpperCase() + user.plan.slice(1)) : 'Free'}
                </span>
              </div>
            </div>
            <div className={`mt-4 pt-4 border-t grid grid-cols-2 gap-3 ${isDark ? 'border-slate-800' : 'border-slate-100'}`}>
              <Link to="/dashboard" className={`flex items-center justify-center gap-2 py-2 rounded-xl text-sm font-medium transition ${isDark ? 'bg-slate-800 text-slate-300 hover:bg-slate-700' : 'bg-slate-50 text-slate-600 hover:bg-slate-100'}`}>
                <BarChart3 className="w-4 h-4" /> {t('nav_dashboard')}
              </Link>
              <Link to="/new-analysis" className="flex items-center justify-center gap-2 py-2 rounded-xl text-sm font-medium bg-gradient-to-r from-emerald-600 to-teal-600 text-white hover:from-emerald-500 hover:to-teal-500 transition">
                <Plus className="w-4 h-4" /> {t('nav_new_analysis')}
              </Link>
            </div>
          </div>
        );
      })()}

      {/* Profile Card */}
      <div className={`rounded-2xl border p-6 mb-6 ${isDark ? 'bg-slate-900/60 border-slate-800' : 'bg-white border-slate-200 shadow-sm'}`}>
        <div className="flex items-center gap-2 mb-5">
          <User className={`w-5 h-5 ${isDark ? 'text-emerald-400' : 'text-emerald-500'}`} />
          <h2 className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>{t('profile_personal_info')}</h2>
        </div>

        <form onSubmit={handleSaveProfile} className="space-y-4">
          <div>
            <label className={`block text-sm font-medium mb-1.5 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>{t('profile_email_label')}</label>
            <input value={user?.email || ''} disabled className={`${inputClass} opacity-50 cursor-not-allowed`} />
          </div>
          <div>
            <label className={`block text-sm font-medium mb-1.5 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>{t('profile_fullname_label')}</label>
            <input value={fullName} onChange={e => setFullName(e.target.value)} className={inputClass} placeholder="Your name" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className={`block text-sm font-medium mb-1.5 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>{t('profile_phone_label')}</label>
              <input value={phone} onChange={e => setPhone(e.target.value)} className={inputClass} placeholder="(555) 123-4567" />
            </div>
            <div>
              <label className={`block text-sm font-medium mb-1.5 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>{t('profile_company_label')}</label>
              <input value={companyName} onChange={e => setCompanyName(e.target.value)} className={inputClass} placeholder="Company name" />
            </div>
          </div>
          <button type="submit" disabled={saving} className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 text-white rounded-xl text-sm font-semibold hover:from-emerald-500 hover:to-teal-500 transition disabled:opacity-50 shadow-lg shadow-emerald-600/20">
            <Save className="w-4 h-4" />
            {saving ? t('profile_saving') : t('profile_save_changes')}
          </button>
        </form>
      </div>

      {/* Password Card */}
      <div className={`rounded-2xl border p-6 mb-6 ${isDark ? 'bg-slate-900/60 border-slate-800' : 'bg-white border-slate-200 shadow-sm'}`}>
        <div className="flex items-center gap-2 mb-5">
          <Lock className={`w-5 h-5 ${isDark ? 'text-emerald-400' : 'text-emerald-500'}`} />
          <h2 className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>{t('profile_change_password')}</h2>
        </div>

        <form onSubmit={handleChangePassword} className="space-y-4">
          <div>
            <label className={`block text-sm font-medium mb-1.5 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>{t('profile_current_pw_label')}</label>
            <input type="password" autoComplete="current-password" value={currentPassword} onChange={e => setCurrentPassword(e.target.value)} className={inputClass} placeholder="••••••••" />
          </div>
          <div>
            <label className={`block text-sm font-medium mb-1.5 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>{t('profile_new_pw_label')}</label>
            <input type="password" autoComplete="new-password" value={newPassword} onChange={e => setNewPassword(e.target.value)} className={inputClass} placeholder="Minimum 8 characters, 1 uppercase, 1 number" />
          </div>
          <div>
            <label className={`block text-sm font-medium mb-1.5 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>{t('profile_confirm_pw_label')}</label>
            <input type="password" autoComplete="new-password" value={confirmNewPassword} onChange={e => setConfirmNewPassword(e.target.value)} className={inputClass} placeholder="Repeat new password" />
          </div>
          <button type="submit" disabled={changingPassword} className={`px-5 py-2.5 rounded-xl text-sm font-semibold transition disabled:opacity-50 ${isDark ? 'bg-slate-800 text-white hover:bg-slate-700' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}>
            {changingPassword ? t('profile_changing') : t('profile_change_pw_btn')}
          </button>
        </form>
      </div>

      {/* LGPD Card */}
      <div className={`rounded-2xl border p-6 ${isDark ? 'bg-slate-900/60 border-slate-800' : 'bg-white border-slate-200 shadow-sm'}`}>
        <div className="flex items-center gap-2 mb-5">
          <AlertTriangle className={`w-5 h-5 ${isDark ? 'text-amber-400' : 'text-amber-500'}`} />
          <h2 className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>{t('profile_data_privacy')}</h2>
        </div>

        <div className="space-y-4">
          <div className={`p-4 rounded-xl border ${isDark ? 'bg-slate-800/50 border-slate-700' : 'bg-slate-50 border-slate-200'}`}>
            <p className={`text-sm font-medium mb-1 ${isDark ? 'text-white' : 'text-slate-900'}`}>{t('profile_export_title')}</p>
            <p className={`text-xs mb-3 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
              {t('profile_export_desc')}
            </p>
            <button onClick={handleExportData} disabled={exporting} className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition disabled:opacity-50 ${isDark ? 'bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20' : 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100'}`}>
              <Download className="w-4 h-4" />
              {exporting ? t('profile_exporting') : t('profile_export_btn')}
            </button>
          </div>

          <div className={`p-4 rounded-xl border ${isDark ? 'bg-red-500/5 border-red-500/20' : 'bg-red-50 border-red-200'}`}>
            <p className={`text-sm font-medium mb-1 ${isDark ? 'text-red-400' : 'text-red-600'}`}>{t('profile_delete_title')}</p>
            <p className={`text-xs mb-3 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
              {t('profile_delete_desc')}
            </p>
            <button onClick={() => setDeleteConfirm(true)} className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition ${isDark ? 'bg-red-500/10 text-red-400 hover:bg-red-500/20' : 'bg-red-100 text-red-600 hover:bg-red-200'}`}>
              <Trash2 className="w-4 h-4" />
              {t('profile_delete_btn')}
            </button>
          </div>
        </div>
      </div>

      {/* Delete Account Confirmation */}
      <ConfirmDialog
        open={deleteConfirm}
        title={t('profile_delete_dialog_title')}
        message={t('profile_delete_dialog_msg')}
        confirmLabel={t('profile_delete_dialog_confirm')}
        confirmColor="red"
        loading={deletingAccount}
        onConfirm={handleDeleteAccount}
        onCancel={() => setDeleteConfirm(false)}
      />
    </div>
  );
}
