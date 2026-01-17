// Neon UI Kit - Input Component
// Styled text, number, and textarea inputs

let stylesInjected = false;

function injectStyles() {
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

/**
 * Create a text input
 * @param {Object} options
 * @param {string} [options.label] - Label text
 * @param {string} [options.value=''] - Initial value
 * @param {string} [options.placeholder=''] - Placeholder text
 * @param {string} [options.color='green'] - Color: green, cyan, magenta, purple
 * @param {string} [options.type='text'] - Input type: text, number
 * @param {number} [options.min] - Min value (for number type)
 * @param {number} [options.max] - Max value (for number type)
 * @param {Function} [options.onChange] - Called on input
 * @param {Function} [options.onBlur] - Called on blur
 * @returns {Object} { element, input, getValue, setValue, focus, destroy }
 */
export function createInput(options = {}) {
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

    let container;
    const input = document.createElement('input');
    input.type = type;
    input.className = `neon-input color-${color}${type === 'number' ? ' type-number' : ''}`;
    input.value = value;
    input.placeholder = placeholder;

    if (type === 'number') {
        if (min !== undefined) input.min = min;
        if (max !== undefined) input.max = max;
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

    const handleInput = () => {
        onChange?.(input.value);
    };

    const handleBlur = () => {
        onBlur?.(input.value);
    };

    input.addEventListener('input', handleInput);
    input.addEventListener('blur', handleBlur);

    return {
        element: container || input,
        input,
        getValue: () => type === 'number' ? Number(input.value) : input.value,
        setValue: (val) => { input.value = val; },
        focus: () => input.focus(),
        setDisabled: (disabled) => { input.disabled = disabled; },
        destroy: () => {
            input.removeEventListener('input', handleInput);
            input.removeEventListener('blur', handleBlur);
        }
    };
}

/**
 * Create a textarea
 * @param {Object} options
 * @param {string} [options.label] - Label text
 * @param {string} [options.value=''] - Initial value
 * @param {string} [options.placeholder=''] - Placeholder text
 * @param {string} [options.color='green'] - Color: green, cyan, magenta, purple
 * @param {number} [options.rows=3] - Number of rows
 * @param {Function} [options.onChange] - Called on input
 * @returns {Object} { element, textarea, getValue, setValue, focus, destroy }
 */
export function createTextarea(options = {}) {
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

    const handleInput = () => {
        onChange?.(textarea.value);
    };

    textarea.addEventListener('input', handleInput);

    return {
        element: wrapper,
        container,
        textarea,
        getValue: () => textarea.value,
        setValue: (val) => { textarea.value = val; },
        focus: () => textarea.focus(),
        setDisabled: (disabled) => { textarea.disabled = disabled; },
        destroy: () => {
            textarea.removeEventListener('input', handleInput);
        }
    };
}
