import React, { useEffect, useRef } from 'react';
import { User } from 'lucide-react';
import { HERO_ART_PLACEHOLDER, heroArtFor } from '../../utils/progression';

const MAX_TILT_Y = 12; // degrees, left/right
const MAX_TILT_X = 6;  // degrees, up/down
const EASE = 0.12;     // follow speed per frame (0-1)

/**
 * Full-body hero art for the Armory showcase, with a mouse-driven 3D tilt:
 * the figure rotates toward the cursor, a glare follows it, the drop shadow and
 * back glow drift the other way for parallax. Eases back to rest on leave.
 * Heroes without final art get the placeholder plus a faint silhouette.
 */
export default function HeroArt({ name = '', className = '' }) {
  const src = heroArtFor(name);
  const placeholder = src === HERO_ART_PLACEHOLDER;

  const rootRef = useRef(null);
  const figureRef = useRef(null);
  const glareRef = useRef(null);
  const glowRef = useRef(null);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return undefined;
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (reduced) return undefined;

    const target = { x: 0, y: 0, active: 0 };
    const current = { x: 0, y: 0, active: 0 };
    let frame = null;

    const render = () => {
      current.x += (target.x - current.x) * EASE;
      current.y += (target.y - current.y) * EASE;
      current.active += (target.active - current.active) * EASE;
      const { x, y, active } = current;

      if (figureRef.current) {
        figureRef.current.style.transform =
          `rotateY(${x * MAX_TILT_Y}deg) rotateX(${-y * MAX_TILT_X}deg) scale(${1 + active * 0.03})`;
        figureRef.current.style.filter =
          `drop-shadow(${-x * 18}px ${14 - y * 8}px 18px rgba(0,0,0,0.85))`;
      }
      if (glareRef.current) {
        glareRef.current.style.opacity = String(active * 0.55);
        glareRef.current.style.background =
          `radial-gradient(circle at ${50 + x * 40}% ${40 + y * 35}%, rgba(255,255,255,0.55), rgba(255,255,255,0) 45%)`;
      }
      if (glowRef.current) {
        glowRef.current.style.transform = `translate(${-x * 22}px, ${-y * 14}px)`;
      }

      const settled = Math.abs(target.x - x) < 0.001 && Math.abs(target.y - y) < 0.001
        && Math.abs(target.active - active) < 0.001;
      frame = settled ? null : requestAnimationFrame(render);
    };
    const kick = () => { if (frame === null) frame = requestAnimationFrame(render); };

    const onMove = (e) => {
      const r = root.getBoundingClientRect();
      target.x = Math.max(-1, Math.min(1, ((e.clientX - r.left) / r.width) * 2 - 1));
      target.y = Math.max(-1, Math.min(1, ((e.clientY - r.top) / r.height) * 2 - 1));
      target.active = 1;
      kick();
    };
    const onLeave = () => {
      target.x = 0;
      target.y = 0;
      target.active = 0;
      kick();
    };

    root.addEventListener('pointermove', onMove);
    root.addEventListener('pointerleave', onLeave);
    root.addEventListener('pointercancel', onLeave);
    return () => {
      root.removeEventListener('pointermove', onMove);
      root.removeEventListener('pointerleave', onLeave);
      root.removeEventListener('pointercancel', onLeave);
      if (frame !== null) cancelAnimationFrame(frame);
    };
  }, []);

  return (
    <div ref={rootRef} className={`relative overflow-hidden touch-pan-y ${className}`} style={{ perspective: '1100px' }}>
      {/* Back glow (moves opposite to the tilt) */}
      <div
        ref={glowRef}
        className="absolute inset-[10%] rounded-full pointer-events-none will-change-transform"
        style={{ background: 'radial-gradient(ellipse at 50% 45%, rgba(34,211,238,0.18), rgba(0,0,0,0) 70%)' }}
      />

      <div
        ref={figureRef}
        className="absolute inset-0 will-change-transform"
        style={{ transformStyle: 'preserve-3d', filter: 'drop-shadow(0 14px 18px rgba(0,0,0,0.85))' }}
      >
        <img
          src={src}
          alt={name}
          draggable={false}
          className="absolute inset-0 w-full h-full object-contain object-bottom select-none"
        />
        {placeholder && (
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
            <User className="w-1/2 h-1/2 text-slate-800" strokeWidth={0.75} />
            <span className="font-mono text-[12px] tracking-[0.3em] text-slate-600 -mt-4">ART PENDING</span>
          </div>
        )}
        {/* Glare: overlay blend only lights up the figure, not the black backdrop */}
        <div ref={glareRef} className="absolute inset-0 pointer-events-none mix-blend-overlay" style={{ opacity: 0 }} />
      </div>
    </div>
  );
}
