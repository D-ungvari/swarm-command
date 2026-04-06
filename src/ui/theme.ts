import { Faction } from '../constants';

// ── Utility ──
export function hexToCSS(n: number): string {
  return '#' + n.toString(16).padStart(6, '0');
}

// ── Faction Palette ──
export interface FactionPalette {
  primary: string;
  primaryHex: number;
  secondary: string;
  border: string;
  borderHover: string;
  borderDim: string;
  panelBg: string;
  panelBevel: string;
  buttonBg: string;
  buttonBgHover: string;
  text: string;
  textDim: string;
  textMuted: string;
  glow: string;
}

export const TERRAN_PALETTE: FactionPalette = {
  primary: '#55aaff',
  primaryHex: 0x55aaff,
  secondary: '#88ccff',
  border: 'rgba(80, 140, 220, 0.35)',
  borderHover: 'rgba(100, 180, 255, 0.6)',
  borderDim: 'rgba(40, 70, 110, 0.2)',
  panelBg: 'linear-gradient(180deg, rgba(12,20,32,0.88) 0%, rgba(6,10,18,0.92) 100%)',
  panelBevel: 'inset 0 1px 0 rgba(100,180,255,0.12)',
  buttonBg: 'linear-gradient(180deg, rgba(22,38,60,0.85) 0%, rgba(14,24,42,0.9) 100%)',
  buttonBgHover: 'linear-gradient(180deg, rgba(30,55,90,0.85) 0%, rgba(20,38,65,0.9) 100%)',
  text: '#cce0ff',
  textDim: '#88aacc',
  textMuted: '#557799',
  glow: '0 0 6px rgba(100,180,255,0.15)',
};

export const ZERG_PALETTE: FactionPalette = {
  primary: '#ee4444',
  primaryHex: 0xee4444,
  secondary: '#ff8866',
  border: 'rgba(200, 80, 60, 0.35)',
  borderHover: 'rgba(255, 120, 80, 0.55)',
  borderDim: 'rgba(110, 40, 30, 0.2)',
  panelBg: 'linear-gradient(180deg, rgba(28,14,12,0.88) 0%, rgba(16,8,6,0.92) 100%)',
  panelBevel: 'inset 0 1px 0 rgba(255,120,80,0.10)',
  buttonBg: 'linear-gradient(180deg, rgba(50,22,18,0.85) 0%, rgba(35,14,12,0.9) 100%)',
  buttonBgHover: 'linear-gradient(180deg, rgba(70,35,28,0.85) 0%, rgba(50,24,18,0.9) 100%)',
  text: '#ffd8cc',
  textDim: '#cc8877',
  textMuted: '#885544',
  glow: '0 0 6px rgba(255,120,80,0.12)',
};

export function getFactionPalette(f: Faction): FactionPalette {
  return f === Faction.Zerg ? ZERG_PALETTE : TERRAN_PALETTE;
}

// ── Common Colors ──
export const colors = {
  mineral: '#55ddff',       mineralHex: 0x55ddff,
  gas: '#66ff88',           gasHex: 0x66ff88,
  supply: '#ffcc44',
  hpHigh: '#55ff55',        hpHighGrad: '#33cc33',
  hpMid: '#ffbb33',         hpMidGrad: '#cc8800',
  hpLow: '#ff4444',         hpLowGrad: '#cc2222',
  production: '#ffaa22',
  disabled: '#555',
  error: '#ff4444',
  success: '#44ff44',
  warning: '#ffcc44',
  energy: '#8844ff',
};

// ── Typography ──
export const fonts = {
  family: "'Consolas', 'Courier New', monospace",
  sizeXL: '18px',
  sizeLG: '14px',
  sizeMD: '12px',
  sizeSM: '11px',
  sizeXS: '10px',
  sizeTiny: '9px',
  sizeHotkey: '8px',
};

// ── Spacing ──
export const spacing = {
  xs: '2px',
  sm: '4px',
  md: '8px',
  lg: '12px',
  xl: '16px',
};

// ── Panel Presets ──
export const panel = {
  borderRadius: '4px',
  borderWidth: '1px',
  padding: '8px 12px',
  dropShadow: '0 2px 8px rgba(0, 0, 0, 0.5)',
};
