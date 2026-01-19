/**
 * Neon UI Kit - Tracker Component
 * Step sequencer/tracker for music applications
 */

let stylesInjected = false;

function injectStyles(): void {
  if (stylesInjected) return;
  const style = document.createElement('style');
  style.textContent = `
    .neon-tracker-wrapper {
      display: flex;
      flex-direction: column;
      gap: 8px;
      flex: 1;
      min-height: 0;
    }

    .neon-tracker-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      flex-wrap: wrap;
      gap: 8px;
    }

    .neon-tracker-label {
      font-size: 0.6em;
      font-weight: 900;
      letter-spacing: 3px;
      color: #bf5fff;
      text-shadow: 0 0 8px rgba(191,95,255,0.5);
    }

    .neon-tracker-controls {
      display: flex;
      gap: 8px;
      align-items: center;
    }

    .neon-tracker-btn {
      background: linear-gradient(180deg, #2a0044 0%, #1a0033 100%);
      color: #fff;
      border: 1px solid rgba(191,95,255,0.3);
      border-radius: 4px;
      padding: 5px 10px;
      cursor: pointer;
      font-family: inherit;
      font-weight: 900;
      font-size: 0.6em;
      letter-spacing: 1px;
      transition: all 0.2s;
    }
    .neon-tracker-btn:hover {
      background: linear-gradient(180deg, #3a0066 0%, #2a0044 100%);
      box-shadow: 0 0 15px rgba(191,95,255,0.3);
    }
    .neon-tracker-btn:disabled {
      opacity: 0.4;
      cursor: not-allowed;
    }

    .neon-tracker-input {
      width: 50px;
      background: rgba(0,0,0,0.4);
      border: 1px solid rgba(0,255,255,0.3);
      border-radius: 4px;
      color: #00ffff;
      font-size: 0.7em;
      font-weight: 900;
      text-align: center;
      padding: 4px;
    }
    .neon-tracker-input:focus {
      outline: none;
      border-color: #00ffff;
      box-shadow: 0 0 10px rgba(0,255,255,0.3);
    }

    .neon-tracker-indicator {
      font-size: 0.65em;
      font-weight: 900;
      color: #ff00ff;
      text-shadow: 0 0 10px #ff00ff;
      letter-spacing: 2px;
      padding: 4px 8px;
      background: rgba(255,0,255,0.1);
      border-radius: 3px;
    }

    .neon-tracker-grid {
      flex: 1;
      overflow-y: auto;
      background: rgba(0,0,0,0.3);
      border-radius: 4px;
      font-family: 'Courier New', monospace;
      font-size: 0.7em;
      min-height: 150px;
    }

    .neon-tracker-grid::-webkit-scrollbar {
      width: 8px;
    }
    .neon-tracker-grid::-webkit-scrollbar-track {
      background: rgba(0,0,0,0.3);
      border-radius: 4px;
    }
    .neon-tracker-grid::-webkit-scrollbar-thumb {
      background: rgba(191,95,255,0.5);
      border-radius: 4px;
    }
    .neon-tracker-grid::-webkit-scrollbar-thumb:hover {
      background: rgba(191,95,255,0.7);
    }

    .neon-tracker-header-row {
      display: flex;
      position: sticky;
      top: 0;
      background: linear-gradient(180deg, #1a0033 0%, #0d0018 100%);
      border-bottom: 1px solid rgba(191,95,255,0.3);
      z-index: 10;
    }

    .neon-tracker-step-num-header {
      width: 30px;
      padding: 6px 4px;
      text-align: center;
      color: rgba(191,95,255,0.5);
      font-weight: 900;
      flex-shrink: 0;
    }

    .neon-tracker-track-header {
      flex: 1;
      padding: 6px 8px;
      text-align: center;
      color: #bf5fff;
      font-weight: 900;
      cursor: pointer;
      transition: all 0.2s;
      border-left: 1px solid rgba(191,95,255,0.2);
      min-width: 60px;
    }
    .neon-tracker-track-header:hover {
      background: rgba(191,95,255,0.1);
    }
    .neon-tracker-track-header.selected {
      background: rgba(255,0,255,0.2);
      color: #ff00ff;
      text-shadow: 0 0 10px #ff00ff;
    }

    .neon-tracker-step-row {
      display: flex;
      border-bottom: 1px solid rgba(191,95,255,0.1);
    }
    .neon-tracker-step-row:nth-child(4n+1) {
      background: rgba(191,95,255,0.03);
    }
    .neon-tracker-step-row.active {
      background: rgba(0,255,255,0.15);
      box-shadow: inset 0 0 20px rgba(0,255,255,0.2);
    }

    .neon-tracker-step-num {
      width: 30px;
      padding: 4px;
      text-align: center;
      color: rgba(191,95,255,0.4);
      font-weight: 700;
      flex-shrink: 0;
    }

    .neon-tracker-step-note {
      flex: 1;
      padding: 4px 8px;
      text-align: center;
      color: rgba(191,95,255,0.3);
      cursor: pointer;
      transition: all 0.15s;
      border-left: 1px solid rgba(191,95,255,0.1);
      min-width: 60px;
    }
    .neon-tracker-step-note:hover {
      background: rgba(191,95,255,0.1);
    }
    .neon-tracker-step-note.has-note {
      color: #00ffff;
      text-shadow: 0 0 8px #00ffff;
      background: rgba(0,255,255,0.1);
    }

    /* Disabled state */
    .neon-tracker-wrapper.disabled .neon-tracker-grid {
      opacity: 0.5;
      pointer-events: none;
    }
  `;
  document.head.appendChild(style);
  stylesInjected = true;
}

const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

/** Event listener reference for cleanup */
interface EventListenerRef {
  el: HTMLElement;
  type: string;
  fn: EventListener;
}

/** Note data for a step */
export interface StepNote {
  trackIdx: number;
  noteIndex: number;
  freq: number | null;
}

/** Tracker state for serialization */
export interface TrackerState {
  bpm: number;
  steps: number;
  tracks: (number | null)[][];
  trackNames: string[];
  selectedTrackIdx: number;
}

/** Options for creating a tracker */
export interface TrackerOptions {
  /** Label text displayed above tracker */
  label?: string;
  /** Number of steps in sequence */
  steps?: number;
  /** Maximum number of tracks */
  maxTracks?: number;
  /** Initial track names */
  trackNames?: string[];
  /** Beats per minute */
  bpm?: number;
  /** Starting octave for note display */
  startOctave?: number;
  /** Show add/remove track buttons */
  showControls?: boolean;
  /** Show steps input */
  showStepsInput?: boolean;
  /** Called when track is selected */
  onTrackSelect?: ((trackIndex: number, trackName: string) => void) | null;
  /** Called when step changes */
  onStepChange?: ((trackIndex: number, stepIndex: number, noteValue: number | null) => void) | null;
  /** Called on each step during playback */
  onPlay?: ((stepIndex: number, notes: StepNote[]) => void) | null;
  /** Called when play state changes */
  onPlayStateChange?: ((isPlaying: boolean) => void) | null;
  /** Function to get frequency for note index */
  getFrequency?: ((noteIndex: number) => number) | null;
  /** Whether tracker is disabled */
  disabled?: boolean;
}

/** Tracker component interface */
export interface TrackerComponent {
  /** The wrapper element */
  element: HTMLElement;
  /** The grid element */
  grid: HTMLElement;
  /** Start playback */
  start: () => void;
  /** Stop playback */
  stop: () => void;
  /** Toggle playback */
  toggle: () => boolean;
  /** Check if playing */
  readonly isPlaying: boolean;
  /** Get current step */
  readonly currentStep: number;
  /** Get selected track index */
  readonly selectedTrackIdx: number;
  /** Get track names */
  readonly trackNames: string[];
  /** Get tracks data */
  readonly tracks: (number | null)[][];
  /** Get number of steps */
  readonly steps: number;
  /** Get BPM */
  readonly bpm: number;
  /** Set BPM */
  setBPM: (val: number) => void;
  /** Set number of steps */
  setSteps: (steps: number) => void;
  /** Set tracks data */
  setTracks: (tracks: (number | null)[][]) => void;
  /** Set track names */
  setTrackNames: (names: string[]) => void;
  /** Set start octave */
  setStartOctave: (octave: number) => void;
  /** Get start octave */
  getStartOctave: () => number;
  /** Add a track */
  addTrack: () => void;
  /** Remove a track */
  removeTrack: () => void;
  /** Select a track */
  selectTrack: (idx: number) => void;
  /** Set disabled state */
  setDisabled: (value: boolean) => void;
  /** Get state for serialization */
  getState: () => TrackerState;
  /** Load state */
  loadState: (state: Partial<TrackerState>) => void;
  /** Re-render the tracker */
  render: () => void;
  /** Clean up event listeners */
  destroy: () => void;
}

/**
 * Create an interactive step tracker/sequencer
 */
export function createTracker(options: TrackerOptions = {}): TrackerComponent {
  injectStyles();

  const {
    label = '',
    steps: initialSteps = 64,
    maxTracks = 4,
    trackNames: initialTrackNames = ['TRK 1', 'TRK 2', 'TRK 3', 'TRK 4'],
    bpm: initialBpm = 120,
    startOctave: initialStartOctave = 3,
    showControls = true,
    showStepsInput = true,
    onTrackSelect = null,
    onStepChange = null,
    onPlay = null,
    onPlayStateChange = null,
    getFrequency = null,
    disabled = false
  } = options;

  let steps = initialSteps;
  let bpm = initialBpm;
  let startOctave = initialStartOctave;
  let currentStep = 0;
  let isPlaying = false;
  let isDisabled = disabled;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let tracks: (number | null)[][] = [new Array(steps).fill(null)];
  let trackNames = [...initialTrackNames];
  let selectedTrackIdx = 0;

  const eventListeners: EventListenerRef[] = [];

  // Create wrapper
  const wrapper = document.createElement('div');
  wrapper.className = `neon-tracker-wrapper${isDisabled ? ' disabled' : ''}`;

  // Header with label and controls
  const header = document.createElement('div');
  header.className = 'neon-tracker-header';

  if (label) {
    const labelEl = document.createElement('div');
    labelEl.className = 'neon-tracker-label';
    labelEl.textContent = label;
    header.appendChild(labelEl);
  }

  // Controls container
  const controls = document.createElement('div');
  controls.className = 'neon-tracker-controls';

  // Steps input
  let stepsInput: HTMLInputElement | null = null;
  if (showStepsInput) {
    stepsInput = document.createElement('input');
    stepsInput.type = 'number';
    stepsInput.className = 'neon-tracker-input';
    stepsInput.min = '1';
    stepsInput.max = '256';
    stepsInput.value = String(steps);
    stepsInput.title = 'Steps';

    const handleStepsChange = (e: Event): void => {
      const val = parseInt((e.target as HTMLInputElement).value);
      if (!isNaN(val) && val > 0 && val <= 256) {
        setStepsInternal(val);
      }
    };
    stepsInput.addEventListener('input', handleStepsChange);
    eventListeners.push({ el: stepsInput, type: 'input', fn: handleStepsChange as EventListener });
    controls.appendChild(stepsInput);
  }

  // Add/Remove track buttons
  let addTrackBtn: HTMLButtonElement | null = null;
  let remTrackBtn: HTMLButtonElement | null = null;
  if (showControls) {
    addTrackBtn = document.createElement('button');
    addTrackBtn.className = 'neon-tracker-btn';
    addTrackBtn.textContent = '+ ADD';
    addTrackBtn.title = 'Add Track';

    remTrackBtn = document.createElement('button');
    remTrackBtn.className = 'neon-tracker-btn';
    remTrackBtn.textContent = '- REM';
    remTrackBtn.title = 'Remove Track';

    const handleAddTrack = (): void => addTrack();
    const handleRemTrack = (): void => removeTrack();

    addTrackBtn.addEventListener('click', handleAddTrack);
    remTrackBtn.addEventListener('click', handleRemTrack);
    eventListeners.push(
      { el: addTrackBtn, type: 'click', fn: handleAddTrack as EventListener },
      { el: remTrackBtn, type: 'click', fn: handleRemTrack as EventListener }
    );

    controls.appendChild(addTrackBtn);
    controls.appendChild(remTrackBtn);
  }

  header.appendChild(controls);
  wrapper.appendChild(header);

  // Track indicator
  const indicator = document.createElement('div');
  indicator.className = 'neon-tracker-indicator';
  indicator.innerHTML = `EDITING: <span class="neon-tracker-current-track">${trackNames[selectedTrackIdx]}</span>`;
  wrapper.appendChild(indicator);

  // Grid container
  const grid = document.createElement('div');
  grid.className = 'neon-tracker-grid';
  wrapper.appendChild(grid);

  function getNoteName(index: number | null): string {
    if (index === null || index === undefined) return '---';
    const safeIndex = Math.max(0, index);
    const octave = Math.floor(safeIndex / 12) + startOctave;
    const name = NOTE_NAMES[safeIndex % 12];
    return `${name}-${octave}`;
  }

  function updateButtonStates(): void {
    if (addTrackBtn) addTrackBtn.disabled = tracks.length >= maxTracks;
    if (remTrackBtn) remTrackBtn.disabled = tracks.length <= 1;
  }

  function updateIndicator(): void {
    const span = indicator.querySelector('.neon-tracker-current-track');
    if (span) span.textContent = trackNames[selectedTrackIdx];
  }

  function render(): void {
    grid.innerHTML = '';
    updateButtonStates();
    updateIndicator();

    // Header row
    const headerRow = document.createElement('div');
    headerRow.className = 'neon-tracker-header-row';

    const stepNumHeader = document.createElement('span');
    stepNumHeader.className = 'neon-tracker-step-num-header';
    stepNumHeader.textContent = '#';
    headerRow.appendChild(stepNumHeader);

    tracks.forEach((_, i) => {
      const trackHeader = document.createElement('span');
      trackHeader.className = `neon-tracker-track-header${i === selectedTrackIdx ? ' selected' : ''}`;
      trackHeader.textContent = trackNames[i] || `TRK ${i + 1}`;
      trackHeader.dataset.idx = String(i);

      const handleTrackClick = (): void => {
        selectedTrackIdx = i;
        render();
        onTrackSelect?.(i, trackNames[i]);
      };

      const handleTrackDblClick = (): void => {
        const newName = prompt('Enter Track Name:', trackNames[i]);
        if (newName) {
          trackNames[i] = newName.substring(0, 10).toUpperCase();
          render();
          onTrackSelect?.(i, trackNames[i]);
        }
      };

      trackHeader.addEventListener('click', handleTrackClick);
      trackHeader.addEventListener('dblclick', handleTrackDblClick);

      headerRow.appendChild(trackHeader);
    });

    grid.appendChild(headerRow);

    // Step rows
    for (let i = 0; i < steps; i++) {
      const stepRow = document.createElement('div');
      stepRow.className = `neon-tracker-step-row${i === currentStep && isPlaying ? ' active' : ''}`;

      const stepNum = document.createElement('span');
      stepNum.className = 'neon-tracker-step-num';
      stepNum.textContent = i.toString(16).toUpperCase().padStart(2, '0');
      stepRow.appendChild(stepNum);

      tracks.forEach((track, trackIdx) => {
        const noteData = track[i];
        const noteName = noteData !== null ? getNoteName(noteData) : '---';

        const stepNote = document.createElement('span');
        stepNote.className = `neon-tracker-step-note${noteData !== null ? ' has-note' : ''}`;
        stepNote.textContent = noteName;
        stepNote.dataset.track = String(trackIdx);
        stepNote.dataset.step = String(i);

        const handleStepClick = (): void => {
          // Cycle through notes: null -> C -> D -> E -> G -> A -> C+1
          const cycle: (number | null)[] = [null, 0, 2, 4, 7, 9, 12];
          const currentIdx = cycle.indexOf(tracks[trackIdx][i]);
          const nextIdx = (currentIdx + 1) % cycle.length;
          tracks[trackIdx][i] = cycle[nextIdx];
          render();
          updateVisualStep();
          onStepChange?.(trackIdx, i, cycle[nextIdx]);
        };

        stepNote.addEventListener('click', handleStepClick);
        stepRow.appendChild(stepNote);
      });

      grid.appendChild(stepRow);
    }
  }

  function updateVisualStep(): void {
    const rows = grid.querySelectorAll('.neon-tracker-step-row');
    rows.forEach((el, i) => {
      el.classList.toggle('active', i === currentStep && isPlaying);
    });
  }

  function addTrack(): void {
    if (tracks.length < maxTracks) {
      tracks.push(new Array(steps).fill(null));
      render();
    }
  }

  function removeTrack(): void {
    if (tracks.length > 1) {
      tracks.pop();
      if (selectedTrackIdx >= tracks.length) {
        selectedTrackIdx = tracks.length - 1;
      }
      render();
    }
  }

  function setStepsInternal(newSteps: number): void {
    tracks = tracks.map(track => {
      const newTrack: (number | null)[] = new Array(newSteps).fill(null);
      for (let i = 0; i < Math.min(track.length, newSteps); i++) {
        newTrack[i] = track[i];
      }
      return newTrack;
    });
    steps = newSteps;
    if (stepsInput) stepsInput.value = String(newSteps);
    render();
  }

  function play(): void {
    if (!isPlaying) return;

    // Collect notes for this step
    const stepNotes: StepNote[] = tracks.map((track, trackIdx) => {
      const noteIndex = track[currentStep];
      if (noteIndex !== null) {
        const freq = getFrequency ? getFrequency(noteIndex) : null;
        return { trackIdx, noteIndex, freq };
      }
      return null;
    }).filter((n): n is StepNote => n !== null);

    onPlay?.(currentStep, stepNotes);
    updateVisualStep();

    const stepTime = (60 / bpm / 4) * 1000; // 16th notes
    currentStep = (currentStep + 1) % steps;

    timer = setTimeout(() => play(), stepTime);
  }

  function start(): void {
    if (isPlaying) return;
    isPlaying = true;
    currentStep = 0;
    onPlayStateChange?.(true);
    play();
  }

  function stop(): void {
    if (!isPlaying) return;
    isPlaying = false;
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
    onPlayStateChange?.(false);
    updateVisualStep();
  }

  function toggle(): boolean {
    if (isPlaying) {
      stop();
    } else {
      start();
    }
    return isPlaying;
  }

  // Initial render
  render();

  return {
    element: wrapper,
    grid,

    start,
    stop,
    toggle,

    get isPlaying() { return isPlaying; },
    get currentStep() { return currentStep; },
    get selectedTrackIdx() { return selectedTrackIdx; },
    get trackNames() { return [...trackNames]; },
    get tracks() { return tracks.map(t => [...t]); },
    get steps() { return steps; },
    get bpm() { return bpm; },

    setBPM(val: number): void {
      bpm = val;
    },

    setSteps: setStepsInternal,

    setTracks(newTracks: (number | null)[][]): void {
      if (Array.isArray(newTracks)) {
        tracks = newTracks.map(t => [...t]);
        render();
        updateVisualStep();
      }
    },

    setTrackNames(names: string[]): void {
      if (Array.isArray(names)) {
        names.forEach((name, i) => {
          if (trackNames[i] !== undefined && name) {
            trackNames[i] = name.substring(0, 10).toUpperCase();
          }
        });
        render();
      }
    },

    setStartOctave(octave: number): void {
      startOctave = octave;
      render();
    },

    getStartOctave(): number {
      return startOctave;
    },

    addTrack,
    removeTrack,

    selectTrack(idx: number): void {
      if (idx >= 0 && idx < tracks.length) {
        selectedTrackIdx = idx;
        render();
        onTrackSelect?.(idx, trackNames[idx]);
      }
    },

    setDisabled(value: boolean): void {
      isDisabled = value;
      wrapper.classList.toggle('disabled', isDisabled);
    },

    getState(): TrackerState {
      return {
        bpm,
        steps,
        tracks: tracks.map(t => [...t]),
        trackNames: [...trackNames],
        selectedTrackIdx
      };
    },

    loadState(state: Partial<TrackerState>): void {
      if (state.bpm !== undefined) bpm = state.bpm;
      if (state.steps !== undefined) setStepsInternal(state.steps);
      if (state.tracks) tracks = state.tracks.map(t => [...t]);
      if (state.trackNames) trackNames = [...state.trackNames];
      if (state.selectedTrackIdx !== undefined) selectedTrackIdx = state.selectedTrackIdx;
      render();
    },

    render,

    destroy(): void {
      stop();
      eventListeners.forEach(({ el, type, fn }) => {
        el.removeEventListener(type, fn);
      });
      eventListeners.length = 0;
    }
  };
}
