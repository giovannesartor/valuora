import { useRef, useState, useEffect, useCallback } from 'react';

/**
 * Scroll-triggered count-up animation.
 *
 * @param {number}  end        Target number
 * @param {string}  [suffix]   Text after the number (e.g. "+", "%")
 * @param {string}  [prefix]   Text before the number (e.g. "$")
 * @param {number}  [duration] Animation duration in ms (default 800)
 * @param {string}  [separator] Thousands separator (e.g. ",")
 * @param {number}  [decimals] Decimal places (default 0)
 * @param {string}  [className] CSS classes for the wrapper span
 */
export default function CountUp({
  end,
  suffix = '',
  prefix = '',
  duration = 800,
  separator = '',
  decimals = 0,
  className = '',
}) {
  const ref = useRef(null);
  const [value, setValue] = useState(0);
  const [triggered, setTriggered] = useState(false);

  // easeOutCubic for a satisfying deceleration
  const ease = useCallback((t) => 1 - Math.pow(1 - t, 3), []);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !triggered) {
          setTriggered(true);
          observer.disconnect();
        }
      },
      { threshold: 0.3 },
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [triggered]);

  useEffect(() => {
    if (!triggered) return;

    let start = null;
    let rafId;

    const step = (timestamp) => {
      if (!start) start = timestamp;
      const elapsed = timestamp - start;
      const progress = Math.min(elapsed / duration, 1);
      const easedProgress = ease(progress);

      setValue(easedProgress * end);

      if (progress < 1) {
        rafId = requestAnimationFrame(step);
      } else {
        setValue(end);
      }
    };

    rafId = requestAnimationFrame(step);
    return () => cancelAnimationFrame(rafId);
  }, [triggered, end, duration, ease]);

  const formatNumber = (n) => {
    const fixed = n.toFixed(decimals);
    if (!separator) return fixed;
    const [intPart, decPart] = fixed.split('.');
    const withSep = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, separator);
    return decPart !== undefined ? `${withSep}.${decPart}` : withSep;
  };

  return (
    <span ref={ref} className={className}>
      {prefix}{formatNumber(value)}{suffix}
    </span>
  );
}
