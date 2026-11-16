import React, { useState, useEffect } from 'react';
import { Satellite, Clock, CheckCircle2, Sparkles, Coins, Gift, ArrowRight, Shield } from 'lucide-react';
import { api } from '../services/api';

export default function BackgroundExpeditionView({
  backgroundExpeditions,
  biomes,
  squads,
  onClaimSuccess,
  onRefreshBackground,
  setActiveTab,
}) {
  const [claimedRewardModal, setClaimedRewardModal] = useState(null);
  const [claiming, setClaiming] = useState(false);
  const [, setTick] = useState(0);

  // Update timer every second for smooth progress bars
  useEffect(() => {
    const timer = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(timer);
  }, []);

  const handleClaim = async (expeditionId) => {
    setClaiming(true);
    try {
      const res = await api.claimBackground(expeditionId);
      setClaimedRewardModal(res.claimed_rewards);
      if (onClaimSuccess) onClaimSuccess(res.player);
      if (onRefreshBackground) onRefreshBackground();
    } catch (err) {
      alert(err.message || 'Failed to claim rewards');
    } finally {
      setClaiming(false);
    }
  };

  const handleQuickDispatch = async (biomeId) => {
    try {
      const squadId = squads?.[0]?.id || 'squad_alpha';
      await api.dispatchBackground(biomeId, squadId, 60);
      if (onRefreshBackground) onRefreshBackground();
    } catch (err) {
      alert(err.message || 'Failed to dispatch expedition');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="font-orbitron font-black text-2xl text-slate-100 flex items-center gap-2">
            <Satellite className="w-6 h-6 text-cyan-400" />
            ORBITAL BACKGROUND EXPEDITIONS
          </h2>
          <p className="text-xs font-mono text-slate-400 mt-0.5">
            AUTOMATED PASSIVE SQUAD FARMING // SQUADS ENGAGE FOES USING PRESET AI GAMBITS
          </p>
        </div>

        <button
          onClick={() => setActiveTab('expeditions')}
          className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-600 text-slate-200 font-mono text-xs flex items-center gap-1.5"
        >
          <span>Choose Biome on Map</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Dispatched Missions List */}
      <div className="space-y-4">
        {backgroundExpeditions && backgroundExpeditions.length > 0 ? (
          backgroundExpeditions.map((exp) => {
            const now = Date.now() / 1000;
            const elapsed = Math.max(0, now - exp.start_time);
            const remaining = Math.max(0, exp.duration_seconds - elapsed);
            const progress = Math.min(100, Math.max(0, (elapsed / exp.duration_seconds) * 100));
            const isDone = remaining <= 0;

            return (
              <div
                key={exp.id}
                className="hud-panel rounded-2xl p-5 border border-cyan-500/20 flex flex-col md:flex-row items-start md:items-center justify-between gap-4"
              >
                <div className="space-y-1.5 max-w-md w-full">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 animate-ping" />
                    <h3 className="font-orbitron font-bold text-base text-slate-100">
                      {exp.biome_name}
                    </h3>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-300">
                      {exp.squad_name}
                    </span>
                  </div>

                  <div className="flex items-center gap-3 font-mono text-xs text-slate-400">
                    <span className="flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5 text-cyan-400" />
                      {isDone ? 'MISSION ACCOMPLISHED' : `${Math.ceil(remaining)}s REMAINING`}
                    </span>
                    <span>•</span>
                    <span>
                      Est. Rewards: ~{exp.reward_preview?.estimated_credits || 500} Cr / ~{exp.reward_preview?.estimated_crystals || 15} 💎
                    </span>
                  </div>

                  {/* Progress Bar */}
                  <div className="w-full h-2.5 bg-slate-900 rounded-full overflow-hidden border border-slate-700/80 mt-2">
                    <div
                      className={`h-full transition-all duration-300 ${
                        isDone
                          ? 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]'
                          : 'bg-cyan-400 shadow-[0_0_8px_rgba(34,211,238,0.8)]'
                      }`}
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                </div>

                {/* Claim Button */}
                <div>
                  {exp.claimed ? (
                    <span className="px-4 py-2 rounded-xl bg-slate-800 text-slate-500 font-mono text-xs">
                      ALREADY CLAIMED
                    </span>
                  ) : isDone ? (
                    <button
                      disabled={claiming}
                      onClick={() => handleClaim(exp.id)}
                      className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-black font-orbitron font-bold text-xs uppercase tracking-wider shadow-lg shadow-emerald-500/20 animate-bounce"
                    >
                      CLAIM HARVESTED LOOT
                    </button>
                  ) : (
                    <span className="px-4 py-2 rounded-xl bg-cyan-950 text-cyan-300 border border-cyan-500/40 font-mono text-xs">
                      IN ORBIT ({Math.round(progress)}%)
                    </span>
                  )}
                </div>
              </div>
            );
          })
        ) : (
          <div className="hud-panel rounded-2xl p-10 text-center border border-cyan-500/20 max-w-lg mx-auto">
            <Satellite className="w-12 h-12 text-slate-600 mx-auto mb-3" />
            <h3 className="font-orbitron font-bold text-base text-slate-100">
              NO ACTIVE ORBITAL DISPATCHES
            </h3>
            <p className="text-xs font-mono text-slate-400 mt-1 mb-6">
              Dispatch your configured strike team to automate resource and gear collection.
            </p>

            <div className="grid grid-cols-2 gap-2 text-left font-mono text-xs">
              {biomes?.slice(0, 2).map((b) => (
                <button
                  key={b.id}
                  onClick={() => handleQuickDispatch(b.id)}
                  className="p-3 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 hover:border-cyan-400 transition"
                >
                  <span className="font-bold text-slate-200 block truncate">{b.name}</span>
                  <span className="text-[10px] text-cyan-400">Quick 60s Dispatch</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Claimed Loot Reveal Modal */}
      {claimedRewardModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md">
          <div className="w-full max-w-md rounded-2xl p-6 hud-panel border border-emerald-400 shadow-2xl text-center">
            <Gift className="w-14 h-14 text-emerald-400 mx-auto mb-3 animate-bounce" />
            <h3 className="font-orbitron font-black text-xl text-slate-100">
              ORBITAL REWARDS HARVESTED
            </h3>
            <p className="text-xs font-mono text-slate-300 mt-1 mb-4">
              Your squad successfully extracted telemetry, crystals, and gear modules.
            </p>

            <div className="bg-slate-900/80 rounded-xl p-4 border border-slate-700 font-mono text-xs space-y-2 mb-4">
              <div className="flex justify-around">
                <div>
                  <span className="text-slate-400 block text-[10px]">CREDITS</span>
                  <span className="text-amber-400 font-bold text-sm">
                    +{claimedRewardModal.credits.toLocaleString()}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px]">CRYSTALS</span>
                  <span className="text-cyan-400 font-bold text-sm">
                    +{claimedRewardModal.crystals}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px]">EXPERIENCE</span>
                  <span className="text-purple-400 font-bold text-sm">
                    +{claimedRewardModal.experience}
                  </span>
                </div>
              </div>
            </div>

            {/* Dropped Gear */}
            {claimedRewardModal.artifacts && claimedRewardModal.artifacts.length > 0 && (
              <div className="text-left mb-4">
                <span className="font-mono text-[10px] text-cyan-400 uppercase block mb-1 font-bold">
                  DROPPED ARTIFACTS:
                </span>
                {claimedRewardModal.artifacts.map((art, idx) => (
                  <div
                    key={idx}
                    className="p-2.5 rounded-lg bg-cyan-950/40 border border-cyan-400/40 text-xs font-mono mb-1.5 flex items-center justify-between"
                  >
                    <div>
                      <span className="font-bold text-slate-100 block">{art.name}</span>
                      <span className="text-[10px] text-cyan-300">
                        +{art.main_stat_value} {art.main_stat_name} (Set: {art.set_type})
                      </span>
                    </div>
                    <span className="text-[9px] px-2 py-0.5 rounded bg-cyan-900 text-cyan-200 uppercase">
                      {art.rarity}
                    </span>
                  </div>
                ))}
              </div>
            )}

            <button
              onClick={() => setClaimedRewardModal(null)}
              className="w-full py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black font-orbitron font-bold text-xs uppercase"
            >
              Collect & Store in Armory
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
