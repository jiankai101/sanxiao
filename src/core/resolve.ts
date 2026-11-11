/**
 * Cascade resolution engine (REQ-009, REQ-013, REQ-015, REQ-018).
 * Pure: computes every cascade synchronously from (state, level, swap); animation
 * frames never affect the result. The input state object is never mutated.
 */
import { CASCADE_GUARD } from './constants';
import { DomainError } from './errors';
import type {
  Board,
  Cell,
  GameEvent,
  GameState,
  LevelConfig,
  ResolveResult,
  RoundResult,
  Tile,
  TileKind,
} from './types';
import { SeededRng } from './rng';
import { inspectSwap } from './board/swap';
import { cloneBoard } from './board/model';
import { applyGravity } from './board/gravity';
import { findMatches } from './match/detect';
import { scoreRound } from './score/score';
import { generateSpecials } from './special/generate';
import { expandClears } from './special/trigger';
import { cloneStats, computeGoalProgress, evaluateOutcome } from './goals';

function collectKinds(board: Board, cleared: readonly number[]): Partial<Record<TileKind, number>> {
  const collected: Partial<Record<TileKind, number>> = {};
  for (const index of cleared) {
    const kind = board.cells[index]?.tile?.kind;
    if (!kind) continue;
    collected[kind] = (collected[kind] ?? 0) + 1;
  }
  return collected;
}

function writeSpecial(board: Board, index: number, kind: TileKind | null, special: 'line-h' | 'line-v' | 'rainbow'): void {
  const cell = board.cells[index] as Cell;
  const tile: Tile = { id: board.nextTileId, kind, special };
  board.nextTileId += 1;
  cell.tile = tile;
}

export function resolveSwap(state: GameState, level: LevelConfig, a: number, b: number): ResolveResult {
  const check = inspectSwap(state.board, a, b);
  if (!check.valid) {
    return {
      state,
      rounds: [],
      events: [{ type: 'swap-rejected', a, b, reason: check.reason ?? 'no-match' }],
      outcome: 'continue',
    };
  }

  const rng = new SeededRng(state.rngState);
  const stats = cloneStats(state.stats);
  const events: GameEvent[] = [{ type: 'swap-committed', a, b }];
  const rounds: RoundResult[] = [];
  let board = check.board;
  let score = state.score;
  let cascade = 1;
  let settlementId = `seed:${state.seed >>> 0}:swap:${a}-${b}:moves:${state.movesLeft}`;

  for (;;) {
    if (cascade > CASCADE_GUARD) {
      throw new DomainError('cascade-guard', 'cascade guard exceeded');
    }
    const matches = findMatches(board);
    const isSwapRound = cascade === 1;
    const swap = isSwapRound ? check.swap : null;
    const forced = isSwapRound && swap !== null && (swap.rainbowRainbow || swap.rainbowPartnerKind !== null);
    if (matches.runs.length === 0 && !forced) break;

    const created = generateSpecials(board, matches.runs, isSwapRound ? check.swap : null);
    const expanded = expandClears(board, matches.matched, created, isSwapRound ? check.swap : null);
    if (expanded.cleared.length === 0) break;

    const collected = collectKinds(board, expanded.cleared);
    const gain = scoreRound({
      clearedCount: expanded.cleared.length,
      runs: matches.runs,
      lineExtra: expanded.lineExtra.length,
      cascade,
    });

    events.push({ type: 'round-start', cascade });
    for (const trigger of expanded.triggered) {
      events.push({ type: 'special-triggered', special: trigger.special, origin: trigger.index });
    }
    events.push({ type: 'tiles-cleared', cells: expanded.cleared.slice(), cascade });

    const afterClear = cloneBoard(board);
    for (const index of expanded.cleared) {
      (afterClear.cells[index] as Cell).tile = null;
    }

    let iceBroken = 0;
    for (const index of expanded.cleared) {
      const cell = afterClear.cells[index] as Cell;
      if (cell.obstacle?.type === 'ice') {
        cell.obstacle = null;
        iceBroken += 1;
        events.push({ type: 'obstacle-hit', index, obstacle: 'ice', layersAfter: 0 });
      }
    }

    let stoneBroken = 0;
    for (const index of expanded.damagedStones) {
      const cell = afterClear.cells[index] as Cell;
      if (cell.obstacle?.type !== 'stone') continue;
      const layersAfter = cell.obstacle.layers - 1;
      if (layersAfter <= 0) {
        cell.obstacle = null;
        stoneBroken += 1;
        events.push({ type: 'obstacle-hit', index, obstacle: 'stone', layersAfter: 0 });
      } else {
        cell.obstacle = { type: 'stone', layers: layersAfter as 1 | 2 };
        events.push({ type: 'obstacle-hit', index, obstacle: 'stone', layersAfter });
      }
    }

    for (const creation of created) {
      writeSpecial(afterClear, creation.index, creation.kind, creation.special);
      events.push({ type: 'special-created', index: creation.index, special: creation.special });
    }

    const boardAfterClear = cloneBoard(afterClear);
    const gravity = applyGravity(afterClear, rng, level.tileKinds);
    board = gravity.board;
    events.push({ type: 'gravity', moves: gravity.moves, spawned: gravity.spawned });

    stats.clearedTiles += expanded.cleared.length;
    stats.iceBroken += iceBroken;
    stats.stoneBroken += stoneBroken;
    for (const [kind, count] of Object.entries(collected) as [TileKind, number][]) {
      stats.collected[kind] = (stats.collected[kind] ?? 0) + count;
    }

    score += gain;
    events.push({ type: 'score-changed', score, delta: gain });

    rounds.push({
      cascade,
      runs: matches.runs.map((run) => ({ ...run, cells: run.cells.slice() })),
      cleared: expanded.cleared.slice(),
      specialsCreated: created.map((creation) => ({ ...creation })),
      scoreGain: gain,
      iceBroken,
      stoneBroken,
      collected,
      boardAfterClear,
      boardAfterGravity: cloneBoard(board),
    });

    cascade += 1;
  }

  const movesLeft = rounds.length > 0 ? Math.max(0, state.movesLeft - 1) : state.movesLeft;
  if (rounds.length > 0) stats.movesUsed += 1;

  const base: GameState = {
    ...state,
    board,
    rngState: rng.state,
    score,
    movesLeft,
    cascade: rounds.length,
    stats,
    goals: [],
    status: 'playing',
    settlementId: rounds.length > 0 ? settlementId : state.settlementId,
  };
  base.goals = computeGoalProgress(level.goals, base.score, base.stats);
  const outcome = evaluateOutcome(base, level);
  const finalState: GameState = {
    ...base,
    status: outcome === 'won' ? 'won' : outcome === 'lost' ? 'lost' : 'playing',
  };

  events.push({ type: 'moves-changed', movesLeft });
  if (outcome === 'won') events.push({ type: 'won' });
  if (outcome === 'lost') events.push({ type: 'lost' });

  return { state: finalState, rounds, events, outcome };
}


