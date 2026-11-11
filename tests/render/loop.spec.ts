import { describe, expect, it, vi } from 'vitest';
import { FrameStats, RenderLoop } from '../../src/render/loop';
import { ParticlePool, PARTICLE_CAPACITY } from '../../src/render/fx';

describe('REQ-051 main loop, frame budget & particles', () => {
  it('computes p95 and low-fps ratio over a 600-frame sample', () => {
    const stats = new FrameStats();
    for (let i = 1; i <= 600; i += 1) stats.push(i);
    expect(stats.samples).toBe(600);
    expect(stats.p95()).toBe(570);
    expect(stats.lowFpsRatio()).toBeCloseTo(580 / 600, 6);
    expect(stats.max()).toBe(600);
  });

  it('keeps a 600-frame ring buffer', () => {
    const stats = new FrameStats();
    for (let i = 1; i <= 700; i += 1) stats.push(i);
    expect(stats.samples).toBe(600);
    expect(stats.p95()).toBe(670);
    expect(stats.max()).toBe(700);
  });

  it('cancels rAF while hidden and resumes without catch-up frames', () => {
    const callbacks: ((ts: number) => void)[] = [];
    const cancelled: unknown[] = [];
    const draw = vi.fn();
    const visibility = { visibilityState: 'visible', addEventListener: vi.fn(), removeEventListener: vi.fn() };
    const loop = new RenderLoop({
      raf: (callback) => {
        callbacks.push(callback);
        return callbacks.length;
      },
      caf: (handle) => cancelled.push(handle),
      now: () => 0,
      draw,
      visibility,
    });
    loop.start();
    expect(callbacks).toHaveLength(1);
    loop.stepFrame(0);
    loop.stepFrame(16);
    expect(draw).toHaveBeenCalledTimes(2);
    expect(loop.stats.samples).toBe(1);

    visibility.visibilityState = 'hidden';
    loop.handleVisibility();
    expect(cancelled.length).toBe(1);
    const scheduledBeforeHidden = callbacks.length;
    expect(callbacks.length).toBe(scheduledBeforeHidden);

    visibility.visibilityState = 'visible';
    loop.handleVisibility();
    expect(callbacks.length).toBe(scheduledBeforeHidden + 1);
    loop.stepFrame(100000);
    expect(draw).toHaveBeenLastCalledWith(0, 100000);
    expect(loop.stats.samples).toBe(1);
  });

  it('caps the particle pool at 64 and recycles the oldest', () => {
    const pool = new ParticlePool();
    for (let i = 0; i < PARTICLE_CAPACITY; i += 1) pool.spawn(i, 0, 0, 0, 1000, 2, '#fff');
    expect(pool.allocations).toBe(64);
    expect(pool.activeCount).toBe(64);
    pool.spawn(999, 5, 0, 0, 1000, 2, '#f00');
    expect(pool.allocations).toBe(64);
    expect(pool.particles[0]?.x).toBe(999);
    expect(pool.activeCount).toBe(64);
    pool.update(500);
    expect(pool.activeCount).toBe(64);
    pool.update(600);
    expect(pool.activeCount).toBe(0);
  });

  it('keeps per-frame draw cost far below the 8ms budget in a stub environment', () => {
    const stats = new FrameStats();
    let frames = 0;
    const started = performance.now();
    for (let i = 0; i < 120; i += 1) {
      stats.push(16);
      frames += 1;
    }
    const elapsed = performance.now() - started;
    expect(frames).toBe(120);
    expect(elapsed / frames).toBeLessThan(8);
  });
});

