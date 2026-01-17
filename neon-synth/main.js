/* ==========================================================================
   NEON SYNTH 2 - Main Application
   Built on create-neon-app starter kit
   ========================================================================== */

import { AudioEngine } from './audio-engine.js';
import { createKnob, showToast, createKeyboard, createPianoRoll, createPatternBank, createTrackPanel } from '../neon-ui/index.js';
import { Midi } from "@tonejs/midi";
import { runWalkthrough } from './walkthrough.js';
import { setupCloud } from './cloud.js';

// AI prompts for generation (loaded async)
let aiPrompts = {
    creativeBrief: "Based on this music direction: '{{PROMPT}}', write a vivid 2-3 sentence creative brief. Reply with ONLY the brief text.",
    detectSkill: "Analyze this prompt and identify the genre: synthwave, ambient, techno, house, trance, chillwave, darksynth, vaporwave, idm, cinematic. Prompt: '{{PROMPT}}'\nReply with ONLY the skill name.",
    skills: {},
    improve: "Suggest ONE improvement for this synth track. STATE: {{STATE}}\nReply with ONLY a short prompt.",
    thumbnail: {
        basePrompt: 'Create album cover art for an electronic music track',
        template: 'Create striking album artwork. {{SKILL_ARTWORK}}. ABSOLUTELY NO TEXT. Style: {{STYLE}}',
        styleHints: [
            'Retro synthwave aesthetic with neon grid landscapes',
            'Dark cyberpunk cityscape with rain and neon',
            'Abstract geometric shapes with glowing outlines',
            'Futuristic space scene with nebulae',
            'Minimalist design with bold typography'
        ]
    }
};

// Load AI prompts from JSON file
fetch('./ai-prompts.json')
    .then(r => r.json())
    .then(data => { aiPrompts = data; })
    .catch(() => { /* Use defaults */ });

// --------------------------------------------------------------------------
// GLOBALS
// --------------------------------------------------------------------------
const room = new WebsimSocket();

// --------------------------------------------------------------------------
// SYNTH APPLICATION CLASS
// --------------------------------------------------------------------------
class SynthApp {
    constructor() {
        this.engine = new AudioEngine();
        this.walkthroughEnabled = true;
        this.knobs = {};

        // AI Target modes: PATTERN = single pattern with current settings, TRACK = full composition
        this.aiTargetModes = ['PATTERN', 'TRACK'];
        this.aiTargetModeIdx = 1; // Default to TRACK
        this.abortAiGen = false; // Abort flag for walkthrough

        // Pattern Bank state (A-H)
        this.patterns = {};
        this.currentPatternId = 'A';
        this.initializeEmptyPatterns();

        // Track metadata
        this.trackName = '';
        this.trackDescription = '';
        this.thumbnailUrl = null;
        this.trackSkill = null; // Detected genre/skill for AI augmentation

        this.initUI();
        this.initVisualizer();
    }

    // --------------------------------------------------------------------------
    // PATTERN INITIALIZATION
    // --------------------------------------------------------------------------
    initializeEmptyPatterns() {
        const patternIds = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];
        patternIds.forEach(id => {
            this.patterns[id] = this.createEmptyPattern();
        });
    }

    createEmptyPattern() {
        // Patterns only store note data and synth parameters
        // Bars, range, musical key, octave are global track settings
        return {
            tracks: [[], [], [], []],
            trackParams: [{}, {}, {}, {}]
        };
    }

    // --------------------------------------------------------------------------
    // UI INITIALIZATION
    // --------------------------------------------------------------------------
    initUI() {
        // DOM Elements
        // Song title is now handled by trackPanel (track-panel.js)
        this.bpmInput = document.getElementById('bpm-input');
        this.startBtn = document.getElementById('start-btn');
        this.saveBtn = document.getElementById('save-btn');
        this.loadBtn = document.getElementById('load-btn');
        this.resetBtn = document.getElementById('reset-btn');
        this.midiImportBtn = document.getElementById('midi-import-btn');
        this.midiExportBtn = document.getElementById('midi-export-btn');
        this.midiInput = document.getElementById('midi-input');
        this.aiPromptInput = document.getElementById('ai-prompt');
        this.aiGenBtn = document.getElementById('ai-gen-btn');
        this.aiTargetBtn = document.getElementById('ai-target-btn');
        this.aiWalkthroughBtn = document.getElementById('ai-walkthrough-btn');
        this.aiCopilot = document.getElementById('ai-copilot');
        this.rootKeySelect = document.getElementById('root-key-select');
        this.octaveSelect = document.getElementById('octave-select');
        this.keyboardSizeSelect = document.getElementById('keyboard-size-select');
        this.communityToggleBtn = document.getElementById('community-toggle-btn');
        this.closeCommunityBtn = document.getElementById('close-community-btn');
        this.communitySidebar = document.getElementById('community-sidebar');
        this.feedFilterAll = document.getElementById('feed-filter-all');
        this.feedFilterMine = document.getElementById('feed-filter-mine');
        this.statusText = document.getElementById('status-text');
        this.stepDisplay = document.getElementById('step-display');
        this.toastContainer = document.getElementById('toast-container');
        this.visualizerCanvas = document.getElementById('visualizer');
        this.ctx = this.visualizerCanvas.getContext('2d');

        // Initialize components
        this.initKnobs();
        this.initKeyboard();
        this.initPianoRoll();
        this.initPatternBank();
        this.initTrackPanel();
        this.initEventListeners();
        this.updateAiButtonText();

        // Initialize cloud/collaboration
        this.initCloud();

        // Resume audio on first interaction
        const resumeAudio = () => this.engine.resume();
        window.addEventListener('touchstart', resumeAudio, { once: true });
        window.addEventListener('mousedown', resumeAudio, { once: true });

        // Initialize Lucide icons
        if (window.lucide) window.lucide.createIcons();

        this.setStatus('SYSTEM ONLINE');
    }

    // --------------------------------------------------------------------------
    // CLOUD INITIALIZATION
    // --------------------------------------------------------------------------
    initCloud() {
        this.cloud = setupCloud(room, {
            app: this,
            engine: this.engine,
            pianoRoll: this.pianoRoll,
            elements: {
                bpmInput: this.bpmInput,
                rootKeySelect: this.rootKeySelect,
                octaveSelect: this.octaveSelect,
                keyboardSizeSelect: this.keyboardSizeSelect,
                saveBtn: this.saveBtn,
                loadBtn: this.loadBtn,
                communityToggleBtn: this.communityToggleBtn,
                closeCommunityBtn: this.closeCommunityBtn,
                communitySidebar: this.communitySidebar,
                feedFilterAll: this.feedFilterAll,
                feedFilterMine: this.feedFilterMine
            }
        });
    }

    // --------------------------------------------------------------------------
    // PATTERN BANK INITIALIZATION
    // --------------------------------------------------------------------------
    initPatternBank() {
        const patternBankContainer = document.getElementById('pattern-bank-container');
        if (!patternBankContainer) return;

        this.patternBank = createPatternBank({
            numSlots: 8,
            activeColor: 'cyan',
            label: 'PATTERNS',
            onSelect: (id) => this.switchPattern(id),
            onCopy: (fromId, toId) => this.copyPattern(fromId, toId),
            onClear: (id) => this.clearPattern(id)
        });

        patternBankContainer.appendChild(this.patternBank.element);

        // Update has-data indicators
        this.updatePatternIndicators();
    }

    // --------------------------------------------------------------------------
    // TRACK PANEL INITIALIZATION
    // --------------------------------------------------------------------------
    initTrackPanel() {
        const trackPanelContainer = document.getElementById('track-panel-container');
        if (!trackPanelContainer) return;

        this.trackPanel = createTrackPanel({
            title: this.trackName,
            description: this.trackDescription,
            thumbnailUrl: this.thumbnailUrl,
            compact: false,
            titlePlaceholder: 'TRACK TITLE',
            descriptionPlaceholder: 'Add a description...',
            onTitleChange: (title) => {
                this.trackName = title;
            },
            onDescriptionChange: (desc) => {
                this.trackDescription = desc;
            },
            onThumbnailClick: () => this.generateThumbnail()
        });

        trackPanelContainer.appendChild(this.trackPanel.element);

    }

    // --------------------------------------------------------------------------
    // PATTERN METHODS
    // --------------------------------------------------------------------------
    saveCurrentToPattern(id) {
        // Only save note data and synth parameters (not global track settings)
        this.patterns[id] = {
            tracks: this.pianoRoll.getTracksAsTracker(),
            trackParams: JSON.parse(JSON.stringify(this.engine.trackParams))
        };
        this.updatePatternIndicators();
    }

    loadPattern(id) {
        const pattern = this.patterns[id];
        if (!pattern) return;

        // Apply synth parameters
        if (pattern.trackParams) {
            for (const [idx, params] of Object.entries(pattern.trackParams)) {
                const tIdx = parseInt(idx);
                for (const [key, val] of Object.entries(params)) {
                    this.engine.updateParam(key, val, tIdx);
                }
            }
            this.refreshUIForTrack(this.pianoRoll.selectedTrackIdx);
        }

        // Apply note data
        if (pattern.tracks) {
            this.pianoRoll.setTracksFromTracker(pattern.tracks);
        }
    }

    switchPattern(id) {
        if (id === this.currentPatternId) return;

        // Save current pattern before switching
        this.saveCurrentToPattern(this.currentPatternId);

        // Load new pattern
        this.currentPatternId = id;
        this.loadPattern(id);

        showToast(`PATTERN ${id}`, 'info');
    }

    copyPattern(fromId, toId) {
        // Save current state first
        this.saveCurrentToPattern(this.currentPatternId);

        // Deep copy the pattern
        this.patterns[toId] = JSON.parse(JSON.stringify(this.patterns[fromId]));
        this.updatePatternIndicators();

        showToast(`COPIED ${fromId} → ${toId}`, 'success');
    }

    clearPattern(id) {
        this.patterns[id] = this.createEmptyPattern();
        this.updatePatternIndicators();

        // If clearing current pattern, also clear the UI
        if (id === this.currentPatternId) {
            this.pianoRoll.clearAll();
            this.pianoRoll.setSteps(16);
        }

        showToast(`CLEARED PATTERN ${id}`, 'info');
    }

    updatePatternIndicators() {
        if (!this.patternBank) return;

        const patternIds = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];
        patternIds.forEach(id => {
            const pattern = this.patterns[id];
            const hasData = pattern && pattern.tracks &&
                pattern.tracks.some(track => track && track.some(note => note !== null));
            this.patternBank.setPatternHasData(id, hasData);
        });
    }

    // --------------------------------------------------------------------------
    // THUMBNAIL GENERATION
    // --------------------------------------------------------------------------
    async generateThumbnail() {
        if (!this.trackPanel) return;

        const title = this.trackName || 'Untitled Track';
        const brief = this.trackDescription || '';
        const aiPromptText = this.aiPromptInput?.value?.trim() || '';

        // Build style from all available context
        const parts = [title, brief, aiPromptText].filter(Boolean);
        const style = parts.length > 0 ? parts.join(' - ') : 'Electronic synth music';

        // Get skill-specific artwork guidance
        const skill = this.trackSkill;
        const skillArtwork = skill && aiPrompts.skills?.[skill]?.artwork
            ? `Visual style: ${aiPrompts.skills[skill].artwork}`
            : 'Abstract electronic music aesthetics, bold neon colors, geometric or organic shapes';

        // Use template if available, otherwise fallback
        let prompt;
        if (aiPrompts.thumbnail?.template) {
            prompt = aiPrompts.thumbnail.template
                .replace('{{SKILL_ARTWORK}}', skillArtwork)
                .replace('{{STYLE}}', style);
        } else {
            const styleHints = aiPrompts.thumbnail?.styleHints || [];
            const randomStyle = styleHints[Math.floor(Math.random() * styleHints.length)] || '';
            prompt = `${aiPrompts.thumbnail?.basePrompt || 'Create album art'}. ${skillArtwork}. ${style}. ${randomStyle}. ABSOLUTELY NO TEXT OR WORDS.`;
        }

        this.trackPanel.setThumbnailLoading(true);

        try {
            const result = await websim.imageGen({
                prompt,
                aspect_ratio: '1:1'
            });

            this.thumbnailUrl = result.url;
            this.trackPanel.setThumbnail(result.url);
            showToast('THUMBNAIL GENERATED', 'success');
        } catch (err) {
            console.error('Thumbnail generation failed:', err);
            this.trackPanel.setThumbnailLoading(false);
            showToast('THUMBNAIL GENERATION FAILED', 'error');
        }
    }

    // --------------------------------------------------------------------------
    // SUGGESTION GENERATION
    // --------------------------------------------------------------------------
    generateSuggestion(targetMode = 'PATTERN') {
        // Generate suggested next step after a short delay
        setTimeout(async () => {
            try {
                const currentState = this.getCurrentState(targetMode);
                const suggestPrompt = aiPrompts.improve.replace('{{STATE}}', JSON.stringify(currentState));
                const suggestion = await websim.chat.completions.create({
                    messages: [{ role: 'user', content: suggestPrompt }]
                });
                const prompt = suggestion.content.trim().replace(/['"]/g, '');
                this.aiPromptInput.value = prompt;
                this.updateAiButtonText();
            } catch (e) {
                // Silently ignore suggestion errors
            }
        }, 2000);
    }

    // --------------------------------------------------------------------------
    // KNOB INITIALIZATION
    // --------------------------------------------------------------------------
    initKnobs() {
        // Master volume knob
        const masterVolumeContainer = document.getElementById('master-volume-knob');
        const masterKnob = createKnob({
            label: 'VOL',
            value: 50,
            min: 0,
            max: 100,
            step: 1,
            color: 'yellow',
            size: 'small',
            onChange: (val) => this.engine.updateParam('masterVolume', val / 100)
        });
        masterVolumeContainer.appendChild(masterKnob.element);
        this.knobs.masterVolume = masterKnob;

        // Oscillator - Detune
        const detuneKnob = createKnob({
            label: 'DETUNE',
            value: 0,
            min: -100,
            max: 100,
            step: 1,
            color: 'magenta',
            size: 'small',
            onChange: (val) => this.updateParamWithRetrigger('detune', val, this.getSelectedTrack()),
            formatValue: (v) => (v > 0 ? '+' : '') + Math.round(v)
        });
        document.getElementById('detune-knob').appendChild(detuneKnob.element);
        this.knobs.detune = detuneKnob;

        // Filter - Cutoff
        const cutoffKnob = createKnob({
            label: 'CUTOFF',
            value: 2000,
            min: 20,
            max: 15000,
            step: 1,
            color: 'cyan',
            size: 'small',
            onChange: (val) => this.updateParamWithRetrigger('filterCutoff', val, this.getSelectedTrack()),
            formatValue: (v) => Math.round(v)
        });
        document.getElementById('cutoff-knob').appendChild(cutoffKnob.element);
        this.knobs.filterCutoff = cutoffKnob;

        // Filter - Resonance
        const resoKnob = createKnob({
            label: 'RESONANCE',
            value: 1,
            min: 0,
            max: 20,
            step: 0.1,
            color: 'cyan',
            size: 'small',
            onChange: (val) => this.updateParamWithRetrigger('filterReso', val, this.getSelectedTrack())
        });
        document.getElementById('reso-knob').appendChild(resoKnob.element);
        this.knobs.filterReso = resoKnob;

        // Envelope - Attack
        const attackKnob = createKnob({
            label: 'ATTACK',
            value: 0.1,
            min: 0.01,
            max: 2,
            step: 0.01,
            color: 'green',
            size: 'small',
            onChange: (val) => this.updateParamWithRetrigger('attack', val, this.getSelectedTrack())
        });
        document.getElementById('attack-knob').appendChild(attackKnob.element);
        this.knobs.attack = attackKnob;

        // Envelope - Decay
        const decayKnob = createKnob({
            label: 'DECAY',
            value: 0.2,
            min: 0.01,
            max: 2,
            step: 0.01,
            color: 'green',
            size: 'small',
            onChange: (val) => this.updateParamWithRetrigger('decay', val, this.getSelectedTrack())
        });
        document.getElementById('decay-knob').appendChild(decayKnob.element);
        this.knobs.decay = decayKnob;

        // Envelope - Sustain
        const sustainKnob = createKnob({
            label: 'SUSTAIN',
            value: 0.5,
            min: 0,
            max: 1,
            step: 0.01,
            color: 'green',
            size: 'small',
            onChange: (val) => this.updateParamWithRetrigger('sustain', val, this.getSelectedTrack())
        });
        document.getElementById('sustain-knob').appendChild(sustainKnob.element);
        this.knobs.sustain = sustainKnob;

        // Envelope - Release
        const releaseKnob = createKnob({
            label: 'RELEASE',
            value: 0.5,
            min: 0.01,
            max: 4,
            step: 0.01,
            color: 'green',
            size: 'small',
            onChange: (val) => this.updateParamWithRetrigger('release', val, this.getSelectedTrack())
        });
        document.getElementById('release-knob').appendChild(releaseKnob.element);
        this.knobs.release = releaseKnob;

        // Effects - Delay Mix
        const delayKnob = createKnob({
            label: 'DLY MIX',
            value: 0.2,
            min: 0,
            max: 0.8,
            step: 0.01,
            color: 'purple',
            size: 'small',
            onChange: (val) => this.engine.updateParam('delayMix', val, this.getSelectedTrack())
        });
        document.getElementById('delay-knob').appendChild(delayKnob.element);
        this.knobs.delayMix = delayKnob;

        // Effects - Delay Time
        const delayTimeKnob = createKnob({
            label: 'DLY TIME',
            value: 0.3,
            min: 0.05,
            max: 1,
            step: 0.01,
            color: 'purple',
            size: 'small',
            onChange: (val) => this.engine.updateParam('delayTime', val, this.getSelectedTrack())
        });
        document.getElementById('delay-time-knob').appendChild(delayTimeKnob.element);
        this.knobs.delayTime = delayTimeKnob;

        // Effects - Reverb Mix
        const reverbKnob = createKnob({
            label: 'REV MIX',
            value: 0.3,
            min: 0,
            max: 1,
            step: 0.01,
            color: 'purple',
            size: 'small',
            onChange: (val) => this.engine.updateParam('reverbMix', val, this.getSelectedTrack())
        });
        document.getElementById('reverb-knob').appendChild(reverbKnob.element);
        this.knobs.reverbMix = reverbKnob;
    }

    // --------------------------------------------------------------------------
    // KEYBOARD INITIALIZATION
    // --------------------------------------------------------------------------
    initKeyboard() {
        const keyboardEl = document.getElementById('keyboard');

        this.keyboard = createKeyboard({
            numKeys: 12,
            rootNote: 0,
            octave: 3,
            showLabels: true,
            onNoteOn: (keyIndex, freq) => {
                this.engine.resume();
                this.engine.noteOn(keyIndex, freq, this.getSelectedTrack());
                // Highlight piano roll note label for alignment check
                this.pianoRoll?.highlightNoteLabel(keyIndex, true);
            },
            onNoteOff: (keyIndex) => {
                this.engine.noteOff(keyIndex, this.getSelectedTrack());
                this.pianoRoll?.highlightNoteLabel(keyIndex, false);
            }
        });
        keyboardEl.appendChild(this.keyboard.element);

        // Helper method for sequencer compatibility
        this.keyboard.getFreq = (keyIndex) => this.keyboard.getFrequency(keyIndex);
    }

    setKeyboardSize(numKeys) {
        // Destroy old keyboard
        if (this.keyboard && this.keyboard.destroy) {
            this.keyboard.destroy();
        }

        // Clear container
        const keyboardEl = document.getElementById('keyboard');
        keyboardEl.innerHTML = '';

        // Determine root note and octave based on key count
        // For larger keyboards, start at A0 (standard piano)
        // For smaller keyboards, use the selected root/octave
        let newRootNote, newOctave;
        if (numKeys > 24) {
            newRootNote = 9; // A (piano starts at A0)
            newOctave = 0;
        } else {
            newRootNote = parseInt(this.rootKeySelect?.value || 0);
            newOctave = parseInt(this.octaveSelect?.value || 3);
        }

        this.keyboard = createKeyboard({
            numKeys: numKeys,
            rootNote: newRootNote,
            octave: newOctave,
            showLabels: true,
            onNoteOn: (keyIndex, freq) => {
                this.engine.resume();
                this.engine.noteOn(keyIndex, freq, this.getSelectedTrack());
                // Highlight piano roll note label for alignment check
                this.pianoRoll?.highlightNoteLabel(keyIndex, true);
            },
            onNoteOff: (keyIndex) => {
                this.engine.noteOff(keyIndex, this.getSelectedTrack());
                this.pianoRoll?.highlightNoteLabel(keyIndex, false);
            }
        });
        keyboardEl.appendChild(this.keyboard.element);
        this.keyboard.getFreq = (keyIndex) => this.keyboard.getFrequency(keyIndex);

        // Sync piano roll with new keyboard size
        if (this.pianoRoll) {
            this.pianoRoll.setNumKeys(numKeys);
            this.pianoRoll.setRange(newRootNote, newOctave);
        }

        // Disable root/octave selectors for larger keyboards (they start at A0)
        if (this.rootKeySelect) {
            this.rootKeySelect.disabled = numKeys > 24;
        }
        if (this.octaveSelect) {
            this.octaveSelect.disabled = numKeys > 24;
        }

        // Re-initialize scroll sync with new keyboard
        this.initScrollSync();
    }

    updateKeyboardRange() {
        const numKeys = parseInt(this.keyboardSizeSelect?.value || 12);
        // Only allow manual range changes for smaller keyboards
        if (numKeys <= 24) {
            const rootNote = parseInt(this.rootKeySelect.value);
            const octave = parseInt(this.octaveSelect.value);
            this.keyboard.setRange(rootNote, octave);
            if (this.pianoRoll) {
                this.pianoRoll.setRange(rootNote, octave);
            }
        }
    }

    // --------------------------------------------------------------------------
    // PIANO ROLL INITIALIZATION
    // --------------------------------------------------------------------------
    initPianoRoll() {
        const pianoRollContainer = document.getElementById('piano-roll-container');

        this.pianoRoll = createPianoRoll({
            label: 'PIANO ROLL',
            steps: 16, // Start with 1 bar (16 steps = 4 beats at 16th note resolution)
            numKeys: 12,
            rootNote: parseInt(this.rootKeySelect?.value || 0),
            octave: parseInt(this.octaveSelect?.value || 3),
            maxTracks: 4,
            bpm: 120,
            vertical: true,
            loop: true,
            showTrackTabs: false, // Disabled - use pattern bank instead
            showStepNumbers: false, // Off by default for cleaner alignment
            fallingMode: true, // Animated falling notes
            onTrackSelect: (trackIdx) => {
                this.refreshUIForTrack(trackIdx);
            },
            onPlay: (stepIndex, notes) => {
                this.setStep(stepIndex + 1);
                const bpm = this.pianoRoll.bpm || 120;
                const stepDurationSeconds = 60 / bpm / 4; // 16th notes
                notes.forEach(({ trackIdx, noteIdx, freq, duration = 1 }) => {
                    const frequency = freq || this.keyboard.getFrequency(noteIdx);
                    // Calculate note duration in seconds from step duration
                    const noteDuration = stepDurationSeconds * duration;
                    this.engine.triggerNote(trackIdx, noteIdx, frequency, noteDuration);
                });
            },
            onPlayStateChange: (isPlaying) => {
                this.startBtn.classList.toggle('playing', isPlaying);
                this.setStatus(isPlaying ? 'PLAYING' : 'STOPPED');
                if (isPlaying) {
                    this.engine.resume();
                }
            },
            onKeyHighlight: (keyIndex, active) => {
                // Light up keyboard key when note plays
                if (this.keyboard && this.keyboard.setKeyVisualState) {
                    this.keyboard.setKeyVisualState(keyIndex, active);
                }
            },
            getFrequency: (noteIndex) => this.keyboard.getFrequency(noteIndex)
        });

        pianoRollContainer.appendChild(this.pianoRoll.element);

        // Set up scroll sync after piano roll is created
        this.initScrollSync();
    }

    // --------------------------------------------------------------------------
    // SCROLL SYNC (Keyboard <-> Piano Roll)
    // --------------------------------------------------------------------------
    initScrollSync() {
        // Flag to prevent infinite scroll loops
        let syncing = false;

        // Get scroll containers
        const keyboardScroll = this.keyboard?.scrollContainer;
        const pianoRollLabels = this.pianoRoll?.getNoteLabelsElement();
        const pianoRollScroll = this.pianoRoll?.scrollArea;

        if (!keyboardScroll) return;

        // Sync keyboard -> piano roll
        keyboardScroll.addEventListener('scroll', () => {
            if (syncing) return;
            syncing = true;
            const scrollLeft = keyboardScroll.scrollLeft;
            if (pianoRollLabels) pianoRollLabels.scrollLeft = scrollLeft;
            if (pianoRollScroll) pianoRollScroll.scrollLeft = scrollLeft;
            requestAnimationFrame(() => { syncing = false; });
        });

        // Sync piano roll labels -> keyboard
        if (pianoRollLabels) {
            pianoRollLabels.addEventListener('scroll', () => {
                if (syncing) return;
                syncing = true;
                const scrollLeft = pianoRollLabels.scrollLeft;
                keyboardScroll.scrollLeft = scrollLeft;
                if (pianoRollScroll) pianoRollScroll.scrollLeft = scrollLeft;
                requestAnimationFrame(() => { syncing = false; });
            });
        }

        // Sync piano roll grid -> keyboard
        if (pianoRollScroll) {
            pianoRollScroll.addEventListener('scroll', () => {
                if (syncing) return;
                syncing = true;
                const scrollLeft = pianoRollScroll.scrollLeft;
                keyboardScroll.scrollLeft = scrollLeft;
                if (pianoRollLabels) pianoRollLabels.scrollLeft = scrollLeft;
                requestAnimationFrame(() => { syncing = false; });
            });
        }
    }

    // --------------------------------------------------------------------------
    // EVENT LISTENERS
    // --------------------------------------------------------------------------
    initEventListeners() {
        // Transport
        this.startBtn.addEventListener('click', () => this.togglePlayback());

        // BPM
        this.bpmInput.addEventListener('input', (e) => {
            const val = parseFloat(e.target.value);
            if (!isNaN(val)) {
                this.engine.updateParam('bpm', val);
                if (this.pianoRoll) this.pianoRoll.setBPM(val);
            }
        });

        // Save/Load - handled by cloud module in initCloud()

        // Reset
        this.resetBtn.addEventListener('click', () => this.reset());

        // MIDI
        this.midiImportBtn.addEventListener('click', () => this.midiInput.click());
        this.midiExportBtn.addEventListener('click', () => this.saveMidi());
        this.midiInput.addEventListener('change', (e) => this.loadMidi(e));

        // Wave buttons
        document.querySelectorAll('.wave-btn').forEach(btn => {
            btn.addEventListener('click', () => this.setWaveType(btn.dataset.wave));
        });

        // Keyboard controls
        this.keyboardSizeSelect.addEventListener('change', (e) => {
            this.setKeyboardSize(parseInt(e.target.value));
        });
        this.rootKeySelect.addEventListener('change', () => this.updateKeyboardRange());
        this.octaveSelect.addEventListener('change', () => this.updateKeyboardRange());

        // AI Copilot
        this.aiGenBtn.addEventListener('click', () => this.handleAIRequest());
        this.aiPromptInput.addEventListener('input', () => this.updateAiButtonText());
        this.aiPromptInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                this.handleAIRequest();
            }
        });
        this.aiWalkthroughBtn.addEventListener('click', () => {
            this.walkthroughEnabled = !this.walkthroughEnabled;
            this.aiWalkthroughBtn.classList.toggle('active', this.walkthroughEnabled);
            showToast(`Walkthrough ${this.walkthroughEnabled ? 'enabled' : 'disabled'}`, 'info');
        });

        // AI Target mode toggle
        this.aiTargetBtn.addEventListener('click', () => {
            this.aiTargetModeIdx = (this.aiTargetModeIdx + 1) % this.aiTargetModes.length;
            const mode = this.aiTargetModes[this.aiTargetModeIdx];
            this.aiTargetBtn.textContent = mode;
            const modeDesc = mode === 'TRACK' ? 'entire track (all synths)' : 'current pattern only';
            showToast(`Target: ${modeDesc}`, 'info');
        });

        // Visualizer click - play C note for tuning
        this.visualizerCanvas.style.cursor = 'pointer';
        this.visualizerCanvas.addEventListener('click', () => this.playVisualizerNote());
        this.visualizerCanvas.addEventListener('dblclick', () => this.toggleVisualizerNote());
        this.visualizerNoteHeld = false;
        this.visualizerNoteKeyIndex = null;
    }

    // Get C key index based on keyboard state
    getCKeyIndex() {
        if (this.keyboardExpanded) {
            // Full 88-key piano: middle C (C4) is at index 39 (piano starts at A0)
            return 39;
        } else {
            // Normal view: find C in current range
            const rootNote = parseInt(this.rootKeySelect?.value || 0);
            return (12 - rootNote) % 12;
        }
    }

    // Play C note when visualizer is clicked (for tuning/testing)
    playVisualizerNote() {
        // Don't do quick play if note is held
        if (this.visualizerNoteHeld) return;

        this.engine.resume();
        const cKeyIndex = this.getCKeyIndex();
        const freq = this.keyboard.getFrequency(cKeyIndex);
        const track = this.getSelectedTrack();

        // Visual feedback
        this.keyboard.setKeyVisualState(cKeyIndex, true);

        // Play the note
        this.engine.noteOn(cKeyIndex, freq, track);

        // Release after 200ms
        setTimeout(() => {
            if (!this.visualizerNoteHeld) {
                this.engine.noteOff(cKeyIndex, track);
                this.keyboard.setKeyVisualState(cKeyIndex, false);
            }
        }, 200);
    }

    // Toggle held C note on double-click
    toggleVisualizerNote() {
        this.engine.resume();
        const cKeyIndex = this.getCKeyIndex();
        const freq = this.keyboard.getFrequency(cKeyIndex);
        const track = this.getSelectedTrack();

        if (this.visualizerNoteHeld) {
            // Release the held note
            this.visualizerNoteHeld = false;
            this.engine.noteOff(this.visualizerNoteKeyIndex, track);
            this.keyboard.setKeyVisualState(this.visualizerNoteKeyIndex, false);
            this.visualizerNoteKeyIndex = null;
            this.visualizerCanvas.classList.remove('note-held');
        } else {
            // Hold the note
            this.visualizerNoteHeld = true;
            this.visualizerNoteKeyIndex = cKeyIndex;
            this.keyboard.setKeyVisualState(cKeyIndex, true);
            this.engine.noteOn(cKeyIndex, freq, track);
            this.visualizerCanvas.classList.add('note-held');
        }
    }

    // --------------------------------------------------------------------------
    // HELPERS
    // --------------------------------------------------------------------------
    getSelectedTrack() {
        return this.pianoRoll?.selectedTrackIdx || 0;
    }

    setStatus(message) {
        this.statusText.textContent = message;
    }

    setStep(step) {
        this.stepDisplay.textContent = `STEP: ${step}`;
    }

    // --------------------------------------------------------------------------
    // PLAYBACK
    // --------------------------------------------------------------------------
    togglePlayback() {
        this.pianoRoll.toggle();
        // Play state change is handled by onPlayStateChange callback
    }

    // --------------------------------------------------------------------------
    // WAVE TYPE
    // --------------------------------------------------------------------------
    setWaveType(type) {
        document.querySelectorAll('.wave-btn').forEach(b => {
            b.classList.toggle('active', b.dataset.wave === type);
        });
        this.engine.updateParam('waveType', type, this.getSelectedTrack());
        this.engine.resume();
        this.retriggerStuckNotes();
    }

    // --------------------------------------------------------------------------
    // RETRIGGER STUCK NOTES (for live parameter tweaking)
    // --------------------------------------------------------------------------
    retriggerStuckNotes() {
        if (!this.keyboard) return;
        const track = this.getSelectedTrack();

        // Retrigger keyboard stuck keys
        const stuckKeys = this.keyboard.getStuckKeys();
        stuckKeys.forEach(keyIndex => {
            const freq = this.keyboard.getFrequency(keyIndex);
            // Release and immediately re-trigger to apply new settings
            this.engine.noteOff(keyIndex, track);
            this.engine.noteOn(keyIndex, freq, track);
        });

        // Retrigger visualizer held note
        if (this.visualizerNoteHeld && this.visualizerNoteKeyIndex !== null) {
            const freq = this.keyboard.getFrequency(this.visualizerNoteKeyIndex);
            this.engine.noteOff(this.visualizerNoteKeyIndex, track);
            this.engine.noteOn(this.visualizerNoteKeyIndex, freq, track);
        }
    }

    // Wrapper for updating params that also retriggers stuck notes
    updateParamWithRetrigger(param, value, track) {
        this.engine.updateParam(param, value, track);
        this.retriggerStuckNotes();
    }

    // --------------------------------------------------------------------------
    // UI REFRESH FOR TRACK
    // --------------------------------------------------------------------------
    refreshUIForTrack(trackIdx) {
        const params = this.engine.getParams(trackIdx);

        // Update wave buttons
        document.querySelectorAll('.wave-btn').forEach(b => {
            b.classList.toggle('active', b.dataset.wave === params.waveType);
        });

        // Update knobs
        for (const [key, val] of Object.entries(params)) {
            if (this.knobs[key]) {
                this.knobs[key].setValue(val);
            }
        }
    }

    // --------------------------------------------------------------------------
    // RESET
    // --------------------------------------------------------------------------
    reset() {
        // Stop sequencer
        if (this.pianoRoll && this.pianoRoll.isPlaying) {
            this.pianoRoll.toggle();
        }

        // Default parameters
        const defaults = {
            masterVolume: 50,
            detune: 0,
            filterCutoff: 2000,
            filterReso: 1,
            attack: 0.1,
            decay: 0.2,
            sustain: 0.5,
            release: 0.5,
            delayMix: 0.2,
            delayTime: 0.3,
            reverbMix: 0.3,
            waveType: 'sawtooth',
            bpm: 120,
            steps: 16,
            rootKey: 0,
            rootOctave: 3
        };

        // Apply engine and knob defaults
        for (const [key, val] of Object.entries(defaults)) {
            if (this.knobs[key]) {
                this.knobs[key].setValue(val);
                this.engine.updateParam(key, val);
            } else if (key === 'waveType') {
                this.setWaveType(val);
            } else if (key === 'bpm') {
                this.bpmInput.value = val;
                this.engine.updateParam(key, val);
                if (this.pianoRoll) this.pianoRoll.setBPM(val);
            }
        }

        // Reset Piano Roll
        if (this.pianoRoll) {
            this.pianoRoll.setSteps(defaults.steps);
            this.pianoRoll.clearAll();
        }

        // Title is reset via trackPanel below

        // Reset Keyboard
        this.keyboardSizeSelect.value = 12;
        this.rootKeySelect.value = defaults.rootKey;
        this.rootKeySelect.disabled = false;
        this.octaveSelect.value = defaults.rootOctave;
        this.octaveSelect.disabled = false;
        this.setKeyboardSize(12);

        // Reset patterns
        this.initializeEmptyPatterns();
        this.currentPatternId = 'A';
        if (this.patternBank) {
            this.patternBank.setActivePattern('A');
            this.updatePatternIndicators();
        }

        // Reset track panel
        this.trackName = '';
        this.trackDescription = '';
        this.thumbnailUrl = null;
        this.trackSkill = null;
        if (this.trackPanel) {
            this.trackPanel.setTitle('');
            this.trackPanel.setDescription('');
            this.trackPanel.setThumbnail(null);
        }

        // Reset play state
        this.startBtn.classList.remove('playing');
        this.setStatus('SYNTH RESET');

        showToast('SYNTH RESET', 'info');
    }

    // --------------------------------------------------------------------------
    // AI COPILOT
    // --------------------------------------------------------------------------
    updateAiButtonText() {
        const hasPrompt = this.aiPromptInput.value.trim().length > 0;

        if (hasPrompt) {
            this.aiGenBtn.innerText = "AI GEN";
            this.aiGenBtn.classList.remove('demo-attract');
        } else {
            this.aiGenBtn.innerText = "DEMO";
            this.aiGenBtn.classList.add('demo-attract');
        }
    }

    async runDemoMode() {
        showToast('Running demo...', 'info');

        // Generate a simple demo pattern
        const demoState = {
            trackName: 'Neon Demo',
            trackNames: ['LEAD', 'BASS', 'PAD', 'ARP'],
            trackParams: {
                0: { waveType: 'sawtooth', filterCutoff: 2500, attack: 0.1, decay: 0.2, sustain: 0.6, release: 0.4 },
                1: { waveType: 'square', filterCutoff: 800, attack: 0.01, decay: 0.1, sustain: 0.8, release: 0.2 }
            },
            globalParams: { bpm: 128, masterVolume: 70 },
            steps: 32,
            rootKey: 0,
            rootOctave: 3,
            tracks: [
                [0, null, null, null, 4, null, null, null, 7, null, null, null, 4, null, null, null,
                 0, null, null, null, 4, null, null, null, 7, null, null, null, 4, null, null, null],
                [0, null, null, null, null, null, null, null, 0, null, null, null, null, null, null, null,
                 0, null, null, null, null, null, null, null, 0, null, null, null, null, null, null, null]
            ]
        };

        await this.applyState(demoState);
        showToast('Demo loaded!', 'success');
    }

    async handleAIRequest() {
        const prompt = this.aiPromptInput.value.trim();
        const isDemo = !prompt;

        this.aiCopilot.classList.add('ai-loading');
        this.aiGenBtn.disabled = true;
        this.setStatus('AI COMPOSING...');

        try {
            if (isDemo) {
                await this.runDemoMode();
            } else {
                const targetMode = this.aiTargetModes[this.aiTargetModeIdx];

                // In TRACK mode, set up full 88-note range and track-length bars before AI request
                if (targetMode === 'TRACK') {
                    // Set to full range
                    if (this.pianoRoll.numKeys !== 88) {
                        this.keyboardSizeSelect.value = '88';
                        this.setKeyboardSize(88);
                        showToast('Expanded to full 88-note range', 'info');
                    }

                    // Set track-length steps with variance (64 or 128, max 8 bars)
                    const trackLengths = [64, 64, 128, 128]; // 4-8 bars
                    const targetSteps = trackLengths[Math.floor(Math.random() * trackLengths.length)];
                    if (this.pianoRoll.steps < targetSteps) {
                        this.pianoRoll.setSteps(targetSteps);
                        const bars = targetSteps / 16;
                        showToast(`Expanded to ${bars} bars for full arrangement`, 'info');
                    }
                }

                const currentState = this.getCurrentState(targetMode);

                // Check for existing content
                const hasExistingContent = currentState.tracks.some(
                    t => t && t.some(note => note !== null)
                );
                const hasCreativeBrief = this.trackDescription && this.trackDescription.trim().length > 0;

                // Generate creative brief and detect skill if starting fresh
                if (!hasCreativeBrief && !hasExistingContent) {
                    this.setStatus('CRAFTING VISION...');

                    try {
                        // Detect skill/genre and generate creative brief in parallel
                        const [skillResponse, briefResponse] = await Promise.all([
                            websim.chat.completions.create({
                                messages: [{ role: "user", content: aiPrompts.detectSkill.replace('{{PROMPT}}', prompt) }]
                            }),
                            websim.chat.completions.create({
                                messages: [{ role: "user", content: aiPrompts.creativeBrief.replace('{{PROMPT}}', prompt) }]
                            })
                        ]);

                        // Set the detected skill
                        const detectedSkill = skillResponse.content.trim().toLowerCase().replace(/['"]/g, '');
                        if (aiPrompts.skills && aiPrompts.skills[detectedSkill]) {
                            this.trackSkill = detectedSkill;
                            showToast(`SKILL: ${aiPrompts.skills[detectedSkill].name}`, 'info');
                        }

                        // Set the creative brief
                        const creativeBrief = briefResponse.content.trim().replace(/^["']|["']$/g, '');
                        this.trackDescription = creativeBrief;
                        if (this.trackPanel) {
                            this.trackPanel.setDescription(creativeBrief);
                            // Show the description panel briefly
                            this.trackPanel.showDescription(true);
                        }

                        showToast('CREATIVE BRIEF SET', 'info');
                    } catch (e) {
                        console.warn('Could not generate creative brief:', e);
                        // Try keyword matching for skill detection
                        if (!this.trackSkill) {
                            const promptLower = prompt.toLowerCase();
                            for (const [skillId, skill] of Object.entries(aiPrompts.skills || {})) {
                                if (skill.keywords && skill.keywords.some(kw => promptLower.includes(kw))) {
                                    this.trackSkill = skillId;
                                    break;
                                }
                            }
                        }
                    }
                }

                // Try keyword matching for skill if not yet detected
                if (!this.trackSkill && prompt) {
                    const promptLower = prompt.toLowerCase();
                    for (const [skillId, skill] of Object.entries(aiPrompts.skills || {})) {
                        if (skill.keywords && skill.keywords.some(kw => promptLower.includes(kw))) {
                            this.trackSkill = skillId;
                            break;
                        }
                    }
                }

                this.setStatus('AI COMPOSING...');

                // Build target mode instruction
                const targetModeInstruction = targetMode === 'PATTERN'
                    ? `TARGET MODE: PATTERN - Create a single loop using the CURRENT settings.
                       - Keep steps at ${currentState.steps} (do not change)
                       - Keep numKeys at ${currentState.numKeys} (do not change)
                       - Create all 4 patterns to work together as a cohesive loop
                       - Focus on a tight, instantly usable groove`
                    : `TARGET MODE: TRACK - Create a FULL composition using ALL available space.
                       - The canvas has ${currentState.steps} steps (${currentState.steps / 16} bars) and ${currentState.numKeys} keys - USE ALL OF IT
                       - You MUST fill ALL ${currentState.steps} steps with musical content (no empty sections)
                       - You MUST use ALL 4 patterns: Pattern 0=Bass, Pattern 1=Lead, Pattern 2=Pads, Pattern 3=Arps
                       - Each pattern array MUST have exactly ${currentState.steps} entries
                       - Create variation and progression across all ${currentState.steps / 16} bars
                       - Use the full note range: bass (indices 15-30), leads (39-55), pads (30-50), arps (50-70)
                       - CRITICAL: Do not leave patterns empty or short - fill the entire ${currentState.steps} steps for ALL 4 patterns`;

                // Add skill-specific augmentation
                let skillAugment = '';
                if (this.trackSkill && aiPrompts.skills?.[this.trackSkill]?.augment) {
                    skillAugment = `\n\nGENRE GUIDANCE:\n${aiPrompts.skills[this.trackSkill].augment}`;
                }

                // Include creative brief context
                const briefContext = this.trackDescription ? `\nCREATIVE VISION: ${this.trackDescription}` : '';

                // Build keyboard range description based on current settings
                const numKeys = currentState.numKeys || 12;
                const rootKey = currentState.rootKey ?? 0;
                const rootOctave = currentState.rootOctave ?? 3;
                const noteNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

                let keyboardDescription;
                if (numKeys <= 24) {
                    // Small keyboard - relative to root
                    const rootNoteName = noteNames[rootKey];
                    const lowNote = `${rootNoteName}${rootOctave}`;
                    const highOctave = rootOctave + Math.floor((numKeys - 1) / 12);
                    const highNoteIdx = (rootKey + numKeys - 1) % 12;
                    const highNote = `${noteNames[highNoteIdx]}${highOctave}`;
                    keyboardDescription = `
CURRENT KEYBOARD: ${numKeys} keys, root ${rootNoteName} at octave ${rootOctave}
- Index 0 = ${lowNote} (lowest note)
- Index ${numKeys - 1} = ${highNote} (highest note)
- Index ${Math.floor(numKeys / 2)} = middle of keyboard (good for melodies)

NOTE RANGE GUIDE for ${numKeys}-key keyboard:
- Bass notes: indices 0-${Math.min(3, numKeys - 1)} (${lowNote} to ${noteNames[(rootKey + Math.min(3, numKeys - 1)) % 12]}${rootOctave})
- Mid notes: indices ${Math.floor(numKeys / 3)}-${Math.floor(numKeys * 2 / 3)} (good for melodies/leads)
- High notes: indices ${Math.floor(numKeys * 2 / 3)}-${numKeys - 1} (arpeggios, sparkle)

IMPORTANT: All note indices MUST be between 0 and ${numKeys - 1}. Using indices outside this range will cause errors!`;
                } else {
                    // Large keyboard - absolute positioning
                    keyboardDescription = `
CURRENT KEYBOARD: ${numKeys} keys (standard piano layout starting at A0)
- Index 0 = A0, Index 3 = C1, Index 15 = C2, Index 27 = C3, Index 39 = C4 (middle C)
- For a typical synth track, use indices around 27-51 (C3-C5 range)

NOTE RANGE GUIDE for ${numKeys}-key keyboard:
- Deep bass: indices 15-27 (C2-C3)
- Bass: indices 27-39 (C3-C4)
- Mid/Melody: indices 39-51 (C4-C5, middle C and above)
- High: indices 51-63 (C5-C6)

IMPORTANT: All note indices MUST be between 0 and ${numKeys - 1}. Using indices outside this range will cause errors!`;
                }

                const systemPrompt = `You are a synth sound designer and music producer with deep knowledge of music theory and composition.${skillAugment}

Adjust the synth parameters and/or the tracker tracks based on the user's request.
If no trackName in STATE, generate one: creative 2-4 word title capturing the vibe (e.g. 'Cyber Drift', 'Neon Cascade', 'Digital Sunset').

${targetModeInstruction}
${keyboardDescription}

=== MUSICAL KEY & THEORY ===

KEY SELECTION:
Choose a musical key that matches the emotional tone of the request:
- C major / A minor: Neutral, versatile, bright/melancholic
- G major / E minor: Warm, folk-like, nostalgic
- D major / B minor: Bright, energetic, triumphant/dark
- F major / D minor: Pastoral, introspective, dramatic
- Bb major / G minor: Jazz-influenced, sophisticated, moody
- Eb major / C minor: Rich, cinematic, powerful/dark

Set "rootKey" in your output (0=C, 1=C#, 2=D... 11=B) to establish the key.
ALL NOTES should primarily use scale degrees of your chosen key.

STAYING IN KEY:
For major keys, emphasize these scale degrees (relative to root):
- Root (0), 2nd (+2), 3rd (+4), 4th (+5), 5th (+7), 6th (+9), 7th (+11)

For minor keys (natural minor):
- Root (0), 2nd (+2), b3rd (+3), 4th (+5), 5th (+7), b6th (+8), b7th (+10)

CHORD TONES: When multiple patterns play together, ensure they form coherent harmonies:
- Bass should play root notes or 5ths
- Pads should play chord tones (root, 3rd, 5th, maybe 7th)
- Leads can add color with passing tones but resolve to chord tones
- Arps should outline the chord

=== MUSICAL STRUCTURE & TECHNIQUES ===

CALL AND RESPONSE:
Create musical dialogue between patterns:
- Lead plays a phrase (bars 1-2), then rests while pads answer (bars 3-4)
- Bass plays a motif, arp echoes/mirrors it
- Alternate which pattern is "speaking" vs "supporting"
- Leave space! Not every pattern needs to play every beat

MELODIC TECHNIQUES:
- Motifs: Create a 2-4 note phrase and repeat/vary it
- Sequences: Repeat a pattern at different pitch levels
- Tension & Resolution: Build tension with higher notes/faster rhythm, resolve to root
- Contrary motion: When bass goes down, lead goes up (or vice versa)

RHYTHMIC INTEREST:
- Syncopation: Place notes on off-beats (steps 1, 3, 5, 7... instead of 0, 2, 4, 6...)
- Anticipation: Start a phrase slightly before the downbeat
- Rhythmic displacement: Shift a pattern by 1-2 steps in different sections
- Variation: Don't copy-paste - change 1-2 notes when repeating a phrase

ARRANGEMENT DYNAMICS:
- Intro: Start sparse (maybe just bass or pad)
- Build: Add layers gradually
- Climax: All patterns active, higher energy
- Breakdown: Strip back to 1-2 patterns
- Don't have all 4 patterns playing constantly - use silence strategically

HARMONIC RHYTHM:
- Change chords every 4-8 steps typically
- Bass notes should align with chord changes
- Pads sustain through chord changes with appropriate notes
- Common progressions: I-V-vi-IV, i-VI-III-VII, i-iv-V-i

=== SYNTH PARAMETERS ===

SYNTH PARAMETERS (per track, in trackParams object with keys 0-3):

OSCILLATOR:
- waveType: "sawtooth" (bright, buzzy), "square" (hollow, retro), "sine" (pure, soft), "triangle" (mellow)
- detune: -100 to 100 cents (thick/detuned sounds)

FILTER:
- filterCutoff: 20-15000 Hz (lower = darker)
- filterReso: 0-20 (resonance)

ENVELOPE:
- attack: 0.01-4.0s, decay: 0.01-4.0s, sustain: 0-1, release: 0.01-4.0s

EFFECTS:
- delayTime: 0.05-1.0s, delayMix: 0-1, reverbMix: 0-1, saturationDrive: 0-100

GLOBAL: bpm (40-200)

SEQUENCER:
- steps: 16, 32, or 64
- tracks: Array of 4 patterns (one per synth voice), each with 'steps' length
- Each step value:
  - null = rest (no note)
  - number = note index with duration 1 step
  - [noteIndex, duration] = note that sustains for multiple steps

DURATION FORMAT (CRITICAL):
When a note has duration > 1, you put [noteIndex, duration] at the START step only.
The following steps covered by that note's duration MUST be null (the note is still playing).

EXAMPLE - A 4-step bass note starting at step 0:
CORRECT: [[5, 4], null, null, null, 7, null, null, null, ...]
WRONG:   [5, 5, 5, 5, 7, 7, 7, 7, ...]  // This creates 8 separate notes!

DURATION GUIDELINES:
- Melodies/Leads: 1-2 steps (punchy, rhythmic)
- Bass: 2-4 steps (sustained, groovy)
- Arpeggios: 1 step always (rapid, sequenced)
- Pads: 4-8 steps (long, sustained chords)
- DEFAULT TO SHORT DURATIONS (1-2) for rhythmic parts!

PATTERN ROLES (4 patterns play together to make the track):
- Pattern 0 (tracks[0]): Bass (low indices, sawtooth/square)
- Pattern 1 (tracks[1]): Lead/Melody (mid indices, SHORT durations!)
- Pattern 2 (tracks[2]): Pads/Chords (sine/triangle, reverb)
- Pattern 3 (tracks[3]): Arpeggios/FX (fast patterns, delay)

REASONING: Include a "reasoning" array with 3-6 brief notes explaining your creative choices.
These will be shown to the user during generation. Include emotional/aesthetic reasoning.
Example: ["Setting dark techno vibe at 130 BPM", "Deep sub bass with square wave for punch", "Hypnotic arp pattern with delay for atmosphere"]

OUTPUT JSON SCHEMA:
{
  "trackName": string (creative 2-4 word title for the track),
  "trackNames": string[4] (name each of the 4 patterns),
  "rootKey": number 0-11 (musical key: 0=C, 1=C#, 2=D, 3=D#, 4=E, 5=F, 6=F#, 7=G, 8=G#, 9=A, 10=A#, 11=B),
  "trackParams": { "0": {...}, "1": {...}, "2": {...}, "3": {...} } (synth params for each pattern),
  "globalParams": { "bpm": number },
  "steps": number (keep current value in TRACK mode),
  "numKeys": number (keep current value in TRACK mode),
  "tracks": array of 4 pattern arrays, each with EXACTLY ${currentState.steps} entries - FILL ALL STEPS,
  "reasoning": string[] (3-6 brief creative notes explaining key choice, musical decisions, etc.)
}

CRITICAL RULES:
1. "tracks" must be an array of 4 pattern arrays. Each pattern MUST have exactly ${currentState.steps} entries.
2. Do NOT leave patterns empty. Do NOT make patterns shorter than ${currentState.steps} steps. FILL THE ENTIRE CANVAS.
3. For sustained notes: use [noteIndex, duration] at the START only, then null for the remaining duration steps.
4. Do NOT repeat note indices to make longer notes - that creates separate retriggered notes, not sustained ones.

User request: "${prompt}"`;

                const userContent = `[${targetMode}] ${prompt}${briefContext}
                Current state: ${JSON.stringify(currentState)}`;

                const completion = await websim.chat.completions.create({
                    messages: [
                        { role: "system", content: systemPrompt },
                        { role: "user", content: userContent }
                    ],
                    json: true
                });

                const result = JSON.parse(completion.content);

                // Use walkthrough mode if enabled, otherwise apply directly
                if (this.walkthroughEnabled) {
                    this.abortAiGen = false;
                    const walkthroughCtx = {
                        app: this,
                        engine: this.engine,
                        pianoRoll: this.pianoRoll,
                        keyboard: this.keyboard,
                        knobs: this.knobs,
                        targetMode
                    };
                    // Create getter for abort check
                    Object.defineProperty(walkthroughCtx, 'aborted', {
                        get: () => this.abortAiGen
                    });
                    try {
                        await runWalkthrough(result, walkthroughCtx);
                        showToast('AI GENERATION COMPLETE', 'success');

                        // Save to current pattern after generation
                        this.saveCurrentToPattern(this.currentPatternId);
                        this.updatePatternIndicators();

                        // Auto-generate thumbnail if not set
                        if (!this.thumbnailUrl) {
                            this.generateThumbnail();
                        }

                        // Generate suggested next step after completion
                        this.generateSuggestion(targetMode);
                    } catch (err) {
                        if (err.message === 'ABORTED') {
                            showToast('GENERATION ABORTED', 'info');
                        } else {
                            throw err;
                        }
                    }
                } else {
                    await this.applyState(result, targetMode);
                    showToast('AI APPLIED CHANGES', 'success');

                    // Save to current pattern after generation
                    this.saveCurrentToPattern(this.currentPatternId);
                    this.updatePatternIndicators();

                    // Auto-generate thumbnail if not set
                    if (!this.thumbnailUrl) {
                        this.generateThumbnail();
                    }

                    // Generate suggested next step after completion
                    this.generateSuggestion(targetMode);
                }

                this.aiPromptInput.value = '';
            }
        } catch (err) {
            console.error('AI Request failed:', err);
            showToast('AI REQUEST FAILED', 'error');
        } finally {
            this.aiCopilot.classList.remove('ai-loading');
            this.aiGenBtn.disabled = false;
            this.abortAiGen = false;
            this.updateAiButtonText();
        }
    }

    // --------------------------------------------------------------------------
    // STATE MANAGEMENT
    // --------------------------------------------------------------------------
    getCurrentState(targetMode = 'ALL') {
        const selectedIdx = this.pianoRoll.selectedTrackIdx;
        const allTracks = this.pianoRoll.getTracksAsTracker();

        // In TRACK mode, only include data for the selected track
        let tracks, trackParams;
        if (targetMode === 'TRACK') {
            // Create array with only selected track data
            tracks = allTracks.map((t, idx) => idx === selectedIdx ? t : []);
            // Only include params for selected track
            trackParams = { [selectedIdx]: this.engine.trackParams[selectedIdx] };
        } else {
            tracks = allTracks;
            trackParams = this.engine.trackParams;
        }

        // Save current pattern before getting state
        this.saveCurrentToPattern(this.currentPatternId);

        return {
            trackName: this.trackName?.trim() || '',
            trackDescription: this.trackDescription,
            thumbnailUrl: this.thumbnailUrl,
            trackSkill: this.trackSkill,
            trackNames: this.pianoRoll.trackNames,
            trackParams,
            globalParams: {
                ...this.engine.globalParams,
                masterVolume: Math.round(this.engine.globalParams.masterVolume * 100)
            },
            steps: this.pianoRoll.steps,
            numKeys: this.pianoRoll.numKeys,
            rootKey: parseInt(this.rootKeySelect.value),
            rootOctave: parseInt(this.octaveSelect.value),
            tracks,
            selectedTrackIdx: selectedIdx,
            currentPatternId: this.currentPatternId,
            patterns: JSON.parse(JSON.stringify(this.patterns))
        };
    }

    async applyState(state, targetMode = 'ALL') {
        const selectedIdx = this.pianoRoll.selectedTrackIdx;

        // Apply track name
        if (state.trackName) {
            this.trackName = state.trackName;
            if (this.trackPanel) this.trackPanel.setTitle(state.trackName);
        }
        if (state.trackDescription !== undefined) {
            this.trackDescription = state.trackDescription;
            if (this.trackPanel) this.trackPanel.setDescription(state.trackDescription);
        }
        if (state.thumbnailUrl !== undefined) {
            this.thumbnailUrl = state.thumbnailUrl;
            if (this.trackPanel) this.trackPanel.setThumbnail(state.thumbnailUrl);
        }
        if (state.trackSkill !== undefined) {
            this.trackSkill = state.trackSkill;
        }

        // Apply patterns
        if (state.patterns) {
            this.patterns = JSON.parse(JSON.stringify(state.patterns));
            this.updatePatternIndicators();
        }
        if (state.currentPatternId) {
            this.currentPatternId = state.currentPatternId;
            if (this.patternBank) this.patternBank.setActivePattern(state.currentPatternId);
        }

        // Apply tracker settings
        if (state.steps) {
            this.pianoRoll.setSteps(state.steps);
        }
        if (state.numKeys !== undefined && [12, 25, 49, 61, 88].includes(state.numKeys)) {
            this.keyboardSizeSelect.value = state.numKeys;
            this.setKeyboardSize(state.numKeys);
        }
        if (state.rootKey !== undefined) {
            this.rootKeySelect.value = state.rootKey;
        }
        if (state.rootOctave !== undefined) {
            this.octaveSelect.value = state.rootOctave;
        }
        this.updateKeyboardRange();

        // Apply Global parameter changes
        if (state.globalParams) {
            if (state.globalParams.bpm !== undefined) {
                this.bpmInput.value = state.globalParams.bpm;
                this.engine.updateParam('bpm', state.globalParams.bpm);
                if (this.pianoRoll) this.pianoRoll.setBPM(state.globalParams.bpm);
            }
            // Master volume is user-controlled only (AI cannot modify it)
        }

        // Apply Track parameter changes
        if (state.trackParams) {
            if (Array.isArray(state.trackParams)) {
                state.trackParams.forEach((params, tIdx) => {
                    // In PATTERN mode, only apply to selected track
                    if (targetMode === 'PATTERN' && tIdx !== selectedIdx) return;
                    for (const [key, val] of Object.entries(params)) {
                        this.engine.updateParam(key, val, tIdx);
                    }
                });
            } else {
                for (const [idx, params] of Object.entries(state.trackParams)) {
                    const tIdx = parseInt(idx);
                    // In PATTERN mode, only apply to selected track
                    if (targetMode === 'PATTERN' && tIdx !== selectedIdx) continue;
                    for (const [key, val] of Object.entries(params)) {
                        this.engine.updateParam(key, val, tIdx);
                    }
                }
            }
            this.refreshUIForTrack(selectedIdx);
        }

        // Apply track names
        if (state.trackNames) {
            if (targetMode === 'TRACK') {
                // In TRACK mode, apply all track names
                this.pianoRoll.setTrackNames(state.trackNames);
            } else if (state.trackNames[selectedIdx]) {
                // In PATTERN mode, only update selected track name
                const names = [...this.pianoRoll.trackNames];
                names[selectedIdx] = state.trackNames[selectedIdx];
                this.pianoRoll.setTrackNames(names);
            }
        }

        // Apply sequence changes (convert from tracker format)
        if (state.tracks) {
            if (targetMode === 'PATTERN') {
                // In PATTERN mode, only update selected synth track
                const existingTracks = this.pianoRoll.getTracksAsTracker();
                const mergedTracks = existingTracks.map((track, idx) => {
                    if (idx === selectedIdx && state.tracks[idx] && state.tracks[idx].length > 0) {
                        return state.tracks[idx];
                    }
                    return track;
                });
                this.pianoRoll.setTracksFromTracker(mergedTracks);
            } else {
                // In TRACK mode, apply ALL synth tracks (full composition)
                this.pianoRoll.setTracksFromTracker(state.tracks);
            }
        }
    }

    // --------------------------------------------------------------------------
    // MIDI IMPORT/EXPORT
    // --------------------------------------------------------------------------
    async saveMidi() {
        const midi = new Midi();
        const bpm = this.engine.globalParams.bpm;
        midi.header.setTempo(bpm);

        const startOctave = parseInt(this.octaveSelect.value);
        const rootKey = parseInt(this.rootKeySelect.value);
        const baseNote = (startOctave + 1) * 12 + rootKey;

        // Get tracks in tracker format for MIDI export
        const trackerTracks = this.pianoRoll.getTracksAsTracker();

        const stepDuration = 15 / bpm; // Duration of one step in seconds

        trackerTracks.forEach((trackData, i) => {
            if (trackData.some(n => n !== null)) {
                const midiTrack = midi.addTrack();
                midiTrack.name = this.pianoRoll.trackNames[i] || `Track ${i + 1}`;
                midiTrack.channel = i;

                trackData.forEach((noteData, stepIdx) => {
                    if (noteData !== null) {
                        // Handle both formats: number or [noteIndex, duration]
                        let noteIdx, noteDuration;
                        if (Array.isArray(noteData)) {
                            noteIdx = noteData[0];
                            noteDuration = noteData[1] || 1;
                        } else {
                            noteIdx = noteData;
                            noteDuration = 1;
                        }

                        const midiNote = baseNote + noteIdx;
                        const time = stepIdx * stepDuration;
                        const duration = stepDuration * noteDuration;

                        try {
                            midiTrack.addNote({
                                midi: midiNote,
                                time: time,
                                duration: duration,
                                velocity: 0.8
                            });
                        } catch (e) {
                            console.warn("Invalid note skipped", midiNote);
                        }
                    }
                });
            }
        });

        const midiData = await midi.toArray();
        const blob = new Blob([midiData], { type: "audio/midi" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = (this.trackName?.trim() || "neon-synth") + ".mid";
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);

        showToast('MIDI EXPORTED', 'success');
    }

    async loadMidi(event) {
        const file = event.target.files[0];
        if (!file) return;

        try {
            const arrayBuffer = await file.arrayBuffer();
            const midi = new Midi(arrayBuffer);

            // Update BPM if present
            if (midi.header.tempos.length > 0) {
                const bpm = Math.round(midi.header.tempos[0].bpm);
                this.bpmInput.value = bpm;
                this.engine.updateParam('bpm', bpm);
                this.pianoRoll.setBPM(bpm);
            }

            // Determine sequence length needed
            const durationSteps = Math.ceil(midi.duration * (this.engine.globalParams.bpm / 60) * 4);
            let stepsToSet = 16;
            if (durationSteps > 64) stepsToSet = 128;
            else if (durationSteps > 32) stepsToSet = 64;
            else if (durationSteps > 16) stepsToSet = 32;

            this.pianoRoll.setSteps(stepsToSet);

            // Determine best octave range
            let minNote = 127;
            midi.tracks.forEach(track => {
                track.notes.forEach(note => {
                    if (note.midi < minNote) minNote = note.midi;
                });
            });

            this.rootKeySelect.value = 0;

            let idealOctave = Math.floor(minNote / 12) - 1;
            idealOctave = Math.max(1, Math.min(5, idealOctave));

            this.octaveSelect.value = idealOctave;
            this.updateKeyboardRange();

            const baseNote = (idealOctave + 1) * 12;

            // Convert Tracks with duration support
            const stepsPerSecond = (this.engine.globalParams.bpm / 60) * 4;
            const newTracks = [];
            let trackCount = 0;
            midi.tracks.forEach(track => {
                if (track.notes.length > 0 && trackCount < 4) {
                    const seqTrack = new Array(stepsToSet).fill(null);
                    track.notes.forEach(note => {
                        const step = Math.round(note.time * stepsPerSecond);
                        if (step < stepsToSet) {
                            const relIndex = note.midi - baseNote;
                            if (relIndex >= 0 && relIndex < 18) {
                                // Calculate duration in steps (minimum 1)
                                const durationSteps = Math.max(1, Math.round(note.duration * stepsPerSecond));
                                // Clamp duration to not exceed remaining steps
                                const clampedDuration = Math.min(durationSteps, stepsToSet - step);
                                // Use array format for duration > 1, simple number for duration 1
                                seqTrack[step] = clampedDuration > 1 ? [relIndex, clampedDuration] : relIndex;
                            }
                        }
                    });
                    newTracks.push(seqTrack);
                    trackCount++;
                }
            });

            // Pad with empty tracks up to 4
            while (newTracks.length < 4) {
                newTracks.push(new Array(stepsToSet).fill(null));
            }

            // Load tracks in tracker format
            this.pianoRoll.setTracksFromTracker(newTracks);

            showToast('MIDI IMPORTED', 'success');
        } catch (err) {
            console.error('Error loading MIDI:', err);
            showToast('MIDI IMPORT FAILED', 'error');
        } finally {
            this.midiInput.value = '';
        }
    }

    // --------------------------------------------------------------------------
    // VISUALIZER
    // --------------------------------------------------------------------------
    initVisualizer() {
        const draw = () => {
            requestAnimationFrame(draw);

            const bufferLength = this.engine.analyser.frequencyBinCount;
            const dataArray = new Uint8Array(bufferLength);
            this.engine.analyser.getByteTimeDomainData(dataArray);

            const width = this.visualizerCanvas.width;
            const height = this.visualizerCanvas.height;

            const style = getComputedStyle(document.documentElement);
            const accentColor = style.getPropertyValue('--nc').trim() || '#00ffff';

            this.ctx.fillStyle = '#0a0014';
            this.ctx.fillRect(0, 0, width, height);

            this.ctx.lineWidth = 2;
            this.ctx.strokeStyle = accentColor;
            this.ctx.shadowColor = accentColor;
            this.ctx.shadowBlur = 10;
            this.ctx.beginPath();

            const sliceWidth = width / bufferLength;
            let x = 0;

            for (let i = 0; i < bufferLength; i++) {
                const v = dataArray[i] / 128.0;
                const y = v * height / 2;

                if (i === 0) {
                    this.ctx.moveTo(x, y);
                } else {
                    this.ctx.lineTo(x, y);
                }

                x += sliceWidth;
            }

            this.ctx.lineTo(width, height / 2);
            this.ctx.stroke();
            this.ctx.shadowBlur = 0;
        };

        // Resize observer for canvas
        const resize = () => {
            this.visualizerCanvas.width = this.visualizerCanvas.clientWidth * window.devicePixelRatio;
            this.visualizerCanvas.height = this.visualizerCanvas.clientHeight * window.devicePixelRatio;
        };
        window.addEventListener('resize', resize);
        resize();

        draw();
    }
}

// --------------------------------------------------------------------------
// INITIALIZE
// --------------------------------------------------------------------------
window.addEventListener('DOMContentLoaded', () => {
    new SynthApp();
});
