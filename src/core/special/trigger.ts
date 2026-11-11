/**
 * Clear expansion + special triggering (REQ-012, REQ-013).
 * Line specials clear a full row/column and damage obstacles; a rainbow cleared
 * by a wave removes the most common colour (ties resolved by TILE_KINDS order).
 */
import { BOARD_COLS, BOARD_ROWS, TILE_KINDS } from '../constants';
import type { Board, SpecialCreation, SpecialKind, SwapContext, TileKind } from '../types';
import { toIndex } from '../board/model';

export interface ExpandResult {
  cleared: number[];
  /** cells reached only through a line special and not part of the base match */
  lineExtra: number[];
  damagedStones: number[];
  rainbowAll: boolean;
  triggered: { index: number; special: SpecialKind }[];
}

export function mostCommonKind(board: Board): TileKind | null {
  const counts = new Map<TileKind, number>();
  for (const cell of board.cells) {
    if (!cell.tile || cell.tile.kind === null) continue;
    counts.set(cell.tile.kind, (counts.get(cell.tile.kind) ?? 0) + 1);
  }
  let best: TileKind | null = null;
  let bestCount = -1;
  for (const kind of TILE_KINDS) {
    const count = counts.get(kind) ?? 0;
    if (count > bestCount) {
      best = kind;
      bestCount = count;
    }
  }
  return bestCount > 0 ? best : null;
}

function rainbowSwapOrigin(board: Board, swap: SwapContext | null): number[] {
  if (!swap) return [];
  const out: number[] = [];
  for (const index of [swap.from, swap.to]) {
    const tile = board.cells[index]?.tile;
    if (tile && tile.special === 'rainbow') out.push(index);
  }
  return out;
}

export function expandClears(
  board: Board,
  baseMatched: readonly number[],
  created: readonly SpecialCreation[],
  swap: SwapContext | null,
): ExpandResult {
  const createdSet = new Set(created.map((c) => c.index));
  const baseSet = new Set(baseMatched);
  const cleared = new Set<number>();
  const lineExtra = new Set<number>();
  const damagedStones = new Set<number>();
  const triggered: { index: number; special: SpecialKind }[] = [];
  const visited = new Set<number>();
  const queue: number[] = [];
  let rainbowAll = false;

  const enqueueIfSpecial = (index: number): void => {
    if (visited.has(index)) return;
    const tile = board.cells[index]?.tile;
    if (!tile || tile.special === null) return;
    visited.add(index);
    queue.push(index);
  };

  const addCleared = (index: number, asLineExtra: boolean): boolean => {
    if (createdSet.has(index)) return false;
    const cell = board.cells[index];
    if (!cell) return false;
    if (cell.tile === null) return false;
    if (cleared.has(index)) return false;
    cleared.add(index);
    if (asLineExtra && !baseSet.has(index)) lineExtra.add(index);
    enqueueIfSpecial(index);
    return true;
  };

  for (const index of baseMatched) addCleared(index, false);

  if (swap && swap.rainbowRainbow) {
    rainbowAll = true;
    for (let index = 0; index < board.cells.length; index += 1) {
      const cell = board.cells[index];
      if (cell && cell.tile) addCleared(index, false);
    }
  } else if (swap && swap.rainbowPartnerKind !== null) {
    const partner = swap.rainbowPartnerKind;
    for (let index = 0; index < board.cells.length; index += 1) {
      const tile = board.cells[index]?.tile;
      if (tile && tile.kind === partner) addCleared(index, false);
    }
    for (const origin of rainbowSwapOrigin(board, swap)) addCleared(origin, false);
  }

  for (const index of cleared) enqueueIfSpecial(index);

  while (queue.length > 0) {
    const origin = queue.shift() as number;
    const tile = board.cells[origin]?.tile;
    if (!tile || tile.special === null) continue;
    const special = tile.special;
    triggered.push({ index: origin, special });

    if (special === 'line-h') {
      const row = Math.floor(origin / BOARD_COLS) + 1;
      for (let col = 1; col <= BOARD_COLS; col += 1) {
        const index = toIndex(row, col);
        const cell = board.cells[index];
        if (!cell || cell.obstacle?.type === 'hole') continue;
        if (cell.obstacle?.type === 'stone') damagedStones.add(index);
        addCleared(index, true);
      }
    } else if (special === 'line-v') {
      const col = (origin % BOARD_COLS) + 1;
      for (let row = 1; row <= BOARD_ROWS; row += 1) {
        const index = toIndex(row, col);
        const cell = board.cells[index];
        if (!cell || cell.obstacle?.type === 'hole') continue;
        if (cell.obstacle?.type === 'stone') damagedStones.add(index);
        addCleared(index, true);
      }
    } else {
      const kind = swap && swap.rainbowPartnerKind !== null ? swap.rainbowPartnerKind : mostCommonKind(board);
      if (kind !== null) {
        for (let index = 0; index < board.cells.length; index += 1) {
          const other = board.cells[index]?.tile;
          if (other && other.kind === kind) addCleared(index, false);
        }
      }
    }
  }

  // stones adjacent (4-neighbour) to any cleared tile take one layer of damage
  for (const index of cleared) {
    const row = Math.floor(index / BOARD_COLS);
    const col = index % BOARD_COLS;
    for (const [dr, dc] of [
      [-1, 0],
      [1, 0],
      [0, -1],
      [0, 1],
    ] as const) {
      const r = row + dr;
      const c = col + dc;
      if (r < 0 || r >= BOARD_ROWS || c < 0 || c >= BOARD_COLS) continue;
      const neighbour = toIndex(r + 1, c + 1);
      if (board.cells[neighbour]?.obstacle?.type === 'stone') damagedStones.add(neighbour);
    }
  }

  return {
    cleared: [...cleared].sort((a, b) => a - b),
    lineExtra: [...lineExtra].sort((a, b) => a - b),
    damagedStones: [...damagedStones].sort((a, b) => a - b),
    rainbowAll,
    triggered,
  };
}
