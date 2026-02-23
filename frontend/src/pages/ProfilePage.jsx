import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, User, Lock, Download, Trash2, Save, AlertTriangle } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../lib/api';
import useAuthStore from '../store/authStore';
import ConfirmDialog from '../components/ConfirmDialog';
import { useTheme } from '../context/ThemeContext';

export default function ProfilePage() {
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
      toast.success('Perfil atualizado com sucesso!');
      fetchUser();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Erro ao atualizar perfil.');
    } finally {
      setSaving(false);
    }
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    if (newPassword.length < 8) return toast.error('Nova senha deve ter no mínimo 8 caracteres.');
    if (!/[A-Z]/.test(newPassword)) return toast.error('Nova senha deve conter ao menos uma letra maiúscula.');
    if (!/[0-9]/.test(newPassword)) return toast.error('Nova senha deve conter ao menos um número.');
    if (newPassword !== confirmNewPassword) return toast.error('As senhas não coincidem.');

    setChangingPassword(true);
    try {
      await api.post('/auth/me/change-password', {
        current_password: currentPassword,
        new_password: newPassword,
      });
      toast.success('Senha alterada com sucesso!');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmNewPassword('');
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Erro ao alterar senha.');
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
      a.download = 'meus-dados-quantovale.json';
      a.click();
      URL.revokeObjectURL(url);
      toast.success('Dados exportados com sucesso!');
    } catch {
      toast.error('Erro ao exportar dados.');
    } finally {
      setExporting(false);
    }
  };

  const handleDeleteAccount = async () => {
    setDeletingAccount(true);
    try {
      await api.delete('/auth/me');
      toast.success('Conta excluída permanentemente.');
      logout();
      navigate('/');
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Erro ao excluir conta.');
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
          <h1 className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>Meu Perfil</h1>
          <p className={`text-sm mt-1 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
            Gerencie suas informações e configurações de conta.
          </p>
        </div>
      </div>

      {/* Profile Card */}
      <div className={`rounded-2xl border p-6 mb-6 ${isDark ? 'bg-slate-900/60 border-slate-800' : 'bg-white border-slate-200 shadow-sm'}`}>
        <div className="flex items-center gap-2 mb-5">
          <User className={`w-5 h-5 ${isDark ? 'text-emerald-400' : 'text-emerald-500'}`} />
          <h2 className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>Informações Pessoais</h2>
        </div>

        <form onSubmit={handleSaveProfile} className="space-y-4">
          <div>
            <label className={`block text-sm font-medium mb-1.5 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>E-mail</label>
            <input value={user?.email || ''} disabled className={`${inputClass} opacity-50 cursor-not-allowed`} />
          </div>
          <div>
            <label className={`block text-sm font-medium mb-1.5 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>Nome completo</label>
            <input value={fullName} onChange={e => setFullName(e.target.value)} className={inputClass} placeholder="Seu nome" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className={`block text-sm font-medium mb-1.5 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>Telefone</label>
              <input value={phone} onChange={e => setPhone(e.target.value)} className={inputClass} placeholder="(11) 99999-9999" />
            </div>
            <div>
              <label className={`block text-sm font-medium mb-1.5 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>Empresa</label>
              <input value={companyName} onChange={e => setCompanyName(e.target.value)} className={inputClass} placeholder="Nome da empresa" />
            </div>
          </div>
          <button type="submit" disabled={saving} className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 text-white rounded-xl text-sm font-semibold hover:from-emerald-500 hover:to-teal-500 transition disabled:opacity-50 shadow-lg shadow-emerald-600/20">
            <Save className="w-4 h-4" />
            {saving ? 'Salvando...' : 'Salvar alterações'}
          </button>
        </form>
      </div>

      {/* Password Card */}
      <div className={`rounded-2xl border p-6 mb-6 ${isDark ? 'bg-slate-900/60 border-slate-800' : 'bg-white border-slate-200 shadow-sm'}`}>
        <div className="flex items-center gap-2 mb-5">
          <Lock className={`w-5 h-5 ${isDark ? 'text-emerald-400' : 'text-emerald-500'}`} />
          <h2 className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>Alterar Senha</h2>
        </div>

        <form onSubmit={handleChangePassword} className="space-y-4">
          <div>
            <label className={`block text-sm font-medium mb-1.5 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>Senha atual</label>
            <input type="password" autoComplete="current-password" value={currentPassword} onChange={e => setCurrentPassword(e.target.value)} className={inputClass} placeholder="••••••••" />
          </div>
          <div>
            <label className={`block text-sm font-medium mb-1.5 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>Nova senha</label>
            <input type="password" autoComplete="new-password" value={newPassword} onChange={e => setNewPassword(e.target.value)} className={inputClass} placeholder="Mínimo 8 caracteres, 1 maiúscula, 1 número" />
          </div>
          <div>
            <label className={`block text-sm font-medium mb-1.5 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>Confirmar nova senha</label>
            <input type="password" autoComplete="new-password" value={confirmNewPassword} onChange={e => setConfirmNewPassword(e.target.value)} className={inputClass} placeholder="Repita a nova senha" />
          </div>
          <button type="submit" disabled={changingPassword} className={`px-5 py-2.5 rounded-xl text-sm font-semibold transition disabled:opacity-50 ${isDark ? 'bg-slate-800 text-white hover:bg-slate-700' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}>
            {changingPassword ? 'Alterando...' : 'Alterar senha'}
          </button>
        </form>
      </div>

      {/* LGPD Card */}
      <div className={`rounded-2xl border p-6 ${isDark ? 'bg-slate-900/60 border-slate-800' : 'bg-white border-slate-200 shadow-sm'}`}>
        <div className="flex items-center gap-2 mb-5">
          <AlertTriangle className={`w-5 h-5 ${isDark ? 'text-amber-400' : 'text-amber-500'}`} />
          <h2 className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>Dados e Privacidade (LGPD)</h2>
        </div>

        <div className="space-y-4">
          <div className={`p-4 rounded-xl border ${isDark ? 'bg-slate-800/50 border-slate-700' : 'bg-slate-50 border-slate-200'}`}>
            <p className={`text-sm font-medium mb-1 ${isDark ? 'text-white' : 'text-slate-900'}`}>Exportar meus dados</p>
            <p className={`text-xs mb-3 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
              Baixe todos os seus dados pessoais e análises em formato JSON.
            </p>
            <button onClick={handleExportData} disabled={exporting} className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition disabled:opacity-50 ${isDark ? 'bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20' : 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100'}`}>
              <Download className="w-4 h-4" />
              {exporting ? 'Exportando...' : 'Exportar dados'}
            </button>
          </div>

          <div className={`p-4 rounded-xl border ${isDark ? 'bg-red-500/5 border-red-500/20' : 'bg-red-50 border-red-200'}`}>
            <p className={`text-sm font-medium mb-1 ${isDark ? 'text-red-400' : 'text-red-600'}`}>Excluir minha conta</p>
            <p className={`text-xs mb-3 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
              Esta ação é irreversível. Todos os seus dados, análises e pagamentos serão excluídos permanentemente.
            </p>
            <button onClick={() => setDeleteConfirm(true)} className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition ${isDark ? 'bg-red-500/10 text-red-400 hover:bg-red-500/20' : 'bg-red-100 text-red-600 hover:bg-red-200'}`}>
              <Trash2 className="w-4 h-4" />
              Excluir conta permanentemente
            </button>
          </div>
        </div>
      </div>

      {/* Delete Account Confirmation */}
      <ConfirmDialog
        open={deleteConfirm}
        title="Excluir conta permanentemente?"
        message="Todos os seus dados, análises e pagamentos serão excluídos para sempre. Esta ação NÃO pode ser desfeita."
        confirmLabel="Sim, excluir minha conta"
        confirmColor="red"
        loading={deletingAccount}
        onConfirm={handleDeleteAccount}
        onCancel={() => setDeleteConfirm(false)}
      />
    </div>
  );
}
