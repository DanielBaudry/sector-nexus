import React, { useEffect, useState } from 'react';
import { Hourglass, Swords, X } from 'lucide-react';
import { getPortrait } from '../../utils/battleVisuals';

/** Seconds left in the current decision window (updates ~10×/s while `active`). */
export function useCountdown(startedAt, duration, active) {
  const calc = () => Math.max(0, duration - (Date.now() / 1000 - startedAt));
  const [left, setLeft] = useState(calc);
  useEffect(() => {
    if (!active) return undefined;
    setLeft(calc());
    const id = setInterval(() => setLeft(calc()), 100);
    return () => clearInterval(id);
  }, [startedAt, duration, active]); // eslint-disable-line react-hooks/exhaustive-deps
  return active ? left : duration;
}

/** Danger level 0..1 of a countdown: 0 above 40% of the window, 1 at zero. */
export const urgencyOf = (left, duration) => Math.max(0, Math.min(1, 1 - left / Math.max(0.001, duration * 0.4)));

/**
 * The decision clock, top centre. While a hero awaits orders: portrait, a big seconds counter
 * and a burning fuse that shrinks toward the centre, going cyan → amber → red and pulsing
 * each second at the end. Otherwise it says who is acting.
 */
export function TurnClock({ mode, actor, acting, left, duration, turn, timed = true }) {
  if (mode === 'deploy') {
    return (
      <ClockShell tone="cyan">
        <span className="font-mono text-[12px] tracking-[0.35em] text-cyan-300">PRE-COMBAT</span>
        <span className="font-orbitron font-black text-2xl text-white tracking-widest">DEPLOY YOUR SQUAD</span>
      </ClockShell>
    );
  }
  if (mode === 'resolve' && acting) {
    const hostile = acting.side === 'ENEMY';
    return (
      <ClockShell tone={hostile ? 'red' : 'cyan'}>
        <span className={`font-mono text-[12px] tracking-[0.35em] ${hostile ? 'text-red-300 animate-pulse' : 'text-cyan-300'}`}>
          {hostile ? 'ENEMY TURN' : 'ALLIED ACTION'}
        </span>
        <span className="flex items-center gap-2 font-orbitron font-black text-2xl tracking-wider text-white">
          {hostile && <Swords className="w-5 h-5 text-red-400" />} {acting.name}
        </span>
      </ClockShell>
    );
  }
  if (mode !== 'decide' || !actor) {
    return (
      <ClockShell tone={mode === 'over' ? 'slate' : 'red'}>
        <span className="flex items-center gap-2 font-orbitron font-black text-xl tracking-widest text-slate-200">
          {mode === 'over'
            ? 'BATTLE RESOLVED'
            : <><Swords className="w-5 h-5 text-red-400 animate-pulse" /> COMBAT RESOLVING</>}
        </span>
        <span className="font-mono text-[12px] tracking-[0.3em] text-slate-400">TURN {turn}</span>
      </ClockShell>
    );
  }

  if (!timed) {
    // Untimed turns: who is up, no countdown.
    const portrait = getPortrait(actor.name);
    return (
      <ClockShell tone="cyan">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-full overflow-hidden border-2 border-cyan-400 bg-black shrink-0 shadow-[0_0_18px_rgba(34,211,238,0.55)]">
            {portrait && <img src={portrait} alt="" className="w-full h-full object-cover object-top" />}
          </div>
          <div className="text-left">
            <div className="font-mono text-[12px] tracking-[0.35em] text-cyan-300">YOUR MOVE</div>
            <div className="font-orbitron font-black text-2xl text-white leading-tight">{actor.name}</div>
          </div>
        </div>
      </ClockShell>
    );
  }

  const ratio = Math.max(0, Math.min(1, left / duration));
  const urgency = urgencyOf(left, duration);
  const danger = left <= Math.max(2.5, duration * 0.15);
  const color = danger ? '#ef4444' : urgency > 0 ? '#f59e0b' : '#22d3ee';
  const secs = Math.ceil(left);
  const portrait = getPortrait(actor.name);

  return (
    <div className="flex flex-col items-center gap-1.5 select-none">
      <div className="flex items-center gap-4">
        <div className="w-14 h-14 rounded-full overflow-hidden border-2 bg-black shrink-0" style={{ borderColor: color, boxShadow: `0 0 18px ${color}88` }}>
          {portrait && <img src={portrait} alt="" className="w-full h-full object-cover object-top" />}
        </div>
        <div className="text-left">
          <div className="font-mono text-[12px] tracking-[0.35em]" style={{ color }}>{danger ? 'DECIDE NOW' : 'YOUR MOVE'}</div>
          <div className="font-orbitron font-black text-xl text-white leading-tight">{actor.name}</div>
        </div>
        <div
          key={danger ? secs : 'calm'}
          className={`font-orbitron font-black tabular-nums leading-none text-5xl w-[2.2ch] text-center ${danger ? 'clock-tick' : ''}`}
          style={{ color, textShadow: `0 0 22px ${color}` }}
        >
          {secs}
        </div>
      </div>
      {/* Fuse: burns from both ends toward the centre */}
      <div className="relative w-[min(560px,60vw)] h-2.5 rounded-full bg-black/70 border border-white/10 overflow-visible">
        <div
          className="absolute inset-y-0 left-1/2 -translate-x-1/2 rounded-full transition-[width] duration-100 ease-linear"
          style={{ width: `${ratio * 100}%`, background: `linear-gradient(90deg, ${color}, #fff8 50%, ${color})`, boxShadow: `0 0 14px ${color}` }}
        />
        {ratio > 0.01 && ['left', 'right'].map((side) => (
          <span
            key={side}
            className="fuse-spark absolute top-1/2 w-3.5 h-3.5 -mt-[7px] -ml-[7px] rounded-full"
            style={{ left: `${side === 'left' ? 50 - ratio * 50 : 50 + ratio * 50}%`, background: '#fff', boxShadow: `0 0 10px 4px ${color}, 0 0 22px 6px ${color}88` }}
          />
        ))}
      </div>
    </div>
  );
}

function ClockShell({ tone, children }) {
  const border = { cyan: 'border-cyan-500/40', red: 'border-red-500/40', slate: 'border-slate-600/50' }[tone];
  return (
    <div className={`min-w-[420px] min-h-[76px] flex flex-col items-center justify-center px-8 py-2 rounded-2xl border ${border} bg-black/55 backdrop-blur-sm`}>
      {children}
    </div>
  );
}

/** Red vignette that closes in as the decision window runs out (and breathes when a hero is low). */
export function PressureVignette({ urgency, lowHp }) {
  const strength = Math.max(urgency * 0.75, lowHp ? 0.28 : 0);
  if (strength <= 0.01) return null;
  return (
    <div
      className={`fixed inset-0 z-40 pointer-events-none ${urgency > 0.6 || lowHp ? 'pressure-pulse' : ''}`}
      style={{
        '--p': strength,
        opacity: strength,
        background: 'radial-gradient(ellipse at center, transparent 45%, rgba(127,29,29,0.55) 78%, rgba(220,38,38,0.9) 100%)',
        animationDuration: urgency > 0.85 ? '0.55s' : '1.1s',
      }}
    />
  );
}

/** Slanted "YOUR TURN" swoosh when a hero becomes ready. */
export function TurnBanner({ banner }) {
  if (!banner) return null;
  return (
    <div key={banner.key} className="fixed inset-x-0 top-[38%] z-[55] flex justify-center pointer-events-none">
      <div className="turn-banner px-14 py-3 bg-gradient-to-r from-transparent via-cyan-600/90 to-transparent border-y-2 border-cyan-300/80">
        <div className="font-mono text-[12px] tracking-[0.5em] text-cyan-100 text-center">YOUR TURN</div>
        <div className="font-orbitron font-black text-4xl text-white tracking-wider text-center drop-shadow-[0_0_14px_rgba(34,211,238,0.9)]">
          {banner.name.toUpperCase()}
        </div>
      </div>
    </div>
  );
}

/**
 * Round medallion on the side rails. `image` (optional) fills the medallion; otherwise the icon.
 * Clicking toggles its drawer.
 */
export function RailButton({ icon: Icon, image, label, active, onClick, badge, tone = 'cyan', disabled }) {
  const tones = {
    cyan: { ring: 'border-cyan-400/60', glow: 'shadow-[0_0_18px_rgba(34,211,238,0.45)]', hover: 'group-hover:shadow-[0_0_18px_rgba(34,211,238,0.45)]', text: 'text-cyan-200', bg: 'from-[#0b2a44] to-[#050b16]' },
    red: { ring: 'border-red-400/70', glow: 'shadow-[0_0_20px_rgba(239,68,68,0.55)]', hover: 'group-hover:shadow-[0_0_20px_rgba(239,68,68,0.55)]', text: 'text-red-100', bg: 'from-red-700 to-red-950' },
    amber: { ring: 'border-amber-400/60', glow: 'shadow-[0_0_18px_rgba(251,191,36,0.45)]', hover: 'group-hover:shadow-[0_0_18px_rgba(251,191,36,0.45)]', text: 'text-amber-200', bg: 'from-[#3b2a0a] to-[#120b02]' },
  }[tone];
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={label}
      className="group relative flex flex-col items-center gap-1 disabled:opacity-40"
    >
      <span className={`relative w-14 h-14 rounded-full border-2 bg-gradient-to-b ${tones.bg} ${tones.ring} flex items-center justify-center overflow-hidden transition
        ${active ? `scale-110 ${tones.glow} border-white/80` : `group-hover:scale-105 ${tones.hover}`}`}>
        {image ? <img src={image} alt="" className="w-full h-full object-cover" /> : <Icon className={`w-6 h-6 ${tones.text}`} />}
        <span className="absolute inset-0 rounded-full ring-1 ring-inset ring-white/15 pointer-events-none" />
      </span>
      {badge != null && (
        <span className="absolute -top-1 -right-1 min-w-[22px] h-[22px] px-1 rounded-full bg-black border border-white/30 font-mono text-[11px] font-bold text-white flex items-center justify-center">
          {badge}
        </span>
      )}
      <span className="font-mono text-[10px] tracking-widest text-slate-400 group-hover:text-slate-200 uppercase">{label}</span>
    </button>
  );
}

/** Sliding panel over the battlefield, from the left or right edge. */
export function SideDrawer({ side, open, title, icon: Icon, onClose, children }) {
  const pos = side === 'left' ? 'left-0 border-r rounded-r-2xl' : 'right-0 border-l rounded-l-2xl';
  const hidden = side === 'left' ? '-translate-x-[105%]' : 'translate-x-[105%]';
  return (
    <aside
      aria-hidden={!open}
      className={`absolute top-0 bottom-0 z-30 w-[min(380px,85vw)] ${pos} border-cyan-500/30 bg-[#050a16]/95 backdrop-blur-md shadow-2xl flex flex-col
        transition-transform duration-300 ease-out ${open ? 'translate-x-0' : `${hidden} pointer-events-none`}`}
    >
      <div className="shrink-0 flex items-center justify-between px-4 py-3 border-b border-white/10">
        <span className="flex items-center gap-2 font-orbitron font-bold text-sm tracking-widest text-slate-100">
          {Icon && <Icon className="w-4 h-4 text-cyan-300" />} {title}
        </span>
        <button onClick={onClose} title="Close (Esc)" className="p-1 rounded hover:bg-white/10 text-slate-400 hover:text-white">
          <X className="w-5 h-5" />
        </button>
      </div>
      <div className="flex-1 min-h-0 overflow-y-auto p-4">{children}</div>
    </aside>
  );
}

export function IdleNotice({ animating, live, acting }) {
  const hostile = acting?.side === 'ENEMY';
  return (
    <div className={`flex-1 flex items-center justify-center gap-2 font-mono text-sm ${hostile ? 'text-red-300' : 'text-slate-400'}`}>
      <Hourglass className="w-5 h-5 animate-spin" style={{ animationDuration: '3s' }} />
      {hostile ? `${acting.name.toUpperCase()} ${acting.drill ? 'ARE' : 'IS'} ACTING — brace…`
        : animating ? 'COMBAT IN PROGRESS…' : live ? 'INITIATIVE RUNNING…' : 'Battle resolved.'}
    </div>
  );
}
