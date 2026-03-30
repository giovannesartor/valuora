import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useI18n } from '../lib/i18n';
import { useNavigate } from 'react-router-dom';
import {
  Sparkles, TrendingUp, BarChart3, Shield,
  Calculator, ChevronRight, ChevronLeft, X, Rocket,
} from 'lucide-react';

const STORAGE_KEY = 'vl:onboarding_wizard_done';

const STEPS = [
  {
    icon: Sparkles,
    titleKey: 'wiz_step1_title',
    descKey: 'wiz_step1_desc',
    color: 'emerald',
    fallbackTitle: 'Welcome to Valuora',
    fallbackDesc: 'The most advanced business valuation platform. We use institutional-grade methodologies to estimate the fair value of any company.',
  },
  {
    icon: Calculator,
    titleKey: 'wiz_step2_title',
    descKey: 'wiz_step2_desc',
    color: 'blue',
    fallbackTitle: 'How We Value Companies',
    fallbackDesc: 'We combine 8+ methods: DCF (Discounted Cash Flow), Scorecard, Berkus Checklist, Venture Capital Method, Multiples, First Chicago, and Monte Carlo simulation — all in one click.',
  },
  {
    icon: TrendingUp,
    titleKey: 'wiz_step3_title',
    descKey: 'wiz_step3_desc',
    color: 'purple',
    fallbackTitle: 'What You\'ll Get',
    fallbackDesc: 'Equity value with confidence range, risk assessment, sector benchmarking, investor readiness score, financial health radar, AI-powered insights, and interactive charts.',
  },
  {
    icon: BarChart3,
    titleKey: 'wiz_step4_title',
    descKey: 'wiz_step4_desc',
    color: 'amber',
    fallbackTitle: 'Enter Your Data',
    fallbackDesc: 'You only need basic financial data: revenue, net margin, growth rate, sector, and a few qualitative questions. The engine handles the rest with Damodaran data and real-time market rates.',
  },
  {
    icon: Shield,
    titleKey: 'wiz_step5_title',
    descKey: 'wiz_step5_desc',
    color: 'rose',
    fallbackTitle: 'Trusted & Secure',
    fallbackDesc: 'Your data is encrypted, never shared, and only used for your valuation. Results are comparable to reports from Big 4 consulting firms.',
  },
];

const colorMap = {
  emerald: { bg: 'bg-emerald-500/10', text: 'text-emerald-500', ring: 'ring-emerald-500/20' },
  blue: { bg: 'bg-blue-500/10', text: 'text-blue-500', ring: 'ring-blue-500/20' },
  purple: { bg: 'bg-purple-500/10', text: 'text-purple-500', ring: 'ring-purple-500/20' },
  amber: { bg: 'bg-amber-500/10', text: 'text-amber-500', ring: 'ring-amber-500/20' },
  rose: { bg: 'bg-rose-500/10', text: 'text-rose-500', ring: 'ring-rose-500/20' },
};

export default function OnboardingWizard({ analysisCount = 0 }) {
  const { t } = useI18n();
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const done = localStorage.getItem(STORAGE_KEY);
    if (!done && analysisCount === 0) {
      const timer = setTimeout(() => setVisible(true), 800);
      return () => clearTimeout(timer);
    }
  }, [analysisCount]);

  const handleClose = () => {
    setVisible(false);
    localStorage.setItem(STORAGE_KEY, '1');
  };

  const handleFinish = () => {
    handleClose();
    navigate('/new-analysis');
  };

  if (!visible) return null;

  const current = STEPS[step];
  const Icon = current.icon;
  const colors = colorMap[current.color];
  const isLast = step === STEPS.length - 1;

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
          onClick={handleClose}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            transition={{ duration: 0.3, ease: [0.25, 0.1, 0.25, 1] }}
            className="relative w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800"
            onClick={e => e.stopPropagation()}
          >
            {/* Close button */}
            <button
              onClick={handleClose}
              className="absolute top-4 right-4 z-10 p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-white transition"
            >
              <X className="w-5 h-5" />
            </button>

            {/* Content */}
            <div className="p-8 pt-10">
              <AnimatePresence mode="wait">
                <motion.div
                  key={step}
                  initial={{ opacity: 0, x: 30 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -30 }}
                  transition={{ duration: 0.25 }}
                  className="text-center"
                >
                  <div className={`inline-flex items-center justify-center w-16 h-16 rounded-2xl ${colors.bg} ring-4 ${colors.ring} mb-6`}>
                    <Icon className={`w-8 h-8 ${colors.text}`} />
                  </div>
                  <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-3">
                    {t(current.titleKey) || current.fallbackTitle}
                  </h2>
                  <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed max-w-md mx-auto">
                    {t(current.descKey) || current.fallbackDesc}
                  </p>
                </motion.div>
              </AnimatePresence>
            </div>

            {/* Progress dots + navigation */}
            <div className="px-8 pb-8 flex items-center justify-between">
              {/* Dots */}
              <div className="flex gap-1.5">
                {STEPS.map((_, i) => (
                  <button
                    key={i}
                    onClick={() => setStep(i)}
                    className={`w-2 h-2 rounded-full transition-all duration-300 ${
                      i === step
                        ? 'w-6 bg-emerald-500'
                        : i < step
                        ? 'bg-emerald-300 dark:bg-emerald-700'
                        : 'bg-slate-200 dark:bg-slate-700'
                    }`}
                  />
                ))}
              </div>

              {/* Buttons */}
              <div className="flex gap-2">
                {step > 0 && (
                  <button
                    onClick={() => setStep(s => s - 1)}
                    className="flex items-center gap-1 px-3 py-2 text-sm font-medium rounded-xl text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-white transition"
                  >
                    <ChevronLeft className="w-4 h-4" />
                    {t('wiz_back') || 'Back'}
                  </button>
                )}
                {isLast ? (
                  <button
                    onClick={handleFinish}
                    className="flex items-center gap-2 px-5 py-2.5 text-sm font-semibold rounded-xl bg-emerald-600 text-white hover:bg-emerald-700 transition shadow-lg shadow-emerald-500/20"
                  >
                    <Rocket className="w-4 h-4" />
                    {t('wiz_start') || 'Create My First Analysis'}
                  </button>
                ) : (
                  <button
                    onClick={() => setStep(s => s + 1)}
                    className="flex items-center gap-1 px-5 py-2.5 text-sm font-semibold rounded-xl bg-emerald-600 text-white hover:bg-emerald-700 transition shadow-lg shadow-emerald-500/20"
                  >
                    {t('wiz_next') || 'Next'}
                    <ChevronRight className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
