import { useState, useRef } from 'react';
import { Gift, Loader2, CheckCircle, ArrowRight, Building2, Mail, User } from 'lucide-react';
import api from '../lib/api';
import { toast } from 'sonner';

export default function PartnerFreeReportPage() {
  const [form, setForm] = useState({
    company_name: '',
    contact_name: '',
    email: '',
    annual_revenue: '',
    sector: '',
    founding_year: '',
  });
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const resultRef = useRef(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.company_name || !form.email) {
      toast.error('Company name and email are required');
      return;
    }
    setLoading(true);
    try {
      const { data } = await api.post('/partner/free-report', {
        company_name: form.company_name,
        contact_name: form.contact_name || null,
        email: form.email,
        annual_revenue: form.annual_revenue ? parseFloat(form.annual_revenue) : null,
        sector: form.sector || null,
        founding_year: form.founding_year ? parseInt(form.founding_year) : null,
      });
      setResult(data);
      setTimeout(() => resultRef.current?.scrollIntoView({ behavior: 'smooth' }), 150);
      toast.success('Free report generated!');
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to generate report');
    } finally {
      setLoading(false);
    }
  };

  const reset = () => {
    setResult(null);
    setForm({ company_name: '', contact_name: '', email: '', annual_revenue: '', sector: '', founding_year: '' });
  };

  return (
    <div className="max-w-3xl mx-auto space-y-8">
      {/* Header */}
      <div className="text-center">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-emerald-100 dark:bg-emerald-900/30 mb-4">
          <Gift className="w-8 h-8 text-emerald-600" />
        </div>
        <h1 className="text-3xl font-bold text-slate-900 dark:text-white">Free Business Valuation</h1>
        <p className="text-slate-500 dark:text-slate-400 mt-2 max-w-lg mx-auto">
          Offer your prospects a complimentary quick valuation to demonstrate value and generate leads for your consulting practice.
        </p>
      </div>

      {!result ? (
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-6 sm:p-8">
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Company name */}
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                Company Name *
              </label>
              <div className="relative">
                <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  value={form.company_name}
                  onChange={(e) => setForm((f) => ({ ...f, company_name: e.target.value }))}
                  className="w-full pl-10 pr-4 py-2.5 border border-slate-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-700 text-sm focus:ring-2 focus:ring-emerald-500"
                  required
                />
              </div>
            </div>

            {/* Contact name + Email */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                  Contact Name
                </label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type="text"
                    value={form.contact_name}
                    onChange={(e) => setForm((f) => ({ ...f, contact_name: e.target.value }))}
                    className="w-full pl-10 pr-4 py-2.5 border border-slate-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-700 text-sm focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                  Email *
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type="email"
                    value={form.email}
                    onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                    className="w-full pl-10 pr-4 py-2.5 border border-slate-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-700 text-sm focus:ring-2 focus:ring-emerald-500"
                    required
                  />
                </div>
              </div>
            </div>

            {/* Revenue + Sector + Year */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                  Annual Revenue ($)
                </label>
                <input
                  type="number"
                  value={form.annual_revenue}
                  onChange={(e) => setForm((f) => ({ ...f, annual_revenue: e.target.value }))}
                  placeholder="e.g. 500000"
                  className="w-full px-3 py-2.5 border border-slate-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-700 text-sm focus:ring-2 focus:ring-emerald-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                  Industry / Sector
                </label>
                <input
                  type="text"
                  value={form.sector}
                  onChange={(e) => setForm((f) => ({ ...f, sector: e.target.value }))}
                  placeholder="e.g. SaaS"
                  className="w-full px-3 py-2.5 border border-slate-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-700 text-sm focus:ring-2 focus:ring-emerald-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                  Founding Year
                </label>
                <input
                  type="number"
                  value={form.founding_year}
                  onChange={(e) => setForm((f) => ({ ...f, founding_year: e.target.value }))}
                  placeholder="e.g. 2019"
                  className="w-full px-3 py-2.5 border border-slate-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-700 text-sm focus:ring-2 focus:ring-emerald-500"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-semibold flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {loading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  Generate Free Report
                  <ArrowRight className="w-5 h-5" />
                </>
              )}
            </button>
          </form>
        </div>
      ) : (
        <div ref={resultRef} className="space-y-6">
          {/* Success card */}
          <div className="bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-2xl p-6 text-center">
            <CheckCircle className="w-12 h-12 text-emerald-500 mx-auto mb-3" />
            <h2 className="text-xl font-bold text-slate-900 dark:text-white">Report Ready!</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
              A quick valuation for <strong>{form.company_name}</strong> has been generated and sent to <strong>{form.email}</strong>.
            </p>
          </div>

          {/* Quick result */}
          <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-6">
            <h3 className="font-semibold text-slate-900 dark:text-white mb-4">Quick Valuation Summary</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {result.estimated_value != null && (
                <div className="bg-slate-50 dark:bg-slate-700 rounded-xl p-4">
                  <p className="text-xs text-slate-500">Estimated Value</p>
                  <p className="text-2xl font-bold text-emerald-600 mt-1">
                    ${result.estimated_value.toLocaleString('en-US')}
                  </p>
                </div>
              )}
              {result.revenue_multiple != null && (
                <div className="bg-slate-50 dark:bg-slate-700 rounded-xl p-4">
                  <p className="text-xs text-slate-500">Revenue Multiple</p>
                  <p className="text-2xl font-bold text-slate-900 dark:text-white mt-1">{result.revenue_multiple}x</p>
                </div>
              )}
            </div>
            <p className="text-sm text-slate-500 mt-4 bg-amber-50 dark:bg-amber-900/20 p-3 rounded-lg">
              This is a simplified estimate. For a comprehensive analysis using 5 valuation methods (DCF, Scorecard, Checklist, VC Method, Multiples), recommend a <strong>Professional</strong> or <strong>Investor-Ready</strong> report.
            </p>
          </div>

          <div className="flex gap-3 justify-center">
            <button
              onClick={reset}
              className="px-5 py-2.5 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700"
            >
              Generate Another
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
