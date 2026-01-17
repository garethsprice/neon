// Neon UI Kit - LED Button Component
// Toggle button with LED-style indicator

let stylesInjected = false;

function injectStyles() {
    if (stylesInjected) return;
    const style = document.createElement('style');
    style.textContent = `
        .neon-led-button {
            width: 28px;
            height: 14px;
            background: linear-gradient(180deg, #1a0033 0%, #0d0018 100%);
            border: 1px solid rgba(191,95,255,0.2);
            border-radius: 4px;
            cursor: pointer;
            box-shadow: inset 0 2px 4px rgba(0,0,0,0.5);
            transition: all 0.15s cubic-bezier(0.4, 0, 0.2, 1);
            padding: 0;
            outline: none;
        }
        .neon-led-button:focus-visible {
            outline: 2px solid rgba(0,255,255,0.5);
            outline-offset: 2px;
        }

        /* Active states by color */
        .neon-led-button.active.color-cyan {
            background: #00ffff;
            box-shadow: 0 0 15px #00ffff, 0 0 30px #00ffff, inset 0 0 10px rgba(255,255,255,0.3);
            border-color: #00ffff;
        }
        .neon-led-button.active.color-magenta {
            background: #ff00ff;
            box-shadow: 0 0 15px #ff00ff, 0 0 30px #ff00ff, inset 0 0 10px rgba(255,255,255,0.3);
            border-color: #ff00ff;
        }
        .neon-led-button.active.color-green {
            background: #39ff14;
            box-shadow: 0 0 15px #39ff14, 0 0 30px #39ff14, inset 0 0 10px rgba(255,255,255,0.3);
            border-color: #39ff14;
        }
        .neon-led-button.active.color-yellow {
            background: #ffff00;
            box-shadow: 0 0 15px #ffff00, 0 0 30px #ffff00, inset 0 0 10px rgba(255,255,255,0.3);
            border-color: #ffff00;
        }
        .neon-led-button.active.color-orange {
            background: #ff6600;
            box-shadow: 0 0 15px #ff6600, 0 0 30px #ff6600, inset 0 0 10px rgba(255,255,255,0.3);
            border-color: #ff6600;
        }
        .neon-led-button.active.color-purple {
            background: #bf5fff;
            box-shadow: 0 0 15px #bf5fff, 0 0 30px #bf5fff, inset 0 0 10px rgba(255,255,255,0.3);
            border-color: #bf5fff;
        }
        .neon-led-button.active.color-red {
            background: #ff3366;
            box-shadow: 0 0 15px #ff3366, 0 0 30px #ff3366, inset 0 0 10px rgba(255,255,255,0.3);
            border-color: #ff3366;
        }

        /* Hover states when not active */
        .neon-led-button:not(.active):hover {
            border-color: rgba(191,95,255,0.4);
            background: linear-gradient(180deg, #2a0044 0%, #1a0033 100%);
        }

        /* Disabled state */
        .neon-led-button:disabled {
            opacity: 0.4;
            cursor: not-allowed;
            filter: grayscale(0.7);
        }

        /* Container with label */
        .neon-led-unit {
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 4px;
            justify-content: center;
            min-width: 32px;
        }
        .neon-led-label {
            font-size: 0.55em;
            font-weight: 900;
            color: rgba(191,95,255,0.8);
            text-transform: uppercase;
            text-align: center;
            line-height: 1.1;
            letter-spacing: 1px;
            text-shadow: 0 0 5px rgba(191,95,255,0.4);
        }
    `;
    document.head.appendChild(style);
    stylesInjected = true;
}

/**
 * Create an LED toggle button
 * @param {Object} options
 * @param {string} [options.label] - Label text displayed below button
 * @param {boolean} [options.active=false] - Initial active state
 * @param {string} [options.color='cyan'] - Color when active: cyan, magenta, green, yellow, orange, purple, red
 * @param {Function} [options.onClick] - Click handler, receives new active state
 * @param {boolean} [options.toggle=true] - Whether clicking toggles the state
 * @param {boolean} [options.disabled=false] - Whether button is disabled
 * @returns {Object} { element, isActive, setActive, setDisabled, destroy }
 */
export function createLedButton(options = {}) {
    injectStyles();

    const {
        label = '',
        active = false,
        color = 'cyan',
        onClick = null,
        toggle = true,
        disabled = false
    } = options;

    let isActive = active;

    // Create container with label if label provided
    const container = document.createElement('div');
    container.className = 'neon-led-unit';

    const button = document.createElement('button');
    button.className = `neon-led-button color-${color}${isActive ? ' active' : ''}`;
    button.disabled = disabled;
    button.type = 'button';

    container.appendChild(button);

    if (label) {
        const labelEl = document.createElement('div');
        labelEl.className = 'neon-led-label';
        labelEl.textContent = label;
        container.appendChild(labelEl);
    }

    const handleClick = () => {
        if (button.disabled) return;

        if (toggle) {
            isActive = !isActive;
            button.classList.toggle('active', isActive);
        }
        onClick?.(isActive);
    };

    button.addEventListener('click', handleClick);

    return {
        element: label ? container : button,
        button,
        isActive: () => isActive,
        setActive: (value) => {
            isActive = value;
            button.classList.toggle('active', isActive);
        },
        setDisabled: (value) => {
            button.disabled = value;
        },
        setColor: (newColor) => {
            button.className = `neon-led-button color-${newColor}${isActive ? ' active' : ''}`;
        },
        destroy: () => {
            button.removeEventListener('click', handleClick);
        }
    };
}
