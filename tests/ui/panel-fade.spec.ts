import { describe, expect, it } from 'vitest';
import { PANEL_FADE_MS, REDUCED_MOTION_MAX_MS } from '../../src/core/constants';
import { PANEL_FADE_CLASS, panelFadeDuration } from '../../src/ui/panel-fade';

describe('REQ-044 panel fade duration', () => {
  it('uses 200ms normally and <=100ms with reduced motion', () => {
    expect(PANEL_FADE_MS).toBe(200);
    expect(panelFadeDuration(false)).toBe(200);
    expect(panelFadeDuration(true)).toBe(REDUCED_MOTION_MAX_MS);
    expect(panelFadeDuration(true)).toBeLessThanOrEqual(100);
  });

  it('exposes the CSS class used by the router', () => {
    expect(PANEL_FADE_CLASS).toBe('panel-fade-in');
  });
});
