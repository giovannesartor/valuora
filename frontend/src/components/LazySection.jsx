import { useState, useEffect, useRef } from 'react';

// ─── Renderização lazy — adia seções fora da tela ──────────
export default function LazySection({ children, minHeight = '400px' }) {
  const [visible, setVisible] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setVisible(true); observer.disconnect(); } },
      { rootMargin: '300px' }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return <div ref={ref}>{visible ? children : <div style={{ minHeight }} />}</div>;
}
