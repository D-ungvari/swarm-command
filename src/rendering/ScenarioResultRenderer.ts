import type { ScenarioGrade } from '../scenarios/ScenarioTypes';
import { gradeFromScore } from '../scenarios/ScenarioTypes';

export class ScenarioResultRenderer {
  private overlay: HTMLDivElement;
  private visible = false;

  constructor(container: HTMLElement) {
    this.overlay = document.createElement('div');
    this.overlay.style.cssText = `
      position: fixed; inset: 0; z-index: 50;
      display: none; align-items: center; justify-content: center;
      background: rgba(0,0,0,0.85);
      font-family: monospace; color: #cce0ff;
    `;
    container.appendChild(this.overlay);
  }

  show(result: {
    scenarioTitle: string;
    won: boolean;
    score: number;
    maxScore: number;
    timeElapsed: number;
    unitsLost: number;
    tips: string[];
  }): void {
    this.visible = true;
    const grade = gradeFromScore(result.score, result.maxScore);
    const gradeColor = this.getGradeColor(grade);
    const timeStr = `${Math.floor(result.timeElapsed)}s`;

    this.overlay.innerHTML = `
      <div style="text-align:center; max-width:400px;">
        <div style="font-size:14px;color:#88aacc;letter-spacing:2px;margin-bottom:8px;">SCENARIO COMPLETE</div>
        <div style="font-size:18px;color:#eef;margin-bottom:16px;">${result.scenarioTitle}</div>
        <div style="font-size:72px;color:${gradeColor};font-weight:bold;margin:16px 0;">${grade}</div>
        <div style="font-size:13px;color:${result.won ? '#44ff88' : '#ff6644'};margin-bottom:12px;">
          ${result.won ? 'OBJECTIVE COMPLETE' : 'OBJECTIVE FAILED'}
        </div>
        <div style="font-size:12px;color:#8899aa;margin-bottom:16px;">
          Score: ${result.score}/${result.maxScore} · Time: ${timeStr} · Units lost: ${result.unitsLost}
        </div>
        <div style="text-align:left;margin:16px 0;padding:12px;background:rgba(20,40,60,0.6);border-radius:4px;">
          <div style="color:#88bbff;font-size:11px;margin-bottom:6px;">TIPS:</div>
          ${result.tips.map(t => `<div style="color:#8899aa;font-size:11px;margin:4px 0;">• ${t}</div>`).join('')}
        </div>
        <div style="display:flex;gap:8px;justify-content:center;margin-top:16px;">
          <button id="scenario-retry" style="
            padding:10px 24px;background:#1a3a5a;color:#cce0ff;border:1px solid #3a6a9a;
            cursor:pointer;font-family:monospace;font-size:13px;letter-spacing:1px;
          ">TRY AGAIN</button>
          <button id="scenario-menu" style="
            padding:10px 24px;background:#0a0a0a;color:#6688aa;border:1px solid #334;
            cursor:pointer;font-family:monospace;font-size:12px;
          ">BACK TO MENU</button>
        </div>
      </div>
    `;
    this.overlay.style.display = 'flex';

    document.getElementById('scenario-retry')?.addEventListener('click', () => {
      window.location.reload(); // Simplest retry
    });
    document.getElementById('scenario-menu')?.addEventListener('click', () => {
      window.location.reload();
    });
  }

  get isVisible(): boolean { return this.visible; }

  private getGradeColor(grade: ScenarioGrade): string {
    switch (grade) {
      case 'S': return '#ffdd00';
      case 'A': return '#44ff88';
      case 'B': return '#44aaff';
      case 'C': return '#ffaa44';
      case 'D': return '#ff6644';
      case 'F': return '#ff2222';
    }
  }
}
