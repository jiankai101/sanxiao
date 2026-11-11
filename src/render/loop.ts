/**
 * Single rAF loop with frame-interval statistics (REQ-051).
 * Hidden tabs cancel the loop; becoming visible resets `lastTs` so nothing is
 * replayed (no catch-up frames).
 */
export const FRAME_BUFFER = 600;
export const FRAME_BUDGET_MS = 8;
export const SLOW_FRAME_MS = 20;

export class FrameStats {
  readonly capacity: number;
  private buffer: number[] = [];
  private cursor = 0;

  constructor(capacity: number = FRAME_BUFFER) {
    this.capacity = capacity;
  }

  push(deltaMs: number): void {
    if (!Number.isFinite(deltaMs) || deltaMs < 0) return;
    if (this.buffer.length < this.capacity) {
      this.buffer.push(deltaMs);
    } else {
      this.buffer[this.cursor] = deltaMs;
      this.cursor = (this.cursor + 1) % this.capacity;
    }
  }

  get samples(): number {
    return this.buffer.length;
  }

  p95(): number {
    if (this.buffer.length === 0) return 0;
    const sorted = this.buffer.slice().sort((a, b) => a - b);
    const rank = Math.ceil(sorted.length * 0.95) - 1;
    return sorted[Math.max(0, Math.min(sorted.length - 1, rank))] as number;
  }

  /** share of frames slower than 50fps (>= 20ms) */
  lowFpsRatio(): number {
    if (this.buffer.length === 0) return 0;
    const slow = this.buffer.filter((dt) => dt > SLOW_FRAME_MS).length;
    return slow / this.buffer.length;
  }

  max(): number {
    return this.buffer.length === 0 ? 0 : Math.max(...this.buffer);
  }

  reset(): void {
    this.buffer = [];
    this.cursor = 0;
  }
}

export interface VisibilitySource {
  visibilityState?: string;
  addEventListener: (type: string, handler: () => void) => void;
  removeEventListener: (type: string, handler: () => void) => void;
}

export interface LoopOptions {
  raf: (callback: (ts: number) => void) => unknown;
  caf: (handle: unknown) => void;
  now: () => number;
  draw: (deltaMs: number, timestamp: number) => void;
  visibility?: VisibilitySource;
  stats?: FrameStats;
}

export class RenderLoop {
  private readonly options: LoopOptions;
  readonly stats: FrameStats;
  private handle: unknown = null;
  private running = false;
  private lastTs: number | null = null;
  private paused = false;
  private visibilityHandler: (() => void) | null = null;

  constructor(options: LoopOptions) {
    this.options = options;
    this.stats = options.stats ?? new FrameStats();
  }

  get isRunning(): boolean {
    return this.running;
  }

  start(): void {
    if (this.running) return;
    this.running = true;
    this.paused = false;
    this.lastTs = null;
    if (this.options.visibility) {
      this.visibilityHandler = () => this.handleVisibility();
      this.options.visibility.addEventListener('visibilitychange', this.visibilityHandler);
    }
    this.schedule();
  }

  stop(): void {
    this.running = false;
    if (this.handle !== null) {
      this.options.caf(this.handle);
      this.handle = null;
    }
    if (this.options.visibility && this.visibilityHandler) {
      this.options.visibility.removeEventListener('visibilitychange', this.visibilityHandler);
      this.visibilityHandler = null;
    }
  }

  handleVisibility(): void {
    const state = this.options.visibility?.visibilityState ?? 'visible';
    if (state === 'hidden') {
      this.paused = true;
      if (this.handle !== null) {
        this.options.caf(this.handle);
        this.handle = null;
      }
      return;
    }
    if (!this.running) return;
    this.paused = false;
    this.lastTs = null;
    if (this.handle === null) this.schedule();
  }

  private schedule(): void {
    if (!this.running || this.paused) return;
    this.handle = this.options.raf((ts) => this.frame(ts));
  }

  private frame(timestamp: number): void {
    this.handle = null;
    if (!this.running || this.paused) return;
    let delta = 0;
    if (this.lastTs !== null) {
      delta = Math.max(0, timestamp - this.lastTs);
      this.stats.push(delta);
    }
    this.lastTs = timestamp;
    this.options.draw(delta, timestamp);
    this.schedule();
  }

  /** Test hook: drives one frame without a real animation frame source. */
  stepFrame(timestamp: number): void {
    this.frame(timestamp);
  }

  currentHandle(): unknown {
    return this.handle;
  }
}

export function createLoop(options: LoopOptions): RenderLoop {
  return new RenderLoop(options);
}
