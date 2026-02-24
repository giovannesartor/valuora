import { useState, useEffect } from 'react';

const STORAGE_KEY = 'qv:onboarding_done';

const STEPS = [
  {
    target: '[data-tour="nova-analise"]',
    title: 'Bem-vindo ao QuantoVale! 👋',
    description:
      'Comece criando a sua primeira análise. Clique aqui para valuar qualquer empresa em minutos.',
    placement: 'bottom',
  },
  {
    target: '[data-tour="kpis"]',
    title: 'Suas métricas em tempo real',
    description:
      'Aqui você acompanha o total de análises, valor médio estimado, máximo e score de risco médio.',
    placement: 'bottom',
  },
  {
    target: '[data-tour="filtros"]',
    title: 'Pesquise e filtre análises',
    description:
      'Use a barra de busca e os filtros para encontrar análises por setor, status ou data.',
    placement: 'bottom',
  },
  {
    target: '[data-tour="sidebar"]',
    title: 'Menu de navegação',
    description:
      'Acesse o Comparador, Simulador de Cenários, Configurações e mais através do menu lateral.',
    placement: 'right',
  },
  {
    target: null,
    title: 'Tudo pronto! 🚀',
    description:
      'Você está pronto para começar. Crie sua primeira análise agora e descubra o valor real do seu negócio.',
    placement: 'center',
  },
];

function getRect(selector) {
  if (!selector) return null;
  const el = document.querySelector(selector);
  if (!el) return null;
  const r = el.getBoundingClientRect();
  return { top: r.top, left: r.left, width: r.width, height: r.height };
}

export default function OnboardingTour({ totalAnalyses }) {
  const [step, setStep] = useState(0);
  const [visible, setVisible] = useState(false);
  const [rect, setRect] = useState(null);
  const [ready, setReady] = useState(false);

  // Show if user has 0 analyses and hasn't dismissed
  useEffect(() => {
    if (totalAnalyses !== 0) return;
    try {
      if (localStorage.getItem(STORAGE_KEY)) return;
    } catch {}
    // Small delay so the page renders first
    const t = setTimeout(() => setVisible(true), 800);
    return () => clearTimeout(t);
  }, [totalAnalyses]);

  // Recompute highlight rect when step changes
  useEffect(() => {
    if (!visible) return;
    const target = STEPS[step]?.target;
    const r = getRect(target);
    setRect(r);
    setReady(true);
  }, [step, visible]);

  function dismiss() {
    try { localStorage.setItem(STORAGE_KEY, '1'); } catch {}
    setVisible(false);
  }

  function next() {
    if (step < STEPS.length - 1) {
      setReady(false);
      setStep(s => s + 1);
    } else {
      dismiss();
    }
  }

  function prev() {
    if (step > 0) {
      setReady(false);
      setStep(s => s - 1);
    }
  }

  if (!visible) return null;

  const current = STEPS[step];
  const isCenter = current.placement === 'center' || !rect;

  // Tooltip positioning relative to the highlighted element
  const PADDING = 12;
  let tooltipStyle = {};
  if (!isCenter && rect) {
    if (current.placement === 'bottom') {
      tooltipStyle = {
        top: rect.top + rect.height + PADDING + window.scrollY,
        left: Math.max(12, rect.left + rect.width / 2 - 160),
      };
    } else if (current.placement === 'right') {
      tooltipStyle = {
        top: rect.top + window.scrollY,
        left: rect.left + rect.width + PADDING,
      };
    }
  }

  return (
    <>
      {/* Overlay */}
      <div
        className="fixed inset-0 z-[9998] pointer-events-none"
        style={{ background: 'rgba(0,0,0,0.55)' }}
      />

      {/* Spotlight cutout using box-shadow */}
      {rect && !isCenter && (
        <div
          className="fixed z-[9999] pointer-events-none rounded-xl ring-2 ring-emerald-400"
          style={{
            top: rect.top - 4 + window.scrollY,
            left: rect.left - 4,
            width: rect.width + 8,
            height: rect.height + 8,
            boxShadow: '0 0 0 9999px rgba(0,0,0,0.0)',
          }}
        />
      )}

      {/* Tooltip card */}
      <div
        className={`fixed z-[10000] w-80 rounded-2xl shadow-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 p-5 transition-opacity duration-200 ${ready ? 'opacity-100' : 'opacity-0'}`}
        style={
          isCenter
            ? { top: '50%', left: '50%', transform: 'translate(-50%, -50%)' }
            : tooltipStyle
        }
      >
        {/* Step indicators */}
        <div className="flex items-center gap-1 mb-3">
          {STEPS.map((_, i) => (
            <div
              key={i}
              className={`h-1 rounded-full transition-all ${i === step ? 'w-6 bg-emerald-500' : 'w-2 bg-slate-200 dark:bg-slate-700'}`}
            />
          ))}
        </div>

        <h3 className="font-bold text-slate-900 dark:text-white text-base mb-1">{current.title}</h3>
        <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed mb-5">{current.description}</p>

        <div className="flex items-center justify-between">
          <button
            onClick={dismiss}
            className="text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition"
          >
            Pular tour
          </button>
          <div className="flex gap-2">
            {step > 0 && (
              <button
                onClick={prev}
                className="text-sm px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition"
              >
                Anterior
              </button>
            )}
            <button
              onClick={next}
              className="text-sm px-4 py-1.5 rounded-lg bg-emerald-600 text-white font-medium hover:bg-emerald-500 transition"
            >
              {step === STEPS.length - 1 ? 'Começar!' : 'Próximo'}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
