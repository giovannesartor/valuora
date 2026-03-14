import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import toast from 'react-hot-toast';
import api from '../lib/api';
import { useTheme } from '../context/ThemeContext';

export default function ForgotPasswordPage() {
  const { isDark } = useTheme();
  const { register, handleSubmit } = useForm();
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const onSubmit = async (data) => {
    setLoading(true);
    try {
      await api.post('/auth/forgot-password', { email: data.email });
      setSent(true);
    } catch {
      toast.error('Error processing request.');
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

        {sent ? (
          <div className="text-center py-8">
            <h2 className={`text-xl font-bold mb-2 ${isDark ? 'text-white' : 'text-slate-900'}`}>Email sent!</h2>
            <p className={`mb-6 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>If the email exists in our system, we will send instructions to reset your password.</p>
            <Link to="/login" className="text-emerald-500 font-semibold">Back to login</Link>
          </div>
        ) : (
          <>
            <h2 className={`text-2xl font-bold mb-2 ${isDark ? 'text-white' : 'text-slate-900'}`}>Forgot your password?</h2>
            <p className={`mb-8 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Enter your email to receive the reset link.</p>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
              <div>
                <label className={`block text-sm font-medium mb-1.5 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>Email</label>
                <input
                  {...register('email', { required: true })}
                  type="email"
                  className={`w-full px-4 py-3 border rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none transition ${isDark ? 'bg-slate-800 border-slate-700 text-white placeholder:text-slate-500' : 'bg-white border-slate-200 text-slate-900'}`}
                  placeholder="seu@email.com"
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-emerald-600 text-white py-3 rounded-xl font-semibold hover:bg-emerald-700 transition disabled:opacity-50"
              >
                {loading ? 'Sending...' : 'Send link'}
              </button>
            </form>
            <p className={`text-center text-sm mt-6 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
              <Link to="/login" className="text-emerald-500 font-semibold">Back to login</Link>
            </p>
          </>
        )}
      </div>
    </div>
  );
}
