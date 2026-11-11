import { isBlockedCell } from '@core/index';
import type { Board, CellCoord } from '../contracts';

/**
 * REQ-049 hit-test classification.
 *
 * Core owns the obstacle taxonomy: `isBlockedCell` is true for any obstacle
 * whose type is not `ice` (i.e. `stone` and `hole`). Those cells never carry a
 * tile and must be ignored by the input layer. `ice` is an overlay obstacle
 * whose cell still carries a tile, so it stays selectable and swappable.
 */
export function isSelectableCellAt(board: Board | null | undefined, cell: CellCoord): boolean {
  if (!board) return false;
  const index = (cell.row - 1) * board.cols + (cell.col - 1);
  const model = board.cells[index];
  return model !== undefined && !isBlockedCell(model);
}
