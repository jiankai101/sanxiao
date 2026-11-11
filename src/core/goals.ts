/**
 * Goal progress, win/lose decision and star rating (REQ-022, REQ-023, REQ-024, REQ-026).
 */
import { MAX_STARS } from './constants';
import type { GameState, GameStats, Goal, GoalProgress, LevelConfig, TileKind } from './types';

export function emptyStats(): GameStats {
  return {
    movesUsed: 0,
    clearedTiles: 0,
    iceBroken: 0,
    stoneBroken: 0,
    collected: { star: 0, water: 0, leaf: 0, flame: 0, crystal: 0, bolt: 0 } as Record<TileKind, number>,
  };
}

export function cloneStats(stats: GameStats): GameStats {
  return {
    movesUsed: stats.movesUsed,
    clearedTiles: stats.clearedTiles,
    iceBroken: stats.iceBroken,
    stoneBroken: stats.stoneBroken,
    collected: { ...stats.collected },
  };
}

function currentValue(goal: Goal, score: number, stats: GameStats): number {
  if (goal.type === 'score') return score;
  if (goal.type === 'collect') return stats.collected[goal.tile] ?? 0;
  return goal.obstacle === 'ice' ? stats.iceBroken : stats.stoneBroken;
}

export function computeGoalProgress(goals: readonly Goal[], score: number, stats: GameStats): GoalProgress[] {
  return goals.map((goal) => {
    const current = currentValue(goal, score, stats);
    return { goalId: goal.id, current, target: goal.target, done: current >= goal.target };
  });
}

export function allGoalsDone(progress: readonly GoalProgress[]): boolean {
  return progress.length > 0 && progress.every((p) => p.done);
}

export function evaluateOutcome(
  state: Pick<GameState, 'score' | 'movesLeft' | 'stats'>,
  level: LevelConfig,
): 'continue' | 'won' | 'lost' {
  const progress = computeGoalProgress(level.goals, state.score, state.stats);
  if (allGoalsDone(progress)) return 'won';
  if (state.movesLeft === 0) return 'lost';
  return 'continue';
}

export function starsFor(score: number, stars: { two: number; three: number }, won: boolean): number {
  if (!won) return 0;
  if (score >= stars.three) return 3;
  if (score >= stars.two) return 2;
  return Math.min(1, MAX_STARS);
}

/** Best stars win: lower replays never overwrite a higher historical value. */
export function maxStars(previous: number, next: number): number {
  return Math.max(previous, next);
}
