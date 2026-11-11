/**
 * Special tile creation (REQ-010, REQ-011).
 * length 4 -> line (h/v), length >= 5 -> rainbow (single, no extra line).
 * Position: swapped target cell -> swapped source cell -> leftmost/topmost,
 * skipping cells already claimed by another special this round.
 */
import { DomainError } from '../errors';
import type { Board, RunInfo, SpecialCreation, SwapContext } from '../types';

function orderedCells(run: RunInfo): number[] {
  if (run.orientation === 'h') return run.cells.slice().sort((a, b) => a - b);
  return run.cells.slice().sort((a, b) => a - b);
}

function claimedOrInvalid(board: Board, index: number): boolean {
  const cell = board.cells[index];
  if (!cell) return true;
  return cell.tile !== null && cell.tile.special !== null;
}

export function generateSpecials(
  board: Board,
  runs: readonly RunInfo[],
  swap: SwapContext | null,
): SpecialCreation[] {
  const sorted = runs
    .map((run, order) => ({ run, order }))
    .sort((a, b) => {
      if (b.run.length !== a.run.length) return b.run.length - a.run.length;
      const firstA = Math.min(...a.run.cells);
      const firstB = Math.min(...b.run.cells);
      if (firstA !== firstB) return firstA - firstB;
      return a.order - b.order;
    });

  const used = new Set<number>();
  const creations: SpecialCreation[] = [];

  for (const entry of sorted) {
    const run = entry.run;
    let special: SpecialCreation['special'] | null = null;
    if (run.length >= 5) special = 'rainbow';
    else if (run.length === 4) special = run.orientation === 'h' ? 'line-h' : 'line-v';
    if (special === null) continue;

    const cells = orderedCells(run);
    const preferred: number[] = [];
    if (swap) {
      if (run.cells.includes(swap.to)) preferred.push(swap.to);
      if (run.cells.includes(swap.from)) preferred.push(swap.from);
    }
    for (const cell of cells) preferred.push(cell);

    let chosen = -1;
    for (const cell of preferred) {
      if (used.has(cell)) continue;
      if (claimedOrInvalid(board, cell)) continue;
      chosen = cell;
      break;
    }
    if (chosen < 0) continue;

    used.add(chosen);
    creations.push({
      index: chosen,
      special,
      kind: special === 'rainbow' ? null : run.kind,
    });
  }

  return creations.sort((a, b) => a.index - b.index);
}

export function assertRunIntegrity(run: RunInfo): void {
  if (run.cells.length !== run.length) {
    throw new DomainError('bad-run', 'run.cells length does not match run.length');
  }
}
