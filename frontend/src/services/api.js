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

  // Background Idle Expeditions
  getBackgroundExpeditions: () => fetch(`${BASE_URL}/expeditions/background`).then(handleResponse),
  dispatchBackground: (biome_id, squad_id = 'squad_alpha', duration_seconds = 60) =>
    fetch(`${BASE_URL}/expeditions/background/dispatch`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ biome_id, squad_id, duration_seconds }),
    }).then(handleResponse),
  claimBackground: (expeditionId) =>
    fetch(`${BASE_URL}/expeditions/background/${expeditionId}/claim`, {
      method: 'POST',
    }).then(handleResponse),
};
