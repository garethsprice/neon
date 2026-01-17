// Neon UI Kit - Action Button Component
// Styled action buttons for primary actions

let stylesInjected = false;

function injectStyles() {
    if (stylesInjected) return;
    const style = document.createElement('style');
    style.textContent = `
        .neon-action-button {
            background: linear-gradient(180deg, #2a0044 0%, #1a0033 100%);
            color: #fff;
            border: 1px solid rgba(191,95,255,0.3);
            border-radius: 4px;
            padding: 8px 14px;
            cursor: pointer;
            font-family: inherit;
            font-weight: 900;
            font-size: 0.7em;
            letter-spacing: 1px;
            transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
            outline: none;
            text-transform: uppercase;
        }
        .neon-action-button:focus-visible {
            outline: 2px solid rgba(0,255,255,0.5);
            outline-offset: 2px;
        }
        .neon-action-button:hover:not(:disabled) {
            background: linear-gradient(180deg, #3a0066 0%, #2a0044 100%);
            box-shadow: 0 0 15px rgba(191,95,255,0.3);
        }
        .neon-action-button:active:not(:disabled) {
            transform: translateY(1px);
        }

        /* Primary variant - gradient */
        .neon-action-button.variant-primary {
            background: linear-gradient(135deg, #7c3aed 0%, #a855f7 50%, #ec4899 100%);
            border: none;
            box-shadow: 0 0 20px rgba(168,85,247,0.5), 0 0 40px rgba(168,85,247,0.2);
            text-shadow: 0 1px 2px rgba(0,0,0,0.3);
        }
        .neon-action-button.variant-primary:hover:not(:disabled) {
            box-shadow: 0 0 30px rgba(168,85,247,0.7), 0 0 60px rgba(168,85,247,0.3);
            transform: translateY(-1px);
        }

        /* Attract/demo pulse animation */
        .neon-action-button.attract {
            animation: neon-action-attract 2s ease-in-out infinite;
            background: linear-gradient(135deg, #ec4899 0%, #f472b6 50%, #a855f7 100%);
        }
        @keyframes neon-action-attract {
            0%, 100% {
                box-shadow: 0 0 20px rgba(236,72,153,0.6), 0 0 40px rgba(236,72,153,0.3), 0 0 60px rgba(168,85,247,0.2);
                transform: scale(1);
            }
            50% {
                box-shadow: 0 0 30px rgba(236,72,153,0.8), 0 0 60px rgba(236,72,153,0.5), 0 0 80px rgba(168,85,247,0.3);
                transform: scale(1.05);
            }
        }

        /* Color variants */
        .neon-action-button.color-cyan {
            color: #00ffff;
            border-color: #00ffff;
            background: linear-gradient(180deg, rgba(0,255,255,0.15) 0%, transparent 100%);
            text-shadow: 0 0 10px #00ffff;
        }
        .neon-action-button.color-cyan:hover:not(:disabled) {
            box-shadow: 0 0 20px rgba(0,255,255,0.5);
        }

        .neon-action-button.color-magenta {
            color: #ff00ff;
            border-color: #ff00ff;
            background: linear-gradient(180deg, rgba(255,0,255,0.15) 0%, transparent 100%);
            text-shadow: 0 0 10px #ff00ff;
        }
        .neon-action-button.color-magenta:hover:not(:disabled) {
            box-shadow: 0 0 20px rgba(255,0,255,0.5);
        }

        .neon-action-button.color-green {
            color: #39ff14;
            border-color: #39ff14;
            background: linear-gradient(180deg, rgba(57,255,20,0.15) 0%, transparent 100%);
            text-shadow: 0 0 10px #39ff14;
        }
        .neon-action-button.color-green:hover:not(:disabled) {
            box-shadow: 0 0 20px rgba(57,255,20,0.5);
        }

        .neon-action-button.color-purple {
            color: #a855f7;
            border-color: rgba(168,85,247,0.4);
            background: linear-gradient(180deg, rgba(168,85,247,0.2) 0%, rgba(168,85,247,0.05) 100%);
            text-shadow: 0 0 8px rgba(168,85,247,0.5);
        }
        .neon-action-button.color-purple:hover:not(:disabled) {
            box-shadow: 0 0 15px rgba(168,85,247,0.4);
        }

        /* Size variants */
        .neon-action-button.size-small {
            padding: 4px 12px;
            font-size: 0.65em;
        }
        .neon-action-button.size-large {
            padding: 12px 20px;
            font-size: 0.85em;
        }

        /* Icon button variant */
        .neon-action-button.icon-button {
            width: 28px;
            height: 28px;
            padding: 0;
            display: flex;
            align-items: center;
            justify-content: center;
            background: rgba(191,95,255,0.1);
            border: 1px solid rgba(191,95,255,0.2);
            color: rgba(191,95,255,0.8);
        }
        .neon-action-button.icon-button:hover:not(:disabled) {
            background: rgba(191,95,255,0.2);
            color: #fff;
        }
        .neon-action-button.icon-button svg,
        .neon-action-button.icon-button .lucide {
            width: 14px;
            height: 14px;
        }

        /* Disabled state */
        .neon-action-button:disabled {
            opacity: 0.4;
            cursor: not-allowed;
            filter: grayscale(0.7);
        }

        /* Loading state */
        .neon-action-button.loading {
            pointer-events: none;
            position: relative;
            color: transparent;
        }
        .neon-action-button.loading::after {
            content: '';
            position: absolute;
            width: 14px;
            height: 14px;
            top: 50%;
            left: 50%;
            margin: -7px 0 0 -7px;
            border: 2px solid rgba(255,255,255,0.3);
            border-top-color: #fff;
            border-radius: 50%;
            animation: neon-action-spin 0.6s linear infinite;
        }
        @keyframes neon-action-spin {
            to { transform: rotate(360deg); }
        }
    `;
    document.head.appendChild(style);
    stylesInjected = true;
}

/**
 * Create an action button
 * @param {Object} options
 * @param {string} [options.text='Button'] - Button text
 * @param {string} [options.variant='default'] - Variant: default, primary
 * @param {string} [options.color] - Color override: cyan, magenta, green, purple
 * @param {string} [options.size='medium'] - Size: small, medium, large
 * @param {boolean} [options.icon=false] - Whether this is an icon-only button
 * @param {string} [options.iconHtml] - HTML for icon content
 * @param {Function} [options.onClick] - Click handler
 * @param {boolean} [options.disabled=false] - Whether button is disabled
 * @returns {Object} { element, setLoading, setDisabled, setText, setAttract, destroy }
 */
export function createActionButton(options = {}) {
    injectStyles();

    const {
        text = 'Button',
        variant = 'default',
        color = null,
        size = 'medium',
        icon = false,
        iconHtml = '',
        onClick = null,
        disabled = false
    } = options;

    const button = document.createElement('button');
    button.type = 'button';

    let classes = ['neon-action-button'];
    if (variant !== 'default') classes.push(`variant-${variant}`);
    if (color) classes.push(`color-${color}`);
    if (size !== 'medium') classes.push(`size-${size}`);
    if (icon) classes.push('icon-button');

    button.className = classes.join(' ');
    button.disabled = disabled;

    if (icon && iconHtml) {
        button.innerHTML = iconHtml;
    } else {
        button.textContent = text;
    }

    const handleClick = () => {
        if (button.disabled || button.classList.contains('loading')) return;
        onClick?.();
    };

    button.addEventListener('click', handleClick);

    return {
        element: button,
        setLoading: (loading) => {
            button.classList.toggle('loading', loading);
        },
        setDisabled: (value) => {
            button.disabled = value;
        },
        setText: (newText) => {
            if (!icon) button.textContent = newText;
        },
        setAttract: (attract) => {
            button.classList.toggle('attract', attract);
        },
        setColor: (newColor) => {
            button.className = button.className.replace(/color-\w+/g, '');
            if (newColor) button.classList.add(`color-${newColor}`);
        },
        destroy: () => {
            button.removeEventListener('click', handleClick);
        }
    };
}
