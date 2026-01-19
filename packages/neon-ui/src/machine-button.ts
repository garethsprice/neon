/**
 * Neon UI Kit - Machine Button Component
 * Square machine-style buttons with LED indicators
 */

import type { NeonColor } from './types';

let stylesInjected = false;

function injectStyles(): void {
  if (stylesInjected) return;
  const style = document.createElement('style');
  style.textContent = `
    .neon-machine-button {
      width: 30px;
      height: 30px;
      background: linear-gradient(180deg, #1a0033 0%, #0d0018 100%);
      border: 1px solid rgba(191,95,255,0.3);
      border-radius: 4px;
      position: relative;
      padding: 0;
      cursor: pointer;
      transition: all 0.15s cubic-bezier(0.4, 0, 0.2, 1);
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: flex-end;
      padding-bottom: 3px;
      font-family: inherit;
      font-weight: bold;
      outline: none;
    }
    .neon-machine-button:focus-visible {
      outline: 2px solid rgba(0,255,255,0.5);
      outline-offset: 2px;
    }

    /* LED indicator at top */
    .neon-machine-button::before {
      content: '';
      position: absolute;
      top: 5px;
      left: 50%;
      transform: translateX(-50%);
      width: 14px;
      height: 5px;
      border-radius: 2px;
      background: #1a0033;
      box-shadow: inset 0 1px 2px rgba(0,0,0,0.5);
      transition: inherit;
    }

    /* Hover state */
    .neon-machine-button:not(.active):not(:disabled):hover {
      border-color: rgba(191,95,255,0.5);
      background: linear-gradient(180deg, rgba(191,95,255,0.1) 0%, transparent 100%);
    }

    /* Active state - cyan */
    .neon-machine-button.active.color-cyan {
      border-color: #00ffff;
      background: linear-gradient(180deg, rgba(0,255,255,0.2) 0%, rgba(0,255,255,0.05) 100%);
      box-shadow: 0 0 15px #00ffff, 0 0 30px rgba(0,255,255,0.3), inset 0 0 15px rgba(0,255,255,0.1);
    }
    .neon-machine-button.active.color-cyan::before {
      background: #00ffff;
      box-shadow: 0 0 12px #00ffff, 0 0 25px #00ffff;
    }

    /* Active state - magenta */
    .neon-machine-button.active.color-magenta {
      border-color: #ff00ff;
      background: linear-gradient(180deg, rgba(255,0,255,0.2) 0%, rgba(255,0,255,0.05) 100%);
      box-shadow: 0 0 15px #ff00ff, 0 0 30px rgba(255,0,255,0.3), inset 0 0 15px rgba(255,0,255,0.1);
    }
    .neon-machine-button.active.color-magenta::before {
      background: #ff00ff;
      box-shadow: 0 0 12px #ff00ff, 0 0 25px #ff00ff;
    }

    /* Active state - green */
    .neon-machine-button.active.color-green {
      border-color: #39ff14;
      background: linear-gradient(180deg, rgba(57,255,20,0.2) 0%, rgba(57,255,20,0.05) 100%);
      box-shadow: 0 0 15px #39ff14, 0 0 30px rgba(57,255,20,0.3), inset 0 0 15px rgba(57,255,20,0.1);
    }
    .neon-machine-button.active.color-green::before {
      background: #39ff14;
      box-shadow: 0 0 12px #39ff14, 0 0 25px #39ff14;
    }

    /* Active state - orange */
    .neon-machine-button.active.color-orange {
      border-color: #ff6600;
      background: linear-gradient(180deg, rgba(255,102,0,0.25) 0%, rgba(255,102,0,0.1) 100%);
      box-shadow: 0 0 20px #ff6600, 0 0 40px rgba(255,102,0,0.3);
    }
    .neon-machine-button.active.color-orange::before {
      background: #ff6600;
      box-shadow: 0 0 12px #ff6600, 0 0 25px #ff6600;
    }

    /* Active state - purple */
    .neon-machine-button.active.color-purple {
      border-color: #bf5fff;
      background: linear-gradient(180deg, rgba(191,95,255,0.2) 0%, rgba(191,95,255,0.05) 100%);
      box-shadow: 0 0 15px #bf5fff, 0 0 30px rgba(191,95,255,0.3), inset 0 0 15px rgba(191,95,255,0.1);
    }
    .neon-machine-button.active.color-purple::before {
      background: #bf5fff;
      box-shadow: 0 0 12px #bf5fff, 0 0 25px #bf5fff;
    }

    /* Empty state */
    .neon-machine-button.empty {
      opacity: 0.35;
      filter: grayscale(0.7) brightness(0.8);
    }
    .neon-machine-button.empty.active {
      opacity: 1;
      filter: none;
    }

    /* Trigger flash state */
    .neon-machine-button.trigger {
      background: #00ffff !important;
      color: #000 !important;
      box-shadow: 0 0 30px #00ffff, 0 0 60px rgba(0,255,255,0.5);
      border-color: #fff;
      transform: scale(1.1);
      z-index: 2;
    }
    .neon-machine-button.trigger::before {
      background: #fff;
      box-shadow: 0 0 20px #fff;
    }

    /* Pulse animations */
    .neon-machine-button.pulse-cyan {
      animation: neon-pulse-cyan 2s ease-in-out infinite;
      border-color: #00ffff;
    }
    .neon-machine-button.pulse-cyan::before { background: #00ffff; box-shadow: 0 0 8px #00ffff; }

    .neon-machine-button.pulse-magenta {
      animation: neon-pulse-magenta 2s ease-in-out infinite;
      border-color: #ff00ff;
    }
    .neon-machine-button.pulse-magenta::before { background: #ff00ff; box-shadow: 0 0 8px #ff00ff; }

    .neon-machine-button.pulse-green {
      animation: neon-pulse-green 2s ease-in-out infinite;
      border-color: #39ff14;
    }
    .neon-machine-button.pulse-green::before { background: #39ff14; box-shadow: 0 0 8px #39ff14; }

    @keyframes neon-pulse-cyan {
      0%, 100% { box-shadow: 0 0 10px rgba(0,255,255,0.3); }
      50% { box-shadow: 0 0 25px rgba(0,255,255,0.6), 0 0 40px rgba(0,255,255,0.3); }
    }
    @keyframes neon-pulse-magenta {
      0%, 100% { box-shadow: 0 0 10px rgba(255,0,255,0.3); }
      50% { box-shadow: 0 0 25px rgba(255,0,255,0.6), 0 0 40px rgba(255,0,255,0.3); }
    }
    @keyframes neon-pulse-green {
      0%, 100% { box-shadow: 0 0 10px rgba(57,255,20,0.3); }
      50% { box-shadow: 0 0 25px rgba(57,255,20,0.6), 0 0 40px rgba(57,255,20,0.3); }
    }

    /* Disabled state */
    .neon-machine-button:disabled {
      opacity: 0.4;
      cursor: not-allowed;
      filter: grayscale(0.7);
    }

    /* Container with label */
    .neon-machine-unit {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 4px;
      justify-content: center;
      min-width: 32px;
    }
    .neon-machine-label {
      font-size: 0.55em;
      font-weight: 900;
      color: rgba(191,95,255,0.8);
      text-transform: uppercase;
      text-align: center;
      line-height: 1.1;
      letter-spacing: 1px;
      text-shadow: 0 0 5px rgba(191,95,255,0.4);
    }
    .neon-machine-label.color-orange {
      color: rgba(255,102,0,0.7);
      text-shadow: 0 0 5px rgba(255,102,0,0.4);
    }
    .neon-machine-label.color-green {
      color: rgba(57,255,20,0.7);
      text-shadow: 0 0 5px rgba(57,255,20,0.4);
    }
  `;
  document.head.appendChild(style);
  stylesInjected = true;
}

/** Machine button options */
export interface MachineButtonOptions {
  label?: string;
  active?: boolean;
  color?: NeonColor;
  empty?: boolean;
  onClick?: ((active: boolean) => void) | null;
  onDoubleClick?: (() => void) | null;
  toggle?: boolean;
  disabled?: boolean;
  content?: string;
}

/** Machine button component interface */
export interface MachineButtonComponent {
  element: HTMLElement;
  button: HTMLButtonElement;
  isActive: () => boolean;
  setActive: (value: boolean) => void;
  isEmpty: () => boolean;
  setEmpty: (value: boolean) => void;
  setDisabled: (value: boolean) => void;
  setColor: (color: NeonColor) => void;
  trigger: (duration?: number) => void;
  setPulse: (pulseColor: NeonColor | null) => void;
  destroy: () => void;
}

/**
 * Create a machine-style button with LED indicator
 */
export function createMachineButton(options: MachineButtonOptions = {}): MachineButtonComponent {
  injectStyles();

  const {
    label = '',
    active = false,
    color = 'cyan' as NeonColor,
    empty = false,
    onClick = null,
    onDoubleClick = null,
    toggle = false,
    disabled = false,
    content = ''
  } = options;

  let isActive = active;
  let isEmpty = empty;

  const container = document.createElement('div');
  container.className = 'neon-machine-unit';

  const button = document.createElement('button');
  button.className = `neon-machine-button color-${color}${isActive ? ' active' : ''}${isEmpty ? ' empty' : ''}`;
  button.disabled = disabled;
  button.type = 'button';
  if (content) button.textContent = content;

  container.appendChild(button);

  if (label) {
    const labelEl = document.createElement('div');
    labelEl.className = `neon-machine-label color-${color}`;
    labelEl.textContent = label;
    container.appendChild(labelEl);
  }

  const handleClick = (): void => {
    if (button.disabled) return;
    if (toggle) {
      isActive = !isActive;
      button.classList.toggle('active', isActive);
    }
    onClick?.(isActive);
  };

  const handleDoubleClick = (): void => {
    if (button.disabled) return;
    onDoubleClick?.();
  };

  button.addEventListener('click', handleClick);
  if (onDoubleClick) {
    button.addEventListener('dblclick', handleDoubleClick);
  }

  return {
    element: label ? container : button,
    button,
    isActive: () => isActive,
    setActive: (value: boolean): void => {
      isActive = value;
      button.classList.toggle('active', isActive);
    },
    isEmpty: () => isEmpty,
    setEmpty: (value: boolean): void => {
      isEmpty = value;
      button.classList.toggle('empty', isEmpty);
    },
    setDisabled: (value: boolean): void => {
      button.disabled = value;
    },
    setColor: (newColor: NeonColor): void => {
      // Remove old color class
      button.className = button.className.replace(/color-\w+/g, '');
      button.classList.add(`color-${newColor}`);
    },
    trigger: (duration: number = 80): void => {
      button.classList.add('trigger');
      setTimeout(() => button.classList.remove('trigger'), duration);
    },
    setPulse: (pulseColor: NeonColor | null): void => {
      button.classList.remove('pulse-cyan', 'pulse-magenta', 'pulse-green');
      if (pulseColor) {
        button.classList.add(`pulse-${pulseColor}`);
      }
    },
    destroy: (): void => {
      button.removeEventListener('click', handleClick);
      button.removeEventListener('dblclick', handleDoubleClick);
    }
  };
}
