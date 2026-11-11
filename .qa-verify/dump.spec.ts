import { test } from 'vitest';
import type { GameState } from '@core/types';
import { hasAnyMove } from '@core/board/generate';
import { inspectSwap } from '@core/board/swap';
import { resolveSwap } from '@core/resolve';
import { createGame } from '@core/game';
import { getLevel } from '@systems/level/levels';
import { SeededRng } from '@core/rng';

test('dump dead sequence', () => {
  const levelId = 8, seed = 1;
  const level = getLevel(levelId)!;
  let state = createGame(level, seed);
  const rng = new SeededRng(seed * 31 + level.id);
  const seq: any[] = [];
  for (let step = 0; step < 40; step += 1) {
    const list: { a: number; b: number }[] = [];
    for (let i = 0; i < 64; i += 1) {
      const row = Math.floor(i / 8), col = i % 8;
      for (const t of [col < 7 ? i + 1 : -1, row < 7 ? i + 8 : -1]) {
        if (t >= 0 && inspectSwap(state.board, i, t).valid) list.push({ a: i, b: t });
      }
    }
    if (list.length === 0) { console.log('DEAD at step', step, 'movesLeft', state.movesLeft, 'hasAnyMove', hasAnyMove(state.board)); break; }
    const m = list[rng.nextInt(list.length)]!;
    seq.push({ a: { row: Math.floor(m.a / 8) + 1, col: (m.a % 8) + 1 }, b: { row: Math.floor(m.b / 8) + 1, col: (m.b % 8) + 1 } });
    state = resolveSwap(state, level, m.a, m.b).state;
    if (state.status !== 'playing') { console.log('ended', state.status); break; }
  }
  console.log(JSON.stringify(seq));
});
