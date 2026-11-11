import type { CellCoord } from '../../systems/contracts';
import { DRAG_THRESHOLD_CELL_RATIO, type BoardGeometry, type PointerSample } from './pointer';

/**
 * REQ-004 / REQ-049 输入语义事件。
 *
 * A 类「静默忽略」（棋盘投影矩形外 / 石块格 / 死格）不产生任何事件：
 * 不改变选中态、不交换、不扣步、不播放 invalid 音效、不做 aria 播报（CR-008）。
 *
 * REQ-049 / REQ-003：release 语义由「主轴位移是否达到 0.5 格」决定，而不是由抬起点落在哪个格
 * 决定。位移 < 0.5 格时一律按点击处理（点击目标取抬起点吸附格），因此本类不再产生 `invalid`
 * 事件；`invalid` 变体保留给 app 层的 B 类「相邻有效格交换后无匹配回弹」处理链路。
 */
export type BoardInputEvent =
  | { type: 'select'; cell: CellCoord }
  | { type: 'deselect' }
  | { type: 'hover'; cell: CellCoord | null }
  | { type: 'swap'; a: CellCoord; b: CellCoord }
  | { type: 'invalid'; cell: CellCoord };

export interface BoardInputOptions {
  geometry: Pick<BoardGeometry, 'cellCssSize'>;
  isInputAllowed?: () => boolean;
  /** REQ-049: blocked hit target (stone/hole) returns false; input layer ignores it. */
  isSelectable?: (cell: CellCoord) => boolean;
  emit: (event: BoardInputEvent) => void;
}

interface DragStart {
  cell: CellCoord;
  clientX: number;
  clientY: number;
  pointerId: number;
}

const same = (a: CellCoord, b: CellCoord): boolean => a.row === b.row && a.col === b.col;
const adjacent = (a: CellCoord, b: CellCoord): boolean =>
  Math.abs(a.row - b.row) + Math.abs(a.col - b.col) === 1;

/**
 * 拖拽/两段点击判定（REQ-003/004/049；plan 10.2）。
 * 阈值 = 0.5 × cellCssSize，随视口缩放；固定 16 CSS px 已废止。
 *
 * CR-008 A/B 两类判定位置：
 *  - A 类（静默忽略，不 emit 任何事件）：
 *      1. `press()` 中 `sample.cell === null`（按下点在棋盘投影矩形外）；
 *      2. `release()` 中 `sample.cell === null`（抬起点/点击点在投影矩形外）；
 *      3. `release()` 中 `!isSelectable(cell)`（石块 / 死格）；
 *      4. `release()` 中拖拽目标格超出 1..8 边界（越过棋盘边缘）；
 *  - B 类（app 层，播放 invalid 音效）：
 *      `release()` 判定为拖动交换后，交换的两个相邻有效格未产生任何匹配（app 回弹）。
 *      输入层不再因「抬起点跨过中垂线」emit invalid：位移 < 0.5 格一律按点击处理。
 */
export class BoardInput {
  private selected: CellCoord | null = null;
  private dragStart: DragStart | null = null;

  constructor(private readonly options: BoardInputOptions) {}

  get selection(): CellCoord | null {
    return this.selected;
  }

  clearSelection(): void {
    this.selected = null;
    this.options.emit({ type: 'deselect' });
  }

  press(sample: PointerSample): void {
    if (!this.allowed()) return;
    // REQ-049 A 类：按下点落在棋盘投影矩形外 → 静默忽略（不清除已有选中、无 invalid 事件）。
    if (!sample.cell) return;
    if (!this.selectable(sample.cell)) return;
    this.dragStart = {
      cell: sample.cell,
      clientX: sample.clientX,
      clientY: sample.clientY,
      pointerId: sample.pointerId,
    };
    this.options.emit({ type: 'hover', cell: sample.cell });
  }

  move(sample: PointerSample): void {
    if (!this.allowed() || !this.dragStart) return;
    this.options.emit({ type: 'hover', cell: sample.cell });
  }

  release(sample: PointerSample): void {
    if (!this.allowed()) return;
    const start = this.dragStart;
    this.dragStart = null;
    if (!start) return;
    // REQ-049 A 类：抬起点在棋盘投影矩形外 → 静默忽略（保留选中、无 invalid 事件）。
    if (!sample.cell) return;
    // REQ-049: a pointer point on stone/hole is ignored, even when it ends a drag.
    if (!this.selectable(sample.cell)) return;

    const dx = sample.clientX - start.clientX;
    const dy = sample.clientY - start.clientY;
    const horizontal = Math.abs(dx) >= Math.abs(dy);
    const mainDelta = horizontal ? dx : dy;
    const threshold = DRAG_THRESHOLD_CELL_RATIO * this.options.geometry.cellCssSize();

    if (Math.abs(mainDelta) >= threshold) {
      const target: CellCoord = horizontal
        ? { row: start.cell.row, col: (start.cell.col + (dx > 0 ? 1 : -1)) as CellCoord['col'] }
        : { row: (start.cell.row + (dy > 0 ? 1 : -1)) as CellCoord['row'], col: start.cell.col };
      // REQ-049 A 类：拖拽越过棋盘边缘 → 静默忽略（保留选中、无 invalid 事件）。
      if (target.row < 1 || target.row > 8 || target.col < 1 || target.col > 8) return;
      if (!this.selectable(target)) return;
      this.selected = null;
      this.options.emit({ type: 'swap', a: start.cell, b: target });
      return;
    }

    // REQ-049 / REQ-003：主轴位移 < 0.5 格一律按点击处理，点击目标取抬起点吸附格。
    // 即使抬起点已跨过中垂线进入相邻格，也不得 emit invalid；由 handleClick 按
    // 「已选中 A + 点击相邻 B → 交换 / 点击 A 自身 → 取消选中 / 非相邻 → 选中转移」处理。
    this.handleClick(sample.cell);
  }

  cancel(): void {
    if (!this.dragStart) return;
    this.dragStart = null;
    this.options.emit({ type: 'hover', cell: null });
  }

  private handleClick(cell: CellCoord): void {
    if (!this.selectable(cell)) return;
    if (!this.selected) {
      this.selected = cell;
      this.options.emit({ type: 'select', cell });
      return;
    }
    if (same(this.selected, cell)) {
      this.selected = null;
      this.options.emit({ type: 'deselect' });
      return;
    }
    if (adjacent(this.selected, cell)) {
      const a = this.selected;
      this.selected = null;
      this.options.emit({ type: 'swap', a, b: cell });
      return;
    }
    this.selected = cell;
    this.options.emit({ type: 'select', cell });
  }

  private allowed(): boolean {
    return this.options.isInputAllowed ? this.options.isInputAllowed() : true;
  }

  private selectable(cell: CellCoord): boolean {
    return this.options.isSelectable ? this.options.isSelectable(cell) : true;
  }
}
