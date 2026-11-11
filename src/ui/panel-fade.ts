/**
 * Panel fade-in (REQ-044): 200ms normally, <=100ms with reduced motion.
 * Only opacity is animated, so reduced motion never introduces displacement.
 */
import { PANEL_FADE_MS, REDUCED_MOTION_MAX_MS } from '@core/constants';

export const PANEL_FADE_CLASS = 'panel-fade-in';

export function panelFadeDuration(reduced: boolean): number {
  return reduced ? Math.min(PANEL_FADE_MS, REDUCED_MOTION_MAX_MS) : PANEL_FADE_MS;
}

/** Restarts the CSS fade on `element`; returns the duration applied in ms. */
export function applyPanelFade(element: HTMLElement, reduced: boolean): number {
  const duration = panelFadeDuration(reduced);
  element.classList.remove(PANEL_FADE_CLASS);
  element.style.setProperty('--panel-fade-ms', `${duration}ms`);
  // Force a style flush so re-opening the same panel restarts the animation.
  void element.offsetWidth;
  element.classList.add(PANEL_FADE_CLASS);
  return duration;
}
