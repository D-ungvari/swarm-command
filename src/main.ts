import { Game } from './Game';

const container = document.getElementById('game-container');
if (!container) throw new Error('Missing #game-container element');

const game = new Game();
game.init(container).catch((err) => {
  console.error('Failed to initialize game:', err);
});
