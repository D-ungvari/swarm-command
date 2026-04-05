---
scope: UI Look and Feel Upgrade — Skirmish Mode
created: 2026-04-05
backlog_items: 125
task_count: 10
status: READY
---

## Ultraplan: UI Look and Feel Upgrade

### Vision Alignment
Swarm Command is a portfolio piece targeting Copenhagen full-stack employers. The in-game skirmish UI is the first thing interviewers will see. Upgrading from flat rgba panels with hardcoded colors to a cohesive SC2-inspired design system transforms the game from "programmer art" to "polished portfolio piece." This is pure visual polish — zero gameplay changes.

---

## Visual Design Specification

This section defines the exact visual language every task implements. Refer to this as the source of truth for CSS values.

### Design Philosophy
SC2-inspired but not a pixel clone. The goal is **industrial sci-fi**: dark backgrounds with faction-colored accents, subtle depth via gradients and inner highlights, and clear information hierarchy. Think Terran engineering readouts (blue steel) vs Zerg bio-membrane (red chitin).

### Panel Frame Design

**Background:**
```css
/* Replaces flat rgba(0,0,0,0.6-0.85) */
background: linear-gradient(
  180deg,
  rgba(12, 20, 32, 0.88) 0%,
  rgba(6, 10, 18, 0.92) 100%
);
```

**Border + bevel effect (Terran):**
```css
border: 1px solid rgba(80, 140, 220, 0.35);
border-radius: 4px;
box-shadow:
  inset 0 1px 0 rgba(100, 180, 255, 0.12),   /* bright top edge = bevel */
  0 2px 8px rgba(0, 0, 0, 0.5);               /* drop shadow for lift */
```

**Border + bevel effect (Zerg):**
```css
border: 1px solid rgba(200, 80, 60, 0.35);
border-radius: 4px;
box-shadow:
  inset 0 1px 0 rgba(255, 120, 80, 0.10),
  0 2px 8px rgba(0, 0, 0, 0.5);
```

**Transition on faction switch:**
```css
transition: border-color 0.25s ease, box-shadow 0.25s ease;
```

### Button Design

**Normal state:**
```css
background: linear-gradient(180deg, rgba(22, 38, 60, 0.85) 0%, rgba(14, 24, 42, 0.9) 100%);
border: 1px solid rgba(80, 140, 220, 0.35);
border-radius: 3px;
color: #cce0ff;
cursor: pointer;
transition: background 0.12s, border-color 0.12s, box-shadow 0.12s;
```

**Hover state:**
```css
background: linear-gradient(180deg, rgba(30, 55, 90, 0.85) 0%, rgba(20, 38, 65, 0.9) 100%);
border-color: rgba(100, 180, 255, 0.6);
box-shadow: 0 0 6px rgba(100, 180, 255, 0.15);
```

**Active/pressed state:**
```css
background: rgba(10, 20, 35, 0.95);
box-shadow: inset 0 1px 3px rgba(0, 0, 0, 0.4);
```

**Disabled state:**
```css
opacity: 0.4;
cursor: default;
pointer-events: none;
border-color: rgba(60, 60, 60, 0.25);
background: rgba(10, 14, 20, 0.9);
```

**Error/tech-locked state:**
```css
border-color: rgba(200, 60, 60, 0.5);
opacity: 0.45;
```

**Hotkey badge (top-left corner):**
```css
position: absolute; top: 2px; left: 3px;
font-size: 8px; font-family: Consolas, monospace;
color: rgba(160, 200, 240, 0.55);
background: rgba(0, 0, 0, 0.35);
padding: 0 3px; border-radius: 2px;
min-width: 12px; text-align: center; line-height: 14px;
```

### HP Bar Design

**Container:**
```css
position: relative; width: 100%; height: 14px;
background: rgba(15, 15, 20, 0.8);
border: 1px solid rgba(80, 140, 220, 0.2);
border-radius: 3px; overflow: hidden;
```

**Fill (high HP — green):**
```css
height: 100%;
background: linear-gradient(180deg, #55ff55 0%, #33cc33 100%);
box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.15);
transition: width 0.15s ease-out;
```

**Fill thresholds:**
- `> 50%`: green gradient `#55ff55 → #33cc33`
- `25–50%`: amber gradient `#ffbb33 → #cc8800`
- `< 25%`: red gradient `#ff4444 → #cc2222`

**Label:**
```css
position: absolute; inset: 0;
display: flex; align-items: center; justify-content: center;
font-size: 9px; color: #fff;
text-shadow: 0 1px 2px rgba(0, 0, 0, 0.8);
```

### Faction Palettes (exact values)

**Terran:**
| Token | Value | Usage |
|-------|-------|-------|
| primary | `#3399ff` / `0x3399ff` | Accents, active highlights |
| secondary | `#88ccff` | Text on active elements |
| border | `rgba(80, 140, 220, 0.35)` | Panel/button borders |
| borderHover | `rgba(100, 180, 255, 0.6)` | Hovered borders |
| borderDim | `rgba(40, 70, 110, 0.2)` | Empty/inactive borders |
| panelBg | `linear-gradient(180deg, rgba(12,20,32,0.88), rgba(6,10,18,0.92))` | Panel backgrounds |
| panelBevel | `inset 0 1px 0 rgba(100,180,255,0.12)` | Inner top highlight |
| buttonBg | `linear-gradient(180deg, rgba(22,38,60,0.85), rgba(14,24,42,0.9))` | Button default |
| buttonBgHover | `linear-gradient(180deg, rgba(30,55,90,0.85), rgba(20,38,65,0.9))` | Button hover |
| text | `#cce0ff` | Primary text |
| textDim | `#88aacc` | Secondary text |
| textMuted | `#557799` | Disabled/tertiary text |
| glow | `0 0 6px rgba(100,180,255,0.15)` | Hover glow effect |

**Zerg:**
| Token | Value | Usage |
|-------|-------|-------|
| primary | `#cc4444` / `0xcc4444` | Accents, active highlights |
| secondary | `#ff8866` | Text on active elements |
| border | `rgba(200, 80, 60, 0.35)` | Panel/button borders |
| borderHover | `rgba(255, 120, 80, 0.55)` | Hovered borders |
| borderDim | `rgba(110, 40, 30, 0.2)` | Empty/inactive borders |
| panelBg | `linear-gradient(180deg, rgba(28,14,12,0.88), rgba(16,8,6,0.92))` | Panel backgrounds |
| panelBevel | `inset 0 1px 0 rgba(255,120,80,0.10)` | Inner top highlight |
| buttonBg | `linear-gradient(180deg, rgba(50,22,18,0.85), rgba(35,14,12,0.9))` | Button default |
| buttonBgHover | `linear-gradient(180deg, rgba(70,35,28,0.85), rgba(50,24,18,0.9))` | Button hover |
| text | `#ffd8cc` | Primary text |
| textDim | `#cc8877` | Secondary text |
| textMuted | `#885544` | Disabled/tertiary text |
| glow | `0 0 6px rgba(255,120,80,0.12)` | Hover glow effect |

### Common Colors (faction-independent)

| Token | Value | Usage |
|-------|-------|-------|
| mineral | `#44bbff` / `0x44bbff` | Mineral resource text/icons |
| gas | `#44ff66` / `0x44ff66` | Gas resource text/icons |
| supply | `#ffcc44` | Supply text/icon |
| hpHigh | `#55ff55` | HP bar >50% |
| hpMid | `#ffbb33` | HP bar 25-50% |
| hpLow | `#ff4444` | HP bar <25% |
| production | `#ffaa22` | Production progress bar |
| error | `#ff4444` | Error text, defeat title |
| success | `#44ff44` | Victory title |
| warning | `#ffcc44` | Warnings, supply capped |
| energy | `#8844ff` | Energy bar (Ghost, Queen, etc.) |

### Typography Scale

| Token | Size | Weight | Usage |
|-------|------|--------|-------|
| sizeXL | 18px | bold | Game over title (separate: 48px) |
| sizeLG | 14px | bold | Entity names, panel titles |
| sizeMD | 12px | normal | Stat values, button labels |
| sizeSM | 11px | normal | Detail text, cost text, descriptions |
| sizeXS | 10px | normal | Small labels, tooltip text |
| sizeTiny | 9px | normal | HP bar label, prereq text, queue labels |
| sizeHotkey | 8px | normal | Hotkey badges, supply badges |

**Font stack:** `'Consolas', 'Courier New', monospace` (unchanged — monospace is core to the SC2 aesthetic)

### Spacing Scale

| Token | Value | Usage |
|-------|-------|-------|
| xs | 2px | Tight gaps (pip rows, between badges) |
| sm | 4px | Small gaps (within panels, between icon and text) |
| md | 8px | Standard gaps (between rows, padding sides) |
| lg | 12px | Panel padding, between sections |
| xl | 16px | Between panels, HUD gap |

### Resource Icon Design

**Before:** 10x10px colored square with 2px border-radius
**After:** 14x14px with subtle border and inner highlight

```css
display: inline-flex; align-items: center; justify-content: center;
width: 14px; height: 14px;
border-radius: 3px;
border: 1px solid rgba(RESOURCE_COLOR, 0.3);
box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.1);
flex-shrink: 0;
```
- Mineral: background `#44bbff`, border `rgba(68, 187, 255, 0.3)`, shape = rounded square
- Gas: background `#44ff66`, border `rgba(68, 255, 102, 0.3)`, shape = circle (border-radius: 50%)
- Supply: background `#ffcc44`, border `rgba(255, 204, 68, 0.3)`, shape = rounded square

### Minimap Frame (PixiJS)

**Before (MinimapRenderer.ts:86-92):**
```
rect(-5, -5, SIZE+10, SIZE+10) fill 0x000000 alpha 0.75
stroke 0x334466 width 1.5 alpha 0.6
inner stroke 0x223344 width 0.5 alpha 0.4
```

**After:**
```
// Outer frame
rect(-6, -6, SIZE+12, SIZE+12) fill 0x000000 alpha 0.82
stroke FACTION_PRIMARY_HEX width 2.0 alpha 0.4

// Inner highlight (top edge bevel simulation)
moveTo(-4, -4) lineTo(SIZE+4, -4)
stroke FACTION_PRIMARY_HEX width 1.0 alpha 0.15

// Inner border
rect(-2, -2, SIZE+4, SIZE+4) stroke 0x1a2a3a width 0.5 alpha 0.5
```

### Game Over Entrance Animation

```
// Initial state (before show):
overlay: opacity 0, display flex
title: transform scale(0.85), opacity 0
stats/buttons: opacity 0, transform translateY(8px)

// Trigger (requestAnimationFrame double-tick):
overlay: opacity 1, transition 0.5s ease-out
title: transform scale(1), opacity 1, transition 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)
stats: opacity 1, translateY(0), transition 0.4s ease-out, delay 0.25s
buttons: opacity 1, translateY(0), transition 0.4s ease-out, delay 0.35s
```

### Scope Summary
- **Items planned:** 1 (UI look and feel)
- **Tasks generated:** 6
- **Estimated total size:** 1S + 1M + 1S + 1L + 1M + 1M = ~1600 lines touched
- **Critical path:** Task 1 → Task 2 → Task 4 (theme → factories → info panel)
- **New patterns needed:** Design token system (`src/ui/theme.ts`), panel frame factory, button factory
- **Files affected:** 3 new, 10 modified
- **Zero gameplay changes** — all modifications are in rendering/ files and new ui/ utilities

### What Changes Visually

| Element | Before | After |
|---------|--------|-------|
| Panel backgrounds | Flat `rgba(0,0,0,0.6)` | Subtle gradient, beveled border (bright top edge, dark bottom) |
| Panel borders | `rgba(100,160,255,0.3)` everywhere | Faction-aware: Terran blue chrome, Zerg red/amber chrome |
| Buttons | Flat dark boxes, manual hover | Gradient background, hover glow, press effect, hotkey badge |
| HP bar | Solid green/yellow/red | Gradient fill, inner shadow, smoother transitions |
| Typography | Monospace 13px for everything | Size hierarchy: 15px names, 12px stats, 10px labels |
| Resource HUD | Tiny 10px colored squares | Larger styled icons, better visual grouping |
| Minimap frame | Thin `0x334466` border | Prominent frame with inner glow matching faction |
| Control groups | Flat slots | Beveled slots, faction-tinted active highlight |
| Game over | Instant snap-on | Fade-in entrance animation |
| Faction theming | Same chrome for both factions | Blue chrome (Terran) vs red/amber chrome (Zerg) |

### Dependency Graph

```
Task 1 (Theme System)
  ├──→ Task 2 (Panel Frame + Button Factories)
  │      ├──→ Task 3 (HUD Renderer)
  │      ├──→ Task 4 (Info Panel)        ← critical path
  │      ├──→ Task 5 (BuildMenu + CG + Minimap)
  │      └──→ Task 6 (Alerts + GameOver)
  │
  └──→ Tasks 3–6 also import theme directly
```

### Execution Order
| # | Task | Size | Depends on | Files |
|---|------|------|-----------|-------|
| 1 | Design Token System | S | — | 1 new |
| 2 | Panel Frame & Button Factories | M | 1 | 2 new |
| 3 | HUD Renderer Upgrade | S | 1, 2 | 1 modified |
| 4 | Info Panel Overhaul | L | 1, 2 | 1 modified |
| 5 | Build Menu, Control Groups & Minimap | M | 1, 2 | 4 modified |
| 6 | Alerts, Mode Indicator & Game Over | M | 1, 2 | 3 modified |

Tasks 3–6 are independent of each other. After Tasks 1–2 land, they can execute in any order.

### Risk Register
| Risk | Impact | Mitigation |
|------|--------|------------|
| InfoPanelRenderer (1147 lines) is tightly coupled to ECS | High — could break production/ability buttons | Preserve exact callback signatures and DOM IDs; test all button types manually |
| MinimapRenderer uses PixiJS not DOM | Medium — theme colors need hex number format | Theme exports both CSS strings and 0x hex numbers |
| Dynamic button state updates may break | Medium — affordability/tech-lock styling is frame-by-frame | Button factory must support post-creation state mutation |
| index.html start screen style mismatch | Low — menus use different styling than game HUD | Out of scope; start screen is not part of skirmish in-game UI |

---

## Task Specs

### Task 1: Design Token System
**Size:** S
**Depends on:** none
**Unblocks:** Tasks 2, 3, 4, 5, 6

#### Goal
Create a centralized design token file that every UI renderer can import instead of hardcoding colors, fonts, and spacing. This is the foundation for the entire visual upgrade — without it, every renderer continues to have its own copy of the same magic values.

#### Prerequisites
None. This is a new file with no dependencies.

#### Changes (in execution order)

**Step 1: Create directory**
- `mkdir src/ui` (if it doesn't exist)

**Step 2: Create `src/ui/theme.ts`**
- File: `src/ui/theme.ts` (new, ~150 lines)
- Create the theme module with these exact exports, using the values from the Visual Design Specification above:

```typescript
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
  panelBg: string;       // CSS linear-gradient value
  panelBevel: string;     // CSS box-shadow inset value for top highlight
  buttonBg: string;       // CSS linear-gradient value
  buttonBgHover: string;
  text: string;
  textDim: string;
  textMuted: string;
  glow: string;           // CSS box-shadow for hover glow
}

export const TERRAN_PALETTE: FactionPalette = {
  primary: '#3399ff',
  primaryHex: 0x3399ff,
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
  primary: '#cc4444',
  primaryHex: 0xcc4444,
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
  mineral: '#44bbff',       mineralHex: 0x44bbff,
  gas: '#44ff66',           gasHex: 0x44ff66,
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
```

- Pattern: Follows constants.ts style (module-level exports, no class). Imports only `Faction` enum.
- Why: 12 renderer files currently duplicate the same rgba/hex strings. Centralizing enables faction theming.

#### Edge cases
- PixiJS renderers (MinimapRenderer) need `0xRRGGBB` numbers, not CSS strings — palette has `primaryHex`, colors have `mineralHex` etc.
- Some colors are dynamic (HP bar changes based on %, supply color changes on cap) — theme provides the palette, renderers still pick from it
- `panelBg` and `buttonBg` are `linear-gradient(...)` strings, not simple colors — they go into `background` not `backgroundColor`

#### NOT in scope
- Modifying any existing renderer — that's Tasks 3–6
- Start screen / index.html styles — not part of skirmish in-game UI

#### Acceptance criteria
- [ ] `src/ui/theme.ts` exists with all exports from the spec above
- [ ] `getFactionPalette(Faction.Terran)` returns blue palette, `.primaryHex === 0x3399ff`
- [ ] `getFactionPalette(Faction.Zerg)` returns red palette, `.primaryHex === 0xcc4444`
- [ ] `npm run build` passes with no type errors
- [ ] No existing files modified

#### Test plan
- Type-check only (`npm run build`) — no visual changes yet
- Verify imports: `import { getFactionPalette, colors, fonts } from '../ui/theme'`

---

### Task 2: Panel Frame & Button Factories
**Size:** M
**Depends on:** Task 1
**Unblocks:** Tasks 3, 4, 5, 6

#### Goal
Create reusable factory functions for styled panel frames and buttons. Panels get a beveled SC2-style border with faction-aware coloring. Buttons get gradient backgrounds, hover glow, hotkey badges, and clean disabled states.

#### Prerequisites
- `src/ui/theme.ts` must exist (Task 1)

#### Changes (in execution order)

**Step 1: Create `src/ui/panelFrame.ts` (~80 lines)**
- File: `src/ui/panelFrame.ts` (new)
- Exact API:

```typescript
import { Faction } from '../constants';
import { getFactionPalette, fonts, panel as panelPreset, type FactionPalette } from './theme';

export interface PanelFrameOptions {
  position: {
    top?: string;
    bottom?: string;
    left?: string;
    right?: string;
    centerX?: boolean;   // adds left:50% + transform:translateX(-50%)
  };
  faction?: Faction;      // default Terran
  zIndex?: number;        // default 10
  minWidth?: string;
  pointerEvents?: boolean; // default false
  id?: string;            // HTML id attribute
}

export function createPanelFrame(options: PanelFrameOptions): HTMLDivElement {
  const el = document.createElement('div');
  if (options.id) el.id = options.id;
  const palette = getFactionPalette(options.faction ?? Faction.Terran);
  
  // Position
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
```

- Why: Replaces ~12 nearly-identical `style.cssText` blocks across renderers.

**Step 2: Create `src/ui/button.ts` (~160 lines)**
- File: `src/ui/button.ts` (new)
- Exact API:

```typescript
import { Faction } from '../constants';
import { getFactionPalette, fonts, colors, type FactionPalette } from './theme';

export type ButtonState = 'normal' | 'active' | 'disabled' | 'error';

export interface ButtonOptions {
  label?: string;
  hotkey?: string;           // single char, shown in top-left badge
  portrait?: HTMLCanvasElement; // 44x44 or scaled
  portraitSize?: number;     // px, default 32
  cost?: { minerals: number; gas: number };
  supply?: number | string;  // shown top-right (e.g. "2" or "½")
  size?: 'sm' | 'md' | 'lg'; // sm=46x auto, md=46x54, lg=80x auto
  faction?: Faction;
  onClick?: () => void;
}

// DATA ATTRIBUTES used for state tracking:
// data-ui-state: 'normal' | 'active' | 'disabled' | 'error'
// data-ui-faction: '1' | '2'

export function createButton(options: ButtonOptions): HTMLDivElement {
  const faction = options.faction ?? Faction.Terran;
  const palette = getFactionPalette(faction);
  const btn = document.createElement('div');
  btn.dataset.uiState = 'normal';
  btn.dataset.uiFaction = String(faction);
  
  // Size presets
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
  
  // Hover/leave handlers (read faction from data attr for live palette)
  btn.addEventListener('mouseenter', () => {
    if (btn.dataset.uiState === 'disabled' || btn.dataset.uiState === 'error') return;
    const p = getFactionPalette(Number(btn.dataset.uiFaction) as Faction);
    btn.style.background = p.buttonBgHover;
    btn.style.borderColor = p.borderHover;
    btn.style.boxShadow = p.glow;
  });
  btn.addEventListener('mouseleave', () => {
    // Re-apply current state styling
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
```

- Key design decisions:
  - Uses `data-ui-state` and `data-ui-faction` attributes to track state on the DOM element itself — avoids needing a parallel state map
  - `setButtonState` uses direct `.style` assignments (not className) for zero-reflow state updates compatible with per-frame calls in InfoPanelRenderer
  - Hover handler reads faction from data attribute so it works even after `updateButtonFaction` is called
  - mouseleave re-applies the current state to restore correct styling after hover
  - Portrait canvas is appended as a child (not background-image) matching existing pattern in InfoPanelRenderer:827

#### Edge cases
- Panel frame `pointerEvents: false` must not block inner rows that set `pointer-events: auto` — this works because CSS `pointer-events: none` on parent allows `auto` on children
- `setButtonState` is called every frame for production buttons (InfoPanelRenderer:866-917) — must be fast. All property assignments are simple string sets, no DOM queries
- Buttons with portraits: the canvas is a DOM child, `setButtonState` doesn't touch it (opacity on the parent affects children naturally). But tech-locked state needs to dim the portrait separately — this is handled by the caller (InfoPanelRenderer), not the button factory
- `createPanelFrame` returns `display: none` — caller sets `display: flex` when showing, matching current pattern

#### NOT in scope
- Applying these factories to any renderer — that's Tasks 3–6
- PixiJS-based panel frames (MinimapRenderer border is PixiJS Graphics, not DOM)

#### Acceptance criteria
- [ ] `src/ui/panelFrame.ts` exports `createPanelFrame` and `updatePanelFaction`
- [ ] `src/ui/button.ts` exports `createButton`, `setButtonState`, `updateButtonFaction`
- [ ] Panel frame has visible bevel (inner top highlight via box-shadow)
- [ ] Panel frame gradient background (not flat color)
- [ ] Button hover: border brightens + subtle glow
- [ ] Button mouseleave: restores to current state
- [ ] `setButtonState('disabled')`: opacity 0.4, no pointer events, dim border
- [ ] `setButtonState('error')`: red border, opacity 0.45
- [ ] `npm run build` passes with no type errors
- [ ] Existing tests still pass

#### Test plan
- `npm run build` && `npm test`
- Manual: temporarily add a test button in Game.ts to verify visual states

---

### Task 3: HUD Renderer Upgrade
**Size:** S
**Depends on:** Tasks 1, 2
**Unblocks:** none

#### Goal
Upgrade the resource HUD (top-right) to use the theme system and panel frame. This is the simplest panel and serves as validation that the theme + panel frame work end-to-end before tackling harder renderers.

#### Prerequisites
- `src/ui/theme.ts` (Task 1)
- `src/ui/panelFrame.ts` (Task 2)

#### Changes (in execution order)

**Step 1: Add imports**
- File: `src/rendering/HudRenderer.ts`
- Change: Add at top (after line 1):
  ```typescript
  import { createPanelFrame, updatePanelFaction } from '../ui/panelFrame';
  import { getFactionPalette, colors, fonts, spacing } from '../ui/theme';
  ```

**Step 2: Replace root div with panel frame**
- File: `src/rendering/HudRenderer.ts`
- Change: Replace lines 19-36 (the `hud` div creation and `style.cssText` block) with:
  ```typescript
  const hud = createPanelFrame({
    id: 'resource-hud',
    position: { top: '8px', right: '12px' },
    faction: Faction.Terran,
  });
  hud.style.display = 'flex';        // HUD is always visible
  hud.style.flexDirection = 'row';   // horizontal layout
  hud.style.gap = spacing.xl;        // 16px between groups
  ```
  Store as `private hud: HTMLDivElement` for `updatePanelFaction` in setFaction.
- Pattern: Panel frame factory
- Why: Replaces flat `rgba(0,0,0,0.6)` with gradient + bevel.

**Step 3: Replace hardcoded colors with theme tokens**
- File: `src/rendering/HudRenderer.ts`
- Line-by-line color map:
  | Line | Before | After |
  |------|--------|-------|
  | 41 | `background:#44bbff` | `background:${colors.mineral}` |
  | 50 | `background:#44ff66` | `background:${colors.gas}` |
  | 59 | `background:#ffcc44` | `background:${colors.supply}` |
  | 68 | `background:#88aacc` | `background:${TERRAN_PALETTE.textDim}` |
  | 71 | `color: '#88aacc'` | `color: palette.textDim` |
  | 79 | `color: '#888'` | `color: palette.textMuted` |
  | 82 | `color:#ffcc44` | `color:${colors.warning}` |
  | 89 | `color: '#888'` | `color: palette.textMuted` |
  | 92 | `color: '#ffaa44'` | `color: '${colors.production}'` |
  | 98 | `color: #88aaff` | `color: ${TERRAN_PALETTE.secondary}` |
  | 101 | `color: #888` | `color: ${TERRAN_PALETTE.textMuted}` |
  | 135 | `'#ff4444'` (supply capped) | `colors.error` |
  | 135 | `'#eee'` (supply normal) | `palette.text` |
  | 137 | `'#ffaa22'` (saturated) | `colors.warning` |

**Step 4: Upgrade setFaction to use theme palette**
- File: `src/rendering/HudRenderer.ts`
- Change: Replace lines 114-121 with:
  ```typescript
  setFaction(f: Faction): void {
    this.currentPalette = getFactionPalette(f);
    updatePanelFaction(this.hud, f);
  }
  ```
  Add `private currentPalette = TERRAN_PALETTE;` and `private hud: HTMLDivElement;` fields.
  In `update()`, use `this.currentPalette.text` instead of `'#eee'` for dynamic color assignments.

**Step 5: Upgrade resource icon styling**
- File: `src/rendering/HudRenderer.ts`
- Change: For each icon (lines 40-41, 49-50, 58-59, 67-68), increase from 10x10 to 14x14, add border and inner highlight:
  ```typescript
  mineralIcon.style.cssText = `
    display: inline-flex; align-items: center; justify-content: center;
    width: 14px; height: 14px;
    background: ${colors.mineral};
    border-radius: 3px;
    border: 1px solid rgba(68, 187, 255, 0.3);
    box-shadow: inset 0 1px 0 rgba(255,255,255,0.1);
    flex-shrink: 0;
  `;
  ```
  Gas icon keeps `border-radius: 50%` (circle). Supply and worker icons use `border-radius: 3px` (square).

#### Edge cases
- Supply color must still dynamically change: `update()` line 135 checks `supplyUsed >= supplyProvided` → uses `colors.error`, else `this.currentPalette.text`
- Speed indicator (line 82) uses `colors.warning` yellow
- Income row (line 101) uses `this.currentPalette.textMuted`
- Worker saturation (line 137) uses `colors.warning` when saturated, `this.currentPalette.textDim` otherwise

#### NOT in scope
- Changing the HUD layout (remains horizontal flex row)
- Adding new metrics
- Changing the public API signatures

#### Acceptance criteria
- [ ] HUD has gradient background + bevel (not flat black)
- [ ] Zero hardcoded hex color strings remain in HudRenderer.ts
- [ ] Faction switch changes panel chrome (Terran=blue, Zerg=red border/gradient)
- [ ] Supply turns red when capped (`colors.error`)
- [ ] Worker count turns amber when saturated
- [ ] Resource icons are 14x14 with subtle border
- [ ] Speed indicator and income row use theme tokens
- [ ] `npm run build` passes
- [ ] Existing tests still pass

#### Test plan
- Manual: Start Terran skirmish → verify blue-chromed HUD with gradient bg
- Manual: Start Zerg skirmish → verify red-chromed HUD
- Manual: Verify supply turns red when you hit supply cap
- Manual: Verify upgrade text shows when upgrades researched
- `npm run build` && `npm test`

#### Risk notes
- Low risk. HudRenderer is 184 lines, no callbacks, no interactive elements. Self-contained.

---

### Task 4: Info Panel Overhaul
**Size:** L
**Depends on:** Tasks 1, 2
**Unblocks:** none

#### Goal
Upgrade the command card (bottom-left info panel) — the largest and most complex UI component. Apply panel frame, button factories, and theme tokens. This is the highest-impact single change because the info panel is visible whenever anything is selected.

#### Prerequisites
- `src/ui/theme.ts` (Task 1)
- `src/ui/panelFrame.ts` and `src/ui/button.ts` (Task 2)

#### Changes (in execution order)

**Step 1: Add imports and palette field**
- File: `src/rendering/InfoPanelRenderer.ts`
- Change: Add imports after line 1:
  ```typescript
  import { createPanelFrame, updatePanelFaction } from '../ui/panelFrame';
  import { createButton, setButtonState, updateButtonFaction, type ButtonState } from '../ui/button';
  import { getFactionPalette, colors, fonts, spacing, type FactionPalette, TERRAN_PALETTE } from '../ui/theme';
  ```
  Add field: `private palette: FactionPalette = TERRAN_PALETTE;`

**Step 2: Replace root panel with panel frame**
- File: `src/rendering/InfoPanelRenderer.ts`
- Change: Replace lines 133-153 (constructor panel creation) with:
  ```typescript
  this.panel = createPanelFrame({
    id: 'info-panel',
    position: { bottom: '16px', left: '12px' },
    faction: Faction.Terran,
    minWidth: '160px',
  });
  ```

**Step 3: Add `setFaction()` method**
- File: `src/rendering/InfoPanelRenderer.ts`
- Change: Add after `setAbilityCallback()` (line 273):
  ```typescript
  setFaction(f: Faction): void {
    this.palette = getFactionPalette(f);
    updatePanelFaction(this.panel, f);
  }
  ```
- Also file: `src/Game.ts`
- Change: Find where `this.hudRenderer.setFaction()` is called, add `this.infoPanel.setFaction(playerFaction)` on the next line.

**Step 4: Replace constructor element colors with theme tokens**
- File: `src/rendering/InfoPanelRenderer.ts`
- Line-by-line map for constructor elements:
  | Element | Line | Before | After |
  |---------|------|--------|-------|
  | nameEl | 162 | `color: #88bbff` | `color: ${TERRAN_PALETTE.secondary}` |
  | detailEl | 167 | `color: #aaa` | `color: ${TERRAN_PALETTE.textDim}` |
  | barFill | 182 | `background: #44ff44` | `background: ${colors.hpHigh}` |
  | barLabel | 188 | `font-size: 9px` | `font-size: ${fonts.sizeTiny}` |
  | statsEl | 198 | `font-family: 'Consolas'...` | `font-family: ${fonts.family}` |
  | statsEl | 199 | `font-size: 11px` | `font-size: ${fonts.sizeSM}` |
  | prodLabel | 210 | `color: #ffcc44` | `color: ${colors.production}` |
  | prodBarFill | 222 | `background: #ffaa22` | `background: ${colors.production}` |
  | All rows | 230,235,240,245,250 | `font-family`, `font-size` | Theme tokens |

**Step 5: Upgrade HP bar container styling**
- File: `src/rendering/InfoPanelRenderer.ts`
- Change: Replace lines 172-180 (barContainer style) with:
  ```typescript
  this.barContainer.style.cssText = `
    position: relative; width: 100%; height: 14px;
    background: rgba(15, 15, 20, 0.8);
    border: 1px solid ${TERRAN_PALETTE.borderDim};
    border-radius: 3px; overflow: hidden; margin-top: ${spacing.xs};
  `;
  ```
- Replace line 182 (barFill style) with:
  ```typescript
  this.barFill.style.cssText = `
    height: 100%;
    background: linear-gradient(180deg, ${colors.hpHigh} 0%, ${colors.hpHighGrad} 100%);
    box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.15);
    transition: width 0.15s ease-out;
  `;
  ```

**Step 6: Replace dynamic HP bar colors in update()**
- File: `src/rendering/InfoPanelRenderer.ts`
- Change: Replace HP bar color logic at 3 locations (lines 399-400, 562-563, 726-727):
  Before (repeated 3 times):
  ```typescript
  this.barFill.style.background = ratio > 0.5 ? '#44ff44' : ratio > 0.25 ? '#ffaa00' : '#ff3333';
  ```
  After:
  ```typescript
  this.barFill.style.background = ratio > 0.5
    ? `linear-gradient(180deg, ${colors.hpHigh} 0%, ${colors.hpHighGrad} 100%)`
    : ratio > 0.25
      ? `linear-gradient(180deg, ${colors.hpMid} 0%, ${colors.hpMidGrad} 100%)`
      : `linear-gradient(180deg, ${colors.hpLow} 0%, ${colors.hpLowGrad} 100%)`;
  ```
  Consider extracting a helper: `private getHpGradient(ratio: number): string`

**Step 7: Replace dynamic faction border assignments**
- File: `src/rendering/InfoPanelRenderer.ts`
- Change: Replace faction border at 4 locations:
  | Line | Before | After |
  |------|--------|-------|
  | 512 | `'rgba(100, 160, 255, 0.3)'` | `this.palette.border` |
  | 541 | `'rgba(80, 200, 255, 0.3)'` (resource) | `'rgba(80, 200, 255, 0.3)'` (keep — resource-specific) |
  | 654-656 | ternary Zerg/Terran rgba | `this.palette.border` |
  | 753-755 | ternary Zerg/Terran rgba | `this.palette.border` |
  | 770 | `'rgba(100, 160, 255, 0.3)'` (fallback) | `this.palette.border` |

**Step 8: Replace combat stats colors**
- File: `src/rendering/InfoPanelRenderer.ts`
- Change: Replace lines 734-740 stat HTML:
  Before: `color:#88bbff` / `color:#cce0ff`
  After: `color:${this.palette.secondary}` / `color:${this.palette.text}`

**Step 9: Upgrade production buttons to use button factory**
- File: `src/rendering/InfoPanelRenderer.ts`
- Change: In `updateProductionButtons()` (lines 790-862), replace the button creation loop:
  Before (lines 795-858): Manual `document.createElement('div')` + 60 lines of styling/handlers
  After:
  ```typescript
  const btn = createButton({
    hotkey: hotkeys[i] || undefined,
    portrait: this.portraitRenderer.getPortrait(uType),
    cost: { minerals: uDef.costMinerals, gas: uDef.costGas },
    supply: uDef.supply === 0.5 ? '½' : uDef.supply > 0 ? String(uDef.supply) : undefined,
    faction: fac,
    onClick: () => {
      if (this.productionCallback) this.productionCallback(buildingEid, uType);
    },
  });
  ```
  **Critical:** Preserve the `lastButtonConfig` check (lines 782-785). Only rebuild buttons when `configKey !== this.lastButtonConfig`.

**Step 10: Replace production button state updates**
- File: `src/rendering/InfoPanelRenderer.ts`
- Change: In the affordability loop (lines 866-917), replace manual style assignments with:
  ```typescript
  if (enabled) {
    setButtonState(btn, 'normal');
  } else if (!techMet) {
    setButtonState(btn, 'error');
    btn.title = `Requires: ${reqName}`;
  } else {
    setButtonState(btn, 'disabled');
  }
  // Portrait dimming for tech-locked (stays manual — button factory doesn't handle this)
  const canvas = btn.querySelector('canvas');
  if (canvas) canvas.style.opacity = (!techMet) ? '0.3' : enabled ? '1' : '0.4';
  ```

**Step 11: Upgrade ability buttons**
- File: `src/rendering/InfoPanelRenderer.ts`
- Change: In the ability button creation (lines 453-502), replace manual div+styling with:
  ```typescript
  const btn = createButton({
    label: ability.name,
    hotkey: ability.key,
    faction: fac,
    size: 'lg',
    onClick: () => {
      if (this.abilityCallback) this.abilityCallback(ability.commandType, [...unitEids]);
    },
  });
  // Prepend icon before label
  const iconEl = document.createElement('span');
  iconEl.style.cssText = `font-size: 14px; color: ${iconInfo.color}; line-height: 1;`;
  iconEl.textContent = iconInfo.symbol;
  btn.insertBefore(iconEl, btn.querySelector('.btn-label'));
  ```
  Remove the manual mouseenter/mouseleave handlers (lines 491-498) — button factory handles them.

**Step 12: Upgrade research buttons**
- File: `src/rendering/InfoPanelRenderer.ts`
- Change: In `updateResearchButtons()` (lines 1070-1143), replace manual button creation with `createButton({ label, size: 'lg', faction })`. Keep the level pip row and cost row appended as children after creation.
  Replace the manual hover handlers (lines 1126-1133) — button factory handles them.
  Use `setButtonState(btn, enabled ? 'normal' : 'disabled')` for state.

**Step 13: Upgrade addon buttons**
- File: `src/rendering/InfoPanelRenderer.ts`
- Change: In `updateAddonButtons()` (lines 997-1038), replace manual button divs with `createButton({ label, size: 'lg', faction })` + icon and cost children.
  Replace hover handlers (lines 1025-1030) — button factory handles them.

**Step 14: Upgrade queue display colors**
- File: `src/rendering/InfoPanelRenderer.ts`
- Change: In `updateQueueDisplay()` (lines 922-958):
  - Line 935: Replace `color: #888` with `color: ${this.palette.textMuted}`
  - Line 946: Replace `border: 1px solid rgba(255, 180, 44, 0.4)` with `border: 1px solid rgba(255, 180, 44, 0.35)`
  - Line 948: Replace `background: rgba(40, 30, 10, 0.7)` with themed dark bg

**Step 15: Upgrade multi-select portrait badges**
- File: `src/rendering/InfoPanelRenderer.ts`
- Change: In the multi-select section (lines 350-355), replace badge styling:
  - Line 354: Replace `font-family: 'Consolas', monospace` with `font-family: ${fonts.family}`
  - Replace breadcrumb colors (lines 389-390): `#cce0ff` → `this.palette.text`, `#557799` → `this.palette.textMuted`, `#334` → `this.palette.borderDim`

#### Edge cases
- Multi-unit selection portrait display (lines 334-366): preserve `innerHTML = ''` clear + rebuild loop
- Subgroup breadcrumb cycling (lines 382-394): preserve tab-cycling indicator with themed colors
- Queue display (lines 922-958): preserve portrait canvas cloning
- Ability targeting modes (Snipe, EMP, Bile → click triggers cursor change): preserved via `abilityCallback`
- Touch devices: `pointer-events: auto` on button rows preserved (button factory sets this by default)
- `lastButtonConfig` cache (line 130, 782-785): **must be preserved** — without it, buttons rebuild every frame causing flicker and portrait canvas loss
- Ghost energy/cloak status (lines 686-689) and Marine stim (lines 693-700): keep inline, just use theme colors
- Addon "BUILT" badge (lines 966-986): not a button — keep as styled div, just use theme tokens for colors

#### NOT in scope
- Changing the panel layout (portrait → name → HP → stats → buttons vertical flow stays the same)
- Adding new information to the panel
- Changing callback signatures
- Modifying PortraitRenderer.ts

#### Acceptance criteria
- [ ] Panel has gradient background + bevel (not flat `rgba(0,0,0,0.75)`)
- [ ] Zero hardcoded color strings remain in InfoPanelRenderer.ts (all from theme)
- [ ] Panel border auto-changes with faction (blue Terran, red Zerg)
- [ ] Production buttons: gradient bg, hover glow, hotkey badge, supply badge, portrait, cost
- [ ] Production buttons: disabled state dims correctly when can't afford
- [ ] Production buttons: error state (red border) when tech requirement not met
- [ ] Research buttons: gradient bg, hover glow, level pips, cost
- [ ] Ability buttons: gradient bg, hover glow, hotkey badge, icon, name
- [ ] Addon buttons: gradient bg, hover glow, icon, cost
- [ ] All 4 callback types fire correctly (production, research, addon, ability)
- [ ] HP bar: gradient fill (green→amber→red) with inner highlight
- [ ] Multi-unit selection: portraits with count badges display correctly
- [ ] Subgroup breadcrumbs: Tab cycling works with themed colors
- [ ] Queue display: portrait thumbnails in themed slots
- [ ] Combat stats: DMG/ARM/SPD/RNG/MOV in themed colors
- [ ] `npm run build` passes
- [ ] Existing tests still pass

#### Test plan
- Manual: Select CC/Hatchery → verify production buttons (all hotkeys Q/W/E visible)
- Manual: Select Barracks → verify Marine/Marauder production + addon buttons
- Manual: Click production button → unit trains, queue populates
- Manual: Select Engineering Bay → verify research buttons with level pips
- Manual: Click research → progress bar appears
- Manual: Select Marine → verify Stim ability button with "T" badge
- Manual: Select Ghost → verify Cloak/Snipe/EMP buttons with energy display
- Manual: Select multiple mixed units → verify portrait grid + subgroup breadcrumbs
- Manual: Tab key → verify subgroup cycling updates breadcrumb highlight
- Manual: Test with insufficient minerals → verify disabled state
- Manual: Test with missing prerequisite → verify error state (red border)
- Manual: Start as Zerg → verify red-themed panel chrome + buttons
- `npm run build` && `npm test`

#### Risk notes
- **Highest risk task.** InfoPanelRenderer is 1147 lines, 4 callback paths, 5 distinct button types.
- **Work in order.** Steps 1-8 (theme tokens) are safe. Steps 9-13 (button factory) are higher risk. Test after each step.
- **`lastButtonConfig` cache** (line 782): If broken, production buttons rebuild every frame → flicker + canvas portrait elements get destroyed. The button factory's `createButton` returns a new DOM element each time, so the cache check must happen BEFORE calling it.
- **Portrait canvas reuse:** `this.portraitRenderer.getPortrait(uType)` returns a cached canvas. When production buttons rebuild, the old canvas is detached. The new `createButton` call must pass a freshly cloned or newly retrieved portrait.
- **Addon "BUILT" badge** (lines 966-986) is NOT a button (no click handler) — keep it as a styled div with theme tokens.

---

### Task 5: Build Menu, Control Groups & Minimap Polish
**Size:** M
**Depends on:** Tasks 1, 2
**Unblocks:** none

#### Goal
Apply the theme system and panel/button factories to the remaining skirmish UI panels: build menu, control group strip, minimap border, and hotkey panel.

#### Prerequisites
- `src/ui/theme.ts` (Task 1)
- `src/ui/panelFrame.ts` and `src/ui/button.ts` (Task 2)

#### Changes (in execution order)

**Step 1: Upgrade BuildMenuRenderer — panel frame**
- File: `src/rendering/BuildMenuRenderer.ts`
- Change: Replace lines 21-41 (panel creation + style.cssText) with:
  ```typescript
  this.panel = createPanelFrame({
    id: 'build-menu',
    position: { bottom: '16px', centerX: true },
    faction: Faction.Terran,
  });
  this.panel.style.flexDirection = 'row';
  this.panel.style.gap = spacing.md;
  ```
- Also replace title styling (line 44) with theme tokens: `color: ${palette.secondary}; font-size: ${fonts.sizeSM}`

**Step 2: Upgrade BuildMenuRenderer — option slots**
- File: `src/rendering/BuildMenuRenderer.ts`
- Change: Replace lines 67-72 (option div creation) — each building slot becomes a `createButton` with `size: 'sm'`:
  ```typescript
  const opt = createButton({
    label: `${entry.key}: ${def.name} (${costText})`,
    size: 'sm',
    faction: this.playerFaction,
  });
  ```
  But note: build menu options are more like labels than interactive buttons (no direct click handler — input comes from keyboard). Keep `pointer-events: none` on these. The button factory gives them the gradient look.

**Step 3: Upgrade BuildMenuRenderer — update() state colors**
- File: `src/rendering/BuildMenuRenderer.ts`
- Change: Replace lines 205-224 (per-slot state styling) with `setButtonState()` calls:
  | Condition | Before | After |
  |-----------|--------|-------|
  | isFlashing | `color: #ff6666, borderColor: rgba(255,60,60,0.9)` | `setButtonState(opt, 'error')` + keep red text via `opt.style.color = colors.error` |
  | isActive | `color: #fff, borderColor: rgba(100,180,255,0.8)` | `setButtonState(opt, 'active')` |
  | !techOk | `color: #555, borderColor: rgba(100,50,50,0.3)` | `setButtonState(opt, 'error')` |
  | canAfford | `color: #eee, borderColor: rgba(100,160,255,0.4)` | `setButtonState(opt, 'normal')` |
  | !canAfford | `color: #666, borderColor: rgba(100,100,100,0.2)` | `setButtonState(opt, 'disabled')` |

**Step 4: Upgrade BuildMenuRenderer — tooltip**
- File: `src/rendering/BuildMenuRenderer.ts`
- Change: Replace tooltip styling (lines 88-105) with theme tokens:
  - `background: rgba(80, 0, 0, 0.85)` → stays (error-specific)
  - `color: #ff8888` → `color: ${colors.error}`
  - `font-family` → `fonts.family`
  - `border: 1px solid rgba(200, 60, 60, 0.5)` → stays (error-specific)

**Step 5: Upgrade BuildMenuRenderer — setFaction()**
- File: `src/rendering/BuildMenuRenderer.ts`
- Change: In `setFaction()` (line 141), add `updatePanelFaction(this.panel, f)` and call `updateButtonFaction()` on each option.

**Step 6: Upgrade ControlGroupRenderer — slot styling**
- File: `src/rendering/ControlGroupRenderer.ts`
- Change: Add imports:
  ```typescript
  import { getFactionPalette, fonts, spacing, colors, type FactionPalette, TERRAN_PALETTE } from '../ui/theme';
  ```
  Replace slot styling (lines 46-53) with theme tokens:
  ```typescript
  slot.style.cssText = `
    min-width: 36px; height: 28px; padding: 0 5px;
    display: flex; align-items: center; justify-content: center;
    background: rgba(0,0,0,0.5);
    border: 1px solid ${TERRAN_PALETTE.borderDim};
    color: ${TERRAN_PALETTE.textMuted};
    font-family: ${fonts.family}; font-size: ${fonts.sizeXS};
    border-radius: 3px; cursor: pointer; user-select: none;
    white-space: nowrap; transition: background 0.12s, border-color 0.12s;
  `;
  ```

**Step 7: Upgrade ControlGroupRenderer — tooltip styling**
- File: `src/rendering/ControlGroupRenderer.ts`
- Change: Replace tooltip styling (lines 58-64):
  ```typescript
  tooltip.style.cssText = `
    display: none; position: absolute; top: 30px; left: 0;
    background: linear-gradient(180deg, rgba(12,20,32,0.92) 0%, rgba(6,10,18,0.95) 100%);
    border: 1px solid ${TERRAN_PALETTE.border};
    border-radius: 4px; padding: ${spacing.sm} ${spacing.md}; z-index: 20;
    font-family: ${fonts.family}; font-size: ${fonts.sizeXS};
    white-space: nowrap;
    box-shadow: 0 4px 12px rgba(0,0,0,0.6);
    pointer-events: auto;
  `;
  ```

**Step 8: Upgrade ControlGroupRenderer — updateSlotVisuals()**
- File: `src/rendering/ControlGroupRenderer.ts`
- Change: Replace lines 209-219 (slot visual state) with palette-derived values:
  ```typescript
  if (info && info.count > 0) {
    slot.style.color = isActive ? palette.text : palette.textDim;
    slot.style.borderColor = isActive ? palette.borderHover : palette.border;
    slot.style.background = isActive ? 'rgba(20,40,80,0.7)' : 'rgba(8,16,40,0.6)';
  } else {
    slot.style.color = palette.textMuted;
    slot.style.borderColor = palette.borderDim;
    slot.style.background = 'rgba(0,0,0,0.3)';
  }
  ```
  Add palette field + `setFaction(f: Faction)` method similar to other renderers.

**Step 9: Upgrade ControlGroupRenderer — badge hover**
- File: `src/rendering/ControlGroupRenderer.ts`
- Change: Replace badge hover colors (lines 166-171):
  - mouseenter: `rgba(60,120,200,0.25)` → `rgba(${palette.primary}, 0.15)` — actually keep the rgba approach but derive from palette
  - Label color (line 158): `#aaccee` → `palette.textDim`

**Step 10: Upgrade MinimapRenderer border**
- File: `src/rendering/MinimapRenderer.ts`
- Change: Add import:
  ```typescript
  import { getFactionPalette, type FactionPalette, TERRAN_PALETTE } from '../ui/theme';
  ```
  Add field: `private palette: FactionPalette = TERRAN_PALETTE;`
  Replace `drawBackground()` border section (lines 86-92):
  ```typescript
  // Outer frame — faction-colored
  g.rect(-6, -6, MINIMAP_SIZE + 12, MINIMAP_SIZE + 12);
  g.fill({ color: 0x000000, alpha: 0.82 });
  g.rect(-6, -6, MINIMAP_SIZE + 12, MINIMAP_SIZE + 12);
  g.stroke({ color: this.palette.primaryHex, width: 2.0, alpha: 0.4 });
  // Top edge highlight (bevel simulation)
  g.moveTo(-4, -4); g.lineTo(MINIMAP_SIZE + 4, -4);
  g.stroke({ color: this.palette.primaryHex, width: 1.0, alpha: 0.15 });
  // Inner border
  g.rect(-2, -2, MINIMAP_SIZE + 4, MINIMAP_SIZE + 4);
  g.stroke({ color: 0x1a2a3a, width: 0.5, alpha: 0.5 });
  ```
  Add `setFaction(f: Faction)` method that updates `this.palette` and re-calls `drawBackground()`.
  
- Also file: `src/Game.ts`
- Change: Add `this.minimapRenderer.setFaction(playerFaction)` next to other setFaction calls.

**Step 11: Upgrade HotkeyPanelRenderer**
- File: `src/rendering/HotkeyPanelRenderer.ts`
- Change: Replace lines 12-30 (panel style.cssText) with theme tokens:
  ```typescript
  this.panel.style.cssText = `
    position: fixed; top: 42px; right: 12px;
    display: none; flex-direction: column; gap: ${spacing.xs};
    font-family: ${fonts.family}; font-size: ${fonts.sizeSM};
    color: ${TERRAN_PALETTE.textDim};
    background: linear-gradient(180deg, rgba(12,20,32,0.88) 0%, rgba(6,10,18,0.92) 100%);
    padding: ${spacing.md} ${spacing.lg};
    border-radius: 4px;
    border: 1px solid ${TERRAN_PALETTE.borderDim};
    box-shadow: ${TERRAN_PALETTE.panelBevel}, 0 2px 8px rgba(0,0,0,0.5);
    z-index: 10; pointer-events: none; user-select: none; line-height: 1.6;
  `;
  ```
  Replace title color (line 33): `#88bbff` → `TERRAN_PALETTE.secondary`

#### Edge cases
- BuildMenuRenderer's `flashLocked()` (lines 232-247): The flash timer (lines 190-191, 205-208) overrides button state for 2 seconds. After `setButtonState('error')`, the flash condition must still check `now < this.flashUntil[i]` and re-apply red text.
- ControlGroupRenderer right-click remove type (lines 182-196) and double-click filter (lines 174-179): These callbacks are on child badge elements, not on the slot itself. The badge creation in `rebuildTooltip()` is independent of slot styling.
- MinimapRenderer `setFaction` re-calls `drawBackground()` which clears and redraws the background graphics. This is safe — it's only called once at game start.

#### NOT in scope
- Changing minimap interaction (click-to-move, right-click commands)
- Adding new control group features
- Changing build menu slot count or hotkey assignments

#### Acceptance criteria
- [ ] Build menu: panel frame with gradient bg + bevel
- [ ] Build menu: building slots styled as themed buttons
- [ ] Build menu: `flashLocked()` still flashes red for 2s
- [ ] Build menu: active slot highlighted, disabled slots dimmed
- [ ] Control groups: slots use themed colors
- [ ] Control groups: active group has bright border + darker bg
- [ ] Control groups: tooltip has gradient bg + themed border + shadow
- [ ] Control groups: badge hover highlight uses faction color
- [ ] Minimap: border uses faction primary color (blue Terran, red Zerg)
- [ ] Minimap: border is thicker (2.0) with top-edge bevel highlight
- [ ] Hotkey panel: gradient bg, themed border, themed text colors
- [ ] All interactive behaviors preserved
- [ ] `npm run build` passes
- [ ] Existing tests still pass

#### Test plan
- Manual: Press B → styled build menu with gradient buttons
- Manual: Try building locked structure → red flash + tooltip
- Manual: Ctrl+1 assign units → styled active slot
- Manual: Hover group → gradient tooltip with unit breakdown
- Manual: Right-click badge in tooltip → type removed
- Manual: Start as Terran → blue minimap frame
- Manual: Start as Zerg → red minimap frame
- Manual: Press F1 → styled hotkey reference panel
- `npm run build` && `npm test`

---

### Task 6: Alerts, Mode Indicator & Game Over Screen
**Size:** M
**Depends on:** Tasks 1, 2
**Unblocks:** none

#### Goal
Apply theme and visual polish to the overlay/notification UI elements: alert banners, mode indicator, and the game over screen. Add a fade-in entrance animation to the game over screen.

#### Prerequisites
- `src/ui/theme.ts` (Task 1)
- `src/ui/panelFrame.ts` and `src/ui/button.ts` (Task 2)

#### Changes (in execution order)

**Step 1: Upgrade AlertRenderer**
- File: `src/rendering/AlertRenderer.ts`
- Change: Add import and replace lines 12-32 (style.cssText):
  ```typescript
  import { colors, fonts } from '../ui/theme';
  ```
  Replace:
  | Line | Before | After |
  |------|--------|-------|
  | 18 | `font-family: 'Consolas'...` | `font-family: ${fonts.family}` |
  | 19 | `font-size: 22px` | `font-size: ${fonts.sizeXL}` |
  | 22 | `color: #ff4444` | `color: ${colors.error}` |
  | 23 | `text-shadow: 0 0 10px rgba(255, 50, 50, 0.6)` | `text-shadow: 0 0 12px rgba(255, 50, 50, 0.7)` |
  | 24 | `background: rgba(0, 0, 0, 0.5)` | `background: rgba(0, 0, 0, 0.6); backdrop-filter: blur(2px)` |
  | 27 | `border: 1px solid rgba(255, 80, 80, 0.4)` | `border: 1px solid rgba(255, 80, 80, 0.45)` |
  Keep the existing `@keyframes alertPulse` injection (lines 34-42) — it works well.

**Step 2: Upgrade ModeIndicatorRenderer**
- File: `src/rendering/ModeIndicatorRenderer.ts`
- Change: Add import:
  ```typescript
  import { colors, fonts, TERRAN_PALETTE } from '../ui/theme';
  ```
  Replace line 16: `font-family` → `fonts.family`
  Replace line 17: `font-size: 14px` → `font-size: ${fonts.sizeLG}`
  Add to style.cssText: `backdrop-filter: blur(2px);`
  
  Replace mode colors (lines 42-58):
  | Mode | Before color | After color | Before bg | After bg |
  |------|-------------|-------------|-----------|----------|
  | Ability | `#ff88cc` | keep (distinctive) | `rgba(100,20,60,0.6)` | keep |
  | Attack Move | `#ffcc44` | `${colors.warning}` | `rgba(100,80,0,0.6)` | keep |
  | Patrol | `#44ffaa` | keep (distinctive green) | `rgba(0,80,50,0.6)` | keep |
  | Build Mode | `#88bbff` | `${TERRAN_PALETTE.secondary}` | `rgba(20,40,100,0.6)` | keep |
  | Paused | `#ffffff` | keep | `rgba(0,0,0,0.7)` | keep |

**Step 3: Upgrade GameOverRenderer — theme tokens**
- File: `src/rendering/GameOverRenderer.ts`
- Change: Add imports:
  ```typescript
  import { createButton } from '../ui/button';
  import { colors, fonts, spacing, TERRAN_PALETTE } from '../ui/theme';
  ```
  Replace font-family at lines 40, 49, 57 with `fonts.family`.
  Replace colors:
  | Line | Before | After |
  |------|--------|-------|
  | 50 | `color: #aaa` (subtitle) | `color: ${TERRAN_PALETTE.textDim}` |
  | 59 | `color: #ccc` (stats) | `color: ${TERRAN_PALETTE.textDim}` |
  | 62-63 | `background: rgba(0,0,0,0.4)` (stats box) | `background: linear-gradient(180deg, rgba(12,20,32,0.8) 0%, rgba(6,10,18,0.85) 100%); border: 1px solid ${TERRAN_PALETTE.borderDim}; box-shadow: ${TERRAN_PALETTE.panelBevel}, 0 2px 8px rgba(0,0,0,0.5)` |

**Step 4: Upgrade GameOverRenderer — buttons**
- File: `src/rendering/GameOverRenderer.ts`
- Change: Replace Play Again button (lines 69-83) with:
  ```typescript
  this.playAgainBtn = createButton({
    label: 'PLAY AGAIN',
    size: 'lg',
    faction: Faction.Terran,
    onClick: () => window.location.reload(),
  }) as unknown as HTMLButtonElement; // keep type for existing refs
  this.playAgainBtn.style.marginTop = spacing.xl;
  this.playAgainBtn.style.padding = '10px 28px';
  this.playAgainBtn.style.fontSize = fonts.sizeLG;
  this.playAgainBtn.style.letterSpacing = '1px';
  this.playAgainBtn.style.display = 'none';
  ```
  Actually: the Play Again button is `HTMLButtonElement` but `createButton` returns `HTMLDivElement`. Two options:
  - Option A: Change Play Again to a div (simpler, matches rest of UI)
  - Option B: Keep as button, just apply theme styles manually
  **Recommend Option A** — change `private playAgainBtn: HTMLButtonElement` to `HTMLDivElement`, `createElement('button')` to `createButton(...)`. The `click` handler on a div works the same way.
  
  Same for Save Replay button (lines 86-100). But note: Save Replay has dynamic text change in `setReplay()` (lines 190-199) — the button factory's label element must be accessible. Use `btn.querySelector('.btn-label')` or store a reference.

**Step 5: Add game over entrance animation**
- File: `src/rendering/GameOverRenderer.ts`
- Change: Add transition CSS to constructor elements:
  ```typescript
  // Overlay
  this.overlay.style.opacity = '0';
  this.overlay.style.transition = 'opacity 0.5s ease-out';
  
  // Title
  this.titleEl.style.transform = 'scale(0.85)';
  this.titleEl.style.opacity = '0';
  this.titleEl.style.transition = 'transform 0.4s cubic-bezier(0.34, 1.56, 0.64, 1), opacity 0.4s ease-out';
  
  // Stats
  this.statsEl.style.transform = 'translateY(8px)';
  this.statsEl.style.opacity = '0';
  this.statsEl.style.transition = 'transform 0.4s ease-out 0.25s, opacity 0.4s ease-out 0.25s';
  
  // Buttons
  this.playAgainBtn.style.transform = 'translateY(8px)';
  this.playAgainBtn.style.opacity = '0';
  this.playAgainBtn.style.transition = 'transform 0.4s ease-out 0.35s, opacity 0.4s ease-out 0.35s';
  // Same for saveReplayBtn with 0.4s delay
  ```
  
  Replace `show()` method (lines 203-209):
  ```typescript
  private show(title: string, subtitle: string, color: string): void {
    this.shown = true;
    this.titleEl.textContent = title;
    this.titleEl.style.color = color;
    this.subtitleEl.textContent = subtitle;
    this.overlay.style.display = 'flex';
    this.playAgainBtn.style.display = 'block';
    
    // Trigger animation via double-rAF (ensures display:flex is painted before transition starts)
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        this.overlay.style.opacity = '1';
        this.titleEl.style.transform = 'scale(1)';
        this.titleEl.style.opacity = '1';
        this.statsEl.style.transform = 'translateY(0)';
        this.statsEl.style.opacity = '1';
        this.playAgainBtn.style.transform = 'translateY(0)';
        this.playAgainBtn.style.opacity = '1';
        this.saveReplayBtn.style.transform = 'translateY(0)';
        this.saveReplayBtn.style.opacity = '1';
      });
    });
  }
  ```
  Pattern: Same `requestAnimationFrame` double-tick as ScenarioHudRenderer countdown (src/rendering/ScenarioHudRenderer.ts:205-210).

**Step 6: Upgrade GameOverRenderer — victory/defeat colors**
- File: `src/rendering/GameOverRenderer.ts`
- Change: Replace color strings passed to `show()`:
  | Line | Before | After |
  |------|--------|-------|
  | 145 | `'#ff4444'` (defeat) | `colors.error` |
  | 152 | `'#44ff44'` (victory) | `colors.success` |
  | 156 | `'#44ff44'` (victory) | `colors.success` |
  | 163 | `'#44ff44'` (victory) | `colors.success` |

**Step 7: Upgrade GameOverRenderer — Save Replay dynamic text**
- File: `src/rendering/GameOverRenderer.ts`
- Change: In `setReplay()` (lines 190-199), replace color strings:
  | Line | Before | After |
  |------|--------|-------|
  | 194 | `color: '#44bb88'` | `color: '${colors.success}'` |
  | 195 | `borderColor: '#2a6a4a'` | keep (specific to success green border) |
  | 198 | `color: '#ff6644'` | `color: '${colors.error}'` |

#### Edge cases
- AlertRenderer's `alertPulse` keyframe (lines 36-40): The `@keyframes` block is injected into `<head>` via a `<style>` tag. Adding `backdrop-filter` to the panel CSS doesn't affect the animation.
- Game over overlay: `pointer-events: none` on the overlay + `pointer-events: auto` on buttons. The button factory sets `pointer-events: auto` by default, so this is preserved. But the overlay must keep `pointer-events: none`.
- Save Replay dynamic text: `setReplay()` changes `this.saveReplayBtn.textContent` (line 193). With `createButton`, the label is a child `<span>` element. Change to: `const label = this.saveReplayBtn.querySelector('.btn-label'); if (label) label.textContent = '...';`
- The double-rAF pattern for animation: if `show()` is called and the overlay was already `display: flex` (shouldn't happen since `this.shown` guards it), the animation still works correctly because CSS transitions trigger on property changes.

#### NOT in scope
- ScenarioHudRenderer and ScenarioResultRenderer — practice mode, not skirmish
- Adding new stats to game over
- Changing alert timing or trigger conditions
- Touch optimization for alert/game over

#### Acceptance criteria
- [ ] Alert: theme font, `colors.error` text, `backdrop-filter: blur(2px)`
- [ ] Alert: `alertPulse` animation still works
- [ ] Mode indicator: theme font, themed colors per mode, `backdrop-filter`
- [ ] Game over: overlay fades in over 0.5s (not instant snap-on)
- [ ] Game over: title scales from 85% → 100% with overshoot easing
- [ ] Game over: stats box and buttons stagger-appear (0.25s, 0.35s delay)
- [ ] Game over: stats box has gradient bg + themed border
- [ ] Game over: Play Again button uses button factory styling
- [ ] Game over: Save Replay button uses button factory styling
- [ ] Game over: Save Replay text change on click still works ("REPLAY SAVED (N commands)")
- [ ] Game over: defeat = `colors.error`, victory = `colors.success`
- [ ] `npm run build` passes
- [ ] Existing tests still pass

#### Test plan
- Manual: Wait for AI wave → "ENEMY WAVE INCOMING" alert with themed style
- Manual: Press A → "ATTACK MOVE" indicator with themed yellow
- Manual: Press Escape → "PAUSED" indicator
- Manual: Win game (destroy enemy base) → fade-in animation, green "VICTORY"
- Manual: Lose game (let CC die) → fade-in animation, red "DEFEAT"
- Manual: Click Save Replay → text changes to "REPLAY SAVED (N commands)"
- Manual: Click Play Again → page reloads
- `npm run build` && `npm test`

---

## Cross-Cutting Concerns

### New Pattern: Design Token System
All UI rendering code should import colors/fonts/spacing from `src/ui/theme.ts` instead of hardcoding values. The theme provides both CSS string format (`'#3399ff'`) and PixiJS number format (`0x3399ff`) for each color that renderers might need in both contexts.

### New Pattern: Panel Frame Factory
`createPanelFrame(options)` creates a pre-styled container div. Renderers call it once in their constructor and append their content elements to the returned div. The frame handles background, border, border-radius, box-shadow, positioning, font-family, and z-index.

### New Pattern: Button Factory
`createButton(options)` creates a pre-styled interactive button div. `setButtonState(btn, state)` updates its visual state without rebuilding the DOM. This replaces the manual `mouseenter`/`mouseleave` + inline style updates found in 5+ renderers.

### Constants/Enum Additions
No new constants or enums needed. All color values already exist scattered across renderers — this work centralizes them.

### Faction Palette Contract
Every DOM-based renderer gets a `setFaction(f: Faction)` method (some already have it). Game.ts calls all of them after game init. The theme's `getFactionPalette(f)` returns the complete color set.

### File Index (What Goes Where)
```
src/ui/            (NEW directory)
├── theme.ts       (Task 1 — design tokens)
├── panelFrame.ts  (Task 2 — panel frame factory)
└── button.ts      (Task 2 — button factory)

src/rendering/     (MODIFIED files)
├── HudRenderer.ts            (Task 3)
├── InfoPanelRenderer.ts      (Task 4)
├── BuildMenuRenderer.ts      (Task 5)
├── ControlGroupRenderer.ts   (Task 5)
├── MinimapRenderer.ts        (Task 5)
├── HotkeyPanelRenderer.ts    (Task 5)
├── AlertRenderer.ts          (Task 6)
├── ModeIndicatorRenderer.ts  (Task 6)
└── GameOverRenderer.ts       (Task 6)

src/Game.ts        (Task 4 — add infoPanel.setFaction + minimap.setFaction calls)
```

---

## Architecture Model (snapshot)

### Rendering Layer
- **World-space (PixiJS):** TilemapRenderer, UnitRenderer, ProjectileRenderer, WaypointRenderer, FogRenderer — added to viewport
- **Screen-space (PixiJS):** MinimapRenderer, SelectionRenderer — added to app.stage
- **DOM overlays:** HudRenderer, InfoPanelRenderer, BuildMenuRenderer, ControlGroupRenderer, AlertRenderer, ModeIndicatorRenderer, GameOverRenderer, HotkeyPanelRenderer, TouchCommandBar — HTML elements in game container

### UI Data Flow
```
ECS Components → Systems (tick) → Renderers (frame)
  selected[]        SelectionSystem    InfoPanelRenderer
  prodProgress[]    ProductionSystem   InfoPanelRenderer
  hpCurrent[]       CombatSystem       UnitRenderer, InfoPanelRenderer
  fogGrid[]         FogSystem          FogRenderer, MinimapRenderer
  PlayerResources   GatherSystem       HudRenderer
```

### System Execution Order
spatialHash → commandSystem → buildSystem → productionSystem → upgradeSystem → movementSystem → fogSystem → combatSystem → abilitySystem → gatherSystem → deathSystem → aiSystem → creepSystem

### Key Constraints
- All UI is DOM-based (except MinimapRenderer and SelectionRenderer which are PixiJS)
- No external CSS files — all styling is inline via `style.cssText`
- Monospace font (Consolas) throughout
- Fixed positioning for all panels
- `pointer-events: none` default, `auto` on interactive rows
- No component framework — raw DOM manipulation

---

## Player Feedback — UI Bugs & Features

The following items were reported from playtesting and belong in the UI/rendering domain.

---

### Task F1: Hover Tooltips for UI Elements
**Size:** M
**Depends on:** none (can be done before or after the visual overhaul)
**Priority:** HIGH — players don't know what abilities and buttons do

#### Problem
No hover tooltips exist for abilities, trainable units, upgrade buttons, or building production options. New players have no way to learn what buttons do, what they cost, or what hotkey triggers them.

#### Acceptance criteria
- [ ] Hovering a production button shows: unit name, mineral/gas cost, supply cost, build time, hotkey
- [ ] Hovering an ability button shows: ability name, energy cost, cooldown, effect description, hotkey
- [ ] Hovering an upgrade button shows: upgrade name, mineral/gas cost, research time, effect description
- [ ] Tooltip appears after 300ms hover delay, positioned above the button
- [ ] Tooltip follows the visual design spec (panel background, faction border)
- [ ] Tooltip disappears immediately on mouse-out
- [ ] Type-check passes clean

---

### Task F2: Fix Zergling Visual Artifact — Red Dots When Moving
**Size:** S
**Depends on:** none
**Priority:** MED — visual distraction

#### Problem
When moving Zerglings, a bunch of red dots appear outside of them. Likely a rendering issue with sub-sprites, attack indicators, or stale positions in the UnitRenderer being drawn at wrong offsets.

#### Acceptance criteria
- [ ] Moving Zerglings show no extra red dots or visual artifacts
- [ ] Zergling rendering matches other unit rendering (clean ellipse shape)
- [ ] No artifacts at any zoom level
- [ ] Type-check passes clean

---

### Task F3: Fix Training Progress Circle — Line to Top-Left Corner
**Size:** S
**Depends on:** none
**Priority:** MED — visual bug

#### Problem
When a unit is being trained in a building, the training progress circle (arc/pie indicator) has a stray line connected to the top-left corner of the panel. Likely a Canvas 2D `lineTo(0,0)` or missing `moveTo` before the arc draw call.

#### Acceptance criteria
- [ ] Training progress indicator draws cleanly as a circular arc with no stray lines
- [ ] Works for all building types with production queues
- [ ] Type-check passes clean

---

### Task F4: Enemy Unit Selection — View Stats & Info
**Size:** S
**Depends on:** none
**Priority:** MED — gameplay information

#### Problem
Enemy units are not selectable. Players want to click on enemy units to see basic info: HP, armor, damage, upgrades, unit type. This is standard SC2 behavior — you can always select enemy units to inspect them.

#### Acceptance criteria
- [ ] Clicking an enemy unit selects it (without deselecting player units if Shift held)
- [ ] Info panel shows enemy unit stats: name, HP, armor, damage, upgrades applied
- [ ] Enemy selection is read-only — no command buttons appear
- [ ] Player units remain commandable after deselecting an enemy unit
- [ ] Type-check passes clean
