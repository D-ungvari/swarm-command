import { Game } from './Game';
import { Difficulty, Faction } from './constants';
import type { MapType } from './map/MapData';
import { SCENARIOS } from './scenarios/scenarios';
import type { Scenario } from './scenarios/ScenarioTypes';

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

  const diffSelect = document.getElementById('difficulty-select') as HTMLSelectElement | null;
  const diffValue = diffSelect ? parseInt(diffSelect.value, 10) : Difficulty.Normal;
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
