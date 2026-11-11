/** 13 个音效事件 → 资源名（REQ-046；plan 14.2）。 */
export const SFX_MAP = {
  swap: 'sfx-swap',
  invalid: 'sfx-invalid',
  match: 'sfx-match',
  cascade: 'sfx-cascade',
  'special-line': 'sfx-special-line',
  'special-rainbow': 'sfx-special-rainbow',
  'ice-break': 'sfx-ice-break',
  'stone-break': 'sfx-stone-break',
  shuffle: 'sfx-shuffle',
  star: 'sfx-star',
  win: 'sfx-win',
  lose: 'sfx-lose',
  click: 'sfx-click',
} as const;

export type SfxEvent = keyof typeof SFX_MAP;
export const SFX_EVENTS = Object.keys(SFX_MAP) as SfxEvent[];
export const BGM_NAME = 'bgm-main';

export function sfxFile(event: SfxEvent, format: 'ogg' | 'mp3'): string {
  return `${SFX_MAP[event]}.${format}`;
}
