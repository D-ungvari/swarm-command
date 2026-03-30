import { Game } from './Game';

const startScreen = document.getElementById('start-screen');
const playBtn = document.getElementById('play-btn');
const container = document.getElementById('game-container');

if (!container) throw new Error('Missing #game-container element');

function startGame(): void {
  if (startScreen) startScreen.style.display = 'none';
  const game = new Game();
  game.init(container!).catch((err) => {
    console.error('Failed to initialize game:', err);
  });
}

if (playBtn) {
  playBtn.addEventListener('click', startGame);
} else {
  startGame();
}
