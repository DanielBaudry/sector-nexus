import React from 'react';
import { createPortal } from 'react-dom';

const TRACER = {
  hero: { stroke: '#fde68a', width: 3 },
  crit: { stroke: '#f59e0b', width: 4 },
  volley: { stroke: '#e2e8f0', width: 1.5 },
  heal: { stroke: '#4ade80', width: 2.5 },
};

const FLOATER = {
  damage: 'text-red-400 text-lg',
  crit: 'text-amber-300 text-2xl',
  shield: 'text-cyan-300 text-base',
  heal: 'text-emerald-300 text-lg',
  ability: 'text-cyan-100 text-sm font-orbitron tracking-wider bg-black/70 px-2 rounded border border-cyan-400/60',
  death: 'text-red-500 text-sm font-orbitron tracking-widest',
};

/** Screen-space combat effects: tracer lines (attacker → target) and floating numbers. */
export default function BattleFxLayer({ tracers, floaters }) {
  return createPortal(
    <div className="fixed inset-0 z-40 pointer-events-none">
      <svg className="absolute inset-0 w-full h-full">
        <defs>
          <filter id="fx-glow"><feGaussianBlur stdDeviation="2.5" /></filter>
        </defs>
        {tracers.map((t) => {
          const s = TRACER[t.tone] || TRACER.hero;
          return (
            <g key={t.key} className="fx-tracer">
              <line x1={t.x1} y1={t.y1} x2={t.x2} y2={t.y2} stroke={s.stroke} strokeWidth={s.width * 2.5} opacity="0.35" filter="url(#fx-glow)" />
              <line x1={t.x1} y1={t.y1} x2={t.x2} y2={t.y2} stroke={s.stroke} strokeWidth={s.width} strokeLinecap="round" />
              <circle cx={t.x2} cy={t.y2} r={s.width * 2.5} fill={s.stroke} opacity="0.7" />
            </g>
          );
        })}
      </svg>
      {floaters.map((f) => (
        <span
          key={f.key}
          className={`fx-float absolute whitespace-nowrap font-black ${FLOATER[f.tone] || FLOATER.damage}`}
          style={{ left: f.x, top: f.y, textShadow: '0 0 4px #000, 0 2px 2px #000' }}
        >
          {f.text}
        </span>
      ))}
    </div>,
    document.body,
  );
}
