import { expect, test, type Page } from '@playwright/test';

const VIEWPORTS = [
  { width: 1280, height: 800 },
  { width: 600, height: 800 },
  { width: 360, height: 640 },
  { width: 320, height: 568 },
];

async function instrument(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const w = window as any;
    w.__sfxStarts = [] as Array<{ dur: number | null; t: number }>;
    w.__fetches = [] as string[];
    try {
      const orig = AudioBufferSourceNode.prototype.start;
      AudioBufferSourceNode.prototype.start = function (...args: any[]) {
        try { w.__sfxStarts.push({ dur: this.buffer ? this.buffer.duration : null, t: performance.now() }); } catch {}
        return (orig as any).apply(this, args);
      };
    } catch (e) { w.__hookErr = String(e); }
    const of = window.fetch;
    window.fetch = function (...args: any[]) {
      try { w.__fetches.push(String(args[0])); } catch {}
      return (of as any).apply(window, args);
    };
  });
}

async function cellPoint(page: Page, row: number, col: number): Promise<{ x: number; y: number }> {
  const box = await page.locator('#game').boundingBox();
  if (!box) throw new Error('canvas not visible');
  const scale = box.width / 960;
  return { x: box.x + (224 + (col - 0.5) * 64) * scale, y: box.y + (96 + (row - 0.5) * 64) * scale };
}

async function outsidePoint(page: Page): Promise<{ x: number; y: number }> {
  const box = await page.locator('#game').boundingBox();
  if (!box) throw new Error('canvas not visible');
  const scale = box.width / 960;
  return { x: box.x + 100 * scale, y: box.y + 660 * scale };
}

async function boot(page: Page, vp: { width: number; height: number }, levelId: number, seed = 20261110): Promise<void> {
  await instrument(page);
  await page.setViewportSize(vp);
  await page.goto(`/?seed=${seed}`);
  await page.waitForFunction(() => Boolean((window as any).__wmgTest));
  await page.evaluate((id) => (window as any).__wmgTest.startLevel(id), levelId);
  await page.waitForTimeout(200);
}

async function snapshot(page: Page) {
  return page.evaluate(() => ({
    state: (window as any).__wmgTest.state(),
    selected: (window as any).__wmgTest.selected(),
    live: document.querySelector('#game-live')?.textContent ?? null,
    starts: ((window as any).__sfxStarts as Array<{ dur: number | null }>).slice(),
    fetches: ((window as any).__fetches as string[]).slice(),
  }));
}

const isInvalid = (dur: number | null): boolean => dur !== null && dur >= 0.14 && dur <= 0.16;
const isInvalidFetch = (u: string): boolean => /sfx-invalid[^/]*\.(ogg|mp3)(\?|$)/.test(u);

async function clickCell(page: Page, row: number, col: number): Promise<void> {
  const p = await cellPoint(page, row, col);
  await page.mouse.click(p.x, p.y);
}

for (const vp of VIEWPORTS) {
  const tag = `${vp.width}x${vp.height}`;

  test(`G7 ${tag} A-outside silent: no invalid audio/aria, selection+moves+score unchanged`, async ({ page }) => {
    await boot(page, vp, 1);
    await clickCell(page, 1, 1);
    const before = await snapshot(page);
    expect(before.selected).toEqual({ row: 1, col: 1 });

    const p = await outsidePoint(page);
    await page.mouse.click(p.x, p.y);
    await page.waitForTimeout(350);
    const after = await snapshot(page);

    expect(after.selected).toEqual(before.selected);
    expect(after.state.movesLeft).toBe(before.state.movesLeft);
    expect(after.state.score).toBe(before.state.score);
    expect(after.live).toBe(before.live);
    expect(after.starts.slice(before.starts.length).filter((s) => isInvalid(s.dur))).toEqual([]);
    expect(after.fetches.slice(before.fetches.length).filter(isInvalidFetch)).toEqual([]);
  });

  test(`G7 ${tag} A-stone silent: no invalid audio/aria, selection+moves+score unchanged`, async ({ page }) => {
    await boot(page, vp, 5);
    await clickCell(page, 1, 1);
    const before = await snapshot(page);
    expect(before.selected).toEqual({ row: 1, col: 1 });

    await clickCell(page, 2, 2);
    await page.waitForTimeout(350);
    const after = await snapshot(page);

    expect(after.selected).toEqual(before.selected);
    expect(after.state.movesLeft).toBe(before.state.movesLeft);
    expect(after.state.score).toBe(before.state.score);
    expect(after.live).toBe(before.live);
    expect(after.starts.slice(before.starts.length).filter((s) => isInvalid(s.dur))).toEqual([]);
    expect(after.fetches.slice(before.fetches.length).filter(isInvalidFetch)).toEqual([]);
  });

  test(`G7 ${tag} A-hole silent: no invalid audio/aria, selection+moves+score unchanged`, async ({ page }) => {
    await boot(page, vp, 8);
    await clickCell(page, 1, 1);
    const before = await snapshot(page);
    expect(before.selected).toEqual({ row: 1, col: 1 });

    await clickCell(page, 3, 3);
    await page.waitForTimeout(350);
    const after = await snapshot(page);

    expect(after.selected).toEqual(before.selected);
    expect(after.state.movesLeft).toBe(before.state.movesLeft);
    expect(after.state.score).toBe(before.state.score);
    expect(after.live).toBe(before.live);
    expect(after.starts.slice(before.starts.length).filter((s) => isInvalid(s.dur))).toEqual([]);
    expect(after.fetches.slice(before.fetches.length).filter(isInvalidFetch)).toEqual([]);
  });

  test(`G7 ${tag} B-nonadjacent: plays invalid sfx, no move/score change`, async ({ page }) => {
    await boot(page, vp, 1);
    await clickCell(page, 1, 1);
    const before = await snapshot(page);
    expect(before.selected).toEqual({ row: 1, col: 1 });

    await clickCell(page, 1, 8);
    await page.waitForTimeout(350);
    const after = await snapshot(page);

    expect(after.state.movesLeft).toBe(before.state.movesLeft);
    expect(after.state.score).toBe(before.state.score);
    expect(after.starts.slice(before.starts.length).filter((s) => isInvalid(s.dur)).length).toBeGreaterThanOrEqual(1);
    expect(after.fetches.slice(before.fetches.length).filter(isInvalidFetch).length).toBeGreaterThanOrEqual(1);
  });

  test(`G7 ${tag} B-same-cell: plays invalid sfx, no move/score change`, async ({ page }) => {
    await boot(page, vp, 1);
    await clickCell(page, 1, 1);
    const before = await snapshot(page);
    expect(before.selected).toEqual({ row: 1, col: 1 });

    await clickCell(page, 1, 1);
    await page.waitForTimeout(350);
    const after = await snapshot(page);

    expect(after.selected).toBeNull();
    expect(after.state.movesLeft).toBe(before.state.movesLeft);
    expect(after.state.score).toBe(before.state.score);
    expect(after.starts.slice(before.starts.length).filter((s) => isInvalid(s.dur)).length).toBeGreaterThanOrEqual(1);
    expect(after.fetches.slice(before.fetches.length).filter(isInvalidFetch).length).toBeGreaterThanOrEqual(1);
  });

  test(`G7 ${tag} B-no-match: plays invalid sfx, no move/score change`, async ({ page }) => {
    await boot(page, vp, 1);
    await clickCell(page, 1, 1);
    const before = await snapshot(page);

    await clickCell(page, 1, 2);
    await page.waitForTimeout(700);
    const after = await snapshot(page);

    expect(after.state.movesLeft).toBe(before.state.movesLeft);
    expect(after.state.score).toBe(before.state.score);
    expect(after.starts.slice(before.starts.length).filter((s) => isInvalid(s.dur)).length).toBeGreaterThanOrEqual(1);
    expect(after.fetches.slice(before.fetches.length).filter(isInvalidFetch).length).toBeGreaterThanOrEqual(1);
  });
}
