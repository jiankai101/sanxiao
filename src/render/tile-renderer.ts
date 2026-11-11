/// <reference types="vite/client" />
/**
 * Tile layer (REQ-039, REQ-043, REQ-044): 64x64 alignment, specials, selection,
 * colorblind glyphs, plus optional per-cell tween (offset / alpha / scale).
 */
import { CELL_SIZE, TILE_COLORS } from '../core/constants';
import type { Board, Cell, Tile, TileKind } from '../core/types';
import { TILE_IMAGE_BY_KIND } from './assets';
import { cellRect } from './layout';
import type { Rect } from './layout';
import { drawPlaceholder } from './placeholders';
import type { Canvas2DContextLike } from './placeholders';
import { IDENTITY_TWEEN, resolveTileTween } from './tween';
import type { MotionPolicy } from './animation';
import type { ResolvedTileTween, TileTweenMap } from './tween';

export const TILE_SYMBOLS: Readonly<Record<TileKind, string>> = {
  star: '★',
  water: '●',
  leaf: '▲',
  flame: '■',
  crystal: '◆',
  bolt: '✚',
};

export interface TileDrawContext extends Canvas2DContextLike {
  drawImage: (image: unknown, x: number, y: number, w: number, h: number) => void;
  strokeRect: (x: number, y: number, w: number, h: number) => void;
  save?: () => void;
  restore?: () => void;
  /** globalAlpha is optional so mock contexts stay structurally assignable */
  globalAlpha?: number;
}

export interface ImageProvider {
  get(name: string): unknown | undefined;
}

export interface TileDrawOptions {
  images?: ImageProvider;
  colorblind?: boolean;
  selected?: number | null;
  /** per-cell visual overrides (index = row-major board index 0..63) */
  tweens?: TileTweenMap;
  /** reduced motion drops every tile offset (REQ-044) */
  motion?: MotionPolicy;
}

const SPECIAL_IMAGE: Record<'line-h' | 'line-v' | 'rainbow', string> = {
  'line-h': 'special-line-h.webp',
  'line-v': 'special-line-v.webp',
  rainbow: 'special-rainbow.webp',
};

/**
 * Applies a resolved tween to a cell rect: uniform scale about the centre, then
 * the px offset. identity tween returns the rect untouched (backwards compatible).
 */
export function tweenedRect(rect: Rect, tween: ResolvedTileTween = IDENTITY_TWEEN): Rect {
  if (tween.scale === 1 && tween.offsetX === 0 && tween.offsetY === 0) return rect;
  const width = rect.width * tween.scale;
  const height = rect.height * tween.scale;
  return {
    x: rect.x + (rect.width - width) / 2 + tween.offsetX,
    y: rect.y + (rect.height - height) / 2 + tween.offsetY,
    width,
    height,
  };
}

function paintTileBody(
  ctx: TileDrawContext,
  tile: Tile,
  rect: Rect,
  options: TileDrawOptions,
): void {
  const size = rect.width;
  const image = tile.special === null
    ? (tile.kind ? options.images?.get(TILE_IMAGE_BY_KIND[tile.kind]) : undefined)
    : options.images?.get(SPECIAL_IMAGE[tile.special]);
  if (image !== undefined) {
    ctx.drawImage(image, rect.x, rect.y, size, rect.height);
    if (options.colorblind && tile.kind && tile.special !== 'rainbow') {
      drawColorblindSymbol(ctx, tile.kind, rect);
    }
    return;
  }
  if (tile.special === 'rainbow') {
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(rect.x, rect.y, size, rect.height);
    ctx.strokeStyle = '#1B1B1B';
    ctx.lineWidth = 3;
    ctx.strokeRect(rect.x + 2, rect.y + 2, size - 4, rect.height - 4);
    return;
  }
  if (tile.kind === null) return;
  drawPlaceholder(ctx, tile.kind, rect.x, rect.y, size, {
    symbol: options.colorblind === true,
    outline: false,
  });
  if (tile.special !== null) {
    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = 6;
    ctx.strokeRect(rect.x + 6, rect.y + 6, size - 12, rect.height - 12);
  }
}

function paintTile(
  ctx: TileDrawContext,
  tile: Tile,
  rect: Rect,
  options: TileDrawOptions,
  tween: ResolvedTileTween = IDENTITY_TWEEN,
): void {
  if (tween.alpha <= 0) return;
  const target = tweenedRect(rect, tween);
  if (tween.alpha >= 1) {
    paintTileBody(ctx, tile, target, options);
    return;
  }
  const baseAlpha = typeof ctx.globalAlpha === 'number' && Number.isFinite(ctx.globalAlpha) ? ctx.globalAlpha : 1;
  ctx.globalAlpha = baseAlpha * tween.alpha;
  try {
    paintTileBody(ctx, tile, target, options);
  } finally {
    ctx.globalAlpha = baseAlpha;
  }
}

export function drawColorblindSymbol(ctxLike: unknown,
  kind: TileKind,
  rect: { x: number; y: number; width: number; height: number },
): void {
  const ctx = ctxLike as Canvas2DContextLike;
  const cx = rect.x + rect.width / 2;
  const cy = rect.y + rect.height / 2;
  ctx.strokeStyle = '#000000';
  ctx.fillStyle = '#FFFFFF';
  ctx.font = '26px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(TILE_SYMBOLS[kind], cx, cy);
}

export function drawTile(ctxLike: unknown, tile: Tile, row: number, col: number, options: TileDrawOptions = {}): void {
  const ctx = ctxLike as TileDrawContext;
  const index = (row - 1) * 8 + (col - 1);
  const tween = resolveTileTween(options.tweens?.get(index), options.motion);
  paintTile(ctx, tile, cellRect(row, col), options, tween);
}

export function drawSelection(ctxLike: unknown, index: number): void {
  const ctx = ctxLike as TileDrawContext;
  const row = Math.floor(index / 8) + 1;
  const col = (index % 8) + 1;
  const rect = cellRect(row, col);
  ctx.save?.();
  ctx.strokeStyle = '#FFFFFF';
  ctx.lineWidth = 2;
  ctx.strokeRect(rect.x, rect.y, CELL_SIZE, CELL_SIZE);
  ctx.restore?.();
}

export function drawTiles(ctxLike: unknown, board: Board, options: TileDrawOptions = {}): void {
  const ctx = ctxLike as TileDrawContext;
  for (let index = 0; index < board.cells.length; index += 1) {
    const cell = board.cells[index] as Cell;
    if (!cell.tile) continue;
    const row = Math.floor(index / 8) + 1;
    const col = (index % 8) + 1;
    const tween = resolveTileTween(options.tweens?.get(index), options.motion);
    paintTile(ctx, cell.tile, cellRect(row, col), options, tween);
  }
  if (options.selected !== null && options.selected !== undefined) drawSelection(ctx, options.selected);
}

export function tileColor(kind: TileKind): string {
  return TILE_COLORS[kind];
}
