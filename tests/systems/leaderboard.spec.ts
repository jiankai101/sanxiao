import { describe, expect, it } from 'vitest';
import { MemoryStore } from '../../src/systems/storage/memory-store';
import { LEADERBOARD_KEY, SAVE_KEY } from '../../src/systems/storage/schema';
import { LeaderboardStore } from '../../src/systems/leaderboard/store';
import { compareRecords } from '../../src/systems/leaderboard/sort';
import type { LeaderboardRecord } from '../../src/systems/leaderboard/schema';

const rec = (id: string, score: number, moves: number, at: string, levelId = 1): LeaderboardRecord => ({
  id,
  levelId,
  score,
  stars: 1,
  movesUsed: moves,
  achievedAt: at,
  seed: 1,
});

const iso = (n: number): string => new Date(Date.UTC(2026, 0, 1, 0, 0, n)).toISOString();

describe('REQ-036 排序与同分', () => {
  it('score 降序 → moves 升序 → achievedAt 升序 → id', () => {
    const list = [
      rec('c', 100, 10, iso(2)),
      rec('b', 100, 10, iso(1)),
      rec('a', 100, 10, iso(1)),
      rec('d', 100, 9, iso(3)),
      rec('e', 200, 20, iso(4)),
    ];
    const sorted = [...list].sort(compareRecords).map((r) => r.id);
    expect(sorted).toEqual(['e', 'd', 'a', 'b', 'c']);
  });
});

describe('REQ-035 写入与幂等', () => {
  it('同一 settlementId 写两次只保留 1 条', () => {
    const store = new LeaderboardStore(new MemoryStore());
    const input = { levelId: 1, score: 1000, stars: 1, movesUsed: 10, achievedAt: iso(1), seed: 42 };
    expect(store.add(input).added).toBe(true);
    expect(store.add(input).added).toBe(false);
    expect(store.count()).toBe(1);
  });

  it('非法记录（0 星/越界）拒绝写入', () => {
    const store = new LeaderboardStore(new MemoryStore());
    expect(store.add({ levelId: 1, score: 100, stars: 0, movesUsed: 1, achievedAt: iso(1), seed: 1 }).added).toBe(false);
    expect(store.add({ levelId: 9, score: 100, stars: 1, movesUsed: 1, achievedAt: iso(1), seed: 1 }).added).toBe(false);
    expect(store.count()).toBe(0);
  });
});

describe('REQ-037 容量与淘汰', () => {
  it('单关第 11 条淘汰末位，保留 10 条', () => {
    const store = new LeaderboardStore(new MemoryStore());
    for (let i = 0; i < 11; i += 1) {
      store.add({ levelId: 1, score: 100 + i, stars: 1, movesUsed: 10, achievedAt: iso(i), seed: i });
    }
    const rows = store.top(1);
    expect(rows).toHaveLength(10);
    expect(rows.some((r) => r.score === 100)).toBe(false);
    expect(rows[0]!.score).toBe(110);
  });

  it('全局第 21 条淘汰末位，总数 20', () => {
    const store = new LeaderboardStore(new MemoryStore());
    for (let i = 0; i < 21; i += 1) {
      store.add({ levelId: (i % 8) + 1, score: 1000 + i, stars: 1, movesUsed: 5, achievedAt: iso(i), seed: i });
    }
    const rows = store.all();
    expect(rows).toHaveLength(20);
    expect(rows[rows.length - 1]!.score).toBe(1001);
  });
});

describe('REQ-038 清空', () => {
  it('清空只删排行榜键，存档键不变', () => {
    const storage = new MemoryStore();
    storage.setItem(SAVE_KEY, '{"saveVersion":1}');
    const store = new LeaderboardStore(storage);
    store.add({ levelId: 1, score: 100, stars: 1, movesUsed: 1, achievedAt: iso(1), seed: 1 });
    expect(storage.getItem(LEADERBOARD_KEY)).not.toBeNull();
    store.clear();
    expect(storage.getItem(LEADERBOARD_KEY)).toBeNull();
    expect(storage.getItem(SAVE_KEY)).toBe('{"saveVersion":1}');
    expect(store.count()).toBe(0);
  });
});

describe('排行榜损坏降级', () => {
  it('非法 JSON → 备份 + 空榜，不影响存档', () => {
    const storage = new MemoryStore();
    storage.setItem(LEADERBOARD_KEY, '{oops');
    storage.setItem(SAVE_KEY, '{"saveVersion":1}');
    const store = new LeaderboardStore(storage, { now: () => new Date('2026-11-10T08:00:00.000Z') });
    expect(store.all()).toEqual([]);
    expect(storage.keys().some((k) => k.startsWith('wmg.backup.leaderboard.'))).toBe(true);
    expect(storage.getItem(SAVE_KEY)).toBe('{"saveVersion":1}');
  });
});
