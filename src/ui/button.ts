import { Faction } from '../constants';
import { getFactionPalette, fonts, colors, type FactionPalette } from './theme';

export type ButtonState = 'normal' | 'active' | 'disabled' | 'error';

export interface ButtonOptions {
  label?: string;
  hotkey?: string;
  portrait?: HTMLCanvasElement;
  portraitSize?: number;
  cost?: { minerals: number; gas: number };
  supply?: number | string;
  size?: 'sm' | 'md' | 'lg';
  faction?: Faction;
  onClick?: () => void;
}

export function createButton(options: ButtonOptions): HTMLDivElement {
  const faction = options.faction ?? Faction.Terran;
  const palette = getFactionPalette(faction);
  const btn = document.createElement('div');
  btn.dataset.uiState = 'normal';
  btn.dataset.uiFaction = String(faction);

  const isLg = options.size === 'lg';
  const width = isLg ? '80px' : '46px';
  const height = options.portrait ? '54px' : 'auto';

  btn.style.cssText = `
    width: ${width}; ${options.portrait ? `height: ${height};` : ''}
    padding: ${isLg ? '4px 6px' : '2px'};
    background: ${palette.buttonBg};
    border: 1px solid ${palette.border};
    border-radius: 3px;
    cursor: pointer; pointer-events: auto;
    transition: background 0.12s, border-color 0.12s, box-shadow 0.12s;
    position: relative;
    display: flex; flex-direction: column; align-items: center;
    overflow: hidden; box-sizing: border-box;
    user-select: none;
  `;

  // Hotkey badge (top-left)
  if (options.hotkey) {
    const badge = document.createElement('div');
    badge.className = 'btn-hotkey';
    badge.style.cssText = `
      position: absolute; top: 2px; left: 3px;
      font-size: ${fonts.sizeHotkey}; font-family: ${fonts.family};
      color: rgba(160, 200, 240, 0.55);
      background: rgba(0, 0, 0, 0.35);
      padding: 0 3px; border-radius: 2px;
      min-width: 12px; text-align: center; line-height: 14px;
      z-index: 1;
    `;
    badge.textContent = options.hotkey;
    btn.appendChild(badge);
  }

  // Supply badge (top-right)
  if (options.supply !== undefined) {
    const sup = document.createElement('div');
    sup.style.cssText = `
      position: absolute; top: 2px; right: 3px;
      font-size: 7px; font-family: ${fonts.family};
      color: rgba(255, 220, 80, 0.6); z-index: 1;
    `;
    sup.textContent = String(options.supply);
    btn.appendChild(sup);
  }

  // Portrait
  if (options.portrait) {
    const sz = options.portraitSize ?? 32;
    options.portrait.style.cssText = `width: ${sz}px; height: ${sz}px; image-rendering: pixelated; flex-shrink: 0;`;
    btn.appendChild(options.portrait);
  }

  // Label
  if (options.label) {
    const lbl = document.createElement('span');
    lbl.className = 'btn-label';
    lbl.style.cssText = `font-size: ${fonts.sizeXS}; font-family: ${fonts.family}; color: ${palette.text}; text-align: center;`;
    lbl.textContent = options.label;
    btn.appendChild(lbl);
  }

  // Cost line
  if (options.cost) {
    const costEl = document.createElement('div');
    costEl.className = 'btn-cost';
    costEl.style.cssText = `font-size: ${fonts.sizeHotkey}; font-family: ${fonts.family}; text-align: center; line-height: 1; margin-top: 1px;`;
    const { minerals, gas } = options.cost;
    costEl.innerHTML = gas > 0
      ? `<span style="color:${colors.mineral}">${minerals}</span><span style="color:#555">/</span><span style="color:${colors.gas}">${gas}</span>`
      : `<span style="color:${colors.mineral}">${minerals}</span>`;
    btn.appendChild(costEl);
  }

  // Hover/leave handlers
  btn.addEventListener('mouseenter', () => {
    if (btn.dataset.uiState === 'disabled' || btn.dataset.uiState === 'error') return;
    const p = getFactionPalette(Number(btn.dataset.uiFaction) as Faction);
    btn.style.background = p.buttonBgHover;
    btn.style.borderColor = p.borderHover;
    btn.style.boxShadow = p.glow;
  });
  btn.addEventListener('mouseleave', () => {
    setButtonState(btn, (btn.dataset.uiState as ButtonState) ?? 'normal');
  });

  if (options.onClick) {
    btn.addEventListener('click', options.onClick);
  }

  return btn;
}

/** Update button visual state without rebuilding DOM. Fast — safe to call per frame. */
export function setButtonState(btn: HTMLDivElement, state: ButtonState): void {
  btn.dataset.uiState = state;
  const fac = Number(btn.dataset.uiFaction) as Faction;
  const p = getFactionPalette(fac);

  switch (state) {
    case 'normal':
      btn.style.background = p.buttonBg;
      btn.style.borderColor = p.border;
      btn.style.boxShadow = 'none';
      btn.style.opacity = '1';
      btn.style.cursor = 'pointer';
      btn.style.pointerEvents = 'auto';
      break;
    case 'active':
      btn.style.background = 'rgba(10, 20, 35, 0.95)';
      btn.style.borderColor = p.borderHover;
      btn.style.boxShadow = 'inset 0 1px 3px rgba(0, 0, 0, 0.4)';
      btn.style.opacity = '1';
      btn.style.cursor = 'pointer';
      btn.style.pointerEvents = 'auto';
      break;
    case 'disabled':
      btn.style.background = 'rgba(10, 14, 20, 0.9)';
      btn.style.borderColor = 'rgba(60, 60, 60, 0.25)';
      btn.style.boxShadow = 'none';
      btn.style.opacity = '0.4';
      btn.style.cursor = 'default';
      btn.style.pointerEvents = 'none';
      break;
    case 'error':
      btn.style.background = 'rgba(10, 14, 20, 0.9)';
      btn.style.borderColor = 'rgba(200, 60, 60, 0.5)';
      btn.style.boxShadow = 'none';
      btn.style.opacity = '0.45';
      btn.style.cursor = 'default';
      btn.style.pointerEvents = 'none';
      break;
  }
}

/** Update button faction (re-applies palette colors). */
export function updateButtonFaction(btn: HTMLDivElement, f: Faction): void {
  btn.dataset.uiFaction = String(f);
  setButtonState(btn, (btn.dataset.uiState as ButtonState) ?? 'normal');
}
