import { levelName } from '../../systems/level/levels';
import type { LeaderboardRecord } from '../../systems/leaderboard/schema';
import { LEADERBOARD_PER_LEVEL, LEADERBOARD_TOTAL } from '../../systems/leaderboard/schema';


export interface LeaderboardRow {
  rank: number;
  levelId: number;
  levelName: string;
  score: number;
  stars: number;
  movesUsed: number;
  achievedAtText: string;
}

export interface LeaderboardModel {
  title: string;
  filterLevelId: number | undefined;
  rows: LeaderboardRow[];
  emptyText: string;
  limitText: string;
}

export function formatDateTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function buildLeaderboardModel(
  records: readonly LeaderboardRecord[],
  filterLevelId?: number,
): LeaderboardModel {
  const list = filterLevelId === undefined ? records : records.filter((r) => r.levelId === filterLevelId);
  return {
    title: '本地排行榜',
    filterLevelId,
    rows: list.slice(0, LEADERBOARD_PER_LEVEL).map((r, i) => ({
      rank: i + 1,
      levelId: r.levelId,
      levelName: `第 ${r.levelId} 关 ${levelName(r.levelId)}`,
      score: r.score,
      stars: r.stars,
      movesUsed: r.movesUsed,
      achievedAtText: formatDateTime(r.achievedAt),
    })),
    emptyText: '暂无记录，完成关卡后自动记录',
    limitText: `仅记录本机数据；单关最多 ${LEADERBOARD_PER_LEVEL} 条，本机记录上限 ${LEADERBOARD_TOTAL} 条`,
  };
}

export interface LeaderboardHandlers {
  onFilter(levelId: number | undefined): void;
  onClear(): void;
  onClose(): void;
}

export function renderLeaderboard(root: HTMLElement, model: LeaderboardModel, handlers: LeaderboardHandlers): void {
  root.innerHTML = '';
  root.classList.remove('hidden');
  root.setAttribute('aria-hidden', 'false');

  const panel = document.createElement('div');
  panel.className = 'panel leaderboard-panel';
  panel.setAttribute('role', 'dialog');
  panel.setAttribute('aria-labelledby', 'panel-leaderboard-title');

  const header = document.createElement('div');
  header.className = 'panel-header';
  const title = document.createElement('h2');
  title.id = 'panel-leaderboard-title';
  title.textContent = model.title;
  const close = document.createElement('button');
  close.type = 'button';
  close.className = 'btn icon-btn';
  close.setAttribute('aria-label', '关闭排行榜');
  close.textContent = '关闭';
  close.addEventListener('click', handlers.onClose);
  header.append(title, close);

  const filter = document.createElement('label');
  filter.className = 'leaderboard-filter';
  const filterLabel = document.createElement('span');
  filterLabel.textContent = '筛选关卡';
  const select = document.createElement('select');
  select.id = 'leaderboard-filter';
  const allOption = document.createElement('option');
  allOption.value = 'all';
  allOption.textContent = '全部关卡';
  select.appendChild(allOption);
  for (let id = 1; id <= 8; id += 1) {
    const option = document.createElement('option');
    option.value = String(id);
    option.textContent = `第 ${id} 关 ${levelName(id)}`;
    select.appendChild(option);
  }
  select.value = model.filterLevelId === undefined ? 'all' : String(model.filterLevelId);
  select.addEventListener('change', () => {
    handlers.onFilter(select.value === 'all' ? undefined : Number(select.value));
  });
  filter.append(filterLabel, select);

  const body = document.createElement('div');
  body.className = 'leaderboard-body';
  if (model.rows.length === 0) {
    const empty = document.createElement('p');
    empty.className = 'leaderboard-empty';
    empty.textContent = model.emptyText;
    body.appendChild(empty);
  } else {
    const table = document.createElement('table');
    table.className = 'leaderboard-table';
    const thead = document.createElement('thead');
    thead.innerHTML = '<tr><th>名次</th><th>关卡</th><th>分数</th><th>星级</th><th>步数</th><th>达成时间</th></tr>';
    const tbody = document.createElement('tbody');
    for (const row of model.rows) {
      const tr = document.createElement('tr');
      tr.dataset.rank = String(row.rank);
      for (const value of [
        String(row.rank),
        row.levelName,
        String(row.score),
        '★'.repeat(row.stars),
        String(row.movesUsed),
        row.achievedAtText,
      ]) {
        const td = document.createElement('td');
        td.textContent = value;
        tr.appendChild(td);
      }
      tbody.appendChild(tr);
    }
    table.append(thead, tbody);
    body.appendChild(table);
  }

  const note = document.createElement('p');
  note.className = 'leaderboard-note';
  note.textContent = model.limitText;

  const actions = document.createElement('div');
  actions.className = 'panel-actions';
  const clear = document.createElement('button');
  clear.type = 'button';
  clear.className = 'btn danger';
  clear.id = 'btn-leaderboard-clear';
  clear.textContent = '清空本地排行榜';
  clear.addEventListener('click', handlers.onClear);
  actions.appendChild(clear);

  panel.append(header, filter, body, note, actions);
  root.appendChild(panel);
  close.focus();
}
