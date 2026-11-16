import React, { useEffect, useState } from 'react';
import HUDHeader from './components/HUDHeader';
import Navbar from './components/Navbar';
import CommandDeck from './views/CommandDeck';
import WarpBeaconView from './views/WarpBeaconView';
import ArmoryView from './views/ArmoryView';
import SquadBuilderView from './views/SquadBuilderView';
import ExpeditionMapView from './views/ExpeditionMapView';
import ActiveExpeditionView from './views/ActiveExpeditionView';
import BackgroundExpeditionView from './views/BackgroundExpeditionView';
import { api } from './services/api';

export default function App() {
  const [activeTab, setActiveTab] = useState('deck');
  const [player, setPlayer] = useState(null);
  const [banners, setBanners] = useState([]);
  const [champions, setChampions] = useState([]);
  const [artifacts, setArtifacts] = useState([]);
  const [squads, setSquads] = useState([]);
  const [biomes, setBiomes] = useState([]);
  const [activeExpedition, setActiveExpedition] = useState(null);
  const [backgroundExpeditions, setBackgroundExpeditions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Load all initial game data with automatic retry
  const loadInitialData = async (attempts = 3) => {
    try {
      setLoading(true);
      setError(null);
      const [
        playerData,
        bannersData,
        championsData,
        artifactsData,
        squadsData,
        biomesData,
        activeExpData,
        bgExpData,
      ] = await Promise.all([
        api.getPlayerProfile(),
        api.getBanners(),
        api.getChampions(),
        api.getArtifacts(),
        api.getSquads(),
        api.getBiomes(),
        api.getActiveExpedition(),
        api.getBackgroundExpeditions(),
      ]);

      setPlayer(playerData);
      setBanners(bannersData);
      setChampions(championsData);
      setArtifacts(artifactsData);
      setSquads(squadsData);
      setBiomes(biomesData);
      setActiveExpedition(activeExpData);
      setBackgroundExpeditions(bgExpData);
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

  // Periodic poll for background expeditions and active combat
  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const [bgData, actData] = await Promise.all([
          api.getBackgroundExpeditions(),
          api.getActiveExpedition(),
        ]);
        setBackgroundExpeditions(bgData);
        if (actData) setActiveExpedition(actData);
      } catch (err) {
        // silent fail on poll
      }
    }, 3000);

    return () => clearInterval(interval);
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

  const refreshSquads = async () => {
    try {
      const data = await api.getSquads();
      setSquads(data);
    } catch (err) {}
  };

  const refreshBackground = async () => {
    try {
      const data = await api.getBackgroundExpeditions();
      setBackgroundExpeditions(data);
    } catch (err) {}
  };

  const handleStartCombat = (expedition) => {
    setActiveExpedition(expedition);
    setActiveTab('combat');
  };

  const handleDispatchIdle = async () => {
    await refreshBackground();
    setActiveTab('idle');
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

  const hasActiveCombat = activeExpedition && activeExpedition.status === 'IN_PROGRESS';

  return (
    <div className="min-h-screen bg-[#050811] text-slate-100 flex flex-col relative selection:bg-cyan-500 selection:text-black">
      {/* Background Holographic Scanlines */}
      <div className="fixed inset-0 scanlines pointer-events-none z-50 opacity-40" />

      {/* Persistent HUD Header */}
      <HUDHeader
        player={player}
        onResupply={handleResupply}
        activeExpedition={activeExpedition}
        backgroundCount={backgroundExpeditions.filter((e) => !e.claimed).length}
      />

      {/* Navigation Bar */}
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        hasActiveCombat={hasActiveCombat}
      />

      {/* Main Tactical Viewport */}
      <main className={`flex-1 w-full mx-auto relative z-10 ${
        activeTab === 'combat'
          ? 'h-[calc(100vh-115px)] max-h-[calc(100vh-115px)] overflow-hidden px-3 py-1 max-w-[1440px]'
          : 'max-w-7xl p-4 sm:p-6 pb-20'
      }`}>
        {activeTab === 'deck' && (
          <CommandDeck
            player={player}
            squads={squads}
            champions={champions}
            activeExpedition={activeExpedition}
            backgroundExpeditions={backgroundExpeditions}
            setActiveTab={setActiveTab}
          />
        )}

        {activeTab === 'gacha' && (
          <WarpBeaconView
            banners={banners}
            player={player}
            onSummonSuccess={async (updatedPlayer) => {
              setPlayer(updatedPlayer);
              await refreshChampions();
            }}
          />
        )}

        {activeTab === 'champions' && (
          <ArmoryView
            champions={champions}
            artifacts={artifacts}
            player={player}
            onRefreshChampions={refreshChampions}
            onRefreshArtifacts={refreshArtifacts}
            onRefreshPlayer={(p) => setPlayer(p)}
          />
        )}

        {activeTab === 'squad' && (
          <SquadBuilderView
            squads={squads}
            champions={champions}
            onRefreshSquads={refreshSquads}
          />
        )}

        {activeTab === 'expeditions' && (
          <ExpeditionMapView
            biomes={biomes}
            squads={squads}
            onStartCombat={handleStartCombat}
            onDispatchIdle={handleDispatchIdle}
          />
        )}

        {activeTab === 'combat' && (
          <ActiveExpeditionView
            expedition={activeExpedition}
            onCombatUpdated={(updated) => setActiveExpedition(updated)}
            onExpeditionFinished={async () => {
              const [pData, chData] = await Promise.all([
                api.getPlayerProfile(),
                api.getChampions(),
              ]);
              setPlayer(pData);
              setChampions(chData);
              setActiveExpedition(null);
            }}
            setActiveTab={setActiveTab}
          />
        )}

        {activeTab === 'idle' && (
          <BackgroundExpeditionView
            backgroundExpeditions={backgroundExpeditions}
            biomes={biomes}
            squads={squads}
            onClaimSuccess={(updatedPlayer) => {
              setPlayer(updatedPlayer);
              refreshArtifacts();
            }}
            onRefreshBackground={refreshBackground}
            setActiveTab={setActiveTab}
          />
        )}
      </main>

      {/* Bottom Footer Info */}
      {activeTab !== 'combat' && (
        <footer className="border-t border-slate-900 bg-[#04060d] py-3 px-4 text-center font-mono text-[11px] text-slate-500">
          SECTOR NEXUS // FASTAPI CLEAN ARCHITECTURE & REACT HUD // V1.0.0
        </footer>
      )}
    </div>
  );
}
