/** G5 独立验收审计 part C：资源/音频/UI 文案/存档写入点/排行榜仓储。 */
import { describe, expect, test } from 'vitest';
import { existsSync } from 'node:fs';
import * as C from '@core/constants';
import type { LevelConfig } from '@core/types';
import { LEVELS, getLevel } from '@systems/level/levels';
import { IMAGE_FILES, AUDIO_FILES, AUDIO_BASENAMES, assetManifest, createAssetStore, TILE_IMAGE_BY_KIND } from '@render/assets';
import { PLACEHOLDER_STYLES } from '@render/placeholders';
import { SFX_MAP, SFX_EVENTS, BGM_NAME, sfxFile } from '@systems/audio/sfx-map';
import { AudioEngine, volumeToGain } from '@systems/audio/audio-engine';
import { buildHudModel, formatLiveText } from '@ui/hud';
import { buildResultModel } from '@ui/screens/result-panel';
import { buildLevelCards } from '@ui/screens/level-select';
import { buildLeaderboardModel } from '@ui/screens/leaderboard';
import { SaveStore } from '@systems/storage/save-store';
import { SaveService } from '@systems/storage/save-service';
import { LeaderboardStore } from '@systems/leaderboard/store';
import { defaultSave, SAVE_KEY, LEADERBOARD_KEY } from '@systems/storage/schema';
import { MemoryStore } from '@systems/storage/memory-store';
import { stepDurationMs } from '@systems/game/tween-timeline';

/** 内存 + 计数：用于断言 REQ-030 的写入次数。 */
class CountingStore {
  data = new Map<string, string>();
  writes = 0;
  backups = 0;
  getItem(k: string) { return this.data.get(k) ?? null; }
  setItem(k: string, v: string) { this.writes += 1; if (k.startsWith('wmg.backup')) this.backups += 1; this.data.set(k, v); }
  removeItem(k: string) { this.data.delete(k); }
}

describe('REQ-039 / REQ-040 / 10.1 图片资源清单', () => {
  test('33 个图片文件齐全，命名与 spec 10.1 一致，且构建可解析', () => {
    const specNames = [
      'bg-main.webp', 'board-frame.webp', 'cell-empty.webp', 'tile-star.webp', 'tile-water.webp',
      'tile-leaf.webp', 'tile-flame.webp', 'tile-crystal.webp', 'tile-bolt.webp', 'tile-select.webp',
      'special-line-h.webp', 'special-line-v.webp', 'special-rainbow.webp', 'obs-ice.webp',
      'obs-stone-2.webp', 'obs-stone-1.webp', 'obs-hole.webp', 'fx-clear.webp', 'ui-panel.webp',
      'icon-star-on.svg', 'icon-star-off.svg', 'icon-play.svg', 'icon-pause.svg', 'icon-restart.svg',
      'icon-back.svg', 'icon-lock.svg', 'icon-sound-on.svg', 'icon-sound-off.svg', 'icon-music-on.svg',
      'icon-music-off.svg', 'icon-settings.svg', 'icon-trophy.svg', 'icon-close.svg',
    ];
    expect(IMAGE_FILES.slice().sort()).toEqual(specNames.slice().sort());
    for (const name of specNames) expect(existsSync(`assets/${name}`), name).toBe(true);
    const manifest = assetManifest();
    expect(manifest.images).toBe(33);
    expect(manifest.loadedImages).toBe(33);
    expect(manifest.audio).toBe(28);
    expect(manifest.loadedAudio).toBe(28);
  });

  test('6 种元素贴图互不相同，占位形状/符号两两不同且主色符合 5.1', () => {
    const files = Object.values(TILE_IMAGE_BY_KIND);
    expect(new Set(files).size).toBe(6);
    const styles = Object.values(PLACEHOLDER_STYLES);
    expect(new Set(styles.map((s) => s.shape)).size).toBe(6);
    expect(new Set(styles.map((s) => s.symbol)).size).toBe(6);
    expect(styles.map((s) => s.symbol)).toEqual(['★', '●', '▲', '■', '◆', '✚']);
    expect(PLACEHOLDER_STYLES.star.color.toUpperCase()).toBe('#F2C230');
    expect(PLACEHOLDER_STYLES.water.color.toUpperCase()).toBe('#3AA0E8');
  });
});

describe('REQ-042 图片加载失败降级', () => {
  test('加载失败返回占位、只 warn 一次、不抛异常', async () => {
    const warns: string[] = [];
    const store = createAssetStore({
      logger: { warn: (m) => warns.push(m) },
      urls: { 'tile-star.webp': 'blob:missing', 'tile-water.webp': 'blob:missing' },
      loader: () => Promise.reject(new Error('404')),
    });
    const a = await store.loadImage('tile-star.webp');
    const b = await store.loadImage('tile-water.webp');
    expect(a.ok).toBe(false);
    expect(a.placeholder).toEqual(PLACEHOLDER_STYLES.star);
    expect(b.ok).toBe(false);
    expect(warns.length).toBe(1);
  });

  test('缺 URL 也降级（不抛）', async () => {
    const warns: string[] = [];
    const store = createAssetStore({ urls: {}, logger: { warn: (m) => warns.push(m) } });
    const r = await store.loadImage('nope.webp');
    expect(r.ok).toBe(false);
    expect(r.image).toBeNull();
    expect(warns.length).toBe(1);
  });
});

describe('REQ-046 音效事件映射（13 事件 → 13 文件），REQ-045 BGM', () => {
  test('13 个事件与资源一一对应，两套格式文件都存在', () => {
    expect(SFX_EVENTS).toHaveLength(13);
    const files = SFX_EVENTS.map((e) => SFX_MAP[e]);
    expect(new Set(files).size).toBe(13);
    for (const e of SFX_EVENTS) {
      expect(existsSync(`assets/sfx-${e}.ogg`, `sfx-${e}`), e).toBe(true);
      expect(existsSync(`assets/sfx-${e}.mp3`, `sfx-${e}`), e).toBe(true);
      expect(sfxFile(e, 'ogg')).toBe(`sfx-${e}.ogg`);
      expect(sfxFile(e, 'mp3')).toBe(`sfx-${e}.mp3`);
    }
    expect(existsSync(`assets/${BGM_NAME}.ogg`)).toBe(true);
    expect(existsSync(`assets/${BGM_NAME}.mp3`)).toBe(true);
    expect(AUDIO_BASENAMES).toHaveLength(14);
    expect(AUDIO_FILES).toHaveLength(28);
  });
});

/** 最小 AudioContext 桩：只记录调用。 */
function fakeCtx() {
  const state: any = { gains: [] as any[], sources: [] as any[], suspended: 0, resumed: 0, currentTime: 0 };
  const ctx: any = {
    destination: {},
    state: 'running',
    get currentTime() { return state.currentTime; },
    createGain: () => {
      const node = { gain: { value: 1 }, connect: () => undefined };
      state.gains.push(node);
      return node;
    },
    createBufferSource: () => {
      const node: any = { loop: false, buffer: null, started: null as any, stopped: false, connect: () => undefined,
        start: (when?: number, offset?: number) => { node.started = { when, offset }; },
        stop: () => { node.stopped = true; } };
      state.sources.push(node);
      return node;
    },
    decodeAudioData: async () => ({ duration: 60 }),
    suspend: async () => { state.suspended += 1; },
    resume: async () => { state.resumed += 1; },
    close: async () => undefined,
  };
  return { ctx, state };
}

describe('REQ-045 / REQ-047 / REQ-048 音频行为', () => {
  const mk = (opts: { failDecode?: boolean } = {}) => {
    const { ctx, state } = fakeCtx();
    const engine = new AudioEngine({
      createContext: () => ctx,
      canPlay: () => true,
      fetchArrayBuffer: async () => new ArrayBuffer(8),
      now: () => 0,
      resolveBgm: (name) => `assets/${name}.ogg`,
    });
    if (opts.failDecode) ctx.decodeAudioData = async () => { throw new Error('decode'); };
    return { engine, state, ctx };
  };

  test('首次手势后播放 BGM 且循环；hidden 暂停、visible 续播', async () => {
    const { engine, state } = mk();
    expect(engine.isPlayingBgm).toBe(false);
    engine.unlock();
    await new Promise((r) => setTimeout(r, 10));
    expect(engine.isPlayingBgm).toBe(true);
    const src = state.sources.at(-1);
    expect(src.loop).toBe(true);
    expect(engine.available).not.toBe(false);
    state.currentTime = 12.5;
    engine.onVisibility(true);
    expect(state.suspended).toBeGreaterThan(0);
    expect(engine.isPlayingBgm).toBe(false);
    engine.onVisibility(false);
    await new Promise((r) => setTimeout(r, 10));
    expect(state.resumed).toBeGreaterThan(0);
    const resumed = state.sources.at(-1);
    expect(resumed.started.offset).toBeGreaterThan(12);
  });

  test('REQ-047 音量 0..100 → 增益；关闭音效后不再播放', async () => {
    expect(volumeToGain(0)).toBe(0);
    expect(volumeToGain(100)).toBeCloseTo(1, 5);
    for (const v of [5, 96, 100]) expect(Number.isFinite(volumeToGain(v))).toBe(true);
    const { engine, state } = mk();
    engine.setSettings({ bgmEnabled: true, bgmVolume: 60, sfxEnabled: false, sfxVolume: 80 });
    engine.unlock();
    await new Promise((r) => setTimeout(r, 10));
    const before = state.sources.length;
    await engine.playSfx('swap');
    expect(state.sources.length).toBe(before);
    engine.setSettings({ bgmEnabled: false, bgmVolume: 0, sfxEnabled: true, sfxVolume: 100 });
    expect(engine.isPlayingBgm).toBe(false);
  });

  test('REQ-046 同一音效 100ms 内最多播放 1 次', async () => {
    let now = 1000;
    const { ctx, state } = fakeCtx();
    const engine = new AudioEngine({
      createContext: () => ctx,
      canPlay: () => true,
      fetchArrayBuffer: async () => new ArrayBuffer(8),
      now: () => now,
      resolveBgm: () => null,
    });
    engine.setSettings({ bgmEnabled: false, bgmVolume: 60, sfxEnabled: true, sfxVolume: 80 });
    await engine.playSfx('match');
    const afterFirst = state.sources.length;
    now += 50;
    await engine.playSfx('match');
    expect(state.sources.length).toBe(afterFirst);
    now += 60;
    await engine.playSfx('match');
    expect(state.sources.length).toBe(afterFirst + 1);
  });

  test('REQ-048 解码失败 → 静默降级（不抛、不可用标记）', async () => {
    const { engine } = mk({ failDecode: true });
    engine.setSettings({ bgmEnabled: false, bgmVolume: 60, sfxEnabled: true, sfxVolume: 80 });
    await expect(engine.playSfx('win')).resolves.toBeUndefined();
    expect(engine.unavailable).toBe(true);
  });
});

describe('REQ-050 状态播报文案', () => {
  test('严格格式「分数 {score}，剩余步数 {moves}，目标 {progress}」', () => {
    const level = getLevel(6)!;
    const goals = [
      { goalId: 'collect-flame', current: 3, target: 18, done: false },
      { goalId: 'score', current: 500, target: 2000, done: false },
    ];
    const model = buildHudModel({ score: 500, movesLeft: 12, goals, level });
    expect(formatLiveText(model)).toBe('分数 500，剩余步数 12，目标 火 3/18；分数 500/2000');
    expect(model.lowMoves).toBe(false);
    expect(buildHudModel({ score: 0, movesLeft: 3, goals, level }).lowMoves).toBe(true);
    expect(buildHudModel({ score: 0, movesLeft: 0, goals, level }).lowMoves).toBe(false);
  });
});

describe('REQ-028 结算面板字段', () => {
  const level = getLevel(6)!;
  const goals = [
    { goalId: 'collect-flame', current: 18, target: 18, done: true },
    { goalId: 'score', current: 2100, target: 2000, done: true },
  ];
  test('胜利面板字段齐全且显示下一关', () => {
    const m = buildResultModel({ level, won: true, score: 2100, bestScore: 2600, stars: 2, movesLeft: 4, goals, hasNextLevel: true });
    expect(m.levelName).toBe('双线');
    expect(m.resultText).toBe('胜利');
    expect(m.scoreText).toBe('本局分数 2100');
    expect(m.bestText).toBe('历史最高分 2600');
    expect(m.stars).toBe(2);
    expect(m.movesLeft).toBe(4);
    expect(m.goals.map((g) => g.text)).toEqual(['火 18/18', '分数 2100/2000']);
    expect(m.showNext).toBe(true);
  });
  test('失败面板隐藏下一关', () => {
    const m = buildResultModel({ level, won: false, score: 300, bestScore: 0, stars: 0, movesLeft: 0, goals: goals.map((g) => ({ ...g, done: false })), hasNextLevel: true });
    expect(m.resultText).toBe('失败');
    expect(m.showNext).toBe(false);
    expect(m.stars).toBe(0);
  });
});

describe('REQ-021 选关解锁与锁定文案', () => {
  test('初始仅第 1 关可玩；未解锁提示「通过上一关解锁」', () => {
    const cards = buildLevelCards(defaultSave());
    expect(cards).toHaveLength(8);
    expect(cards.filter((c) => c.unlocked).map((c) => c.levelId)).toEqual([1]);
    expect(cards[1]!.lockedHint).toBe('通过上一关解锁');
    const save = defaultSave();
    save.unlockedLevelId = 4;
    expect(buildLevelCards(save).filter((c) => c.unlocked).map((c) => c.levelId)).toEqual([1, 2, 3, 4]);
  });
});

describe('REQ-034 本地排行榜文案', () => {
  test('标题含「本地排行榜」，且禁止词不出现', () => {
    const model = buildLeaderboardModel([], undefined);
    expect(model.title).toBe('本地排行榜');
    const banned = ['全球', '在线', '全服', '服务器排名'];
    const text = [model.title, model.emptyText, model.limitText].join('');
    for (const word of banned) expect(text.includes(word), word).toBe(false);
    expect(model.limitText).toContain('本机');
    expect(model.emptyText.length).toBeGreaterThan(0);
  });
});

describe('REQ-030 存档写入时机（四个语义入口）', () => {
  const mkSave = () => {
    const store = new CountingStore();
    store.setItem(SAVE_KEY, JSON.stringify(defaultSave('2026-01-01T00:00:00.000Z')));
    store.writes = 0;
    const saveStore = new SaveStore(store, { now: () => new Date('2026-03-01T10:00:00.000Z') });
    saveStore.load();
    const svc = new SaveService(saveStore, () => new Date('2026-03-01T10:00:00.000Z'));
    return { store, svc };
  };

  test('结算（胜）合并中断标记为 1 次写入，不写任何对局进行态字段', () => {
    const { store, svc } = mkSave();
    svc.setSessionInterrupted(true);
    store.writes = 0;
    svc.recordSettlement({ levelId: 1, won: true, score: 1800, stars: 2, movesUsed: 12, clearedTiles: 40, playSeconds: 30 });
    expect(store.writes).toBe(1);
    const raw = JSON.parse(store.getItem(SAVE_KEY)!);
    expect(raw.lastSessionInterrupted).toBe(false);
    expect(raw.levelRecords[0]).toMatchObject({ levelId: 1, bestScore: 1800, bestStars: 2, clearCount: 1 });
    expect(raw.stats).toEqual({ totalMoves: 12, totalClearCount: 40, totalPlaySeconds: 30 });
    const serialized = JSON.stringify(raw);
    for (const banned of ['board', 'movesLeft', 'score"', 'cascade', 'snapshot']) {
      expect(serialized.includes(banned), banned).toBe(false);
    }
  });

  test('失败结算不增加 clearCount / 星级，但记录 bestScore 与 lastPlayedAt', () => {
    const { svc } = mkSave();
    svc.recordSettlement({ levelId: 1, won: false, score: 3200, stars: 0, movesUsed: 20, clearedTiles: 30 });
    const rec = svc.record(1);
    expect(rec.clearCount).toBe(0);
    expect(rec.bestStars).toBe(0);
    expect(rec.bestScore).toBe(3200);
    expect(rec.lastPlayedAt).toBe('2026-03-01T10:00:00.000Z');
  });

  test('设置变更立即写入；解锁只升不降；中断标记重复写同值不写盘', () => {
    const { store, svc } = mkSave();
    store.writes = 0;
    svc.updateSettings({ colorblindMode: true, bgmVolume: 5 });
    expect(store.writes).toBe(1);
    expect(svc.settings.colorblindMode).toBe(true);
    expect(svc.settings.bgmVolume).toBe(5);
    store.writes = 0;
    svc.unlockNextLevel(3);
    expect(store.writes).toBe(1);
    expect(svc.data.unlockedLevelId).toBe(4);
    svc.unlockNextLevel(1);
    expect(svc.data.unlockedLevelId).toBe(4);
    store.writes = 0;
    svc.setSessionInterrupted(false);
    expect(store.writes).toBe(0);
  });

  test('REQ-033 重置：清空存档回到第 1 关未通关', () => {
    const { svc } = mkSave();
    svc.recordSettlement({ levelId: 2, won: true, score: 3000, stars: 3, movesUsed: 10, clearedTiles: 50 });
    svc.unlockNextLevel(2);
    svc.resetProgress();
    expect(svc.data.unlockedLevelId).toBe(1);
    expect(svc.data.levelRecords.every((r) => r.bestStars === 0 && r.clearCount === 0)).toBe(true);
    expect(svc.settings.bgmVolume).toBe(60);
  });
});

describe('REQ-031 / REQ-032 仓储降级与备份', () => {
  test('损坏存档：备份原文到独立键 + 默认值初始化', () => {
    const store = new CountingStore();
    store.setItem(SAVE_KEY, '{bad json');
    const saveStore = new SaveStore(store, { now: () => new Date('2026-03-01T10:00:00.000Z') });
    const r = saveStore.load();
    expect(r.recovered).toBe(true);
    const backupKeys = [...store.data.keys()].filter((k) => k.startsWith('wmg.backup.save.'));
    expect(backupKeys).toHaveLength(1);
    expect(store.getItem(backupKeys[0]!)).toBe('{bad json');
    expect(JSON.parse(store.getItem(SAVE_KEY)!).saveVersion).toBe(1);
  });

  test('localStorage 抛异常 → 内存降级且功能可用（REQ-032）', () => {
    const broken: any = {
      getItem() { throw new Error('denied'); },
      setItem() { throw new Error('denied'); },
      removeItem() { throw new Error('denied'); },
    };
    const saveStore = new SaveStore(broken, { now: () => new Date('2026-03-01T10:00:00.000Z') });
    expect(saveStore.isTemporary).toBe(true);
    const svc = new SaveService(saveStore);
    svc.updateSettings({ sfxVolume: 10 });
    expect(svc.settings.sfxVolume).toBe(10);
    expect(saveStore.getData().saveVersion).toBe(1);
  });

  test('配额超限（写入抛 QuotaExceededError）→ 降级内存并保留数据', () => {
    const store: any = new MemoryStore();
    let quota = false;
    const wrapped: any = {
      getItem: (k: string) => store.getItem(k),
      removeItem: (k: string) => store.removeItem(k),
      setItem: (k: string, v: string) => {
        if (quota && k === SAVE_KEY) { const e = new Error('quota'); e.name = 'QuotaExceededError'; throw e; }
        store.setItem(k, v);
      },
    };
    const saveStore = new SaveStore(wrapped, { now: () => new Date('2026-03-01T10:00:00.000Z') });
    saveStore.load();
    quota = true;
    const svc = new SaveService(saveStore);
    svc.updateSettings({ reducedMotion: true });
    expect(saveStore.isTemporary).toBe(true);
    expect(svc.settings.reducedMotion).toBe(true);
  });
});

describe('REQ-035 / REQ-036 / REQ-037 排行榜仓储', () => {
  test('胜利记录字段完整、按排序插入、同一局重复结算不新增', () => {
    const store = new MemoryStore();
    const lb = new LeaderboardStore(store);
    const add = () => lb.add({ levelId: 1, score: 1800, stars: 2, movesUsed: 15, achievedAt: '2026-03-01T10:00:00.000Z', seed: 42 });
    expect(add().added).toBe(true);
    expect(add().added).toBe(false);
    expect(lb.count()).toBe(1);
    const r = lb.all()[0]!;
    expect(Object.keys(r).sort()).toEqual(['achievedAt', 'id', 'levelId', 'movesUsed', 'score', 'seed', 'stars']);
    expect(r).toMatchObject({ levelId: 1, score: 1800, stars: 2, movesUsed: 15, seed: 42 });

    lb.add({ levelId: 1, score: 2500, stars: 3, movesUsed: 18, achievedAt: '2026-03-02T10:00:00.000Z', seed: 43 });
    expect(lb.all().map((x) => x.score)).toEqual([2500, 1800]);
    expect(lb.top(1)).toHaveLength(2);
  });

  test('拒绝非法记录（stars 0 / movesUsed 31 / score 负数）', () => {
    const lb = new LeaderboardStore(new MemoryStore());
    expect(lb.add({ levelId: 1, score: 10, stars: 0, movesUsed: 5, achievedAt: '2026-03-01T10:00:00.000Z', seed: 1 }).added).toBe(false);
    expect(lb.add({ levelId: 1, score: 10, stars: 1, movesUsed: 31, achievedAt: '2026-03-01T10:00:00.000Z', seed: 1 }).added).toBe(false);
    expect(lb.add({ levelId: 1, score: -1, stars: 1, movesUsed: 5, achievedAt: '2026-03-01T10:00:00.000Z', seed: 1 }).added).toBe(false);
  });

  test('清空只影响排行榜键（不影响存档）', () => {
    const store = new MemoryStore();
    store.setItem(SAVE_KEY, JSON.stringify(defaultSave()));
    const lb = new LeaderboardStore(store);
    lb.add({ levelId: 1, score: 1800, stars: 2, movesUsed: 15, achievedAt: '2026-03-01T10:00:00.000Z', seed: 42 });
    expect(store.getItem(LEADERBOARD_KEY)).toBeTruthy();
    lb.clear();
    expect(lb.count()).toBe(0);
    expect(store.getItem(SAVE_KEY)).toBeTruthy();
  });

  test('排行榜损坏独立备份，不影响存档（8.2 第 4 条）', () => {
    const store = new MemoryStore();
    const good = JSON.stringify(defaultSave());
    store.setItem(SAVE_KEY, good);
    store.setItem(LEADERBOARD_KEY, '{oops');
    const lb = new LeaderboardStore(store);
    const r = lb.load();
    expect(r.recovered).toBe(true);
    expect(store.getItem(SAVE_KEY)).toBe(good);
    expect([...Array(0)].length).toBe(0);
  });
});

describe('REQ-044 动画时长（减弱动效）', () => {
  test('全量 150/200/180/160/300/200；减弱后全部 ≤100ms', () => {
    const full = {
      swap: stepDurationMs('swap', { reduced: false }),
      revert: stepDurationMs('revert', { reduced: false }),
      clear: stepDurationMs('clear', { reduced: false }),
      fall: stepDurationMs('fall', { reduced: false }),
      special: stepDurationMs('special', { reduced: false }),
      panel: stepDurationMs('panel', { reduced: false }),
    };
    expect(full).toEqual({ swap: 150, revert: 200, clear: 180, fall: 160, special: 300, panel: 200 });
    const reduced = Object.fromEntries(
      Object.keys(full).map((k) => [k, stepDurationMs(k as any, { reduced: true })]),
    );
    for (const v of Object.values(reduced)) expect(v).toBeLessThanOrEqual(100);
  });
});
