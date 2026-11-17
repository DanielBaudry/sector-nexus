import React from 'react';
import { Crosshair, Crown, Hourglass, Lock, Shield, Star, Swords, UserPlus, Gift, Dna, Coins, Gem } from 'lucide-react';
import { AdaptationPips, ChampionArt, InfluenceBar, RANK_LABEL, STATUS_META, StatusBadge } from './hierarchyUi';

function Section({ title, children }) {
  return (
    <div>
      <div className="font-mono text-[11px] tracking-widest text-slate-500 mb-1">{title}</div>
      {children}
    </div>
  );
}

/** Full card of a hierarchy champion: lore, influence, kit, phases, adaptations and actions. */
export default function ChampionDetail({ champion, superiorName, subordinateNames, isTarget, rules, busy, onTarget, onFight }) {
  const meta = STATUS_META[champion.status];
  const { influence, losses } = champion.standing;
  const canTarget = (champion.status === 'HUNTED' || champion.status === 'VULNERABLE') && !isTarget;
  const per = rules?.per_node || {};
  const share = rules?.run_end_share || {};

  return (
    <div className="hud-panel rounded-2xl border-2 overflow-hidden flex flex-col" style={{ borderColor: `${meta.color}77` }}>
      {/* Header */}
      <div className="relative flex gap-3 p-3" style={{ background: `radial-gradient(ellipse at 20% 50%, ${champion.color}33, transparent 65%)` }}>
        <ChampionArt champion={champion} className="w-28 h-28 object-contain shrink-0 drop-shadow-[0_0_14px_rgba(249,115,22,0.35)]" />
        <div className="min-w-0 flex-1">
          <div className="font-mono text-[11px] tracking-widest text-slate-400">
            {RANK_LABEL[champion.rank]?.toUpperCase()} · {champion.arena_name.toUpperCase()}
          </div>
          <div className="font-orbitron font-black text-2xl text-slate-100 leading-tight">{champion.name}</div>
          <div className="font-orbitron text-sm text-orange-200/80">{champion.title}</div>
          <div className="mt-1.5 flex flex-wrap items-center gap-2">
            <StatusBadge status={champion.status} size="md" />
            {isTarget && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-cyan-500 text-black font-mono text-[12px] font-black">
                <Crosshair className="w-3.5 h-3.5" /> CURRENT TARGET
              </span>
            )}
            <AdaptationPips losses={losses} />
          </div>
        </div>
      </div>

      <div className="p-3 pt-0 space-y-3 overflow-y-auto">
        <p className="text-sm text-slate-300 leading-relaxed">{champion.description}</p>

        <div className="flex flex-wrap gap-x-4 gap-y-1 font-mono text-[12px] text-slate-400">
          {superiorName && <span>Answers to <b className="text-slate-200">{superiorName}</b></span>}
          {subordinateNames.length > 0 && <span>Commands <b className="text-slate-200">{subordinateNames.join(', ')}</b></span>}
          <span>Rec. power <b className="text-slate-200">{champion.recommended_power}</b></span>
        </div>

        {/* Influence */}
        {champion.status === 'LOCKED' ? (
          <div className="rounded-lg border border-slate-700 bg-slate-950/70 p-2.5 flex items-start gap-2 text-sm text-slate-300">
            <Lock className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
            <span>{champion.unlock_hint}</span>
          </div>
        ) : champion.status !== 'DEFEATED' && (
          <Section title="INFLUENCE">
            <InfluenceBar value={influence} max={champion.influence_required} height="h-4" showText />
            <p className="mt-1 font-mono text-[11px] text-slate-500 leading-snug">
              Target them, then win battles in {champion.arena_name.split(' — ')[0]} expeditions:
              +{per.COMBAT} combat · +{per.ELITE} elite · +{per.BOSS} boss (more at higher difficulty).
              Banked at run end — {Math.round((share.VICTORY ?? 1) * 100)}% on victory, {Math.round((share.ABANDONED ?? 0.5) * 100)}% on extraction, {Math.round((share.DEFEAT ?? 0.25) * 100)}% on defeat.
            </p>
          </Section>
        )}

        {/* Kit */}
        {champion.passive && (
          <div className="rounded-lg border border-violet-500/40 bg-violet-950/30 px-2.5 py-1.5">
            <div className="flex items-center gap-1.5 font-orbitron font-bold text-[13px] text-violet-100">
              <Star className="w-3.5 h-3.5 fill-violet-300 text-violet-300" /> {champion.passive.name}
            </div>
            <div className="text-[13px] text-slate-300">{champion.passive.description}</div>
          </div>
        )}

        <Section title="ABILITIES">
          <div className="space-y-1">
            {champion.abilities.map((a) => (
              <div key={a.name} className={`rounded-lg border px-2.5 py-1.5 ${a.telegraph_turns ? 'border-orange-500/50 bg-orange-950/30' : 'border-slate-700 bg-black/40'}`}>
                <div className="flex items-center gap-2 text-[13px]">
                  {a.telegraph_turns > 0 && <Hourglass className="w-3.5 h-3.5 text-orange-300 shrink-0" />}
                  <b className="font-orbitron text-slate-100">{a.name}</b>
                  <span className="ml-auto font-mono text-[11px] text-slate-500 shrink-0">
                    CD{a.cooldown_turns}{a.telegraph_turns ? ` · wind-up ${a.telegraph_turns}` : ''}{a.phase ? ` · phase ${a.phase + 1}` : ''}
                  </span>
                </div>
                <div className="text-[12px] text-slate-400">{a.description}</div>
              </div>
            ))}
          </div>
        </Section>

        <Section title="PHASES">
          <div className="space-y-0.5">
            {champion.phases.map((p, i) => (
              <div key={i} className="flex gap-2 text-[13px]">
                <span className="w-10 shrink-0 text-right font-mono font-bold text-orange-300">{Math.round(p.threshold * 100)}%</span>
                <span className="text-slate-300"><b className="text-slate-100">{p.name}</b> — {p.description}</span>
              </div>
            ))}
          </div>
        </Section>

        {champion.guard && (
          <Section title="GUARD">
            <div className="flex items-start gap-2 text-[13px] text-slate-300">
              <Shield className="w-4 h-4 text-red-300 shrink-0 mt-0.5" />
              <span>
                <b className="text-slate-100">{champion.guard.name}</b> ({champion.guard.abilities.join(', ')}) defends their territory:
                expect it in elite fights, at the apex and on patrol while you hunt this champion.
              </span>
            </div>
          </Section>
        )}

        <Section title="ADAPTATIONS">
          {champion.adaptations.length === 0 ? (
            <div className="text-[13px] text-slate-400">
              None yet. Losing a boss fight never erases Influence, but the champion adapts
              {champion.next_adaptation ? <> — next: <b className="text-red-300">{champion.next_adaptation.name}</b> ({champion.next_adaptation.description})</> : '.'}
            </div>
          ) : (
            <div className="space-y-0.5">
              {champion.adaptations.map((a) => (
                <div key={a.name} className="flex gap-2 text-[13px] text-red-200">
                  <Dna className="w-3.5 h-3.5 shrink-0 mt-0.5" /> <span><b>{a.name}</b> — {a.description}</span>
                </div>
              ))}
              {champion.next_adaptation && champion.status !== 'DEFEATED' && (
                <div className="text-[12px] text-slate-500">Next if you lose: {champion.next_adaptation.name}.</div>
              )}
            </div>
          )}
        </Section>

        <Section title="CLAIM">
          <div className="grid grid-cols-2 gap-1.5 text-[12px]">
            <div className="rounded-lg border border-slate-700 bg-black/40 px-2 py-1.5 text-slate-400 flex items-center gap-1.5">
              <UserPlus className="w-3.5 h-3.5" /> Recruit as hero — <i>coming soon</i>
            </div>
            <div className="rounded-lg border border-slate-700 bg-black/40 px-2 py-1.5 text-slate-400 flex items-center gap-1.5">
              <Gift className="w-3.5 h-3.5" /> Seat bonus — <i>coming soon</i>
            </div>
          </div>
          <div className="mt-1.5 flex items-center gap-3 font-mono text-[12px]">
            <span className="flex items-center gap-1 text-amber-300"><Coins className="w-3.5 h-3.5" />{champion.rewards.credits?.toLocaleString()}+</span>
            <span className="flex items-center gap-1 text-cyan-300"><Gem className="w-3.5 h-3.5" />{champion.rewards.crystals}+</span>
            <span className="text-emerald-300">+ boss-grade artifacts</span>
          </div>
        </Section>
      </div>

      {/* Actions */}
      {champion.status !== 'DEFEATED' && champion.status !== 'LOCKED' && (
        <div className="shrink-0 p-3 border-t border-slate-800 flex gap-2">
          <button
            disabled={!canTarget || busy}
            onClick={onTarget}
            className={`flex-1 py-2.5 rounded-xl font-orbitron font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-1.5 transition ${
              isTarget ? 'bg-cyan-950 text-cyan-300 border border-cyan-500/50' : 'bg-cyan-500 hover:bg-cyan-400 text-black disabled:opacity-50'
            }`}
          >
            <Crosshair className="w-4 h-4" /> {isTarget ? 'Targeted' : 'Set as target'}
          </button>
          <button
            disabled={champion.status !== 'VULNERABLE' || busy}
            onClick={onFight}
            title={champion.status !== 'VULNERABLE' ? `Needs ${champion.influence_required} Influence` : 'Start the boss fight'}
            className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-orange-600 to-red-700 hover:from-orange-500 hover:to-red-600 text-white font-orbitron font-black text-xs uppercase tracking-wider flex items-center justify-center gap-1.5 disabled:opacity-40 disabled:from-slate-700 disabled:to-slate-800"
          >
            {champion.status === 'VULNERABLE' ? <Swords className="w-4 h-4" /> : <Lock className="w-4 h-4" />} Boss fight
          </button>
        </div>
      )}
      {champion.status === 'DEFEATED' && (
        <div className="shrink-0 p-3 border-t border-amber-500/30 bg-amber-950/20 flex items-center gap-2 font-orbitron text-sm text-amber-200">
          <Crown className="w-4 h-4" /> Seat claimed — {champion.name} no longer commands on {champion.arena_name.split(' — ')[0]}.
        </div>
      )}
    </div>
  );
}
