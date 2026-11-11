declare global {
  const __TEST__: boolean;

  interface WmgTestHooks {
    startLevel(levelId: number): void;
    state(): { status: string; levelId: number; seed: number; score: number; movesLeft: number } | null;
    findMove(): { a: { row: number; col: number }; b: { row: number; col: number } } | null;
    swap(a: { row: number; col: number }, b: { row: number; col: number }): void;
    selected(): { row: number; col: number } | null;
    openSettings(): void;
    openLeaderboard(): void;
    backToSelect(): void;
    animations(): Array<{ kind: string; durationMs: number; reduced: boolean }>;
    resetAnimations(): void;
    panelUnlockAt(): number | null;
    shuffleEvents(): number;
    audio(): { unlocked: boolean; playing: boolean; unavailable: boolean };
    motionDurations(): {
      full: Record<'swap' | 'revert' | 'clear' | 'fall' | 'special' | 'panel', number>;
      reduced: Record<'swap' | 'revert' | 'clear' | 'fall' | 'special' | 'panel', number>;
    };
  }

  interface Window {
    __wmgTest?: WmgTestHooks;
    __wmgPerf?: () => { p95: number; lowFpsRatio: number; samples: number };
  }
}

export {};


