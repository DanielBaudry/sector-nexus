import React from 'react';
import { LayoutDashboard, Sparkles, Shield, Compass, Swords } from 'lucide-react';

export default function Navbar({ activeTab, setActiveTab, hasActiveCombat }) {
  const tabs = [
    { id: 'deck', label: 'Command Deck', icon: LayoutDashboard },
    { id: 'gacha', label: 'Warp Beacon', icon: Sparkles, badge: 'SUMMON' },
    { id: 'champions', label: 'Armory & AI', icon: Shield },
    { id: 'expeditions', label: 'Sector Map', icon: Compass },
    { id: 'combat', label: 'Tactical Combat', icon: Swords, alert: hasActiveCombat },
  ];

  return (
    <nav className="hud-panel border-y border-cyan-500/10 bg-[#090e1d]/80 py-1.5 px-4 sticky top-[65px] z-30">
      <div className="max-w-7xl mx-auto flex items-center justify-start sm:justify-center gap-1 sm:gap-2 overflow-x-auto no-scrollbar">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;

          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-lg font-mono text-xs uppercase transition-all duration-150 whitespace-nowrap relative ${
                isActive
                  ? 'bg-gradient-to-r from-cyan-950 to-blue-950 border border-cyan-400 text-cyan-300 shadow-md shadow-cyan-500/20'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40 border border-transparent'
              }`}
            >
              <Icon className={`w-4 h-4 ${isActive ? 'text-cyan-400' : 'text-slate-400'}`} />
              <span className="font-semibold">{tab.label}</span>

              {tab.badge && (
                <span className="text-[11px] px-1 py-0.2 rounded bg-purple-900/60 text-purple-300 border border-purple-500/40 font-mono">
                  {tab.badge}
                </span>
              )}

              {tab.alert && (
                <span className="flex h-2 w-2 relative">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
                </span>
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
