import { chromium } from '@playwright/test';
const browser = await chromium.launch({ channel: 'chrome' });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
const page = await ctx.newPage();
await page.goto('http://127.0.0.1:5055/', { waitUntil: 'networkidle' });
await page.locator('#screen-level-select .level-card[data-level-id="1"]').click();
await page.waitForTimeout(600);
const info = await page.evaluate(() => {
  const c = document.getElementById('game');
  const ctx = c.getContext('2d');
  const k = c.width / 960;
  const cells = [];
  for (let row = 1; row <= 8; row++) {
    for (let col = 1; col <= 8; col++) {
      const counts = new Map();
      for (let dx = -24; dx <= 24; dx += 2) for (let dy = -24; dy <= 24; dy += 2) {
        const x = Math.round((224 + (col - .5) * 64 + dx) * k);
        const y = Math.round((96 + (row - .5) * 64 + dy) * k);
        const p = ctx.getImageData(x, y, 1, 1).data;
        if (p[3] < 200) continue;
        const key = `${p[0] >> 4},${p[1] >> 4},${p[2] >> 4}`;
        counts.set(key, (counts.get(key) || 0) + 1);
      }
      const top = [...counts.entries()].sort((a,b)=>b[1]-a[1]).slice(0,3);
      cells.push({ row, col, top: top.map(([k2,n]) => `${k2}:${n}`) });
    }
  }
  return { backing: [c.width, c.height], cells };
});
console.log('backing', info.backing);
for (const cell of info.cells.slice(0, 16)) console.log(cell.row, cell.col, cell.top.join(' | '));
await page.screenshot({ path: '.qa-verify/out/probe-board.png' });
await browser.close();
