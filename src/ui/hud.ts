import type { GoalProgress, LevelConfig, TileKind } from '../systems/contracts';

export const TILE_LABELS: Record<TileKind, string> = {
  star: '星',
  water: '水滴',
  leaf: '叶',
  flame: '火',
  crystal: '晶',
  bolt: '电',
};

export interface GoalView {
  label: string;
  current: number;
  target: number;
  done: boolean;
  text: string;
}

export interface HudModel {
  score: number;
  moves: number;
  goals: GoalView[];
  lowMoves: boolean;
}

export interface HudInput {
  score: number;
  movesLeft: number;
  goals: readonly GoalProgress[];
  level?: LevelConfig;
}

function goalLabel(goalId: string, level?: LevelConfig): string {
  const goal = level?.goals.find((g) => g.id === goalId);
  if (!goal) {
    if (goalId === 'score') return '分数';
    if (goalId === 'ice') return '冰块';
    if (goalId === 'stone') return '石块';
    if (goalId.startsWith('collect-')) {
      const tile = goalId.slice('collect-'.length) as TileKind;
      return TILE_LABELS[tile] ?? tile;
    }
    return goalId;
  }
  if (goal.type === 'score') return '分数';
  if (goal.type === 'collect') return TILE_LABELS[goal.tile];
  return goal.obstacle === 'ice' ? '冰块' : '石块';
}

export function buildHudModel(input: HudInput): HudModel {
  const goals = input.goals.map((g) => {
    const label = goalLabel(g.goalId, input.level);
    return {
      label,
      current: g.current,
      target: g.target,
      done: g.done,
      text: `${label} ${g.current}/${g.target}`,
    };
  });
  return {
    score: input.score,
    moves: input.movesLeft,
    goals,
    lowMoves: input.movesLeft > 0 && input.movesLeft <= 3,
  };
}

export function formatProgress(goals: readonly GoalView[]): string {
  return goals.length === 0 ? '无' : goals.map((g) => g.text).join('；');
}

/** REQ-050 严格格式：分数 {score}，剩余步数 {moves}，目标 {progress} */
export function formatLiveText(model: HudModel): string {
  return `分数 ${model.score}，剩余步数 ${model.moves}，目标 ${formatProgress(model.goals)}`;
}

/** ≤3 步只提示一次；0 步不重复（TASK-028 DoD）。 */
export class LowMovesNotifier {
  private fired = false;

  check(movesLeft: number): boolean {
    if (movesLeft <= 0 || movesLeft > 3 || this.fired) return false;
    this.fired = true;
    return true;
  }

  reset(): void {
    this.fired = false;
  }
}

export interface HudElements {
  score: HTMLElement | null;
  moves: HTMLElement | null;
  goals: HTMLElement | null;
}

export function renderHud(elements: HudElements, model: HudModel): void {
  if (elements.score) elements.score.textContent = String(model.score);
  if (elements.moves) {
    elements.moves.textContent = String(model.moves);
    elements.moves.classList.toggle('low', model.lowMoves);
  }
  if (elements.goals) {
    elements.goals.innerHTML = '';
    for (const goal of model.goals) {
      const item = document.createElement('li');
      item.className = goal.done ? 'goal done' : 'goal';
      item.textContent = goal.text;
      elements.goals.appendChild(item);
    }
  }
}
