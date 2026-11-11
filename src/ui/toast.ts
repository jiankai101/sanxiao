export const TOAST_CORRUPT_MS = 5000;
export const TOAST_RESET_MS = 3000;
export const TOAST_SHUFFLE_MS = 2000;

export interface ToastOptions {
  durationMs: number;
  persistent?: boolean;
}

/** 顶部提示：5s（损坏）/3s（重置）/2s（重排）；persistent 为常驻降级条。 */
export class ToastHost {
  private toastEl: HTMLElement | null = null;
  private barEl: HTMLElement | null = null;
  private timer: number | null = null;

  constructor(private readonly root: HTMLElement) {}

  show(message: string, options: ToastOptions): void {
    if (!this.toastEl) {
      this.toastEl = document.createElement('div');
      this.toastEl.className = 'toast';
      this.toastEl.setAttribute('role', 'status');
      this.root.appendChild(this.toastEl);
    }
    this.toastEl.textContent = message;
    this.toastEl.classList.remove('hidden');
    if (this.timer !== null) clearTimeout(this.timer);
    if (!options.persistent) {
      this.timer = setTimeout(() => this.toastEl?.classList.add('hidden'), options.durationMs) as unknown as number;
    }
  }

  showPersistent(message: string): void {
    if (!this.barEl) {
      this.barEl = document.createElement('div');
      this.barEl.className = 'storage-bar';
      this.barEl.setAttribute('role', 'status');
      this.root.appendChild(this.barEl);
    }
    this.barEl.textContent = message;
    this.barEl.classList.remove('hidden');
  }

  hidePersistent(): void {
    this.barEl?.classList.add('hidden');
  }
}
