import type { SaveStore } from './save-store';
import {
  cloneSave,
  emptyLevelRecord,
  getLevelRecord,
  type SaveDataV1,
  type SettingsV1,
} from './schema';

export interface SettlementInput {
  levelId: number;
  won: boolean;
  score: number;
  stars: number;
  movesUsed: number;
  clearedTiles: number;
  playSeconds?: number;
}

const isBool = (v: unknown): v is boolean => typeof v === 'boolean';
const toVolume = (v: unknown): number | null => {
  if (typeof v !== 'number' || !Number.isFinite(v)) return null;
  return Math.max(0, Math.min(100, Math.round(v)));
};

/**
 * 存档写入服务（REQ-030）：四个语义入口，与四处写入时机一一对应；
 * 无第五入口。重置进度（REQ-033）是独立的用户操作，不计入 REQ-030 写入点。
 */
export class SaveService {
  constructor(
    private readonly store: SaveStore,
    private readonly now: () => Date = () => new Date(),
  ) {}

  get data(): SaveDataV1 {
    return this.store.getData();
  }

  get settings(): SettingsV1 {
    return this.store.getData().settings;
  }

  /** #1 结算：胜/负都写 bestScore/lastPlayedAt/stats，并把中断标记合并为同一次写入。 */
  recordSettlement(input: SettlementInput): SaveDataV1 {
    const data = cloneSave(this.store.getData());
    const record = data.levelRecords.find((r) => r.levelId === input.levelId) ?? emptyLevelRecord(input.levelId);
    const score = Math.max(0, Math.round(input.score));

    record.bestScore = Math.max(record.bestScore, score);
    record.lastPlayedAt = this.now().toISOString();
    if (input.won) {
      const stars = Math.max(0, Math.min(3, Math.round(input.stars)));
      record.bestStars = Math.max(record.bestStars, stars);
      record.clearCount += 1;
    }
    if (!data.levelRecords.some((r) => r.levelId === record.levelId)) {
      data.levelRecords.push(record);
      data.levelRecords.sort((a, b) => a.levelId - b.levelId);
    }

    data.stats.totalMoves += Math.max(0, Math.round(input.movesUsed));
    data.stats.totalClearCount += Math.max(0, Math.round(input.clearedTiles));
    data.stats.totalPlaySeconds += Math.max(0, Math.round(input.playSeconds ?? 0));
    data.lastSessionInterrupted = false;

    return this.store.save(data);
  }

  /** #2 设置变更：立即写入并持久化。 */
  updateSettings(patch: Partial<SettingsV1>): SaveDataV1 {
    const data = cloneSave(this.store.getData());
    const next = data.settings;
    if ('bgmEnabled' in patch && isBool(patch.bgmEnabled)) next.bgmEnabled = patch.bgmEnabled;
    if ('sfxEnabled' in patch && isBool(patch.sfxEnabled)) next.sfxEnabled = patch.sfxEnabled;
    if ('reducedMotion' in patch && isBool(patch.reducedMotion)) next.reducedMotion = patch.reducedMotion;
    if ('colorblindMode' in patch && isBool(patch.colorblindMode)) next.colorblindMode = patch.colorblindMode;
    if ('bgmVolume' in patch) {
      const v = toVolume(patch.bgmVolume);
      if (v !== null) next.bgmVolume = v;
    }
    if ('sfxVolume' in patch) {
      const v = toVolume(patch.sfxVolume);
      if (v !== null) next.sfxVolume = v;
    }
    return this.store.save(data);
  }

  /** #3 通关解锁：只升不降；已解锁时跳过写入。 */
  unlockNextLevel(levelId: number): SaveDataV1 {
    const data = cloneSave(this.store.getData());
    const target = Math.min(8, Math.max(1, Math.round(levelId) + 1));
    if (data.unlockedLevelId >= target) return data;
    data.unlockedLevelId = target;
    return this.store.save(data);
  }

  /** #4 中断标记：值未变化时不写（避免无意义 IO）。 */
  setSessionInterrupted(value: boolean): boolean {
    const data = cloneSave(this.store.getData());
    if (data.lastSessionInterrupted === value) return false;
    data.lastSessionInterrupted = value;
    this.store.save(data);
    return true;
  }

  /** REQ-033：清空存档并回到第 1 关未通关状态（排行榜由调用方另行清空）。 */
  resetProgress(): SaveDataV1 {
    return this.store.reset();
  }

  record(levelId: number) {
    return getLevelRecord(this.store.getData(), levelId);
  }
}
