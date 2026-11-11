import { describe, expect, it } from 'vitest';
import { MemoryStore } from '../../src/systems/storage/memory-store';
import { SaveStore } from '../../src/systems/storage/save-store';
import {
  BACKUP_SAVE_PREFIX,
  SAVE_KEY,
  defaultSave,
  parseSaveText,
} from '../../src/systems/storage/schema';

const fixedNow = () => new Date('2026-11-10T08:00:00.000Z');

function seeded(raw: string): MemoryStore {
  const store = new MemoryStore();
  store.setItem(SAVE_KEY, raw);
  return store;
}

describe('REQ-029 存档 schema', () => {
  it('默认存档 8 条记录、字段与默认值正确', () => {
    const data = defaultSave('2026-11-10T00:00:00.000Z');
    expect(data.saveVersion).toBe(1);
    expect(data.lastSessionInterrupted).toBe(false);
    expect(data.unlockedLevelId).toBe(1);
    expect(data.levelRecords).toHaveLength(8);
    expect(data.settings).toEqual({
      bgmEnabled: true,
      bgmVolume: 60,
      sfxEnabled: true,
      sfxVolume: 80,
      reducedMotion: false,
      colorblindMode: false,
    });
    expect(data.stats).toEqual({ totalMoves: 0, totalClearCount: 0, totalPlaySeconds: 0 });
  });

  it('缺失 lastSessionInterrupted 时补 false 且不判损坏', () => {
    const data = defaultSave('2026-11-10T00:00:00.000Z') as unknown as Record<string, unknown>;
    delete data.lastSessionInterrupted;
    const result = parseSaveText(JSON.stringify(data));
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data.lastSessionInterrupted).toBe(false);
  });

  it('levelRecords 少于 8 项时补齐零值记录', () => {
    const data = defaultSave('2026-11-10T00:00:00.000Z');
    data.levelRecords = data.levelRecords.slice(0, 2);
    const result = parseSaveText(JSON.stringify(data));
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data.levelRecords).toHaveLength(8);
  });
});

describe('REQ-031 六类损坏存档恢复', () => {
  const base = defaultSave('2026-11-10T00:00:00.000Z');

  const cases: { name: string; raw: string }[] = [
    { name: 'JSON 解析失败', raw: '{not-json' },
    { name: '必填字段缺失', raw: JSON.stringify({ ...base, settings: undefined }) },
    { name: '字段类型错误', raw: JSON.stringify({ ...base, settings: { ...base.settings, bgmVolume: 'loud' } }) },
    { name: '版本号不匹配', raw: JSON.stringify({ ...base, saveVersion: 2 }) },
    { name: '数值越界', raw: JSON.stringify({ ...base, unlockedLevelId: 9 }) },
    { name: '日期非法', raw: JSON.stringify({ ...base, updatedAt: 'yesterday' }) },
  ];

  for (const testCase of cases) {
    it(`${testCase.name} → 备份 + 默认存档 + recovered=true`, () => {
      const storage = seeded(testCase.raw);
      const before = storage.getItem(SAVE_KEY);
      const store = new SaveStore(storage, { now: fixedNow });
      const result = store.load();
      expect(result.recovered).toBe(true);
      expect(result.data.unlockedLevelId).toBe(1);
      expect(result.data.levelRecords).toHaveLength(8);

      const backupKeys = storage.keys().filter((k) => k.startsWith(BACKUP_SAVE_PREFIX));
      expect(backupKeys).toHaveLength(1);
      expect(backupKeys[0]).toContain('2026-11-10T08:00:00.000Z');
      expect(storage.getItem(backupKeys[0]!)).toBe(before);
      expect(JSON.parse(storage.getItem(SAVE_KEY)!).saveVersion).toBe(1);
    });
  }

  it('存档损坏不影响排行榜键', () => {
    const storage = seeded('{bad');
    storage.setItem('wmg.leaderboard.v1', '{"boardVersion":1,"records":[]}');
    new SaveStore(storage, { now: fixedNow }).load();
    expect(storage.getItem('wmg.leaderboard.v1')).toBe('{"boardVersion":1,"records":[]}');
  });
});

describe('REQ-032 存储不可用降级', () => {
  it('setItem 抛 QuotaExceeded → 内存降级且 temporary=true', () => {
    class QuotaStore extends MemoryStore {
      override setItem(key: string, value: string): void {
        if (key === SAVE_KEY) throw new Error('QuotaExceededError');
        super.setItem(key, value);
      }
    }
    const store = new SaveStore(new QuotaStore(), { now: fixedNow });
    const data = store.load();
    expect(data.recovered).toBe(false);
    const saved = store.save(data.data);
    expect(store.isTemporary).toBe(true);
    expect(saved.saveVersion).toBe(1);
    expect(store.getData().levelRecords).toHaveLength(8);
  });
});