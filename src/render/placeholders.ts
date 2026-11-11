/**
 * Procedural placeholders (REQ-042). Shape + main colour match the real tiles so
 * the six elements stay distinguishable in grayscale.
 */
import { TILE_COLORS } from '../core/constants';
import type { TileKind } from '../core/types';

export type PlaceholderShape = 'star' | 'drop' | 'leaf' | 'flame' | 'diamond' | 'bolt';

export interface PlaceholderStyle {
  shape: PlaceholderShape;
  color: string;
  /** colorblind / fallback glyph */
  symbol: string;
}

export const PLACEHOLDER_STYLES: Readonly<Record<TileKind, PlaceholderStyle>> = {
  star: { shape: 'star', color: TILE_COLORS.star, symbol: '★' },
  water: { shape: 'drop', color: TILE_COLORS.water, symbol: '●' },
  leaf: { shape: 'leaf', color: TILE_COLORS.leaf, symbol: '▲' },
  flame: { shape: 'flame', color: TILE_COLORS.flame, symbol: '■' },
  crystal: { shape: 'diamond', color: TILE_COLORS.crystal, symbol: '◆' },
  bolt: { shape: 'bolt', color: TILE_COLORS.bolt, symbol: '✚' },
};

export interface Canvas2DContextLike {
  fillStyle: string;
  strokeStyle: string;
  lineWidth: number;
  font: string;
  textAlign: string;
  textBaseline: string;
  beginPath: () => void;
  moveTo: (x: number, y: number) => void;
  lineTo: (x: number, y: number) => void;
  closePath: () => void;
  arc: (x: number, y: number, r: number, start: number, end: number) => void;
  fill: () => void;
  stroke: () => void;
  fillRect: (x: number, y: number, w: number, h: number) => void;
  fillText: (text: string, x: number, y: number) => void;
}

function polygon(ctx: Canvas2DContextLike, points: readonly [number, number][]): void {
  ctx.beginPath();
  points.forEach(([px, py], i) => {
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  });
  ctx.closePath();
  ctx.fill();
}

export function drawPlaceholder(
  ctx: Canvas2DContextLike,
  kind: TileKind,
  x: number,
  y: number,
  size: number,
  options: { symbol?: boolean; outline?: boolean } = {},
): void {
  const style = PLACEHOLDER_STYLES[kind];
  const cx = x + size / 2;
  const cy = y + size / 2;
  const s = size / 64;
  ctx.fillStyle = style.color;
  ctx.strokeStyle = options.outline === false ? style.color : '#1B1B1B';
  ctx.lineWidth = 2;
  switch (style.shape) {
    case 'star': {
      const points: [number, number][] = [];
      for (let i = 0; i < 10; i += 1) {
        const radius = i % 2 === 0 ? 26 * s : 11 * s;
        const angle = -Math.PI / 2 + (i * Math.PI) / 5;
        points.push([cx + radius * Math.cos(angle), cy + radius * Math.sin(angle)]);
      }
      polygon(ctx, points);
      break;
    }
    case 'drop':
      ctx.beginPath();
      ctx.moveTo(cx, cy - 26 * s);
      ctx.lineTo(cx + 17 * s, cy + 6 * s);
      ctx.arc(cx, cy + 8 * s, 17 * s, 0, Math.PI);
      ctx.lineTo(cx, cy - 26 * s);
      ctx.closePath();
      ctx.fill();
      break;
    case 'leaf':
      ctx.beginPath();
      ctx.moveTo(cx - 22 * s, cy + 20 * s);
      ctx.lineTo(cx - 6 * s, cy - 22 * s);
      ctx.lineTo(cx + 22 * s, cy - 10 * s);
      ctx.lineTo(cx + 8 * s, cy + 22 * s);
      ctx.closePath();
      ctx.fill();
      break;
    case 'flame':
      ctx.beginPath();
      ctx.moveTo(cx, cy - 27 * s);
      ctx.lineTo(cx + 16 * s, cy + 2 * s);
      ctx.lineTo(cx + 7 * s, cy + 24 * s);
      ctx.lineTo(cx - 12 * s, cy + 22 * s);
      ctx.lineTo(cx - 16 * s, cy - 2 * s);
      ctx.closePath();
      ctx.fill();
      break;
    case 'diamond':
      polygon(ctx, [
        [cx, cy - 26 * s],
        [cx + 22 * s, cy],
        [cx, cy + 26 * s],
        [cx - 22 * s, cy],
      ]);
      break;
    case 'bolt':
      polygon(ctx, [
        [cx + 4 * s, cy - 27 * s],
        [cx - 16 * s, cy + 4 * s],
        [cx - 2 * s, cy + 2 * s],
        [cx - 6 * s, cy + 27 * s],
        [cx + 18 * s, cy - 6 * s],
        [cx + 2 * s, cy - 4 * s],
      ]);
      break;
  }
  if (options.symbol) {
    ctx.fillStyle = '#FFFFFF';
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 3;
    ctx.font = `${Math.round(26 * s)}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(style.symbol, cx, cy + 1 * s);
  }
}
