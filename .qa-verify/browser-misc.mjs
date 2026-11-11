/** G5 浏览器验收（生产构建）：资源降级/音频/色盲/设置持久化/键盘可达/性能/首屏体积。 */
import { chromium } from '@playwright/test';
const BASE = 'http://127.0.0.1:5055/';
const results = [];
const ok = (id, cond, detail) => { results.push({ id, pass: !!cond, detail }); console.log(`${cond ? 'PASS' : 'FAIL'} ${id} :: ${detail}`); };
const browser = await chromium.launch({ channel: 'chrome' });

// ---- 1. 首屏体积 / 请求时机 / BGM 延迟到手势 ----
{
  const ctx = await browser.newContext({ viewport: { width: 960, height: 720 } });
  const page = await ctx.newPage();
  const audioReqs = [];
  let bytes = 0;
  page.on('request', (r) => { if (/\.(ogg|mp3)(\?|$)/.test(r.url())) audioReqs.push(r.url()); });
  page.on('response', async (r) => {
    const len = Number(r.headers()['content-length'] ?? 0);
    if (Number.isFinite(len)) bytes += len;
  });
  await page.goto(BASE, { waitUntil: 'networkidle' });
  await page.waitForSelector('#screen-level-select .level-card');
  ok('REQ-045/lazy-bgm', audioReqs.length === 0, `首屏（未发生手势）音频请求数=${audioReqs.length}`);
  ok('REQ-051/first-screen', bytes > 0 && bytes <= 3.0 * 1024 * 1024, `首屏传输=${(bytes / 1024).toFixed(1)} KB（≤ 3.0 MB）`);
  await page.locator('#screen-level-select .level-card[data-level-id="1"]').click();
  await page.waitForTimeout(1200);
  ok('REQ-045/gesture-bgm', audioReqs.length > 0, `首次手势后音频请求=${audioReqs.map((u) => u.split('/').pop()).join(',')}`);

  // 键盘可达：Tab 聚焦关卡卡 + Enter 激活
  await page.locator('#btn-back').click();
  await page.waitForSelector('#screen-level-select');
  await page.evaluate(() => document.body.focus());
  let focused = '';
  for (let i = 0; i < 12; i += 1) {
    await page.keyboard.press('Tab');
    focused = await page.evaluate(() => document.activeElement?.getAttribute('aria-label') ?? document.activeElement?.className ?? '');
    if (focused.includes('起步')) break;
  }
  await page.keyboard.press('Enter');
  await page.waitForTimeout(600);
  ok('REQ-049/keyboard', await page.locator('#screen-game').isVisible(), `Tab 聚焦「${focused}」后 Enter 进入对局`);

  // DOM 按钮热区 ≥44×44
  await page.locator('#btn-pause').click();
  await page.waitForSelector('#panel-pause:not(.hidden)');
  const sizes = await page.evaluate(() => {
    return [...document.querySelectorAll('button')].filter((b) => b.offsetParent !== null).map((b) => {
      const r = b.getBoundingClientRect();
      return { label: b.getAttribute('aria-label') || b.textContent, w: Math.round(r.width), h: Math.round(r.height) };
    });
  });
  const small = sizes.filter((s) => s.w < 44 || s.h < 44);
  ok('REQ-049/dom-44', small.length === 0, `可见按钮 ${sizes.length} 个，<44px 的 ${small.length} 个 ${JSON.stringify(small.slice(0, 3))}`);
  await page.locator('#panel-pause .btn', { hasText: '继续' }).click().catch(() => {});
  await ctx.close();
}

// ---- 2. 色盲模式 + 设置持久化 ----
{
  const ctx = await browser.newContext({ viewport: { width: 960, height: 720 } });
  const page = await ctx.newPage();
  await page.goto(BASE, { waitUntil: 'networkidle' });
  await page.waitForSelector('#screen-level-select .level-card');
  const before = await page.locator('#game').screenshot();
  await page.locator('#screen-level-select .header-actions .btn[aria-label="设置"]').click();
  await page.waitForSelector('#panel-settings:not(.hidden)');
  await page.locator('#set-colorblindMode').check();
  await page.locator('#set-bgmVolume').fill('5');
  await page.locator('#set-bgmVolume').dispatchEvent('change');
  await page.locator('#set-reducedMotion').check();
  await page.waitForTimeout(300);
  await page.locator('#panel-settings .btn', { hasText: '关闭' }).click();
  await page.locator('#screen-level-select .level-card[data-level-id="1"]').click();
  await page.waitForTimeout(700);
  const after = await page.locator('#game').screenshot();
  ok('REQ-043/toggle', Buffer.compare(before, after) !== 0, `开启色盲模式后画布像素发生变化（${before.length} → ${after.length} bytes）`);
  await page.screenshot({ path: '.qa-verify/out/F1-colorblind.png' });
  const save = await page.evaluate(() => JSON.parse(localStorage.getItem('wmg.save.v1')));
  ok('REQ-043/persist', save.settings.colorblindMode === true, `存档 settings.colorblindMode=${save.settings.colorblindMode}`);
  ok('REQ-047/persist', save.settings.bgmVolume === 5 && save.settings.reducedMotion === true,
    `存档 bgmVolume=${save.settings.bgmVolume}、reducedMotion=${save.settings.reducedMotion}`);
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForSelector('#screen-level-select .level-card');
  await page.locator('#screen-level-select .header-actions .btn[aria-label="设置"]').click();
  await page.waitForSelector('#panel-settings:not(.hidden)');
  const cb = await page.locator('#set-colorblindMode').isChecked();
  const vol = await page.locator('#set-bgmVolume').inputValue();
  ok('REQ-047/reload', cb === true && vol === '5', `刷新后色盲=${cb}、BGM 音量=${vol}`);
  await ctx.close();
}

// ---- 3. 图片加载失败降级（REQ-042） ----
{
  const ctx = await browser.newContext({ viewport: { width: 960, height: 720 } });
  const page = await ctx.newPage();
  const warns = [];
  page.on('console', (m) => { if (m.type() === 'warning') warns.push(m.text()); });
  await page.route('**/tile-star*.webp', (route) => route.abort());
  await page.route('**/tile-leaf*.webp', (route) => route.abort());
  await page.goto(BASE, { waitUntil: 'networkidle' });
  await page.waitForSelector('#screen-level-select .level-card');
  await page.locator('#screen-level-select .level-card[data-level-id="1"]').click();
  await page.waitForTimeout(900);
  const placeholderWarns = warns.filter((w) => w.includes('placeholder') || w.includes('assets'));
  ok('REQ-042/warn-once', placeholderWarns.length <= 1, `图片失败 console.warn 条数=${placeholderWarns.length}：${JSON.stringify(placeholderWarns)}`);
  const nonBlank = await page.evaluate(() => {
    const c = document.getElementById('game');
    const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
    let n = 0;
    for (let i = 3; i < d.length; i += 4000) if (d[i] > 0) n += 1;
    return n;
  });
  ok('REQ-042/render', nonBlank > 0, `缺图后仍渲染（采样非透明点 ${nonBlank}）`);
  await page.screenshot({ path: '.qa-verify/out/F2-missing-image.png' });
  const hudBefore = Number(await page.locator('#hud-moves').textContent());
  const b = await page.locator('#game').boundingBox();
  const s = b.width / 960;
  await page.mouse.move(b.x + (224 + 2.5 * 64) * s, b.y + (96 + 0.5 * 64) * s);
  await page.mouse.down();
  await page.mouse.move(b.x + (224 + 3.5 * 64) * s, b.y + (96 + 0.5 * 64) * s, { steps: 6 });
  await page.mouse.up();
  await page.waitForTimeout(900);
  const hudAfter = Number(await page.locator('#hud-moves').textContent());
  ok('REQ-042/playable', hudAfter <= hudBefore, `缺图后仍可操作（步数 ${hudBefore} → ${hudAfter}）`);
  await ctx.close();
}

// ---- 4. 音频失败降级（REQ-048） ----
{
  const ctx = await browser.newContext({ viewport: { width: 960, height: 720 } });
  const page = await ctx.newPage();
  await page.route('**/*.{ogg,mp3}', (route) => route.abort());
  await page.goto(BASE, { waitUntil: 'networkidle' });
  await page.waitForSelector('#screen-level-select .level-card');
  await page.locator('#screen-level-select .level-card[data-level-id="1"]').click();
  await page.waitForTimeout(2000);
  const badge = await page.locator('#audio-badge').isVisible();
  ok('REQ-048/badge', badge, `音频资源加载失败时显示「音频不可用」标记=${badge}`);
  ok('REQ-048/playable', Number(await page.locator('#hud-moves').textContent()) === 20, '音频失败不影响开局');
  await page.screenshot({ path: '.qa-verify/out/F3-audio-unavailable.png' });
  await ctx.close();
}

// ---- 5. REQ-051 性能：10 秒对局帧间隔 ----
{
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await ctx.newPage();
  await page.goto(BASE, { waitUntil: 'networkidle' });
  await page.waitForSelector('#screen-level-select .level-card');
  await page.locator('#screen-level-select .level-card[data-level-id="1"]').click();
  await page.waitForTimeout(500);
  const perf = await page.evaluate(async () => {
    const intervals = [];
    let last = performance.now();
    const start = last;
    await new Promise((resolve) => {
      const tick = (t) => {
        intervals.push(t - last);
        last = t;
        if (t - start < 10000) requestAnimationFrame(tick);
        else resolve();
      };
      requestAnimationFrame(tick);
    });
    const sorted = intervals.slice(1).sort((a, b) => a - b);
    const p95 = sorted[Math.floor(sorted.length * 0.95)] ?? 0;
    const good = sorted.filter((v) => v <= 20.5).length / sorted.length;
    return { samples: sorted.length, p95, good };
  });
  ok('REQ-051/p95', perf.p95 <= 20, `10s 采样 ${perf.samples} 帧，p95 帧间隔=${perf.p95.toFixed(2)}ms（≤20ms）`);
  ok('REQ-051/fps', perf.good >= 0.95, `≥50fps 帧占比=${(perf.good * 100).toFixed(1)}%（≥95%）`);
  await ctx.close();
}

await browser.close();
const failed = results.filter((r) => !r.pass);
console.log(`\nSUMMARY total=${results.length} pass=${results.length - failed.length} fail=${failed.length}`);
for (const f of failed) console.log('FAILED:', f.id, '::', f.detail);
process.exit(failed.length ? 1 : 0);
