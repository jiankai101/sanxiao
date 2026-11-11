import { PANEL_FADE_CLASS, applyPanelFade } from '../ui/panel-fade';

export type ScreenId = 'level-select' | 'game';
export type PanelId = 'settings' | 'leaderboard' | 'result' | 'pause';

export interface RouterElements {
  screens: Record<ScreenId, HTMLElement>;
  panels: Record<PanelId, HTMLElement>;
}

export interface RouterOptions {
  /** Live reduced-motion flag (settings OR prefers-reduced-motion). */
  isReducedMotion?: () => boolean;
}

/** 视图/面板切换；只改可见性与 aria-hidden，不触碰业务状态。 */
export class Router {
  private screen: ScreenId = 'level-select';
  private panel: PanelId | null = null;
  private opener: HTMLElement | null = null;
  private reducedMotion = false;

  constructor(private readonly elements: RouterElements, private readonly options: RouterOptions = {}) {
    this.apply();
  }

  get currentScreen(): ScreenId {
    return this.screen;
  }

  get currentPanel(): PanelId | null {
    return this.panel;
  }

  setReducedMotion(reduced: boolean): void {
    this.reducedMotion = reduced;
  }

  showScreen(id: ScreenId): void {
    this.screen = id;
    this.apply();
  }

  openPanel(id: PanelId): void {
    if (typeof document !== 'undefined') this.opener = document.activeElement as HTMLElement | null;
    this.panel = id;
    this.apply();
    const reduced = this.options.isReducedMotion ? this.options.isReducedMotion() : this.reducedMotion;
    applyPanelFade(this.elements.panels[id], reduced);
  }

  closePanel(id?: PanelId): void {
    if (id && this.panel !== id) return;
    this.panel = null;
    this.apply();
    this.opener?.focus?.();
    this.opener = null;
  }

  closeAllPanels(): void {
    this.panel = null;
    this.apply();
  }

  private apply(): void {
    for (const [id, el] of Object.entries(this.elements.screens) as [ScreenId, HTMLElement][]) {
      const active = id === this.screen;
      el.classList.toggle('hidden', !active);
      el.setAttribute('aria-hidden', active ? 'false' : 'true');
    }
    for (const [id, el] of Object.entries(this.elements.panels) as [PanelId, HTMLElement][]) {
      const active = id === this.panel;
      el.classList.toggle('hidden', !active);
      el.setAttribute('aria-hidden', active ? 'false' : 'true');
      if (!active) el.classList.remove(PANEL_FADE_CLASS);
    }
  }
}
