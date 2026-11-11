import type { SaveDataV1 } from '../../systems/storage/schema';
import { getLevel, levelName } from '../../systems/level/levels';

export interface LevelCardModel {
  levelId: number;
  name: string;
  unlocked: boolean;
  stars: number;
  bestScore: number;
  lockedHint: string;
}

const LOCKED_HINT = '通过上一关解锁';

export function buildLevelCards(save: SaveDataV1): LevelCardModel[] {
  return Array.from({ length: 8 }, (_, i) => {
    const levelId = i + 1;
    const record = save.levelRecords.find((r) => r.levelId === levelId);
    return {
      levelId,
      name: getLevel(levelId)?.name ?? levelName(levelId),
      unlocked: levelId <= save.unlockedLevelId,
      stars: record?.bestStars ?? 0,
      bestScore: record?.bestScore ?? 0,
      lockedHint: LOCKED_HINT,
    };
  });
}

export interface LevelSelectHandlers {
  onStart(levelId: number): void;
  onBack(): void;
  onSettings(): void;
  onLeaderboard(): void;
  onClickSound(): void;
}

export function renderLevelSelect(
  root: HTMLElement,
  save: SaveDataV1,
  handlers: LevelSelectHandlers,
): void {
  const cards = buildLevelCards(save);
  root.innerHTML = '';

  const header = document.createElement('div');
  header.className = 'screen-header';
  const title = document.createElement('h1');
  title.textContent = '选择关卡';
  header.appendChild(title);

  const nav = document.createElement('div');
  nav.className = 'header-actions';
  const back = button('返回', 'icon-back', handlers.onBack);
  const settings = button('设置', 'icon-settings', handlers.onSettings);
  const board = button('排行榜', 'icon-trophy', handlers.onLeaderboard);
  nav.append(back, settings, board);
  header.appendChild(nav);
  root.appendChild(header);

  const grid = document.createElement('div');
  grid.className = 'level-grid';
  for (const card of cards) {
    const el = document.createElement('button');
    el.type = 'button';
    el.className = card.unlocked ? 'level-card' : 'level-card locked';
    el.dataset.levelId = String(card.levelId);
    el.setAttribute('aria-label', `${card.name}${card.unlocked ? '' : `（${card.lockedHint}）`}`);
    if (!card.unlocked) el.disabled = true;

    const name = document.createElement('span');
    name.className = 'level-name';
    name.textContent = `${card.levelId}. ${card.name}`;

    const stars = document.createElement('span');
    stars.className = 'level-stars';
    stars.textContent = '★'.repeat(card.stars) + '☆'.repeat(3 - card.stars);
    stars.setAttribute('aria-label', `${card.stars} 星`);

    const best = document.createElement('span');
    best.className = 'level-best';
    best.textContent = card.unlocked ? `最高分 ${card.bestScore}` : card.lockedHint;

    el.append(name, stars, best);
    if (card.unlocked) el.addEventListener('click', () => handlers.onStart(card.levelId));
    else el.addEventListener('click', () => handlers.onClickSound());
    grid.appendChild(el);
  }
  root.appendChild(grid);
}

function button(label: string, icon: string, onClick: () => void): HTMLButtonElement {
  const el = document.createElement('button');
  el.type = 'button';
  el.className = 'btn icon-btn';
  el.setAttribute('aria-label', label);
  el.title = label;
  el.textContent = label;
  el.dataset.icon = icon;
  el.addEventListener('click', onClick);
  return el;
}
