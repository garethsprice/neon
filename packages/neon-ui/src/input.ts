/**
 * Neon UI Kit - Input Component
 * Styled text, number, and textarea inputs
 */

let stylesInjected = false;

function injectStyles(): void {
  if (stylesInjected) return;
  const style = document.createElement('style');
  style.textContent = `
    /* Text Input */
    .neon-input {
      background: rgba(0,0,0,0.4);
      border: 1px solid rgba(57,255,20,0.3);
      color: #39ff14;
      font-family: inherit;
      font-size: 0.7em;
      font-weight: 900;
      letter-spacing: 2px;
      padding: 6px 10px;
      border-radius: 4px;
      text-shadow: 0 0 8px rgba(57,255,20,0.6), 0 0 15px rgba(57,255,20,0.3);
      transition: all 0.2s;
      outline: none;
      width: 100%;
      box-sizing: border-box;
    }
    .neon-input::placeholder {
      color: rgba(57,255,20,0.3);
    }
    .neon-input:focus {
      border-color: #39ff14;
      box-shadow: 0 0 15px rgba(57,255,20,0.4), inset 0 0 10px rgba(0,0,0,0.5);
      text-shadow: 0 0 12px rgba(57,255,20,0.8), 0 0 20px rgba(57,255,20,0.4);
    }

    /* Color variants */
    .neon-input.color-cyan {
      border-color: rgba(0,255,255,0.3);
      color: #00ffff;
      text-shadow: 0 0 8px rgba(0,255,255,0.6);
    }
    .neon-input.color-cyan::placeholder { color: rgba(0,255,255,0.3); }
    .neon-input.color-cyan:focus {
      border-color: #00ffff;
      box-shadow: 0 0 15px rgba(0,255,255,0.4), inset 0 0 10px rgba(0,0,0,0.5);
    }

    .neon-input.color-magenta {
      border-color: rgba(255,0,255,0.3);
      color: #ff00ff;
      text-shadow: 0 0 8px rgba(255,0,255,0.6);
    }
    .neon-input.color-magenta::placeholder { color: rgba(255,0,255,0.3); }
    .neon-input.color-magenta:focus {
      border-color: #ff00ff;
      box-shadow: 0 0 15px rgba(255,0,255,0.4), inset 0 0 10px rgba(0,0,0,0.5);
    }

    .neon-input.color-purple {
      border-color: rgba(191,95,255,0.3);
      color: #bf5fff;
      text-shadow: 0 0 8px rgba(191,95,255,0.6);
    }
    .neon-input.color-purple::placeholder { color: rgba(191,95,255,0.3); }
    .neon-input.color-purple:focus {
      border-color: #bf5fff;
      box-shadow: 0 0 15px rgba(191,95,255,0.4), inset 0 0 10px rgba(0,0,0,0.5);
    }

    /* Number Input */
    .neon-input.type-number {
      width: 48px;
      border-width: 2px;
      font-family: monospace;
      text-align: center;
      padding: 3px 2px;
      box-shadow: 0 0 10px rgba(57,255,20,0.3);
    }

    /* Textarea */
    .neon-textarea {
      background: transparent;
      border: none;
      color: #39ff14;
      font-family: inherit;
      font-size: 0.7em;
      line-height: 1.4;
      resize: vertical;
      outline: none;
      text-shadow: 0 0 8px rgba(57,255,20,0.5);
      width: 100%;
      min-height: 60px;
      box-sizing: border-box;
    }
    .neon-textarea::placeholder { color: rgba(57,255,20,0.3); }
    .neon-textarea:focus {
      text-shadow: 0 0 12px rgba(57,255,20,0.7), 0 0 20px rgba(57,255,20,0.3);
    }

    /* Textarea container */
    .neon-textarea-container {
      background: rgba(0,0,0,0.4);
      border: 1px solid rgba(57,255,20,0.2);
      border-radius: 4px;
      padding: 8px;
      transition: box-shadow 0.2s, border-color 0.2s;
    }
    .neon-textarea-container:focus-within {
      border-color: rgba(57,255,20,0.5);
      box-shadow: 0 0 15px rgba(57,255,20,0.2);
    }

    /* Input with label */
    .neon-input-group {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }
    .neon-input-label {
      font-size: 0.55em;
      font-weight: 900;
      color: rgba(57,255,20,0.6);
      letter-spacing: 1px;
      text-transform: uppercase;
    }
    .neon-input-label.color-cyan { color: rgba(0,255,255,0.6); }
    .neon-input-label.color-magenta { color: rgba(255,0,255,0.6); }
    .neon-input-label.color-purple { color: rgba(191,95,255,0.6); }
  `;
  document.head.appendChild(style);
  stylesInjected = true;
}

/** Input color type */
export type InputColor = 'green' | 'cyan' | 'magenta' | 'purple';

/** Input type */
export type InputType = 'text' | 'number';

/** Input options */
export interface InputOptions {
  label?: string;
  value?: string | number;
  placeholder?: string;
  color?: InputColor;
  type?: InputType;
  min?: number;
  max?: number;
  onChange?: ((value: string) => void) | null;
  onBlur?: ((value: string) => void) | null;
}

/** Input component interface */
export interface InputComponent {
  element: HTMLElement;
  input: HTMLInputElement;
  getValue: () => string | number;
  setValue: (value: string | number) => void;
  focus: () => void;
  setDisabled: (disabled: boolean) => void;
  destroy: () => void;
}

/**
 * Create a text input
 */
export function createInput(options: InputOptions = {}): InputComponent {
  injectStyles();

  const {
    label = '',
    value = '',
    placeholder = '',
    color = 'green',
    type = 'text',
    min,
    max,
    onChange = null,
    onBlur = null
  } = options;

  let container: HTMLElement | undefined;
  const input = document.createElement('input');
  input.type = type;
  input.className = `neon-input color-${color}${type === 'number' ? ' type-number' : ''}`;
  input.value = String(value);
  input.placeholder = placeholder;

  if (type === 'number') {
    if (min !== undefined) input.min = String(min);
    if (max !== undefined) input.max = String(max);
  }

  if (label) {
    container = document.createElement('div');
    container.className = 'neon-input-group';

    const labelEl = document.createElement('label');
    labelEl.className = `neon-input-label color-${color}`;
    labelEl.textContent = label;

    container.appendChild(labelEl);
    container.appendChild(input);
  }

  const handleInput = (): void => {
    onChange?.(input.value);
  };

  const handleBlur = (): void => {
    onBlur?.(input.value);
  };

  input.addEventListener('input', handleInput);
  input.addEventListener('blur', handleBlur);

  return {
    element: container || input,
    input,
    getValue: () => type === 'number' ? Number(input.value) : input.value,
    setValue: (val: string | number): void => { input.value = String(val); },
    focus: (): void => input.focus(),
    setDisabled: (disabled: boolean): void => { input.disabled = disabled; },
    destroy: (): void => {
      input.removeEventListener('input', handleInput);
      input.removeEventListener('blur', handleBlur);
    }
  };
}

/** Textarea options */
export interface TextareaOptions {
  label?: string;
  value?: string;
  placeholder?: string;
  color?: InputColor;
  rows?: number;
  onChange?: ((value: string) => void) | null;
}

/** Textarea component interface */
export interface TextareaComponent {
  element: HTMLElement;
  container: HTMLElement;
  textarea: HTMLTextAreaElement;
  getValue: () => string;
  setValue: (value: string) => void;
  focus: () => void;
  setDisabled: (disabled: boolean) => void;
  destroy: () => void;
}

/**
 * Create a textarea
 */
export function createTextarea(options: TextareaOptions = {}): TextareaComponent {
  injectStyles();

  const {
    label = '',
    value = '',
    placeholder = '',
    color = 'green',
    rows = 3,
    onChange = null
  } = options;

  const wrapper = document.createElement('div');

  if (label) {
    const labelEl = document.createElement('label');
    labelEl.className = `neon-input-label color-${color}`;
    labelEl.textContent = label;
    labelEl.style.marginBottom = '4px';
    labelEl.style.display = 'block';
    wrapper.appendChild(labelEl);
  }

  const container = document.createElement('div');
  container.className = 'neon-textarea-container';

  const textarea = document.createElement('textarea');
  textarea.className = 'neon-textarea';
  textarea.value = value;
  textarea.placeholder = placeholder;
  textarea.rows = rows;

  container.appendChild(textarea);
  wrapper.appendChild(container);

  const handleInput = (): void => {
    onChange?.(textarea.value);
  };

  textarea.addEventListener('input', handleInput);

  return {
    element: wrapper,
    container,
    textarea,
    getValue: () => textarea.value,
    setValue: (val: string): void => { textarea.value = val; },
    focus: (): void => textarea.focus(),
    setDisabled: (disabled: boolean): void => { textarea.disabled = disabled; },
    destroy: (): void => {
      textarea.removeEventListener('input', handleInput);
    }
  };
}
