import React from 'react';
import { Shield, Sparkles, Coins, RefreshCw, Radio, FlaskConical } from 'lucide-react';

export default function HUDHeader({ player, onResupply, activeExpedition }) {
  if (!player) return null;

  return (
    <header className="hud-panel sticky top-0 z-40 px-4 py-3 border-b border-cyan-500/20 bg-[#060b18]/90 backdrop-blur-md">
      <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-4">
        {/* Commander ID */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-cyan-500 to-blue-700 flex items-center justify-center shadow-lg shadow-cyan-500/20 border border-cyan-300/40">
            <Radio className="w-5 h-5 text-black" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-orbitron font-bold text-sm tracking-widest text-cyan-400">
                {player.username.toUpperCase()}
              </span>
              <span className="text-[12px] uppercase font-mono px-1.5 py-0.5 rounded bg-cyan-950 text-cyan-300 border border-cyan-500/30">
                LVL {player.level}
              </span>
            </div>
            <div className="text-[13px] text-slate-400 font-mono">
              COMMAND SECTOR // ALPHA-7
            </div>
          </div>
        </div>

        {/* Currencies & Resources */}
        <div className="flex items-center gap-3 sm:gap-6 flex-wrap">
          {/* Warp Crystals */}
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-cyan-950/40 border border-cyan-500/30">
            <Sparkles className="w-4 h-4 text-cyan-400 animate-pulse" />
            <div className="flex flex-col">
              <span className="text-[12px] text-slate-400 font-mono uppercase">Crystals</span>
              <span className="font-orbitron text-sm font-bold text-cyan-300">{player.crystals.toLocaleString()}</span>
            </div>
          </div>

          {/* Credits */}
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-amber-950/40 border border-amber-500/30">
            <Coins className="w-4 h-4 text-amber-400" />
            <div className="flex flex-col">
              <span className="text-[12px] text-slate-400 font-mono uppercase">Credits</span>
              <span className="font-orbitron text-sm font-bold text-amber-300">{player.credits.toLocaleString()}</span>
            </div>
          </div>

          {/* Champion XP capsules (earned on expeditions, spent in the Armory) */}
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-fuchsia-950/40 border border-fuchsia-500/30" title="Champion XP capsules — distribute in the Armory">
            <FlaskConical className="w-4 h-4 text-fuchsia-400" />
            <div className="flex flex-col">
              <span className="text-[12px] text-slate-400 font-mono uppercase">XP Pool</span>
              <span className="font-orbitron text-sm font-bold text-fuchsia-300">{(player.champion_xp || 0).toLocaleString()}</span>
            </div>
          </div>

          {/* Mission Indicators */}
          {activeExpedition && activeExpedition.status === 'IN_PROGRESS' && (
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-red-950/60 border border-red-500/50 text-red-400 text-xs font-mono animate-pulse">
              <span className="w-2 h-2 rounded-full bg-red-500 animate-ping"></span>
              COMBAT ENGAGED
            </div>
          )}

          {/* Emergency Resupply */}
          <button
            onClick={onResupply}
            title="Testing: refill crystals, credits and 25,000 champion XP"
            className="flex items-center gap-1 px-2.5 py-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-mono border border-slate-600 transition"
          >
            <RefreshCw className="w-3 h-3" />
            <span>RESUPPLY</span>
          </button>
        </div>
      </div>
    </header>
  );
}
