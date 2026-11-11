import { describe, expect, it } from 'vitest';
import { buildLeaderboardModel } from '../../src/ui/screens/leaderboard';

const FORBIDDEN_WORDS = ['全球', '在线', '全服', '服务器排名'];
const containsForbiddenWording = (text: string) => FORBIDDEN_WORDS.some((word) => text.includes(word));

describe('REQ-034 本地排行榜文案', () => {
  it('标题含「本地排行榜」，禁用词检索为 0', () => {
    const model = buildLeaderboardModel([
      { id: '1', levelId: 1, score: 2600, stars: 2, movesUsed: 14, achievedAt: '2026-11-10T08:09:00.000Z', seed: 1 },
    ]);
    expect(model.title).toBe('本地排行榜');
    expect(model.limitText).toContain('本机记录上限 20 条');
    const text = [model.title, model.limitText, model.emptyText].join(' ');
    for (const word of FORBIDDEN_WORDS) {
      expect(text.includes(word)).toBe(false);
    }
    expect(containsForbiddenWording(text)).toBe(false);
  });

  it('标注关卡名与达成时间，按关卡筛选', () => {
    const records = [
      { id: '1', levelId: 1, score: 2600, stars: 2, movesUsed: 14, achievedAt: '2026-11-10T08:09:00.000Z', seed: 1 },
      { id: '2', levelId: 2, score: 1800, stars: 1, movesUsed: 20, achievedAt: '2026-11-10T09:30:00.000Z', seed: 2 },
    ];
    const all = buildLeaderboardModel(records);
    expect(all.rows).toHaveLength(2);
    expect(all.rows[0]!.achievedAtText).toMatch(/^2026-11-10 \d{2}:\d{2}$/);
    expect(all.rows[1]!.levelName).toContain('初潮');

    const filtered = buildLeaderboardModel(records, 2);
    expect(filtered.rows).toHaveLength(1);
    expect(filtered.rows[0]!.levelId).toBe(2);
  });

  it('空态文案可见', () => {
    const model = buildLeaderboardModel([]);
    expect(model.rows).toEqual([]);
    expect(model.emptyText).toContain('暂无记录');
  });
});
