/**
 * Neon UI Kit - Step Button Component
 * Sequencer step buttons with multiple states
 */

let stylesInjected = false;

function injectStyles(): void {
  if (stylesInjected) return;
  const style = document.createElement('style');
  style.textContent = `
    .neon-step-unit {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 4px;
    }
    .neon-step-number {
      font-size: 0.6em;
      font-weight: 900;
      color: rgba(191,95,255,0.5);
      font-family: monospace;
      letter-spacing: 1px;
    }
    .neon-step-button {
      width: 100%;
      background: linear-gradient(180deg, #1a0033 0%, #0d0018 100%);
      border: 1px solid rgba(191,95,255,0.2);
      border-radius: 4px;
      position: relative;
      cursor: pointer;
      display: flex;
      flex-direction: column;
      justify-content: center;
      align-items: center;
      color: rgba(191,95,255,0.4);
      font-size: 0.7em;
      font-weight: bold;
      transition: all 0.15s cubic-bezier(0.4,0,0.2,1);
      line-height: 1;
      aspect-ratio: 1/1;
      min-width: 0;
      padding: 0;
      outline: none;
    }
    .neon-step-button:focus-visible {
      outline: 2px solid rgba(0,255,255,0.5);
      outline-offset: 2px;
    }

    /* LED indicator at top */
    .neon-step-button::after {
      content: '';
      position: absolute;
      top: 6px;
      left: 50%;
      transform: translateX(-50%);
      width: 14px;
      height: 5px;
      border-radius: 2px;
      background: #0d0018;
      box-shadow: inset 0 1px 2px rgba(0,0,0,0.5);
      transition: all 0.15s;
    }

    /* Flam indicator */
    .neon-step-flam-indicator {
      display: none;
      font-size: 0.45em;
      color: #ff00ff;
      position: absolute;
      bottom: 6px;
      left: 50%;
      transform: translateX(-50%);
      letter-spacing: 1px;
      font-weight: 900;
      opacity: 0.3;
      transition: all 0.2s;
    }
    .neon-step-button.show-flam .neon-step-flam-indicator { display: block; }
    .neon-step-button.has-flam .neon-step-flam-indicator { opacity: 1; text-shadow: 0 0 10px #ff00ff; }

    /* Flam dot (when not in flam edit mode) */
    .neon-step-button.has-flam:not(.show-flam)::before {
      content: '';
      position: absolute;
      bottom: 6px;
      left: 6px;
      width: 7px;
      height: 7px;
      border-radius: 50%;
      background: #ff00ff;
      box-shadow: 0 0 10px #ff00ff, 0 0 20px #ff00ff;
      z-index: 2;
    }

    /* Normal ON state */
    .neon-step-button.on-normal {
      background: linear-gradient(180deg, rgba(0,255,255,0.15) 0%, rgba(0,255,255,0.05) 100%);
      border-color: #00ffff;
      box-shadow: 0 0 15px #00ffff, inset 0 0 10px rgba(0,255,255,0.1);
      color: #00ffff;
    }
    .neon-step-button.on-normal::after {
      animation: neon-step-led-pulse 0.8s infinite;
      background: #00ffff;
      box-shadow: 0 0 10px #00ffff, 0 0 20px #00ffff;
    }
    @keyframes neon-step-led-pulse {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.5; }
    }

    /* Accented ON state */
    .neon-step-button.on-accented {
      background: linear-gradient(180deg, rgba(0,255,255,0.25) 0%, rgba(0,255,255,0.1) 100%);
      border-color: #00ffff;
      box-shadow: 0 0 25px #00ffff, 0 0 50px rgba(0,255,255,0.3), inset 0 0 15px rgba(0,255,255,0.15);
      color: #fff;
      text-shadow: 0 0 10px #00ffff;
      transform: scale(1.02);
    }
    .neon-step-button.on-accented::after {
      background: #00ffff;
      box-shadow: 0 0 15px #00ffff, 0 0 30px #00ffff;
    }

    /* Active step (playhead) */
    .neon-step-button.active-step {
      border-color: #fff;
      box-shadow: 0 0 20px rgba(255,255,255,0.9), 0 0 40px rgba(255,255,255,0.4), inset 0 0 15px rgba(255,255,255,0.3);
      z-index: 10;
      transform: scale(1.08);
      background: linear-gradient(180deg, rgba(255,255,255,0.2) 0%, rgba(255,255,255,0.05) 100%);
    }

    /* Hit active (triggered) */
    .neon-step-button.hit-active {
      filter: brightness(1.8);
      transform: scale(1.15);
      box-shadow: 0 0 30px #00ffff, 0 0 60px rgba(0,255,255,0.5);
      z-index: 11;
    }

    /* Hover state */
    .neon-step-button:not(.on-normal):not(.on-accented):hover {
      border-color: rgba(191,95,255,0.4);
      background: linear-gradient(180deg, rgba(191,95,255,0.1) 0%, transparent 100%);
    }
  `;
  document.head.appendChild(style);
  stylesInjected = true;
}

/** Step value type: 0 = off, 1 = normal, 2 = accented */
export type StepValue = 0 | 1 | 2;

/** Step button options */
export interface StepButtonOptions {
  stepNumber?: number | null;
  value?: StepValue;
  hasFlam?: boolean;
  showFlam?: boolean;
  isActive?: boolean;
  onClick?: ((value: StepValue) => void) | null;
  onFlamToggle?: (() => void) | null;
}

/** Step button component interface */
export interface StepButtonComponent {
  element: HTMLElement;
  button: HTMLButtonElement;
  getValue: () => StepValue;
  setValue: (value: StepValue) => void;
  setActive: (active: boolean) => void;
  setHasFlam: (flam: boolean) => void;
  setShowFlam: (show: boolean) => void;
  triggerHit: (duration?: number) => void;
  destroy: () => void;
}

/**
 * Create a sequencer step button
 */
export function createStepButton(options: StepButtonOptions = {}): StepButtonComponent {
  injectStyles();

  const {
    stepNumber = null,
    value = 0,
    hasFlam = false,
    showFlam = false,
    isActive = false,
    onClick = null,
    onFlamToggle = null
  } = options;

  let currentValue: StepValue = value;
  let currentHasFlam = hasFlam;
  let currentShowFlam = showFlam;
  let currentIsActive = isActive;

  const container = document.createElement('div');
  container.className = 'neon-step-unit';

  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'neon-step-button';
  updateButtonClass();

  button.innerHTML = '<span class="neon-step-flam-indicator">FLAM</span>';

  container.appendChild(button);

  if (stepNumber !== null) {
    const numEl = document.createElement('div');
    numEl.className = 'neon-step-number';
    numEl.textContent = String(stepNumber);
    container.appendChild(numEl);
  }

  function updateButtonClass(): void {
    button.classList.remove('on-normal', 'on-accented', 'has-flam', 'show-flam', 'active-step');
    if (currentValue === 1) button.classList.add('on-normal');
    if (currentValue === 2) button.classList.add('on-accented');
    if (currentHasFlam) button.classList.add('has-flam');
    if (currentShowFlam) button.classList.add('show-flam');
    if (currentIsActive) button.classList.add('active-step');
  }

  const handleClick = (e: MouseEvent): void => {
    if (e.shiftKey && onFlamToggle) {
      onFlamToggle();
    } else {
      onClick?.(currentValue);
    }
  };

  button.addEventListener('click', handleClick);

  return {
    element: container,
    button,
    getValue: () => currentValue,
    setValue: (val: StepValue): void => {
      currentValue = val;
      updateButtonClass();
    },
    setActive: (active: boolean): void => {
      currentIsActive = active;
      button.classList.toggle('active-step', active);
    },
    setHasFlam: (flam: boolean): void => {
      currentHasFlam = flam;
      button.classList.toggle('has-flam', flam);
    },
    setShowFlam: (show: boolean): void => {
      currentShowFlam = show;
      button.classList.toggle('show-flam', show);
    },
    triggerHit: (duration: number = 100): void => {
      button.classList.add('hit-active');
      setTimeout(() => button.classList.remove('hit-active'), duration);
    },
    destroy: (): void => {
      button.removeEventListener('click', handleClick);
    }
  };
}

/** Step grid options */
export interface StepGridOptions {
  steps?: number;
  values?: StepValue[];
  flams?: boolean[];
  onStepClick?: ((stepIndex: number, value: StepValue) => void) | null;
  onFlamToggle?: ((stepIndex: number) => void) | null;
}

/** Step grid component interface */
export interface StepGridComponent {
  element: HTMLElement;
  steps: StepButtonComponent[];
  getValues: () => StepValue[];
  setValues: (values: StepValue[]) => void;
  setFlams: (flams: boolean[]) => void;
  setActiveStep: (index: number) => void;
  setShowFlams: (show: boolean) => void;
  triggerStep: (index: number, duration?: number) => void;
}

/**
 * Create a grid of step buttons
 */
export function createStepGrid(options: StepGridOptions = {}): StepGridComponent {
  injectStyles();

  const {
    steps = 16,
    values = [],
    flams = [],
    onStepClick = null,
    onFlamToggle = null
  } = options;

  const container = document.createElement('div');
  container.className = 'neon-steps-grid';
  container.style.cssText = 'display: grid; grid-template-columns: repeat(16, 1fr); gap: 4px; padding: 8px 0;';

  const stepButtons: StepButtonComponent[] = [];

  for (let i = 0; i < steps; i++) {
    const step = createStepButton({
      stepNumber: i + 1,
      value: (values[i] || 0) as StepValue,
      hasFlam: flams[i] || false,
      onClick: (val) => onStepClick?.(i, val),
      onFlamToggle: () => onFlamToggle?.(i)
    });
    stepButtons.push(step);
    container.appendChild(step.element);
  }

  return {
    element: container,
    steps: stepButtons,
    getValues: () => stepButtons.map(s => s.getValue()),
    setValues: (vals: StepValue[]): void => {
      stepButtons.forEach((s, i) => s.setValue((vals[i] || 0) as StepValue));
    },
    setFlams: (flamArray: boolean[]): void => {
      stepButtons.forEach((s, i) => s.setHasFlam(flamArray[i] || false));
    },
    setActiveStep: (index: number): void => {
      stepButtons.forEach((s, i) => s.setActive(i === index));
    },
    setShowFlams: (show: boolean): void => {
      stepButtons.forEach(s => s.setShowFlam(show));
    },
    triggerStep: (index: number, duration: number = 100): void => {
      stepButtons[index]?.triggerHit(duration);
    }
  };
}
