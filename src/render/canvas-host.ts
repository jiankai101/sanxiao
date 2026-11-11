/**
 * Canvas host: backing-store sizing, DPR (max 2) and resize coalescing (REQ-041).
 *
 * BUG-001: the canvas element's CSS box is the sole coordinate frame. CSS
 * (#game { inset: 0; margin: auto }) centres that box in the viewport, so the
 * layout snapshot keeps canvas-local offsets at exactly zero; the draw
 * transform must not translate again.
 */
import { DPR_MAX } from '../core/constants';
import type { LayoutSnapshot } from './layout';
import { computeLayout } from './layout';

/**
 * Resize debounce budget (REQ-041 / BUG-007). The spec allows 200ms from the
 * last resize event to the completed redraw, so the debounce has to leave the
 * layout + backing-store + paint work safely inside that budget (120 + one
 * frame is well under 200ms).
 */
export const RESIZE_DEBOUNCE_MS = 120;

export interface CanvasLike {
  width: number;
  height: number;
  style: { width: string; height: string };
  clientWidth?: number;
  clientHeight?: number;
  getContext?: (id: string) => unknown;
}

export interface ResizeObserverLike {
  observe: (target: unknown) => void;
  disconnect: () => void;
}

export interface HostEnvironment {
  innerWidth: number;
  innerHeight: number;
  devicePixelRatio?: number;
  addEventListener: (type: string, handler: () => void) => void;
  removeEventListener: (type: string, handler: () => void) => void;
  matchMedia?: (query: string) => {
    addEventListener?: (type: string, handler: () => void) => void;
    removeEventListener?: (type: string, handler: () => void) => void;
    addListener?: (handler: () => void) => void;
    removeListener?: (handler: () => void) => void;
    matches: boolean;
  };
  ResizeObserver?: new (callback: () => void) => ResizeObserverLike;
}

export interface CanvasHostOptions {
  environment?: HostEnvironment;
  devicePixelRatio?: number;
  debounceMs?: number;
  onResize?: (snapshot: LayoutSnapshot, dpr: number) => void;
  schedule?: (callback: () => void, ms: number) => unknown;
  cancel?: (handle: unknown) => void;
}

export class CanvasHost {
  private readonly canvas: CanvasLike;
  private readonly options: CanvasHostOptions;
  private current: LayoutSnapshot;
  private currentDpr = 1;
  private pending: unknown = null;
  private listeners: { type: string; handler: () => void }[] = [];
  private mediaQuery: ReturnType<NonNullable<HostEnvironment['matchMedia']>> | null = null;
  private observer: ResizeObserverLike | null = null;
  private resizeHandler: (() => void) | null = null;

  constructor(canvas: CanvasLike, options: CanvasHostOptions = {}) {
    this.canvas = canvas;
    this.options = options;
    const width = canvas.clientWidth ?? options.environment?.innerWidth ?? 960;
    const height = canvas.clientHeight ?? options.environment?.innerHeight ?? 720;
    this.current = computeLayout(width, height);
    this.currentDpr = clampDpr(options.devicePixelRatio ?? options.environment?.devicePixelRatio ?? 1);
    this.applyBackingStore();
  }

  get snapshot(): LayoutSnapshot {
    return this.current;
  }

  get dpr(): number {
    return this.currentDpr;
  }

  get debounceMs(): number {
    return this.options.debounceMs ?? RESIZE_DEBOUNCE_MS;
  }

  mount(): void {
    const env = this.options.environment;
    if (!env) return;
    this.resizeHandler = () => this.handleResize();
    env.addEventListener('resize', this.resizeHandler);
    this.listeners.push({ type: 'resize', handler: this.resizeHandler });
    if (env.matchMedia) {
      const query = env.matchMedia('(resolution: 1dppx)');
      this.mediaQuery = query;
      if (query.addEventListener && this.resizeHandler) query.addEventListener('change', this.resizeHandler);
      else if (query.addListener && this.resizeHandler) query.addListener(this.resizeHandler);
    }
    if (env.ResizeObserver) {
      this.observer = new env.ResizeObserver(() => this.handleResize());
      this.observer.observe(this.canvas);
    }
  }

  destroy(): void {
    const env = this.options.environment;
    if (env) {
      for (const listener of this.listeners) env.removeEventListener(listener.type, listener.handler);
      if (this.mediaQuery) {
        if (this.mediaQuery.removeEventListener && this.resizeHandler) {
          this.mediaQuery.removeEventListener('change', this.resizeHandler);
        } else if (this.mediaQuery.removeListener && this.resizeHandler) {
          this.mediaQuery.removeListener(this.resizeHandler);
        }
      }
    }
    this.listeners = [];
    this.mediaQuery = null;
    this.observer?.disconnect();
    this.observer = null;
    if (this.pending !== null) {
      (this.options.cancel ?? ((handle: unknown) => clearTimeout(handle as ReturnType<typeof setTimeout>)))(this.pending);
      this.pending = null;
    }
  }

  /**
   * Applies an explicit viewport (used by tests and by the resize handler).
   * The snapshot describes the resulting 4:3 canvas element box; viewport
   * letterboxing remains CSS-only and is not baked into offsetX/offsetY.
   */
  applyViewport(width: number, height: number, dpr?: number): LayoutSnapshot {
    this.current = computeLayout(width, height);
    if (dpr !== undefined) this.currentDpr = clampDpr(dpr);
    this.applyBackingStore();
    return this.current;
  }

  handleResize(): void {
    if (this.pending !== null) {
      (this.options.cancel ?? ((handle: unknown) => clearTimeout(handle as ReturnType<typeof setTimeout>)))(this.pending);
    }
    const schedule = this.options.schedule ?? ((callback: () => void, ms: number) => setTimeout(callback, ms));
    this.pending = schedule(() => {
      this.pending = null;
      const env = this.options.environment;
      const width = this.canvas.clientWidth ?? env?.innerWidth ?? this.current.viewportWidth;
      const height = this.canvas.clientHeight ?? env?.innerHeight ?? this.current.viewportHeight;
      const dpr = this.options.devicePixelRatio ?? env?.devicePixelRatio ?? this.currentDpr;
      const snapshot = this.applyViewport(width, height, dpr);
      this.options.onResize?.(snapshot, this.currentDpr);
    }, this.debounceMs);
  }

  private applyBackingStore(): void {
    const dpr = this.currentDpr;
    const width = Math.max(1, Math.round(this.current.cssWidth * dpr));
    const height = Math.max(1, Math.round(this.current.cssHeight * dpr));
    this.canvas.width = width;
    this.canvas.height = height;
    this.canvas.style.width = `${this.current.cssWidth}px`;
    this.canvas.style.height = `${this.current.cssHeight}px`;
  }
}

export function clampDpr(value: number): number {
  if (!Number.isFinite(value) || value <= 0) return 1;
  return Math.min(value, DPR_MAX);
}

export function createCanvasHost(canvas: CanvasLike, options: CanvasHostOptions = {}): CanvasHost {
  return new CanvasHost(canvas, options);
}

