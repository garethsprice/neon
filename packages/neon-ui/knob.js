// Neon UI Kit - Knob Component
// A rotary knob control with CSS-in-JS

let stylesInjected = false;

function getStepPrecision(step) {
    const str = String(step);
    const decimalIndex = str.indexOf('.');
    return decimalIndex === -1 ? 0 : str.length - decimalIndex - 1;
}

function roundToStep(value, step) {
    const precision = getStepPrecision(step);
    const rounded = Math.round(value / step) * step;
    return Number(rounded.toFixed(precision));
}

function injectStyles() {
    if (stylesInjected) return;
    const style = document.createElement('style');
    style.textContent = `
        .neon-knob {
            display: flex;
            flex-direction: column;
            align-items: center;
            min-width: 44px;
        }
        .neon-knob label {
            font-size: 0.55em;
            margin-bottom: 6px;
            text-transform: uppercase;
            letter-spacing: 1px;
            color: rgba(0,255,255,0.7);
        }
        .neon-knob-wrapper {
            position: relative;
            width: 44px;
            height: 44px;
            cursor: ns-resize;
        }
        .neon-knob-outer {
            width: 100%;
            height: 100%;
            border-radius: 50%;
            background: linear-gradient(180deg, #1a1a2e 0%, #0a0a14 100%);
            border: 2px solid rgba(0,255,255,0.2);
            box-shadow: inset 0 3px 8px rgba(0,0,0,0.8), 0 0 15px rgba(0,255,255,0.1);
            display: flex;
            justify-content: center;
            align-items: center;
            position: relative;
            transition: all 0.2s;
        }
        .neon-knob-wrapper:hover .neon-knob-outer {
            border-color: rgba(0,255,255,0.5);
            box-shadow: inset 0 3px 8px rgba(0,0,0,0.8), 0 0 25px rgba(0,255,255,0.2);
        }
        .neon-knob-indicator {
            position: absolute;
            width: 3px;
            height: 12px;
            background: #00ffff;
            border-radius: 2px;
            top: 4px;
            transform-origin: 50% 18px;
            box-shadow: 0 0 12px #00ffff, 0 0 25px rgba(0,255,255,0.5);
        }
        .neon-knob-value {
            font-size: 0.55em;
            margin-top: 5px;
            color: #00ffff;
            font-family: monospace;
            font-weight: bold;
            text-shadow: 0 0 10px #00ffff;
        }

        /* Color variants */
        .neon-knob.color-cyan .neon-knob-indicator { background: #00ffff; box-shadow: 0 0 12px #00ffff, 0 0 25px rgba(0,255,255,0.5); }
        .neon-knob.color-cyan .neon-knob-value { color: #00ffff; text-shadow: 0 0 10px #00ffff; }
        .neon-knob.color-cyan label { color: rgba(0,255,255,0.7); }

        .neon-knob.color-magenta .neon-knob-indicator { background: #ff00ff; box-shadow: 0 0 12px #ff00ff, 0 0 25px rgba(255,0,255,0.5); }
        .neon-knob.color-magenta .neon-knob-value { color: #ff00ff; text-shadow: 0 0 10px #ff00ff; }
        .neon-knob.color-magenta label { color: rgba(255,0,255,0.7); }
        .neon-knob.color-magenta .neon-knob-outer { border-color: rgba(255,0,255,0.2); }
        .neon-knob.color-magenta .neon-knob-wrapper:hover .neon-knob-outer { border-color: rgba(255,0,255,0.5); box-shadow: inset 0 3px 8px rgba(0,0,0,0.8), 0 0 25px rgba(255,0,255,0.2); }

        .neon-knob.color-yellow .neon-knob-indicator { background: #ffff00; box-shadow: 0 0 12px #ffff00, 0 0 25px rgba(255,255,0,0.5); }
        .neon-knob.color-yellow .neon-knob-value { color: #ffff00; text-shadow: 0 0 10px #ffff00; }
        .neon-knob.color-yellow label { color: rgba(255,255,0,0.7); }
        .neon-knob.color-yellow .neon-knob-outer { border-color: rgba(255,255,0,0.3); }
        .neon-knob.color-yellow .neon-knob-wrapper:hover .neon-knob-outer { border-color: rgba(255,255,0,0.5); box-shadow: inset 0 3px 8px rgba(0,0,0,0.8), 0 0 25px rgba(255,255,0,0.2); }

        .neon-knob.color-green .neon-knob-indicator { background: #39ff14; box-shadow: 0 0 12px #39ff14, 0 0 25px rgba(57,255,20,0.5); }
        .neon-knob.color-green .neon-knob-value { color: #39ff14; text-shadow: 0 0 10px #39ff14; }
        .neon-knob.color-green label { color: rgba(57,255,20,0.7); }
        .neon-knob.color-green .neon-knob-outer { border-color: rgba(57,255,20,0.2); }
        .neon-knob.color-green .neon-knob-wrapper:hover .neon-knob-outer { border-color: rgba(57,255,20,0.5); box-shadow: inset 0 3px 8px rgba(0,0,0,0.8), 0 0 25px rgba(57,255,20,0.2); }

        .neon-knob.color-orange .neon-knob-indicator { background: #ff6600; box-shadow: 0 0 12px #ff6600, 0 0 25px rgba(255,102,0,0.5); }
        .neon-knob.color-orange .neon-knob-value { color: #ff6600; text-shadow: 0 0 10px #ff6600; }
        .neon-knob.color-orange label { color: rgba(255,102,0,0.7); }
        .neon-knob.color-orange .neon-knob-outer { border-color: rgba(255,102,0,0.2); }
        .neon-knob.color-orange .neon-knob-wrapper:hover .neon-knob-outer { border-color: rgba(255,102,0,0.5); box-shadow: inset 0 3px 8px rgba(0,0,0,0.8), 0 0 25px rgba(255,102,0,0.2); }

        .neon-knob.color-purple .neon-knob-indicator { background: #bf5fff; box-shadow: 0 0 12px #bf5fff, 0 0 25px rgba(191,95,255,0.5); }
        .neon-knob.color-purple .neon-knob-value { color: #bf5fff; text-shadow: 0 0 10px #bf5fff; }
        .neon-knob.color-purple label { color: rgba(191,95,255,0.7); }
        .neon-knob.color-purple .neon-knob-outer { border-color: rgba(191,95,255,0.2); }
        .neon-knob.color-purple .neon-knob-wrapper:hover .neon-knob-outer { border-color: rgba(191,95,255,0.5); box-shadow: inset 0 3px 8px rgba(0,0,0,0.8), 0 0 25px rgba(191,95,255,0.2); }

        /* Size variants */
        .neon-knob.size-small .neon-knob-wrapper { width: 30px; height: 30px; }
        .neon-knob.size-small .neon-knob-indicator { height: 7px; transform-origin: 50% 11px; top: 3px; }
        .neon-knob.size-small .neon-knob-value { font-size: 0.5em; margin-top: 2px; }

        .neon-knob.size-large .neon-knob-wrapper { width: 60px; height: 60px; }
        .neon-knob.size-large .neon-knob-indicator { height: 16px; transform-origin: 50% 24px; top: 6px; width: 4px; }
        .neon-knob.size-large .neon-knob-value { font-size: 0.7em; }
    `;
    document.head.appendChild(style);
    stylesInjected = true;
}

/**
 * Create a rotary knob control
 * @param {Object} options
 * @param {string} [options.label] - Label text displayed above knob
 * @param {number} [options.value=0] - Initial value
 * @param {number} [options.min=0] - Minimum value
 * @param {number} [options.max=100] - Maximum value
 * @param {number} [options.step=1] - Step increment
 * @param {Function} [options.onChange] - Callback when value changes
 * @param {Function} [options.onRelease] - Callback when user stops dragging
 * @param {string} [options.color='cyan'] - Color theme: cyan, magenta, yellow, green, orange, purple
 * @param {string} [options.size='medium'] - Size: small, medium, large
 * @param {Function} [options.formatValue] - Custom value formatter function
 * @returns {Object} { element, getValue, setValue, destroy }
 */
export function createKnob(options = {}) {
    injectStyles();

    const {
        label = '',
        value = 0,
        min = 0,
        max = 100,
        step = 1,
        onChange = null,
        onRelease = null,
        color = 'cyan',
        size = 'medium',
        formatValue = v => v
    } = options;

    let currentVal = Math.max(min, Math.min(max, value));
    let startY = 0;
    let startVal = 0;

    const element = document.createElement('div');
    element.className = `neon-knob color-${color}${size !== 'medium' ? ` size-${size}` : ''}`;
    element.innerHTML = `
        ${label ? `<label>${label}</label>` : ''}
        <div class="neon-knob-wrapper">
            <div class="neon-knob-outer">
                <div class="neon-knob-indicator"></div>
            </div>
        </div>
        <div class="neon-knob-value">${formatValue(currentVal)}</div>
    `;

    const wrapper = element.querySelector('.neon-knob-wrapper');
    const indicator = element.querySelector('.neon-knob-indicator');
    const valDisplay = element.querySelector('.neon-knob-value');

    const updateUI = (val) => {
        const percent = (max === min) ? 0 : (val - min) / (max - min);
        indicator.style.transform = `rotate(${-135 + (percent * 270)}deg)`;
        valDisplay.textContent = formatValue(val);
    };

    updateUI(currentVal);

    const handleMove = (e) => {
        const y = e.clientY ?? e.touches?.[0]?.clientY;
        if (y === undefined) return;

        const delta = startY - y;
        const range = max - min;
        let newVal = startVal + delta * (range / 200);

        // Apply step with proper precision
        newVal = roundToStep(newVal, step);
        newVal = Math.max(min, Math.min(max, newVal));

        if (newVal !== currentVal) {
            currentVal = newVal;
            updateUI(currentVal);
            onChange?.(currentVal);
        }
        if (e.cancelable) e.preventDefault();
    };

    const stop = () => {
        document.removeEventListener('mousemove', handleMove);
        document.removeEventListener('mouseup', stop);
        document.removeEventListener('touchmove', handleMove);
        document.removeEventListener('touchend', stop);
        onRelease?.(currentVal);
    };

    const start = (e) => {
        startY = e.clientY ?? e.touches?.[0]?.clientY;
        startVal = currentVal;
        document.addEventListener('mousemove', handleMove);
        document.addEventListener('mouseup', stop);
        document.addEventListener('touchmove', handleMove, { passive: false });
        document.addEventListener('touchend', stop);
        e.preventDefault();
    };

    wrapper.addEventListener('mousedown', start);
    wrapper.addEventListener('touchstart', start, { passive: false });

    return {
        element,
        getValue: () => currentVal,
        setValue: (val) => {
            currentVal = Math.max(min, Math.min(max, val));
            updateUI(currentVal);
        },
        setDisplayValue: (text) => {
            valDisplay.textContent = text;
        },
        destroy: () => {
            wrapper.removeEventListener('mousedown', start);
            wrapper.removeEventListener('touchstart', start);
            stop();
        }
    };
}

// Legacy API compatibility with original createKnobElement
// Uses original class names for backwards compatibility with existing code
export function createKnobElement(labelStr, initialValue, min, max, onChange, onRelease = null) {
    // Ensure styles are injected
    injectStyles();

    let currentVal = initialValue;
    let startY = 0;
    let startVal = 0;

    const unit = document.createElement('div');
    unit.className = 'knob-component';
    unit.innerHTML = `<label>${labelStr}</label><div class="knob-wrapper"><div class="knob-outer"><div class="knob-indicator"></div></div></div><div class="knob-value-display">${initialValue}</div>`;

    const wrapper = unit.querySelector('.knob-wrapper');
    const indicator = unit.querySelector('.knob-indicator');
    const valDisplay = unit.querySelector('.knob-value-display');

    const updateUI = (val) => {
        const percent = (max === min) ? 0 : (val - min) / (max - min);
        indicator.style.transform = `rotate(${-135 + (percent * 270)}deg)`;
        valDisplay.innerText = val;
    };

    unit.updateValue = (val) => { currentVal = val; updateUI(val); };
    updateUI(currentVal);

    const handleMove = (e) => {
        const y = e.clientY || e.touches?.[0].clientY;
        const delta = startY - y;
        let newVal = Math.round(startVal + delta * ((max - min) / 200));
        newVal = Math.max(min, Math.min(max, newVal));
        if (newVal !== currentVal) {
            currentVal = newVal;
            updateUI(currentVal);
            onChange(currentVal);
        }
        if (e.cancelable) e.preventDefault();
    };

    const stop = () => {
        document.removeEventListener('mousemove', handleMove);
        document.removeEventListener('mouseup', stop);
        document.removeEventListener('touchmove', handleMove);
        document.removeEventListener('touchend', stop);
        if (onRelease) onRelease();
    };

    const start = (e) => {
        startY = e.clientY || e.touches?.[0].clientY;
        startVal = currentVal;
        document.addEventListener('mousemove', handleMove);
        document.addEventListener('mouseup', stop);
        document.addEventListener('touchmove', handleMove, { passive: false });
        document.addEventListener('touchend', stop);
        e.preventDefault();
    };

    wrapper.addEventListener('mousedown', start);
    wrapper.addEventListener('touchstart', start, { passive: false });
    return unit;
}
