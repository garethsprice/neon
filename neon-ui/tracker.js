// Neon UI Kit - Tracker Component
// Step sequencer/tracker for music applications

let stylesInjected = false;

function injectStyles() {
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

/**
 * Create an interactive step tracker/sequencer
 * @param {Object} options
 * @param {string} [options.label] - Label text displayed above tracker
 * @param {number} [options.steps=64] - Number of steps in sequence
 * @param {number} [options.maxTracks=4] - Maximum number of tracks
 * @param {string[]} [options.trackNames] - Initial track names
 * @param {number} [options.bpm=120] - Beats per minute
 * @param {number} [options.startOctave=3] - Starting octave for note display
 * @param {boolean} [options.showControls=true] - Show add/remove track buttons
 * @param {boolean} [options.showStepsInput=true] - Show steps input
 * @param {Function} [options.onTrackSelect] - Called when track is selected: (trackIndex, trackName)
 * @param {Function} [options.onStepChange] - Called when step changes: (trackIndex, stepIndex, noteValue)
 * @param {Function} [options.onPlay] - Called on each step during playback: (stepIndex, notes[])
 * @param {Function} [options.onPlayStateChange] - Called when play state changes: (isPlaying)
 * @param {Function} [options.getFrequency] - Function to get frequency for note index
 * @param {boolean} [options.disabled=false] - Whether tracker is disabled
 * @returns {Object} { element, play, stop, toggle, ... }
 */
export function createTracker(options = {}) {
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
    let timer = null;
    let tracks = [new Array(steps).fill(null)];
    let trackNames = [...initialTrackNames];
    let selectedTrackIdx = 0;

    const eventListeners = [];

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
    let stepsInput = null;
    if (showStepsInput) {
        stepsInput = document.createElement('input');
        stepsInput.type = 'number';
        stepsInput.className = 'neon-tracker-input';
        stepsInput.min = 1;
        stepsInput.max = 256;
        stepsInput.value = steps;
        stepsInput.title = 'Steps';

        const handleStepsChange = (e) => {
            const val = parseInt(e.target.value);
            if (!isNaN(val) && val > 0 && val <= 256) {
                setSteps(val);
            }
        };
        stepsInput.addEventListener('input', handleStepsChange);
        eventListeners.push({ el: stepsInput, type: 'input', fn: handleStepsChange });
        controls.appendChild(stepsInput);
    }

    // Add/Remove track buttons
    let addTrackBtn = null;
    let remTrackBtn = null;
    if (showControls) {
        addTrackBtn = document.createElement('button');
        addTrackBtn.className = 'neon-tracker-btn';
        addTrackBtn.textContent = '+ ADD';
        addTrackBtn.title = 'Add Track';

        remTrackBtn = document.createElement('button');
        remTrackBtn.className = 'neon-tracker-btn';
        remTrackBtn.textContent = '- REM';
        remTrackBtn.title = 'Remove Track';

        const handleAddTrack = () => addTrack();
        const handleRemTrack = () => removeTrack();

        addTrackBtn.addEventListener('click', handleAddTrack);
        remTrackBtn.addEventListener('click', handleRemTrack);
        eventListeners.push(
            { el: addTrackBtn, type: 'click', fn: handleAddTrack },
            { el: remTrackBtn, type: 'click', fn: handleRemTrack }
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

    function getNoteName(index) {
        if (index === null || index === undefined) return '---';
        const safeIndex = Math.max(0, index);
        const octave = Math.floor(safeIndex / 12) + startOctave;
        const name = NOTE_NAMES[safeIndex % 12];
        return `${name}-${octave}`;
    }

    function updateButtonStates() {
        if (addTrackBtn) addTrackBtn.disabled = tracks.length >= maxTracks;
        if (remTrackBtn) remTrackBtn.disabled = tracks.length <= 1;
    }

    function updateIndicator() {
        const span = indicator.querySelector('.neon-tracker-current-track');
        if (span) span.textContent = trackNames[selectedTrackIdx];
    }

    function render() {
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
            trackHeader.dataset.idx = i;

            const handleTrackClick = () => {
                selectedTrackIdx = i;
                render();
                onTrackSelect?.(i, trackNames[i]);
            };

            const handleTrackDblClick = () => {
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
                stepNote.dataset.track = trackIdx;
                stepNote.dataset.step = i;

                const handleStepClick = () => {
                    // Cycle through notes: null -> C -> D -> E -> G -> A -> C+1
                    const cycle = [null, 0, 2, 4, 7, 9, 12];
                    let currentIdx = cycle.indexOf(tracks[trackIdx][i]);
                    let nextIdx = (currentIdx + 1) % cycle.length;
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

    function updateVisualStep() {
        const rows = grid.querySelectorAll('.neon-tracker-step-row');
        rows.forEach((el, i) => {
            el.classList.toggle('active', i === currentStep && isPlaying);
        });
    }

    function addTrack() {
        if (tracks.length < maxTracks) {
            tracks.push(new Array(steps).fill(null));
            render();
        }
    }

    function removeTrack() {
        if (tracks.length > 1) {
            tracks.pop();
            if (selectedTrackIdx >= tracks.length) {
                selectedTrackIdx = tracks.length - 1;
            }
            render();
        }
    }

    function setSteps(newSteps) {
        tracks = tracks.map(track => {
            const newTrack = new Array(newSteps).fill(null);
            for (let i = 0; i < Math.min(track.length, newSteps); i++) {
                newTrack[i] = track[i];
            }
            return newTrack;
        });
        steps = newSteps;
        if (stepsInput) stepsInput.value = newSteps;
        render();
    }

    function play() {
        if (!isPlaying) return;

        // Collect notes for this step
        const stepNotes = tracks.map((track, trackIdx) => {
            const noteIndex = track[currentStep];
            if (noteIndex !== null) {
                const freq = getFrequency ? getFrequency(noteIndex) : null;
                return { trackIdx, noteIndex, freq };
            }
            return null;
        }).filter(n => n !== null);

        onPlay?.(currentStep, stepNotes);
        updateVisualStep();

        const stepTime = (60 / bpm / 4) * 1000; // 16th notes
        currentStep = (currentStep + 1) % steps;

        timer = setTimeout(() => play(), stepTime);
    }

    function start() {
        if (isPlaying) return;
        isPlaying = true;
        currentStep = 0;
        onPlayStateChange?.(true);
        play();
    }

    function stop() {
        if (!isPlaying) return;
        isPlaying = false;
        clearTimeout(timer);
        timer = null;
        onPlayStateChange?.(false);
        updateVisualStep();
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
    render();

    return {
        element: wrapper,
        grid,

        /**
         * Start playback
         */
        start,

        /**
         * Stop playback
         */
        stop,

        /**
         * Toggle playback
         * @returns {boolean} New playing state
         */
        toggle,

        /**
         * Check if playing
         * @returns {boolean}
         */
        get isPlaying() { return isPlaying; },

        /**
         * Get current step
         * @returns {number}
         */
        get currentStep() { return currentStep; },

        /**
         * Get selected track index
         * @returns {number}
         */
        get selectedTrackIdx() { return selectedTrackIdx; },

        /**
         * Get track names
         * @returns {string[]}
         */
        get trackNames() { return [...trackNames]; },

        /**
         * Get tracks data
         * @returns {Array[]}
         */
        get tracks() { return tracks.map(t => [...t]); },

        /**
         * Get number of steps
         * @returns {number}
         */
        get steps() { return steps; },

        /**
         * Get BPM
         * @returns {number}
         */
        get bpm() { return bpm; },

        /**
         * Set BPM
         * @param {number} val
         */
        setBPM(val) {
            bpm = val;
        },

        /**
         * Set number of steps
         * @param {number} newSteps
         */
        setSteps,

        /**
         * Set tracks data
         * @param {Array[]} newTracks
         */
        setTracks(newTracks) {
            if (Array.isArray(newTracks)) {
                tracks = newTracks.map(t => [...t]);
                render();
                updateVisualStep();
            }
        },

        /**
         * Set track names
         * @param {string[]} names
         */
        setTrackNames(names) {
            if (Array.isArray(names)) {
                names.forEach((name, i) => {
                    if (trackNames[i] !== undefined && name) {
                        trackNames[i] = name.substring(0, 10).toUpperCase();
                    }
                });
                render();
            }
        },

        /**
         * Set start octave for note display
         * @param {number} octave
         */
        setStartOctave(octave) {
            startOctave = octave;
            render();
        },

        /**
         * Get start octave
         * @returns {number}
         */
        getStartOctave() {
            return startOctave;
        },

        /**
         * Add a track
         */
        addTrack,

        /**
         * Remove a track
         */
        removeTrack,

        /**
         * Select a track
         * @param {number} idx
         */
        selectTrack(idx) {
            if (idx >= 0 && idx < tracks.length) {
                selectedTrackIdx = idx;
                render();
                onTrackSelect?.(idx, trackNames[idx]);
            }
        },

        /**
         * Set disabled state
         * @param {boolean} value
         */
        setDisabled(value) {
            isDisabled = value;
            wrapper.classList.toggle('disabled', isDisabled);
        },

        /**
         * Get state for serialization
         * @returns {Object}
         */
        getState() {
            return {
                bpm,
                steps,
                tracks: tracks.map(t => [...t]),
                trackNames: [...trackNames],
                selectedTrackIdx
            };
        },

        /**
         * Load state
         * @param {Object} state
         */
        loadState(state) {
            if (state.bpm !== undefined) bpm = state.bpm;
            if (state.steps !== undefined) setSteps(state.steps);
            if (state.tracks) tracks = state.tracks.map(t => [...t]);
            if (state.trackNames) trackNames = [...state.trackNames];
            if (state.selectedTrackIdx !== undefined) selectedTrackIdx = state.selectedTrackIdx;
            render();
        },

        /**
         * Re-render the tracker
         */
        render,

        /**
         * Clean up event listeners
         */
        destroy() {
            stop();
            eventListeners.forEach(({ el, type, fn }) => {
                el.removeEventListener(type, fn);
            });
            eventListeners.length = 0;
        }
    };
}
