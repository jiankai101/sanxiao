import type { GoalProgress, LevelConfig } from '../../systems/contracts';
import { TILE_LABELS } from '../hud';

export interface ResultInput {
  level: LevelConfig;
  won: boolean;
  score: number;
  bestScore: number;
  stars: number;
  movesLeft: number;
  goals: readonly GoalProgress[];
  hasNextLevel: boolean;
}

export interface ResultGoalRow {
  label: string;
  current: number;
  target: number;
  done: boolean;
  text: string;
}

export interface ResultModel {
  levelName: string;
  resultText: string;
  scoreText: string;
  bestText: string;
  stars: number;
  movesLeft: number;
  goals: ResultGoalRow[];
  showNext: boolean;
}

export function buildResultModel(input: ResultInput): ResultModel {
  const goals = input.goals.map((g) => {
    const goal = input.level.goals.find((x) => x.id === g.goalId);
    const label = goal?.type === 'collect'
      ? TILE_LABELS[goal.tile]
      : goal?.type === 'obstacle'
        ? (goal.obstacle === 'ice' ? '冰块' : '石块')
        : '分数';
    return { label, current: g.current, target: g.target, done: g.done, text: `${label} ${g.current}/${g.target}` };
  });
  return {
    levelName: input.level.name,
    resultText: input.won ? '胜利' : '失败',
    scoreText: `本局分数 ${input.score}`,
    bestText: `历史最高分 ${input.bestScore}`,
    stars: input.stars,
    movesLeft: input.movesLeft,
    goals,
    showNext: input.won && input.hasNextLevel,
  };
}

export interface ResultHandlers {
  onRestart(): void;
  onNext(): void;
  onBack(): void;
}

export function renderResultPanel(root: HTMLElement, model: ResultModel, handlers: ResultHandlers): void {
  root.innerHTML = '';
  root.classList.remove('hidden');
  root.setAttribute('aria-hidden', 'false');

  const panel = document.createElement('div');
  panel.className = 'panel result-panel';

  const title = document.createElement('h2');
  title.textContent = `${model.levelName} · ${model.resultText}`;
  title.id = 'panel-result-title';
  panel.setAttribute('role', 'dialog');
  panel.setAttribute('aria-labelledby', 'panel-result-title');

  const stars = document.createElement('div');
  stars.className = 'result-stars';
  stars.textContent = '★'.repeat(model.stars) + '☆'.repeat(3 - model.stars);
  stars.setAttribute('aria-label', `${model.stars} 星`);

  const score = document.createElement('p');
  score.className = 'result-score';
  score.textContent = model.scoreText;

  const best = document.createElement('p');
  best.className = 'result-best';
  best.textContent = model.bestText;

  const moves = document.createElement('p');
  moves.className = 'result-moves';
  moves.textContent = `剩余步数 ${model.movesLeft}`;

  const goalList = document.createElement('ul');
  goalList.className = 'result-goals';
  for (const goal of model.goals) {
    const li = document.createElement('li');
    li.className = goal.done ? 'done' : 'pending';
    li.textContent = `${goal.done ? '✓' : '✗'} ${goal.text}`;
    goalList.appendChild(li);
  }

  const actions = document.createElement('div');
  actions.className = 'panel-actions';
  const restart = action('重开', 'secondary', handlers.onRestart);
  const back = action('返回选关', 'secondary', handlers.onBack);
  actions.append(restart);
  if (model.showNext) actions.append(action('下一关', 'primary', handlers.onNext));
  actions.append(back);

  panel.append(title, stars, score, best, moves, goalList, actions);
  root.appendChild(panel);
}

function action(label: string, kind: 'primary' | 'secondary', onClick: () => void): HTMLButtonElement {
  const el = document.createElement('button');
  el.type = 'button';
  el.className = `btn ${kind}`;
  el.textContent = label;
  el.addEventListener('click', onClick);
  return el;
}
