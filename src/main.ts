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
  game.init(container!).catch((err) => {
    console.error('Failed to initialize game:', err);
  });
}

if (playBtn) {
  playBtn.addEventListener('click', startGame);
} else {
  startGame();
}
