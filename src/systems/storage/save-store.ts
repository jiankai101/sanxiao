import { MemoryStore } from './memory-store';
import {
  BACKUP_SAVE_PREFIX,
  SAVE_KEY,
  backupKey,
  cloneSave,
  defaultSave,
  parseSaveText,
  type CorruptReason,
  type SaveDataV1,
  type StorageLike,
} from './schema';

export interface LoadResult {
  data: SaveDataV1;
  recovered: boolean;
  reason?: CorruptReason;
}

export interface SaveStoreOptions {
  now?: () => Date;
  onTemporary?: (reason: string) => void;
}

const PROBE_KEY = '__wmg_probe__';

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

/**
 * 存档仓储：读取/校验/备份/内存降级（REQ-031/032）。
 * 所有写入都通过 save() 单点落盘，便于 SaveService 用 spy 断言写入次数。
 */
export class SaveStore {
  private storage: StorageLike;
  private memory = new MemoryStore();
  private temporary = false;
  private current: SaveDataV1 | null = null;
  private readonly now: () => Date;
  private readonly onTemporary?: (reason: string) => void;

  constructor(preferred: StorageLike | null, options: SaveStoreOptions = {}) {
    this.now = options.now ?? (() => new Date());
    this.onTemporary = options.onTemporary;
    if (probe(preferred)) {
      this.storage = preferred;
    } else {
      this.storage = this.memory;
      this.temporary = true;
    }
  }

  /** 浏览器入口：localStorage 不可用时自动退回内存。 */
  static fromGlobal(options: SaveStoreOptions = {}): SaveStore {
    let storage: StorageLike | null = null;
    try {
      storage = globalThis.localStorage ?? null;
    } catch {
      storage = null;
    }
    return new SaveStore(storage, options);
  }

  get isTemporary(): boolean {
    return this.temporary;
  }

  get activeStorage(): StorageLike {
    return this.storage;
  }

  readRaw(): string | null {
    try {
      return this.storage.getItem(SAVE_KEY);
    } catch {
      return null;
    }
  }

  load(): LoadResult {
    const raw = this.readRaw();
    if (raw === null) {
      const data = defaultSave(this.now().toISOString());
      this.current = data;
      return { data, recovered: false };
    }

    const parsed = parseSaveText(raw);
    if (!parsed.ok) {
      this.backup(raw);
      const data = defaultSave(this.now().toISOString());
      this.current = data;
      this.writeDirect(data);
      return { data, recovered: true, reason: parsed.reason };
    }

    this.current = parsed.data;
    return { data: parsed.data, recovered: false };
  }

  /** 单次 setItem；配额异常时降级为内存并重写一次。 */
  save(data: SaveDataV1): SaveDataV1 {
    const next = cloneSave(data);
    next.updatedAt = this.now().toISOString();
    this.current = next;
    this.writeDirect(next);
    return next;
  }

  getData(): SaveDataV1 {
    if (!this.current) this.current = this.load().data;
    return this.current;
  }

  /** 重置进度专用：删存档键 → 写默认存档（REQ-033）。 */
  reset(): SaveDataV1 {
    try {
      this.storage.removeItem(SAVE_KEY);
    } catch {
      // 删除失败不影响后续默认值写入
    }
    const data = defaultSave(this.now().toISOString());
    this.current = data;
    this.writeDirect(data);
    return data;
  }

  private writeDirect(data: SaveDataV1): void {
    const text = JSON.stringify(data);
    try {
      this.storage.setItem(SAVE_KEY, text);
    } catch (error) {
      this.degrade(error);
      this.memory.setItem(SAVE_KEY, text);
    }
  }

  private degrade(error: unknown): void {
    if (this.temporary) return;
    this.temporary = true;
    this.storage = this.memory;
    this.onTemporary?.(error instanceof Error ? error.message : String(error));
  }

  private backup(raw: string): void {
    try {
      const iso = this.now().toISOString();
      const key = backupKey(BACKUP_SAVE_PREFIX, iso, (candidate) => {
        try {
          return this.storage.getItem(candidate) !== null;
        } catch {
          return true;
        }
      });
      this.storage.setItem(key, raw);
    } catch {
      // 备份失败时忽略，继续重置（plan 11.3 第 1 步）
    }
  }
}
