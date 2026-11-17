import React from 'react';
import { ArrowUpCircle, Trash2 } from 'lucide-react';
import Stars from './Stars';
import { formatStat, rarityStyle, statLabel } from '../utils/progression';

/**
 * Artifact summary: rank stars, +level, main stat, substats (with roll count),
 * and optional upgrade / unequip actions with RSL-style cost and success chance.
 */
export default function ArtifactCard({ artifact, onUpgrade, onUnequip, onClick, equippedName, busy = false, compact = false }) {
  const r = rarityStyle(artifact.rarity);
  const maxed = artifact.level >= (artifact.max_level || 16);
  const Wrapper = onClick ? 'button' : 'div';

  return (
    <Wrapper
      onClick={onClick}
      className={`w-full text-left rounded-xl border ${r.border} ${r.bg} p-2.5 flex flex-col gap-1.5 transition ${
        onClick ? 'hover:brightness-125 cursor-pointer' : ''
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className={`font-orbitron font-bold text-sm truncate ${r.text}`}>{artifact.name}</div>
          <div className="flex items-center gap-1.5 mt-0.5">
            <Stars value={artifact.rank} size="w-3 h-3" />
            <span className="font-mono text-[13px] text-slate-500">{artifact.slot}</span>
          </div>
        </div>
        <span className={`shrink-0 font-orbitron font-black text-base ${maxed ? 'text-amber-300' : 'text-slate-100'}`}>
          +{artifact.level}
        </span>
      </div>

      <div className="flex items-center justify-between rounded-md bg-black/40 px-2 py-1.5">
        <span className="font-mono text-xs text-slate-400">{statLabel(artifact.main_stat_name)}</span>
        <span className="font-orbitron font-bold text-sm text-cyan-200">{formatStat(artifact.main_stat_name, artifact.main_stat_value)}</span>
      </div>

      {!compact && (
        <div className="space-y-1 min-h-[4.5rem]">
          {artifact.sub_stats?.length ? artifact.sub_stats.map((s, i) => (
            <div key={i} className="flex items-center justify-between font-mono text-[15px]">
              <span className="text-slate-400">
                {statLabel(s.stat)}
                {s.rolls > 1 && <span className="text-amber-400 ml-1">{'▲'.repeat(Math.min(4, s.rolls - 1))}</span>}
              </span>
              <span className="text-slate-200">{formatStat(s.stat, s.value)}</span>
            </div>
          )) : (
            <div className="font-mono text-xs text-slate-600 italic">No substats yet — upgrade to +4</div>
          )}
        </div>
      )}

      <div className="flex items-center justify-between font-mono text-[13px] text-slate-500">
        <span className="text-amber-400/90">{artifact.set_type}</span>
        {equippedName && <span className="truncate ml-2">on {equippedName}</span>}
      </div>

      {(onUpgrade || onUnequip) && (
        <div className="flex items-center gap-1.5 pt-1.5 border-t border-white/10">
          {onUpgrade && (
            <button
              disabled={busy || maxed}
              onClick={(e) => { e.stopPropagation(); onUpgrade(artifact); }}
              className="flex-1 py-1 rounded bg-amber-950/60 hover:bg-amber-900/60 border border-amber-500/40 text-amber-300 font-mono text-[13px] flex items-center justify-center gap-1 disabled:opacity-40"
              title={maxed ? 'Maxed' : `Success chance ${Math.round((artifact.upgrade_chance || 0) * 100)}% — credits are spent even on failure`}
            >
              <ArrowUpCircle className="w-3 h-3" />
              {maxed ? 'MAXED' : (
                <span>
                  +{artifact.level + 1} · {artifact.upgrade_cost?.toLocaleString()} Cr ·{' '}
                  <span className={artifact.upgrade_chance < 0.5 ? 'text-red-300' : 'text-emerald-300'}>
                    {Math.round((artifact.upgrade_chance || 0) * 100)}%
                  </span>
                </span>
              )}
            </button>
          )}
          {onUnequip && (
            <button
              onClick={(e) => { e.stopPropagation(); onUnequip(artifact); }}
              className="p-1 rounded bg-slate-800 hover:bg-red-950 text-slate-400 hover:text-red-400 border border-slate-700"
              title="Unequip"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      )}
    </Wrapper>
  );
}
