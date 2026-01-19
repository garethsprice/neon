/**
 * Neon UI Kit - FX Module Component
 * Collapsible effect module with toggle and nested controls
 */

import { createKnob, type KnobComponent } from './knob';

let stylesInjected = false;

function injectStyles(): void {
  if (stylesInjected) return;
  const style = document.createElement('style');
  style.textContent = `
    .neon-fx-module {
      background: linear-gradient(180deg, rgba(191,95,255,0.06) 0%, rgba(0,0,0,0.15) 100%);
      padding: 8px;
      margin-bottom: 8px;
      border: 1px solid rgba(191,95,255,0.1);
      border-radius: 4px;
    }
    .neon-fx-header {
      margin: 0 0 6px 0;
      padding-top: 3px;
      font-size: 0.65em;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 4px;
      color: #bf5fff;
      cursor: pointer;
      transition: all 0.2s;
      letter-spacing: 1px;
      font-weight: 900;
    }
    .neon-fx-header:hover { color: #39ff14; }

    .neon-fx-toggle {
      width: 14px;
      height: 5px;
      background: #1a0033;
      border: 1px solid rgba(191,95,255,0.2);
      border-radius: 2px;
      transition: all 0.15s;
    }
    .neon-fx-module.enabled .neon-fx-toggle {
      background: #39ff14;
      box-shadow: 0 0 10px #39ff14, 0 0 20px #39ff14;
      border-color: #39ff14;
    }
    .neon-fx-module.enabled .neon-fx-header {
      color: #39ff14;
      text-shadow: 0 0 10px rgba(57,255,20,0.5);
    }

    .neon-fx-controls {
      display: flex;
      flex-wrap: wrap;
      justify-content: center;
      gap: 6px 4px;
    }

    /* Smaller knobs for FX controls */
    .neon-fx-module .neon-knob {
      flex: 0 0 48%;
      min-width: 70px;
      padding: 2px 0;
    }
    .neon-fx-module .neon-knob label {
      font-size: 0.5em;
      opacity: 0.7;
      color: #bf5fff;
    }
    .neon-fx-module .neon-knob-wrapper {
      width: 34px;
      height: 34px;
    }
    .neon-fx-module .neon-knob-indicator {
      height: 9px;
      transform-origin: 50% 13px;
      background: #ff00ff;
      box-shadow: 0 0 10px #ff00ff, 0 0 20px rgba(255,0,255,0.5);
    }
    .neon-fx-module .neon-knob-value {
      color: #ff00ff;
      text-shadow: 0 0 8px #ff00ff;
      font-size: 0.5em;
    }

    /* AI focus state */
    .neon-fx-module.ai-focus {
      background: linear-gradient(180deg, rgba(255,0,255,0.15) 0%, rgba(255,0,255,0.05) 100%) !important;
      border: 2px solid #ff00ff !important;
      box-shadow: 0 0 30px rgba(255,0,255,0.5) !important;
    }
  `;
  document.head.appendChild(style);
  stylesInjected = true;
}

/** Control definition for FX module knobs */
export interface FxControlDefinition {
  /** Control label */
  label: string;
  /** Initial value */
  value?: number;
  /** Minimum value */
  min?: number;
  /** Maximum value */
  max?: number;
  /** Called when value changes */
  onChange?: (value: number) => void;
}

/** Options for creating an FX module */
export interface FxModuleOptions {
  /** Module name (displayed in header) */
  name?: string;
  /** Initial enabled state */
  enabled?: boolean;
  /** Array of control definitions */
  controls?: FxControlDefinition[];
  /** Called when module is enabled/disabled */
  onToggle?: ((enabled: boolean) => void) | null;
}

/** FX module component interface */
export interface FxModuleComponent {
  /** The module element */
  element: HTMLElement;
  /** Check if module is enabled */
  isEnabled: () => boolean;
  /** Set enabled state */
  setEnabled: (value: boolean) => void;
  /** Get a control by label */
  getControl: (label: string) => KnobComponent | undefined;
  /** Set a control value by label */
  setControlValue: (label: string, value: number) => void;
  /** Set AI focus state */
  setFocus: (focused: boolean) => void;
  /** Destroy the module and clean up */
  destroy: () => void;
}

/**
 * Create an FX module with toggle and knob controls
 */
export function createFxModule(options: FxModuleOptions = {}): FxModuleComponent {
  injectStyles();

  const {
    name = 'FX',
    enabled = false,
    controls = [],
    onToggle = null
  } = options;

  let isEnabled = enabled;
  const knobRefs: Record<string, KnobComponent> = {};

  const element = document.createElement('div');
  element.className = `neon-fx-module${isEnabled ? ' enabled' : ''}`;

  const header = document.createElement('div');
  header.className = 'neon-fx-header';
  header.innerHTML = `
    <div class="neon-fx-toggle"></div>
    <span>${name.toUpperCase().replace('FILTER', ' FILTER')}</span>
  `;

  const controlsContainer = document.createElement('div');
  controlsContainer.className = 'neon-fx-controls';

  element.appendChild(header);
  element.appendChild(controlsContainer);

  // Create knobs for each control
  controls.forEach(ctrl => {
    const knob = createKnob({
      label: ctrl.label,
      value: ctrl.value ?? 0,
      min: ctrl.min ?? 0,
      max: ctrl.max ?? 100,
      color: 'magenta',
      onChange: (val: number) => {
        if (isEnabled) {
          ctrl.onChange?.(val);
        }
      }
    });
    knobRefs[ctrl.label] = knob;
    controlsContainer.appendChild(knob.element);
  });

  const handleHeaderClick = (): void => {
    isEnabled = !isEnabled;
    element.classList.toggle('enabled', isEnabled);
    onToggle?.(isEnabled);
  };

  header.addEventListener('click', handleHeaderClick);

  return {
    element,
    isEnabled: () => isEnabled,
    setEnabled: (value: boolean): void => {
      isEnabled = value;
      element.classList.toggle('enabled', isEnabled);
    },
    getControl: (label: string) => knobRefs[label],
    setControlValue: (label: string, value: number): void => {
      knobRefs[label]?.setValue(value);
    },
    setFocus: (focused: boolean): void => {
      element.classList.toggle('ai-focus', focused);
    },
    destroy: (): void => {
      header.removeEventListener('click', handleHeaderClick);
      Object.values(knobRefs).forEach(k => k.destroy?.());
    }
  };
}

/** Page configuration for FX pager */
export type FxPageConfig = FxModuleOptions;

/** Options for creating an FX pager */
export interface FxPagerOptions {
  /** Array of pages, each page is array of module configs */
  pages?: FxPageConfig[][];
  /** Called when page changes */
  onPageChange?: ((pageIndex: number) => void) | null;
}

/** FX pager component interface */
export interface FxPagerComponent {
  /** The pager element */
  element: HTMLElement;
  /** Get current page index */
  getCurrentPage: () => number;
  /** Set the current page */
  setPage: (page: number) => void;
  /** Get all module references on current page */
  getModules: () => FxModuleComponent[];
  /** Destroy the pager and clean up */
  destroy: () => void;
}

/**
 * Create an FX pager for multiple pages of FX modules
 */
export function createFxPager(options: FxPagerOptions = {}): FxPagerComponent {
  injectStyles();

  // Inject pager-specific styles
  const pagerId = 'neon-fx-pager-styles';
  if (!document.getElementById(pagerId)) {
    const style = document.createElement('style');
    style.id = pagerId;
    style.textContent = `
      .neon-fx-pager {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 10px;
        background: rgba(191,95,255,0.1);
        padding: 4px 8px;
        border-radius: 4px;
        border: 1px solid rgba(191,95,255,0.15);
      }
      .neon-fx-pager-info {
        font-size: 0.7em;
        font-weight: 900;
        color: #ff00ff;
        font-family: monospace;
        text-shadow: 0 0 8px #ff00ff;
      }
      .neon-fx-pager-btn {
        padding: 4px 12px;
        font-size: 0.8em;
        background: linear-gradient(180deg, #2a0044 0%, #1a0033 100%);
        color: #fff;
        border: 1px solid rgba(191,95,255,0.3);
        border-radius: 4px;
        cursor: pointer;
        font-weight: 900;
        transition: all 0.2s;
      }
      .neon-fx-pager-btn:hover {
        background: linear-gradient(180deg, #3a0066 0%, #2a0044 100%);
        color: #00ffff;
        box-shadow: 0 0 10px rgba(0,255,255,0.3);
      }
    `;
    document.head.appendChild(style);
  }

  const {
    pages = [],
    onPageChange = null
  } = options;

  let currentPage = 0;
  let moduleRefs: FxModuleComponent[] = [];

  const element = document.createElement('div');

  // Pager controls
  const pager = document.createElement('div');
  pager.className = 'neon-fx-pager';
  pager.innerHTML = `
    <button class="neon-fx-pager-btn neon-fx-prev">&lt;</button>
    <span class="neon-fx-pager-info">1 / ${pages.length}</span>
    <button class="neon-fx-pager-btn neon-fx-next">&gt;</button>
  `;

  const container = document.createElement('div');
  container.className = 'neon-fx-container';

  element.appendChild(pager);
  element.appendChild(container);

  const infoEl = pager.querySelector('.neon-fx-pager-info') as HTMLElement;
  const prevBtn = pager.querySelector('.neon-fx-prev') as HTMLButtonElement;
  const nextBtn = pager.querySelector('.neon-fx-next') as HTMLButtonElement;

  function renderPage(): void {
    // Destroy old modules
    moduleRefs.forEach(m => m.destroy?.());
    moduleRefs = [];
    container.innerHTML = '';

    const pageModules = pages[currentPage] || [];
    pageModules.forEach(config => {
      const module = createFxModule(config);
      moduleRefs.push(module);
      container.appendChild(module.element);
    });

    infoEl.textContent = `${currentPage + 1} / ${pages.length}`;
    onPageChange?.(currentPage);
  }

  prevBtn.addEventListener('click', () => {
    currentPage = (currentPage - 1 + pages.length) % pages.length;
    renderPage();
  });

  nextBtn.addEventListener('click', () => {
    currentPage = (currentPage + 1) % pages.length;
    renderPage();
  });

  renderPage();

  return {
    element,
    getCurrentPage: () => currentPage,
    setPage: (page: number): void => {
      currentPage = Math.max(0, Math.min(pages.length - 1, page));
      renderPage();
    },
    getModules: () => moduleRefs,
    destroy: (): void => {
      moduleRefs.forEach(m => m.destroy?.());
    }
  };
}
