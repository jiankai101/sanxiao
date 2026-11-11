import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createGame } from '../../src/core/game';
import { makeLevel } from './support';

const coreDir = fileURLToPath(new URL('../../src/core', import.meta.url));

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) out.push(...walk(path));
    else if (path.endsWith('.ts')) out.push(path);
  }
  return out;
}

describe('REQ-002 / TASK-002 core purity', () => {
  it('core never references wall-clock or randomness globals', () => {
    const files = walk(coreDir);
    expect(files.length).toBeGreaterThan(10);
    const forbidden = ['Math' + '.random', 'Date' + '.now', 'performance' + '.now', 'win' + 'dow', 'docu' + 'ment'];
    for (const file of files) {
      const text = readFileSync(file, 'utf8');
      for (const token of forbidden) {
        expect(text.includes(token), `${file} must not contain ${token}`).toBe(false);
      }
    }
  });

  it('core has no `any` annotations', () => {
    for (const file of walk(coreDir)) {
      const text = readFileSync(file, 'utf8');
      expect(/: any\b/.test(text), `${file} uses any`).toBe(false);
      expect(/as any\b/.test(text), `${file} uses as any`).toBe(false);
    }
  });

  it('GameState survives a JSON round trip unchanged (plain data only)', () => {
    const state = createGame(makeLevel(), 0x12345678);
    const roundTripped = JSON.parse(JSON.stringify(state)) as typeof state;
    expect(roundTripped).toEqual(state);
    expect(Object.values(roundTripped.board.cells).every((cell) => typeof cell === 'object')).toBe(true);
  });
});
