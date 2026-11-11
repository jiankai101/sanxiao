/**
 * aria-live 节流（REQ-050）：同一秒最多播报 1 次，合并窗口内最后一帧。
 * 纯逻辑可注入时钟与定时器，便于 Node 测试。
 */
export interface AnnouncerDeps {
  now?: () => number;
  setTimer?: (fn: () => void, ms: number) => number;
  clearTimer?: (id: number) => void;
  intervalMs?: number;
}

export class ThrottledAnnouncer {
  private lastAt = -Infinity;
  private pending: string | null = null;
  private timer: number | null = null;
  private readonly now: () => number;
  private readonly setTimer: (fn: () => void, ms: number) => number;
  private readonly clearTimer: (id: number) => void;
  private readonly intervalMs: number;

  constructor(private readonly emit: (text: string) => void, deps: AnnouncerDeps = {}) {
    this.now = deps.now ?? (() => Date.now());
    this.setTimer = deps.setTimer ?? ((fn, ms) => setTimeout(fn, ms) as unknown as number);
    this.clearTimer = deps.clearTimer ?? ((id) => clearTimeout(id));
    this.intervalMs = deps.intervalMs ?? 1000;
  }

  update(text: string): void {
    const now = this.now();
    const elapsed = now - this.lastAt;
    if (elapsed >= this.intervalMs) {
      this.lastAt = now;
      this.emit(text);
      return;
    }
    this.pending = text;
    if (this.timer === null) {
      this.timer = this.setTimer(() => {
        this.timer = null;
        if (this.pending !== null) {
          const text2 = this.pending;
          this.pending = null;
          this.lastAt = this.now();
          this.emit(text2);
        }
      }, this.intervalMs - elapsed);
    }
  }

  dispose(): void {
    if (this.timer !== null) this.clearTimer(this.timer);
    this.timer = null;
    this.pending = null;
  }
}

export class LiveRegion {
  private readonly announcer: ThrottledAnnouncer;

  constructor(private readonly el: HTMLElement | null, deps: AnnouncerDeps = {}) {
    this.announcer = new ThrottledAnnouncer((text) => {
      if (this.el) this.el.textContent = text;
    }, deps);
  }

  update(text: string): void {
    this.announcer.update(text);
  }

  dispose(): void {
    this.announcer.dispose();
  }
}
