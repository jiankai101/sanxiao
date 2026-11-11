import type { LeaderboardRecord } from './schema';

/** REQ-036：score 降序 → movesUsed 升序 → achievedAt 升序 → id 字典序。 */
export function compareRecords(a: LeaderboardRecord, b: LeaderboardRecord): number {
  if (a.score !== b.score) return b.score - a.score;
  if (a.movesUsed !== b.movesUsed) return a.movesUsed - b.movesUsed;
  const ta = Date.parse(a.achievedAt);
  const tb = Date.parse(b.achievedAt);
  if (ta !== tb) return ta - tb;
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

export function sortRecords(records: readonly LeaderboardRecord[]): LeaderboardRecord[] {
  return [...records].sort(compareRecords);
}
