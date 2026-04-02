import { Game } from './Game';
import { Difficulty, Faction, TileType } from './constants';
import type { MapType } from './map/MapData';
import { SCENARIOS } from './scenarios/scenarios';
import type { Scenario } from './scenarios/ScenarioTypes';
import { TERRAN_CAMPAIGN, ZERG_CAMPAIGN, getCampaignProgress, isMissionUnlocked } from './scenarios/campaign';
import { MapEditor } from './map/MapEditor';
import { ACHIEVEMENTS, getUnlockedAchievements } from './stats/Achievements';

const startScreen = document.getElementById('start-screen');
const playBtn = document.getElementById('play-btn');
const watchReplayBtn = document.getElementById('watch-replay-btn') as HTMLButtonElement | null;
const container = document.getElementById('game-container');

if (!container) throw new Error('Missing #game-container element');

// Enable Watch Replay button if a saved replay exists
const savedReplay = localStorage.getItem('swarm_last_replay');
if (watchReplayBtn && savedReplay) {
  watchReplayBtn.style.opacity = '1';
  watchReplayBtn.style.cursor = 'pointer';
  watchReplayBtn.style.pointerEvents = 'auto';
}

function startGame(): void {
  if (startScreen) startScreen.style.display = 'none';
  const game = new Game();

  const activeDiffCard = document.querySelector('.diff-card.active') as HTMLElement | null;
  const diffValue = activeDiffCard ? parseInt(activeDiffCard.dataset.value || '1', 10) : Difficulty.Normal;
  game.setDifficulty(diffValue as Difficulty);

  const mapSelect = document.getElementById('map-select') as HTMLSelectElement | null;
  const mapValue = mapSelect ? parseInt(mapSelect.value, 10) : 0;
  game.setMapType(mapValue as MapType);

  const mineralsSelect = document.getElementById('starting-minerals') as HTMLSelectElement | null;
  if (mineralsSelect) {
    game.setStartingMinerals(parseInt(mineralsSelect.value, 10));
  }

  const fogSelect = document.getElementById('fog-enabled') as HTMLSelectElement | null;
  if (fogSelect) {
    game.setFogEnabled(fogSelect.value === '1');
  }

  const speedSelect = document.getElementById('game-speed') as HTMLSelectElement | null;
  if (speedSelect) {
    game.setGameSpeedIndex(parseInt(speedSelect.value, 10));
  }

  const survivalSelect = document.getElementById('survival-mode') as HTMLSelectElement | null;
  if (survivalSelect) {
    game.setSurvivalMode(survivalSelect.value === '1');
  }

  const turboSelect = document.getElementById('turbo-mode') as HTMLSelectElement | null;
  if (turboSelect) {
    game.setTurboMode(turboSelect.value === '1');
  }

  const winConditionSelect = document.getElementById('win-condition') as HTMLSelectElement | null;
  if (winConditionSelect) {
    game.setWinCondition(winConditionSelect.value);
  }

  // Read faction selection
  const factionZergBtn = document.getElementById('faction-zerg') as HTMLButtonElement | null;
  const isZerg = factionZergBtn?.dataset.selected === 'true';
  game.setPlayerFaction(isZerg ? 2 : 1); // 1=Terran, 2=Zerg (Faction enum values)

  game.init(container!).catch((err) => {
    console.error('Failed to initialize game:', err);
  });
}

function watchReplay(): void {
  const json = localStorage.getItem('swarm_last_replay');
  if (!json) return;
  if (startScreen) startScreen.style.display = 'none';
  const game = new Game();
  game.prepareReplay(json);
  game.init(container!).catch((err) => {
    console.error('Failed to start replay:', err);
  });
}

if (playBtn) {
  playBtn.addEventListener('click', startGame);
} else {
  startGame();
}

if (watchReplayBtn && savedReplay) {
  watchReplayBtn.addEventListener('click', watchReplay);
}

// ── Scenario browser ──
const scenarioList = document.getElementById('scenario-list');
const scenarioBrowser = document.getElementById('scenario-browser');
const practiceBtn = document.getElementById('practice-btn');
const backBtn = document.getElementById('back-to-menu');

if (scenarioList) {
  for (const s of SCENARIOS) {
    const card = document.createElement('div');
    card.style.cssText = `
      background: rgba(20,40,60,0.8); border: 1px solid rgba(60,100,160,0.4);
      padding: 10px 14px; cursor: pointer; border-radius: 4px;
      transition: border-color 0.15s;
    `;
    card.innerHTML = `
      <div style="color:#cce0ff;font-size:13px;font-weight:bold">${s.title}
        <span style="color:#667;font-size:11px;margin-left:8px">${'\u2605'.repeat(s.difficulty)}${'\u2606'.repeat(3 - s.difficulty)}</span>
      </div>
      <div style="color:#8899aa;font-size:11px;margin-top:4px">${s.description}</div>
      <div style="color:#557799;font-size:10px;margin-top:4px">SC2 concept: ${s.sc2Concept}</div>
    `;
    card.addEventListener('mouseenter', () => { card.style.borderColor = 'rgba(60,140,255,0.7)'; });
    card.addEventListener('mouseleave', () => { card.style.borderColor = 'rgba(60,100,160,0.4)'; });
    card.addEventListener('click', () => { startScenario(s); });
    scenarioList.appendChild(card);
  }
}

practiceBtn?.addEventListener('click', () => {
  // Hide main menu elements, show scenario browser
  document.querySelectorAll('#start-screen .controls, #start-screen .play-btn, #start-screen select, #start-screen details').forEach(el => {
    (el as HTMLElement).style.display = 'none';
  });
  // Hide faction buttons and their label containers
  document.querySelectorAll('#start-screen > div[style*="margin"]').forEach(el => {
    (el as HTMLElement).style.display = 'none';
  });
  if (practiceBtn) practiceBtn.style.display = 'none';
  if (scenarioBrowser) scenarioBrowser.style.display = 'block';
});

backBtn?.addEventListener('click', () => {
  window.location.reload();
});

// ── Campaign browser ──
const campaignBtn = document.getElementById('campaign-btn');
const campaignBrowser = document.getElementById('campaign-browser');
const campaignList = document.getElementById('campaign-list');
const campaignBack = document.getElementById('campaign-back');
const campaignTabTerran = document.getElementById('campaign-tab-terran');
const campaignTabZerg = document.getElementById('campaign-tab-zerg');

let activeCampaignTab: 'terran' | 'zerg' = 'terran';

function renderCampaignMissions(faction: 'terran' | 'zerg'): void {
  if (!campaignList) return;
  campaignList.innerHTML = '';
  const missions = faction === 'terran' ? TERRAN_CAMPAIGN : ZERG_CAMPAIGN;
  const progress = getCampaignProgress();
  const prefix = faction === 'terran' ? 'T' : 'Z';

  for (let i = 0; i < missions.length; i++) {
    const m = missions[i];
    const unlocked = isMissionUnlocked(missions, i, progress);
    const completed = progress.includes(m.id);

    const card = document.createElement('div');
    card.style.cssText = `
      background: rgba(20,40,60,0.8); border: 1px solid rgba(60,100,160,0.4);
      padding: 10px 14px; border-radius: 4px;
      transition: border-color 0.15s;
      ${unlocked ? 'cursor: pointer;' : 'cursor: not-allowed; opacity: 0.45;'}
    `;
    const stars = '\u2605'.repeat(m.difficulty) + '\u2606'.repeat(3 - m.difficulty);
    const statusIcon = completed ? '<span style="color:#44ff88;margin-left:8px;">&#10003;</span>'
      : !unlocked ? '<span style="color:#ff6644;margin-left:8px;">&#128274;</span>'
      : '';

    card.innerHTML = `
      <div style="color:#cce0ff;font-size:13px;font-weight:bold">
        ${prefix}${i + 1}: ${m.title}
        <span style="color:#667;font-size:11px;margin-left:8px">${stars}</span>
        ${statusIcon}
      </div>
      <div style="color:#8899aa;font-size:11px;margin-top:4px">${m.description}</div>
      <div style="color:#557799;font-size:10px;margin-top:4px">SC2 concept: ${m.sc2Concept}</div>
    `;

    if (unlocked) {
      card.addEventListener('mouseenter', () => { card.style.borderColor = 'rgba(60,140,255,0.7)'; });
      card.addEventListener('mouseleave', () => { card.style.borderColor = 'rgba(60,100,160,0.4)'; });
      card.addEventListener('click', () => { startScenario(m); });
    }

    campaignList.appendChild(card);
  }
}

function setActiveCampaignTab(tab: 'terran' | 'zerg'): void {
  activeCampaignTab = tab;
  if (campaignTabTerran && campaignTabZerg) {
    if (tab === 'terran') {
      campaignTabTerran.style.background = '#1a3a5a';
      campaignTabTerran.style.color = '#88ccff';
      campaignTabTerran.style.borderColor = '#3a6a9a';
      campaignTabZerg.style.background = '#0a0a0a';
      campaignTabZerg.style.color = '#884466';
      campaignTabZerg.style.borderColor = '#3a1a2a';
    } else {
      campaignTabZerg.style.background = '#3a1a2a';
      campaignTabZerg.style.color = '#ff88cc';
      campaignTabZerg.style.borderColor = '#aa4466';
      campaignTabTerran.style.background = '#0a0a0a';
      campaignTabTerran.style.color = '#446688';
      campaignTabTerran.style.borderColor = '#1a2a3a';
    }
  }
  renderCampaignMissions(tab);
}

campaignBtn?.addEventListener('click', () => {
  // Hide main menu elements, show campaign browser
  document.querySelectorAll('#start-screen .controls, #start-screen .play-btn, #start-screen select, #start-screen details').forEach(el => {
    (el as HTMLElement).style.display = 'none';
  });
  document.querySelectorAll('#start-screen > div[style*="margin"]').forEach(el => {
    (el as HTMLElement).style.display = 'none';
  });
  if (campaignBtn) campaignBtn.style.display = 'none';
  if (campaignBrowser) campaignBrowser.style.display = 'block';
  setActiveCampaignTab('terran');
});

campaignTabTerran?.addEventListener('click', () => setActiveCampaignTab('terran'));
campaignTabZerg?.addEventListener('click', () => setActiveCampaignTab('zerg'));

campaignBack?.addEventListener('click', () => {
  window.location.reload();
});

function startScenario(scenario: Scenario): void {
  if (startScreen) startScreen.style.display = 'none';
  const game = new Game();
  game.setPlayerFaction(scenario.setup.playerFaction === Faction.Terran ? Faction.Terran : Faction.Zerg);
  game.setMapType(scenario.setup.mapType);
  game.setScenario(scenario);
  game.init(container!).catch((err) => {
    console.error('Failed to initialize scenario:', err);
  });
}

// ── Map Editor ──
const mapEditorBtn = document.getElementById('map-editor-btn');
const mapEditorPanel = document.getElementById('map-editor-panel');
const mapEditorCanvasContainer = document.getElementById('map-editor-canvas-container');
let mapEditor: MapEditor | null = null;

mapEditorBtn?.addEventListener('click', () => {
  // Hide main menu elements, show map editor
  document.querySelectorAll('#start-screen .controls, #start-screen .play-btn, #start-screen select, #start-screen details').forEach(el => {
    (el as HTMLElement).style.display = 'none';
  });
  document.querySelectorAll('#start-screen > div[style*="margin"]').forEach(el => {
    (el as HTMLElement).style.display = 'none';
  });
  if (mapEditorBtn) mapEditorBtn.style.display = 'none';
  if (mapEditorPanel && mapEditorCanvasContainer) {
    mapEditorPanel.style.display = 'flex';
    if (!mapEditor) {
      mapEditor = new MapEditor(mapEditorCanvasContainer);
      // Try to load a saved map
      mapEditor.load();
    }
  }
});

// Map editor tool buttons
document.querySelectorAll('.map-tool-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const tool = parseInt((btn as HTMLElement).dataset.tool || '0', 10);
    if (mapEditor) mapEditor.setTool(tool);
    // Highlight active tool
    document.querySelectorAll('.map-tool-btn').forEach(b => {
      (b as HTMLElement).style.outline = '';
    });
    (btn as HTMLElement).style.outline = '2px solid #88ff88';
  });
});

document.getElementById('map-editor-save')?.addEventListener('click', () => {
  if (mapEditor) {
    mapEditor.save();
    const btn = document.getElementById('map-editor-save');
    if (btn) {
      btn.textContent = 'Saved!';
      setTimeout(() => { btn.textContent = 'Save'; }, 1500);
    }
  }
});

document.getElementById('map-editor-load')?.addEventListener('click', () => {
  if (mapEditor) {
    const loaded = mapEditor.load();
    const btn = document.getElementById('map-editor-load');
    if (btn) {
      btn.textContent = loaded ? 'Loaded!' : 'No saved map';
      setTimeout(() => { btn.textContent = 'Load'; }, 1500);
    }
  }
});

document.getElementById('map-editor-play')?.addEventListener('click', () => {
  if (!mapEditor) return;
  mapEditor.save(); // Auto-save before playing
  if (startScreen) startScreen.style.display = 'none';

  const game = new Game();

  const activeDiffCard = document.querySelector('.diff-card.active') as HTMLElement | null;
  const diffValue = activeDiffCard ? parseInt(activeDiffCard.dataset.value || '1', 10) : Difficulty.Normal;
  game.setDifficulty(diffValue as Difficulty);

  // Read faction selection
  const factionZergBtn = document.getElementById('faction-zerg') as HTMLButtonElement | null;
  const isZerg = factionZergBtn?.dataset.selected === 'true';
  game.setPlayerFaction(isZerg ? 2 : 1);

  game.setCustomTiles(mapEditor.getTiles());
  game.init(container!).catch((err) => {
    console.error('Failed to initialize custom map game:', err);
  });
});

document.getElementById('map-editor-back')?.addEventListener('click', () => {
  window.location.reload();
});

// ── Achievements UI ──
function updateAchievementsCounter(): void {
  const counter = document.getElementById('achievements-counter');
  if (!counter) return;
  const unlocked = getUnlockedAchievements();
  counter.textContent = `Achievements: ${unlocked.length}/${ACHIEVEMENTS.length}`;
}

const achievementsCounter = document.getElementById('achievements-counter');
const achievementsPanel = document.getElementById('achievements-panel');
const achievementsList = document.getElementById('achievements-list');

updateAchievementsCounter();

achievementsCounter?.addEventListener('click', () => {
  if (!achievementsPanel || !achievementsList) return;
  const isVisible = achievementsPanel.style.display === 'block';
  if (isVisible) {
    achievementsPanel.style.display = 'none';
    return;
  }
  achievementsPanel.style.display = 'block';
  achievementsList.innerHTML = '';
  const unlocked = getUnlockedAchievements();
  for (const ach of ACHIEVEMENTS) {
    const isUnlocked = unlocked.includes(ach.id);
    const card = document.createElement('div');
    card.style.cssText = `
      background: ${isUnlocked ? 'rgba(40, 60, 30, 0.8)' : 'rgba(20, 20, 20, 0.6)'};
      border: 1px solid ${isUnlocked ? 'rgba(100, 180, 60, 0.4)' : 'rgba(60, 60, 60, 0.3)'};
      padding: 6px 10px;
      border-radius: 3px;
      opacity: ${isUnlocked ? '1' : '0.5'};
    `;
    card.innerHTML = `
      <div style="color:${isUnlocked ? '#88ff44' : '#666'};font-size:12px;font-weight:bold">
        ${isUnlocked ? '\u2713' : '\u2717'} ${ach.title}
      </div>
      <div style="color:${isUnlocked ? '#99aa88' : '#444'};font-size:10px;margin-top:2px">${ach.description}</div>
    `;
    achievementsList.appendChild(card);
  }
});
