/**
 * Neon UI Kit - Keyboard Component
 * Interactive piano keyboard for synth/music applications
 */

import type { NeonColor, NeonSize } from './types';

let stylesInjected = false;

function injectStyles(): void {
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
 */
function getFrequency(keyIndex: number, rootNoteIndex: number, startOctave: number): number {
  const totalNoteIndex = rootNoteIndex + keyIndex;
  const octave = Math.floor(totalNoteIndex / 12) + startOctave;
  const note = totalNoteIndex % 12;
  const midi = (octave + 1) * 12 + note;
  return 440 * Math.pow(2, (midi - 69) / 12);
}

/** Event listener reference for cleanup */
interface EventListenerRef {
  el: HTMLElement;
  type: string;
  fn: EventListener;
}

/** Keyboard color options */
export type KeyboardColor = NeonColor;

/** Options for creating a keyboard */
export interface KeyboardOptions {
  /** Label text displayed above keyboard */
  label?: string;
  /** Number of keys to display */
  numKeys?: number;
  /** Root note index (0=C, 1=C#, etc.) */
  rootNote?: number;
  /** Starting octave */
  octave?: number;
  /** Size: small, medium, large */
  size?: NeonSize;
  /** Active color for white keys */
  whiteKeyColor?: KeyboardColor;
  /** Active color for black keys */
  blackKeyColor?: KeyboardColor;
  /** Show note labels on keys */
  showLabels?: boolean;
  /** Show root/octave selectors */
  showSettings?: boolean;
  /** Show expand/collapse toggle for full piano */
  expandable?: boolean;
  /** Number of keys when expanded (full piano) */
  expandedKeys?: number;
  /** Called when note starts */
  onNoteOn?: ((keyIndex: number, frequency: number, noteName: string) => void) | null;
  /** Called when note ends */
  onNoteOff?: ((keyIndex: number) => void) | null;
  /** Called when root/octave changes */
  onRangeChange?: ((rootNote: number, octave: number) => void) | null;
  /** Called when expand state changes */
  onExpandChange?: ((isExpanded: boolean) => void) | null;
  /** Whether keyboard is disabled */
  disabled?: boolean;
}

/** Keyboard range */
export interface KeyboardRange {
  rootNote: number;
  octave: number;
}

/** Keyboard component interface */
export interface KeyboardComponent {
  /** The wrapper element */
  element: HTMLElement;
  /** The keyboard element */
  keyboard: HTMLElement;
  /** The scroll container */
  scrollContainer: HTMLElement;
  /** Set the keyboard range */
  setRange: (rootNote: number, octave: number) => void;
  /** Get current range settings */
  getRange: () => KeyboardRange;
  /** Check if keyboard is expanded */
  isExpanded: () => boolean;
  /** Set expanded state */
  setExpanded: (expanded: boolean) => void;
  /** Set disabled state */
  setDisabled: (disabled: boolean) => void;
  /** Highlight a key */
  highlightKey: (keyIndex: number) => void;
  /** Clear all highlights */
  clearHighlights: () => void;
  /** Set visual active state on a key */
  setKeyVisualState: (keyIndex: number, active: boolean) => void;
  /** Programmatically trigger a note on */
  triggerNoteOn: (keyIndex: number) => void;
  /** Programmatically trigger a note off */
  triggerNoteOff: (keyIndex: number) => void;
  /** Get currently active keys */
  getActiveKeys: () => Set<number>;
  /** Get frequency for a key index */
  getFrequency: (keyIndex: number) => number;
  /** Get note name for a key index */
  getNoteName: (keyIndex: number) => string;
  /** Get current number of keys */
  getNumKeys: () => number;
  /** Set number of keys */
  setNumKeys: (num: number, rootNote?: number, octave?: number) => void;
  /** Get stuck keys */
  getStuckKeys: () => Set<number>;
  /** Release all stuck keys */
  releaseAllStuckKeys: () => void;
  /** Re-render the keyboard */
  render: () => void;
  /** Clean up event listeners */
  destroy: () => void;
}

/**
 * Create an interactive keyboard
 */
export function createKeyboard(options: KeyboardOptions = {}): KeyboardComponent {
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
  const activeKeys = new Set<number>();
  const stuckKeys = new Set<number>(); // Keys held on via double-click
  const keyElements: HTMLElement[] = [];
  const eventListeners: EventListenerRef[] = [];

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

      const handleExpandClick = (): void => {
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
      eventListeners.push({ el: expandBtn, type: 'click', fn: handleExpandClick as EventListener });
      header.appendChild(expandBtn);
    }

    wrapper.appendChild(header);
  }

  // Create container (for settings row)
  const container = document.createElement('div');
  container.className = 'neon-keyboard-container';

  // Settings row (root/octave selectors)
  let rootSelect: HTMLSelectElement | null = null;
  let octaveSelect: HTMLSelectElement | null = null;
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
      opt.value = String(i);
      opt.textContent = name;
      if (i === currentRootNote) opt.selected = true;
      rootSelect!.appendChild(opt);
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
      opt.value = String(i);
      opt.textContent = String(i);
      if (i === currentOctave) opt.selected = true;
      octaveSelect.appendChild(opt);
    }
    octaveSetting.appendChild(octaveLabel);
    octaveSetting.appendChild(octaveSelect);

    settingsRow.appendChild(rootSetting);
    settingsRow.appendChild(octaveSetting);
    container.appendChild(settingsRow);

    // Event listeners for selectors
    const handleRootChange = (): void => {
      currentRootNote = parseInt(rootSelect!.value);
      renderKeys();
      onRangeChange?.(currentRootNote, currentOctave);
    };
    const handleOctaveChange = (): void => {
      currentOctave = parseInt(octaveSelect!.value);
      renderKeys();
      onRangeChange?.(currentRootNote, currentOctave);
    };
    rootSelect.addEventListener('change', handleRootChange);
    octaveSelect.addEventListener('change', handleOctaveChange);
    eventListeners.push(
      { el: rootSelect, type: 'change', fn: handleRootChange as EventListener },
      { el: octaveSelect, type: 'change', fn: handleOctaveChange as EventListener }
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

  function renderKeys(): void {
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
      key.dataset.keyIndex = String(i);
      key.dataset.note = noteName;

      // Show labels - for many keys, only label C notes to reduce clutter
      const manyKeys = currentNumKeys > 24;
      if (showLabels && (!manyKeys || actualNoteIndex === 0)) {
        const labelSpan = document.createElement('span');
        const noteOctave = Math.floor((currentRootNote + i) / 12) + currentOctave;
        labelSpan.textContent = manyKeys ? `C${noteOctave}` : noteName;
        key.appendChild(labelSpan);
      }

      const triggerOn = (e: Event): void => {
        e.preventDefault();
        if (isDisabled || activeKeys.has(i)) return;
        activeKeys.add(i);
        key.classList.add('active');
        const freq = getFrequency(i, currentRootNote, currentOctave);
        onNoteOn?.(i, freq, noteName);
      };

      const triggerOff = (e: Event): void => {
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
        { el: key, type: 'mousedown', fn: triggerOn as EventListener },
        { el: key, type: 'touchstart', fn: triggerOn as EventListener },
        { el: key, type: 'mouseup', fn: triggerOff as EventListener },
        { el: key, type: 'mouseleave', fn: triggerOff as EventListener },
        { el: key, type: 'touchend', fn: triggerOff as EventListener },
        { el: key, type: 'touchcancel', fn: triggerOff as EventListener }
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

    setRange: (newRootNote: number, newOctave: number): void => {
      currentRootNote = newRootNote;
      currentOctave = newOctave;
      if (rootSelect) rootSelect.value = String(newRootNote);
      if (octaveSelect) octaveSelect.value = String(newOctave);
      renderKeys();
    },

    getRange: () => ({ rootNote: currentRootNote, octave: currentOctave }),

    isExpanded: () => isExpanded,

    setExpanded: (expanded: boolean): void => {
      if (expanded === isExpanded) return;
      isExpanded = expanded;
      currentNumKeys = isExpanded ? expandedKeys : numKeys;
      keyboard.classList.toggle('expanded', isExpanded);
      renderKeys();
      onExpandChange?.(isExpanded);
    },

    setDisabled: (value: boolean): void => {
      isDisabled = value;
      keyboard.classList.toggle('disabled', isDisabled);
    },

    highlightKey: (keyIndex: number): void => {
      if (keyElements[keyIndex]) {
        keyElements[keyIndex].classList.add('highlighted');
      }
    },

    clearHighlights: (): void => {
      keyElements.forEach(key => key.classList.remove('highlighted'));
    },

    setKeyVisualState: (keyIndex: number, active: boolean): void => {
      if (keyElements[keyIndex]) {
        keyElements[keyIndex].classList.toggle('active', active);
      }
    },

    triggerNoteOn: (keyIndex: number): void => {
      if (isDisabled || activeKeys.has(keyIndex)) return;
      activeKeys.add(keyIndex);
      if (keyElements[keyIndex]) {
        keyElements[keyIndex].classList.add('active');
      }
      const freq = getFrequency(keyIndex, currentRootNote, currentOctave);
      const noteName = NOTE_NAMES[(currentRootNote + keyIndex) % 12];
      onNoteOn?.(keyIndex, freq, noteName);
    },

    triggerNoteOff: (keyIndex: number): void => {
      if (!activeKeys.has(keyIndex)) return;
      activeKeys.delete(keyIndex);
      if (keyElements[keyIndex]) {
        keyElements[keyIndex].classList.remove('active');
      }
      onNoteOff?.(keyIndex);
    },

    getActiveKeys: () => new Set(activeKeys),

    getFrequency: (keyIndex: number) => getFrequency(keyIndex, currentRootNote, currentOctave),

    getNoteName: (keyIndex: number) => NOTE_NAMES[(currentRootNote + keyIndex) % 12],

    getNumKeys: () => currentNumKeys,

    setNumKeys: (num: number, newRootNote?: number, newOctave?: number): void => {
      currentNumKeys = num;
      if (newRootNote !== undefined) currentRootNote = newRootNote;
      if (newOctave !== undefined) currentOctave = newOctave;
      if (rootSelect) rootSelect.value = String(currentRootNote);
      if (octaveSelect) octaveSelect.value = String(currentOctave);
      renderKeys();
    },

    getStuckKeys: () => new Set(stuckKeys),

    releaseAllStuckKeys: (): void => {
      stuckKeys.forEach(i => {
        activeKeys.delete(i);
        if (keyElements[i]) {
          keyElements[i].classList.remove('stuck', 'active');
        }
        onNoteOff?.(i);
      });
      stuckKeys.clear();
    },

    render: () => renderKeys(),

    destroy: (): void => {
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

/** Legacy Keyboard class for backward compatibility */
export class Keyboard {
  private _keyboard: KeyboardComponent;
  container: HTMLElement;

  constructor(
    container: HTMLElement,
    onNoteOn?: ((keyIndex: number, freq: number) => void) | null,
    onNoteOff?: ((keyIndex: number) => void) | null,
    options: Partial<KeyboardOptions> = {}
  ) {
    const keyboard = createKeyboard({
      numKeys: options.numKeys || 12,
      ...options,
      onNoteOn: onNoteOn ? (keyIndex: number, freq: number) => onNoteOn(keyIndex, freq) : null,
      onNoteOff: onNoteOff ? (keyIndex: number) => onNoteOff(keyIndex) : null
    });

    // Mount to container
    container.innerHTML = '';
    container.appendChild(keyboard.keyboard);

    this._keyboard = keyboard;
    this.container = container;
  }

  setRange(rootNoteIndex: number, octave: number): void {
    this._keyboard.setRange(rootNoteIndex, octave);
  }

  getFreq(keyIndex: number): number {
    return this._keyboard.getFrequency(keyIndex);
  }

  init(): void {
    this._keyboard.render();
  }

  destroy(): void {
    this._keyboard.destroy();
  }
}
