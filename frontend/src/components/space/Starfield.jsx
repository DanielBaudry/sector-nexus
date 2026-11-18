import React, { useEffect, useRef } from 'react';

const LAYERS = [
  { depth: 0.25, density: 1 / 2600, size: [0.4, 1.0], alpha: [0.25, 0.6] },   // far
  { depth: 0.55, density: 1 / 6500, size: [0.7, 1.5], alpha: [0.45, 0.85] },  // mid
  { depth: 1.0, density: 1 / 16000, size: [1.1, 2.2], alpha: [0.7, 1.0] },    // near
];
const TINTS = ['#ffffff', '#ffffff', '#ffffff', '#cfe3ff', '#ffe7c7', '#d9d2ff'];
const DRIFT = 6;            // px/s of the near layer at rest
const PARALLAX = 28;        // px of mouse parallax on the near layer
const rand = (a, b) => a + Math.random() * (b - a);

/**
 * Deep-space backdrop: three parallax star layers that drift, twinkle and follow the mouse,
 * over nebula clouds tinted with `tint`. Changing `warpKey` triggers a short hyperspace
 * streak in direction `warpDir` (+1 = travelling right, -1 = left).
 */
export default function Starfield({ tint = '#ef4444', warpKey = 0, warpDir = 1 }) {
  const canvasRef = useRef(null);
  const state = useRef({ stars: [], w: 0, h: 0, mouse: { x: 0, y: 0 }, cam: { x: 0, y: 0 }, warp: 0, dir: 1 });

  // Warp kick on planet change.
  useEffect(() => {
    if (!warpKey) return;
    state.current.warp = 1;
    state.current.dir = warpDir;
  }, [warpKey, warpDir]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const s = state.current;
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    let raf = 0;
    let last = performance.now();

    const seed = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      s.w = window.innerWidth;
      s.h = window.innerHeight;
      canvas.width = s.w * dpr;
      canvas.height = s.h * dpr;
      canvas.style.width = `${s.w}px`;
      canvas.style.height = `${s.h}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      s.stars = [];
      LAYERS.forEach((layer) => {
        const n = Math.round(s.w * s.h * layer.density);
        for (let i = 0; i < n; i += 1) {
          s.stars.push({
            x: Math.random() * s.w,
            y: Math.random() * s.h,
            z: layer.depth,
            r: rand(...layer.size),
            a: rand(...layer.alpha),
            tw: rand(0.6, 2.2),            // twinkle speed
            ph: Math.random() * Math.PI * 2,
            c: TINTS[Math.floor(Math.random() * TINTS.length)],
          });
        }
      });
    };

    const draw = (now) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      // Ease the camera toward the mouse; decay the warp.
      s.cam.x += (s.mouse.x - s.cam.x) * 0.05;
      s.cam.y += (s.mouse.y - s.cam.y) * 0.05;
      s.warp = Math.max(0, s.warp - dt * 1.4);
      const warp = s.warp * s.warp; // ease-out
      ctx.clearRect(0, 0, s.w, s.h);

      for (const st of s.stars) {
        const speed = DRIFT * st.z + warp * 2600 * st.z;
        st.x -= speed * dt * (warp > 0.01 ? s.dir : 1);
        if (st.x < -40) st.x += s.w + 80;
        if (st.x > s.w + 40) st.x -= s.w + 80;
        const px = st.x - s.cam.x * PARALLAX * st.z;
        const py = st.y - s.cam.y * PARALLAX * st.z;
        const twinkle = reduced ? 1 : 0.75 + 0.25 * Math.sin(now / 1000 * st.tw + st.ph);
        ctx.globalAlpha = st.a * twinkle;
        if (warp > 0.02) {
          // Hyperspace streak behind the star.
          const len = warp * 140 * st.z;
          ctx.strokeStyle = st.c;
          ctx.lineWidth = st.r;
          ctx.beginPath();
          ctx.moveTo(px, py);
          ctx.lineTo(px + len * s.dir, py);
          ctx.stroke();
        } else {
          ctx.fillStyle = st.c;
          ctx.beginPath();
          ctx.arc(px, py, st.r, 0, Math.PI * 2);
          ctx.fill();
          if (st.r > 1.7) {           // soft halo on the brightest stars
            ctx.globalAlpha = st.a * twinkle * 0.15;
            ctx.beginPath();
            ctx.arc(px, py, st.r * 3, 0, Math.PI * 2);
            ctx.fill();
          }
        }
      }
      ctx.globalAlpha = 1;
      if (!reduced || s.warp > 0) raf = requestAnimationFrame(draw);
    };

    const onMove = (e) => {
      s.mouse.x = e.clientX / Math.max(1, s.w) - 0.5;
      s.mouse.y = e.clientY / Math.max(1, s.h) - 0.5;
    };
    const onResize = () => { seed(); if (reduced) draw(performance.now()); };

    seed();
    raf = requestAnimationFrame(draw);
    window.addEventListener('pointermove', onMove);
    window.addEventListener('resize', onResize);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('resize', onResize);
    };
  }, []);

  return (
    <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden bg-[#02030a]" aria-hidden="true">
      {/* Nebula clouds, tinted by the current planet (cross-fades on change) */}
      <div
        className="absolute inset-0 transition-[background] duration-1000"
        style={{
          background: `radial-gradient(ellipse 60% 50% at 28% 55%, ${tint}2e, transparent 70%),
                       radial-gradient(ellipse 45% 40% at 80% 20%, #6d28d922, transparent 70%),
                       radial-gradient(ellipse 50% 45% at 70% 90%, #0e749022, transparent 70%)`,
        }}
      />
      <canvas ref={canvasRef} className="absolute inset-0" />
      {/* Vignette for depth */}
      <div className="absolute inset-0" style={{ background: 'radial-gradient(ellipse at center, transparent 55%, #000000cc 100%)' }} />
    </div>
  );
}
