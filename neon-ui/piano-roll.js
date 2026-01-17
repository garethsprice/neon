// Neon UI Kit - Piano Roll Component
// Vertical piano roll with notes falling toward keyboard

let stylesInjected = false;

function injectStyles() {
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

/**
 * Create a vertical piano roll with multiple pattern lanes
 *
 * Terminology:
 * - "Pattern" = a note sequence for one pattern voice (bass, lead, pads, arps)
 * - "Track" = all 4 patterns playing together as a composition
 * - "Pattern Bank A-H" = saved versions of tracks
 * - This component displays and edits the 4 patterns that make up the current track
 *
 * @param {Object} options
 * @param {string} [options.label] - Label text
 * @param {number} [options.steps=64] - Number of steps in the pattern
 * @param {number} [options.numKeys=12] - Number of keys/notes to display
 * @param {number} [options.rootNote=0] - Root note (0=C)
 * @param {number} [options.octave=3] - Starting octave
 * @param {number} [options.maxTracks=4] - Maximum patterns (internally called tracks)
 * @param {string[]} [options.trackNames] - Pattern names for tabs
 * @param {number} [options.bpm=120] - Beats per minute
 * @param {boolean} [options.vertical=true] - Vertical orientation (notes fall down)
 * @param {boolean} [options.loop=true] - Loop playback
 * @param {boolean} [options.showTrackTabs=true] - Show pattern selection tabs
 * @param {Function} [options.onNoteToggle] - Called when note is toggled: (patternIdx, step, noteIdx, active)
 * @param {Function} [options.onTrackSelect] - Called when pattern is selected: (patternIdx)
 * @param {Function} [options.onPlay] - Called on each step: (step, notes[])
 * @param {Function} [options.onPlayStateChange] - Called when play state changes: (isPlaying)
 * @param {Function} [options.getFrequency] - Get frequency for note index
 * @returns {Object}
 */
export function createPianoRoll(options = {}) {
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
        showStepNumbers = false, // Default off for cleaner alignment
        fallingMode = true, // Animate notes falling towards keyboard
        onNoteToggle = null,
        onTrackSelect = null,
        onPlay = null,
        onPlayStateChange = null,
        onKeyHighlight = null, // Callback to highlight keyboard keys
        onNoteOn = null, // Callback when a note starts (for stuck keys)
        onNoteOff = null, // Callback when a note stops (for stuck keys)
        getFrequency = null,
        disabled = false
    } = options;

    let steps = initialSteps;
    let currentOctave = initialOctave;
    let currentRootNote = rootNote;
    let currentNumKeys = numKeys;
    let bpm = initialBpm;
    let currentStep = 0;
    let lastTriggeredStep = -1; // Track last triggered step separately for first-frame detection
    let isPlaying = false;
    let isDisabled = disabled;
    let timer = null;
    let animationFrameId = null;
    let playStartTime = 0;
    let selectedTrackIdx = 0;
    let stepNumbersVisible = showStepNumbers;
    let stepsAreaElement = null; // Reference for steps area (row recycling)
    let stuckNotes = new Set(); // Notes held on via double-click
    let enabledTracks = new Set([0, 1, 2, 3].slice(0, maxTracks)); // All tracks enabled by default

    // Tracks data: tracks[trackIdx][step][noteIdx] = duration value
    // 0 = no note, N > 0 = note starts with duration N, -1 = continuation of note from above
    let tracks = [];
    for (let t = 0; t < maxTracks; t++) {
        tracks.push(createEmptyTrack());
    }
    let trackNames = [...initialTrackNames];

    // Drag state for extending notes
    let dragState = null;

    function createEmptyTrack() {
        const track = [];
        for (let s = 0; s < steps; s++) {
            track.push(new Array(currentNumKeys).fill(0));
        }
        return track;
    }

    // Helper: Set a note with duration at a step, clearing any overlapping notes
    function setNoteDuration(step, noteIdx, duration) {
        if (!tracks[selectedTrackIdx][step]) return;

        // First, clear any existing note at this position
        clearNoteAt(step, noteIdx);

        if (duration <= 0) {
            tracks[selectedTrackIdx][step][noteIdx] = 0;
            return;
        }

        // Set the note start with duration
        tracks[selectedTrackIdx][step][noteIdx] = duration;

        // Set continuation markers for subsequent steps
        for (let d = 1; d < duration && (step + d) < steps; d++) {
            // Clear any note that was at the continuation position
            const existingValue = tracks[selectedTrackIdx][step + d][noteIdx];
            if (existingValue > 0) {
                // There's a note starting here - clear it
                clearNoteAt(step + d, noteIdx);
            }
            tracks[selectedTrackIdx][step + d][noteIdx] = -1;
        }

        onNoteToggle?.(selectedTrackIdx, step, noteIdx, duration > 0, duration);
    }

    // Helper: Clear a note and its continuations
    function clearNoteAt(step, noteIdx) {
        const value = tracks[selectedTrackIdx][step]?.[noteIdx];
        if (!value) return;

        if (value > 0) {
            // This is a note start - clear it and its continuations
            tracks[selectedTrackIdx][step][noteIdx] = 0;
            for (let d = 1; d < value && (step + d) < steps; d++) {
                if (tracks[selectedTrackIdx][step + d][noteIdx] === -1) {
                    tracks[selectedTrackIdx][step + d][noteIdx] = 0;
                }
            }
        } else if (value === -1) {
            // This is a continuation - find the start and clear the whole note
            let startStep = step - 1;
            while (startStep >= 0 && tracks[selectedTrackIdx][startStep][noteIdx] === -1) {
                startStep--;
            }
            if (startStep >= 0 && tracks[selectedTrackIdx][startStep][noteIdx] > 0) {
                clearNoteAt(startStep, noteIdx);
            }
        }
    }

    // Helper: Shift all notes in the selected pattern up or down with wraparound
    function shiftNotes(direction) {
        const track = tracks[selectedTrackIdx];

        // Create a new track with shifted notes
        const newTrack = [];
        for (let s = 0; s < steps; s++) {
            newTrack.push(new Array(currentNumKeys).fill(0));
        }

        // Copy notes with shift, handling wraparound
        for (let s = 0; s < steps; s++) {
            for (let n = 0; n < currentNumKeys; n++) {
                const value = track[s][n];
                if (value !== 0) {
                    // Calculate new note index with wraparound
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

    // Helper: Apply visual styles to a cell based on note value
    function applyNoteCellStyles(cell, step, noteIdx, value) {
        cell.classList.remove('has-note', 'note-continue', 'note-end', 'note-start-extended', 'ghost-note', 'ghost-continue');

        if (value > 0) {
            // Note start
            cell.classList.add('has-note');
            if (value > 1) {
                cell.classList.add('note-start-extended');
            }
        } else if (value === -1) {
            // Continuation
            cell.classList.add('note-continue');
            // Check if this is the last continuation (note end)
            const nextStep = step + 1;
            if (nextStep >= steps || tracks[selectedTrackIdx][nextStep]?.[noteIdx] !== -1) {
                cell.classList.add('note-end');
            }
        } else {
            // No note on selected pattern - check for ghost notes from other enabled patterns
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

    // Global mouse handlers for drag
    function handleGlobalMouseMove(e) {
        if (!dragState) return;

        const cell = document.elementFromPoint(e.clientX, e.clientY);
        if (!cell?.classList.contains('neon-piano-roll-cell')) return;

        const currentStep = parseInt(cell.dataset.step);
        const currentNote = parseInt(cell.dataset.note);

        // Only extend in the same note column
        if (currentNote !== dragState.note) return;

        // Calculate new duration (only extend downward in vertical mode)
        const newDuration = Math.max(1, currentStep - dragState.startStep + 1);

        // Update the note duration
        setNoteDuration(dragState.startStep, dragState.note, newDuration);
        render();
    }

    function handleGlobalMouseUp(e) {
        if (dragState) {
            // If we just clicked without dragging and it was an existing note, toggle it off
            if (dragState.mode === 'extend') {
                const cell = document.elementFromPoint(e.clientX, e.clientY);
                const clickedStep = cell?.dataset?.step ? parseInt(cell.dataset.step) : -1;
                const clickedNote = cell?.dataset?.note ? parseInt(cell.dataset.note) : -1;

                // If clicked on the same cell without moving, toggle the note off
                if (clickedStep === dragState.startStep && clickedNote === dragState.note) {
                    const currentDuration = tracks[selectedTrackIdx][dragState.startStep]?.[dragState.note] || 0;
                    if (currentDuration === dragState.originalDuration) {
                        // No change means single click - toggle off
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

    // Pattern tabs (internally called tracks for API compatibility)
    let trackTabsContainer = null;
    if (showTrackTabs) {
        trackTabsContainer = document.createElement('div');
        trackTabsContainer.className = 'neon-piano-roll-track-tabs';
        header.appendChild(trackTabsContainer);
    }

    // Controls
    const controls = document.createElement('div');
    controls.className = 'neon-piano-roll-controls';

    // Step numbers toggle button
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

    // Remove bar button
    const removeBarBtn = document.createElement('button');
    removeBarBtn.className = 'neon-piano-roll-btn';
    removeBarBtn.textContent = '-BAR';
    removeBarBtn.title = 'Remove 1 bar (16 steps)';
    removeBarBtn.addEventListener('click', () => {
        if (steps <= 16) return; // Keep at least 1 bar
        const newSteps = steps - 16;
        // Resize all tracks
        tracks = tracks.map(track => track.slice(0, newSteps));
        steps = newSteps;
        render();
    });
    controls.appendChild(removeBarBtn);

    // Add bar button
    const addBarBtn = document.createElement('button');
    addBarBtn.className = 'neon-piano-roll-btn';
    addBarBtn.textContent = '+BAR';
    addBarBtn.title = 'Add 1 bar (16 steps)';
    addBarBtn.addEventListener('click', () => {
        const newSteps = steps + 16;
        // Resize all tracks
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

    // Pitch shift down octave
    const shiftOctDownBtn = document.createElement('button');
    shiftOctDownBtn.className = 'neon-piano-roll-btn';
    shiftOctDownBtn.textContent = '−12';
    shiftOctDownBtn.title = 'Shift notes down 1 octave';
    shiftOctDownBtn.style.fontSize = '0.5em';
    shiftOctDownBtn.addEventListener('click', () => shiftNotes(-12));
    controls.appendChild(shiftOctDownBtn);

    // Pitch shift down (notes move left visually in vertical mode)
    const shiftDownBtn = document.createElement('button');
    shiftDownBtn.className = 'neon-piano-roll-btn';
    shiftDownBtn.textContent = '−';
    shiftDownBtn.title = 'Shift notes down 1 semitone';
    shiftDownBtn.style.fontWeight = 'bold';
    shiftDownBtn.style.fontSize = '1em';
    shiftDownBtn.addEventListener('click', () => shiftNotes(-1));
    controls.appendChild(shiftDownBtn);

    // Pitch shift up (notes move right visually in vertical mode)
    const shiftUpBtn = document.createElement('button');
    shiftUpBtn.className = 'neon-piano-roll-btn';
    shiftUpBtn.textContent = '+';
    shiftUpBtn.title = 'Shift notes up 1 semitone';
    shiftUpBtn.style.fontWeight = 'bold';
    shiftUpBtn.style.fontSize = '1em';
    shiftUpBtn.addEventListener('click', () => shiftNotes(1));
    controls.appendChild(shiftUpBtn);

    // Pitch shift up octave
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

    // Playhead (for non-falling mode)
    const playhead = document.createElement('div');
    playhead.className = 'neon-piano-roll-playhead hidden';

    // Play line (for falling mode - fixed at bottom of scroll area)
    const playLine = document.createElement('div');
    playLine.className = 'neon-piano-roll-play-line';

    scrollArea.appendChild(grid);
    scrollArea.appendChild(playhead);
    scrollArea.appendChild(playLine);
    container.appendChild(scrollArea);
    wrapper.appendChild(container);

    // Attach global mouse handlers for drag-to-extend
    document.addEventListener('mousemove', handleGlobalMouseMove);
    document.addEventListener('mouseup', handleGlobalMouseUp);

    function isBlackKey(noteIdx) {
        const note = (currentRootNote + noteIdx) % 12;
        return [1, 3, 6, 8, 10].includes(note);
    }

    function isCNote(noteIdx) {
        return (currentRootNote + noteIdx) % 12 === 0;
    }

    function getNoteName(noteIdx) {
        const noteInOctave = (currentRootNote + noteIdx) % 12;
        const noteOctave = Math.floor((currentRootNote + noteIdx) / 12) + currentOctave;
        return `${NOTE_NAMES[noteInOctave]}${noteOctave}`;
    }

    function renderTrackTabs() {
        if (!trackTabsContainer) return;
        trackTabsContainer.innerHTML = '';

        for (let t = 0; t < maxTracks; t++) {
            const tab = document.createElement('button');
            const isActive = t === selectedTrackIdx;
            const isEnabled = enabledTracks.has(t);
            tab.className = `neon-piano-roll-track-tab${isActive ? ' active' : ''}${isEnabled ? ' playback-enabled' : ''}`;
            tab.textContent = trackNames[t] || `PATTERN ${t + 1}`;
            tab.title = isEnabled ? 'Double-click to disable playback' : 'Double-click to enable playback';

            // Single click selects pattern for editing
            tab.addEventListener('click', () => {
                selectedTrackIdx = t;
                renderTrackTabs();
                render();
                onTrackSelect?.(t);
            });

            // Double click toggles playback for this pattern
            tab.addEventListener('dblclick', (e) => {
                e.preventDefault();
                e.stopPropagation();
                if (enabledTracks.has(t)) {
                    // Don't allow disabling all patterns
                    if (enabledTracks.size > 1) {
                        enabledTracks.delete(t);
                    }
                } else {
                    enabledTracks.add(t);
                }
                renderTrackTabs();
                render(); // Re-render to update ghost notes
            });

            trackTabsContainer.appendChild(tab);
        }
    }

    function render() {
        grid.innerHTML = '';

        // Toggle small-keys class for proper flex behavior
        wrapper.classList.toggle('small-keys', currentNumKeys <= 24);

        if (vertical) {
            renderVertical();
        } else {
            renderHorizontal();
        }

        updatePlayhead();
    }

    function renderVertical() {
        // Content row wraps step numbers and steps area side by side
        const contentRow = document.createElement('div');
        contentRow.className = 'neon-piano-roll-content-row';

        // Step numbers column (left side)
        const stepNumsCol = document.createElement('div');
        stepNumsCol.className = 'neon-piano-roll-step-numbers';

        // Notes fall downward toward play line at bottom
        // Step order stays consistent between edit and play modes
        const stepHeight = 20;

        // For falling mode, render enough rows to fill viewport plus buffer for seamless scrolling
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

        // Steps area - rows will be positioned absolutely for recycling during animation
        const stepsArea = document.createElement('div');
        stepsArea.className = 'neon-piano-roll-steps';
        stepsArea.style.position = 'relative';

        for (let i = 0; i < totalRenderSteps; i++) {
            const s = i % steps;
            const stepRow = document.createElement('div');
            stepRow.className = 'neon-piano-roll-step-column';
            stepRow.dataset.step = s;
            stepRow.dataset.renderIndex = i; // Visual position in grid

            // For falling mode, position rows absolutely for individual animation
            if (fallingMode && isPlaying) {
                stepRow.style.position = 'absolute';
                stepRow.style.left = '0';
                stepRow.style.right = '0';
                stepRow.style.height = `${stepHeight}px`;

                // Calculate initial position matching the animation at t=0
                // This prevents rows from jumping when animation starts
                const viewHeight = scrollArea.clientHeight || container.clientHeight || 400;
                const visualHeight = totalRenderSteps * stepHeight;
                const visualOffset = (totalRenderSteps % steps) * stepHeight;
                const baseY = viewHeight - (totalRenderSteps - i) * stepHeight;
                let initialY = baseY + visualOffset; // scrollWithinPattern = 0 at t=0

                // Apply same wrapping logic as animation
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

                cell.dataset.step = s;
                cell.dataset.note = n;

                // Mouse down starts potential drag
                cell.addEventListener('mousedown', (e) => {
                    e.preventDefault();
                    const step = parseInt(cell.dataset.step);
                    const note = parseInt(cell.dataset.note);
                    const currentValue = tracks[selectedTrackIdx][step]?.[note] || 0;

                    // If clicking on a continuation, find and modify the start note
                    if (currentValue === -1) {
                        // Find the start of this note
                        let startStep = step - 1;
                        while (startStep >= 0 && tracks[selectedTrackIdx][startStep][note] === -1) {
                            startStep--;
                        }
                        // Clear from this point down
                        const startDuration = tracks[selectedTrackIdx][startStep]?.[note] || 0;
                        if (startDuration > 0) {
                            const newDuration = step - startStep;
                            setNoteDuration(startStep, note, newDuration);
                            render();
                        }
                        return;
                    }

                    // Toggle or start drag from note start/empty cell
                    if (currentValue > 0) {
                        // Has a note - start drag to extend or clear it
                        dragState = {
                            startStep: step,
                            note: note,
                            originalDuration: currentValue,
                            mode: 'extend'
                        };
                    } else {
                        // Empty cell - add note and start drag
                        setNoteDuration(step, note, 1);
                        dragState = {
                            startStep: step,
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

        // Store reference to steps area for row recycling animation
        stepsAreaElement = stepsArea;

        // Add playhead to steps area
        stepsArea.appendChild(playhead);
        contentRow.appendChild(stepsArea);
        grid.appendChild(contentRow);

        // Note labels row (bottom - like keyboard) - includes spacer for step numbers
        const noteLabelsRow = document.createElement('div');
        noteLabelsRow.className = 'neon-piano-roll-note-labels';
        noteLabelsRow.style.marginLeft = '30px'; // Offset for step numbers column

        for (let n = 0; n < currentNumKeys; n++) {
            const noteIdx = n;
            const label = document.createElement('div');
            label.className = 'neon-piano-roll-note-label';
            if (isBlackKey(n)) label.classList.add('black-key');
            if (isCNote(n)) label.classList.add('c-note');
            if (stuckNotes.has(noteIdx)) label.classList.add('stuck');
            label.textContent = getNoteName(n);
            label.dataset.noteIdx = noteIdx;

            // Double-click to toggle stuck note (for tuning pattern)
            label.addEventListener('dblclick', (e) => {
                e.preventDefault();
                if (stuckNotes.has(noteIdx)) {
                    // Turn off
                    stuckNotes.delete(noteIdx);
                    label.classList.remove('stuck');
                    onNoteOff?.(noteIdx);
                    onKeyHighlight?.(noteIdx, false);
                } else {
                    // Turn on
                    stuckNotes.add(noteIdx);
                    label.classList.add('stuck');
                    onNoteOn?.(noteIdx);
                    onKeyHighlight?.(noteIdx, true);
                }
            });

            noteLabelsRow.appendChild(label);
        }
        grid.appendChild(noteLabelsRow);
    }

    function renderHorizontal() {
        // Step numbers row (top)
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

        // Main grid area
        const mainArea = document.createElement('div');
        mainArea.style.display = 'flex';
        mainArea.style.position = 'relative';

        // Note labels column (left)
        const noteLabels = document.createElement('div');
        noteLabels.className = 'neon-piano-roll-note-labels';

        for (let n = currentNumKeys - 1; n >= 0; n--) {
            const noteIdx = n;
            const label = document.createElement('div');
            label.className = 'neon-piano-roll-note-label';
            if (isBlackKey(n)) label.classList.add('black-key');
            if (isCNote(n)) label.classList.add('c-note');
            if (stuckNotes.has(noteIdx)) label.classList.add('stuck');
            label.textContent = getNoteName(n);
            label.dataset.noteIdx = noteIdx;

            // Double-click to toggle stuck note (for tuning pattern)
            label.addEventListener('dblclick', (e) => {
                e.preventDefault();
                if (stuckNotes.has(noteIdx)) {
                    stuckNotes.delete(noteIdx);
                    label.classList.remove('stuck');
                    onNoteOff?.(noteIdx);
                    onKeyHighlight?.(noteIdx, false);
                } else {
                    stuckNotes.add(noteIdx);
                    label.classList.add('stuck');
                    onNoteOn?.(noteIdx);
                    onKeyHighlight?.(noteIdx, true);
                }
            });

            noteLabels.appendChild(label);
        }
        mainArea.appendChild(noteLabels);

        // Steps area
        const stepsArea = document.createElement('div');
        stepsArea.className = 'neon-piano-roll-steps';
        stepsArea.style.position = 'relative';

        for (let s = 0; s < steps; s++) {
            const stepCol = document.createElement('div');
            stepCol.className = 'neon-piano-roll-step-column';
            stepCol.dataset.step = s;

            for (let n = currentNumKeys - 1; n >= 0; n--) {
                const cell = document.createElement('div');
                cell.className = 'neon-piano-roll-cell';
                if (isBlackKey(n)) cell.classList.add('black-key');
                if (isCNote(n)) cell.classList.add('c-note');

                const noteValue = tracks[selectedTrackIdx][s]?.[n] || 0;
                // For horizontal mode, just show has-note for any active note
                if (noteValue !== 0) cell.classList.add('has-note');

                cell.dataset.step = s;
                cell.dataset.note = n;

                // Simple click toggle for horizontal mode (no drag support)
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

    function updatePlayhead() {
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

            // Auto-scroll to keep playhead visible
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

    function triggerStep(stepIndex) {
        // Collect notes for this step across enabled tracks only
        const stepNotes = [];
        tracks.forEach((track, trackIdx) => {
            // Skip tracks not enabled for playback
            if (!enabledTracks.has(trackIdx)) return;
            if (!track[stepIndex]) return;

            track[stepIndex].forEach((noteValue, noteIdx) => {
                if (noteValue === 0) return; // No note here

                if (fallingMode && vertical) {
                    // In falling mode, notes fall down and the play line is at the bottom.
                    // The BOTTOM of a sustained note (highest step index) reaches the play line first.
                    // Trigger sound when the END of the note reaches the play line.
                    const nextStep = stepIndex + 1;
                    const nextValue = nextStep < steps ? track[nextStep]?.[noteIdx] : 0;
                    const isNoteEnd = nextValue !== -1; // Next step is not a continuation

                    if (isNoteEnd) {
                        // Find the start of this note to get duration
                        let startStep = stepIndex;
                        while (startStep > 0 && track[startStep][noteIdx] === -1) {
                            startStep--;
                        }
                        const duration = track[startStep][noteIdx];
                        if (duration > 0) {
                            const freq = getFrequency ? getFrequency(noteIdx) : null;
                            stepNotes.push({ trackIdx, noteIdx, freq, duration });
                            onKeyHighlight?.(noteIdx, true);
                            const stepTime = (60 / bpm / 4) * 1000;
                            const highlightDuration = Math.min(stepTime * duration * 0.9, stepTime * duration - 50);
                            setTimeout(() => onKeyHighlight?.(noteIdx, false), Math.max(100, highlightDuration));
                        }
                    }
                } else {
                    // Traditional mode: trigger at note START
                    if (noteValue > 0) {
                        const freq = getFrequency ? getFrequency(noteIdx) : null;
                        const duration = noteValue;
                        stepNotes.push({ trackIdx, noteIdx, freq, duration });
                        onKeyHighlight?.(noteIdx, true);
                        const stepTime = (60 / bpm / 4) * 1000;
                        const highlightDuration = Math.min(stepTime * duration * 0.9, stepTime * duration - 50);
                        setTimeout(() => onKeyHighlight?.(noteIdx, false), Math.max(100, highlightDuration));
                    }
                }
            });
        });

        onPlay?.(stepIndex, stepNotes);
    }

    function animateFalling(timestamp) {
        if (!isPlaying) return;

        const stepTime = (60 / bpm / 4) * 1000; // ms per step (16th notes)
        const elapsed = timestamp - playStartTime;
        const totalDuration = stepTime * steps;

        // Calculate progress through the sequence
        if (!loop && elapsed >= totalDuration) {
            stop();
            return;
        }

        const stepHeight = 20;
        const viewHeight = scrollArea.clientHeight;
        const patternHeight = steps * stepHeight;

        // Use continuous progress for both audio and visual to stay in sync
        const continuousProgress = elapsed / totalDuration;
        const loopProgress = continuousProgress % 1;
        const exactStep = loopProgress * steps;
        // Pattern scrolls down: step at bottom (steps-1) plays first,
        // then steps above it in descending order: 14, 13, 12, ... 0, then 15 again
        const stepsIntoLoop = Math.floor(exactStep) % steps;
        const newStep = (steps - 1 - stepsIntoLoop + steps) % steps;

        // Trigger notes when we cross into a new step
        // Use lastTriggeredStep (not currentStep) to ensure first step always triggers
        if (newStep !== lastTriggeredStep) {
            currentStep = newStep;
            lastTriggeredStep = newStep;
            triggerStep(currentStep);
        }

        // Row recycling: position each row individually and wrap when off-screen
        if (stepsAreaElement) {
            const rows = stepsAreaElement.querySelectorAll('.neon-piano-roll-step-column');
            const totalRows = rows.length;
            const visualHeight = totalRows * stepHeight;

            // Scroll position cycles through pattern height (for audio sync)
            const scrollWithinPattern = (continuousProgress * patternHeight) % patternHeight;

            // Visual offset to align the last step (steps-1) with play line at t=0
            // This matches edit mode where step 0 is at top, step N-1 is at bottom
            const visualOffset = (totalRows % steps) * stepHeight;

            rows.forEach((row) => {
                const renderIndex = parseInt(row.dataset.renderIndex);
                // Position rows from above viewport to play line
                const baseY = viewHeight - (totalRows - renderIndex) * stepHeight;

                // Scroll down based on pattern progress, with offset for audio sync
                let rowY = baseY + scrollWithinPattern + visualOffset;

                // Wrap rows: when a row exits below viewport, move it above
                while (rowY >= viewHeight) {
                    rowY -= visualHeight;
                }
                // Prevent from going too far above
                while (rowY < viewHeight - visualHeight) {
                    rowY += visualHeight;
                }

                row.style.transform = `translateY(${rowY}px)`;
            });
        }

        animationFrameId = requestAnimationFrame(animateFalling);
    }

    function playTraditional() {
        if (!isPlaying) return;

        triggerStep(currentStep);
        updatePlayhead();

        const stepTime = (60 / bpm / 4) * 1000; // 16th notes
        currentStep = (currentStep + 1) % steps;

        if (!loop && currentStep === 0) {
            stop();
            return;
        }

        timer = setTimeout(() => playTraditional(), stepTime);
    }

    function start() {
        if (isPlaying) return;
        isPlaying = true;
        currentStep = 0;
        lastTriggeredStep = -1; // Reset to ensure first step always triggers
        wrapper.classList.add('playing');

        // Re-render for playing state (enables row recycling animation)
        render();

        onPlayStateChange?.(true);

        if (fallingMode && vertical) {
            // Trigger the first step immediately (the bottom row at the play line)
            // This is step (steps-1) which is visually at the play line at t=0
            const firstStep = steps - 1;
            currentStep = firstStep;
            lastTriggeredStep = firstStep;
            triggerStep(firstStep);

            playStartTime = performance.now();
            animationFrameId = requestAnimationFrame(animateFalling);
        } else {
            playhead.classList.remove('hidden');
            playTraditional();
        }
    }

    function stop() {
        if (!isPlaying) return;
        isPlaying = false;
        lastTriggeredStep = -1; // Reset for next play
        wrapper.classList.remove('playing');

        if (animationFrameId) {
            cancelAnimationFrame(animationFrameId);
            animationFrameId = null;
        }
        if (timer) {
            clearTimeout(timer);
            timer = null;
        }

        // Reset row positions (individual rows are transformed during animation)
        if (stepsAreaElement) {
            const rows = stepsAreaElement.querySelectorAll('.neon-piano-roll-step-column');
            rows.forEach(row => {
                row.style.transform = '';
            });
        }

        playhead.classList.add('hidden');

        // Re-render for editing state
        render();

        onPlayStateChange?.(false);

        // Clear any lingering key highlights
        for (let i = 0; i < currentNumKeys; i++) {
            onKeyHighlight?.(i, false);
        }
    }

    function toggle() {
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

        // Get note labels element for scroll sync (always query fresh as it's recreated on render)
        getNoteLabelsElement() {
            return wrapper.querySelector('.neon-piano-roll-note-labels');
        },

        // Get horizontal scroll position of note labels
        getHorizontalScroll() {
            const labels = this.getNoteLabelsElement();
            return labels ? labels.scrollLeft : 0;
        },

        // Set horizontal scroll position of note labels
        setHorizontalScroll(scrollLeft) {
            const labels = this.getNoteLabelsElement();
            if (labels) {
                labels.scrollLeft = scrollLeft;
            }
            // Also scroll the grid cells horizontally
            if (scrollArea) {
                scrollArea.scrollLeft = scrollLeft;
            }
        },

        // Add scroll event listener for sync
        onHorizontalScroll(callback) {
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
        // Returns tracks with duration values (0 = no note, N > 0 = duration, -1 = continuation)
        get tracks() { return tracks.map(t => t.map(s => [...s])); },
        get trackNames() { return [...trackNames]; },
        get steps() { return steps; },
        get bpm() { return bpm; },
        get numKeys() { return currentNumKeys; },

        setBPM(val) {
            bpm = val;
        },

        setNumKeys(newNumKeys) {
            if (newNumKeys === currentNumKeys) return;
            // Resize all tracks to new number of keys
            tracks = tracks.map(track => {
                return track.map(stepNotes => {
                    const newStepNotes = new Array(newNumKeys).fill(0);
                    // Copy existing notes up to the new size
                    for (let i = 0; i < Math.min(stepNotes.length, newNumKeys); i++) {
                        newStepNotes[i] = stepNotes[i];
                    }
                    return newStepNotes;
                });
            });
            currentNumKeys = newNumKeys;
            render();
        },

        setSteps(newSteps) {
            // Resize all tracks
            tracks = tracks.map(track => {
                const newTrack = [];
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

        setRange(newRootNote, newOctave) {
            currentRootNote = newRootNote;
            currentOctave = newOctave;
            render();
        },

        getRange() {
            return { rootNote: currentRootNote, octave: currentOctave };
        },

        selectTrack(idx) {
            if (idx >= 0 && idx < maxTracks) {
                selectedTrackIdx = idx;
                renderTrackTabs();
                render();
                onTrackSelect?.(idx);
            }
        },

        setTrackNames(names) {
            if (Array.isArray(names)) {
                names.forEach((name, i) => {
                    if (i < trackNames.length && name) {
                        trackNames[i] = name.substring(0, 10).toUpperCase();
                    }
                });
                renderTrackTabs();
            }
        },

        setTrackName(trackIdx, name) {
            if (trackIdx >= 0 && trackIdx < trackNames.length && name) {
                trackNames[trackIdx] = name.substring(0, 10).toUpperCase();
                renderTrackTabs();
            }
        },

        /**
         * Set a single note on a specific track with optional duration
         */
        setNoteAt(trackIdx, step, noteIdx, duration = 1) {
            if (trackIdx < 0 || trackIdx >= maxTracks) return;
            if (step < 0 || step >= steps) return;
            if (noteIdx < 0 || noteIdx >= currentNumKeys) return;

            // Clear any existing note at this position first
            const existingValue = tracks[trackIdx][step][noteIdx];
            if (existingValue !== 0) {
                // Clear existing note chain
                if (existingValue > 0) {
                    // It's a note start - clear continuations
                    for (let d = 0; d < existingValue && (step + d) < steps; d++) {
                        tracks[trackIdx][step + d][noteIdx] = 0;
                    }
                } else if (existingValue === -1) {
                    // Find the note start and clear from there
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

            // Set the new note with duration
            tracks[trackIdx][step][noteIdx] = duration;
            for (let d = 1; d < duration && (step + d) < steps; d++) {
                tracks[trackIdx][step + d][noteIdx] = -1;
            }

            render();
        },

        /**
         * Set tracks data from array format (for compatibility with tracker/AI)
         * trackerData[trackIdx][step] can be:
         * - null: no note
         * - number: note index with duration 1
         * - [noteIndex, duration]: note with specified duration
         */
        setTracksFromTracker(trackerData) {
            tracks = [];
            for (let t = 0; t < maxTracks; t++) {
                const track = createEmptyTrack();
                if (trackerData[t]) {
                    trackerData[t].forEach((noteData, step) => {
                        if (noteData === null || noteData === undefined) return;
                        if (step >= steps) return;

                        let noteIdx, duration;

                        if (Array.isArray(noteData)) {
                            // [noteIndex, duration] format
                            noteIdx = noteData[0];
                            duration = noteData[1] || 1;
                        } else if (typeof noteData === 'number') {
                            // Simple note index with duration 1
                            noteIdx = noteData;
                            duration = 1;
                        } else {
                            return; // Invalid format
                        }

                        if (noteIdx < 0 || noteIdx >= currentNumKeys) return;

                        // Set note with duration
                        track[step][noteIdx] = duration;

                        // Set continuation markers
                        for (let d = 1; d < duration && (step + d) < steps; d++) {
                            track[step + d][noteIdx] = -1;
                        }
                    });
                }
                tracks.push(track);
            }
            render();
        },

        /**
         * Get tracks data in tracker format with duration support
         * returns trackerData[trackIdx][step]:
         * - null: no note or continuation
         * - number: note index (duration 1)
         * - [noteIndex, duration]: note with duration > 1
         */
        getTracksAsTracker() {
            return tracks.map(track => {
                return track.map(stepNotes => {
                    // Find first note that starts on this step (value > 0)
                    const noteIdx = stepNotes.findIndex(n => n > 0);
                    if (noteIdx < 0) return null;

                    const duration = stepNotes[noteIdx];
                    // Return simple format for duration 1, array format for longer
                    return duration > 1 ? [noteIdx, duration] : noteIdx;
                });
            });
        },

        setTracks(newTracks) {
            // Convert tracks with backward compatibility for boolean data
            tracks = newTracks.map(t => t.map(s => {
                return s.map(noteValue => {
                    if (noteValue === true) return 1;
                    if (noteValue === false) return 0;
                    return noteValue;
                });
            }));
            render();
        },

        clearTrack(trackIdx = selectedTrackIdx) {
            tracks[trackIdx] = createEmptyTrack();
            render();
        },

        clearAll() {
            tracks = [];
            for (let t = 0; t < maxTracks; t++) {
                tracks.push(createEmptyTrack());
            }
            render();
        },

        setDisabled(value) {
            isDisabled = value;
            wrapper.classList.toggle('disabled', isDisabled);
        },

        getState() {
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

        loadState(state) {
            if (state.bpm !== undefined) bpm = state.bpm;
            if (state.rootNote !== undefined) currentRootNote = state.rootNote;
            if (state.octave !== undefined) currentOctave = state.octave;
            if (state.numKeys !== undefined) currentNumKeys = state.numKeys;
            if (state.steps !== undefined) {
                steps = state.steps;
            }
            if (state.tracks) {
                // Convert tracks with backward compatibility for boolean data
                tracks = state.tracks.map(t => t.map(s => {
                    return s.map(noteValue => {
                        // Convert boolean to new format: true -> 1, false -> 0
                        if (noteValue === true) return 1;
                        if (noteValue === false) return 0;
                        // Already in new format (number)
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
                enabledTracks = new Set(state.enabledTracks);
            }
            renderTrackTabs();
            render();
        },

        render,

        // Highlight a note label (for keyboard alignment visualization)
        highlightNoteLabel(noteIdx, active) {
            const labels = wrapper.querySelectorAll('.neon-piano-roll-note-label');
            labels.forEach(label => {
                if (parseInt(label.dataset.noteIdx) === noteIdx) {
                    label.classList.toggle('keyboard-active', active);
                }
            });
        },

        // Release all stuck notes
        releaseAllStuckNotes() {
            stuckNotes.forEach(noteIdx => {
                onNoteOff?.(noteIdx);
                onKeyHighlight?.(noteIdx, false);
            });
            stuckNotes.clear();
            // Update visual state
            const labels = wrapper.querySelectorAll('.neon-piano-roll-note-label.stuck');
            labels.forEach(label => label.classList.remove('stuck'));
        },

        get stuckNotes() {
            return new Set(stuckNotes);
        },

        get enabledTracks() {
            return new Set(enabledTracks);
        },

        isTrackEnabled(trackIdx) {
            return enabledTracks.has(trackIdx);
        },

        setTrackEnabled(trackIdx, enabled) {
            if (trackIdx < 0 || trackIdx >= maxTracks) return;
            if (enabled) {
                enabledTracks.add(trackIdx);
            } else {
                // Don't allow disabling all tracks
                if (enabledTracks.size > 1) {
                    enabledTracks.delete(trackIdx);
                }
            }
            renderTrackTabs();
            render();
        },

        toggleTrackEnabled(trackIdx) {
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

        /**
         * Shift notes in the selected pattern by semitones (with wraparound)
         * @param {number} semitones - Number of semitones to shift (positive = up, negative = down)
         * @param {number} [trackIdx] - Pattern index to shift (defaults to selected pattern)
         */
        shiftPitch(semitones, trackIdx = selectedTrackIdx) {
            if (trackIdx < 0 || trackIdx >= maxTracks) return;
            const prevSelected = selectedTrackIdx;
            selectedTrackIdx = trackIdx;
            shiftNotes(semitones);
            selectedTrackIdx = prevSelected;
        },

        destroy() {
            // Release all stuck notes before destroying
            stuckNotes.forEach(noteIdx => {
                onNoteOff?.(noteIdx);
                onKeyHighlight?.(noteIdx, false);
            });
            stuckNotes.clear();
            stop();
            // Remove global event listeners
            document.removeEventListener('mousemove', handleGlobalMouseMove);
            document.removeEventListener('mouseup', handleGlobalMouseUp);
        }
    };
}
