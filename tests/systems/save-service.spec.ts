import { describe, expect, it } from 'vitest';
import { MemoryStore } from '../../src/systems/storage/memory-store';
import { SaveStore } from '../../src/systems/storage/save-store';
import { SaveService } from '../../src/systems/storage/save-service';
import { SAVE_KEY, defaultSave } from '../../src/systems/storage/schema';

class SpyStore extends MemoryStore {
  saves = 0;
  constructor(seed?: string) {
    super();
    if (seed) this.setItem(SAVE_KEY, seed);
  }
  override setItem(key: string, value: string): void {
    if (key === SAVE_KEY) this.saves += 1;
    super.setItem(key, value);
  }
}

const clock = () => new Date('2026-11-10T09:30:00.000Z');

function setup(seed = JSON.stringify(defaultSave('2026-11-10T00:00:00.000Z'))) {
  const storage = new SpyStore(seed);
  const store = new SaveStore(storage, { now: clock });
  store.load();
  storage.saves = 0;
  const service = new SaveService(store, clock);
  return { storage, store, service };
}

describe('REQ-030 四处写入时机', () => {
  it('结算写入 1 次，且中断标记与结算数据合并', () => {
    const { storage, service } = setup();
    service.setSessionInterrupted(true);
    expect(storage.saves).toBe(1);
    storage.saves = 0;

    const data = service.recordSettlement({
      levelId: 1,
      won: true,
      score: 2000,
      stars: 2,
      movesUsed: 12,
      clearedTiles: 40,
      playSeconds: 30,
    });
    expect(storage.saves).toBe(1);
    expect(data.lastSessionInterrupted).toBe(false);
    expect(data.levelRecords[0]!.bestScore).toBe(2000);
    expect(data.levelRecords[0]!.bestStars).toBe(2);
    expect(data.levelRecords[0]!.clearCount).toBe(1);
    expect(data.stats.totalMoves).toBe(12);
    expect(data.stats.totalClearCount).toBe(40);
    expect(data.stats.totalPlaySeconds).toBe(30);
  });

  it('设置写 1 次并持久化', () => {
    const { storage, service } = setup();
    service.updateSettings({ bgmVolume: 5, sfxEnabled: false, colorblindMode: true });
    expect(storage.saves).toBe(1);
    const reloaded = new SaveStore(storage, { now: clock }).load().data;
    expect(reloaded.settings.bgmVolume).toBe(5);
    expect(reloaded.settings.sfxEnabled).toBe(false);
    expect(reloaded.settings.colorblindMode).toBe(true);
  });

  it('解锁写 1 次且只升不降；重玩不降级', () => {
    const { storage, service } = setup();
    const data = service.unlockNextLevel(1);
    expect(storage.saves).toBe(1);
    expect(data.unlockedLevelId).toBe(2);
    storage.saves = 0;
    const replay = service.unlockNextLevel(1);
    expect(storage.saves).toBe(0);
    expect(replay.unlockedLevelId).toBe(2);
  });

  it('中断标记置位/清除各 1 次，重复值不写', () => {
    const { storage, service } = setup();
    expect(service.setSessionInterrupted(true)).toBe(true);
    expect(storage.saves).toBe(1);
    expect(service.setSessionInterrupted(true)).toBe(false);
    expect(storage.saves).toBe(1);
    expect(service.setSessionInterrupted(false)).toBe(true);
    expect(storage.saves).toBe(2);
  });

  it('失败不增加 clearCount/bestStars，但更新 bestScore 与 lastPlayedAt', () => {
    const seed = defaultSave('2026-11-10T00:00:00.000Z');
    seed.levelRecords[0] = { levelId: 1, bestScore: 5000, bestStars: 3, clearCount: 2, lastPlayedAt: '2026-01-01T00:00:00.000Z' };
    const { service } = setup(JSON.stringify(seed));
    const data = service.recordSettlement({ levelId: 1, won: false, score: 4000, stars: 0, movesUsed: 20, clearedTiles: 10 });
    const record = data.levelRecords[0]!;
    expect(record.bestScore).toBe(5000);
    expect(record.bestStars).toBe(3);
    expect(record.clearCount).toBe(2);
    expect(record.lastPlayedAt).toBe(clock().toISOString());
  });

  it('序列化结果不含任何对局快照字段（键集合与 REQ-029 一致）', () => {
    const { storage, service } = setup();
    service.setSessionInterrupted(true);
    const raw = JSON.parse(storage.getItem(SAVE_KEY)!);
    expect(Object.keys(raw).sort()).toEqual([
      'lastSessionInterrupted',
      'levelRecords',
      'saveVersion',
      'settings',
      'stats',
      'unlockedLevelId',
      'updatedAt',
    ]);
    for (const forbidden of ['board', 'cells', 'movesLeft', 'score', 'cascade', 'rngState']) {
      expect(Object.prototype.hasOwnProperty.call(raw, forbidden)).toBe(false);
    }
  });

  it('单次写入 10KB 载荷 <100ms', () => {
    const { store } = setup();
    const data = store.getData();
    data.stats.totalMoves = 123456;
    const start = performance.now();
    store.save(data);
    expect(performance.now() - start).toBeLessThan(100);
  });
});

describe('REQ-033 重置进度', () => {
  it('重置后 unlockedLevelId=1、8 条记录归零', () => {
    const { storage, service } = setup();
    service.unlockNextLevel(3);
    service.recordSettlement({ levelId: 3, won: true, score: 3000, stars: 2, movesUsed: 10, clearedTiles: 30 });
    const data = service.resetProgress();
    expect(data.unlockedLevelId).toBe(1);
    expect(data.levelRecords).toHaveLength(8);
    expect(data.levelRecords.every((r) => r.bestScore === 0 && r.bestStars === 0 && r.clearCount === 0)).toBe(true);
    expect(data.lastSessionInterrupted).toBe(false);
    expect(JSON.parse(storage.getItem(SAVE_KEY)!).unlockedLevelId).toBe(1);
  });
});
