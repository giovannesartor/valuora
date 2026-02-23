import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import toast from 'react-hot-toast';
import { ArrowLeft, Upload } from 'lucide-react';
import api from '../lib/api';
import ThemeToggle from '../components/ThemeToggle';
import { useTheme } from '../context/ThemeContext';

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
  const [mode, setMode] = useState('manual');
  const [projectionYears, setProjectionYears] = useState(5);
  const { isDark } = useTheme();

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
        projection_years: projectionYears,
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
    <div className={`min-h-screen transition-colors duration-300 ${isDark ? 'bg-slate-950' : 'bg-slate-50'}`}>
      <header className={`border-b transition-colors duration-300 ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
        <div className="max-w-4xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button onClick={() => navigate('/dashboard')} className={`transition ${isDark ? 'text-slate-400 hover:text-white' : 'text-slate-400 hover:text-navy-900'}`}>
              <ArrowLeft className="w-5 h-5" />
            </button>
            <h1 className={`font-bold ${isDark ? 'text-white' : 'text-navy-900'}`}>Nova Análise</h1>
          </div>
          <ThemeToggle />
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-10">
        <div className="flex gap-2 mb-8">
          <button
            onClick={() => setMode('manual')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
              mode === 'manual'
                ? 'bg-gradient-to-r from-blue-600 to-cyan-600 text-white'
                : isDark ? 'bg-slate-800 text-slate-300 border border-slate-700' : 'bg-white text-slate-600 border border-slate-200'
            }`}
          >
            Inserir manualmente
          </button>
          <button
            onClick={() => setMode('upload')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
              mode === 'upload'
                ? 'bg-gradient-to-r from-blue-600 to-cyan-600 text-white'
                : isDark ? 'bg-slate-800 text-slate-300 border border-slate-700' : 'bg-white text-slate-600 border border-slate-200'
            }`}
          >
            Upload DRE / Balanço
          </button>
        </div>

        {mode === 'manual' ? (
          <form onSubmit={handleSubmit(onSubmitManual)} className={`border rounded-2xl p-8 transition-colors ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
            <h2 className={`text-lg font-bold mb-6 ${isDark ? 'text-white' : 'text-navy-900'}`}>Dados da empresa</h2>

            <div className="grid md:grid-cols-2 gap-5">
              <div>
                <label className={`block text-sm font-medium mb-1.5 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>Nome da empresa *</label>
                <input
                  {...register('company_name', { required: 'Obrigatório' })}
                  className={`w-full px-4 py-3 border rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none transition ${isDark ? 'bg-slate-800 border-slate-700 text-white placeholder-slate-500' : 'bg-white border-slate-200 text-slate-900 placeholder-slate-400'}`}
                  placeholder="Nome da empresa"
                />
                {errors.company_name && <p className="text-red-500 text-xs mt-1">{errors.company_name.message}</p>}
              </div>

              <div>
                <label className={`block text-sm font-medium mb-1.5 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>Setor *</label>
                <select
                  {...register('sector', { required: 'Obrigatório' })}
                  className={`w-full px-4 py-3 border rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none transition ${isDark ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-200 text-slate-900'}`}
                >
                  <option value="">Selecione...</option>
                  {SECTORS.map((s) => (
                    <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className={`block text-sm font-medium mb-1.5 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>CNPJ (opcional)</label>
                <input
                  {...register('cnpj')}
                  className={`w-full px-4 py-3 border rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none transition ${isDark ? 'bg-slate-800 border-slate-700 text-white placeholder-slate-500' : 'bg-white border-slate-200 text-slate-900 placeholder-slate-400'}`}
                  placeholder="00.000.000/0001-00"
                />
              </div>

              <div>
                <label className={`block text-sm font-medium mb-1.5 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>Receita anual (R$) *</label>
                <input
                  {...register('revenue', { required: 'Obrigatório' })}
                  type="number"
                  step="0.01"
                  className={`w-full px-4 py-3 border rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none transition ${isDark ? 'bg-slate-800 border-slate-700 text-white placeholder-slate-500' : 'bg-white border-slate-200 text-slate-900 placeholder-slate-400'}`}
                  placeholder="1000000"
                />
              </div>

              <div>
                <label className={`block text-sm font-medium mb-1.5 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>Margem líquida (%) *</label>
                <input
                  {...register('net_margin', { required: 'Obrigatório' })}
                  type="number"
                  step="0.1"
                  className={`w-full px-4 py-3 border rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none transition ${isDark ? 'bg-slate-800 border-slate-700 text-white placeholder-slate-500' : 'bg-white border-slate-200 text-slate-900 placeholder-slate-400'}`}
                  placeholder="15"
                />
              </div>

              <div>
                <label className={`block text-sm font-medium mb-1.5 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>Taxa de crescimento (%)</label>
                <input
                  {...register('growth_rate')}
                  type="number"
                  step="0.1"
                  className={`w-full px-4 py-3 border rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none transition ${isDark ? 'bg-slate-800 border-slate-700 text-white placeholder-slate-500' : 'bg-white border-slate-200 text-slate-900 placeholder-slate-400'}`}
                  placeholder="10"
                />
              </div>

              <div>
                <label className={`block text-sm font-medium mb-1.5 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>Dívida total (R$)</label>
                <input
                  {...register('debt')}
                  type="number"
                  step="0.01"
                  className={`w-full px-4 py-3 border rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none transition ${isDark ? 'bg-slate-800 border-slate-700 text-white placeholder-slate-500' : 'bg-white border-slate-200 text-slate-900 placeholder-slate-400'}`}
                  placeholder="0"
                />
              </div>

              <div>
                <label className={`block text-sm font-medium mb-1.5 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>Caixa (R$)</label>
                <input
                  {...register('cash')}
                  type="number"
                  step="0.01"
                  className={`w-full px-4 py-3 border rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none transition ${isDark ? 'bg-slate-800 border-slate-700 text-white placeholder-slate-500' : 'bg-white border-slate-200 text-slate-900 placeholder-slate-400'}`}
                  placeholder="0"
                />
              </div>

              <div className="md:col-span-2">
                <label className={`block text-sm font-medium mb-1.5 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                  Dependência do fundador (0-100%)
                </label>
                <input
                  {...register('founder_dependency')}
                  type="number"
                  min="0"
                  max="100"
                  step="5"
                  className={`w-full px-4 py-3 border rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none transition ${isDark ? 'bg-slate-800 border-slate-700 text-white placeholder-slate-500' : 'bg-white border-slate-200 text-slate-900 placeholder-slate-400'}`}
                  placeholder="0"
                />
                <p className={`text-xs mt-1 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>0% = nenhuma dependência, 100% = totalmente dependente</p>
              </div>
            </div>

            {/* Projection Years Toggle */}
            <div className="mt-6">
              <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                Horizonte de projeção
              </label>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setProjectionYears(5)}
                  className={`flex-1 py-3 rounded-xl text-sm font-semibold transition border ${
                    projectionYears === 5
                      ? 'bg-gradient-to-r from-blue-600 to-cyan-600 text-white border-transparent shadow-lg shadow-blue-600/25'
                      : isDark ? 'bg-slate-800 text-slate-300 border-slate-700 hover:border-blue-500/50' : 'bg-white text-slate-600 border-slate-200 hover:border-blue-300'
                  }`}
                >
                  5 anos
                </button>
                <button
                  type="button"
                  onClick={() => setProjectionYears(10)}
                  className={`flex-1 py-3 rounded-xl text-sm font-semibold transition border ${
                    projectionYears === 10
                      ? 'bg-gradient-to-r from-blue-600 to-cyan-600 text-white border-transparent shadow-lg shadow-blue-600/25'
                      : isDark ? 'bg-slate-800 text-slate-300 border-slate-700 hover:border-blue-500/50' : 'bg-white text-slate-600 border-slate-200 hover:border-blue-300'
                  }`}
                >
                  10 anos
                </button>
              </div>
              <p className={`text-xs mt-1.5 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                {projectionYears === 5
                  ? 'Recomendado para empresas com histórico curto ou setores voláteis'
                  : 'Recomendado para empresas maduras com receita previsível'}
              </p>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="mt-8 w-full bg-gradient-to-r from-blue-600 to-cyan-600 text-white py-3 rounded-xl font-semibold hover:from-blue-500 hover:to-cyan-500 transition disabled:opacity-50 shadow-lg shadow-blue-600/25"
            >
              {loading ? 'Calculando valuation...' : 'Calcular valuation'}
            </button>
          </form>
        ) : (
          <form onSubmit={onUpload} className={`border rounded-2xl p-8 transition-colors ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
            <h2 className={`text-lg font-bold mb-6 ${isDark ? 'text-white' : 'text-navy-900'}`}>Upload de DRE / Balanço</h2>

            <div className="grid md:grid-cols-2 gap-5 mb-6">
              <div>
                <label className={`block text-sm font-medium mb-1.5 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>Nome da empresa *</label>
                <input
                  name="company_name"
                  required
                  className={`w-full px-4 py-3 border rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none transition ${isDark ? 'bg-slate-800 border-slate-700 text-white placeholder-slate-500' : 'bg-white border-slate-200 text-slate-900 placeholder-slate-400'}`}
                  placeholder="Nome da empresa"
                />
              </div>
              <div>
                <label className={`block text-sm font-medium mb-1.5 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>Setor *</label>
                <select
                  name="sector"
                  required
                  className={`w-full px-4 py-3 border rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none transition ${isDark ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-200 text-slate-900'}`}
                >
                  <option value="">Selecione...</option>
                  {SECTORS.map((s) => (
                    <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className={`border-2 border-dashed rounded-2xl p-10 text-center transition ${isDark ? 'border-slate-700 hover:border-blue-500/50' : 'border-slate-200 hover:border-blue-300'}`}>
              <Upload className={`w-8 h-8 mx-auto mb-3 ${isDark ? 'text-slate-600' : 'text-slate-300'}`} />
              <p className={`text-sm mb-2 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Arraste ou selecione seu arquivo</p>
              <p className={`text-xs mb-4 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>PDF ou Excel (DRE, Balanço Patrimonial)</p>
              <input
                type="file"
                name="file"
                accept=".pdf,.xlsx,.xls"
                className={`block mx-auto text-sm file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:font-semibold file:text-sm ${isDark ? 'text-slate-400 file:bg-blue-500/20 file:text-blue-400' : 'text-slate-500 file:bg-blue-50 file:text-blue-600 hover:file:bg-blue-100'}`}
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="mt-8 w-full bg-gradient-to-r from-blue-600 to-cyan-600 text-white py-3 rounded-xl font-semibold hover:from-blue-500 hover:to-cyan-500 transition disabled:opacity-50 shadow-lg shadow-blue-600/25"
            >
              {loading ? 'Processando...' : 'Enviar e analisar'}
            </button>
          </form>
        )}
      </main>
    </div>
  );
}
