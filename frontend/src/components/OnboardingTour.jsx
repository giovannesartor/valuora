import { useState, useEffect, useCallback } from 'react';

const STORAGE_KEY = 'qv:onboarding_done';
const TOOLTIP_W = 320; // w-80
const GAP = 14;        // gap between element and tooltip
const SCREEN_PAD = 12; // min distance from viewport edge

const STEPS = [
  {
    target: '[data-tour="nova-analise"]',
    title: 'Bem-vindo ao QuantoVale! 👋',
    description:
      'Comece criando a sua primeira análise. Clique neste botão para valuar qualquer empresa em minutos.',
    placement: 'bottom',
  },
  {
    target: '[data-tour="kpis"]',
    title: 'Suas métricas em tempo real',
    description:
      'Esses cards mostram o total de análises, valor médio estimado, o máximo alcançado e o score de risco médio da sua carteira.',
    placement: 'bottom',
  },
  {
    target: '[data-tour="filtros"]',
    title: 'Pesquise e filtre análises',
    description:
      'Use a barra de busca e os filtros para encontrar análises por setor, status ou data rapidamente.',
    placement: 'top',
  },
  {
    target: '[data-tour="sidebar"]',
    title: 'Menu de navegação',
    description:
      'Acesse o Comparador, Simulador de Cenários, Calculadora WACC, Configurações e mais pelo menu lateral.',
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

function getViewportRect(selector) {
  if (!selector) return null;
  const el = document.querySelector(selector);
  if (!el) return null;
  const r = el.getBoundingClientRect();
  // Only return rect if the element is actually visible in the viewport
  if (r.width === 0 && r.height === 0) return null;
  return { top: r.top, left: r.left, width: r.width, height: r.height };
}

/** Clamp tooltip left so it stays within [SCREEN_PAD, vw - TOOLTIP_W - SCREEN_PAD] */
function clampLeft(desiredLeft) {
  const vw = window.innerWidth;
  return Math.min(vw - TOOLTIP_W - SCREEN_PAD, Math.max(SCREEN_PAD, desiredLeft));
}

/** Compute tooltip {top, left} for a given placement and element rect.
 *  All coords are viewport-relative (for position:fixed). */
function computeTooltipPos(placement, rect) {
  const vh = window.innerHeight;
  const idealLeft = rect.left + rect.width / 2 - TOOLTIP_W / 2;

  if (placement === 'bottom') {
    const top = rect.top + rect.height + GAP;
    // If tooltip would overflow bottom, flip to top
    if (top + 160 > vh) {
      return { top: Math.max(SCREEN_PAD, rect.top - 160 - GAP), left: clampLeft(idealLeft) };
    }
    return { top, left: clampLeft(idealLeft) };
  }

  if (placement === 'top') {
    const top = rect.top - 170 - GAP;
    if (top < SCREEN_PAD) {
      // flip to bottom
      return { top: rect.top + rect.height + GAP, left: clampLeft(idealLeft) };
    }
    return { top: Math.max(SCREEN_PAD, top), left: clampLeft(idealLeft) };
  }

  if (placement === 'right') {
    const left = rect.left + rect.width + GAP;
    const top = Math.min(vh - 200, Math.max(SCREEN_PAD, rect.top));
    // If tooltip would overflow right, flip to bottom
    if (left + TOOLTIP_W > window.innerWidth - SCREEN_PAD) {
      return { top: rect.top + rect.height + GAP, left: clampLeft(idealLeft) };
    }
    return { top, left };
  }

  return null;
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
    const t = setTimeout(() => setVisible(true), 800);
    return () => clearTimeout(t);
  }, [totalAnalyses]);

  const refreshRect = useCallback(() => {
    if (!visible) return;
    const target = STEPS[step]?.target;
    if (!target) { setRect(null); setReady(true); return; }
    // Scroll target into view first so getRect is accurate
    const el = document.querySelector(target);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    // Small delay to let scroll settle
    setTimeout(() => {
      setRect(getViewportRect(target));
      setReady(true);
    }, 150);
  }, [step, visible]);

  useEffect(() => {
    setReady(false);
    refreshRect();
  }, [refreshRect]);

  // Re-calculate on resize
  useEffect(() => {
    if (!visible) return;
    const onResize = () => refreshRect();
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [visible, refreshRect]);

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

  // Tooltip position (viewport-relative = perfect for position:fixed)
  let tooltipStyle = {};
  if (!isCenter && rect) {
    const pos = computeTooltipPos(current.placement, rect);
    if (pos) tooltipStyle = pos;
  }

  // Spotlight: slight padding around element
  const SP = 6;
  const spotStyle = rect && !isCenter ? {
    top: rect.top - SP,
    left: rect.left - SP,
    width: rect.width + SP * 2,
    height: rect.height + SP * 2,
  } : null;

  return (
    <>
      {/* Dark overlay — poured UNDER spotlight so spotlight cuts through */}
      <div className="fixed inset-0 z-[9997] pointer-events-none" style={{ background: 'rgba(0,0,0,0.6)' }} />

      {/* Spotlight: box-shadow creates the dark overlay WITH a visible hole */}
      {spotStyle && (
        <div
          className="fixed z-[9998] pointer-events-none rounded-xl"
          style={{
            ...spotStyle,
            boxShadow: '0 0 0 9999px rgba(0,0,0,0.6), 0 0 0 3px #10b981',
          }}
        />
      )}

      {/* Tooltip card */}
      <div
        className={`fixed z-[10000] rounded-2xl shadow-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 p-5 transition-opacity duration-300 ${ready ? 'opacity-100' : 'opacity-0'}`}
        style={{
          width: TOOLTIP_W,
          ...(isCenter
            ? { top: '50%', left: '50%', transform: 'translate(-50%, -50%)' }
            : tooltipStyle),
        }}
      >
        {/* Step indicators */}
        <div className="flex items-center gap-1 mb-3">
          {STEPS.map((_, i) => (
            <div
              key={i}
              className={`h-1.5 rounded-full transition-all duration-300 ${i === step ? 'w-8 bg-emerald-500' : 'w-2 bg-slate-200 dark:bg-slate-700'}`}
            />
          ))}
          <span className="ml-auto text-xs text-slate-400">{step + 1}/{STEPS.length}</span>
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
                ← Anterior
              </button>
            )}
            <button
              onClick={next}
              className="text-sm px-4 py-1.5 rounded-lg bg-emerald-600 text-white font-medium hover:bg-emerald-500 transition"
            >
              {step === STEPS.length - 1 ? 'Começar! 🚀' : 'Próximo →'}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
