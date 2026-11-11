/**
 * No-move reshuffle (REQ-016). Multiset preserving; never consumes a move.
 * 100 Fisher-Yates attempts, then 100 same-multiset random placements, then lost.
 */
import { SHUFFLE_RETRY_LIMIT } from '../constants';
import type { Board, Cell, GameEvent, GameState, LevelConfig, Tile } from '../types';
import { SeededRng } from '../rng';
import { findMatches } from '../match/detect';
import { cloneBoard } from './model';
import { hasAnyMove } from './generate';

export interface EnsurePlayableResult {
  state: GameState;
  shuffled: boolean;
  failed: boolean;
  attempts: number;
  events: GameEvent[];
}

function placeTiles(board: Board, positions: readonly number[], tiles: readonly Tile[]): Board {
  const next = cloneBoard(board);
  positions.forEach((position, i) => {
    (next.cells[position] as Cell).tile = { ...(tiles[i] as Tile) };
  });
  return next;
}

function isPlayableCandidate(board: Board): boolean {
  return findMatches(board).runs.length === 0 && hasAnyMove(board);
}

export function ensurePlayable(state: GameState, _level: LevelConfig): EnsurePlayableResult {
  if (hasAnyMove(state.board)) {
    return { state, shuffled: false, failed: false, attempts: 0, events: [] };
  }
  if (state.movesLeft <= 0) {
    return { state, shuffled: false, failed: true, attempts: 0, events: [] };
  }

  const rng = new SeededRng(state.rngState);
  const positions: number[] = [];
  const tiles: Tile[] = [];
  for (let i = 0; i < state.board.cells.length; i += 1) {
    const tile = state.board.cells[i]?.tile;
    if (tile) {
      positions.push(i);
      tiles.push(tile);
    }
  }
  if (tiles.length === 0) {
    return { state, shuffled: false, failed: true, attempts: 0, events: [] };
  }

  const cleared = cloneBoard(state.board);
  for (const position of positions) (cleared.cells[position] as Cell).tile = null;

  let attempts = 0;
  for (let attempt = 1; attempt <= SHUFFLE_RETRY_LIMIT; attempt += 1) {
    attempts = attempt;
    const shuffled = rng.shuffle(tiles);
    const candidate = placeTiles(cleared, positions, shuffled);
    if (isPlayableCandidate(candidate)) {
      return {
        state: { ...state, board: candidate, rngState: rng.state },
        shuffled: true,
        failed: false,
        attempts,
        events: [{ type: 'shuffle', cells: positions }],
      };
    }
  }

  for (let attempt = 1; attempt <= SHUFFLE_RETRY_LIMIT; attempt += 1) {
    attempts += 1;
    const pool = tiles.slice();
    const placement: Tile[] = [];
    while (pool.length > 0) {
      const index = rng.nextInt(pool.length);
      placement.push(pool.splice(index, 1)[0] as Tile);
    }
    const candidate = placeTiles(cleared, positions, placement);
    if (isPlayableCandidate(candidate)) {
      return {
        state: { ...state, board: candidate, rngState: rng.state },
        shuffled: true,
        failed: false,
        attempts,
        events: [{ type: 'shuffle', cells: positions }],
      };
    }
  }

  return { state, shuffled: false, failed: true, attempts, events: [] };
}

export function multisetOf(board: Board): string[] {
  return board.cells
    .map((cell) => (cell.tile ? `${cell.tile.kind ?? 'rainbow'}:${cell.tile.special ?? 'plain'}` : null))
    .filter((value): value is string => value !== null)
    .sort();
}
