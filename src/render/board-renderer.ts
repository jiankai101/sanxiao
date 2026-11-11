/**
 * Board base layer (REQ-040, REQ-043): slots, ice/stone/hole, then the tile layer.
 */
import { BOARD_X, BOARD_Y, CELL_SIZE } from '../core/constants';
import type { Board, Cell } from '../core/types';
import { cellRect, slotRects } from './layout';
import type { ImageProvider, TileDrawOptions } from './tile-renderer';
import { drawTiles } from './tile-renderer';

export interface BoardDrawContext {
  fillStyle: string;
  strokeStyle: string;
  lineWidth: number;
  fillRect: (x: number, y: number, w: number, h: number) => void;
  strokeRect: (x: number, y: number, w: number, h: number) => void;
  drawImage: (image: unknown, x: number, y: number, w: number, h: number) => void;
  save?: () => void;
  restore?: () => void;
}

export interface BoardDrawOptions {
  images?: ImageProvider;
  colorblind?: boolean;
  selected?: number | null;
  /** skip slot/background painting when a cached L0/L1 layer is blitted instead */
  baseCached?: boolean;
}

export const SLOT_COLOR = 'rgba(255,255,255,0.06)';
export const ICE_COLOR = 'rgba(168,216,255,0.45)';
export const STONE_COLOR = '#6E6A63';
export const HOLE_COLOR = '#141418';

/** All 64 slot rectangles in row-major order. */
export function boardSlotRects(): ReturnType<typeof slotRects> {
  return slotRects();
}

export function slotRectAt(index: number): { x: number; y: number; width: number; height: number } {
  const row = Math.floor(index / 8) + 1;
  const col = (index % 8) + 1;
  return cellRect(row, col);
}

export function drawBoardBase(ctxLike: unknown, board: Board, options: BoardDrawOptions = {}): void {
  const ctx = ctxLike as BoardDrawContext;
  for (let index = 0; index < board.cells.length; index += 1) {
    const cell = board.cells[index] as Cell;
    const rect = slotRectAt(index);
    if (!options.baseCached) {
      const slotImage = options.images?.get('cell-empty.webp');
      if (slotImage !== undefined) {
        ctx.drawImage(slotImage, rect.x, rect.y, CELL_SIZE, CELL_SIZE);
      } else {
        ctx.fillStyle = SLOT_COLOR;
        ctx.fillRect(rect.x, rect.y, CELL_SIZE, CELL_SIZE);
      }
    }
    if (cell.obstacle?.type === 'ice') {
      const iceImage = options.images?.get('obs-ice.webp');
      if (iceImage !== undefined) ctx.drawImage(iceImage, rect.x, rect.y, CELL_SIZE, CELL_SIZE);
      else {
        ctx.fillStyle = ICE_COLOR;
        ctx.fillRect(rect.x + 4, rect.y + 4, CELL_SIZE - 8, CELL_SIZE - 8);
      }
    } else if (cell.obstacle?.type === 'stone') {
      const name = cell.obstacle.layers === 2 ? 'obs-stone-2.webp' : 'obs-stone-1.webp';
      const stoneImage = options.images?.get(name);
      if (stoneImage !== undefined) ctx.drawImage(stoneImage, rect.x, rect.y, CELL_SIZE, CELL_SIZE);
      else {
        ctx.fillStyle = STONE_COLOR;
        ctx.fillRect(rect.x + 3, rect.y + 3, CELL_SIZE - 6, CELL_SIZE - 6);
        if (cell.obstacle.layers === 1) {
          ctx.strokeStyle = '#2B2825';
          ctx.lineWidth = 3;
          ctx.strokeRect(rect.x + 18, rect.y + 12, 12, CELL_SIZE - 24);
        }
      }
    } else if (cell.obstacle?.type === 'hole') {
      const holeImage = options.images?.get('obs-hole.webp');
      if (holeImage !== undefined) ctx.drawImage(holeImage, rect.x, rect.y, CELL_SIZE, CELL_SIZE);
      else {
        ctx.fillStyle = HOLE_COLOR;
        ctx.fillRect(rect.x, rect.y, CELL_SIZE, CELL_SIZE);
      }
    }
  }
}

export function drawBoard(ctxLike: unknown, board: Board, options: TileDrawOptions & BoardDrawOptions = {}): void {
  drawBoardBase(ctxLike, board, options);
  drawTiles(ctxLike, board, options);
}

export function boardOrigin(): { x: number; y: number } {
  return { x: BOARD_X, y: BOARD_Y };
}


