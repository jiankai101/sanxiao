import type { CellCoord } from '../../systems/contracts';

export const DRAG_THRESHOLD_CELL_RATIO = 0.5;

export interface LogicalPoint {
  x: number;
  y: number;
}

/**
 * 布局端口：由 render/layout 提供（impl-core），输入层只调用，不另写换算。
 * `pickNearestCell` 必须实现中垂线 Voronoi 最近邻吸附（REQ-049）。
 */
export interface BoardGeometry {
  toLogical(clientX: number, clientY: number): LogicalPoint;
  pickNearestCell(logical: LogicalPoint): CellCoord | null;
  cellCssSize(): number;
}

export interface PointerSample {
  pointerId: number;
  pointerType: string;
  isPrimary: boolean;
  clientX: number;
  clientY: number;
  cell: CellCoord | null;
}

export interface PointerHandlers {
  onPress(sample: PointerSample): void;
  onMove(sample: PointerSample): void;
  onRelease(sample: PointerSample): void;
  onCancel(pointerId: number): void;
}

export interface PointerOptions {
  isInputAllowed?: () => boolean;
}

/**
 * Pointer Events 统一鼠标/触摸（plan 10.1）：
 * 只处理主指针；pointerdown 捕获；settling 时仍接收但不派发语义事件。
 */
export class BoardPointer {
  private activeId: number | null = null;

  constructor(
    private readonly el: HTMLElement,
    private readonly geometry: BoardGeometry,
    private readonly handlers: PointerHandlers,
    private readonly options: PointerOptions = {},
  ) {
    el.addEventListener('pointerdown', this.handleDown);
    el.addEventListener('pointermove', this.handleMove);
    el.addEventListener('pointerup', this.handleUp);
    el.addEventListener('pointercancel', this.handleCancel);
  }

  dispose(): void {
    this.el.removeEventListener('pointerdown', this.handleDown);
    this.el.removeEventListener('pointermove', this.handleMove);
    this.el.removeEventListener('pointerup', this.handleUp);
    this.el.removeEventListener('pointercancel', this.handleCancel);
  }

  private sample(event: PointerEvent): PointerSample {
    const logical = this.geometry.toLogical(event.clientX, event.clientY);
    return {
      pointerId: event.pointerId,
      pointerType: event.pointerType,
      isPrimary: event.isPrimary,
      clientX: event.clientX,
      clientY: event.clientY,
      cell: this.geometry.pickNearestCell(logical),
    };
  }

  private allowed(): boolean {
    return this.options.isInputAllowed ? this.options.isInputAllowed() : true;
  }

  private handleDown = (event: PointerEvent): void => {
    if (!event.isPrimary || this.activeId !== null) return;
    this.activeId = event.pointerId;
    try {
      this.el.setPointerCapture(event.pointerId);
    } catch {
      // capture 不可用时仍按普通事件处理
    }
    if (!this.allowed()) return;
    this.handlers.onPress(this.sample(event));
  };

  private handleMove = (event: PointerEvent): void => {
    if (event.pointerId !== this.activeId) return;
    if (!this.allowed()) return;
    this.handlers.onMove(this.sample(event));
  };

  private handleUp = (event: PointerEvent): void => {
    if (event.pointerId !== this.activeId) return;
    this.activeId = null;
    try {
      this.el.releasePointerCapture(event.pointerId);
    } catch {
      // ignore
    }
    if (!this.allowed()) return;
    this.handlers.onRelease(this.sample(event));
  };

  private handleCancel = (event: PointerEvent): void => {
    if (event.pointerId !== this.activeId) return;
    this.activeId = null;
    try {
      this.el.releasePointerCapture(event.pointerId);
    } catch {
      // ignore
    }
    if (!this.allowed()) return;
    this.handlers.onCancel(event.pointerId);
  };
}
