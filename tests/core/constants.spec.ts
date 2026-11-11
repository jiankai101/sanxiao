import { describe, expect, it } from 'vitest';
import * as C from '../../src/core/constants';
import { multiplier } from '../../src/core/score/score';

describe('REQ-001/002/014/027/044 core constants', () => {
  it('board and render constants match plan appendix A', () => {
    expect(C.BOARD_COLS).toBe(8);
    expect(C.BOARD_ROWS).toBe(8);
    expect(C.CELL_SIZE).toBe(64);
    expect(C.BOARD_SIZE).toBe(512);
    expect(C.CANVAS_W).toBe(960);
    expect(C.CANVAS_H).toBe(720);
    expect(C.BOARD_X).toBe(224);
    expect(C.BOARD_Y).toBe(96);
    expect(C.INITIAL_RETRY_LIMIT).toBe(1000);
    expect(C.SHUFFLE_RETRY_LIMIT).toBe(100);
    expect(C.DPR_MAX).toBe(2);
    expect(C.LOW_MOVES_THRESHOLD).toBe(3);
    expect(C.SHUFFLE_TOAST_MS).toBe(2000);
  });

  it('tile inventory order and colours follow spec 5.1', () => {
    expect(C.TILE_KINDS).toEqual(['star', 'water', 'leaf', 'flame', 'crystal', 'bolt']);
    expect(C.TILE_KINDS_L5).toEqual(['star', 'water', 'leaf', 'flame', 'bolt']);
    expect(C.TILE_COLORS.star).toBe('#F2C230');
    expect(C.TILE_COLORS.water).toBe('#3AA0E8');
    expect(C.TILE_COLORS.leaf).toBe('#57C24A');
    expect(C.TILE_COLORS.flame).toBe('#E8503A');
    expect(C.TILE_COLORS.crystal).toBe('#9B59D0');
    expect(C.TILE_COLORS.bolt).toBe('#23C4C4');
  });

  it('scoring constants and multiplier sequence match REQ-014', () => {
    expect([C.BASE_SCORE, C.BONUS_4, C.BONUS_5, C.SPECIAL_EXTRA, C.MULTIPLIER_MAX]).toEqual([60, 50, 120, 30, 4]);
    const sequence = [1, 2, 3, 4, 5, 6, 7, 8].map((c) => multiplier(c));
    expect(sequence).toEqual([1, 1.5, 2, 2.5, 3, 3.5, 4, 4]);
  });

  it('animation constants match REQ-044', () => {
    expect([C.SWAP_MS, C.REVERT_MS, C.CLEAR_MS, C.FALL_MS, C.SPECIAL_MS, C.PANEL_FADE_MS]).toEqual([150, 200, 180, 160, 300, 200]);
    expect(C.REDUCED_MOTION_MAX_MS).toBe(100);
    expect(C.PANEL_INPUT_LOCK_MS).toBe(300);
  });

  it('persistence constants match REQ-029/030/037', () => {
    expect(C.SAVE_VERSION).toBe(1);
    expect(C.SAVE_WRITE_POINTS).toBe(4);
    expect(C.LAST_SESSION_INTERRUPTED_DEFAULT).toBe(false);
    expect(C.LEADERBOARD_PER_LEVEL).toBe(10);
    expect(C.LEADERBOARD_TOTAL).toBe(20);
    expect(C.BGM_DEFAULT_VOLUME).toBe(60);
    expect(C.SFX_DEFAULT_VOLUME).toBe(80);
    expect(C.SFX_THROTTLE_MS).toBe(100);
  });

  it('gesture and hotzone constants match CR-003', () => {
    expect(C.DRAG_THRESHOLD_CELL_RATIO).toBe(0.5);
    expect(C.HOTZONE_BREAKPOINT_CSS_PX).toBe(600);
    expect(C.HOTZONE_MIN_CELL_CSS_PX).toBe(40);
  });
});
