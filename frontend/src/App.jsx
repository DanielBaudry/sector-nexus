import React, { useEffect, useState } from 'react';
import HUDHeader from './components/HUDHeader';
import Navbar from './components/Navbar';
import CommandDeck from './views/CommandDeck';
import WarpBeaconView from './views/WarpBeaconView';
import ArmoryView from './views/ArmoryView';
import BarracksView from './views/BarracksView';
import ExpeditionMapView from './views/ExpeditionMapView';
import ExpeditionRunView from './views/ExpeditionRunView';
import { api } from './services/api';

export default function App() {
  const [activeTab, setActiveTab] = useState('deck');
  const [player, setPlayer] = useState(null);
  const [champions, setChampions] = useState([]);
  const [artifacts, setArtifacts] = useState([]);
  const [squads, setSquads] = useState([]);
  const [biomes, setBiomes] = useState([]);
  const [activeRun, setActiveRun] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Load all initial game data with automatic retry
  const loadInitialData = async (attempts = 3) => {
    try {
      setLoading(true);
      setError(null);
      const [
        playerData,
        championsData,
        artifactsData,
        squadsData,
        biomesData,
        activeRunData,
      ] = await Promise.all([
        api.getPlayerProfile(),
        api.getChampions(),
        api.getArtifacts(),
        api.getSquads(),
        api.getBiomes(),
        api.getActiveRun(),
      ]);

      setPlayer(playerData);
      setChampions(championsData);
      setArtifacts(artifactsData);
      setSquads(squadsData);
      setBiomes(biomesData);
      setActiveRun(activeRunData);
      setLoading(false);
    } catch (err) {
      if (attempts > 1) {
        setTimeout(() => loadInitialData(attempts - 1), 1000);
      } else {
        setError(err.message || 'Failed to connect to Command Core API. Ensure backend is running.');
        setLoading(false);
      }
    }
  };

  useEffect(() => {
    loadInitialData();
  }, []);

  const handleResupply = async () => {
    try {
      const updatedPlayer = await api.resupplyPlayer();
      setPlayer(updatedPlayer);
    } catch (err) {
      alert('Resupply error: ' + err.message);
    }
  };

  const refreshChampions = async () => {
    try {
      const data = await api.getChampions();
      setChampions(data);
    } catch (err) {}
  };

  const refreshArtifacts = async () => {
    try {
      const data = await api.getArtifacts();
      setArtifacts(data);
    } catch (err) {}
  };

  // Lock the player inside the expedition view while a run exists.
  useEffect(() => {
    if (activeRun && activeTab !== 'combat') setActiveTab('combat');
  }, [activeRun, activeTab]);

  const handleStartCombat = (run) => {
    setActiveRun(run);
    setActiveTab('combat');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#050811] flex flex-col items-center justify-center text-slate-100 font-mono space-y-4">
        <div className="w-16 h-16 border-4 border-cyan-500/20 border-t-cyan-400 rounded-full animate-spin" />
        <div className="font-orbitron font-bold text-lg tracking-widest text-cyan-400 animate-pulse">
          INITIALIZING SECTOR NEXUS CORE...
        </div>
        <p className="text-xs text-slate-500">Connecting to tactical neural telemetry & databases</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-[#050811] flex flex-col items-center justify-center text-slate-100 font-mono p-4">
        <div className="hud-panel rounded-2xl p-8 max-w-md text-center border-red-500/40">
          <h2 className="font-orbitron font-bold text-red-400 text-xl mb-2">TELEMETRY ERROR</h2>
          <p className="text-xs text-slate-300 mb-6">{error}</p>
          <button
            onClick={loadInitialData}
            className="px-6 py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-black font-orbitron font-bold text-xs uppercase"
          >
            Retry Core Connection
          </button>
        </div>
      </div>
    );
  }

  const runInProgress = !!activeRun && !['VICTORY', 'DEFEAT', 'ABANDONED'].includes(activeRun.status);
  // Expedition mode: while a run exists (even finished, until its report is closed) the
  // rest of the base is locked — extract or win to leave. No HUD / nav: full immersion.
  const inExpedition = !!activeRun;
  const hasActiveCombat = runInProgress;
  // Summary consumed by the HUD header and Command Deck widgets.
  const expeditionSummary = activeRun
    ? {
        biome_name: activeRun.biome_name,
        status: runInProgress ? 'IN_PROGRESS' : activeRun.status,
        room_index: activeRun.nodes.find((n) => n.id === activeRun.current_node_id)?.row ?? 0,
        total_rooms: Math.max(...activeRun.nodes.map((n) => n.row)) + 1,
      }
    : null;

  return (
    <div className={`${activeTab === 'combat' ? 'h-screen overflow-hidden' : activeTab === 'expeditions' ? 'min-h-screen lg:h-screen lg:overflow-hidden' : 'min-h-screen'} bg-[#050811] text-slate-100 flex flex-col relative selection:bg-cyan-500 selection:text-black`}>
      {/* Background Holographic Scanlines */}
      <div className="fixed inset-0 scanlines pointer-events-none z-50 opacity-40" />

      {!inExpedition && (
        <>
          {/* Persistent HUD Header */}
          <HUDHeader
            player={player}
            onResupply={handleResupply}
            activeExpedition={expeditionSummary}
          />

          {/* Navigation Bar */}
          <Navbar
            activeTab={activeTab}
            setActiveTab={setActiveTab}
            hasActiveCombat={hasActiveCombat}
          />
        </>
      )}

      {/* Main Tactical Viewport */}
      <main className={`flex-1 w-full mx-auto relative z-10 ${
        activeTab === 'combat'
          ? 'min-h-0 overflow-hidden'
          : activeTab === 'expeditions'
          ? 'min-h-0 lg:overflow-hidden px-4 py-4 max-w-[1920px]'
          : 'max-w-7xl p-4 sm:p-6 pb-20'
      }`}>
        {activeTab === 'deck' && (
          <CommandDeck
            player={player}
            squads={squads}
            champions={champions}
            activeExpedition={expeditionSummary}
            setActiveTab={setActiveTab}
          />
        )}

        {activeTab === 'gacha' && (
          <WarpBeaconView onPrinted={refreshChampions} />
        )}

        {activeTab === 'champions' && (
          <ArmoryView
            champions={champions}
            artifacts={artifacts}
            player={player}
            squads={squads}
            onRefreshChampions={refreshChampions}
            onRefreshArtifacts={refreshArtifacts}
            onRefreshPlayer={(p) => setPlayer(p)}
          />
        )}

        {activeTab === 'barracks' && (
          <BarracksView onPlayerUpdated={(p) => setPlayer(p)} />
        )}

        {activeTab === 'expeditions' && (
          <ExpeditionMapView
            biomes={biomes}
            squads={squads}
            champions={champions}
            activeRun={activeRun}
            onStartCombat={handleStartCombat}
            onOpenBarracks={() => setActiveTab('barracks')}
          />
        )}

        {activeTab === 'combat' && (
          <ExpeditionRunView
            run={activeRun}
            planet={biomes.find((b) => b.id === activeRun?.biome_id)}
            onRunUpdated={(updated) => setActiveRun(updated)}
            onRunCleared={async () => {
              setActiveRun(null);
              setActiveTab('deck');
              const [pData, chData, artData] = await Promise.all([
                api.getPlayerProfile(),
                api.getChampions(),
                api.getArtifacts(),
              ]);
              setPlayer(pData);
              setChampions(chData);
              setArtifacts(artData);
            }}
            setActiveTab={setActiveTab}
          />
        )}

      </main>

      {/* Bottom Footer Info */}
      {activeTab !== 'combat' && activeTab !== 'expeditions' && (
        <footer className="border-t border-slate-900 bg-[#04060d] py-3 px-4 text-center font-mono text-[13px] text-slate-500">
          SECTOR NEXUS // FASTAPI CLEAN ARCHITECTURE & REACT HUD // V1.0.0
        </footer>
      )}
    </div>
  );
}
