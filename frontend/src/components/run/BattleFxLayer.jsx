import React from 'react';
import { createPortal } from 'react-dom';

const FLOATER = {
  damage: 'text-red-400 text-lg',
  crit: 'text-amber-300 text-2xl',
  shield: 'text-cyan-300 text-base',
  heal: 'text-emerald-300 text-lg',
  ability: 'text-cyan-100 text-sm font-orbitron tracking-wider bg-black/70 px-2 rounded border border-cyan-400/60',
  death: 'text-red-500 text-sm font-orbitron tracking-widest',
  buff: 'text-emerald-200 text-xs font-orbitron tracking-wider bg-emerald-950/80 px-1.5 rounded border border-emerald-400/60',
  debuff: 'text-red-200 text-xs font-orbitron tracking-wider bg-red-950/80 px-1.5 rounded border border-red-400/60',
  resist: 'text-slate-200 text-xs font-orbitron tracking-wider bg-slate-800/90 px-1.5 rounded border border-slate-400/60',
  passive: 'text-violet-100 text-xs font-orbitron tracking-wider bg-violet-950/85 px-1.5 rounded border border-violet-400/70',
};

/** Melee hit: one (or, on crits, two) blade arcs drawn across the target. */
function Slash({ p }) {
  const size = p.crit ? 96 : 76;
  return (
    <svg className="fx-slash absolute" style={{ left: p.x2 - size / 2, top: p.y2 - size / 2, color: p.color }} width={size} height={size} viewBox="0 0 80 80">
      <path d="M12 66 Q34 38 70 12" pathLength="1" className="fx-slash-stroke" stroke={p.color} />
      {p.crit && <path d="M8 34 Q42 30 74 52" pathLength="1" className="fx-slash-stroke fx-slash-late" stroke={p.color} />}
    </svg>
  );
}

/** One shot: muzzle flash, projectile travelling along its path, impact at the target. */
function Projectile({ p }) {
  const cls = `fx-${p.style}`;
  return (
    <>
      {p.style === 'slash' ? (
        <Slash p={p} />
      ) : (
        <span
          className={`fx-proj ${cls} ${p.crit ? 'fx-proj-crit' : ''} ${p.small ? 'fx-proj-small' : ''}`}
          style={{ offsetPath: `path('${p.path}')`, animationDuration: `${p.travel}ms` }}
        />
      )}
      {p.style === 'bullet' && <span className="fx-muzzle absolute" style={{ left: p.x1, top: p.y1 }} />}
      <span
        className={`fx-impact absolute ${cls} ${p.crit ? 'fx-impact-crit' : ''} ${p.small ? 'fx-impact-small' : ''}`}
        style={{ left: p.x2, top: p.y2, animationDelay: `${p.style === 'slash' ? 60 : p.travel}ms` }}
      />
    </>
  );
}

/** Screen-space combat effects: projectiles (attacker → target), impacts and floating numbers. */
export default function BattleFxLayer({ projectiles, floaters }) {
  return createPortal(
    <div className="fixed inset-0 z-40 pointer-events-none overflow-hidden">
      {projectiles.map((p) => <Projectile key={p.key} p={p} />)}
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
