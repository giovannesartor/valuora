import { useState, useRef, useCallback } from 'react';

/**
 * BeforeAfterSlider — A draggable comparison slider.
 * Usage:
 *   <BeforeAfterSlider
 *     before={<div>Before content</div>}
 *     after={<div>After content</div>}
 *     height={300}
 *   />
 */
export default function BeforeAfterSlider({
  before,
  after,
  height = 300,
  initialPosition = 50,
  className = '',
  isDark = false,
}) {
  const [position, setPosition] = useState(initialPosition);
  const containerRef = useRef(null);
  const dragging = useRef(false);

  const updatePosition = useCallback((clientX) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(clientX - rect.left, rect.width));
    setPosition((x / rect.width) * 100);
  }, []);

  const handleMouseDown = (e) => {
    e.preventDefault();
    dragging.current = true;
    updatePosition(e.clientX);
    const handleMouseMove = (e) => { if (dragging.current) updatePosition(e.clientX); };
    const handleMouseUp = () => { dragging.current = false; window.removeEventListener('mousemove', handleMouseMove); window.removeEventListener('mouseup', handleMouseUp); };
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  };

  const handleTouchStart = (e) => {
    dragging.current = true;
    updatePosition(e.touches[0].clientX);
  };
  const handleTouchMove = (e) => { if (dragging.current) updatePosition(e.touches[0].clientX); };
  const handleTouchEnd = () => { dragging.current = false; };

  return (
    <div
      ref={containerRef}
      className={`relative overflow-hidden rounded-2xl select-none cursor-col-resize ${className}`}
      style={{ height }}
      onMouseDown={handleMouseDown}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* After (full width background) */}
      <div className="absolute inset-0">
        {after}
      </div>

      {/* Before (clipped) */}
      <div
        className="absolute inset-0 overflow-hidden"
        style={{ width: `${position}%` }}
      >
        <div style={{ width: containerRef.current?.offsetWidth || '100%', minWidth: '100%' }}>
          {before}
        </div>
      </div>

      {/* Slider handle */}
      <div
        className="absolute top-0 bottom-0 z-10"
        style={{ left: `${position}%`, transform: 'translateX(-50%)' }}
      >
        <div className={`w-0.5 h-full ${isDark ? 'bg-white/80' : 'bg-slate-900/80'}`} />
        <div
          className={`absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-8 h-8 rounded-full border-2 flex items-center justify-center shadow-lg ${
            isDark ? 'bg-slate-800 border-white/60' : 'bg-white border-slate-900/60'
          }`}
        >
          <svg className={`w-4 h-4 ${isDark ? 'text-white' : 'text-slate-900'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 9l4-4 4 4M8 15l4 4 4-4" />
          </svg>
        </div>
      </div>

      {/* Labels */}
      <div className="absolute top-3 left-3 z-10 px-2 py-1 rounded-lg bg-black/60 text-white text-[10px] font-bold uppercase tracking-wider">
        Before
      </div>
      <div className="absolute top-3 right-3 z-10 px-2 py-1 rounded-lg bg-black/60 text-white text-[10px] font-bold uppercase tracking-wider">
        After
      </div>
    </div>
  );
}
