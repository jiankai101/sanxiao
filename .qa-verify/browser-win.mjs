/** G5 浏览器验收（测试构建）：真实拖动通关 → 排行榜写入/展示/持久化。 */
import { chromium } from '@playwright/test';
const BASE = 'http://127.0.0.1:5055/';
const results = [];
const ok = (id, cond, detail) => { results.push({ id, pass: !!cond, detail }); console.log(`${cond ? 'PASS' : 'FAIL'} ${id} :: ${detail}`); };

const browser = await chromium.launch({ channel: 'chrome' });
const ctx = await browser.newContext({ viewport: { width: 960, height: 720 } });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
await page.goto(`${BASE}?seed=1`, { waitUntil: 'networkidle' });
await page.waitForSelector('#screen-level-select .level-card');
await page.locator('#screen-level-select .level-card[data-level-id="1"]').click();
await page.waitForSelector('#screen-game:not(.hidden)');
await page.waitForTimeout(300);

const cellPoint = async (row, col) => {
  const b = await page.locator('#game').boundingBox();
  const s = b.width / 960;
  return { x: b.x + (224 + (col - 0.5) * 64) * s, y: b.y + (96 + (row - 0.5) * 64) * s };
};

let moves = 0;
let status = 'playing';
for (let i = 0; i < 30; i += 1) {
  const st = await page.evaluate(() => window.__wmgTest.state());
  status = st.status;
  if (status !== 'playing') break;
  const move = await page.evaluate(() => window.__wmgTest.findMove());
  if (!move) break;
  const p1 = await cellPoint(move.a.row, move.a.col);
  const p2 = await cellPoint(move.b.row, move.b.col);
  await page.mouse.move(p1.x, p1.y);
  await page.mouse.down();
  await page.mouse.move(p2.x, p2.y, { steps: 6 });
  await page.mouse.up();
  moves += 1;
  // 等待本轮结算提交（status 回到 playing/won/lost）
  for (let k = 0; k < 80; k += 1) {
    const cur = await page.evaluate(() => window.__wmgTest.state());
    if (cur.status === 'playing' || cur.status === 'won' || cur.status === 'lost') break;
    await page.waitForTimeout(100);
  }
  await page.waitForTimeout(120);
}
const final = await page.evaluate(() => window.__wmgTest.state());
ok('REQ-015/win-loop', final.status === 'won', `用 ${moves} 次真实鼠标拖动完成第 1 关：status=${final.status} 分数=${final.score} 剩余步数=${final.movesLeft}`);

const panel = page.locator('#panel-result');
await panel.waitFor({ state: 'visible', timeout: 5000 });
const panelText = await panel.textContent();
for (const label of ['胜利', '本局分数', '历史最高分', '剩余步数', '★']) {
  ok(`REQ-028/${label}`, (panelText ?? '').includes(label), `结算面板包含「${label}」`);
}
const firstBtnDisabled = await page.locator('#panel-result button').first().isDisabled();
ok('REQ-028/300ms-lock', firstBtnDisabled, `面板出现瞬间按钮 disabled=${firstBtnDisabled}`);
await page.waitForTimeout(400);
ok('REQ-028/300ms-unlock', !(await page.locator('#panel-result button').first().isDisabled()), '400ms 后按钮可点击');
await page.screenshot({ path: '.qa-verify/out/E1-victory-panel.png' });

const stored = await page.evaluate(() => ({
  lb: JSON.parse(localStorage.getItem('wmg.leaderboard.v1') ?? 'null'),
  save: JSON.parse(localStorage.getItem('wmg.save.v1') ?? 'null'),
}));
ok('REQ-035/count', stored.lb.records.length === 1, `胜利写入 1 条排行榜记录（实际 ${stored.lb.records.length}）`);
const rec = stored.lb.records[0];
ok('REQ-035/fields', rec.levelId === 1 && rec.score === final.score && rec.stars >= 1 && rec.movesUsed === 20 - final.movesLeft
  && typeof rec.id === 'string' && typeof rec.seed === 'number' && !Number.isNaN(Date.parse(rec.achievedAt)),
  `记录=${JSON.stringify(rec)}`);
ok('REQ-026/stars', rec.stars === (final.score >= 2600 ? 3 : final.score >= 2000 ? 2 : 1), `星级=${rec.stars}，分数=${final.score}（阈值 2000/2600）`);
ok('REQ-030/unlock', stored.save.unlockedLevelId === 2, `通关后 unlockedLevelId=${stored.save.unlockedLevelId}`);

// 排行榜界面
await page.locator('#panel-result .btn', { hasText: '返回选关' }).click();
await page.waitForSelector('#screen-level-select');
await page.locator('#screen-level-select .header-actions .btn[aria-label="排行榜"]').click();
await page.waitForSelector('#panel-leaderboard:not(.hidden)');
const lbText = await page.locator('#panel-leaderboard').textContent();
ok('REQ-034/ui', (lbText ?? '').includes('本地排行榜'), '排行榜界面标题为「本地排行榜」');
for (const w of ['全球', '在线', '全服', '服务器排名']) ok(`REQ-034/banned-${w}`, !(lbText ?? '').includes(w), `界面不含禁用词「${w}」`);
const row = page.locator('#panel-leaderboard tbody tr').first();
const rowText = await row.textContent();
ok('REQ-037/row', (rowText ?? '').includes('第 1 关') && (rowText ?? '').includes(String(final.score)) && (rowText ?? '').includes('★'),
  `首行=${JSON.stringify(rowText)}（含关卡名/分数/星级）`);
ok('REQ-037/limit-text', (lbText ?? '').includes('单关最多 10 条'), '展示条数上限说明');
await page.screenshot({ path: '.qa-verify/out/E2-leaderboard.png' });

// 刷新后进度与排行榜保留、第 2 关解锁
await page.reload({ waitUntil: 'networkidle' });
await page.waitForSelector('#screen-level-select .level-card');
const unlocked = await page.locator('#screen-level-select .level-card:not(.locked)').count();
const lbAfter = await page.evaluate(() => JSON.parse(localStorage.getItem('wmg.leaderboard.v1') ?? 'null').records.length);
ok('REQ-030/persist', unlocked === 2 && lbAfter === 1, `刷新后已解锁关卡数=${unlocked}，排行榜记录数=${lbAfter}`);
ok('REQ-051/pageerror', errors.length === 0, `pageerror=${JSON.stringify(errors)}`);

// 失败路径：不写排行榜（第 2 关用尽步数）
await page.locator('#screen-level-select .level-card[data-level-id="2"]').click();
await page.waitForSelector('#screen-game:not(.hidden)');
for (let i = 0; i < 40; i += 1) {
  const st = await page.evaluate(() => window.__wmgTest.state());
  if (st.status !== 'playing') break;
  const move = await page.evaluate(() => window.__wmgTest.findMove());
  if (!move) break;
  await page.evaluate(({ a, b }) => window.__wmgTest.swap(a, b), move);
  for (let k = 0; k < 80; k += 1) {
    const cur = await page.evaluate(() => window.__wmgTest.state());
    if (cur.status === 'playing' || cur.status === 'won' || cur.status === 'lost') break;
    await page.waitForTimeout(100);
  }
  await page.waitForTimeout(100);
}
const st2 = await page.evaluate(() => window.__wmgTest.state());
const lb2 = await page.evaluate(() => JSON.parse(localStorage.getItem('wmg.leaderboard.v1') ?? 'null').records.length);
ok('REQ-035/lose-no-write', st2.status !== 'won' ? lb2 === 1 : lb2 === 2,
  `第 2 关结束 status=${st2.status}，排行榜记录数=${lb2}（失败不写入）`);
await browser.close();
const failed = results.filter((r) => !r.pass);
console.log(`\nSUMMARY total=${results.length} pass=${results.length - failed.length} fail=${failed.length}`);
for (const f of failed) console.log('FAILED:', f.id, '::', f.detail);
process.exit(failed.length ? 1 : 0);

