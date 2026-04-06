import { Faction } from '../constants';
import { getFactionPalette, fonts, spacing, panel as panelPreset, type FactionPalette } from './theme';

export interface PanelFrameOptions {
  position: {
    top?: string;
    bottom?: string;
    left?: string;
    right?: string;
    centerX?: boolean;
  };
  faction?: Faction;
  zIndex?: number;
  minWidth?: string;
  pointerEvents?: boolean;
  id?: string;
}

export function createPanelFrame(options: PanelFrameOptions): HTMLDivElement {
  const el = document.createElement('div');
  if (options.id) el.id = options.id;
  const palette = getFactionPalette(options.faction ?? Faction.IronLegion);

  let pos = 'position: fixed;';
  if (options.position.top) pos += ` top: ${options.position.top};`;
  if (options.position.bottom) pos += ` bottom: ${options.position.bottom};`;
  if (options.position.left) pos += ` left: ${options.position.left};`;
  if (options.position.right) pos += ` right: ${options.position.right};`;
  if (options.position.centerX) pos += ' left: 50%; transform: translateX(-50%);';

  el.style.cssText = `
    ${pos}
    display: none;
    flex-direction: column;
    gap: ${spacing.sm};
    font-family: ${fonts.family};
    font-size: ${fonts.sizeMD};
    color: ${palette.text};
    background: ${palette.panelBg};
    padding: ${panelPreset.padding};
    border: ${panelPreset.borderWidth} solid ${palette.border};
    border-radius: ${panelPreset.borderRadius};
    box-shadow: ${palette.panelBevel}, ${panelPreset.dropShadow};
    z-index: ${options.zIndex ?? 10};
    pointer-events: ${options.pointerEvents ? 'auto' : 'none'};
    user-select: none;
    ${options.minWidth ? `min-width: ${options.minWidth};` : ''}
    transition: border-color 0.25s ease, box-shadow 0.25s ease;
  `;
  return el;
}

export function updatePanelFaction(el: HTMLDivElement, f: Faction): void {
  const palette = getFactionPalette(f);
  el.style.borderColor = palette.border;
  el.style.background = palette.panelBg;
  el.style.boxShadow = `${palette.panelBevel}, ${panelPreset.dropShadow}`;
  el.style.color = palette.text;
}
