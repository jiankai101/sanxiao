export interface PauseHandlers {
  onResume(): void;
  onRestart(): void;
  onBack(): void;
}

export function renderPauseMenu(root: HTMLElement, handlers: PauseHandlers): void {
  root.innerHTML = '';
  root.classList.remove('hidden');
  root.setAttribute('aria-hidden', 'false');

  const panel = document.createElement('div');
  panel.className = 'panel pause-panel';
  panel.setAttribute('role', 'dialog');
  panel.setAttribute('aria-labelledby', 'panel-pause-title');

  const title = document.createElement('h2');
  title.id = 'panel-pause-title';
  title.textContent = '已暂停';

  const actions = document.createElement('div');
  actions.className = 'panel-actions';
  const items: readonly [string, () => void, 'primary' | 'secondary'][] = [
    ['继续', handlers.onResume, 'primary'],
    ['重开', handlers.onRestart, 'secondary'],
    ['返回选关', handlers.onBack, 'secondary'],
  ];
  for (const [label, handler, kind] of items) {
    const el = document.createElement('button');
    el.type = 'button';
    el.className = `btn ${kind}`;
    el.textContent = label;
    el.addEventListener('click', handler);
    actions.appendChild(el);
  }

  panel.append(title, actions);
  root.appendChild(panel);
  (actions.querySelector('button') as HTMLButtonElement | null)?.focus();
}
