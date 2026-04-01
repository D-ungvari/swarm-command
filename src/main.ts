import { Game } from './Game';
import { Difficulty } from './constants';
import type { MapType } from './map/MapData';

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
