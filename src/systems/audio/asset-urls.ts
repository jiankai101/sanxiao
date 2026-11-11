const ASSET_URLS = import.meta.glob('../../../assets/*.{webp,png,svg,ogg,mp3}', {
  eager: true,
  query: '?url',
  import: 'default',
}) as Record<string, string>;

export function assetUrl(fileName: string): string | undefined {
  const suffix = `/${fileName}`;
  for (const [path, url] of Object.entries(ASSET_URLS)) {
    if (path.endsWith(suffix)) return url;
  }
  return undefined;
}

/** OGG 优先，Safari 回退 MP3（plan 14.3）；同一逻辑文件双格式。 */
export function pickAudioFile(name: string, canPlay: (type: string) => boolean): string | null {
  const ogg = assetUrl(`${name}.ogg`);
  if (ogg && canPlay('audio/ogg; codecs="vorbis"')) return ogg;
  const mp3 = assetUrl(`${name}.mp3`);
  if (mp3) return mp3;
  return ogg ?? null;
}
