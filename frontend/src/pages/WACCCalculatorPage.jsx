import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, Calculator, TrendingUp, DollarSign, PieChart, Info, CheckCircle2, Copy, Send, ChevronDown, Plus } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import toast from 'react-hot-toast';
import api from '../lib/api';
import { usePageTitle } from '../lib/usePageTitle';

export default function WACCCalculatorPage() {
  usePageTitle('WACC Calculator');
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
    const text = `Cost of Capital (WACC): ${result.wacc.toFixed(2)}%

Breakdown:
- Cost of Equity (CAPM): ${result.costOfEquity.toFixed(2)}%
- Cost of Capital de Terceiros (pós-imposto): ${result.afterTaxCostOfDebt.toFixed(2)}%
- Equity Weight: ${result.equityWeight * 100}%
- Debt Weight: ${result.debtWeight * 100}%

Inputs:
- Risk-Free Rate: ${inputs.riskFreeRate}%
- Market Risk Premium: ${inputs.marketRiskPremium}%
- Beta: ${inputs.beta}
- Cost of Debt: ${inputs.costOfDebt}%
- Tax Rate: ${inputs.taxRate}%`;
    
    navigator.clipboard.writeText(text);
    setCopied(true);
    toast.success('Result copied!');
    setTimeout(() => setCopied(false), 2000);
  };

  const applyToAnalysis = () => {
    if (!selectedAnalysisId) {
      toast.error('Select an analysis.');
      return;
    }
    navigate(`/simulator/${selectedAnalysisId}`, {
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
              <p className={`text-sm ${muted}`}>Weighted Average Cost of Capital</p>
            </div>
          </div>
        </div>

        {/* What is WACC? */}
        <div className={`${card} mb-6`}>
          <div className="flex items-start gap-3">
            <Info className={`w-5 h-5 mt-0.5 ${isDark ? 'text-emerald-400' : 'text-emerald-600'}`} />
            <div>
              <h3 className={`font-semibold mb-2 ${isDark ? 'text-white' : 'text-slate-900'}`}>
                What is WACC?
              </h3>
              <p className={`text-sm leading-relaxed ${muted}`}>
                WACC (Weighted Average Cost of Capital) represents the average cost of all sources of financing for a company.
                It is the minimum rate of return a company must earn on its investments to satisfy shareholders and creditors.
              </p>
            </div>
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          {/* Inputs */}
          <div className="space-y-4">
            <h2 className={`font-semibold mb-4 ${isDark ? 'text-white' : 'text-slate-900'}`}>Input Parameters</h2>
            
            {/* CAPM Inputs */}
            <div className={`${card}`}>
              <div className="flex items-center gap-2 mb-4">
                <TrendingUp className="w-5 h-5 text-emerald-600" />
                <h3 className={`font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>CAPM (Cost of Equity)</h3>
              </div>
              
              <div className="space-y-4">
                <div>
                  <label className={`block text-sm font-medium mb-1.5 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                    Risk-Free Rate (%)
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    value={inputs.riskFreeRate}
                    onChange={(e) => handleInputChange('riskFreeRate', e.target.value)}
                    className={`w-full px-4 py-3 border rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 outline-none transition ${isDark ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-200 text-slate-900'}`}
                    placeholder="Ex: 4.5"
                  />
                  <p className={`text-xs mt-1 ${muted}`}>Based on US Treasury yields (e.g., 10-Year T-Note)</p>
                </div>

                <div>
                  <label className={`block text-sm font-medium mb-1.5 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                    Market Risk Premium (%)
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    value={inputs.marketRiskPremium}
                    onChange={(e) => handleInputChange('marketRiskPremium', e.target.value)}
                    className={`w-full px-4 py-3 border rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 outline-none transition ${isDark ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-200 text-slate-900'}`}
                    placeholder="Ex: 5.5"
                  />
                  <p className={`text-xs mt-1 ${muted}`}>Historical average: 5-7% (US ERP)</p>
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
                  <p className={`text-xs mt-1 ${muted}`}>Measures market sensitivity (β &gt; 1 = higher risk)</p>
                </div>
              </div>
            </div>

            {/* Cost of Debt */}
            <div className={`${card}`}>
              <div className="flex items-center gap-2 mb-4">
                <DollarSign className="w-5 h-5 text-amber-600" />
                <h3 className={`font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>Cost of Debt</h3>
              </div>
              
              <div className="space-y-4">
                <div>
                  <label className={`block text-sm font-medium mb-1.5 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                    Cost of Debt (%)
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    value={inputs.costOfDebt}
                    onChange={(e) => handleInputChange('costOfDebt', e.target.value)}
                    className={`w-full px-4 py-3 border rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 outline-none transition ${isDark ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-200 text-slate-900'}`}
                    placeholder="Ex: 10.5"
                  />
                  <p className={`text-xs mt-1 ${muted}`}>Average interest rate paid by the company</p>
                </div>

                <div>
                  <label className={`block text-sm font-medium mb-1.5 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                    Tax Rate (%)
                  </label>
                  <input
                    type="number"
                    step="1"
                    value={inputs.taxRate}
                    onChange={(e) => handleInputChange('taxRate', e.target.value)}
                    className={`w-full px-4 py-3 border rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 outline-none transition ${isDark ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-200 text-slate-900'}`}
                    placeholder="Ex: 25"
                  />
                  <p className={`text-xs mt-1 ${muted}`}>US combined federal + state rate (~21-27%)</p>
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
                    Debt Weight (%)
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
                    Equity Weight (%)
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
                  <p className={`text-xs mt-1 ${muted}`}>Must sum to 100% with debt weight</p>
                </div>
              </div>
            </div>
          </div>

          {/* Results */}
          <div className="space-y-4">
            <h2 className={`font-semibold mb-4 ${isDark ? 'text-white' : 'text-slate-900'}`}>Result</h2>
            
            {/* Main WACC */}
            <div className={`bg-gradient-to-br from-emerald-600 to-teal-600 rounded-2xl p-8 text-white`}>
              <div className="text-center">
                <p className="text-emerald-100 text-xs uppercase tracking-widest mb-2">WACC</p>
                <p className="text-5xl font-bold mb-2">{result.wacc.toFixed(2)}%</p>
                <p className="text-emerald-200 text-sm">Weighted Average Cost of Capital</p>
              </div>
            </div>

            {/* Breakdown */}
            <div className={`${card}`}>
              <h3 className={`font-semibold mb-4 ${isDark ? 'text-white' : 'text-slate-900'}`}>Detalhamento</h3>
              
              <div className="space-y-4">
                <div className={`flex items-center justify-between p-4 rounded-xl ${isDark ? 'bg-slate-800' : 'bg-slate-50'}`}>
                  <div>
                    <p className={`text-sm font-medium ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>Cost of Equity (CAPM)</p>
                    <p className={`text-xs ${muted}`}>Rf + β × (Rm - Rf)</p>
                  </div>
                  <p className={`text-xl font-bold text-emerald-600`}>
                    {result.costOfEquity.toFixed(2)}%
                  </p>
                </div>

                <div className={`flex items-center justify-between p-4 rounded-xl ${isDark ? 'bg-slate-800' : 'bg-slate-50'}`}>
                  <div>
                    <p className={`text-sm font-medium ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>Cost of Debt (pós-imposto)</p>
                    <p className={`text-xs ${muted}`}>Kd × (1 - T)</p>
                  </div>
                  <p className={`text-xl font-bold text-amber-600`}>
                    {result.afterTaxCostOfDebt.toFixed(2)}%
                  </p>
                </div>

                <div className={`flex items-center justify-between p-4 rounded-xl ${isDark ? 'bg-slate-800' : 'bg-slate-50'}`}>
                  <div>
                    <p className={`text-sm font-medium ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>Equity Weight</p>
                  </div>
                  <p className={`text-xl font-bold ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>
                    {result.equityWeight * 100}%
                  </p>
                </div>

                <div className={`flex items-center justify-between p-4 rounded-xl ${isDark ? 'bg-slate-800' : 'bg-slate-50'}`}>
                  <div>
                    <p className={`text-sm font-medium ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>Debt Weight</p>
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
                  Copy result
                </>
              )}
            </button>

            {/* Apply to Analysis */}
            <div className={`${card}`}>
              <h3 className={`font-semibold mb-1 ${isDark ? 'text-white' : 'text-slate-900'}`}>Apply to an analysis</h3>
              <p className={`text-xs mb-3 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                Use this WACC ({result.wacc.toFixed(2)}%) as discount rate in the scenario simulator.
              </p>
              {analyses.length === 0 ? (
                <p className={`text-xs italic ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>No completed analysis found.</p>
              ) : (
                <div className="flex flex-col sm:flex-row gap-2">
                  <div className="relative flex-1">
                    <select
                      value={selectedAnalysisId}
                      onChange={(e) => setSelectedAnalysisId(e.target.value)}
                      className={`w-full appearance-none py-2.5 pl-3 pr-8 border rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none transition ${isDark ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-200 text-slate-900'}`}
                    >
                      <option value="">Select analysis…</option>
                      {analyses.map((a) => (
                        <option key={a.id} value={a.id}>{a.company_name} — {a.sector || 'No sector'}</option>
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
              <button
                onClick={() => navigate('/new-analysis', { state: { wacc: result.wacc.toFixed(2) } })}
                className="mt-3 w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium text-white bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 transition"
              >
                <Plus className="w-4 h-4" />
                Create new analysis with this WACC
              </button>
            </div>

            {/* Tips */}
            <div className={`${card}`}>
              <h3 className={`font-semibold mb-3 ${isDark ? 'text-white' : 'text-slate-900'}`}>💡 Dicas</h3>
              <ul className={`space-y-2 text-sm ${muted}`}>
                <li className="flex items-start gap-2">
                  <span className="text-emerald-500 mt-0.5">•</span>
                  WACC of 8-15% is considered healthy for most companies
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-emerald-500 mt-0.5">•</span>
                  Use the WACC as the discount rate in the DCF method
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
