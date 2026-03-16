import { useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import toast from 'react-hot-toast';
import api from '../lib/api';
import { useTheme } from '../context/ThemeContext';
import { useI18n } from '../lib/i18n';

export default function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { isDark } = useTheme();
  const { t } = useI18n();
  const { register, handleSubmit } = useForm();
  const [loading, setLoading] = useState(false);
  const token = searchParams.get('token');

  if (!token) {
    return (
      <div className={`min-h-screen flex items-center justify-center p-4 ${isDark ? 'bg-slate-950 text-white' : 'bg-slate-50 text-slate-900'}`}>
        <div className="text-center">
          <p className="text-lg font-semibold mb-2">{t('reset_invalid_link')}</p>
          <p className={`text-sm mb-4 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{t('reset_invalid_desc')}</p>
          <a href="/forgot-password" className="text-emerald-500 hover:underline text-sm">{t('reset_request_new')}</a>
        </div>
      </div>
    );
  }

  const onSubmit = async (data) => {
    if (data.new_password.length < 8) {
      toast.error(t('reset_min_chars'));
      return;
    }
    setLoading(true);
    try {
      await api.post('/auth/reset-password', { token, new_password: data.new_password });
      toast.success(t('reset_success'));
      navigate('/login');
    } catch {
      toast.error(t('reset_error'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={`min-h-screen flex items-center justify-center p-6 transition-colors ${isDark ? 'bg-slate-950' : 'bg-slate-50'}`}>
      <div className={`rounded-2xl shadow-sm border p-10 max-w-md w-full transition-colors ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
        <div className="flex items-center gap-2 mb-8">
          <img src="/favicon.svg?v=2" alt="QV" className="w-8 h-8" loading="lazy" />
          <span className={`font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>Valuora</span>
        </div>

        <h2 className={`text-2xl font-bold mb-2 ${isDark ? 'text-white' : 'text-slate-900'}`}>{t('reset_title')}</h2>
        <p className={`mb-8 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{t('reset_desc')}</p>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
          <div>
            <label className={`block text-sm font-medium mb-1.5 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>{t('reset_label')}</label>
            <input
              {...register('new_password', { required: true })}
              type="password"
              className={`w-full px-4 py-3 border rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none transition ${isDark ? 'bg-slate-800 border-slate-700 text-white placeholder:text-slate-500' : 'bg-white border-slate-200 text-slate-900'}`}
              placeholder={t('reset_placeholder')}
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-emerald-600 text-white py-3 rounded-xl font-semibold hover:bg-emerald-700 transition disabled:opacity-50"
          >
              {loading ? t('reset_saving') : t('reset_submit')}
          </button>
        </form>
      </div>
    </div>
  );
}
