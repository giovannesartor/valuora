import { useRef, useEffect } from 'react';

// ─── Emerald Neural Network — premium animated background ────
export default function EmeraldParticles({ isDark }) {
  const canvasRef = useRef(null);
  const mouseRef  = useRef({ x: -9999, y: -9999 });
  const animRef   = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    // Respeitar preferência de movimento do usuário
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const ctx = canvas.getContext('2d');

    // ── DPR-aware resize ─────────────────────────────────────
    const dpr = window.devicePixelRatio || 1;
    const resize = () => {
      canvas.width  = canvas.offsetWidth  * dpr;
      canvas.height = canvas.offsetHeight * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    window.addEventListener('resize', resize);

    const W = () => canvas.offsetWidth;
    const H = () => canvas.offsetHeight;

    // ── Build nodes ──────────────────────────────────────────
    const baseCount = Math.min(65, Math.max(30, Math.floor((W() * H()) / 10000)));
    const nodes = Array.from({ length: baseCount }, (_, i) => {
      const isHub = i < Math.floor(baseCount * 0.14);
      return {
        x:     Math.random() * W(),
        y:     Math.random() * H(),
        vx:    (Math.random() - 0.5) * (isHub ? 0.18 : 0.28),
        vy:    (Math.random() - 0.5) * (isHub ? 0.18 : 0.28),
        r:     isHub ? 3.5 + Math.random() * 2   : 1.2 + Math.random() * 1.8,
        pulse: Math.random() * Math.PI * 2,
        pSpeed:isHub ? 0.022 : 0.038 + Math.random() * 0.022,
        isHub,
        depth: Math.random(),
      };
    });

    // ── Signal packets that travel along edges ───────────────
    const packets = [];
    const spawnPacket = () => {
      const viable = [];
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const d = Math.hypot(nodes[i].x - nodes[j].x, nodes[i].y - nodes[j].y);
          if (d < 140) viable.push([i, j, d]);
        }
      }
      if (!viable.length) return;
      const [ai, bi] = viable[Math.floor(Math.random() * viable.length)];
      packets.push({ ai, bi, t: 0, speed: 0.006 + Math.random() * 0.008 });
    };
    for (let k = 0; k < 6; k++) spawnPacket();

    const MAX_DIST = 145;
    const SAT = 80;
    const bright = isDark
      ? (d) => 55 + d * 22
      : (d) => 5 + d * 6;

    const frame = { n: 0 };

    const draw = () => {
      frame.n++;
      const w = W();
      const h = H();
      ctx.clearRect(0, 0, w, h);

      const mx = mouseRef.current.x;
      const my = mouseRef.current.y;
      for (const n of nodes) {
        const dx = mx - n.x;
        const dy = my - n.y;
        const md = Math.hypot(dx, dy);
        if (md < 200 && md > 1) {
          n.vx += (dx / md) * 0.006;
          n.vy += (dy / md) * 0.006;
        }
        const spd = Math.hypot(n.vx, n.vy);
        const cap = n.isHub ? 0.5 : 0.7;
        if (spd > cap) { n.vx = (n.vx / spd) * cap; n.vy = (n.vy / spd) * cap; }

        n.x += n.vx;
        n.y += n.vy;
        n.pulse += n.pSpeed;

        if (n.x < 0) { n.x = 0; n.vx = Math.abs(n.vx); }
        if (n.x > w) { n.x = w; n.vx = -Math.abs(n.vx); }
        if (n.y < 0) { n.y = 0; n.vy = Math.abs(n.vy); }
        if (n.y > h) { n.y = h; n.vy = -Math.abs(n.vy); }
      }

      // ── Draw edges ───────────────────────────────────────────
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const a = nodes[i], b = nodes[j];
          const dist = Math.hypot(a.x - b.x, a.y - b.y);
          if (dist >= MAX_DIST) continue;

          const proximity = 1 - dist / MAX_DIST;
          const depthAlpha = (a.depth + b.depth) / 2;
          const baseAlpha  = proximity * depthAlpha * (isDark ? 0.40 : 1.10);

          const grad = ctx.createLinearGradient(a.x, a.y, b.x, b.y);
          const bA = bright(a.depth), bB = bright(b.depth);
          grad.addColorStop(0,   `hsla(158,${SAT}%,${bA}%,${baseAlpha})`);
          grad.addColorStop(0.5, `hsla(162,${SAT}%,${Math.round((bA+bB)/2)}%,${baseAlpha * 1.3})`);
          grad.addColorStop(1,   `hsla(166,${SAT}%,${bB}%,${baseAlpha})`);

          ctx.beginPath();
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(b.x, b.y);
          ctx.strokeStyle = grad;
          ctx.lineWidth   = proximity * (isDark ? 1.1 : 1.2);
          ctx.stroke();
        }
      }

      // ── Draw + advance signal packets ────────────────────────
      const dead = [];
      for (let k = 0; k < packets.length; k++) {
        const p  = packets[k];
        p.t     += p.speed;
        if (p.t >= 1) { dead.push(k); continue; }

        const a  = nodes[p.ai], b = nodes[p.bi];
        const px = a.x + (b.x - a.x) * p.t;
        const py = a.y + (b.y - a.y) * p.t;

        const gr = ctx.createRadialGradient(px, py, 0, px, py, 5);
        gr.addColorStop(0,   isDark ? 'rgba(52,211,153,0.95)' : 'rgba(16,185,129,0.85)');
        gr.addColorStop(0.4, isDark ? 'rgba(16,185,129,0.40)' : 'rgba(5,150,105,0.30)');
        gr.addColorStop(1,   'transparent');
        ctx.beginPath();
        ctx.arc(px, py, 5, 0, Math.PI * 2);
        ctx.fillStyle = gr;
        ctx.fill();

        ctx.beginPath();
        ctx.arc(px, py, 1.4, 0, Math.PI * 2);
        ctx.fillStyle = isDark ? 'rgba(167,243,208,0.9)' : 'rgba(6,95,70,0.8)';
        ctx.fill();
      }
      for (let k = dead.length - 1; k >= 0; k--) packets.splice(dead[k], 1);
      if (frame.n % 18 === 0) spawnPacket();

      // ── Draw nodes ───────────────────────────────────────────
      for (const n of nodes) {
        const glow  = 0.65 + Math.abs(Math.sin(n.pulse)) * 0.35;
        const alpha = glow * (0.45 + n.depth * 0.55) * (isDark ? 1 : 1.80);
        const bri   = bright(n.depth);
        const hue   = 152 + n.depth * 14;

        if (n.isHub) {
          const aura = ctx.createRadialGradient(n.x, n.y, n.r, n.x, n.y, n.r * 3.8);
          aura.addColorStop(0,   `hsla(${hue},${SAT}%,${bri}%,${alpha * 0.28})`);
          aura.addColorStop(1,   'transparent');
          ctx.beginPath();
          ctx.arc(n.x, n.y, n.r * 3.8, 0, Math.PI * 2);
          ctx.fillStyle = aura;
          ctx.fill();
        }

        const ring = ctx.createRadialGradient(n.x, n.y, 0, n.x, n.y, n.r * 2.2);
        ring.addColorStop(0,   `hsla(${hue},${SAT}%,${bri}%,${alpha * 0.18})`);
        ring.addColorStop(1,   'transparent');
        ctx.beginPath();
        ctx.arc(n.x, n.y, n.r * 2.2, 0, Math.PI * 2);
        ctx.fillStyle = ring;
        ctx.fill();

        const core = ctx.createRadialGradient(n.x, n.y, 0, n.x, n.y, n.r);
        core.addColorStop(0,   `hsla(${hue + 8},${SAT}%,${Math.min(bri + 20, 92)}%,${alpha})`);
        core.addColorStop(0.6, `hsla(${hue},${SAT}%,${bri}%,${alpha})`);
        core.addColorStop(1,   `hsla(${hue - 6},${SAT - 10}%,${bri - 10}%,${alpha * 0.7})`);
        ctx.beginPath();
        ctx.arc(n.x, n.y, n.r, 0, Math.PI * 2);
        ctx.fillStyle = core;
        ctx.fill();
      }

      animRef.current = requestAnimationFrame(draw);
    };

    draw();

    const onMove  = (e) => {
      const r = canvas.getBoundingClientRect();
      mouseRef.current = { x: e.clientX - r.left, y: e.clientY - r.top };
    };
    const onLeave = () => { mouseRef.current = { x: -9999, y: -9999 }; };
    canvas.addEventListener('mousemove',  onMove);
    canvas.addEventListener('mouseleave', onLeave);

    return () => {
      cancelAnimationFrame(animRef.current);
      window.removeEventListener('resize', resize);
      canvas.removeEventListener('mousemove',  onMove);
      canvas.removeEventListener('mouseleave', onLeave);
    };
  }, [isDark]);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 w-full h-full"
      style={{ pointerEvents: 'auto' }}
    />
  );
}
