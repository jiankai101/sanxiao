import {
  BACKUP_LEADERBOARD_PREFIX,
  LEADERBOARD_KEY,
  backupKey,
  type StorageLike,
} from '../storage/schema';

export const BOARD_VERSION = 1 as const;
export const LEADERBOARD_PER_LEVEL = 10;
export const LEADERBOARD_TOTAL = 20;

export interface LeaderboardRecord {
  id: string;
  levelId: number;
  score: number;
  stars: number;
  movesUsed: number;
  achievedAt: string;
  seed: number | string;
}

export interface LeaderboardDataV1 {
  boardVersion: 1;
  records: LeaderboardRecord[];
}

export type BoardParseResult =
  | { ok: true; data: LeaderboardDataV1 }
  | { ok: false; reason: 'json-parse' | 'schema' | 'version' };

const isObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);
const isInt = (v: unknown, lo: number, hi: number): v is number =>
  typeof v === 'number' && Number.isInteger(v) && v >= lo && v <= hi;
const isIso = (v: unknown): v is string => typeof v === 'string' && !Number.isNaN(Date.parse(v));

export function emptyLeaderboard(): LeaderboardDataV1 {
  return { boardVersion: BOARD_VERSION, records: [] };
}

export function isLeaderboardRecord(value: unknown): value is LeaderboardRecord {
  if (!isObject(value)) return false;
  if (typeof value.id !== 'string' || value.id.length === 0) return false;
  if (!isInt(value.levelId, 1, 8)) return false;
  if (!isInt(value.score, 0, Number.MAX_SAFE_INTEGER)) return false;
  if (!isInt(value.stars, 0, 3)) return false;
  if (!isInt(value.movesUsed, 0, 30)) return false;
  if (!isIso(value.achievedAt)) return false;
  if (typeof value.seed !== 'number' && typeof value.seed !== 'string') return false;
  return true;
}

export function parseLeaderboardText(raw: string): BoardParseResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { ok: false, reason: 'json-parse' };
  }
  if (!isObject(parsed)) return { ok: false, reason: 'schema' };
  if (parsed.boardVersion !== BOARD_VERSION) return { ok: false, reason: 'version' };
  if (!Array.isArray(parsed.records) || !parsed.records.every(isLeaderboardRecord)) {
    return { ok: false, reason: 'schema' };
  }
  return { ok: true, data: { boardVersion: BOARD_VERSION, records: parsed.records.map((r) => ({ ...r })) } };
}

export function leaderboardBackupKey(iso: string, exists: (key: string) => boolean): string {
  return backupKey(BACKUP_LEADERBOARD_PREFIX, iso, exists);
}

export { LEADERBOARD_KEY };
export type { StorageLike };
