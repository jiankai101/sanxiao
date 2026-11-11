import type { SettingsV1 } from '../../systems/storage/schema';

export interface SettingsHandlers {
  onChange(patch: Partial<SettingsV1>): void;
  onResetProgress(): void;
  onClearLeaderboard(): void;
  onClose(): void;
}

export interface SettingsRow {
  key: keyof SettingsV1;
  label: string;
  kind: 'switch' | 'range';
  value: number | boolean;
  hint?: string;
}

export function buildSettingsRows(settings: SettingsV1): SettingsRow[] {
  return [
    { key: 'bgmEnabled', label: '背景音乐', kind: 'switch', value: settings.bgmEnabled },
    { key: 'bgmVolume', label: '音乐音量', kind: 'range', value: settings.bgmVolume },
    { key: 'sfxEnabled', label: '音效', kind: 'switch', value: settings.sfxEnabled },
    { key: 'sfxVolume', label: '音效音量', kind: 'range', value: settings.sfxVolume },
    { key: 'reducedMotion', label: '减弱动效', kind: 'switch', value: settings.reducedMotion },
    { key: 'colorblindMode', label: '色盲模式', kind: 'switch', value: settings.colorblindMode, hint: '元素叠加形状符号' },
  ];
}

export function renderSettings(root: HTMLElement, settings: SettingsV1, handlers: SettingsHandlers): void {
  root.innerHTML = '';
  root.classList.remove('hidden');
  root.setAttribute('aria-hidden', 'false');

  const panel = document.createElement('div');
  panel.className = 'panel settings-panel';
  panel.setAttribute('role', 'dialog');
  panel.setAttribute('aria-labelledby', 'panel-settings-title');

  const header = document.createElement('div');
  header.className = 'panel-header';
  const title = document.createElement('h2');
  title.id = 'panel-settings-title';
  title.textContent = '设置';
  const close = document.createElement('button');
  close.type = 'button';
  close.className = 'btn icon-btn';
  close.setAttribute('aria-label', '关闭设置');
  close.textContent = '关闭';
  close.addEventListener('click', handlers.onClose);
  header.append(title, close);

  const list = document.createElement('div');
  list.className = 'settings-list';
  let volumeTimer: number | null = null;

  for (const row of buildSettingsRows(settings)) {
    const wrap = document.createElement('label');
    wrap.className = 'settings-row';
    const span = document.createElement('span');
    span.textContent = row.label;
    wrap.appendChild(span);

    if (row.kind === 'switch') {
      const input = document.createElement('input');
      input.type = 'checkbox';
      input.id = `set-${row.key}`;
      input.checked = Boolean(row.value);
      input.addEventListener('change', () => handlers.onChange({ [row.key]: input.checked } as Partial<SettingsV1>));
      wrap.appendChild(input);
    } else {
      const input = document.createElement('input');
      input.type = 'range';
      input.id = `set-${row.key}`;
      input.min = '0';
      input.max = '100';
      input.step = '1';
      input.value = String(row.value);
      const output = document.createElement('output');
      output.textContent = String(row.value);
      input.addEventListener('input', () => {
        output.textContent = input.value;
        if (volumeTimer !== null) clearTimeout(volumeTimer);
        volumeTimer = setTimeout(() => {
          handlers.onChange({ [row.key]: Number(input.value) } as Partial<SettingsV1>);
        }, 100) as unknown as number;
      });
      input.addEventListener('change', () => {
        if (volumeTimer !== null) clearTimeout(volumeTimer);
        volumeTimer = null;
        handlers.onChange({ [row.key]: Number(input.value) } as Partial<SettingsV1>);
      });
      wrap.append(input, output);
    }
    list.appendChild(wrap);
  }

  const danger = document.createElement('div');
  danger.className = 'settings-danger';
  const reset = document.createElement('button');
  reset.type = 'button';
  reset.id = 'btn-reset-progress';
  reset.className = 'btn danger';
  reset.textContent = '重置游戏进度';
  reset.addEventListener('click', handlers.onResetProgress);

  const clear = document.createElement('button');
  clear.type = 'button';
  clear.id = 'btn-clear-leaderboard';
  clear.className = 'btn danger';
  clear.textContent = '清空本地排行榜';
  clear.addEventListener('click', handlers.onClearLeaderboard);

  const note = document.createElement('p');
  note.className = 'settings-note';
  note.textContent = '清除浏览器站点数据将永久丢失本地排行榜记录。';

  danger.append(reset, clear, note);
  panel.append(header, list, danger);
  root.appendChild(panel);
  close.focus();
}
