let dialogSeq = 0;

export interface ConfirmOptions {
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
}

/** 二次确认对话框；按钮可 Tab 聚焦，Esc 取消。调用方负责焦点回收。 */
export function confirmDialog(options: ConfirmOptions): Promise<boolean> {
  const id = `dlg-${++dialogSeq}`;
  const previous = document.activeElement as HTMLElement | null;
  const backdrop = document.createElement('div');
  backdrop.className = 'dialog-backdrop';
  backdrop.id = id;

  const dialog = document.createElement('div');
  dialog.className = 'dialog';
  dialog.setAttribute('role', 'alertdialog');
  dialog.setAttribute('aria-modal', 'true');
  dialog.setAttribute('aria-labelledby', `${id}-title`);
  dialog.setAttribute('aria-describedby', `${id}-msg`);

  const title = document.createElement('h2');
  title.id = `${id}-title`;
  title.textContent = options.title;

  const msg = document.createElement('p');
  msg.id = `${id}-msg`;
  msg.textContent = options.message;

  const actions = document.createElement('div');
  actions.className = 'dialog-actions';

  const cancel = document.createElement('button');
  cancel.type = 'button';
  cancel.className = 'btn';
  cancel.textContent = options.cancelText ?? '取消';

  const confirm = document.createElement('button');
  confirm.type = 'button';
  confirm.className = 'btn danger';
  confirm.textContent = options.confirmText ?? '确认';

  actions.append(cancel, confirm);
  dialog.append(title, msg, actions);
  backdrop.appendChild(dialog);
  document.body.appendChild(backdrop);
  confirm.focus();

  return new Promise<boolean>((resolve) => {
    const close = (value: boolean) => {
      document.removeEventListener('keydown', onKey);
      backdrop.remove();
      previous?.focus?.();
      resolve(value);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') close(false);
      if (event.key === 'Tab') {
        const focusables = [cancel, confirm];
        const index = focusables.indexOf(document.activeElement as HTMLButtonElement);
        const next = event.shiftKey
          ? focusables[(index - 1 + focusables.length) % focusables.length]
          : focusables[(index + 1) % focusables.length];
        event.preventDefault();
        next.focus();
      }
    };
    cancel.addEventListener('click', () => close(false));
    confirm.addEventListener('click', () => close(true));
    backdrop.addEventListener('click', (event) => {
      if (event.target === backdrop) close(false);
    });
    document.addEventListener('keydown', onKey);
  });
}
