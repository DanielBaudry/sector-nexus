import React from 'react';
import { Plus } from 'lucide-react';
import Stars from '../Stars';
import { formatStat, rarityStyle, statLabel } from '../../utils/progression';
import { SLOT_ICONS } from './gear';

const RARITY_GLOW = {
  Common: '#94a3b8',
  Rare: '#38bdf8',
  Epic: '#a855f7',
  Legendary: '#f59e0b',
};

/** One equipment socket: empty frame with the slot glyph, or the equipped artifact at a glance. */
export default function GearSlot({ slot, artifact, onClick }) {
  const Icon = SLOT_ICONS[slot];
  const r = artifact ? rarityStyle(artifact.rarity) : null;
  const glow = artifact ? RARITY_GLOW[artifact.rarity] : null;

  return (
    <button
      onClick={onClick}
      className={`group relative w-full rounded-xl border-2 text-left transition overflow-hidden ${
        artifact ? `${r.border} ${r.bg} hover:brightness-125` : 'border-dashed border-slate-700 bg-slate-950/60 hover:border-cyan-500/60'
      }`}
      style={artifact ? { boxShadow: `inset 0 0 18px ${glow}33` } : undefined}
    >
      <div className="flex items-center gap-2.5 p-2.5">
        <div
          className={`w-12 h-12 shrink-0 rounded-lg border flex items-center justify-center ${
            artifact ? 'bg-black/50' : 'bg-slate-900/80 border-slate-700'
          }`}
          style={artifact ? { borderColor: `${glow}aa`, boxShadow: `0 0 10px ${glow}55` } : undefined}
        >
          <Icon className={`w-6 h-6 ${artifact ? r.text : 'text-slate-600 group-hover:text-cyan-400'}`} />
        </div>

        <div className="min-w-0 flex-1">
          <div className="font-mono text-[10px] tracking-widest text-slate-500 uppercase">{slot}</div>
          {artifact ? (
            <>
              <div className={`font-orbitron font-bold text-sm truncate ${r.text}`}>{artifact.name}</div>
              <div className="flex items-center justify-between gap-1 mt-0.5">
                <Stars value={artifact.rank} size="w-3 h-3" />
                <span className="font-mono text-[13px] font-bold text-cyan-200">
                  {statLabel(artifact.main_stat_name)} {formatStat(artifact.main_stat_name, artifact.main_stat_value)}
                </span>
              </div>
            </>
          ) : (
            <div className="font-mono text-xs text-slate-500 group-hover:text-cyan-300 flex items-center gap-1 mt-0.5">
              <Plus className="w-3 h-3" /> Empty — equip
            </div>
          )}
        </div>
      </div>

      {artifact && (
        <span className="absolute top-1.5 right-2 font-orbitron font-black text-sm text-slate-100 drop-shadow">
          +{artifact.level}
        </span>
      )}
    </button>
  );
}
