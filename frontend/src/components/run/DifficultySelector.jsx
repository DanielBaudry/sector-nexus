import React from 'react';
import { Skull, Swords, Coins, Gem, Star, Waves, Lock, Sparkles } from 'lucide-react';

// Tier colour ramp: cyan (easy) → amber → red → violet (tier 10).
const tierColor = (t) => {
  if (t >= 10) return '#a855f7';
  if (t >= 8) return '#ef4444';
  if (t >= 6) return '#f97316';
  if (t >= 4) return '#f59e0b';
  return '#22d3ee';
};

const pctLabel = (v) => `${(v * 100).toFixed(v < 0.1 ? 1 : 0)}%`;

function Stat({ icon: Icon, label, value, sub, color }) {
  return (
    <div className="rounded-lg border border-slate-700/70 bg-slate-950/60 px-2.5 py-1.5 min-w-0">
      <div className="flex items-center gap-1 text-[11px] font-mono text-slate-500 tracking-wider uppercase">
        <Icon className="w-3 h-3" /> {label}
      </div>
      <div className="font-orbitron font-bold text-sm leading-tight" style={{ color }}>{value}</div>
      {sub && <div className="text-[11px] font-mono text-slate-500 truncate">{sub}</div>}
    </div>
  );
}

/**
 * Difficulty picker for biomes that support tiers (1–10).
 * Shows what the chosen tier changes: enemy power, rewards, artifact odds and new threats.
 */
export default function DifficultySelector({ biome, value, onChange }) {
  const tiers = biome?.difficulty_tiers || [];
  if (tiers.length <= 1) return null;
  const tier = tiers.find((t) => t.tier === value) || tiers[0];
  const color = tierColor(tier.tier);
  const threats = biome.difficulty_threats || [];
  const threatTiers = [...new Set(threats.map((t) => t.min_tier))];

  return (
    <div className="rounded-xl border bg-black/40 p-3 mb-4" style={{ borderColor: `${color}66` }}>
      <div className="flex items-center justify-between mb-2">
        <span className="font-mono text-[12px] tracking-widest text-slate-400">THREAT LEVEL</span>
        <span className="font-orbitron font-black text-sm" style={{ color }}>DIFFICULTY {tier.tier}</span>
      </div>

      {/* Tier buttons */}
      <div className="grid grid-cols-10 gap-1">
        {tiers.map((t) => {
          const active = t.tier === tier.tier;
          const c = tierColor(t.tier);
          const newThreat = threatTiers.includes(t.tier);
          return (
            <button
              key={t.tier}
              onClick={() => onChange(t.tier)}
              title={newThreat ? `Difficulty ${t.tier}: new enemies appear` : `Difficulty ${t.tier}`}
              className={`relative h-9 rounded-md border font-orbitron font-bold text-xs transition ${
                active ? 'text-black scale-105 shadow-lg' : 'text-slate-300 bg-slate-900/70 hover:bg-slate-800'
              }`}
              style={active ? { backgroundColor: c, borderColor: c, boxShadow: `0 0 12px ${c}88` } : { borderColor: `${c}55` }}
            >
              {t.tier}
              {newThreat && (
                <Skull
                  className="absolute -top-1.5 -right-1.5 w-3.5 h-3.5 rounded-full bg-black p-px"
                  style={{ color: c }}
                />
              )}
            </button>
          );
        })}
      </div>

      {/* What this tier changes */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 mt-3">
        <Stat
          icon={Swords} label="Enemy power" color={color}
          value={`×${tier.enemy_mult.toFixed(2)}`}
          sub={tier.extra_waves ? `+${tier.extra_waves} reinforcement wave${tier.extra_waves > 1 ? 's' : ''}` : 'standard waves'}
        />
        <Stat
          icon={Coins} label="Rewards" color="#fbbf24"
          value={`×${tier.reward_mult.toFixed(2)}`}
          sub="credits · crystals · XP"
        />
        <Stat
          icon={Gem} label="Rarity (combat)" color="#c084fc"
          value={`${pctLabel(tier.rarity_odds.Legendary)} LEG`}
          sub={`${pctLabel(tier.rarity_odds.Epic)} epic · ${pctLabel(tier.rarity_odds.Common)} common`}
        />
        <Stat
          icon={Star} label="Artifact rank" color="#facc15"
          value={tier.rank_bonus ? `+${tier.rank_bonus}★ ` : '—'}
          sub={`${pctLabel(tier.rank_up_chance)} for +1★ · +${pctLabel(tier.extra_drop_chance)} extra drop`}
        />
      </div>

      {/* Threat roster */}
      {threats.length > 0 && (
        <div className="mt-3">
          <div className="font-mono text-[11px] tracking-widest text-slate-500 mb-1 flex items-center gap-1">
            <Waves className="w-3 h-3" /> ESCALATION THREATS
          </div>
          <div className="flex flex-wrap gap-1.5">
            {threats.map((t) => {
              const unlocked = tier.tier >= t.min_tier;
              const c = tierColor(t.min_tier);
              return (
                <div
                  key={t.name}
                  title={t.abilities.length ? `Abilities: ${t.abilities.join(', ')}` : 'Troop pack'}
                  className={`flex items-center gap-1.5 px-2 py-1 rounded-md border text-[12px] font-mono transition ${
                    unlocked ? 'bg-black/60' : 'bg-slate-950/60 opacity-40'
                  }`}
                  style={{ borderColor: unlocked ? `${c}88` : '#334155' }}
                >
                  {unlocked ? <Skull className="w-3 h-3" style={{ color: c }} /> : <Lock className="w-3 h-3 text-slate-500" />}
                  <span className={unlocked ? 'text-slate-100' : 'text-slate-500'}>{t.name}</span>
                  <span className="text-slate-500">
                    {t.role === 'boss' ? 'BOSS' : t.role === 'elite' ? 'ELITE' : 'PACK'} · D{t.min_tier}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {tier.modifiers_available && (
        <div className="mt-3 rounded-lg border border-dashed border-violet-500/50 bg-violet-950/20 px-3 py-2 flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-violet-300" />
          <div className="text-[12px] font-mono text-violet-200">
            MODIFIERS — stack extra hazards for bigger rewards. <span className="text-violet-400">Coming soon.</span>
          </div>
        </div>
      )}
    </div>
  );
}
