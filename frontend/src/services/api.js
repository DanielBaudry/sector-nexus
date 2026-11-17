const BASE_URL = '/api';

async function handleResponse(res) {
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.detail || `Request failed with status ${res.status}`);
  }
  return res.json();
}

export const api = {
  // Player
  getPlayerProfile: () => fetch(`${BASE_URL}/player`).then(handleResponse),
  resupplyPlayer: () => fetch(`${BASE_URL}/player/resupply`, { method: 'POST' }).then(handleResponse),

  // Gacha
  getBanners: () => fetch(`${BASE_URL}/gacha/banners`).then(handleResponse),
  summon: (banner_faction = 'ALL', count = 1) =>
    fetch(`${BASE_URL}/gacha/summon`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ banner_faction, count }),
    }).then(handleResponse),

  // Champions
  getChampions: () => fetch(`${BASE_URL}/champions`).then(handleResponse),
  updateGambits: (championId, gambits) =>
    fetch(`${BASE_URL}/champions/${championId}/gambits`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ gambits }),
    }).then(handleResponse),
  equipArtifact: (championId, artifactId) =>
    fetch(`${BASE_URL}/champions/${championId}/equip`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ artifact_id: artifactId }),
    }).then(handleResponse),
  unequipArtifact: (championId, slot) =>
    fetch(`${BASE_URL}/champions/${championId}/unequip`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ slot }),
    }).then(handleResponse),

  feedChampionXP: (championId, amount = null) =>
    fetch(`${BASE_URL}/champions/${championId}/feed-xp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount }),
    }).then(handleResponse),
  rankUpChampion: (championId, fodder_ids) =>
    fetch(`${BASE_URL}/champions/${championId}/rank-up`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fodder_ids }),
    }).then(handleResponse),

  // Artifacts
  getArtifacts: () => fetch(`${BASE_URL}/artifacts`).then(handleResponse),
  upgradeArtifact: (artifactId) =>
    fetch(`${BASE_URL}/artifacts/${artifactId}/upgrade`, { method: 'POST' }).then(handleResponse),

  // Squads
  getSquads: () => fetch(`${BASE_URL}/squads`).then(handleResponse),
  updateSquad: (id, name, champion_ids) =>
    fetch(`${BASE_URL}/squads`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, name, champion_ids }),
    }).then(handleResponse),

  // Expeditions
  getBiomes: () => fetch(`${BASE_URL}/expeditions/biomes`).then(handleResponse),
  getActiveExpedition: () => fetch(`${BASE_URL}/expeditions/active`).then(handleResponse),
  startExpedition: (biome_id, squad_id = 'squad_alpha') =>
    fetch(`${BASE_URL}/expeditions/start`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ biome_id, squad_id }),
    }).then(handleResponse),
  sendCardChoice: (card_id = null) =>
    fetch(`${BASE_URL}/expeditions/choice`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ card_id }),
    }).then(handleResponse),
  tickExpedition: () =>
    fetch(`${BASE_URL}/expeditions/tick`, { method: 'POST' }).then(handleResponse),

  // Expedition Runs (node map + 3-lane battles)
  getTroopCatalog: () => fetch(`${BASE_URL}/runs/troops`).then(handleResponse),
  getActiveRun: () => fetch(`${BASE_URL}/runs/active`).then(handleResponse),
  // Planet hierarchy
  getHierarchy: (planetId) => fetch(`${BASE_URL}/hierarchy/${planetId}`).then(handleResponse),
  setHierarchyTarget: (boss_id) =>
    fetch(`${BASE_URL}/hierarchy/target`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ boss_id }),
    }).then(handleResponse),
  startBossRun: (boss_id, champion_ids, troop_assignments = null, difficulty = 1) =>
    fetch(`${BASE_URL}/runs/boss/start`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ boss_id, champion_ids, troop_assignments, difficulty }),
    }).then(handleResponse),
  startRun: (biome_id, squad_id = 'squad_alpha', troop_assignments = null, difficulty = 1) =>
    fetch(`${BASE_URL}/runs/start`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ biome_id, squad_id, troop_assignments, difficulty }),
    }).then(handleResponse),
  chooseRunNode: (node_id) =>
    fetch(`${BASE_URL}/runs/active/node`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ node_id }),
    }).then(handleResponse),
  deployHeroes: (assignments) =>
    fetch(`${BASE_URL}/runs/active/deploy`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ assignments }),
    }).then(handleResponse),
  playAbility: (card_id = null, target_lane = null, target_unit_id = null) =>
    fetch(`${BASE_URL}/runs/active/ability`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ card_id, target_lane, target_unit_id }),
    }).then(handleResponse),
  tickRun: () => fetch(`${BASE_URL}/runs/active/tick`, { method: 'POST' }).then(handleResponse),
  abandonRun: () => fetch(`${BASE_URL}/runs/active/abandon`, { method: 'POST' }).then(handleResponse),
  dismissRun: () => fetch(`${BASE_URL}/runs/active`, { method: 'DELETE' }).then(handleResponse),
};
