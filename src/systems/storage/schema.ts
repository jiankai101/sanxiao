/** 存储键集中定义（plan 11.1）：禁止散落字符串。 */
export const SAVE_KEY = 'wmg.save.v1';
export const LEADERBOARD_KEY = 'wmg.leaderboard.v1';
export const BACKUP_SAVE_PREFIX = 'wmg.backup.save.';
export const BACKUP_LEADERBOARD_PREFIX = 'wmg.backup.leaderboard.';
export const SAVE_VERSION = 1 as const;

export const DEFAULT_BGM_VOLUME = 60;
export const DEFAULT_SFX_VOLUME = 80;
export const EPOCH_ISO = '1970-01-01T00:00:00.000Z';

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export interface LevelRecordV1 {
  levelId: number;
  bestScore: number;
  bestStars: number;
  clearCount: number;
  lastPlayedAt: string;
}

export interface SettingsV1 {
  bgmEnabled: boolean;
  bgmVolume: number;
  sfxEnabled: boolean;
  sfxVolume: number;
  reducedMotion: boolean;
  colorblindMode: boolean;
}

export interface StatsV1 {
  totalMoves: number;
  totalClearCount: number;
  totalPlaySeconds: number;
}

export interface SaveDataV1 {
  saveVersion: 1;
  lastSessionInterrupted: boolean;
  unlockedLevelId: number;
  levelRecords: LevelRecordV1[];
  settings: SettingsV1;
  stats: StatsV1;
  updatedAt: string;
}

export type CorruptReason = 'json-parse' | 'schema' | 'version';

export type ParseResult =
  | { ok: true; data: SaveDataV1 }
  | { ok: false; reason: CorruptReason };

const isObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

const isInt = (v: unknown): v is number => typeof v === 'number' && Number.isInteger(v);
const isIso = (v: unknown): v is string => typeof v === 'string' && !Number.isNaN(Date.parse(v));
const inRange = (v: unknown, lo: number, hi: number): v is number =>
  isInt(v) && v >= lo && v <= hi;

export function defaultSettings(): SettingsV1 {
  return {
    bgmEnabled: true,
    bgmVolume: DEFAULT_BGM_VOLUME,
    sfxEnabled: true,
    sfxVolume: DEFAULT_SFX_VOLUME,
    reducedMotion: false,
    colorblindMode: false,
  };
}

export function emptyLevelRecord(levelId: number): LevelRecordV1 {
  return { levelId, bestScore: 0, bestStars: 0, clearCount: 0, lastPlayedAt: EPOCH_ISO };
}

export function defaultSave(nowIso: string = new Date().toISOString()): SaveDataV1 {
  return {
    saveVersion: SAVE_VERSION,
    lastSessionInterrupted: false,
    unlockedLevelId: 1,
    levelRecords: Array.from({ length: 8 }, (_, i) => emptyLevelRecord(i + 1)),
    settings: defaultSettings(),
    stats: { totalMoves: 0, totalClearCount: 0, totalPlaySeconds: 0 },
    updatedAt: nowIso,
  };
}

/** 只校验已存在的字段；缺失 lastSessionInterrupted 由 normalize 补 false（REQ-031 例外）。 */
export function validateSaveSchema(value: unknown): boolean {
  if (!isObject(value)) return false;
  if (!inRange(value.unlockedLevelId, 1, 8)) return false;

  if (!Array.isArray(value.levelRecords) || value.levelRecords.length > 8) return false;
  const ids = new Set<number>();
  for (const rec of value.levelRecords) {
    if (!isObject(rec)) return false;
    if (!inRange(rec.levelId, 1, 8) || ids.has(rec.levelId)) return false;
    ids.add(rec.levelId);
    if (!isInt(rec.bestScore) || rec.bestScore < 0) return false;
    if (!inRange(rec.bestStars, 0, 3)) return false;
    if (!isInt(rec.clearCount) || rec.clearCount < 0) return false;
    if (!isIso(rec.lastPlayedAt)) return false;
  }

  const settings = value.settings;
  if (!isObject(settings)) return false;
  if (typeof settings.bgmEnabled !== 'boolean') return false;
  if (typeof settings.sfxEnabled !== 'boolean') return false;
  if (typeof settings.reducedMotion !== 'boolean') return false;
  if (typeof settings.colorblindMode !== 'boolean') return false;
  if (!inRange(settings.bgmVolume, 0, 100)) return false;
  if (!inRange(settings.sfxVolume, 0, 100)) return false;

  const stats = value.stats;
  if (!isObject(stats)) return false;
  for (const field of ['totalMoves', 'totalClearCount', 'totalPlaySeconds'] as const) {
    if (!isInt(stats[field]) || (stats[field] as number) < 0) return false;
  }

  if (!isIso(value.updatedAt)) return false;
  if ('lastSessionInterrupted' in value && typeof value.lastSessionInterrupted !== 'boolean') {
    return false;
  }
  return true;
}

/** 仅补默认值，不改写已有合法值（plan 11.3）。 */
export function normalizeSave(value: unknown): SaveDataV1 {
  const raw = value as SaveDataV1 & { lastSessionInterrupted?: boolean };
  const byId = new Map<number, LevelRecordV1>();
  for (const rec of raw.levelRecords ?? []) byId.set(rec.levelId, { ...rec });
  const levelRecords = Array.from({ length: 8 }, (_, i) => byId.get(i + 1) ?? emptyLevelRecord(i + 1));
  return {
    saveVersion: SAVE_VERSION,
    lastSessionInterrupted: raw.lastSessionInterrupted ?? false,
    unlockedLevelId: raw.unlockedLevelId,
    levelRecords,
    settings: { ...raw.settings },
    stats: { ...raw.stats },
    updatedAt: raw.updatedAt,
  };
}

export function parseSaveText(raw: string): ParseResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { ok: false, reason: 'json-parse' };
  }
  if (!isObject(parsed)) return { ok: false, reason: 'schema' };

  if (parsed.saveVersion !== SAVE_VERSION) return { ok: false, reason: 'version' };
  if (!validateSaveSchema(parsed)) return { ok: false, reason: 'schema' };
  return { ok: true, data: normalizeSave(parsed) };
}

export function cloneSave(data: SaveDataV1): SaveDataV1 {
  return {
    ...data,
    levelRecords: data.levelRecords.map((r) => ({ ...r })),
    settings: { ...data.settings },
    stats: { ...data.stats },
  };
}

export function getLevelRecord(data: SaveDataV1, levelId: number): LevelRecordV1 {
  return data.levelRecords.find((r) => r.levelId === levelId) ?? emptyLevelRecord(levelId);
}

export function backupKey(prefix: string, iso: string, exists: (key: string) => boolean): string {
  let candidate = `${prefix}${iso}`;
  let n = 1;
  while (exists(candidate)) {
    candidate = `${prefix}${iso}-${n}`;
    n += 1;
  }
  return candidate;
}
