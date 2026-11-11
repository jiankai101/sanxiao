/**
 * Logical layout + hit testing (REQ-040, REQ-041, REQ-049).
 * Pure math, no DOM access: the same function serves mouse, touch and pen.
 *
 * Coordinate contract (BUG-001):
 *  - `#game` is the only element allowed to move the canvas inside the viewport;
 *    CSS (`inset: 0; margin: auto`) centres the 4:3 element.
 *  - Every value in a LayoutSnapshot is therefore expressed in *canvas-local*
 *    CSS pixels. `offsetX` / `offsetY` are always 0 and exist only so the draw
 *    transform and hit testing can share one explicit formula.
 *  - Drawing (`canvasTransform`) and hit testing (`screenToLogical` +
 *    `pickNearestCell`) both use the canvas element's CSS box as their origin.
 */
import {
  BOARD_COLS,
  BOARD_ROWS,
  BOARD_SIZE,
  BOARD_X,
  BOARD_Y,
  CANVAS_H,
  CANVAS_W,
  CELL_SIZE,
  HOTZONE_BREAKPOINT_CSS_PX,
  HOTZONE_MIN_CELL_CSS_PX,
} from '../core/constants';
import type { CellCoord } from '../core/types';

export interface LogicalPoint {
  x: number;
  y: number;
}

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface ScreenRect {
  left: number;
  top: number;
  width: number;
  height: number;
}

export interface LayoutSnapshot {
  /** available viewport (CSS px) used to choose the fitted canvas size */
  viewportWidth: number;
  viewportHeight: number;
  /** uniform scale from logical 960x720 to CSS px */
  scale: number;
  /** canvas-local letterbox offsets in CSS px; always 0 (CSS centres #game) */
  offsetX: number;
  offsetY: number;
  /** CSS size of the canvas element (always 4:3) */
  cssWidth: number;
  cssHeight: number;
  board: Rect;
  cellSize: number;
  cols: number;
  rows: number;
}

export function boardRect(): Rect {
  return { x: BOARD_X, y: BOARD_Y, width: BOARD_SIZE, height: BOARD_SIZE };
}

export function cellRect(row: number, col: number): Rect {
  return {
    x: BOARD_X + (col - 1) * CELL_SIZE,
    y: BOARD_Y + (row - 1) * CELL_SIZE,
    width: CELL_SIZE,
    height: CELL_SIZE,
  };
}

export function slotRects(): Rect[] {
  const out: Rect[] = [];
  for (let row = 1; row <= BOARD_ROWS; row += 1) {
    for (let col = 1; col <= BOARD_COLS; col += 1) out.push(cellRect(row, col));
  }
  return out;
}

/**
 * Fits the fixed 960x720 logical canvas into the available box.
 *
 * The returned `cssWidth` / `cssHeight` are the CSS size that CanvasHost assigns
 * to the canvas element. Because the element itself is 4:3 and centred by CSS,
 * the layout has no internal offset; adding one would double-count the viewport
 * letterbox (BUG-001). `offsetX` / `offsetY` are therefore always exactly 0.
 */
export function computeLayout(viewportWidth: number, viewportHeight: number): LayoutSnapshot {
  const width = Math.max(0, viewportWidth);
  const height = Math.max(0, viewportHeight);
  const scale = Math.min(width / CANVAS_W, height / CANVAS_H);
  const cssWidth = CANVAS_W * scale;
  const cssHeight = CANVAS_H * scale;
  return {
    viewportWidth: width,
    viewportHeight: height,
    scale,
    offsetX: 0,
    offsetY: 0,
    cssWidth,
    cssHeight,
    board: boardRect(),
    cellSize: CELL_SIZE,
    cols: BOARD_COLS,
    rows: BOARD_ROWS,
  };
}

/** Single-cell CSS size derived from viewport width (REQ-049). */
export function cellCssSize(viewportWidth: number): number {
  return (CELL_SIZE * Math.max(0, viewportWidth)) / CANVAS_W;
}

export function isHotzoneCompliant(viewportWidth: number): boolean {
  if (viewportWidth < HOTZONE_BREAKPOINT_CSS_PX) return true;
  return cellCssSize(viewportWidth) >= HOTZONE_MIN_CELL_CSS_PX - 1e-9;
}

/** Client point -> logical point, using the canvas element's CSS box as origin. */
export function screenToLogical(clientX: number, clientY: number, rect: ScreenRect): LogicalPoint {
  const width = rect.width || 1;
  const height = rect.height || 1;
  return {
    x: ((clientX - rect.left) * CANVAS_W) / width,
    y: ((clientY - rect.top) * CANVAS_H) / height,
  };
}

/** Logical point -> canvas-local CSS point (same basis as the draw transform). */
export function logicalToScreen(point: LogicalPoint, snapshot: LayoutSnapshot): LogicalPoint {
  return {
    x: snapshot.offsetX + point.x * snapshot.scale,
    y: snapshot.offsetY + point.y * snapshot.scale,
  };
}

function clampIndex(value: number, max: number): number {
  if (value < 0) return 0;
  if (value > max) return max;
  return value;
}

function axisIndex(position: number, origin: number, max: number): number {
  const local = (position - origin) / CELL_SIZE;
  const rawLow = Math.floor(local - 0.5);
  const low = clampIndex(rawLow, max - 1);
  const high = clampIndex(rawLow + 1, max - 1);
  const lowDistance = Math.abs(position - (origin + (low + 0.5) * CELL_SIZE));
  const highDistance = Math.abs(position - (origin + (high + 0.5) * CELL_SIZE));
  // ties resolve to the smaller index (column first, then row)
  return highDistance < lowDistance - 1e-9 ? high : low;
}

/**
 * Nearest-cell snapping: boundaries are the perpendicular bisectors of neighbouring
 * cell centres; outside the board projection returns null.
 */
export function pickNearestCell(point: LogicalPoint, snapshot: LayoutSnapshot): CellCoord | null {
  const board = snapshot.board;
  if (point.x < board.x || point.x > board.x + board.width) return null;
  if (point.y < board.y || point.y > board.y + board.height) return null;
  const col = axisIndex(point.x, board.x, BOARD_COLS);
  const row = axisIndex(point.y, board.y, BOARD_ROWS);
  return { row: (row + 1) as CellCoord['row'], col: (col + 1) as CellCoord['col'] };
}

/**
 * Device-pixel transform for ctx.setTransform.
 *
 * The canvas backing store is exactly cssWidth x cssHeight CSS px (times DPR),
 * so e/f are 0: the element's CSS position is the only viewport offset. This is
 * the same basis used by screenToLogical, which keeps drawing and hit testing
 * aligned on all viewports (BUG-001, REQ-040/041/049).
 */
export function canvasTransform(snapshot: LayoutSnapshot, dpr: number): { a: number; d: number; e: number; f: number } {
  const ratio = dpr * snapshot.scale;
  return { a: ratio, d: ratio, e: 0, f: 0 };
}
