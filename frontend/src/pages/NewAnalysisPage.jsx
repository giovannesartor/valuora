import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import toast from 'react-hot-toast';
import { ArrowLeft, Upload } from 'lucide-react';
import api from '../lib/api';

const SECTORS = [
  'tecnologia', 'saude', 'varejo', 'industria', 'servicos',
  'alimentacao', 'educacao', 'construcao', 'agronegocio',
  'financeiro', 'logistica', 'energia', 'imobiliario',
  'consultoria', 'marketing', 'ecommerce', 'outros',
];

export default function NewAnalysisPage() {
  const navigate = useNavigate();
  const { register, handleSubmit, formState: { errors } } = useForm();
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState('manual'); // manual | upload

  const onSubmitManual = async (data) => {
    setLoading(true);
    try {
      const payload = {
        company_name: data.company_name,
        sector: data.sector,
        cnpj: data.cnpj || null,
        revenue: parseFloat(data.revenue),
        net_margin: parseFloat(data.net_margin) / 100,
        growth_rate: data.growth_rate ? parseFloat(data.growth_rate) / 100 : null,
        debt: parseFloat(data.debt || 0),
        cash: parseFloat(data.cash || 0),
        founder_dependency: parseFloat(data.founder_dependency || 0) / 100,
      };
      const { data: result } = await api.post('/analyses/', payload);
      toast.success('Análise criada com sucesso!');
      navigate(`/analise/${result.id}`);
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Erro ao criar análise.');
    } finally {
      setLoading(false);
    }
  };

  const onUpload = async (e) => {
    e.preventDefault();
    const form = new FormData(e.target);
    const file = form.get('file');
    if (!file || !file.name) {
      toast.error('Selecione um arquivo.');
      return;
    }
    setLoading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('company_name', form.get('company_name'));
      formData.append('sector', form.get('sector'));
      const { data: result } = await api.post('/analyses/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        params: { company_name: form.get('company_name'), sector: form.get('sector') },
      });
      toast.success('Análise criada a partir do upload!');
      navigate(`/analise/${result.id}`);
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Erro ao processar upload.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b border-slate-200">
        <div className="max-w-4xl mx-auto px-6 h-16 flex items-center gap-4">
          <button onClick={() => navigate('/dashboard')} className="text-slate-400 hover:text-navy-900 transition">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="font-bold text-navy-900">Nova Análise</h1>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-10">
        {/* Mode Toggle */}
        <div className="flex gap-2 mb-8">
          <button
            onClick={() => setMode('manual')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
              mode === 'manual' ? 'bg-navy-900 text-white' : 'bg-white text-slate-600 border border-slate-200'
            }`}
          >
            Inserir manualmente
          </button>
          <button
            onClick={() => setMode('upload')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
              mode === 'upload' ? 'bg-navy-900 text-white' : 'bg-white text-slate-600 border border-slate-200'
            }`}
          >
            Upload DRE / Balanço
          </button>
        </div>

        {mode === 'manual' ? (
          <form onSubmit={handleSubmit(onSubmitManual)} className="bg-white border border-slate-200 rounded-2xl p-8">
            <h2 className="text-lg font-bold text-navy-900 mb-6">Dados da empresa</h2>

            <div className="grid md:grid-cols-2 gap-5">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Nome da empresa *</label>
                <input
                  {...register('company_name', { required: 'Obrigatório' })}
                  className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-brand-600 outline-none"
                  placeholder="Nome da empresa"
                />
                {errors.company_name && <p className="text-red-500 text-xs mt-1">{errors.company_name.message}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Setor *</label>
                <select
                  {...register('sector', { required: 'Obrigatório' })}
                  className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-brand-600 outline-none bg-white"
                >
                  <option value="">Selecione...</option>
                  {SECTORS.map((s) => (
                    <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">CNPJ (opcional)</label>
                <input
                  {...register('cnpj')}
                  className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-brand-600 outline-none"
                  placeholder="00.000.000/0001-00"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Receita anual (R$) *</label>
                <input
                  {...register('revenue', { required: 'Obrigatório' })}
                  type="number"
                  step="0.01"
                  className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-brand-600 outline-none"
                  placeholder="1000000"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Margem líquida (%) *</label>
                <input
                  {...register('net_margin', { required: 'Obrigatório' })}
                  type="number"
                  step="0.1"
                  className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-brand-600 outline-none"
                  placeholder="15"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Taxa de crescimento (%)</label>
                <input
                  {...register('growth_rate')}
                  type="number"
                  step="0.1"
                  className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-brand-600 outline-none"
                  placeholder="10"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Dívida total (R$)</label>
                <input
                  {...register('debt')}
                  type="number"
                  step="0.01"
                  className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-brand-600 outline-none"
                  placeholder="0"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Caixa (R$)</label>
                <input
                  {...register('cash')}
                  type="number"
                  step="0.01"
                  className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-brand-600 outline-none"
                  placeholder="0"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                  Dependência do fundador (0-100%)
                </label>
                <input
                  {...register('founder_dependency')}
                  type="number"
                  min="0"
                  max="100"
                  step="5"
                  className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-brand-600 outline-none"
                  placeholder="0"
                />
                <p className="text-xs text-slate-400 mt-1">0% = nenhuma dependência, 100% = totalmente dependente</p>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="mt-8 w-full bg-brand-600 text-white py-3 rounded-xl font-semibold hover:bg-brand-700 transition disabled:opacity-50"
            >
              {loading ? 'Calculando valuation...' : 'Calcular valuation'}
            </button>
          </form>
        ) : (
          <form onSubmit={onUpload} className="bg-white border border-slate-200 rounded-2xl p-8">
            <h2 className="text-lg font-bold text-navy-900 mb-6">Upload de DRE / Balanço</h2>

            <div className="grid md:grid-cols-2 gap-5 mb-6">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Nome da empresa *</label>
                <input
                  name="company_name"
                  required
                  className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-brand-600 outline-none"
                  placeholder="Nome da empresa"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Setor *</label>
                <select
                  name="sector"
                  required
                  className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-brand-600 outline-none bg-white"
                >
                  <option value="">Selecione...</option>
                  {SECTORS.map((s) => (
                    <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="border-2 border-dashed border-slate-200 rounded-2xl p-10 text-center hover:border-brand-300 transition">
              <Upload className="w-8 h-8 text-slate-300 mx-auto mb-3" />
              <p className="text-sm text-slate-500 mb-2">Arraste ou selecione seu arquivo</p>
              <p className="text-xs text-slate-400 mb-4">PDF ou Excel (DRE, Balanço Patrimonial)</p>
              <input
                type="file"
                name="file"
                accept=".pdf,.xlsx,.xls"
                className="block mx-auto text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-brand-50 file:text-brand-600 file:font-semibold file:text-sm hover:file:bg-brand-100"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="mt-8 w-full bg-brand-600 text-white py-3 rounded-xl font-semibold hover:bg-brand-700 transition disabled:opacity-50"
            >
              {loading ? 'Processando...' : 'Enviar e analisar'}
            </button>
          </form>
        )}
      </main>
    </div>
  );
}
