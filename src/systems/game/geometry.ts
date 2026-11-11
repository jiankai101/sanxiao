import type { CanvasHost } from '@render/canvas-host';
import { cellCssSize, pickNearestCell, screenToLogical } from '@render/layout';
import type { BoardGeometry } from '@ui/input/pointer';

/** 布局适配：命中/换算全部委托 render/layout（REQ-049）。 */
export function createBoardGeometry(canvas: HTMLCanvasElement, host: CanvasHost): BoardGeometry {
  return {
    toLogical(clientX: number, clientY: number) {
      const rect = canvas.getBoundingClientRect();
      return screenToLogical(clientX, clientY, rect);
    },
    pickNearestCell(point) {
      return pickNearestCell(point, host.snapshot);
    },
    cellCssSize() {
      return cellCssSize(host.snapshot.viewportWidth);
    },
  };
}
