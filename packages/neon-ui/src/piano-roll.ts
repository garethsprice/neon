/**
 * Neon UI Kit - Piano Roll Component
 * Vertical piano roll with notes falling toward keyboard
 */

let stylesInjected = false;

function injectStyles(): void {
    if (stylesInjected) return;
    const style = document.createElement('style');
    style.textContent = `
        .neon-piano-roll-wrapper {
            display: flex;
            flex-direction: column;
            gap: 8px;
            flex: 1;
            min-height: 0;
            overflow: hidden;
        }

        .neon-piano-roll-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            flex-wrap: wrap;
            gap: 8px;
            flex-shrink: 0;
        }

        .neon-piano-roll-label {
            font-size: 0.6em;
            font-weight: 900;
            letter-spacing: 3px;
            color: #bf5fff;
            text-shadow: 0 0 8px rgba(191,95,255,0.5);
        }

        .neon-piano-roll-controls {
            display: flex;
            gap: 8px;
            align-items: center;
        }

        .neon-piano-roll-btn {
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
        .neon-piano-roll-btn:hover {
            background: linear-gradient(180deg, #3a0066 0%, #2a0044 100%);
            box-shadow: 0 0 15px rgba(191,95,255,0.3);
        }
        .neon-piano-roll-btn:disabled {
            opacity: 0.4;
            cursor: not-allowed;
        }
        .neon-piano-roll-btn.active {
            background: linear-gradient(180deg, rgba(0,255,255,0.2) 0%, rgba(0,255,255,0.1) 100%);
            border-color: #00ffff;
            color: #00ffff;
        }

        .neon-piano-roll-track-tabs {
            display: flex;
            gap: 4px;
        }

        .neon-piano-roll-track-tab {
            background: linear-gradient(180deg, #1a0033 0%, #0d0018 100%);
            border: 1px solid rgba(191,95,255,0.3);
            color: rgba(191,95,255,0.7);
            padding: 4px 12px;
            font-size: 0.55em;
            font-weight: 900;
            letter-spacing: 1px;
            cursor: pointer;
            border-radius: 4px 4px 0 0;
            transition: all 0.2s;
        }
        .neon-piano-roll-track-tab:hover {
            border-color: #bf5fff;
            color: #bf5fff;
        }
        .neon-piano-roll-track-tab.active {
            background: linear-gradient(180deg, rgba(255,0,255,0.2) 0%, rgba(255,0,255,0.1) 100%);
            border-color: #ff00ff;
            color: #ff00ff;
            text-shadow: 0 0 10px #ff00ff;
        }
        .neon-piano-roll-track-tab.playback-enabled {
            box-shadow: 0 0 8px rgba(57,255,20,0.5);
            border-bottom: 2px solid #39ff14;
        }
        .neon-piano-roll-track-tab.playback-enabled::after {
            content: '';
            position: absolute;
            bottom: 2px;
            left: 50%;
            transform: translateX(-50%);
            width: 6px;
            height: 6px;
            background: #39ff14;
            border-radius: 50%;
            box-shadow: 0 0 6px #39ff14;
        }
        .neon-piano-roll-track-tab {
            position: relative;
        }

        .neon-piano-roll-container {
            flex: 1;
            display: flex;
            flex-direction: column;
            min-height: 0;
            overflow: hidden;
            border: 1px solid rgba(191,95,255,0.2);
            border-radius: 4px;
            background: rgba(0,0,0,0.3);
        }

        .neon-piano-roll-scroll {
            flex: 1;
            overflow: auto;
            position: relative;
        }

        .neon-piano-roll-grid {
            display: flex;
            position: relative;
            min-width: max-content;
            z-index: 1;
        }

        /* Note labels column (left side) */
        .neon-piano-roll-note-labels {
            display: flex;
            flex-direction: column;
            position: sticky;
            left: 0;
            z-index: 10;
            background: linear-gradient(180deg, #1a0033 0%, #0d0018 100%);
            border-right: 1px solid rgba(191,95,255,0.3);
        }

        .neon-piano-roll-note-label {
            height: 20px;
            min-height: 20px;
            padding: 0 8px;
            display: flex;
            align-items: center;
            justify-content: flex-end;
            font-size: 0.5em;
            font-weight: 700;
            color: rgba(191,95,255,0.5);
            border-bottom: 1px solid rgba(191,95,255,0.1);
        }
        .neon-piano-roll-note-label.black-key {
            background: rgba(0,0,0,0.3);
            color: rgba(191,95,255,0.4);
        }
        .neon-piano-roll-note-label.c-note {
            color: #00ffff;
            border-bottom-color: rgba(0,255,255,0.3);
        }
        .neon-piano-roll-note-label.stuck {
            background: linear-gradient(180deg, #39ff14 0%, #2ecc0f 100%);
            color: #000;
            box-shadow: 0 0 15px rgba(57,255,20,0.6);
            cursor: pointer;
        }
        .neon-piano-roll-note-label.stuck.black-key {
            background: linear-gradient(180deg, #ff00ff 0%, #cc00cc 100%);
            box-shadow: 0 0 15px rgba(255,0,255,0.6);
        }
        .neon-piano-roll-note-label.keyboard-active {
            background: linear-gradient(180deg, #00ffff 0%, #00cccc 100%);
            color: #000;
            box-shadow: 0 0 20px rgba(0,255,255,0.8);
            transform: scale(1.1);
            z-index: 25;
        }
        .neon-piano-roll-note-label.keyboard-active.black-key {
            background: linear-gradient(180deg, #ff00ff 0%, #cc00cc 100%);
            box-shadow: 0 0 20px rgba(255,0,255,0.8);
        }
        .neon-piano-roll-note-label {
            cursor: pointer;
            user-select: none;
        }

        /* Steps area */
        .neon-piano-roll-steps {
            display: flex;
            flex: 1;
        }

        .neon-piano-roll-step-column {
            display: flex;
            flex-direction: column;
            min-width: 24px;
            border-right: 1px solid rgba(191,95,255,0.1);
        }
        .neon-piano-roll-step-column:nth-child(4n) {
            border-right-color: rgba(191,95,255,0.3);
        }
        .neon-piano-roll-step-column:nth-child(16n) {
            border-right-color: rgba(0,255,255,0.4);
        }

        .neon-piano-roll-cell {
            height: 20px;
            min-height: 20px;
            cursor: pointer;
            transition: background 0.1s;
            border-bottom: 1px solid rgba(191,95,255,0.1);
            position: relative;
        }
        .neon-piano-roll-cell:hover {
            background: rgba(191,95,255,0.15);
        }
        .neon-piano-roll-cell.black-key {
            background: rgba(0,0,0,0.2);
        }
        .neon-piano-roll-cell.black-key:hover {
            background: rgba(191,95,255,0.2);
        }
        .neon-piano-roll-cell.c-note {
            border-bottom-color: rgba(0,255,255,0.2);
        }

        .neon-piano-roll-cell.has-note {
            background: linear-gradient(180deg, #00ffff 0%, #00cccc 100%);
            box-shadow: 0 0 10px rgba(0,255,255,0.5), inset 0 0 5px rgba(255,255,255,0.3);
        }
        .neon-piano-roll-cell.has-note.black-key {
            background: linear-gradient(180deg, #ff00ff 0%, #cc00cc 100%);
            box-shadow: 0 0 10px rgba(255,0,255,0.5), inset 0 0 5px rgba(255,255,255,0.3);
        }

        /* Note continuation - part of an extended note */
        .neon-piano-roll-cell.note-continue {
            background: linear-gradient(180deg, #00dddd 0%, #00bbbb 100%);
            box-shadow: 0 0 10px rgba(0,255,255,0.4), inset 0 0 5px rgba(255,255,255,0.2);
        }
        .neon-piano-roll-cell.note-continue.black-key {
            background: linear-gradient(180deg, #dd00dd 0%, #bb00bb 100%);
            box-shadow: 0 0 10px rgba(255,0,255,0.4), inset 0 0 5px rgba(255,255,255,0.2);
        }

        /* Note end marker - bottom of extended note */
        .neon-piano-roll-cell.note-end {
            border-radius: 0 0 3px 3px;
        }

        /* Note start with continuation below */
        .neon-piano-roll-cell.note-start-extended {
            border-radius: 3px 3px 0 0;
        }

        /* Drag preview state */
        .neon-piano-roll-cell.drag-preview {
            background: rgba(0,255,255,0.3);
            border: 2px dashed #00ffff;
        }
        .neon-piano-roll-cell.drag-preview.black-key {
            background: rgba(255,0,255,0.3);
            border-color: #ff00ff;
        }

        /* Ghost notes - notes from other enabled patterns */
        .neon-piano-roll-cell.ghost-note {
            background: rgba(57,255,20,0.25);
            box-shadow: inset 0 0 8px rgba(57,255,20,0.3);
        }
        .neon-piano-roll-cell.ghost-note.black-key {
            background: rgba(255,165,0,0.25);
            box-shadow: inset 0 0 8px rgba(255,165,0,0.3);
        }
        .neon-piano-roll-cell.ghost-continue {
            background: rgba(57,255,20,0.15);
            box-shadow: inset 0 0 5px rgba(57,255,20,0.2);
        }
        .neon-piano-roll-cell.ghost-continue.black-key {
            background: rgba(255,165,0,0.15);
            box-shadow: inset 0 0 5px rgba(255,165,0,0.2);
        }

        /* Playhead */
        .neon-piano-roll-playhead {
            position: absolute;
            top: 0;
            left: 0;
            width: 24px;
            height: 100%;
            background: rgba(57,255,20,0.2);
            border-left: 2px solid #39ff14;
            box-shadow: 0 0 15px rgba(57,255,20,0.5);
            pointer-events: none;
            z-index: 5;
            transition: left 0.05s linear;
        }

        .neon-piano-roll-playhead.hidden {
            display: none;
        }

        /* Step numbers row */
        .neon-piano-roll-step-numbers {
            display: flex;
            position: sticky;
            top: 0;
            z-index: 15;
            background: linear-gradient(180deg, #1a0033 0%, #0d0018 100%);
            border-bottom: 1px solid rgba(191,95,255,0.3);
        }

        .neon-piano-roll-step-num-spacer {
            min-width: 40px;
            border-right: 1px solid rgba(191,95,255,0.3);
        }

        .neon-piano-roll-step-num {
            min-width: 24px;
            padding: 4px 0;
            text-align: center;
            font-size: 0.45em;
            font-weight: 700;
            color: rgba(191,95,255,0.4);
            border-right: 1px solid rgba(191,95,255,0.1);
        }
        .neon-piano-roll-step-num:nth-child(4n+1) {
            color: rgba(191,95,255,0.7);
        }
        .neon-piano-roll-step-num:nth-child(16n+1) {
            color: #00ffff;
        }

        /* Vertical mode - notes fall DOWN (time increases downward, keyboard at bottom) */
        .neon-piano-roll-wrapper.vertical .neon-piano-roll-grid {
            flex-direction: column;
            min-height: 100%;
            min-width: max-content;
        }

        .neon-piano-roll-wrapper.vertical.playing .neon-piano-roll-grid {
            height: 100%;
        }

        /* Content row wraps step numbers and steps area side by side */
        .neon-piano-roll-wrapper.vertical .neon-piano-roll-content-row {
            display: flex;
            flex-direction: row;
            flex: 1;
            min-height: 100%;
            min-width: max-content;
            position: relative;
            z-index: 10;
        }

        .neon-piano-roll-wrapper.vertical .neon-piano-roll-note-labels {
            flex-direction: row;
            position: relative;
            bottom: 0;
            top: auto;
            left: auto;
            border-right: none;
            border-top: 1px solid rgba(191,95,255,0.3);
            z-index: 20;
            transform: translateY(0);
            opacity: 1;
            transition: transform 0.4s cubic-bezier(0.4, 0, 0.2, 1),
                        opacity 0.3s cubic-bezier(0.4, 0, 0.2, 1);
            overflow-x: auto;
            overflow-y: hidden;
            scrollbar-width: thin;
            scrollbar-color: rgba(191,95,255,0.5) rgba(0,0,0,0.3);
        }
        .neon-piano-roll-wrapper.vertical .neon-piano-roll-note-labels::-webkit-scrollbar {
            height: 6px;
        }
        .neon-piano-roll-wrapper.vertical .neon-piano-roll-note-labels::-webkit-scrollbar-track {
            background: rgba(0,0,0,0.3);
        }
        .neon-piano-roll-wrapper.vertical .neon-piano-roll-note-labels::-webkit-scrollbar-thumb {
            background: rgba(191,95,255,0.5);
            border-radius: 3px;
        }

        /* Slide note labels down gracefully when playing */
        .neon-piano-roll-wrapper.vertical.playing .neon-piano-roll-note-labels {
            transform: translateY(100%);
            opacity: 0;
            pointer-events: none;
        }

        .neon-piano-roll-wrapper.vertical .neon-piano-roll-note-label {
            flex: 0 0 auto;
            min-width: 36px; /* Match keyboard white key width */
            height: 30px;
            min-height: 30px;
            padding: 4px 2px;
            justify-content: center;
            border-bottom: none;
            border-right: 1px solid rgba(191,95,255,0.1);
            writing-mode: horizontal-tb;
            font-size: 0.45em;
        }
        .neon-piano-roll-wrapper.vertical.small-keys .neon-piano-roll-note-label {
            flex: 1;
            min-width: 0;
        }

        .neon-piano-roll-wrapper.vertical .neon-piano-roll-steps {
            flex-direction: column;
            flex: 1;
            min-width: max-content;
        }

        /* Horizontal scrolling for many keys */
        .neon-piano-roll-wrapper.vertical .neon-piano-roll-scroll {
            overflow-x: auto;
            overflow-y: auto;
        }
        .neon-piano-roll-wrapper.vertical .neon-piano-roll-scroll::-webkit-scrollbar {
            width: 8px;
            height: 8px;
        }
        .neon-piano-roll-wrapper.vertical .neon-piano-roll-scroll::-webkit-scrollbar-track {
            background: rgba(0,0,0,0.3);
        }
        .neon-piano-roll-wrapper.vertical .neon-piano-roll-scroll::-webkit-scrollbar-thumb {
            background: rgba(191,95,255,0.5);
            border-radius: 4px;
        }
        .neon-piano-roll-wrapper.vertical .neon-piano-roll-scroll::-webkit-scrollbar-corner {
            background: rgba(0,0,0,0.3);
        }

        .neon-piano-roll-wrapper.vertical .neon-piano-roll-step-column {
            flex-direction: row;
            min-width: max-content;
            height: 20px;
            box-sizing: content-box;
            border-right: none;
            border-bottom: 1px solid rgba(191,95,255,0.1);
        }
        .neon-piano-roll-wrapper.vertical .neon-piano-roll-step-column:nth-child(4n) {
            border-bottom-color: rgba(191,95,255,0.3);
        }
        .neon-piano-roll-wrapper.vertical .neon-piano-roll-step-column:nth-child(16n) {
            border-bottom-color: rgba(0,255,255,0.4);
        }

        .neon-piano-roll-wrapper.vertical .neon-piano-roll-cell {
            flex: 0 0 auto;
            min-width: 36px; /* Match keyboard white key width */
            height: 20px;
            border-bottom: none;
            border-right: 1px solid rgba(191,95,255,0.1);
        }
        .neon-piano-roll-wrapper.vertical .neon-piano-roll-cell.black-key {
            min-width: 36px; /* Same width for grid alignment */
        }
        .neon-piano-roll-wrapper.vertical.small-keys .neon-piano-roll-cell {
            flex: 1;
            min-width: 0;
        }

        .neon-piano-roll-wrapper.vertical .neon-piano-roll-playhead {
            width: 100%;
            height: 20px;
            border-left: none;
            border-top: 2px solid #39ff14;
            transition: top 0.05s linear;
        }

        .neon-piano-roll-wrapper.vertical .neon-piano-roll-step-numbers {
            flex-direction: column;
            position: sticky;
            left: 0;
            top: auto;
            border-bottom: none;
            border-right: 1px solid rgba(191,95,255,0.3);
            min-width: 30px;
            flex-shrink: 0;
        }

        .neon-piano-roll-wrapper.vertical .neon-piano-roll-step-num {
            min-width: auto;
            height: 20px;
            box-sizing: content-box;
            padding: 0 6px;
            display: flex;
            align-items: center;
            justify-content: center;
            border-right: none;
            border-bottom: 1px solid rgba(191,95,255,0.1);
        }

        /* Hide step numbers when toggled off */
        .neon-piano-roll-wrapper.hide-step-numbers .neon-piano-roll-step-numbers {
            display: none;
        }
        .neon-piano-roll-wrapper.hide-step-numbers .neon-piano-roll-note-labels {
            margin-left: 0 !important;
        }

        /* Falling notes mode - scroll area contains the animation */
        .neon-piano-roll-wrapper.falling-mode .neon-piano-roll-scroll {
            overflow-x: auto;
            overflow-y: auto;
            position: relative;
        }
        .neon-piano-roll-wrapper.falling-mode .neon-piano-roll-steps {
            transition: none;
        }

        /* Container positioning for play line */
        .neon-piano-roll-wrapper.falling-mode .neon-piano-roll-container {
            position: relative;
        }

        /* Play line at bottom for falling mode */
        .neon-piano-roll-play-line {
            position: absolute;
            bottom: 0;
            left: 0;
            right: 0;
            height: 3px;
            background: linear-gradient(90deg, #39ff14, #00ffff, #39ff14);
            box-shadow: 0 0 15px #39ff14, 0 0 30px rgba(57,255,20,0.5);
            z-index: 100;
            display: none;
            pointer-events: none;
        }
        .neon-piano-roll-wrapper.falling-mode.playing .neon-piano-roll-play-line {
            display: block;
            animation: playline-glow 0.5s ease-in-out infinite alternate;
        }
        @keyframes playline-glow {
            from { box-shadow: 0 0 15px #39ff14, 0 0 30px rgba(57,255,20,0.5); }
            to { box-shadow: 0 0 20px #39ff14, 0 0 40px rgba(57,255,20,0.7); }
        }

        /* When playing in falling mode, scroll area becomes the clipping container */
        .neon-piano-roll-wrapper.falling-mode.playing .neon-piano-roll-scroll {
            position: relative;
            overflow-x: auto;
            overflow-y: hidden;
        }

        /* Grid fills the scroll area and clips content */
        .neon-piano-roll-wrapper.falling-mode.playing .neon-piano-roll-grid {
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            overflow: hidden;
        }

        /* Content row fills the grid when playing */
        .neon-piano-roll-wrapper.falling-mode.playing .neon-piano-roll-content-row {
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
        }

        /* Steps area fills and clips content for row recycling */
        .neon-piano-roll-wrapper.falling-mode.playing .neon-piano-roll-steps {
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            overflow: hidden;
        }

        /* Individual step rows are absolutely positioned for recycling */
        .neon-piano-roll-wrapper.falling-mode.playing .neon-piano-roll-step-column {
            will-change: transform;
        }


        /* Disabled state */
        .neon-piano-roll-wrapper.disabled {
            opacity: 0.5;
            pointer-events: none;
        }
    `;
    document.head.appendChild(style);
    stylesInjected = true;
}

const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

/** Note data for playback callbacks */
export interface PianoRollNote {
    trackIdx: number;
    noteIdx: number;
    freq: number | null;
    duration: number;
}

/** State object for serialization */
export interface PianoRollState {
    bpm: number;
    steps: number;
    numKeys: number;
    rootNote: number;
    octave: number;
    tracks: number[][][];
    trackNames: string[];
    selectedTrackIdx: number;
    enabledTracks: number[];
}

/** Tracker data format: null | noteIndex | [noteIndex, duration] */
export type TrackerNoteData = null | number | [number, number];

/** Piano roll options */
export interface PianoRollOptions {
    label?: string;
    steps?: number;
    numKeys?: number;
    rootNote?: number;
    octave?: number;
    maxTracks?: number;
    trackNames?: string[];
    bpm?: number;
    vertical?: boolean;
    loop?: boolean;
    showTrackTabs?: boolean;
    showStepNumbers?: boolean;
    fallingMode?: boolean;
    onNoteToggle?: (trackIdx: number, step: number, noteIdx: number, active: boolean, duration?: number) => void;
    onTrackSelect?: (trackIdx: number) => void;
    onPlay?: (step: number, notes: PianoRollNote[]) => void;
    onPlayStateChange?: (isPlaying: boolean) => void;
    onKeyHighlight?: (noteIdx: number, active: boolean) => void;
    onNoteOn?: (noteIdx: number) => void;
    onNoteOff?: (noteIdx: number) => void;
    getFrequency?: (noteIdx: number) => number;
    disabled?: boolean;
    /**
     * External clock mode (e.g. the @neon/engine lookahead Transport):
     * return the continuous playback position in steps (5.4 = inside row 5)
     * or null when nothing is sounding yet. When provided, the piano roll
     * has NO internal clock — it never fires onPlay (the app schedules its
     * own audio) and drives the playhead/falling animation from this value.
     */
    externalPosition?: () => number | null;
}

/** Piano roll component interface */
export interface PianoRollComponent {
    element: HTMLElement;
    grid: HTMLElement;
    scrollArea: HTMLElement;
    getNoteLabelsElement: () => HTMLElement | null;
    getHorizontalScroll: () => number;
    setHorizontalScroll: (scrollLeft: number) => void;
    onHorizontalScroll: (callback: (scrollLeft: number) => void) => void;
    start: () => void;
    stop: () => void;
    toggle: () => boolean;
    readonly isPlaying: boolean;
    readonly currentStep: number;
    readonly selectedTrackIdx: number;
    readonly tracks: number[][][];
    readonly trackNames: string[];
    readonly steps: number;
    readonly bpm: number;
    readonly numKeys: number;
    setBPM: (val: number) => void;
    setNumKeys: (newNumKeys: number) => void;
    setSteps: (newSteps: number) => void;
    setRange: (newRootNote: number, newOctave: number) => void;
    getRange: () => { rootNote: number; octave: number };
    selectTrack: (idx: number) => void;
    setTrackNames: (names: string[]) => void;
    setTrackName: (trackIdx: number, name: string) => void;
    setNoteAt: (trackIdx: number, step: number, noteIdx: number, duration?: number) => void;
    setTracksFromTracker: (trackerData: TrackerNoteData[][]) => void;
    getTracksAsTracker: () => TrackerNoteData[][];
    setTracks: (newTracks: (number | boolean)[][][]) => void;
    clearTrack: (trackIdx?: number) => void;
    clearAll: () => void;
    setDisabled: (value: boolean) => void;
    getState: () => PianoRollState;
    loadState: (state: Partial<PianoRollState>) => void;
    /** Notes starting at a step (for external-clock apps scheduling audio). */
    getNotesAtStep: (step: number) => PianoRollNote[];
    render: () => void;
    highlightNoteLabel: (noteIdx: number, active: boolean) => void;
    releaseAllStuckNotes: () => void;
    readonly stuckNotes: Set<number>;
    readonly enabledTracks: Set<number>;
    isTrackEnabled: (trackIdx: number) => boolean;
    setTrackEnabled: (trackIdx: number, enabled: boolean) => void;
    toggleTrackEnabled: (trackIdx: number) => void;
    shiftPitch: (semitones: number, trackIdx?: number) => void;
    destroy: () => void;
}

/** Drag state for note extension */
interface DragState {
    startStep: number;
    note: number;
    originalDuration: number;
    mode: 'create' | 'extend';
}

/**
 * Create a vertical piano roll with multiple pattern lanes
 */
export function createPianoRoll(options: PianoRollOptions = {}): PianoRollComponent {
    injectStyles();

    const {
        label = '',
        steps: initialSteps = 64,
        numKeys = 12,
        rootNote = 0,
        octave: initialOctave = 3,
        maxTracks = 4,
        trackNames: initialTrackNames = ['PATTERN 1', 'PATTERN 2', 'PATTERN 3', 'PATTERN 4'],
        bpm: initialBpm = 120,
        vertical = true,
        loop = true,
        showTrackTabs = true,
        showStepNumbers = false,
        fallingMode = true,
        onNoteToggle = null,
        onTrackSelect = null,
        onPlay = null,
        onPlayStateChange = null,
        onKeyHighlight = null,
        onNoteOn = null,
        onNoteOff = null,
        getFrequency = null,
        disabled = false,
        externalPosition = null
    } = options;

    let steps = initialSteps;
    let currentOctave = initialOctave;
    let currentRootNote = rootNote;
    let currentNumKeys = numKeys;
    let bpm = initialBpm;
    let currentStep = 0;
    let lastTriggeredStep = -1;
    let isPlaying = false;
    let isDisabled = disabled;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let animationFrameId: number | null = null;
    let playStartTime = 0;
    let selectedTrackIdx = 0;
    let stepNumbersVisible = showStepNumbers;
    let stepsAreaElement: HTMLElement | null = null;
    const stuckNotes = new Set<number>();
    const enabledTracks = new Set<number>([0, 1, 2, 3].slice(0, maxTracks));

    // Tracks data: tracks[trackIdx][step][noteIdx] = duration value
    let tracks: number[][][] = [];
    for (let t = 0; t < maxTracks; t++) {
        tracks.push(createEmptyTrack());
    }
    let trackNames = [...initialTrackNames];

    let dragState: DragState | null = null;

    function createEmptyTrack(): number[][] {
        const track: number[][] = [];
        for (let s = 0; s < steps; s++) {
            track.push(new Array(currentNumKeys).fill(0));
        }
        return track;
    }

    function setNoteDuration(step: number, noteIdx: number, duration: number): void {
        if (!tracks[selectedTrackIdx][step]) return;

        clearNoteAt(step, noteIdx);

        if (duration <= 0) {
            tracks[selectedTrackIdx][step][noteIdx] = 0;
            return;
        }

        tracks[selectedTrackIdx][step][noteIdx] = duration;

        for (let d = 1; d < duration && (step + d) < steps; d++) {
            const existingValue = tracks[selectedTrackIdx][step + d][noteIdx];
            if (existingValue > 0) {
                clearNoteAt(step + d, noteIdx);
            }
            tracks[selectedTrackIdx][step + d][noteIdx] = -1;
        }

        onNoteToggle?.(selectedTrackIdx, step, noteIdx, duration > 0, duration);
    }

    function clearNoteAt(step: number, noteIdx: number): void {
        const value = tracks[selectedTrackIdx][step]?.[noteIdx];
        if (!value) return;

        if (value > 0) {
            tracks[selectedTrackIdx][step][noteIdx] = 0;
            for (let d = 1; d < value && (step + d) < steps; d++) {
                if (tracks[selectedTrackIdx][step + d][noteIdx] === -1) {
                    tracks[selectedTrackIdx][step + d][noteIdx] = 0;
                }
            }
        } else if (value === -1) {
            let startStep = step - 1;
            while (startStep >= 0 && tracks[selectedTrackIdx][startStep][noteIdx] === -1) {
                startStep--;
            }
            if (startStep >= 0 && tracks[selectedTrackIdx][startStep][noteIdx] > 0) {
                clearNoteAt(startStep, noteIdx);
            }
        }
    }

    function shiftNotes(direction: number): void {
        const track = tracks[selectedTrackIdx];

        const newTrack: number[][] = [];
        for (let s = 0; s < steps; s++) {
            newTrack.push(new Array(currentNumKeys).fill(0));
        }

        for (let s = 0; s < steps; s++) {
            for (let n = 0; n < currentNumKeys; n++) {
                const value = track[s][n];
                if (value !== 0) {
                    let newN = n + direction;
                    if (newN < 0) newN = currentNumKeys + newN;
                    if (newN >= currentNumKeys) newN = newN - currentNumKeys;
                    newTrack[s][newN] = value;
                }
            }
        }

        tracks[selectedTrackIdx] = newTrack;
        render();
    }

    function applyNoteCellStyles(cell: HTMLElement, step: number, noteIdx: number, value: number): void {
        cell.classList.remove('has-note', 'note-continue', 'note-end', 'note-start-extended', 'ghost-note', 'ghost-continue');

        if (value > 0) {
            cell.classList.add('has-note');
            if (value > 1) {
                cell.classList.add('note-start-extended');
            }
        } else if (value === -1) {
            cell.classList.add('note-continue');
            const nextStep = step + 1;
            if (nextStep >= steps || tracks[selectedTrackIdx][nextStep]?.[noteIdx] !== -1) {
                cell.classList.add('note-end');
            }
        } else {
            for (const trackIdx of enabledTracks) {
                if (trackIdx === selectedTrackIdx) continue;
                const ghostValue = tracks[trackIdx]?.[step]?.[noteIdx];
                if (ghostValue > 0) {
                    cell.classList.add('ghost-note');
                    break;
                } else if (ghostValue === -1) {
                    cell.classList.add('ghost-continue');
                    break;
                }
            }
        }
    }

    function handleGlobalMouseMove(e: MouseEvent): void {
        if (!dragState) return;

        const cell = document.elementFromPoint(e.clientX, e.clientY) as HTMLElement | null;
        if (!cell?.classList.contains('neon-piano-roll-cell')) return;

        const currentStepVal = parseInt(cell.dataset.step || '0');
        const currentNote = parseInt(cell.dataset.note || '0');

        if (currentNote !== dragState.note) return;

        const newDuration = Math.max(1, currentStepVal - dragState.startStep + 1);

        setNoteDuration(dragState.startStep, dragState.note, newDuration);
        render();
    }

    function handleGlobalMouseUp(e: MouseEvent): void {
        if (dragState) {
            if (dragState.mode === 'extend') {
                const cell = document.elementFromPoint(e.clientX, e.clientY) as HTMLElement | null;
                const clickedStep = cell?.dataset?.step ? parseInt(cell.dataset.step) : -1;
                const clickedNote = cell?.dataset?.note ? parseInt(cell.dataset.note) : -1;

                if (clickedStep === dragState.startStep && clickedNote === dragState.note) {
                    const currentDuration = tracks[selectedTrackIdx][dragState.startStep]?.[dragState.note] || 0;
                    if (currentDuration === dragState.originalDuration) {
                        setNoteDuration(dragState.startStep, dragState.note, 0);
                        render();
                    }
                }
            }
            dragState = null;
        }
    }

    // Create wrapper
    const wrapper = document.createElement('div');
    wrapper.className = `neon-piano-roll-wrapper${vertical ? ' vertical' : ''}${isDisabled ? ' disabled' : ''}${!stepNumbersVisible ? ' hide-step-numbers' : ''}${fallingMode ? ' falling-mode' : ''}`;

    // Header
    const header = document.createElement('div');
    header.className = 'neon-piano-roll-header';

    if (label) {
        const labelEl = document.createElement('div');
        labelEl.className = 'neon-piano-roll-label';
        labelEl.textContent = label;
        header.appendChild(labelEl);
    }

    // Pattern tabs
    let trackTabsContainer: HTMLElement | null = null;
    if (showTrackTabs) {
        trackTabsContainer = document.createElement('div');
        trackTabsContainer.className = 'neon-piano-roll-track-tabs';
        header.appendChild(trackTabsContainer);
    }

    // Controls
    const controls = document.createElement('div');
    controls.className = 'neon-piano-roll-controls';

    const stepNumBtn = document.createElement('button');
    stepNumBtn.className = `neon-piano-roll-btn${stepNumbersVisible ? ' active' : ''}`;
    stepNumBtn.textContent = '#';
    stepNumBtn.title = 'Toggle step numbers';
    stepNumBtn.addEventListener('click', () => {
        stepNumbersVisible = !stepNumbersVisible;
        wrapper.classList.toggle('hide-step-numbers', !stepNumbersVisible);
        stepNumBtn.classList.toggle('active', stepNumbersVisible);
    });
    controls.appendChild(stepNumBtn);

    const removeBarBtn = document.createElement('button');
    removeBarBtn.className = 'neon-piano-roll-btn';
    removeBarBtn.textContent = '-BAR';
    removeBarBtn.title = 'Remove 1 bar (16 steps)';
    removeBarBtn.addEventListener('click', () => {
        if (steps <= 16) return;
        const newSteps = steps - 16;
        tracks = tracks.map(track => track.slice(0, newSteps));
        steps = newSteps;
        render();
    });
    controls.appendChild(removeBarBtn);

    const addBarBtn = document.createElement('button');
    addBarBtn.className = 'neon-piano-roll-btn';
    addBarBtn.textContent = '+BAR';
    addBarBtn.title = 'Add 1 bar (16 steps)';
    addBarBtn.addEventListener('click', () => {
        const newSteps = steps + 16;
        tracks = tracks.map(track => {
            const newTrack = [...track];
            for (let s = track.length; s < newSteps; s++) {
                newTrack.push(new Array(currentNumKeys).fill(0));
            }
            return newTrack;
        });
        steps = newSteps;
        render();
    });
    controls.appendChild(addBarBtn);

    const shiftOctDownBtn = document.createElement('button');
    shiftOctDownBtn.className = 'neon-piano-roll-btn';
    shiftOctDownBtn.textContent = '\u221212';
    shiftOctDownBtn.title = 'Shift notes down 1 octave';
    shiftOctDownBtn.style.fontSize = '0.5em';
    shiftOctDownBtn.addEventListener('click', () => shiftNotes(-12));
    controls.appendChild(shiftOctDownBtn);

    const shiftDownBtn = document.createElement('button');
    shiftDownBtn.className = 'neon-piano-roll-btn';
    shiftDownBtn.textContent = '\u2212';
    shiftDownBtn.title = 'Shift notes down 1 semitone';
    shiftDownBtn.style.fontWeight = 'bold';
    shiftDownBtn.style.fontSize = '1em';
    shiftDownBtn.addEventListener('click', () => shiftNotes(-1));
    controls.appendChild(shiftDownBtn);

    const shiftUpBtn = document.createElement('button');
    shiftUpBtn.className = 'neon-piano-roll-btn';
    shiftUpBtn.textContent = '+';
    shiftUpBtn.title = 'Shift notes up 1 semitone';
    shiftUpBtn.style.fontWeight = 'bold';
    shiftUpBtn.style.fontSize = '1em';
    shiftUpBtn.addEventListener('click', () => shiftNotes(1));
    controls.appendChild(shiftUpBtn);

    const shiftOctUpBtn = document.createElement('button');
    shiftOctUpBtn.className = 'neon-piano-roll-btn';
    shiftOctUpBtn.textContent = '+12';
    shiftOctUpBtn.title = 'Shift notes up 1 octave';
    shiftOctUpBtn.style.fontSize = '0.5em';
    shiftOctUpBtn.addEventListener('click', () => shiftNotes(12));
    controls.appendChild(shiftOctUpBtn);

    const clearBtn = document.createElement('button');
    clearBtn.className = 'neon-piano-roll-btn';
    clearBtn.textContent = 'CLEAR';
    clearBtn.addEventListener('click', () => {
        tracks[selectedTrackIdx] = createEmptyTrack();
        render();
    });
    controls.appendChild(clearBtn);

    header.appendChild(controls);
    wrapper.appendChild(header);

    // Container
    const container = document.createElement('div');
    container.className = 'neon-piano-roll-container';

    const scrollArea = document.createElement('div');
    scrollArea.className = 'neon-piano-roll-scroll';

    const grid = document.createElement('div');
    grid.className = 'neon-piano-roll-grid';

    const playhead = document.createElement('div');
    playhead.className = 'neon-piano-roll-playhead hidden';

    const playLine = document.createElement('div');
    playLine.className = 'neon-piano-roll-play-line';

    scrollArea.appendChild(grid);
    scrollArea.appendChild(playhead);
    scrollArea.appendChild(playLine);
    container.appendChild(scrollArea);
    wrapper.appendChild(container);

    document.addEventListener('mousemove', handleGlobalMouseMove);
    document.addEventListener('mouseup', handleGlobalMouseUp);

    function isBlackKey(noteIdx: number): boolean {
        const note = (currentRootNote + noteIdx) % 12;
        return [1, 3, 6, 8, 10].includes(note);
    }

    function isCNote(noteIdx: number): boolean {
        return (currentRootNote + noteIdx) % 12 === 0;
    }

    function getNoteName(noteIdx: number): string {
        const noteInOctave = (currentRootNote + noteIdx) % 12;
        const noteOctave = Math.floor((currentRootNote + noteIdx) / 12) + currentOctave;
        return `${NOTE_NAMES[noteInOctave]}${noteOctave}`;
    }

    function renderTrackTabs(): void {
        if (!trackTabsContainer) return;
        trackTabsContainer.innerHTML = '';

        for (let t = 0; t < maxTracks; t++) {
            const tab = document.createElement('button');
            const isActive = t === selectedTrackIdx;
            const isEnabled = enabledTracks.has(t);
            tab.className = `neon-piano-roll-track-tab${isActive ? ' active' : ''}${isEnabled ? ' playback-enabled' : ''}`;
            tab.textContent = trackNames[t] || `PATTERN ${t + 1}`;
            tab.title = isEnabled ? 'Double-click to disable playback' : 'Double-click to enable playback';

            tab.addEventListener('click', () => {
                selectedTrackIdx = t;
                renderTrackTabs();
                render();
                onTrackSelect?.(t);
            });

            tab.addEventListener('dblclick', (e) => {
                e.preventDefault();
                e.stopPropagation();
                if (enabledTracks.has(t)) {
                    if (enabledTracks.size > 1) {
                        enabledTracks.delete(t);
                    }
                } else {
                    enabledTracks.add(t);
                }
                renderTrackTabs();
                render();
            });

            trackTabsContainer.appendChild(tab);
        }
    }

    function render(): void {
        grid.innerHTML = '';

        wrapper.classList.toggle('small-keys', currentNumKeys <= 24);

        if (vertical) {
            renderVertical();
        } else {
            renderHorizontal();
        }

        updatePlayhead();
    }

    function renderVertical(): void {
        const contentRow = document.createElement('div');
        contentRow.className = 'neon-piano-roll-content-row';

        const stepNumsCol = document.createElement('div');
        stepNumsCol.className = 'neon-piano-roll-step-numbers';

        const stepHeight = 20;

        const viewHeightEstimate = scrollArea.clientHeight || container.clientHeight || 400;
        const minRowsForViewport = Math.ceil(viewHeightEstimate / stepHeight) + steps;
        const totalRenderSteps = (isPlaying && fallingMode) ? Math.max(steps, minRowsForViewport) : steps;

        for (let i = 0; i < totalRenderSteps; i++) {
            const s = i % steps;
            const stepNum = document.createElement('div');
            stepNum.className = 'neon-piano-roll-step-num';
            stepNum.textContent = (s + 1).toString().padStart(2, '0');
            stepNumsCol.appendChild(stepNum);
        }
        contentRow.appendChild(stepNumsCol);

        const stepsArea = document.createElement('div');
        stepsArea.className = 'neon-piano-roll-steps';
        stepsArea.style.position = 'relative';

        for (let i = 0; i < totalRenderSteps; i++) {
            // During falling playback rows scroll downward, so the bottom row lands
            // first: reverse the row->step mapping so step 0 reaches the trigger
            // line first, matching the ascending playback order.
            const s = (fallingMode && isPlaying)
                ? (steps - 1) - (i % steps)
                : i % steps;
            const stepRow = document.createElement('div');
            stepRow.className = 'neon-piano-roll-step-column';
            stepRow.dataset.step = String(s);
            stepRow.dataset.renderIndex = String(i);

            if (fallingMode && isPlaying) {
                stepRow.style.position = 'absolute';
                stepRow.style.left = '0';
                stepRow.style.right = '0';
                stepRow.style.height = `${stepHeight}px`;

                const viewHeight = scrollArea.clientHeight || container.clientHeight || 400;
                const visualHeight = totalRenderSteps * stepHeight;
                const visualOffset = (totalRenderSteps % steps) * stepHeight;
                const baseY = viewHeight - (totalRenderSteps - i) * stepHeight;
                let initialY = baseY + visualOffset;

                while (initialY >= viewHeight) {
                    initialY -= visualHeight;
                }
                while (initialY < viewHeight - visualHeight) {
                    initialY += visualHeight;
                }

                stepRow.style.transform = `translateY(${initialY}px)`;
            }

            for (let n = 0; n < currentNumKeys; n++) {
                const cell = document.createElement('div');
                cell.className = 'neon-piano-roll-cell';
                if (isBlackKey(n)) cell.classList.add('black-key');
                if (isCNote(n)) cell.classList.add('c-note');

                const noteValue = tracks[selectedTrackIdx][s]?.[n] || 0;
                applyNoteCellStyles(cell, s, n, noteValue);

                cell.dataset.step = String(s);
                cell.dataset.note = String(n);

                cell.addEventListener('mousedown', (e) => {
                    e.preventDefault();
                    const stepVal = parseInt(cell.dataset.step || '0');
                    const note = parseInt(cell.dataset.note || '0');
                    const currentValue = tracks[selectedTrackIdx][stepVal]?.[note] || 0;

                    if (currentValue === -1) {
                        let startStep = stepVal - 1;
                        while (startStep >= 0 && tracks[selectedTrackIdx][startStep][note] === -1) {
                            startStep--;
                        }
                        const startDuration = tracks[selectedTrackIdx][startStep]?.[note] || 0;
                        if (startDuration > 0) {
                            const newDuration = stepVal - startStep;
                            setNoteDuration(startStep, note, newDuration);
                            render();
                        }
                        return;
                    }

                    if (currentValue > 0) {
                        dragState = {
                            startStep: stepVal,
                            note: note,
                            originalDuration: currentValue,
                            mode: 'extend'
                        };
                    } else {
                        setNoteDuration(stepVal, note, 1);
                        dragState = {
                            startStep: stepVal,
                            note: note,
                            originalDuration: 0,
                            mode: 'create'
                        };
                        render();
                    }
                });

                stepRow.appendChild(cell);
            }

            stepsArea.appendChild(stepRow);
        }

        stepsAreaElement = stepsArea;

        stepsArea.appendChild(playhead);
        contentRow.appendChild(stepsArea);
        grid.appendChild(contentRow);

        const noteLabelsRow = document.createElement('div');
        noteLabelsRow.className = 'neon-piano-roll-note-labels';
        noteLabelsRow.style.marginLeft = '30px';

        for (let n = 0; n < currentNumKeys; n++) {
            const noteIdx = n;
            const labelEl = document.createElement('div');
            labelEl.className = 'neon-piano-roll-note-label';
            if (isBlackKey(n)) labelEl.classList.add('black-key');
            if (isCNote(n)) labelEl.classList.add('c-note');
            if (stuckNotes.has(noteIdx)) labelEl.classList.add('stuck');
            labelEl.textContent = getNoteName(n);
            labelEl.dataset.noteIdx = String(noteIdx);

            labelEl.addEventListener('dblclick', (e) => {
                e.preventDefault();
                if (stuckNotes.has(noteIdx)) {
                    stuckNotes.delete(noteIdx);
                    labelEl.classList.remove('stuck');
                    onNoteOff?.(noteIdx);
                    onKeyHighlight?.(noteIdx, false);
                } else {
                    stuckNotes.add(noteIdx);
                    labelEl.classList.add('stuck');
                    onNoteOn?.(noteIdx);
                    onKeyHighlight?.(noteIdx, true);
                }
            });

            noteLabelsRow.appendChild(labelEl);
        }
        grid.appendChild(noteLabelsRow);
    }

    function renderHorizontal(): void {
        const stepNumsRow = document.createElement('div');
        stepNumsRow.className = 'neon-piano-roll-step-numbers';

        const stepNumSpacer = document.createElement('div');
        stepNumSpacer.className = 'neon-piano-roll-step-num-spacer';
        stepNumsRow.appendChild(stepNumSpacer);

        for (let s = 0; s < steps; s++) {
            const stepNum = document.createElement('div');
            stepNum.className = 'neon-piano-roll-step-num';
            stepNum.textContent = (s + 1).toString().padStart(2, '0');
            stepNumsRow.appendChild(stepNum);
        }
        grid.appendChild(stepNumsRow);

        const mainArea = document.createElement('div');
        mainArea.style.display = 'flex';
        mainArea.style.position = 'relative';

        const noteLabels = document.createElement('div');
        noteLabels.className = 'neon-piano-roll-note-labels';

        for (let n = currentNumKeys - 1; n >= 0; n--) {
            const noteIdx = n;
            const labelEl = document.createElement('div');
            labelEl.className = 'neon-piano-roll-note-label';
            if (isBlackKey(n)) labelEl.classList.add('black-key');
            if (isCNote(n)) labelEl.classList.add('c-note');
            if (stuckNotes.has(noteIdx)) labelEl.classList.add('stuck');
            labelEl.textContent = getNoteName(n);
            labelEl.dataset.noteIdx = String(noteIdx);

            labelEl.addEventListener('dblclick', (e) => {
                e.preventDefault();
                if (stuckNotes.has(noteIdx)) {
                    stuckNotes.delete(noteIdx);
                    labelEl.classList.remove('stuck');
                    onNoteOff?.(noteIdx);
                    onKeyHighlight?.(noteIdx, false);
                } else {
                    stuckNotes.add(noteIdx);
                    labelEl.classList.add('stuck');
                    onNoteOn?.(noteIdx);
                    onKeyHighlight?.(noteIdx, true);
                }
            });

            noteLabels.appendChild(labelEl);
        }
        mainArea.appendChild(noteLabels);

        const stepsArea = document.createElement('div');
        stepsArea.className = 'neon-piano-roll-steps';
        stepsArea.style.position = 'relative';

        for (let s = 0; s < steps; s++) {
            const stepCol = document.createElement('div');
            stepCol.className = 'neon-piano-roll-step-column';
            stepCol.dataset.step = String(s);

            for (let n = currentNumKeys - 1; n >= 0; n--) {
                const cell = document.createElement('div');
                cell.className = 'neon-piano-roll-cell';
                if (isBlackKey(n)) cell.classList.add('black-key');
                if (isCNote(n)) cell.classList.add('c-note');

                const noteValue = tracks[selectedTrackIdx][s]?.[n] || 0;
                if (noteValue !== 0) cell.classList.add('has-note');

                cell.dataset.step = String(s);
                cell.dataset.note = String(n);

                cell.addEventListener('click', () => {
                    if (!tracks[selectedTrackIdx][s]) return;
                    const currentValue = tracks[selectedTrackIdx][s][n];
                    if (currentValue > 0 || currentValue === -1) {
                        clearNoteAt(s, n);
                    } else {
                        setNoteDuration(s, n, 1);
                    }
                    render();
                });

                stepCol.appendChild(cell);
            }

            stepsArea.appendChild(stepCol);
        }

        stepsArea.appendChild(playhead);
        mainArea.appendChild(stepsArea);
        grid.appendChild(mainArea);
    }

    function updatePlayhead(): void {
        if (!isPlaying || fallingMode) {
            playhead.classList.add('hidden');
            return;
        }

        playhead.classList.remove('hidden');

        if (vertical) {
            const stepHeight = 20;
            playhead.style.top = `${currentStep * stepHeight}px`;
            playhead.style.left = '0';
            playhead.style.width = '100%';
            playhead.style.height = `${stepHeight}px`;

            const scrollTop = scrollArea.scrollTop;
            const viewHeight = scrollArea.clientHeight;
            const playheadTop = currentStep * stepHeight;

            if (playheadTop < scrollTop || playheadTop > scrollTop + viewHeight - 50) {
                scrollArea.scrollTop = Math.max(0, playheadTop - viewHeight / 2);
            }
        } else {
            const stepWidth = 24;
            playhead.style.left = `${currentStep * stepWidth}px`;
            playhead.style.top = '0';
            playhead.style.width = `${stepWidth}px`;
            playhead.style.height = '100%';
        }
    }

    function collectNotesAtStep(stepIndex: number, highlight: boolean): PianoRollNote[] {
        const stepNotes: PianoRollNote[] = [];
        tracks.forEach((track, trackIdx) => {
            if (!enabledTracks.has(trackIdx)) return;
            if (!track[stepIndex]) return;

            track[stepIndex].forEach((noteValue, noteIdx) => {
                // Notes trigger at their start cell; continuation cells (-1) are silent
                if (noteValue <= 0) return;

                const freq = getFrequency ? getFrequency(noteIdx) : null;
                const duration = noteValue;
                stepNotes.push({ trackIdx, noteIdx, freq, duration });
                if (highlight) {
                    onKeyHighlight?.(noteIdx, true);
                    const stepTime = (60 / bpm / 4) * 1000;
                    const highlightDuration = Math.min(stepTime * duration * 0.9, stepTime * duration - 50);
                    setTimeout(() => onKeyHighlight?.(noteIdx, false), Math.max(100, highlightDuration));
                }
            });
        });
        return stepNotes;
    }

    function triggerStep(stepIndex: number): void {
        onPlay?.(stepIndex, collectNotesAtStep(stepIndex, true));
    }

    function animateFalling(timestamp: number): void {
        if (!isPlaying) return;

        let continuousProgress: number;
        if (externalPosition) {
            // External clock: position comes from the app's transport.
            const pos = externalPosition();
            if (pos === null) {
                animationFrameId = requestAnimationFrame(animateFalling);
                return;
            }
            continuousProgress = pos / steps;
        } else {
            const stepTime = (60 / bpm / 4) * 1000;
            const elapsed = timestamp - playStartTime;
            const totalDuration = stepTime * steps;

            if (!loop && elapsed >= totalDuration) {
                stop();
                return;
            }
            continuousProgress = elapsed / totalDuration;
        }

        const stepHeight = 20;
        const viewHeight = scrollArea.clientHeight;
        const patternHeight = steps * stepHeight;

        const loopProgress = continuousProgress % 1;
        const exactStep = loopProgress * steps;
        // Steps play in ascending order; the row landing at the trigger line
        // displays the matching step via the reversed render mapping below.
        const newStep = Math.floor(exactStep) % steps;

        if (newStep !== lastTriggeredStep) {
            currentStep = newStep;
            lastTriggeredStep = newStep;
            if (externalPosition) {
                // Audio is scheduled by the app; only mirror key highlights.
                collectNotesAtStep(currentStep, true);
            } else {
                triggerStep(currentStep);
            }
        }

        if (stepsAreaElement) {
            const rows = stepsAreaElement.querySelectorAll('.neon-piano-roll-step-column') as NodeListOf<HTMLElement>;
            const totalRows = rows.length;
            const visualHeight = totalRows * stepHeight;

            const scrollWithinPattern = (continuousProgress * patternHeight) % patternHeight;

            const visualOffset = (totalRows % steps) * stepHeight;

            rows.forEach((row) => {
                const renderIndex = parseInt(row.dataset.renderIndex || '0');
                const baseY = viewHeight - (totalRows - renderIndex) * stepHeight;

                let rowY = baseY + scrollWithinPattern + visualOffset;

                while (rowY >= viewHeight) {
                    rowY -= visualHeight;
                }
                while (rowY < viewHeight - visualHeight) {
                    rowY += visualHeight;
                }

                row.style.transform = `translateY(${rowY}px)`;
            });
        }

        animationFrameId = requestAnimationFrame(animateFalling);
    }

    function playTraditional(): void {
        if (!isPlaying) return;

        triggerStep(currentStep);
        updatePlayhead();

        const stepTime = (60 / bpm / 4) * 1000;
        currentStep = (currentStep + 1) % steps;

        if (!loop && currentStep === 0) {
            stop();
            return;
        }

        timer = setTimeout(() => playTraditional(), stepTime);
    }

    /** Traditional-mode playhead driven by the external transport clock. */
    function pollTraditionalExternal(): void {
        if (!isPlaying) return;

        const pos = externalPosition!();
        if (pos !== null) {
            const s = Math.floor(pos) % steps;
            if (s !== lastTriggeredStep) {
                lastTriggeredStep = s;
                currentStep = s;
                collectNotesAtStep(s, true);
                updatePlayhead();
            }
        }
        animationFrameId = requestAnimationFrame(pollTraditionalExternal);
    }

    function start(): void {
        if (isPlaying) return;
        isPlaying = true;
        currentStep = 0;
        lastTriggeredStep = -1;
        wrapper.classList.add('playing');

        render();

        onPlayStateChange?.(true);

        if (fallingMode && vertical) {
            if (externalPosition) {
                animationFrameId = requestAnimationFrame(animateFalling);
            } else {
                currentStep = 0;
                lastTriggeredStep = 0;
                triggerStep(0);

                playStartTime = performance.now();
                animationFrameId = requestAnimationFrame(animateFalling);
            }
        } else {
            playhead.classList.remove('hidden');
            if (externalPosition) {
                pollTraditionalExternal();
            } else {
                playTraditional();
            }
        }
    }

    function stop(): void {
        if (!isPlaying) return;
        isPlaying = false;
        lastTriggeredStep = -1;
        wrapper.classList.remove('playing');

        if (animationFrameId) {
            cancelAnimationFrame(animationFrameId);
            animationFrameId = null;
        }
        if (timer) {
            clearTimeout(timer);
            timer = null;
        }

        if (stepsAreaElement) {
            const rows = stepsAreaElement.querySelectorAll('.neon-piano-roll-step-column') as NodeListOf<HTMLElement>;
            rows.forEach(row => {
                row.style.transform = '';
            });
        }

        playhead.classList.add('hidden');

        render();

        onPlayStateChange?.(false);

        for (let i = 0; i < currentNumKeys; i++) {
            onKeyHighlight?.(i, false);
        }
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
    renderTrackTabs();
    render();

    return {
        element: wrapper,
        grid,
        scrollArea,

        getNoteLabelsElement(): HTMLElement | null {
            return wrapper.querySelector('.neon-piano-roll-note-labels');
        },

        getHorizontalScroll(): number {
            const labels = this.getNoteLabelsElement();
            return labels ? labels.scrollLeft : 0;
        },

        setHorizontalScroll(scrollLeftVal: number): void {
            const labels = this.getNoteLabelsElement();
            if (labels) {
                labels.scrollLeft = scrollLeftVal;
            }
            if (scrollArea) {
                scrollArea.scrollLeft = scrollLeftVal;
            }
        },

        onHorizontalScroll(callback: (scrollLeft: number) => void): void {
            const labels = this.getNoteLabelsElement();
            if (labels) {
                labels.addEventListener('scroll', () => callback(labels.scrollLeft));
            }
            if (scrollArea) {
                scrollArea.addEventListener('scroll', () => callback(scrollArea.scrollLeft));
            }
        },

        start,
        stop,
        toggle,

        get isPlaying() { return isPlaying; },
        get currentStep() { return currentStep; },
        get selectedTrackIdx() { return selectedTrackIdx; },
        get tracks() { return tracks.map(t => t.map(s => [...s])); },
        get trackNames() { return [...trackNames]; },
        get steps() { return steps; },
        get bpm() { return bpm; },
        get numKeys() { return currentNumKeys; },

        setBPM(val: number): void {
            bpm = val;
        },

        setNumKeys(newNumKeys: number): void {
            if (newNumKeys === currentNumKeys) return;
            tracks = tracks.map(track => {
                return track.map(stepNotes => {
                    const newStepNotes = new Array(newNumKeys).fill(0);
                    for (let i = 0; i < Math.min(stepNotes.length, newNumKeys); i++) {
                        newStepNotes[i] = stepNotes[i];
                    }
                    return newStepNotes;
                });
            });
            currentNumKeys = newNumKeys;
            render();
        },

        setSteps(newSteps: number): void {
            tracks = tracks.map(track => {
                const newTrack: number[][] = [];
                for (let s = 0; s < newSteps; s++) {
                    if (s < track.length) {
                        newTrack.push([...track[s]]);
                    } else {
                        newTrack.push(new Array(currentNumKeys).fill(0));
                    }
                }
                return newTrack;
            });
            steps = newSteps;
            render();
        },

        setRange(newRootNote: number, newOctave: number): void {
            currentRootNote = newRootNote;
            currentOctave = newOctave;
            render();
        },

        getRange(): { rootNote: number; octave: number } {
            return { rootNote: currentRootNote, octave: currentOctave };
        },

        selectTrack(idx: number): void {
            if (idx >= 0 && idx < maxTracks) {
                selectedTrackIdx = idx;
                renderTrackTabs();
                render();
                onTrackSelect?.(idx);
            }
        },

        setTrackNames(names: string[]): void {
            if (Array.isArray(names)) {
                names.forEach((name, i) => {
                    if (i < trackNames.length && name) {
                        trackNames[i] = name.substring(0, 10).toUpperCase();
                    }
                });
                renderTrackTabs();
            }
        },

        setTrackName(trackIdx: number, name: string): void {
            if (trackIdx >= 0 && trackIdx < trackNames.length && name) {
                trackNames[trackIdx] = name.substring(0, 10).toUpperCase();
                renderTrackTabs();
            }
        },

        setNoteAt(trackIdx: number, step: number, noteIdx: number, duration: number = 1): void {
            if (trackIdx < 0 || trackIdx >= maxTracks) return;
            if (step < 0 || step >= steps) return;
            if (noteIdx < 0 || noteIdx >= currentNumKeys) return;

            const existingValue = tracks[trackIdx][step][noteIdx];
            if (existingValue !== 0) {
                if (existingValue > 0) {
                    for (let d = 0; d < existingValue && (step + d) < steps; d++) {
                        tracks[trackIdx][step + d][noteIdx] = 0;
                    }
                } else if (existingValue === -1) {
                    let startStep = step - 1;
                    while (startStep >= 0 && tracks[trackIdx][startStep][noteIdx] === -1) {
                        startStep--;
                    }
                    if (startStep >= 0) {
                        const startDuration = tracks[trackIdx][startStep][noteIdx];
                        if (startDuration > 0) {
                            for (let d = 0; d < startDuration && (startStep + d) < steps; d++) {
                                tracks[trackIdx][startStep + d][noteIdx] = 0;
                            }
                        }
                    }
                }
            }

            tracks[trackIdx][step][noteIdx] = duration;
            for (let d = 1; d < duration && (step + d) < steps; d++) {
                tracks[trackIdx][step + d][noteIdx] = -1;
            }

            render();
        },

        setTracksFromTracker(trackerData: TrackerNoteData[][]): void {
            tracks = [];
            for (let t = 0; t < maxTracks; t++) {
                const track = createEmptyTrack();
                if (trackerData[t]) {
                    trackerData[t].forEach((noteData, step) => {
                        if (noteData === null || noteData === undefined) return;
                        if (step >= steps) return;

                        let noteIdx: number;
                        let duration: number;

                        if (Array.isArray(noteData)) {
                            noteIdx = noteData[0];
                            duration = noteData[1] || 1;
                        } else if (typeof noteData === 'number') {
                            noteIdx = noteData;
                            duration = 1;
                        } else {
                            return;
                        }

                        if (noteIdx < 0 || noteIdx >= currentNumKeys) return;

                        track[step][noteIdx] = duration;

                        for (let d = 1; d < duration && (step + d) < steps; d++) {
                            track[step + d][noteIdx] = -1;
                        }
                    });
                }
                tracks.push(track);
            }
            render();
        },

        getTracksAsTracker(): TrackerNoteData[][] {
            return tracks.map(track => {
                return track.map(stepNotes => {
                    const noteIdx = stepNotes.findIndex(n => n > 0);
                    if (noteIdx < 0) return null;

                    const duration = stepNotes[noteIdx];
                    return duration > 1 ? [noteIdx, duration] : noteIdx;
                });
            });
        },

        setTracks(newTracks: (number | boolean)[][][]): void {
            tracks = newTracks.map(t => t.map(s => {
                return s.map(noteValue => {
                    if (noteValue === true) return 1;
                    if (noteValue === false) return 0;
                    return noteValue as number;
                });
            }));
            render();
        },

        clearTrack(trackIdx: number = selectedTrackIdx): void {
            tracks[trackIdx] = createEmptyTrack();
            render();
        },

        clearAll(): void {
            tracks = [];
            for (let t = 0; t < maxTracks; t++) {
                tracks.push(createEmptyTrack());
            }
            render();
        },

        setDisabled(value: boolean): void {
            isDisabled = value;
            wrapper.classList.toggle('disabled', isDisabled);
        },

        getNotesAtStep(step: number): PianoRollNote[] {
            return collectNotesAtStep(step, false);
        },

        getState(): PianoRollState {
            return {
                bpm,
                steps,
                numKeys: currentNumKeys,
                rootNote: currentRootNote,
                octave: currentOctave,
                tracks: tracks.map(t => t.map(s => [...s])),
                trackNames: [...trackNames],
                selectedTrackIdx,
                enabledTracks: [...enabledTracks]
            };
        },

        loadState(state: Partial<PianoRollState>): void {
            if (state.bpm !== undefined) bpm = state.bpm;
            if (state.rootNote !== undefined) currentRootNote = state.rootNote;
            if (state.octave !== undefined) currentOctave = state.octave;
            if (state.numKeys !== undefined) currentNumKeys = state.numKeys;
            if (state.steps !== undefined) {
                steps = state.steps;
            }
            if (state.tracks) {
                tracks = state.tracks.map(t => t.map(s => {
                    return s.map(noteValue => {
                        if ((noteValue as unknown) === true) return 1;
                        if ((noteValue as unknown) === false) return 0;
                        return noteValue;
                    });
                }));
            }
            if (state.trackNames) {
                trackNames = [...state.trackNames];
            }
            if (state.selectedTrackIdx !== undefined) {
                selectedTrackIdx = state.selectedTrackIdx;
            }
            if (state.enabledTracks !== undefined && Array.isArray(state.enabledTracks)) {
                enabledTracks.clear();
                state.enabledTracks.forEach(t => enabledTracks.add(t));
            }
            renderTrackTabs();
            render();
        },

        render,

        highlightNoteLabel(noteIdx: number, active: boolean): void {
            const labels = wrapper.querySelectorAll('.neon-piano-roll-note-label');
            labels.forEach(label => {
                if (parseInt((label as HTMLElement).dataset.noteIdx || '') === noteIdx) {
                    label.classList.toggle('keyboard-active', active);
                }
            });
        },

        releaseAllStuckNotes(): void {
            stuckNotes.forEach(noteIdx => {
                onNoteOff?.(noteIdx);
                onKeyHighlight?.(noteIdx, false);
            });
            stuckNotes.clear();
            const labels = wrapper.querySelectorAll('.neon-piano-roll-note-label.stuck');
            labels.forEach(label => label.classList.remove('stuck'));
        },

        get stuckNotes() {
            return new Set(stuckNotes);
        },

        get enabledTracks() {
            return new Set(enabledTracks);
        },

        isTrackEnabled(trackIdx: number): boolean {
            return enabledTracks.has(trackIdx);
        },

        setTrackEnabled(trackIdx: number, enabled: boolean): void {
            if (trackIdx < 0 || trackIdx >= maxTracks) return;
            if (enabled) {
                enabledTracks.add(trackIdx);
            } else {
                if (enabledTracks.size > 1) {
                    enabledTracks.delete(trackIdx);
                }
            }
            renderTrackTabs();
            render();
        },

        toggleTrackEnabled(trackIdx: number): void {
            if (trackIdx < 0 || trackIdx >= maxTracks) return;
            if (enabledTracks.has(trackIdx)) {
                if (enabledTracks.size > 1) {
                    enabledTracks.delete(trackIdx);
                }
            } else {
                enabledTracks.add(trackIdx);
            }
            renderTrackTabs();
            render();
        },

        shiftPitch(semitones: number, trackIdx: number = selectedTrackIdx): void {
            if (trackIdx < 0 || trackIdx >= maxTracks) return;
            const prevSelected = selectedTrackIdx;
            selectedTrackIdx = trackIdx;
            shiftNotes(semitones);
            selectedTrackIdx = prevSelected;
        },

        destroy(): void {
            stuckNotes.forEach(noteIdx => {
                onNoteOff?.(noteIdx);
                onKeyHighlight?.(noteIdx, false);
            });
            stuckNotes.clear();
            stop();
            document.removeEventListener('mousemove', handleGlobalMouseMove);
            document.removeEventListener('mouseup', handleGlobalMouseUp);
        }
    };
}
