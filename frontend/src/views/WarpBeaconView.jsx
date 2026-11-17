import React, { useState } from 'react';
import { Sparkles, Zap, Shield, Flame, Radio, X, CheckCircle } from 'lucide-react';
import { api } from '../services/api';

export default function WarpBeaconView({ banners, player, onSummonSuccess }) {
  const [selectedBanner, setSelectedBanner] = useState(banners?.[0]?.id || 'banner_standard');
  const [summoning, setSummoning] = useState(false);
  const [revealedChampions, setRevealedChampions] = useState(null);
  const [errorMsg, setErrorMsg] = useState(null);

  const currentBanner = banners?.find((b) => b.id === selectedBanner) || banners?.[0];

  const handleSummon = async (count) => {
    if (!currentBanner) return;
    setErrorMsg(null);
    setSummoning(true);

    try {
      const res = await api.summon(currentBanner.faction, count);
      setRevealedChampions(res.summoned);
      if (onSummonSuccess) onSummonSuccess(res.player);
    } catch (err) {
      setErrorMsg(err.message || 'Failed to initiate warp invocation.');
    } finally {
      setSummoning(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Banner Selector Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="font-orbitron font-black text-2xl text-slate-100 flex items-center gap-2">
            <Sparkles className="w-6 h-6 text-purple-400" />
            WARP BEACON INVOCATION
          </h2>
          <p className="text-xs font-mono text-slate-400 mt-0.5">
            RESONATE PSIONIC BEACONS TO SUMMON SECTOR HEROES & PROTOTYPES
          </p>
        </div>

        {/* Drop Rates Box */}
        <div className="flex items-center gap-3 px-3 py-1.5 rounded-lg bg-slate-900/80 border border-slate-700 font-mono text-xs">
          <span className="text-amber-400 font-bold">LEGENDARY: 3%</span>
          <span className="text-purple-400 font-bold">EPIC: 15%</span>
          <span className="text-cyan-400 font-bold">RARE: 42%</span>
          <span className="text-slate-400">COMMON: 40%</span>
        </div>
      </div>

      {errorMsg && (
        <div className="p-3 rounded-lg bg-red-950/80 border border-red-500/50 text-red-300 font-mono text-xs">
          ⚠️ {errorMsg}
        </div>
      )}

      {/* Banner Selection Tabs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {banners?.map((b) => {
          const isSelected = selectedBanner === b.id;
          return (
            <button
              key={b.id}
              onClick={() => setSelectedBanner(b.id)}
              className={`p-4 rounded-xl border text-left transition-all ${
                isSelected
                  ? 'bg-gradient-to-b from-[#13203d] to-[#0a1122] border-cyan-400 shadow-lg shadow-cyan-500/20'
                  : 'bg-[#090f1d] border-slate-800 hover:border-slate-700 text-slate-400'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-mono text-cyan-400 uppercase font-semibold">
                  {b.faction === 'ALL' ? 'UNIVERSAL' : b.faction}
                </span>
                {isSelected && <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping"></span>}
              </div>
              <h4 className="font-orbitron font-bold text-sm text-slate-100">{b.name}</h4>
              <p className="text-[13px] text-slate-400 mt-1 line-clamp-1">{b.subtitle}</p>
              <div className="mt-3 text-[12px] font-mono text-amber-400 font-semibold">
                {b.featured_rarity}
              </div>
            </button>
          );
        })}
      </div>

      {/* Featured Banner Showcase */}
      {currentBanner && (
        <div className={`relative overflow-hidden rounded-2xl border border-cyan-500/30 bg-gradient-to-r ${currentBanner.bg_color} p-6 sm:p-8 shadow-2xl`}>
          <div className="relative z-10 max-w-xl">
            <span className="font-mono text-xs px-2.5 py-1 rounded bg-black/50 text-cyan-300 border border-cyan-500/40 uppercase">
              WARP PROTOCOL // {currentBanner.faction.toUpperCase()}
            </span>
            <h3 className="font-orbitron font-black text-3xl text-slate-100 mt-3 tracking-wide">
              {currentBanner.name}
            </h3>
            <p className="text-sm text-slate-200 mt-2 leading-relaxed">
              {currentBanner.subtitle}. Invocations pull high-resonance genetic mutations, psionic templars, and dominion heavy assault units.
            </p>

            <div className="mt-8 flex flex-wrap items-center gap-4">
              {/* 1x Summon Button */}
              <button
                disabled={summoning}
                onClick={() => handleSummon(1)}
                className="flex items-center gap-2.5 px-6 py-3 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-black font-orbitron font-bold text-xs uppercase tracking-wider shadow-lg shadow-cyan-500/30 transition disabled:opacity-50"
              >
                <Zap className="w-4 h-4 fill-black" />
                <span>WARP 1X</span>
                <span className="font-mono text-[13px] opacity-80">(1 Shard / 150 💎)</span>
              </button>

              {/* 10x Summon Button */}
              <button
                disabled={summoning}
                onClick={() => handleSummon(10)}
                className="flex items-center gap-2.5 px-6 py-3 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-orbitron font-bold text-xs uppercase tracking-wider shadow-lg shadow-purple-500/30 transition disabled:opacity-50"
              >
                <Sparkles className="w-4 h-4 text-purple-300" />
                <span>WARP 10X</span>
                <span className="font-mono text-[13px] opacity-80">(10 Shards / 1,500 💎)</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Summon Reveal Modal */}
      {revealedChampions && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md">
          <div className="relative w-full max-w-4xl max-h-[90vh] overflow-y-auto hud-panel rounded-2xl p-6 border border-cyan-400 shadow-2xl">
            <div className="flex items-center justify-between pb-4 border-b border-slate-700">
              <div className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-cyan-400 animate-spin" />
                <h3 className="font-orbitron font-black text-xl text-slate-100">
                  WARP INVOCATION RESULTS ({revealedChampions.length})
                </h3>
              </div>
              <button
                onClick={() => setRevealedChampions(null)}
                className="p-1 rounded-lg bg-slate-800 text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 my-6">
              {revealedChampions.map((c, idx) => {
                const isLegendary = c.rarity === 'Legendary';
                const isEpic = c.rarity === 'Epic';
                const isRare = c.rarity === 'Rare';

                let borderGlow = 'border-slate-700 bg-slate-900/60';
                let rarityColor = 'text-slate-400';
                if (isLegendary) {
                  borderGlow = 'border-amber-400 bg-amber-950/40 shadow-lg shadow-amber-500/30 animate-pulse';
                  rarityColor = 'text-amber-400 font-bold';
                } else if (isEpic) {
                  borderGlow = 'border-purple-400 bg-purple-950/40 shadow-md shadow-purple-500/20';
                  rarityColor = 'text-purple-400 font-bold';
                } else if (isRare) {
                  borderGlow = 'border-cyan-400 bg-cyan-950/30';
                  rarityColor = 'text-cyan-400';
                }

                return (
                  <div
                    key={idx}
                    className={`p-3 rounded-xl border flex flex-col justify-between text-center transition ${borderGlow}`}
                  >
                    <div>
                      <div
                        className="w-12 h-12 mx-auto rounded-xl flex items-center justify-center font-orbitron font-bold text-black text-sm shadow-md mb-2"
                        style={{ backgroundColor: c.avatar_color || '#3b82f6' }}
                      >
                        {c.name.slice(0, 2).toUpperCase()}
                      </div>
                      <span className={`text-[12px] font-mono uppercase block ${rarityColor}`}>
                        {c.rarity}
                      </span>
                      <h4 className="font-orbitron font-bold text-xs text-slate-100 mt-1 line-clamp-1">
                        {c.name}
                      </h4>
                      <span className="text-[11px] font-mono text-slate-400 block line-clamp-1">
                        {c.title}
                      </span>
                    </div>

                    <div className="mt-3 pt-2 border-t border-slate-800 text-[12px] font-mono text-slate-400">
                      <span>{c.faction}</span>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t border-slate-700">
              <button
                onClick={() => setRevealedChampions(null)}
                className="px-6 py-2 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-black font-orbitron font-bold text-xs uppercase"
              >
                Accept & Review Armory
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
