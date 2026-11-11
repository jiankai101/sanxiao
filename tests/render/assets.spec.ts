import { describe, expect, it, vi } from 'vitest';
import { AUDIO_FILES, IMAGE_FILES, TILE_IMAGE_BY_KIND, assetManifest, createAssetStore } from '../../src/render/assets';
import { PLACEHOLDER_STYLES } from '../../src/render/placeholders';
import { TILE_COLORS } from '../../src/core/constants';

const SPEC_IMAGES = [
  'bg-main.webp', 'board-frame.webp', 'cell-empty.webp',
  'tile-star.webp', 'tile-water.webp', 'tile-leaf.webp', 'tile-flame.webp', 'tile-crystal.webp', 'tile-bolt.webp',
  'tile-select.webp', 'special-line-h.webp', 'special-line-v.webp', 'special-rainbow.webp',
  'obs-ice.webp', 'obs-stone-2.webp', 'obs-stone-1.webp', 'obs-hole.webp', 'fx-clear.webp', 'ui-panel.webp',
  'icon-star-on.svg', 'icon-star-off.svg', 'icon-play.svg', 'icon-pause.svg', 'icon-restart.svg', 'icon-back.svg',
  'icon-lock.svg', 'icon-sound-on.svg', 'icon-sound-off.svg', 'icon-music-on.svg', 'icon-music-off.svg',
  'icon-settings.svg', 'icon-trophy.svg', 'icon-close.svg',
];

describe('REQ-039/042 asset manifest & fallback', () => {
  it('covers all 33 image files from spec 10.1 with no duplicates', () => {
    expect(IMAGE_FILES).toHaveLength(33);
    expect(new Set(IMAGE_FILES).size).toBe(33);
    expect(IMAGE_FILES.slice().sort()).toEqual(SPEC_IMAGES.slice().sort());
    expect(assetManifest().images).toBe(33);
    expect(assetManifest().loadedImages).toBe(33);
    expect(assetManifest().loadedAudio).toBe(28);
    expect(Object.values(TILE_IMAGE_BY_KIND)).toHaveLength(6);
  });

  it('covers 14 sounds in OGG and MP3 (28 files)', () => {
    expect(AUDIO_FILES).toHaveLength(28);
    expect(AUDIO_FILES.filter((name) => name.endsWith('.ogg'))).toHaveLength(14);
    expect(AUDIO_FILES.filter((name) => name.endsWith('.mp3'))).toHaveLength(14);
    expect(AUDIO_FILES).toContain('bgm-main.ogg');
    expect(AUDIO_FILES).toContain('sfx-click.mp3');
  });

  it('falls back to a placeholder and warns only once when a 404 happens', async () => {
    const logger = { warn: vi.fn() };
    const store = createAssetStore({ urls: { 'tile-star.webp': '/missing/tile-star.webp' }, logger, loader: () => Promise.reject(new Error('404')) });
    const first = await store.loadImage('tile-star.webp');
    const second = await store.loadImage('tile-water.webp');
    expect(first.ok).toBe(false);
    expect(first.placeholder?.color).toBe(TILE_COLORS.star);
    expect(second.ok).toBe(false);
    expect(second.placeholder?.shape).toBe('drop');
    expect(logger.warn).toHaveBeenCalledTimes(1);
    expect(store.warnedOnce).toBe(true);
  });

  it('does not throw when an asset has no URL at all', async () => {
    const logger = { warn: vi.fn() };
    const store = createAssetStore({ urls: {}, logger });
    const loaded = await store.loadImage('tile-bolt.webp');
    expect(loaded.ok).toBe(false);
    expect(loaded.placeholder?.shape).toBe('bolt');
    expect(logger.warn).toHaveBeenCalledTimes(1);
  });

  it('provides six distinct placeholder shapes with the spec colours', () => {
    const shapes = Object.values(PLACEHOLDER_STYLES).map((style) => style.shape);
    expect(new Set(shapes).size).toBe(6);
    for (const kind of Object.keys(PLACEHOLDER_STYLES) as (keyof typeof PLACEHOLDER_STYLES)[]) {
      expect(PLACEHOLDER_STYLES[kind].color).toBe(TILE_COLORS[kind]);
      expect(PLACEHOLDER_STYLES[kind].symbol.length).toBeGreaterThan(0);
    }
  });
});

