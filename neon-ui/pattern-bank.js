// Neon UI Kit - Pattern Bank Component
// 8-slot pattern selector grid (A-H)

let stylesInjected = false;

function injectStyles() {
    if (stylesInjected) return;
    const style = document.createElement('style');
    style.textContent = `
        .neon-pattern-bank {
            display: flex;
            flex-direction: column;
            gap: 6px;
        }

        .neon-pattern-bank-label {
            font-size: 0.55em;
            font-weight: 900;
            color: rgba(191,95,255,0.8);
            text-transform: uppercase;
            letter-spacing: 2px;
            text-shadow: 0 0 5px rgba(191,95,255,0.4);
        }

        .neon-pattern-bank-grid {
            display: flex;
            gap: 4px;
            flex-wrap: wrap;
        }

        .neon-pattern-slot {
            width: 32px;
            height: 32px;
            background: linear-gradient(180deg, #1a0033 0%, #0d0018 100%);
            border: 1px solid rgba(191,95,255,0.3);
            border-radius: 4px;
            position: relative;
            padding: 0;
            cursor: pointer;
            transition: all 0.15s cubic-bezier(0.4, 0, 0.2, 1);
            display: flex;
            align-items: center;
            justify-content: center;
            font-family: inherit;
            font-weight: 900;
            font-size: 0.7em;
            color: rgba(191,95,255,0.6);
            outline: none;
            letter-spacing: 1px;
        }

        .neon-pattern-slot:focus-visible {
            outline: 2px solid rgba(0,255,255,0.5);
            outline-offset: 2px;
        }

        /* LED indicator at top */
        .neon-pattern-slot::before {
            content: '';
            position: absolute;
            top: 4px;
            left: 50%;
            transform: translateX(-50%);
            width: 12px;
            height: 4px;
            border-radius: 2px;
            background: #1a0033;
            box-shadow: inset 0 1px 2px rgba(0,0,0,0.5);
            transition: inherit;
        }

        /* Slot label at bottom */
        .neon-pattern-slot span {
            position: absolute;
            bottom: 4px;
        }

        /* Hover state */
        .neon-pattern-slot:not(.active):not(:disabled):hover {
            border-color: rgba(191,95,255,0.5);
            background: linear-gradient(180deg, rgba(191,95,255,0.1) 0%, transparent 100%);
            color: rgba(191,95,255,0.8);
        }

        /* Has data state - dim glow */
        .neon-pattern-slot.has-data::before {
            background: rgba(0,255,255,0.4);
            box-shadow: 0 0 6px rgba(0,255,255,0.3);
        }

        /* Active state - cyan */
        .neon-pattern-slot.active.color-cyan {
            border-color: #00ffff;
            background: linear-gradient(180deg, rgba(0,255,255,0.2) 0%, rgba(0,255,255,0.05) 100%);
            box-shadow: 0 0 15px #00ffff, 0 0 30px rgba(0,255,255,0.3), inset 0 0 15px rgba(0,255,255,0.1);
            color: #00ffff;
            text-shadow: 0 0 10px #00ffff;
        }
        .neon-pattern-slot.active.color-cyan::before {
            background: #00ffff;
            box-shadow: 0 0 12px #00ffff, 0 0 25px #00ffff;
        }

        /* Active state - magenta */
        .neon-pattern-slot.active.color-magenta {
            border-color: #ff00ff;
            background: linear-gradient(180deg, rgba(255,0,255,0.2) 0%, rgba(255,0,255,0.05) 100%);
            box-shadow: 0 0 15px #ff00ff, 0 0 30px rgba(255,0,255,0.3), inset 0 0 15px rgba(255,0,255,0.1);
            color: #ff00ff;
            text-shadow: 0 0 10px #ff00ff;
        }
        .neon-pattern-slot.active.color-magenta::before {
            background: #ff00ff;
            box-shadow: 0 0 12px #ff00ff, 0 0 25px #ff00ff;
        }

        /* Active state - green */
        .neon-pattern-slot.active.color-green {
            border-color: #39ff14;
            background: linear-gradient(180deg, rgba(57,255,20,0.2) 0%, rgba(57,255,20,0.05) 100%);
            box-shadow: 0 0 15px #39ff14, 0 0 30px rgba(57,255,20,0.3), inset 0 0 15px rgba(57,255,20,0.1);
            color: #39ff14;
            text-shadow: 0 0 10px #39ff14;
        }
        .neon-pattern-slot.active.color-green::before {
            background: #39ff14;
            box-shadow: 0 0 12px #39ff14, 0 0 25px #39ff14;
        }

        /* Active state - orange */
        .neon-pattern-slot.active.color-orange {
            border-color: #ff6600;
            background: linear-gradient(180deg, rgba(255,102,0,0.25) 0%, rgba(255,102,0,0.1) 100%);
            box-shadow: 0 0 20px #ff6600, 0 0 40px rgba(255,102,0,0.3);
            color: #ff6600;
            text-shadow: 0 0 10px #ff6600;
        }
        .neon-pattern-slot.active.color-orange::before {
            background: #ff6600;
            box-shadow: 0 0 12px #ff6600, 0 0 25px #ff6600;
        }

        /* Copy mode indicator */
        .neon-pattern-bank.copy-mode .neon-pattern-slot:not(.copy-source) {
            animation: copy-target-pulse 0.8s ease-in-out infinite;
        }
        .neon-pattern-slot.copy-source {
            border-color: #ffff00;
            box-shadow: 0 0 20px #ffff00, 0 0 40px rgba(255,255,0,0.4);
        }
        .neon-pattern-slot.copy-source::before {
            background: #ffff00;
            box-shadow: 0 0 15px #ffff00;
        }

        @keyframes copy-target-pulse {
            0%, 100% { opacity: 0.6; }
            50% { opacity: 1; }
        }

        /* Disabled state */
        .neon-pattern-slot:disabled {
            opacity: 0.4;
            cursor: not-allowed;
            filter: grayscale(0.7);
        }
    `;
    document.head.appendChild(style);
    stylesInjected = true;
}

const PATTERN_IDS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];

/**
 * Create a pattern bank with 8 slots (A-H)
 * @param {Object} options
 * @param {number} [options.numSlots=8] - Number of pattern slots
 * @param {string} [options.activeColor='cyan'] - Color when active: cyan, magenta, green, orange
 * @param {string} [options.label='PATTERNS'] - Label text
 * @param {Function} [options.onSelect] - Called when a pattern is selected (id) => void
 * @param {Function} [options.onCopy] - Called on shift+click (fromId) => void
 * @param {Function} [options.onClear] - Called on ctrl+click (id) => void
 * @returns {Object} { element, setActivePattern, setPatternHasData, getActivePattern, destroy }
 */
export function createPatternBank(options = {}) {
    injectStyles();

    const {
        numSlots = 8,
        activeColor = 'cyan',
        label = 'PATTERNS',
        onSelect = null,
        onCopy = null,
        onClear = null
    } = options;

    let activePatternId = 'A';
    let copySourceId = null;
    const patternHasData = {};
    const slots = {};

    // Container
    const container = document.createElement('div');
    container.className = 'neon-pattern-bank';

    // Label
    if (label) {
        const labelEl = document.createElement('div');
        labelEl.className = 'neon-pattern-bank-label';
        labelEl.textContent = label;
        container.appendChild(labelEl);
    }

    // Grid
    const grid = document.createElement('div');
    grid.className = 'neon-pattern-bank-grid';
    container.appendChild(grid);

    // Create slots
    for (let i = 0; i < Math.min(numSlots, PATTERN_IDS.length); i++) {
        const id = PATTERN_IDS[i];
        const slot = document.createElement('button');
        slot.type = 'button';
        slot.className = `neon-pattern-slot color-${activeColor}`;
        slot.dataset.patternId = id;
        if (id === activePatternId) {
            slot.classList.add('active');
        }

        const labelSpan = document.createElement('span');
        labelSpan.textContent = id;
        slot.appendChild(labelSpan);

        slot.addEventListener('click', (e) => handleSlotClick(id, e));
        slot.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            handleClear(id);
        });

        grid.appendChild(slot);
        slots[id] = slot;
    }

    function handleSlotClick(id, e) {
        // Shift+click: initiate copy
        if (e.shiftKey && onCopy) {
            if (copySourceId === null) {
                // First click - set source
                copySourceId = id;
                container.classList.add('copy-mode');
                slots[id].classList.add('copy-source');
            } else if (copySourceId !== id) {
                // Second click - perform copy
                onCopy(copySourceId, id);
                exitCopyMode();
            } else {
                // Clicked same slot - cancel
                exitCopyMode();
            }
            return;
        }

        // Ctrl/Cmd+click: clear
        if ((e.ctrlKey || e.metaKey) && onClear) {
            handleClear(id);
            return;
        }

        // Normal click: select
        if (copySourceId !== null) {
            // In copy mode - this is the target
            if (onCopy && copySourceId !== id) {
                onCopy(copySourceId, id);
            }
            exitCopyMode();
            return;
        }

        setActivePattern(id);
        onSelect?.(id);
    }

    function handleClear(id) {
        if (onClear) {
            onClear(id);
        }
    }

    function exitCopyMode() {
        container.classList.remove('copy-mode');
        if (copySourceId && slots[copySourceId]) {
            slots[copySourceId].classList.remove('copy-source');
        }
        copySourceId = null;
    }

    function setActivePattern(id) {
        if (!PATTERN_IDS.includes(id)) return;

        // Remove active from previous
        if (slots[activePatternId]) {
            slots[activePatternId].classList.remove('active');
        }

        activePatternId = id;

        // Add active to new
        if (slots[id]) {
            slots[id].classList.add('active');
        }
    }

    function setPatternHasData(id, hasData) {
        patternHasData[id] = hasData;
        if (slots[id]) {
            slots[id].classList.toggle('has-data', hasData);
        }
    }

    function getActivePattern() {
        return activePatternId;
    }

    function destroy() {
        Object.values(slots).forEach(slot => {
            slot.replaceWith(slot.cloneNode(true));
        });
    }

    return {
        element: container,
        setActivePattern,
        setPatternHasData,
        getActivePattern,
        destroy
    };
}
