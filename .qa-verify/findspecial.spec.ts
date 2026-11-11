import { test } from 'vitest';
import { createGame } from '@core/game';
import { getLevel } from '@systems/level/levels';
import { inspectSwap } from '@core/board/swap';
import { resolveSwap } from '@core/resolve';

test('find special-creating move', () => {
  const level = getLevel(1)!;
  for (let seed = 1; seed <= 300; seed += 1) {
    const state = createGame(level, seed);
    for (let i = 0; i < 64; i += 1) {
      const row = Math.floor(i / 8), col = i % 8;
      for (const t of [col < 7 ? i + 1 : -1, row < 7 ? i + 8 : -1]) {
        if (t < 0 || !inspectSwap(state.board, i, t).valid) continue;
        const r = resolveSwap(state, level, i, t);
        const created = r.rounds.flatMap((x) => x.specialsCreated);
        if (created.length > 0) {
          console.log(JSON.stringify({ seed, move: { a: { row: row + 1, col: col + 1 }, b: { row: Math.floor(t / 8) + 1, col: (t % 8) + 1 } }, created }));
          return;
        }
      }
    }
  }
  console.log('none found');
});
