/**
 * Animation trace (REQ-044 verification helper).
 *
 * Records the last N animation starts so the browser console / E2E hooks can
 * prove the six configured durations without instrumenting the render layer.
 * Pure data, bounded memory, no DOM dependency.
 */
export interface AnimationTraceEntry {
  kind: string;
  durationMs: number;
  reduced: boolean;
  startedAt: number;
}

const MAX_ENTRIES = 64;
const entries: AnimationTraceEntry[] = [];

function clock(): number {
  return typeof performance !== 'undefined' ? performance.now() : Date.now();
}

/** Appends one entry; the oldest entries are dropped beyond MAX_ENTRIES. */
export function recordAnimation(kind: string, durationMs: number, reduced: boolean): AnimationTraceEntry {
  const entry: AnimationTraceEntry = {
    kind,
    durationMs: Math.max(0, Math.round(durationMs)),
    reduced,
    startedAt: Math.round(clock()),
  };
  entries.push(entry);
  if (entries.length > MAX_ENTRIES) entries.splice(0, entries.length - MAX_ENTRIES);
  return entry;
}

export function animationTrace(): readonly AnimationTraceEntry[] {
  return entries.slice();
}

export function clearAnimationTrace(): void {
  entries.length = 0;
}
