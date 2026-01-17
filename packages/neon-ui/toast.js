// Neon UI Kit - Toast Component
// Notification toast messages with CSS-in-JS

let stylesInjected = false;
let containerEl = null;

function injectStyles() {
    if (stylesInjected) return;
    const style = document.createElement('style');
    style.textContent = `
        .neon-toast-container {
            position: fixed;
            bottom: 25px;
            left: 50%;
            transform: translateX(-50%);
            z-index: 9999;
            display: flex;
            flex-direction: column;
            gap: 12px;
            pointer-events: none;
        }
        .neon-toast {
            background: linear-gradient(180deg, rgba(13,0,24,0.98) 0%, rgba(5,0,10,0.98) 100%);
            color: #fff;
            padding: 14px 24px;
            border-radius: 6px;
            font-size: 0.9em;
            font-weight: 900;
            letter-spacing: 1px;
            border-left: 4px solid #00ffff;
            box-shadow: 0 5px 30px rgba(0,0,0,0.6), 0 0 30px rgba(0,255,255,0.2);
            min-width: 280px;
            max-width: 90vw;
            display: flex;
            justify-content: space-between;
            align-items: center;
            pointer-events: auto;
            animation: neon-toast-in 0.3s cubic-bezier(0.175,0.885,0.32,1.275) forwards;
        }
        .neon-toast.error {
            border-left-color: #ff3366;
            color: #ffcccc;
            box-shadow: 0 5px 30px rgba(0,0,0,0.6), 0 0 30px rgba(255,51,102,0.2);
        }
        .neon-toast.info {
            border-left-color: #bf5fff;
            color: #bf5fff;
            box-shadow: 0 5px 30px rgba(0,0,0,0.6), 0 0 30px rgba(191,95,255,0.2);
        }
        .neon-toast.success {
            border-left-color: #39ff14;
            color: #39ff14;
            box-shadow: 0 5px 30px rgba(0,0,0,0.6), 0 0 30px rgba(57,255,20,0.2);
        }
        .neon-toast.warning {
            border-left-color: #ffff00;
            color: #ffff00;
            box-shadow: 0 5px 30px rgba(0,0,0,0.6), 0 0 30px rgba(255,255,0,0.2);
        }
        @keyframes neon-toast-in {
            from { opacity: 0; transform: translateY(30px) scale(0.9); }
            to { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes neon-toast-out {
            from { opacity: 1; transform: scale(1); }
            to { opacity: 0; transform: scale(0.9); }
        }
    `;
    document.head.appendChild(style);
    stylesInjected = true;
}

function getContainer() {
    if (containerEl && document.body.contains(containerEl)) {
        return containerEl;
    }
    containerEl = document.createElement('div');
    containerEl.className = 'neon-toast-container';
    document.body.appendChild(containerEl);
    return containerEl;
}

/**
 * Show a toast notification
 * @param {string} message - Message to display
 * @param {string} [type='info'] - Type: 'success', 'error', 'warning', 'info'
 * @param {number} [duration=4000] - Duration in ms before auto-dismiss
 * @returns {Object} { dismiss } - Call dismiss() to manually remove the toast
 */
export function showToast(message, type = 'info', duration = 4000) {
    injectStyles();

    const container = getContainer();
    const toast = document.createElement('div');
    toast.className = `neon-toast ${type}`;
    toast.innerHTML = `<span>${message}</span>`;
    container.appendChild(toast);

    let dismissed = false;

    const dismiss = () => {
        if (dismissed) return;
        dismissed = true;
        toast.style.animation = 'neon-toast-out 0.3s ease forwards';
        setTimeout(() => toast.remove(), 300);
    };

    const timeoutId = setTimeout(dismiss, duration);

    return {
        dismiss: () => {
            clearTimeout(timeoutId);
            dismiss();
        }
    };
}

/**
 * Configure toast defaults
 * @param {Object} options
 * @param {string} [options.position='bottom-center'] - Position: 'top-left', 'top-center', 'top-right', 'bottom-left', 'bottom-center', 'bottom-right'
 */
export function configureToast(options = {}) {
    injectStyles();

    const { position = 'bottom-center' } = options;
    const container = getContainer();

    // Reset positioning
    container.style.top = '';
    container.style.bottom = '';
    container.style.left = '';
    container.style.right = '';
    container.style.transform = '';

    const positions = {
        'top-left': { top: '25px', left: '25px' },
        'top-center': { top: '25px', left: '50%', transform: 'translateX(-50%)' },
        'top-right': { top: '25px', right: '25px' },
        'bottom-left': { bottom: '25px', left: '25px' },
        'bottom-center': { bottom: '25px', left: '50%', transform: 'translateX(-50%)' },
        'bottom-right': { bottom: '25px', right: '25px' }
    };

    const pos = positions[position] || positions['bottom-center'];
    Object.assign(container.style, pos);
}
