import type { GameStatsSnapshot } from './GameStats';

export interface Achievement {
  id: string;
  title: string;
  description: string;
  condition: (stats: GameStatsSnapshot) => boolean;
}

export const ACHIEVEMENTS: Achievement[] = [
  { id: 'first-win', title: "Hell, it's about time!", description: 'Win your first game', condition: (s) => s.wavesDefeated >= 1 },
  { id: 'speed-runner', title: 'Speed Runner', description: 'Win in under 3 minutes', condition: (s) => s.duration < 180 },
  { id: 'apm-machine', title: 'APM Machine', description: 'Achieve 150+ APM', condition: (s) => s.apm >= 150 },
  { id: 'fortress', title: 'Fortress', description: 'Survive 10 waves', condition: (s) => s.wavesDefeated >= 10 },
  { id: 'economic', title: 'Economic Miracle', description: 'Gather 5000 resources', condition: (s) => s.resourcesGathered >= 5000 },
  { id: 'no-mercy', title: 'No Mercy', description: 'Win on Brutal difficulty', condition: () => false }, // checked separately
  { id: 'perfect', title: 'Perfect Score', description: 'Win a scenario with S rank', condition: () => false }, // checked separately
  { id: 'veteran', title: 'War Hero', description: 'Have a unit reach Hero veterancy', condition: () => false }, // checked separately
];

export function getUnlockedAchievements(): string[] {
  try {
    return JSON.parse(localStorage.getItem('swarm_achievements') || '[]');
  } catch {
    return [];
  }
}

export function unlockAchievement(id: string): boolean {
  const unlocked = getUnlockedAchievements();
  if (unlocked.includes(id)) return false;
  unlocked.push(id);
  localStorage.setItem('swarm_achievements', JSON.stringify(unlocked));
  return true; // true = newly unlocked (show toast)
}

export function checkAchievements(stats: GameStatsSnapshot): string[] {
  const newlyUnlocked: string[] = [];
  for (const ach of ACHIEVEMENTS) {
    if (ach.condition(stats) && unlockAchievement(ach.id)) {
      newlyUnlocked.push(ach.title);
    }
  }
  return newlyUnlocked;
}

/** Show a floating achievement toast at the top of the screen */
export function showAchievementToast(title: string): void {
  const toast = document.createElement('div');
  toast.textContent = `Achievement Unlocked: ${title}`;
  toast.style.cssText = `
    position: fixed;
    top: 24px;
    left: 50%;
    transform: translateX(-50%);
    background: rgba(20, 40, 80, 0.95);
    color: #ffcc44;
    font-family: 'Consolas', 'Courier New', monospace;
    font-size: 15px;
    letter-spacing: 1px;
    padding: 12px 28px;
    border: 1px solid rgba(255, 200, 60, 0.5);
    border-radius: 4px;
    z-index: 300;
    pointer-events: none;
    animation: achievementFadeIn 0.3s ease-out;
    text-shadow: 0 0 10px rgba(255, 200, 60, 0.4);
  `;

  // Add keyframe animation if not already present
  if (!document.getElementById('achievement-anim-style')) {
    const style = document.createElement('style');
    style.id = 'achievement-anim-style';
    style.textContent = `
      @keyframes achievementFadeIn {
        from { opacity: 0; transform: translateX(-50%) translateY(-20px); }
        to { opacity: 1; transform: translateX(-50%) translateY(0); }
      }
    `;
    document.head.appendChild(style);
  }

  document.body.appendChild(toast);

  // Fade out after 3 seconds
  setTimeout(() => {
    toast.style.transition = 'opacity 0.5s';
    toast.style.opacity = '0';
    setTimeout(() => toast.remove(), 500);
  }, 3000);
}
