import { MemoryStore } from '../storage/memory-store';
import type { StorageLike } from '../storage/schema';
import { pruneRecords } from './prune';
import {
  LEADERBOARD_KEY,
  LEADERBOARD_PER_LEVEL,
  emptyLeaderboard,
  leaderboardBackupKey,
  parseLeaderboardText,
  type LeaderboardDataV1,
  type LeaderboardRecord,
} from './schema';
import { sortRecords } from './sort';

export interface NewLeaderboardRecord {
  levelId: number;
  score: number;
  stars: number;
  movesUsed: number;
  achievedAt: string;
  seed: number | string;
  /** 幂等键：`${levelId}:${seed}:${achievedAt}:${score}` */
  settlementId?: string;
}

export interface AddResult {
  added: boolean;
  reason?: 'duplicate' | 'invalid';
  record?: LeaderboardRecord;
}

const PROBE_KEY = '__wmg_lb_probe__';

function probe(storage: StorageLike | null): storage is StorageLike {
  if (!storage) return false;
  try {
    storage.setItem(PROBE_KEY, '1');
    storage.removeItem(PROBE_KEY);
    return true;
  } catch {
    return false;
  }
}

export function deriveRecordId(record: { levelId: number; achievedAt: string; seed: number | string }): string {
  return `${record.levelId}-${Date.parse(record.achievedAt)}-${record.seed}`;
}

export function settlementIdOf(record: NewLeaderboardRecord): string {
  return record.settlementId ?? `${record.levelId}:${record.seed}:${record.achievedAt}:${record.score}`;
}

/**
 * 本地排行榜仓储（REQ-034~038）：独立键，损坏不影响存档；
 * 仅存本机记录，无任何网络请求。
 */
export class LeaderboardStore {
  private storage: StorageLike;
  private readonly memory = new MemoryStore();
  private temporary = false;
  private readonly now: () => Date;
  private readonly onTemporary?: (reason: string) => void;

  constructor(preferred: StorageLike | null, options: { now?: () => Date; onTemporary?: (reason: string) => void } = {}) {
    this.now = options.now ?? (() => new Date());
    this.onTemporary = options.onTemporary;
    if (probe(preferred)) this.storage = preferred;
    else {
      this.storage = this.memory;
      this.temporary = true;
    }
  }

  static fromGlobal(options: { now?: () => Date; onTemporary?: (reason: string) => void } = {}): LeaderboardStore {
    let storage: StorageLike | null = null;
    try {
      storage = globalThis.localStorage ?? null;
    } catch {
      storage = null;
    }
    return new LeaderboardStore(storage, options);
  }

  get isTemporary(): boolean {
    return this.temporary;
  }

  load(): { data: LeaderboardDataV1; recovered: boolean } {
    let raw: string | null = null;
    try {
      raw = this.storage.getItem(LEADERBOARD_KEY);
    } catch {
      raw = null;
    }
    if (raw === null) return { data: emptyLeaderboard(), recovered: false };

    const parsed = parseLeaderboardText(raw);
    if (!parsed.ok) {
      this.backup(raw);
      const data = emptyLeaderboard();
      this.write(data);
      return { data, recovered: true };
    }
    return { data: parsed.data, recovered: false };
  }

  all(): LeaderboardRecord[] {
    return sortRecords(this.load().data.records);
  }

  /** 按关卡取前 10 条（展示用）；无 levelId 时取全局排序结果。 */
  top(levelId?: number): LeaderboardRecord[] {
    const all = this.all();
    if (levelId === undefined) return all;
    return all.filter((r) => r.levelId === levelId).slice(0, LEADERBOARD_PER_LEVEL);
  }

  add(input: NewLeaderboardRecord): AddResult {
    if (
      !Number.isInteger(input.levelId) || input.levelId < 1 || input.levelId > 8 ||
      !Number.isInteger(input.score) || input.score < 0 ||
      !Number.isInteger(input.stars) || input.stars < 1 || input.stars > 3 ||
      !Number.isInteger(input.movesUsed) || input.movesUsed < 0 || input.movesUsed > 30 ||
      Number.isNaN(Date.parse(input.achievedAt))
    ) {
      return { added: false, reason: 'invalid' };
    }

    const data = this.load().data;
    const baseId = deriveRecordId(input);
    if (data.records.some((r) => r.id === baseId || r.id.startsWith(`${baseId}-`))) {
      return { added: false, reason: 'duplicate' };
    }

    const record: LeaderboardRecord = {
      id: baseId,
      levelId: input.levelId,
      score: input.score,
      stars: input.stars,
      movesUsed: input.movesUsed,
      achievedAt: input.achievedAt,
      seed: input.seed,
    };
    const next = pruneRecords([...data.records, record]);
    this.write({ boardVersion: 1, records: next });
    return { added: true, record };
  }

  clear(): void {
    try {
      this.storage.removeItem(LEADERBOARD_KEY);
    } catch {
      // ignore
    }
    this.memory.removeItem(LEADERBOARD_KEY);
  }

  count(): number {
    return this.load().data.records.length;
  }

  private write(data: LeaderboardDataV1): void {
    const text = JSON.stringify(data);
    try {
      this.storage.setItem(LEADERBOARD_KEY, text);
    } catch (error) {
      if (!this.temporary) {
        this.temporary = true;
        this.storage = this.memory;
        this.onTemporary?.(error instanceof Error ? error.message : String(error));
      }
      this.memory.setItem(LEADERBOARD_KEY, text);
    }
  }

  private backup(raw: string): void {
    try {
      const iso = this.now().toISOString();
      const key = leaderboardBackupKey(iso, (candidate) => {
        try {
          return this.storage.getItem(candidate) !== null;
        } catch {
          return true;
        }
      });
      this.storage.setItem(key, raw);
    } catch {
      // ignore
    }
  }
}
