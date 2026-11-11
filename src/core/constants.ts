/**
 * Numeric constants shared by core and render.
 * Every value is traced to spec chapter 5 / appendix A of plan.md.
 */
import type { TileKind } from './types';

// spec 5.1 - board & render
export const BOARD_COLS = 8;
export const BOARD_ROWS = 8;
export const CELL_SIZE = 64;
export const BOARD_SIZE = 512;
export const CANVAS_W = 960;
export const CANVAS_H = 720;
export const BOARD_X = 224;
export const BOARD_Y = 96;

// spec 5.1 - tile inventory order is normative (tie-breaks use it)
export const TILE_KINDS: readonly TileKind[] = [
  'star',
  'water',
  'leaf',
  'flame',
  'crystal',
  'bolt',
];
export const TILE_KINDS_L5: readonly TileKind[] = ['star', 'water', 'leaf', 'flame', 'bolt'];

export const TILE_COLORS: Readonly<Record<TileKind, string>> = {
  star: '#F2C230',
  water: '#3AA0E8',
  leaf: '#57C24A',
  flame: '#E8503A',
  crystal: '#9B59D0',
  bolt: '#23C4C4',
};

// spec 5.1 - generation
export const INITIAL_RETRY_LIMIT = 1000;

// spec 5.6 / REQ-016
export const SHUFFLE_RETRY_LIMIT = 100;
export const SHUFFLE_TOAST_MS = 2000;
export const LOW_MOVES_THRESHOLD = 3;

// spec 5.3 - scoring
export const BASE_SCORE = 60;
export const BONUS_4 = 50;
export const BONUS_5 = 120;
export const SPECIAL_EXTRA = 30;
export const MULTIPLIER_MAX = 4.0;
export const CASCADE_GUARD = 1000;

// spec 5.2 / REQ-044 - animation durations
export const SWAP_MS = 150;
export const REVERT_MS = 200;
export const CLEAR_MS = 180;
export const FALL_MS = 160;
export const SPECIAL_MS = 300;
export const PANEL_FADE_MS = 200;
export const REDUCED_MOTION_MAX_MS = 100;
export const PANEL_INPUT_LOCK_MS = 300;

// REQ-003 / REQ-049 (CR-003)
export const DRAG_THRESHOLD_CELL_RATIO = 0.5;
export const HOTZONE_BREAKPOINT_CSS_PX = 600;
export const HOTZONE_MIN_CELL_CSS_PX = 40;

// REQ-041
export const DPR_MAX = 2;

// REQ-029 / REQ-030 (CR-004)
export const SAVE_VERSION = 1;
export const SAVE_WRITE_POINTS = 4;
export const LAST_SESSION_INTERRUPTED_DEFAULT = false;
export const CORRUPT_TOAST_MS = 5000;
export const RESET_TOAST_MS = 3000;

// REQ-037
export const LEADERBOARD_PER_LEVEL = 10;
export const LEADERBOARD_TOTAL = 20;

// REQ-047 / REQ-046
export const BGM_DEFAULT_VOLUME = 60;
export const SFX_DEFAULT_VOLUME = 80;
export const SFX_THROTTLE_MS = 100;

export const MAX_STARS = 3;
export const CASCADE_FIRST = 1;
