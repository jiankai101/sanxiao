/**
 * Deterministic PRNG (mulberry32). REQ-002.
 * The generator is a pure state machine: every call takes the old uint32 state
 * and returns the produced value plus the next state.
 */
import { DomainError } from './errors';

export interface RngDraw {
  value: number;
  state: number;
}

export function nextUint32(state: number): RngDraw {
  let a = (state + 0x6d2b79f5) >>> 0;
  let t = a;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return { value: (t ^ (t >>> 14)) >>> 0, state: a };
}

export interface Rng {
  readonly state: number;
  nextUint32(): number;
  nextInt(maxExclusive: number): number;
  pick<T>(items: readonly T[]): T;
  shuffle<T>(items: readonly T[]): T[];
}

const UINT32_RANGE = 0x100000000;

export class SeededRng implements Rng {
  private current: number;

  constructor(seed: number) {
    if (!Number.isFinite(seed)) {
      throw new DomainError('bad-seed', 'seed must be a finite number');
    }
    this.current = seed >>> 0;
  }

  get state(): number {
    return this.current;
  }

  nextUint32(): number {
    const draw = nextUint32(this.current);
    this.current = draw.state;
    return draw.value;
  }

  /** Unbiased integer in [0, maxExclusive) via rejection sampling. */
  nextInt(maxExclusive: number): number {
    if (!Number.isInteger(maxExclusive) || maxExclusive <= 0 || maxExclusive > UINT32_RANGE) {
      throw new DomainError('bad-range', `nextInt expects 1..2^32, got ${maxExclusive}`);
    }
    const limit = UINT32_RANGE - (UINT32_RANGE % maxExclusive);
    let value = this.nextUint32();
    while (value >= limit) {
      value = this.nextUint32();
    }
    return value % maxExclusive;
  }

  pick<T>(items: readonly T[]): T {
    if (items.length === 0) {
      throw new DomainError('empty-pick', 'cannot pick from an empty list');
    }
    return items[this.nextInt(items.length)] as T;
  }

  /** Fisher-Yates on a copy; the input array is never modified. */
  shuffle<T>(items: readonly T[]): T[] {
    const out = items.slice();
    for (let i = out.length - 1; i > 0; i -= 1) {
      const j = this.nextInt(i + 1);
      const tmp = out[i] as T;
      out[i] = out[j] as T;
      out[j] = tmp;
    }
    return out;
  }
}

export function createRng(seed: number): SeededRng {
  return new SeededRng(seed);
}
