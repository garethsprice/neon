// Neon UI Kit - Keyboard Component
// Interactive piano keyboard for synth/music applications

let stylesInjected = false;

function injectStyles() {
    if (stylesInjected) return;
    const style = document.createElement('style');
    style.textContent = `
        .neon-keyboard-wrapper {
            display: flex;
            flex-direction: column;
            gap: 8px;
            min-width: 0; /* Allow flex shrinking */
            width: 100%;
        }

        .neon-keyboard-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
        }

        .neon-keyboard-label {
            font-size: 0.6em;
            font-weight: 900;
            letter-spacing: 3px;
            color: #bf5fff;
            text-shadow: 0 0 8px rgba(191,95,255,0.5);
        }

        .neon-keyboard-expand-btn {
            background: linear-gradient(180deg, #1a0033 0%, #0d0018 100%);
            border: 1px solid rgba(191,95,255,0.3);
            color: rgba(191,95,255,0.7);
            padding: 4px 10px;
            font-size: 0.55rem;
            font-weight: 900;
            letter-spacing: 1px;
            border-radius: 4px;
            cursor: pointer;
            transition: all 0.15s cubic-bezier(0.4, 0, 0.2, 1);
            text-transform: uppercase;
        }
        .neon-keyboard-expand-btn:hover {
            border-color: #00ffff;
            color: #00ffff;
            box-shadow: 0 0 15px rgba(0,255,255,0.3);
        }
        .neon-keyboard-expand-btn.expanded {
            border-color: #00ffff;
            color: #00ffff;
            background: linear-gradient(180deg, rgba(0,255,255,0.15) 0%, rgba(0,255,255,0.05) 100%);
        }

        .neon-keyboard-scroll-container {
            overflow-x: auto;
            overflow-y: hidden;
            border-radius: 4px;
            scrollbar-width: thin;
            scrollbar-color: rgba(191,95,255,0.5) rgba(0,0,0,0.3);
            min-width: 0; /* Allow flex shrinking */
            width: 100%;
        }
        .neon-keyboard-scroll-container::-webkit-scrollbar {
            height: 8px;
        }
        .neon-keyboard-scroll-container::-webkit-scrollbar-track {
            background: rgba(0,0,0,0.3);
            border-radius: 4px;
        }
        .neon-keyboard-scroll-container::-webkit-scrollbar-thumb {
            background: rgba(191,95,255,0.5);
            border-radius: 4px;
        }
        .neon-keyboard-scroll-container::-webkit-scrollbar-thumb:hover {
            background: rgba(191,95,255,0.7);
        }

        .neon-keyboard {
            display: flex;
            height: 100px;
            gap: 2px;
            border-radius: 4px;
            overflow: hidden;
            user-select: none;
            -webkit-tap-highlight-color: transparent;
        }

        .neon-keyboard.size-small {
            height: 70px;
        }
        .neon-keyboard.size-large {
            height: 130px;
        }

        .neon-keyboard.expanded {
            min-width: max-content;
        }

        .neon-keyboard-key {
            display: flex;
            align-items: flex-end;
            justify-content: center;
            padding-bottom: 8px;
            cursor: pointer;
            font-size: 0.5rem;
            font-weight: bold;
            transition: all 0.1s;
            border-radius: 0 0 4px 4px;
            touch-action: none;
            flex-shrink: 0;
        }

        .neon-keyboard-key span {
            pointer-events: none;
        }

        /* Keys fill available space */
        .neon-keyboard .neon-keyboard-key {
            flex: 1;
            min-width: 0;
        }

        /* Scrollable mode - uniform key widths for scroll sync with piano roll */
        .neon-keyboard.scrollable {
            min-width: max-content; /* Don't shrink below content */
        }
        .neon-keyboard.scrollable .neon-keyboard-key.white {
            flex: none;
            width: 36px;
        }
        .neon-keyboard.scrollable .neon-keyboard-key.black {
            flex: none;
            width: 36px; /* Same as white for uniform grid alignment */
            margin: 0; /* Remove overlap for uniform spacing */
            height: 65%;
        }

        .neon-keyboard-key.white {
            background: linear-gradient(180deg, #f0f0ff 0%, #d0d0e0 100%);
            color: #333;
            border: 1px solid rgba(191,95,255,0.3);
        }

        .neon-keyboard-key.black {
            background: linear-gradient(180deg, #1a1a2e 0%, #0a0a14 100%);
            color: rgba(191,95,255,0.6);
            border: 1px solid rgba(191,95,255,0.3);
            height: 65%;
            margin: 0 -8px;
            z-index: 2;
            font-size: 0.4rem;
        }

        .neon-keyboard-key:hover {
            filter: brightness(1.1);
        }

        /* Active states - white keys */
        .neon-keyboard-key.white.active {
            background: #00ffff;
            color: #000;
            box-shadow: 0 0 20px #00ffff, inset 0 0 10px rgba(255,255,255,0.3);
        }
        .neon-keyboard-key.white.active.color-magenta {
            background: #ff00ff;
            box-shadow: 0 0 20px #ff00ff, inset 0 0 10px rgba(255,255,255,0.3);
        }
        .neon-keyboard-key.white.active.color-green {
            background: #39ff14;
            box-shadow: 0 0 20px #39ff14, inset 0 0 10px rgba(255,255,255,0.3);
        }
        .neon-keyboard-key.white.active.color-yellow {
            background: #ffff00;
            box-shadow: 0 0 20px #ffff00, inset 0 0 10px rgba(255,255,255,0.3);
        }
        .neon-keyboard-key.white.active.color-orange {
            background: #ff6600;
            box-shadow: 0 0 20px #ff6600, inset 0 0 10px rgba(255,255,255,0.3);
        }
        .neon-keyboard-key.white.active.color-purple {
            background: #bf5fff;
            box-shadow: 0 0 20px #bf5fff, inset 0 0 10px rgba(255,255,255,0.3);
        }

        /* Active states - black keys */
        .neon-keyboard-key.black.active {
            background: #ff00ff;
            color: #fff;
            box-shadow: 0 0 20px #ff00ff, inset 0 0 10px rgba(255,255,255,0.3);
        }
        .neon-keyboard-key.black.active.color-cyan {
            background: #00ffff;
            color: #000;
            box-shadow: 0 0 20px #00ffff, inset 0 0 10px rgba(255,255,255,0.3);
        }
        .neon-keyboard-key.black.active.color-green {
            background: #39ff14;
            color: #000;
            box-shadow: 0 0 20px #39ff14, inset 0 0 10px rgba(255,255,255,0.3);
        }
        .neon-keyboard-key.black.active.color-yellow {
            background: #ffff00;
            color: #000;
            box-shadow: 0 0 20px #ffff00, inset 0 0 10px rgba(255,255,255,0.3);
        }
        .neon-keyboard-key.black.active.color-orange {
            background: #ff6600;
            color: #000;
            box-shadow: 0 0 20px #ff6600, inset 0 0 10px rgba(255,255,255,0.3);
        }
        .neon-keyboard-key.black.active.color-purple {
            background: #bf5fff;
            color: #fff;
            box-shadow: 0 0 20px #bf5fff, inset 0 0 10px rgba(255,255,255,0.3);
        }

        /* Highlighted key state (for sequencer playback etc.) */
        .neon-keyboard-key.highlighted {
            outline: 2px solid #bf5fff;
            outline-offset: -2px;
        }

        /* Stuck key state (double-click to hold) */
        .neon-keyboard-key.stuck.white {
            background: linear-gradient(180deg, #39ff14 0%, #2ecc0f 100%);
            color: #000;
            box-shadow: 0 0 25px #39ff14, inset 0 0 10px rgba(255,255,255,0.3);
        }
        .neon-keyboard-key.stuck.black {
            background: linear-gradient(180deg, #ff00ff 0%, #cc00cc 100%);
            color: #fff;
            box-shadow: 0 0 25px #ff00ff, inset 0 0 10px rgba(255,255,255,0.3);
        }

        /* Disabled state */
        .neon-keyboard.disabled .neon-keyboard-key {
            opacity: 0.5;
            cursor: not-allowed;
            pointer-events: none;
        }

        /* Container with label */
        .neon-keyboard-container {
            display: flex;
            flex-direction: column;
            gap: 8px;
            min-width: 0; /* Allow flex shrinking */
            width: 100%;
        }
        .neon-keyboard-settings {
            display: flex;
            gap: 15px;
            align-items: center;
        }
        .neon-keyboard-setting {
            display: flex;
            align-items: center;
            gap: 8px;
        }
        .neon-keyboard-setting-label {
            font-size: 0.55rem;
            font-weight: 900;
            color: rgba(191,95,255,0.7);
            letter-spacing: 1px;
        }
        .neon-keyboard-select {
            background: #0a0014;
            border: 1px solid rgba(191,95,255,0.3);
            color: #00ffff;
            padding: 5px 10px;
            font-size: 0.7rem;
            font-weight: bold;
            border-radius: 4px;
            cursor: pointer;
            outline: none;
        }
        .neon-keyboard-select:focus {
            border-color: #00ffff;
            box-shadow: 0 0 10px rgba(0,255,255,0.3);
        }
    `;
    document.head.appendChild(style);
    stylesInjected = true;
}

const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

/**
 * Calculate frequency from key index
 * @param {number} keyIndex - Key index relative to root
 * @param {number} rootNoteIndex - Root note (0=C, 1=C#, etc.)
 * @param {number} startOctave - Starting octave
 * @returns {number} Frequency in Hz
 */
function getFrequency(keyIndex, rootNoteIndex, startOctave) {
    const totalNoteIndex = rootNoteIndex + keyIndex;
    const octave = Math.floor(totalNoteIndex / 12) + startOctave;
    const note = totalNoteIndex % 12;
    const midi = (octave + 1) * 12 + note;
    return 440 * Math.pow(2, (midi - 69) / 12);
}

/**
 * Create an interactive keyboard
 * @param {Object} options
 * @param {string} [options.label] - Label text displayed above keyboard
 * @param {number} [options.numKeys=12] - Number of keys to display (default one octave)
 * @param {number} [options.rootNote=0] - Root note index (0=C, 1=C#, etc.)
 * @param {number} [options.octave=3] - Starting octave
 * @param {string} [options.size='medium'] - Size: small, medium, large
 * @param {string} [options.whiteKeyColor='cyan'] - Active color for white keys
 * @param {string} [options.blackKeyColor='magenta'] - Active color for black keys
 * @param {boolean} [options.showLabels=true] - Show note labels on keys
 * @param {boolean} [options.showSettings=false] - Show root/octave selectors
 * @param {boolean} [options.expandable=false] - Show expand/collapse toggle for full piano
 * @param {number} [options.expandedKeys=88] - Number of keys when expanded (full piano)
 * @param {Function} [options.onNoteOn] - Called when note starts: (keyIndex, frequency, noteName)
 * @param {Function} [options.onNoteOff] - Called when note ends: (keyIndex)
 * @param {Function} [options.onRangeChange] - Called when root/octave changes: (rootNote, octave)
 * @param {Function} [options.onExpandChange] - Called when expand state changes: (isExpanded)
 * @param {boolean} [options.disabled=false] - Whether keyboard is disabled
 * @returns {Object} { element, setRange, setDisabled, highlightKey, clearHighlights, getActiveKeys, destroy }
 */
export function createKeyboard(options = {}) {
    injectStyles();

    const {
        label = '',
        numKeys = 12,
        rootNote = 0,
        octave = 3,
        size = 'medium',
        whiteKeyColor = 'cyan',
        blackKeyColor = 'magenta',
        showLabels = true,
        showSettings = false,
        expandable = false,
        expandedKeys = 88,
        onNoteOn = null,
        onNoteOff = null,
        onRangeChange = null,
        onExpandChange = null,
        disabled = false
    } = options;

    let currentRootNote = rootNote;
    let currentOctave = octave;
    let isDisabled = disabled;
    let isExpanded = false;
    let currentNumKeys = numKeys;
    const activeKeys = new Set();
    const stuckKeys = new Set(); // Keys held on via double-click
    const keyElements = [];
    const eventListeners = [];

    // Create wrapper
    const wrapper = document.createElement('div');
    wrapper.className = 'neon-keyboard-wrapper';

    // Header with label and expand button
    if (label || expandable) {
        const header = document.createElement('div');
        header.className = 'neon-keyboard-header';

        if (label) {
            const labelEl = document.createElement('div');
            labelEl.className = 'neon-keyboard-label';
            labelEl.textContent = label;
            header.appendChild(labelEl);
        } else {
            header.appendChild(document.createElement('div')); // Spacer
        }

        if (expandable) {
            const expandBtn = document.createElement('button');
            expandBtn.className = 'neon-keyboard-expand-btn';
            expandBtn.textContent = 'EXPAND';
            expandBtn.type = 'button';

            const handleExpandClick = () => {
                isExpanded = !isExpanded;
                expandBtn.classList.toggle('expanded', isExpanded);
                expandBtn.textContent = isExpanded ? 'COLLAPSE' : 'EXPAND';
                currentNumKeys = isExpanded ? expandedKeys : numKeys;

                // When expanding, reset to C0 for full piano view
                if (isExpanded) {
                    currentRootNote = 9; // A (piano starts at A0)
                    currentOctave = 0;
                } else {
                    currentRootNote = rootNote;
                    currentOctave = octave;
                }

                keyboard.classList.toggle('expanded', isExpanded);
                renderKeys();
                onExpandChange?.(isExpanded);
            };

            expandBtn.addEventListener('click', handleExpandClick);
            eventListeners.push({ el: expandBtn, type: 'click', fn: handleExpandClick });
            header.appendChild(expandBtn);
        }

        wrapper.appendChild(header);
    }

    // Create container (for settings row)
    const container = document.createElement('div');
    container.className = 'neon-keyboard-container';

    // Settings row (root/octave selectors)
    let rootSelect = null;
    let octaveSelect = null;
    if (showSettings) {
        const settingsRow = document.createElement('div');
        settingsRow.className = 'neon-keyboard-settings';

        // Root note selector
        const rootSetting = document.createElement('div');
        rootSetting.className = 'neon-keyboard-setting';
        const rootLabel = document.createElement('span');
        rootLabel.className = 'neon-keyboard-setting-label';
        rootLabel.textContent = 'ROOT';
        rootSelect = document.createElement('select');
        rootSelect.className = 'neon-keyboard-select';
        NOTE_NAMES.forEach((name, i) => {
            const opt = document.createElement('option');
            opt.value = i;
            opt.textContent = name;
            if (i === currentRootNote) opt.selected = true;
            rootSelect.appendChild(opt);
        });
        rootSetting.appendChild(rootLabel);
        rootSetting.appendChild(rootSelect);

        // Octave selector
        const octaveSetting = document.createElement('div');
        octaveSetting.className = 'neon-keyboard-setting';
        const octaveLabel = document.createElement('span');
        octaveLabel.className = 'neon-keyboard-setting-label';
        octaveLabel.textContent = 'OCTAVE';
        octaveSelect = document.createElement('select');
        octaveSelect.className = 'neon-keyboard-select';
        for (let i = 0; i <= 7; i++) {
            const opt = document.createElement('option');
            opt.value = i;
            opt.textContent = i;
            if (i === currentOctave) opt.selected = true;
            octaveSelect.appendChild(opt);
        }
        octaveSetting.appendChild(octaveLabel);
        octaveSetting.appendChild(octaveSelect);

        settingsRow.appendChild(rootSetting);
        settingsRow.appendChild(octaveSetting);
        container.appendChild(settingsRow);

        // Event listeners for selectors
        const handleRootChange = () => {
            currentRootNote = parseInt(rootSelect.value);
            renderKeys();
            onRangeChange?.(currentRootNote, currentOctave);
        };
        const handleOctaveChange = () => {
            currentOctave = parseInt(octaveSelect.value);
            renderKeys();
            onRangeChange?.(currentRootNote, currentOctave);
        };
        rootSelect.addEventListener('change', handleRootChange);
        octaveSelect.addEventListener('change', handleOctaveChange);
        eventListeners.push(
            { el: rootSelect, type: 'change', fn: handleRootChange },
            { el: octaveSelect, type: 'change', fn: handleOctaveChange }
        );
    }

    // Scroll container for expanded view
    const scrollContainer = document.createElement('div');
    scrollContainer.className = 'neon-keyboard-scroll-container';

    // Keyboard element
    const keyboard = document.createElement('div');
    keyboard.className = `neon-keyboard${size !== 'medium' ? ` size-${size}` : ''}${isDisabled ? ' disabled' : ''}`;

    scrollContainer.appendChild(keyboard);
    container.appendChild(scrollContainer);
    wrapper.appendChild(container);

    function renderKeys() {
        // Clean up existing listeners
        keyElements.forEach((key) => {
            const listeners = eventListeners.filter(l => l.el === key);
            listeners.forEach(l => {
                key.removeEventListener(l.type, l.fn);
                const idx = eventListeners.indexOf(l);
                if (idx > -1) eventListeners.splice(idx, 1);
            });
        });
        keyElements.length = 0;
        keyboard.innerHTML = '';
        activeKeys.clear();

        // Enable scrollable mode for larger keyboards (> 24 keys)
        const needsScroll = currentNumKeys > 24;
        keyboard.classList.toggle('scrollable', needsScroll);

        for (let i = 0; i < currentNumKeys; i++) {
            const actualNoteIndex = (currentRootNote + i) % 12;
            const noteName = NOTE_NAMES[actualNoteIndex];
            const isBlack = noteName.includes('#');

            const key = document.createElement('div');
            key.className = `neon-keyboard-key ${isBlack ? 'black' : 'white'}`;
            if (whiteKeyColor !== 'cyan' && !isBlack) {
                key.classList.add(`color-${whiteKeyColor}`);
            }
            if (blackKeyColor !== 'magenta' && isBlack) {
                key.classList.add(`color-${blackKeyColor}`);
            }
            key.dataset.keyIndex = i;
            key.dataset.note = noteName;

            // Show labels - for many keys, only label C notes to reduce clutter
            const manyKeys = currentNumKeys > 24;
            if (showLabels && (!manyKeys || actualNoteIndex === 0)) {
                const labelSpan = document.createElement('span');
                const noteOctave = Math.floor((currentRootNote + i) / 12) + currentOctave;
                labelSpan.textContent = manyKeys ? `C${noteOctave}` : noteName;
                key.appendChild(labelSpan);
            }

            const triggerOn = (e) => {
                e.preventDefault();
                if (isDisabled || activeKeys.has(i)) return;
                activeKeys.add(i);
                key.classList.add('active');
                const freq = getFrequency(i, currentRootNote, currentOctave);
                onNoteOn?.(i, freq, noteName);
            };

            const triggerOff = (e) => {
                e.preventDefault();
                if (!activeKeys.has(i)) return;
                activeKeys.delete(i);
                key.classList.remove('active');
                onNoteOff?.(i);
            };

            key.addEventListener('mousedown', triggerOn);
            key.addEventListener('touchstart', triggerOn, { passive: false });
            key.addEventListener('mouseup', triggerOff);
            key.addEventListener('mouseleave', triggerOff);
            key.addEventListener('touchend', triggerOff);
            key.addEventListener('touchcancel', triggerOff);

            eventListeners.push(
                { el: key, type: 'mousedown', fn: triggerOn },
                { el: key, type: 'touchstart', fn: triggerOn },
                { el: key, type: 'mouseup', fn: triggerOff },
                { el: key, type: 'mouseleave', fn: triggerOff },
                { el: key, type: 'touchend', fn: triggerOff },
                { el: key, type: 'touchcancel', fn: triggerOff }
            );

            keyboard.appendChild(key);
            keyElements.push(key);
        }
    }

    renderKeys();

    return {
        element: wrapper,
        keyboard,
        scrollContainer,

        /**
         * Set the keyboard range
         * @param {number} newRootNote - Root note index (0-11)
         * @param {number} newOctave - Starting octave
         */
        setRange: (newRootNote, newOctave) => {
            currentRootNote = newRootNote;
            currentOctave = newOctave;
            if (rootSelect) rootSelect.value = newRootNote;
            if (octaveSelect) octaveSelect.value = newOctave;
            renderKeys();
        },

        /**
         * Get current range settings
         * @returns {{ rootNote: number, octave: number }}
         */
        getRange: () => ({ rootNote: currentRootNote, octave: currentOctave }),

        /**
         * Check if keyboard is expanded
         * @returns {boolean}
         */
        isExpanded: () => isExpanded,

        /**
         * Set expanded state programmatically
         * @param {boolean} expanded
         */
        setExpanded: (expanded) => {
            if (expanded === isExpanded) return;
            isExpanded = expanded;
            currentNumKeys = isExpanded ? expandedKeys : numKeys;
            keyboard.classList.toggle('expanded', isExpanded);
            renderKeys();
            onExpandChange?.(isExpanded);
        },

        /**
         * Set disabled state
         * @param {boolean} value
         */
        setDisabled: (value) => {
            isDisabled = value;
            keyboard.classList.toggle('disabled', isDisabled);
        },

        /**
         * Highlight a key (for sequencer playback)
         * @param {number} keyIndex
         */
        highlightKey: (keyIndex) => {
            if (keyElements[keyIndex]) {
                keyElements[keyIndex].classList.add('highlighted');
            }
        },

        /**
         * Clear all highlights
         */
        clearHighlights: () => {
            keyElements.forEach(key => key.classList.remove('highlighted'));
        },

        /**
         * Set visual active state on a key (for sequencer playback, without triggering audio)
         * @param {number} keyIndex
         * @param {boolean} active
         */
        setKeyVisualState: (keyIndex, active) => {
            if (keyElements[keyIndex]) {
                keyElements[keyIndex].classList.toggle('active', active);
            }
        },

        /**
         * Programmatically trigger a note on
         * @param {number} keyIndex
         */
        triggerNoteOn: (keyIndex) => {
            if (isDisabled || activeKeys.has(keyIndex)) return;
            activeKeys.add(keyIndex);
            if (keyElements[keyIndex]) {
                keyElements[keyIndex].classList.add('active');
            }
            const freq = getFrequency(keyIndex, currentRootNote, currentOctave);
            const noteName = NOTE_NAMES[(currentRootNote + keyIndex) % 12];
            onNoteOn?.(keyIndex, freq, noteName);
        },

        /**
         * Programmatically trigger a note off
         * @param {number} keyIndex
         */
        triggerNoteOff: (keyIndex) => {
            if (!activeKeys.has(keyIndex)) return;
            activeKeys.delete(keyIndex);
            if (keyElements[keyIndex]) {
                keyElements[keyIndex].classList.remove('active');
            }
            onNoteOff?.(keyIndex);
        },

        /**
         * Get currently active keys
         * @returns {Set<number>}
         */
        getActiveKeys: () => new Set(activeKeys),

        /**
         * Get frequency for a key index
         * @param {number} keyIndex
         * @returns {number}
         */
        getFrequency: (keyIndex) => getFrequency(keyIndex, currentRootNote, currentOctave),

        /**
         * Get note name for a key index
         * @param {number} keyIndex
         * @returns {string}
         */
        getNoteName: (keyIndex) => NOTE_NAMES[(currentRootNote + keyIndex) % 12],

        /**
         * Get current number of keys
         * @returns {number}
         */
        getNumKeys: () => currentNumKeys,

        /**
         * Set number of keys
         * @param {number} num - Number of keys
         * @param {number} [newRootNote] - Optional new root note
         * @param {number} [newOctave] - Optional new octave
         */
        setNumKeys: (num, newRootNote, newOctave) => {
            currentNumKeys = num;
            if (newRootNote !== undefined) currentRootNote = newRootNote;
            if (newOctave !== undefined) currentOctave = newOctave;
            if (rootSelect) rootSelect.value = currentRootNote;
            if (octaveSelect) octaveSelect.value = currentOctave;
            renderKeys();
        },

        /**
         * Get stuck keys (held via double-click)
         * @returns {Set<number>}
         */
        getStuckKeys: () => new Set(stuckKeys),

        /**
         * Release all stuck keys
         */
        releaseAllStuckKeys: () => {
            stuckKeys.forEach(i => {
                activeKeys.delete(i);
                if (keyElements[i]) {
                    keyElements[i].classList.remove('stuck', 'active');
                }
                onNoteOff?.(i);
            });
            stuckKeys.clear();
        },

        /**
         * Re-render the keyboard (useful after external state changes)
         */
        render: () => renderKeys(),

        /**
         * Clean up event listeners
         */
        destroy: () => {
            // Release all stuck keys first
            stuckKeys.forEach(i => {
                onNoteOff?.(i);
            });
            stuckKeys.clear();
            activeKeys.clear();

            eventListeners.forEach(({ el, type, fn }) => {
                el.removeEventListener(type, fn);
            });
            eventListeners.length = 0;
        }
    };
}

// Also export a class-based API for backwards compatibility
export class Keyboard {
    constructor(container, onNoteOn, onNoteOff, options = {}) {
        const keyboard = createKeyboard({
            numKeys: options.numKeys || 12,
            ...options,
            onNoteOn: (keyIndex, freq) => onNoteOn?.(keyIndex, freq),
            onNoteOff: (keyIndex) => onNoteOff?.(keyIndex)
        });

        // Mount to container
        container.innerHTML = '';
        container.appendChild(keyboard.keyboard);

        this._keyboard = keyboard;
        this.container = container;
    }

    setRange(rootNoteIndex, octave) {
        this._keyboard.setRange(rootNoteIndex, octave);
    }

    getFreq(keyIndex) {
        return this._keyboard.getFrequency(keyIndex);
    }

    init() {
        this._keyboard.render();
    }

    destroy() {
        this._keyboard.destroy();
    }
}
