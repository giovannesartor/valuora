import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, Calculator, TrendingUp, DollarSign, PieChart, Info, CheckCircle2, Copy, Send, ChevronDown } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import toast from 'react-hot-toast';
import api from '../lib/api';
import { usePageTitle } from '../lib/usePageTitle';

export default function WACCCalculatorPage() {
  usePageTitle('Calculadora WACC');
  const { isDark } = useTheme();
  const navigate = useNavigate();
  
  const [inputs, setInputs] = useState({
    riskFreeRate: 4.5,
    marketRiskPremium: 5.5,
    beta: 1.2,
    costOfDebt: 10.5,
    taxRate: 34,
    debtRatio: 30,
    equityRatio: 70,
  });

  const [copied, setCopied] = useState(false);
  const [analyses, setAnalyses] = useState([]);
  const [selectedAnalysisId, setSelectedAnalysisId] = useState('');
  const [applyLoading, setApplyLoading] = useState(false);

  useEffect(() => {
    api.get('/analyses/', { params: { page_size: 100, status: 'completed' } })
      .then((res) => setAnalyses(res.data.items || res.data || []))
      .catch(() => {});
  }, []);

  const handleInputChange = (field, value) => {
    setInputs(prev => ({
      ...prev,
      [field]: parseFloat(value) || 0
    }));
  };

  const calculateWACC = () => {
    const { riskFreeRate, marketRiskPremium, beta, costOfDebt, taxRate, debtRatio, equityRatio } = inputs;
    
    // Cost of Equity (CAPM)
    const costOfEquity = riskFreeRate + (beta * marketRiskPremium);
    
    // After-tax Cost of Debt
    const afterTaxCostOfDebt = costOfDebt * (1 - (taxRate / 100));
    
    // WACC Calculation
    const debtWeight = debtRatio / 100;
    const equityWeight = equityRatio / 100;
    const wacc = (debtWeight * afterTaxCostOfDebt) + (equityWeight * costOfEquity);
    
    return {
      costOfEquity,
      afterTaxCostOfDebt,
      wacc,
      debtWeight,
      equityWeight
    };
  };

  const result = calculateWACC();

  const copyResult = () => {
    const text = `Custo de Capital (WACC): ${result.wacc.toFixed(2)}%

Breakdown:
- Custo de Capital Próprio (CAPM): ${result.costOfEquity.toFixed(2)}%
- Custo de Capital de Terceiros (pós-imposto): ${result.afterTaxCostOfDebt.toFixed(2)}%
- Peso Capital Próprio: ${result.equityWeight * 100}%
- Peso Capital de Terceiros: ${result.debtWeight * 100}%

Inputs:
- Taxa Livre de Risco: ${inputs.riskFreeRate}%
- Prêmio de Risco de Mercado: ${inputs.marketRiskPremium}%
- Beta: ${inputs.beta}
- Custo da Dívida: ${inputs.costOfDebt}%
- Alíquota de Imposto: ${inputs.taxRate}%`;
    
    navigator.clipboard.writeText(text);
    setCopied(true);
    toast.success('Resultado copiado!');
    setTimeout(() => setCopied(false), 2000);
  };

  const applyToAnalysis = () => {
    if (!selectedAnalysisId) {
      toast.error('Selecione uma análise.');
      return;
    }
    navigate(`/simulador/${selectedAnalysisId}`, {
      state: { discount_rate: result.wacc.toFixed(2) }
    });
  };

  const card = `rounded-2xl border p-6 ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`;
  const muted = isDark ? 'text-slate-400' : 'text-slate-500';

  return (
    <div className="min-h-screen p-4 md:p-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <Link
            to="/dashboard"
            className={`p-2 rounded-xl transition ${isDark ? 'text-slate-400 hover:text-white hover:bg-slate-800' : 'text-slate-400 hover:text-slate-900 hover:bg-slate-100'}`}
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div className="flex items-center gap-3">
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${isDark ? 'bg-emerald-500/10' : 'bg-emerald-50'}`}>
              <Calculator className="w-6 h-6 text-emerald-600" />
            </div>
            <div>
              <h1 className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>
                Calculadora WACC
              </h1>
              <p className={`text-sm ${muted}`}>Custo Médio Ponderado de Capital</p>
            </div>
          </div>
        </div>

        {/* What is WACC? */}
        <div className={`${card} mb-6`}>
          <div className="flex items-start gap-3">
            <Info className={`w-5 h-5 mt-0.5 ${isDark ? 'text-emerald-400' : 'text-emerald-600'}`} />
            <div>
              <h3 className={`font-semibold mb-2 ${isDark ? 'text-white' : 'text-slate-900'}`}>
                O que é WACC?
              </h3>
              <p className={`text-sm leading-relaxed ${muted}`}>
                O WACC (Weighted Average Cost of Capital) é o custo médio ponderado de todas as fontes de financiamento de uma empresa.
                Ele representa a taxa de retorno mínima que uma empresa deve obter em seus investimentos para satisfazer seus acionistas e credores.
              </p>
            </div>
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          {/* Inputs */}
          <div className="space-y-4">
            <h2 className={`font-semibold mb-4 ${isDark ? 'text-white' : 'text-slate-900'}`}>Parâmetros de Entrada</h2>
            
            {/* CAPM Inputs */}
            <div className={`${card}`}>
              <div className="flex items-center gap-2 mb-4">
                <TrendingUp className="w-5 h-5 text-emerald-600" />
                <h3 className={`font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>CAPM (Custo de Capital Próprio)</h3>
              </div>
              
              <div className="space-y-4">
                <div>
                  <label className={`block text-sm font-medium mb-1.5 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                    Taxa Livre de Risco (%)
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    value={inputs.riskFreeRate}
                    onChange={(e) => handleInputChange('riskFreeRate', e.target.value)}
                    className={`w-full px-4 py-3 border rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 outline-none transition ${isDark ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-200 text-slate-900'}`}
                    placeholder="Ex: 4.5"
                  />
                  <p className={`text-xs mt-1 ${muted}`}>Geralmente baseado em títulos do tesouro (ex: Selic)</p>
                </div>

                <div>
                  <label className={`block text-sm font-medium mb-1.5 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                    Prêmio de Risco de Mercado (%)
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    value={inputs.marketRiskPremium}
                    onChange={(e) => handleInputChange('marketRiskPremium', e.target.value)}
                    className={`w-full px-4 py-3 border rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 outline-none transition ${isDark ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-200 text-slate-900'}`}
                    placeholder="Ex: 5.5"
                  />
                  <p className={`text-xs mt-1 ${muted}`}>Média histórica de 5-7% no Brasil</p>
                </div>

                <div>
                  <label className={`block text-sm font-medium mb-1.5 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                    Beta (β)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={inputs.beta}
                    onChange={(e) => handleInputChange('beta', e.target.value)}
                    className={`w-full px-4 py-3 border rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 outline-none transition ${isDark ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-200 text-slate-900'}`}
                    placeholder="Ex: 1.2"
                  />
                  <p className={`text-xs mt-1 ${muted}`}>Mede sensibilidade ao mercado (β &gt; 1 = mais arriscado)</p>
                </div>
              </div>
            </div>

            {/* Cost of Debt */}
            <div className={`${card}`}>
              <div className="flex items-center gap-2 mb-4">
                <DollarSign className="w-5 h-5 text-amber-600" />
                <h3 className={`font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>Custo da Dívida</h3>
              </div>
              
              <div className="space-y-4">
                <div>
                  <label className={`block text-sm font-medium mb-1.5 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                    Custo da Dívida (%)
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    value={inputs.costOfDebt}
                    onChange={(e) => handleInputChange('costOfDebt', e.target.value)}
                    className={`w-full px-4 py-3 border rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 outline-none transition ${isDark ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-200 text-slate-900'}`}
                    placeholder="Ex: 10.5"
                  />
                  <p className={`text-xs mt-1 ${muted}`}>Taxa média de juros paga pela empresa</p>
                </div>

                <div>
                  <label className={`block text-sm font-medium mb-1.5 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                    Alíquota de Imposto (%)
                  </label>
                  <input
                    type="number"
                    step="1"
                    value={inputs.taxRate}
                    onChange={(e) => handleInputChange('taxRate', e.target.value)}
                    className={`w-full px-4 py-3 border rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 outline-none transition ${isDark ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-200 text-slate-900'}`}
                    placeholder="Ex: 34"
                  />
                  <p className={`text-xs mt-1 ${muted}`}>No Brasil, geralmente 34% (IRPJ + CSLL)</p>
                </div>
              </div>
            </div>

            {/* Capital Structure */}
            <div className={`${card}`}>
              <div className="flex items-center gap-2 mb-4">
                <PieChart className="w-5 h-5 text-blue-600" />
                <h3 className={`font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>Estrutura de Capital</h3>
              </div>
              
              <div className="space-y-4">
                <div>
                  <label className={`block text-sm font-medium mb-1.5 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                    Peso da Dívida (%)
                  </label>
                  <input
                    type="number"
                    step="1"
                    value={inputs.debtRatio}
                    onChange={(e) => {
                      const val = parseFloat(e.target.value) || 0;
                      handleInputChange('debtRatio', val);
                      handleInputChange('equityRatio', 100 - val);
                    }}
                    className={`w-full px-4 py-3 border rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 outline-none transition ${isDark ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-200 text-slate-900'}`}
                    placeholder="Ex: 30"
                  />
                </div>

                <div>
                  <label className={`block text-sm font-medium mb-1.5 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                    Peso do Capital Próprio (%)
                  </label>
                  <input
                    type="number"
                    step="1"
                    value={inputs.equityRatio}
                    onChange={(e) => {
                      const val = parseFloat(e.target.value) || 0;
                      handleInputChange('equityRatio', val);
                      handleInputChange('debtRatio', 100 - val);
                    }}
                    className={`w-full px-4 py-3 border rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 outline-none transition ${isDark ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-200 text-slate-900'}`}
                    placeholder="Ex: 70"
                  />
                  <p className={`text-xs mt-1 ${muted}`}>Deve somar 100% com o peso da dívida</p>
                </div>
              </div>
            </div>
          </div>

          {/* Results */}
          <div className="space-y-4">
            <h2 className={`font-semibold mb-4 ${isDark ? 'text-white' : 'text-slate-900'}`}>Resultado</h2>
            
            {/* Main WACC */}
            <div className={`bg-gradient-to-br from-emerald-600 to-teal-600 rounded-2xl p-8 text-white`}>
              <div className="text-center">
                <p className="text-emerald-100 text-xs uppercase tracking-widest mb-2">WACC</p>
                <p className="text-5xl font-bold mb-2">{result.wacc.toFixed(2)}%</p>
                <p className="text-emerald-200 text-sm">Custo Médio Ponderado de Capital</p>
              </div>
            </div>

            {/* Breakdown */}
            <div className={`${card}`}>
              <h3 className={`font-semibold mb-4 ${isDark ? 'text-white' : 'text-slate-900'}`}>Detalhamento</h3>
              
              <div className="space-y-4">
                <div className={`flex items-center justify-between p-4 rounded-xl ${isDark ? 'bg-slate-800' : 'bg-slate-50'}`}>
                  <div>
                    <p className={`text-sm font-medium ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>Custo de Capital Próprio (CAPM)</p>
                    <p className={`text-xs ${muted}`}>Rf + β × (Rm - Rf)</p>
                  </div>
                  <p className={`text-xl font-bold text-emerald-600`}>
                    {result.costOfEquity.toFixed(2)}%
                  </p>
                </div>

                <div className={`flex items-center justify-between p-4 rounded-xl ${isDark ? 'bg-slate-800' : 'bg-slate-50'}`}>
                  <div>
                    <p className={`text-sm font-medium ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>Custo da Dívida (pós-imposto)</p>
                    <p className={`text-xs ${muted}`}>Kd × (1 - T)</p>
                  </div>
                  <p className={`text-xl font-bold text-amber-600`}>
                    {result.afterTaxCostOfDebt.toFixed(2)}%
                  </p>
                </div>

                <div className={`flex items-center justify-between p-4 rounded-xl ${isDark ? 'bg-slate-800' : 'bg-slate-50'}`}>
                  <div>
                    <p className={`text-sm font-medium ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>Peso Capital Próprio</p>
                  </div>
                  <p className={`text-xl font-bold ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>
                    {result.equityWeight * 100}%
                  </p>
                </div>

                <div className={`flex items-center justify-between p-4 rounded-xl ${isDark ? 'bg-slate-800' : 'bg-slate-50'}`}>
                  <div>
                    <p className={`text-sm font-medium ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>Peso Capital de Terceiros</p>
                  </div>
                  <p className={`text-xl font-bold ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>
                    {result.debtWeight * 100}%
                  </p>
                </div>
              </div>

              {/* Formula */}
              <div className={`mt-6 p-4 rounded-xl ${isDark ? 'bg-emerald-500/10 border border-emerald-500/20' : 'bg-emerald-50 border border-emerald-200'}`}>
                <p className={`text-xs font-mono ${isDark ? 'text-emerald-300' : 'text-emerald-700'}`}>
                  WACC = ({result.debtWeight * 100}% × {result.afterTaxCostOfDebt.toFixed(2)}%) + ({result.equityWeight * 100}% × {result.costOfEquity.toFixed(2)}%)
                </p>
              </div>
            </div>

            {/* Copy Button */}
            <button
              onClick={copyResult}
              className={`w-full flex items-center justify-center gap-2 px-6 py-3 rounded-xl font-medium transition ${copied ? 'bg-emerald-600 text-white' : isDark ? 'bg-slate-800 text-slate-300 hover:bg-slate-700' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
            >
              {copied ? (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  Copiado!
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4" />
                  Copiar resultado
                </>
              )}
            </button>

            {/* Apply to Analysis */}
            <div className={`${card}`}>
              <h3 className={`font-semibold mb-1 ${isDark ? 'text-white' : 'text-slate-900'}`}>Aplicar a uma análise</h3>
              <p className={`text-xs mb-3 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                Use este WACC ({result.wacc.toFixed(2)}%) como taxa de desconto no simulador de cenários.
              </p>
              {analyses.length === 0 ? (
                <p className={`text-xs italic ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Nenhuma análise concluída encontrada.</p>
              ) : (
                <div className="flex flex-col sm:flex-row gap-2">
                  <div className="relative flex-1">
                    <select
                      value={selectedAnalysisId}
                      onChange={(e) => setSelectedAnalysisId(e.target.value)}
                      className={`w-full appearance-none py-2.5 pl-3 pr-8 border rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none transition ${isDark ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-200 text-slate-900'}`}
                    >
                      <option value="">Selecionar análise…</option>
                      {analyses.map((a) => (
                        <option key={a.id} value={a.id}>{a.company_name} — {a.sector || 'Sem setor'}</option>
                      ))}
                    </select>
                    <ChevronDown className={`absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 pointer-events-none ${isDark ? 'text-slate-500' : 'text-slate-400'}`} />
                  </div>
                  <button
                    onClick={applyToAnalysis}
                    disabled={!selectedAnalysisId}
                    className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium text-white bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 disabled:opacity-40 disabled:cursor-not-allowed transition shadow-sm"
                  >
                    <Send className="w-4 h-4" />
                    Aplicar
                  </button>
                </div>
              )}
            </div>

            {/* Tips */}
            <div className={`${card}`}>
              <h3 className={`font-semibold mb-3 ${isDark ? 'text-white' : 'text-slate-900'}`}>💡 Dicas</h3>
              <ul className={`space-y-2 text-sm ${muted}`}>
                <li className="flex items-start gap-2">
                  <span className="text-emerald-500 mt-0.5">•</span>
                  WACC entre 8-15% é considerado saudável para empresas brasileiras
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-emerald-500 mt-0.5">•</span>
                  Use o WACC como taxa de desconto no método DCF
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-emerald-500 mt-0.5">•</span>
                  Empresas mais arriscadas têm WACC mais alto
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-emerald-500 mt-0.5">•</span>
                  Compare o WACC com outras empresas do mesmo setor
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
