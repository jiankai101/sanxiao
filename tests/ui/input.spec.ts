import { describe, expect, it } from 'vitest';
import { BoardInput, type BoardInputEvent } from '../../src/ui/input/board-input';
import type { PointerSample } from '../../src/ui/input/pointer';
import type { CellCoord } from '../../src/systems/contracts';

const cell = (row: number, col: number): CellCoord => ({ row, col }) as CellCoord;

function sample(c: CellCoord | null, clientX: number, clientY: number, pointerId = 1): PointerSample {
  return { pointerId, pointerType: 'mouse', isPrimary: true, clientX, clientY, cell: c };
}

function setup(
  cellCssSize = 64,
  allowed = true,
  isSelectable?: (c: CellCoord) => boolean,
) {
  const events: BoardInputEvent[] = [];
  const input = new BoardInput({
    geometry: { cellCssSize: () => cellCssSize },
    emit: (e) => events.push(e),
    isInputAllowed: () => allowed,
    isSelectable,
  });
  return { input, events };
}

describe('REQ-003/REQ-004/REQ-049 拖拽与点击', () => {
  it('主轴位移 ≥0.5 格 → 向右交换', () => {
    const { input, events } = setup();
    input.press(sample(cell(1, 1), 100, 100));
    input.release(sample(cell(1, 1), 140, 104));
    expect(events.at(-1)).toEqual({ type: 'swap', a: cell(1, 1), b: cell(1, 2) });
  });

  it('位移 <0.5 格 → 点击选中；再次点击相邻格交换', () => {
    const { input, events } = setup();
    input.press(sample(cell(2, 2), 100, 100));
    input.release(sample(cell(2, 2), 110, 105));
    expect(events.at(-1)).toEqual({ type: 'select', cell: cell(2, 2) });

    input.press(sample(cell(2, 3), 180, 100));
    input.release(sample(cell(2, 3), 185, 101));
    expect(events.at(-1)).toEqual({ type: 'swap', a: cell(2, 2), b: cell(2, 3) });
    expect(input.selection).toBeNull();
  });

  // CR-010（spec v1.1.4）：同格点击＝取消选中、非相邻点击＝选中转移，两者都不构成交换尝试，
  // 因此都不发 invalid 事件（invalid 只保留给「相邻有效格交换后无匹配」的 B 类，由 app 判定并与 REQ-006 联动）。
  it('REQ-003 点击自身取消选中、点击非相邻普通格转移选中，均不发 invalid', () => {
    const { input, events } = setup();
    input.press(sample(cell(1, 1), 100, 100));
    input.release(sample(cell(1, 1), 101, 101));
    expect(input.selection).toEqual(cell(1, 1));

    const beforeDeselect = events.length;
    input.press(sample(cell(1, 1), 100, 100));
    input.release(sample(cell(1, 1), 101, 101));
    expect(events.at(-1)).toEqual({ type: 'deselect' });
    expect(events.slice(beforeDeselect).some((e) => e.type === 'invalid' || e.type === 'swap')).toBe(false);
    expect(input.selection).toBeNull();

    input.press(sample(cell(1, 1), 100, 100));
    input.release(sample(cell(1, 1), 100, 100));
    const beforeTransfer = events.length;
    input.press(sample(cell(4, 4), 300, 300));
    input.release(sample(cell(4, 4), 300, 300));
    expect(events.at(-1)).toEqual({ type: 'select', cell: cell(4, 4) });
    expect(events.slice(beforeTransfer).some((e) => e.type === 'invalid' || e.type === 'swap')).toBe(false);
    expect(input.selection).toEqual(cell(4, 4));
  });

  // CR-008 口径变更：spec v1.1.2 将「棋盘投影矩形外」归为 A 类「静默忽略」，
  // 原断言（invalid + 清空选中）来自 v1.1.1 的旧口径，现改为「无任何事件、选中不变」。
  it('棋盘外（吸附 null）→ 静默忽略：不发事件、不清除已有选中', () => {
    const { input, events } = setup();
    input.press(sample(cell(2, 2), 100, 100));
    input.release(sample(cell(2, 2), 101, 101));
    expect(input.selection).toEqual(cell(2, 2));
    const before = events.length;

    input.press(sample(null, 10, 10));
    input.release(sample(null, 10, 10));

    expect(events.length).toBe(before);
    expect(events.some((e) => e.type === 'invalid' || e.type === 'deselect' || e.type === 'swap')).toBe(false);
    expect(input.selection).toEqual(cell(2, 2));
  });

  it('从有效格拖出棋盘投影矩形（抬起吸附 null）→ 静默忽略，选中不变', () => {
    const { input, events } = setup();
    input.press(sample(cell(1, 1), 100, 100));
    input.release(sample(cell(1, 1), 101, 101));
    const before = events.length;

    input.press(sample(cell(1, 1), 100, 100));
    input.release(sample(null, 400, 100));

    expect(events.length).toBe(before + 1);
    expect(events.at(-1)).toEqual({ type: 'hover', cell: cell(1, 1) });
    expect(events.some((e) => e.type === 'invalid' || e.type === 'swap' || e.type === 'deselect')).toBe(false);
    expect(input.selection).toEqual(cell(1, 1));
  });

  it('拖拽目标越过棋盘边缘（1..8 越界）→ 静默忽略，无 invalid', () => {
    const { input, events } = setup();
    input.press(sample(cell(4, 8), 100, 100));
    input.release(sample(cell(4, 8), 160, 100));
    expect(events.some((e) => e.type === 'invalid' || e.type === 'swap')).toBe(false);
    expect(input.selection).toBeNull();
  });

  // REQ-049 / REQ-003：release 语义按主轴位移是否达 0.5 格判定，而不是看抬起点落在哪个格。
  // 边界场景：按下点贴近格边界，位移 0.4 格（< 0.5 格阈值）但已跨过中垂线进入相邻格；
  // 正确行为是按点击处理（点击目标＝抬起点吸附格），不得 emit invalid。
  it('位移 0.4 格但跨过中垂线（按下点贴近边界）→ 按点击处理：无选中时选中抬起格，无 invalid', () => {
    const { input, events } = setup(64);
    // 64px 格：阈值 32px；起点贴近边界，位移 25.6px = 0.4 格，抬起点吸附到相邻格 (2,3)。
    input.press(sample(cell(2, 2), 106, 100));
    input.release(sample(cell(2, 3), 131.6, 100));

    expect(events.at(-1)).toEqual({ type: 'select', cell: cell(2, 3) });
    expect(events.some((e) => e.type === 'invalid')).toBe(false);
    expect(input.selection).toEqual(cell(2, 3));
  });

  it('已选中 A + 边界点击相邻 B（位移 0.4 格跨中垂线）→ 交换 A↔B，无 invalid', () => {
    const { input, events } = setup(64);
    input.press(sample(cell(2, 2), 100, 100));
    input.release(sample(cell(2, 2), 100, 100));
    expect(input.selection).toEqual(cell(2, 2));
    const before = events.length;

    input.press(sample(cell(2, 2), 106, 100));
    input.release(sample(cell(2, 3), 131.6, 100));

    expect(events.slice(before)).toEqual([
      { type: 'hover', cell: cell(2, 2) },
      { type: 'swap', a: cell(2, 2), b: cell(2, 3) },
    ]);
    expect(events.some((e) => e.type === 'invalid')).toBe(false);
    expect(input.selection).toBeNull();
  });

  it('已选中 A + 边界小位移点击 A 自身 → 取消选中，无 invalid', () => {
    const { input, events } = setup(64);
    input.press(sample(cell(2, 3), 100, 100));
    input.release(sample(cell(2, 3), 100, 100));
    expect(input.selection).toEqual(cell(2, 3));
    const before = events.length;

    // 起点贴近边界，向格内移动 0.4 格，抬起点仍吸附 A 自身。
    input.press(sample(cell(2, 3), 138, 100));
    input.release(sample(cell(2, 3), 163.6, 100));

    expect(events.slice(before).at(-1)).toEqual({ type: 'deselect' });
    expect(events.some((e) => e.type === 'invalid')).toBe(false);
    expect(input.selection).toBeNull();
  });

  it('pointercancel 取消当前拖拽，不交换', () => {
    const { input, events } = setup();
    input.press(sample(cell(1, 1), 100, 100));
    input.cancel();
    input.release(sample(cell(1, 2), 200, 100));
    expect(events.some((e) => e.type === 'swap')).toBe(false);
  });

  it('斜向拖拽只取主轴（|dy|>|dx| → 垂直）', () => {
    const { input, events } = setup();
    input.press(sample(cell(1, 1), 100, 100));
    input.release(sample(cell(2, 1), 130, 170));
    expect(events.at(-1)).toEqual({ type: 'swap', a: cell(1, 1), b: cell(2, 1) });
  });

  it('阈值随 cellCssSize 缩放（64 → 32px；24 → 12px）', () => {
    const big = setup(64);
    big.input.press(sample(cell(1, 1), 100, 100));
    big.input.release(sample(cell(1, 1), 133, 100));
    expect(big.events.at(-1)).toEqual({ type: 'swap', a: cell(1, 1), b: cell(1, 2) });

    const small = setup(24);
    small.input.press(sample(cell(1, 1), 100, 100));
    small.input.release(sample(cell(1, 1), 111, 100));
    expect(small.events.at(-1)).toEqual({ type: 'select', cell: cell(1, 1) });
    small.input.press(sample(cell(1, 1), 100, 100));
    small.input.release(sample(cell(1, 1), 113, 100));
    expect(small.events.at(-1)).toEqual({ type: 'swap', a: cell(1, 1), b: cell(1, 2) });
  });

  it('settling / 面板锁定时忽略全部输入', () => {
    const { input, events } = setup(64, false);
    input.press(sample(cell(1, 1), 100, 100));
    input.release(sample(cell(1, 1), 200, 100));
    expect(events).toEqual([]);
  });
});

describe('REQ-049 blocked hit path (stone/hole ignored)', () => {
  const blocked = (c: CellCoord): boolean =>
    (c.row === 1 && c.col === 1) || (c.row === 3 && c.col === 3);
  const selectable = (c: CellCoord): boolean => !blocked(c);

  it('press/release on a stone cell emits nothing and selects nothing', () => {
    const { input, events } = setup(64, true, selectable);
    input.press(sample(cell(1, 1), 100, 100));
    input.release(sample(cell(1, 1), 100, 100));
    input.cancel();
    expect(events).toEqual([]);
    expect(input.selection).toBeNull();
  });

  it('press/release on a hole cell emits nothing and selects nothing', () => {
    const { input, events } = setup(64, true, selectable);
    input.press(sample(cell(3, 3), 200, 200));
    input.release(sample(cell(3, 3), 201, 201));
    expect(events).toEqual([]);
    expect(input.selection).toBeNull();
  });

  it('clicking a blocked cell keeps the existing selection (no invalid, no deselect)', () => {
    const { input, events } = setup(64, true, selectable);
    input.press(sample(cell(2, 2), 100, 100));
    input.release(sample(cell(2, 2), 101, 101));
    expect(input.selection).toEqual(cell(2, 2));

    input.press(sample(cell(1, 1), 200, 200));
    input.release(sample(cell(1, 1), 200, 200));
    expect(input.selection).toEqual(cell(2, 2));
    expect(events.some((e) => e.type === 'invalid' || e.type === 'deselect')).toBe(false);
    expect(events.at(-1)).toEqual({ type: 'select', cell: cell(2, 2) });
  });

  it('drag from a valid cell toward a blocked neighbor is ignored', () => {
    const dragBlocked = (c: CellCoord): boolean => c.row === 1 && c.col === 3;
    const { input, events } = setup(64, true, (c) => !dragBlocked(c));
    input.press(sample(cell(1, 2), 100, 100));
    input.release(sample(cell(1, 3), 140, 100));
    expect(events.some((e) => e.type === 'swap' || e.type === 'invalid')).toBe(false);
    expect(events.at(-1)).toEqual({ type: 'hover', cell: cell(1, 2) });
    expect(input.selection).toBeNull();
  });

  it('releasing over a blocked cell after a small move keeps selection and stays silent', () => {
    const { input, events } = setup(64, true, selectable);
    input.press(sample(cell(2, 2), 100, 100));
    input.release(sample(cell(2, 2), 101, 101));
    input.press(sample(cell(2, 2), 100, 100));
    input.release(sample(cell(3, 3), 110, 104));
    expect(input.selection).toEqual(cell(2, 2));
    expect(events.some((e) => e.type === 'invalid' || e.type === 'swap')).toBe(false);
  });

  it('a drag that ends on a blocked cell is ignored even past the drag threshold', () => {
    const dragBlocked = (c: CellCoord): boolean => c.row === 1 && c.col === 3;
    const { input, events } = setup(64, true, (c) => !dragBlocked(c));
    input.press(sample(cell(1, 1), 100, 100));
    input.release(sample(cell(1, 3), 200, 100));
    expect(events.some((e) => e.type === 'swap' || e.type === 'invalid')).toBe(false);
    expect(input.selection).toBeNull();
  });

  it('ice cells stay selectable and swappable', () => {
    const onlyStoneOrHole = (c: CellCoord): boolean => !blocked(c);
    const { input, events } = setup(64, true, onlyStoneOrHole);
    input.press(sample(cell(4, 4), 100, 100));
    input.release(sample(cell(4, 4), 101, 101));
    expect(input.selection).toEqual(cell(4, 4));

    input.press(sample(cell(4, 5), 180, 100));
    input.release(sample(cell(4, 5), 181, 101));
    expect(events.at(-1)).toEqual({ type: 'swap', a: cell(4, 4), b: cell(4, 5) });
    expect(input.selection).toBeNull();
  });
});
