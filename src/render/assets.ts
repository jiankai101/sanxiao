/// <reference types="vite/client" />
/**
 * Static asset lookup + graceful placeholder fallback (REQ-039, REQ-042).
 * All files are same-origin build assets; nothing is fetched at runtime by logic.
 */
import { PLACEHOLDER_STYLES } from './placeholders';
import type { PlaceholderStyle } from './placeholders';
import type { TileKind } from '../core/types';

const modules = import.meta.glob('../../assets/*.{webp,png,svg,ogg,mp3}', {
  eager: true,
  query: '?url',
  import: 'default',
}) as Record<string, string>;

const urlByFile: Record<string, string> = {};
for (const [path, url] of Object.entries(modules)) {
  const name = path.split('/').pop();
  if (name) urlByFile[name] = url;
}

/** spec 10.1 - 33 image files, order preserved for reports. */
export const IMAGE_FILES: readonly string[] = [
  'bg-main.webp',
  'board-frame.webp',
  'cell-empty.webp',
  'tile-star.webp',
  'tile-water.webp',
  'tile-leaf.webp',
  'tile-flame.webp',
  'tile-crystal.webp',
  'tile-bolt.webp',
  'tile-select.webp',
  'special-line-h.webp',
  'special-line-v.webp',
  'special-rainbow.webp',
  'obs-ice.webp',
  'obs-stone-2.webp',
  'obs-stone-1.webp',
  'obs-hole.webp',
  'fx-clear.webp',
  'ui-panel.webp',
  'icon-star-on.svg',
  'icon-star-off.svg',
  'icon-play.svg',
  'icon-pause.svg',
  'icon-restart.svg',
  'icon-back.svg',
  'icon-lock.svg',
  'icon-sound-on.svg',
  'icon-sound-off.svg',
  'icon-music-on.svg',
  'icon-music-off.svg',
  'icon-settings.svg',
  'icon-trophy.svg',
  'icon-close.svg',
];

/** spec 10.2 - 14 sounds x 2 formats = 28 audio files. */
export const AUDIO_BASENAMES: readonly string[] = [
  'bgm-main',
  'sfx-swap',
  'sfx-invalid',
  'sfx-match',
  'sfx-cascade',
  'sfx-special-line',
  'sfx-special-rainbow',
  'sfx-ice-break',
  'sfx-stone-break',
  'sfx-shuffle',
  'sfx-star',
  'sfx-win',
  'sfx-lose',
  'sfx-click',
];

export const AUDIO_FILES: readonly string[] = AUDIO_BASENAMES.flatMap((name) => [`${name}.ogg`, `${name}.mp3`]);

export const TILE_IMAGE_BY_KIND: Readonly<Record<TileKind, string>> = {
  star: 'tile-star.webp',
  water: 'tile-water.webp',
  leaf: 'tile-leaf.webp',
  flame: 'tile-flame.webp',
  crystal: 'tile-crystal.webp',
  bolt: 'tile-bolt.webp',
};

export function assetUrl(name: string): string | undefined {
  return urlByFile[name];
}

export function assetManifest(): { images: number; audio: number; loadedImages: number; loadedAudio: number } {
  return {
    images: IMAGE_FILES.length,
    audio: AUDIO_FILES.length,
    loadedImages: IMAGE_FILES.filter((name) => urlByFile[name] !== undefined).length,
    loadedAudio: AUDIO_FILES.filter((name) => urlByFile[name] !== undefined).length,
  };
}

export interface LoadedImage {
  name: string;
  ok: boolean;
  url: string | undefined;
  image: unknown;
  placeholder: PlaceholderStyle | null;
}

export type ImageLoader = (url: string) => Promise<unknown>;

export interface AssetStoreOptions {
  loader?: ImageLoader;
  logger?: { warn: (message: string) => void };
  urls?: Readonly<Record<string, string | undefined>>;
}

const defaultLoader: ImageLoader = (url) =>
  new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error(`failed to load ${url}`));
    image.src = url;
  });

const defaultLogger = { warn: (message: string) => console.warn(message) };

export class AssetStore {
  private readonly loader: ImageLoader;
  private readonly logger: { warn: (message: string) => void };
  private readonly urls: Readonly<Record<string, string | undefined>> | null;
  private warned = false;

  constructor(options: AssetStoreOptions = {}) {
    this.loader = options.loader ?? defaultLoader;
    this.logger = options.logger ?? defaultLogger;
    this.urls = options.urls ?? null;
  }

  get warnedOnce(): boolean {
    return this.warned;
  }

  url(name: string): string | undefined {
    if (this.urls) return this.urls[name];
    return assetUrl(name);
  }

  warnMissing(name: string): void {
    if (this.warned) return;
    this.warned = true;
    this.logger.warn(`[assets] image unavailable, using placeholder: ${name}`);
  }

  placeholderFor(name: string): PlaceholderStyle {
    const kind = Object.entries(TILE_IMAGE_BY_KIND).find(([, file]) => file === name)?.[0] as TileKind | undefined;
    return kind ? PLACEHOLDER_STYLES[kind] : PLACEHOLDER_STYLES.star;
  }

  async loadImage(name: string): Promise<LoadedImage> {
    const url = this.url(name);
    if (!url) {
      this.warnMissing(name);
      return { name, ok: false, url, image: null, placeholder: this.placeholderFor(name) };
    }
    try {
      const image = await this.loader(url);
      return { name, ok: true, url, image, placeholder: null };
    } catch {
      this.warnMissing(name);
      return { name, ok: false, url, image: null, placeholder: this.placeholderFor(name) };
    }
  }
}

export function createAssetStore(options: AssetStoreOptions = {}): AssetStore {
  return new AssetStore(options);
}
