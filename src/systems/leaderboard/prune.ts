import { LEADERBOARD_PER_LEVEL, LEADERBOARD_TOTAL, type LeaderboardRecord } from './schema';
import { sortRecords } from './sort';

/** REQ-037：排序后单关 10 条、全局 20 条，超出淘汰末位。 */
export function pruneRecords(records: readonly LeaderboardRecord[]): LeaderboardRecord[] {
  const sorted = sortRecords(records);
  const perLevel = new Map<number, number>();
  const kept: LeaderboardRecord[] = [];
  for (const record of sorted) {
    const used = perLevel.get(record.levelId) ?? 0;
    if (used >= LEADERBOARD_PER_LEVEL) continue;
    if (kept.length >= LEADERBOARD_TOTAL) break;
    kept.push(record);
    perLevel.set(record.levelId, used + 1);
  }
  return kept;
}
