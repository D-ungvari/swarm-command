import { Game } from './Game';
import { Difficulty } from './constants';
import type { MapType } from './map/MapData';

const startScreen = document.getElementById('start-screen');
const playBtn = document.getElementById('play-btn');
const container = document.getElementById('game-container');

if (!container) throw new Error('Missing #game-container element');

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

  game.init(container!).catch((err) => {
    console.error('Failed to initialize game:', err);
  });
}

if (playBtn) {
  playBtn.addEventListener('click', startGame);
} else {
  startGame();
}
