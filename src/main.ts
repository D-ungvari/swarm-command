import { Game } from './Game';
import { Difficulty, Faction } from './constants';
import type { MapType } from './map/MapData';
import { SCENARIOS } from './scenarios/scenarios';
import type { Scenario } from './scenarios/ScenarioTypes';
// Campaign and MapEditor code vaulted — imports kept for reference
// import { TERRAN_CAMPAIGN, ZERG_CAMPAIGN, getCampaignProgress, isMissionUnlocked } from './scenarios/campaign';
// import { MapEditor } from './map/MapEditor';
import { ACHIEVEMENTS, getUnlockedAchievements } from './stats/Achievements';
import { getScenarioBestScore } from './scenarios/ScenarioProgress';

const startScreen = document.getElementById('start-screen');
const mainMenu = document.getElementById('main-menu');
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
}

if (watchReplayBtn && savedReplay) {
  watchReplayBtn.addEventListener('click', watchReplay);
}

// ── Skirmish panel ──
const skirmishBtn = document.getElementById('skirmish-btn');
const skirmishPanel = document.getElementById('skirmish-panel');
const skirmishBack = document.getElementById('skirmish-back');

skirmishBtn?.addEventListener('click', () => {
  if (mainMenu) mainMenu.style.display = 'none';
  if (skirmishPanel) skirmishPanel.style.display = 'flex';
});

skirmishBack?.addEventListener('click', () => {
  if (skirmishPanel) skirmishPanel.style.display = 'none';
  if (mainMenu) mainMenu.style.display = 'flex';
});

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
    const best = getScenarioBestScore(s.id);
    const bestBadge = best
      ? `<span style="color:#ffdd00;font-size:11px;font-weight:bold;margin-left:8px;background:rgba(255,220,0,0.12);padding:1px 5px;border-radius:2px;">${best.grade}</span>`
      : '';
    card.innerHTML = `
      <div style="color:#cce0ff;font-size:13px;font-weight:bold">${s.title}
        <span style="color:#667;font-size:11px;margin-left:8px">${'\u2605'.repeat(s.difficulty)}${'\u2606'.repeat(3 - s.difficulty)}</span>
        ${bestBadge}
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
  if (mainMenu) mainMenu.style.display = 'none';
  if (scenarioBrowser) scenarioBrowser.style.display = 'block';
});

backBtn?.addEventListener('click', () => {
  if (scenarioBrowser) scenarioBrowser.style.display = 'none';
  if (mainMenu) mainMenu.style.display = 'flex';
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

// Map editor vaulted — code preserved in src/map/MapEditor.ts

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
