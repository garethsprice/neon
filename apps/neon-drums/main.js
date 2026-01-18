import { AudioEngine } from './audio-engine.js';
import { Sequencer } from './sequencer.js';
import { showToast, createKnobElement, el, queryAll } from '../../packages/neon-ui/index.js';
import { setupCloud } from './cloud.js';
import { handleAiGeneration, updateAiButtonText } from './ai-handler.js';
import { NeonVisualizer } from './visualizer.js';

const room = new WebsimSocket();

let audioEngine, sequencer, currentInstrument = 'bassDrum', aiPrompts, visualizer;

const elements = {
    playBtn: el('play-pause'), communityToggleBtn: el('community-toggle-btn'),
    closeCommunityBtn: el('close-community-btn'), communitySidebar: el('community-sidebar'),
    globalSaveBtn: el('global-save-btn'), globalLoadBtn: el('global-load-btn'),
    feedFilterAll: el('feed-filter-all'), feedFilterMine: el('feed-filter-mine'),
    playLabel: null, shiftBtn: el('shift-btn'), clearBtn: el('clear-btn'),
    aiBtn: el('ai-gen-btn'), aiPrompt: el('ai-prompt'), aiModeBtn: el('ai-mode-btn'), walkthroughBtn: el('ai-walkthrough-btn'),
    knobRefs: {}, stepButtons: [],
    trackModeToggle: el('track-mode-toggle'), songModeToggle: el('song-mode-toggle'),
    trackNameInput: el('track-name-input'), 
    trackDescriptionInput: el('track-description-input'),
    trackDescriptionPanel: el('track-description-panel'),
    trackInfoBtn: el('track-info-btn'),
    trackMeasureInput: el('track-measure-input'),
    trackThumbnailContainer: el('track-thumbnail-container'),
    trackPatternDisplay: el('track-pattern-display'), instButtonGroup: el('inst-button-group'),
    knobsContainer: el('knobs-container'), stepsContainer: el('steps-container'),
    instName: el('current-inst-name'), stepDisplay: el('step-display'), statusText: el('status-text')
};

const state = { shift: false, shiftPressed: false, clear: false, bank: 1, aiModeIdx: 2, aiWalkthrough: true, fxPage: 0, visibility: 'public' };
const banks = { 1: 'ABCDEFGH'.split(''), 2: 'IJKLMNOP'.split('') };
const FX_PAGES = [['lpFilter', 'hpFilter', 'saturation'], ['compression', 'sidechain'], ['delay', 'reverb']];
const aiModes = ['PATTERN', 'CHAIN', 'TRACK'];
const scales = [{ l: '1x', v: 1 }, { l: '3/4', v: 0.667 }, { l: '1.5x', v: 0.5 }, { l: '2x', v: 0.333 }];

const isShift = () => state.shift || state.shiftPressed;
const setCurrentInstrument = (inst) => { currentInstrument = inst; };

function updateShiftUI() {
    const active = isShift();
    elements.shiftBtn.classList.toggle('active', active);
    elements.playBtn.classList.toggle('shift-active', active);
    elements.clearBtn.classList.toggle('shift-active', active);
    el('pattern-selector').classList.toggle('shift-active', active);
    elements.stepsContainer.classList.toggle('shift-active', active);
    elements.trackModeToggle.classList.toggle('shift-active', active);
    if (active && state.clear) {
        sequencer.clearAllPatterns();
        state.shift = state.clear = false;
        elements.clearBtn.classList.remove('active');
        renderAll();
        updateShiftUI();
        showToast("ALL PATTERNS CLEARED", "success");
    }
}

let onStateChange = null; // Set after cloud is initialized
const renderAll = () => { renderKnobs(); renderSteps(); renderFXControls(); updatePatternUI(); updateAiButtonText(elements, sequencer, aiModes, state); updatePlayButtonReady(); onStateChange?.(); };

function updatePlayButtonReady() {
    elements.playBtn.classList.remove('ready-pattern', 'ready-chain', 'ready-track');
    if (sequencer.isPlaying) return; // No pulse when playing

    // Check for content based on mode
    const hasPattern = Object.values(sequencer.patterns[sequencer.currentPatternId].tracks).some(t => t.some(v => v > 0));
    const hasChain = sequencer.patternChain.length > 1;
    const hasTrack = sequencer.trackMeasures.some(m => m !== null);

    if (sequencer.songMode && hasTrack) {
        elements.playBtn.classList.add('ready-track');
    } else if (hasChain) {
        elements.playBtn.classList.add('ready-chain');
    } else if (hasPattern) {
        elements.playBtn.classList.add('ready-pattern');
    }
}

function syncGlobalKnobs() {
    elements.knobRefs.bpm.updateValue(sequencer.bpm);
    elements.knobRefs.steps.updateValue([16, 32].indexOf(sequencer.numSteps));
    elements.knobRefs.steps.querySelector('.knob-value-display').innerText = sequencer.numSteps;
    const p = sequencer.patterns[sequencer.currentPatternId];
    const sIdx = scales.findIndex(s => Math.abs(s.v - (p.scale || 1.0)) < 0.01);
    elements.knobRefs.scale.updateValue(sIdx !== -1 ? sIdx : 0);
    elements.knobRefs.scale.querySelector('.knob-value-display').innerText = scales[sIdx !== -1 ? sIdx : 0].l;
    elements.knobRefs.shuffle.updateValue(p.shuffle || 0);
    elements.knobRefs.master.updateValue(sequencer.masterVolume);
}

const updateAiModeUI = () => {
    const m = aiModes[state.aiModeIdx];
    elements.aiModeBtn.innerText = m;
    elements.aiModeBtn.className = `btn-action btn-ai-mode mode-${m.toLowerCase()}`;
    elements.aiPrompt.placeholder = aiPrompts.placeholders[m];
};

function updateBankUI() {
    const ids = banks[state.bank];
    queryAll('.pattern-btn').forEach((b, i) => {
        b.dataset.id = ids[i];
        b.closest('.ui-unit').querySelector('.ui-label').innerText = ids[i];
    });
    queryAll('.bank-btn').forEach(b => b.classList.toggle('active', +b.dataset.bank === state.bank));
    updatePatternUI();
}

function updateTrackUI() {
    const m = sequencer.currentTrackMeasure, p = sequencer.trackMeasures[m] || "--";
    elements.trackMeasureInput.value = m + 1;
    elements.trackPatternDisplay.innerText = p;
    const last = sequencer.trackMeasures.findLastIndex(v => v !== null) + 1;
    el('measure-total-label').innerText = last > 1 ? `/ ${last}` : `/ 96`;
    
    // Sync Name and Description inputs
    elements.trackNameInput.value = sequencer.trackName || "";
    elements.trackDescriptionInput.value = sequencer.trackDescription || "";

    // Update thumbnail UI only if changed
    const currentThumbSrc = elements.trackThumbnailContainer.querySelector('img')?.src;
    if (sequencer.thumbnailUrl && currentThumbSrc !== sequencer.thumbnailUrl) {
        elements.trackThumbnailContainer.innerHTML = `<img src="${sequencer.thumbnailUrl}">`;
    } else if (!sequencer.thumbnailUrl && currentThumbSrc) {
        elements.trackThumbnailContainer.innerHTML = `<div class="thumb-placeholder"><i data-lucide="image"></i></div>`;
        if (window.lucide) window.lucide.createIcons();
    }
}

function updatePatternUI() {
    const curr = sequencer.currentPatternId, chain = sequencer.patternChain;
    queryAll('.pattern-btn').forEach(b => {
        const id = b.dataset.id;
        b.classList.toggle('active', id === curr);
        b.classList.toggle('chained', chain.includes(id));
        const p = sequencer.patterns[id];
        b.classList.toggle('is-empty', !Object.values(p.tracks).some(t => t.some(v => v > 0)));
    });
    queryAll('.inst-btn').forEach(b => {
        const t = sequencer.patterns[curr].tracks[b.dataset.inst];
        b.classList.toggle('is-empty', !t || !t.some(v => v > 0));
    });
    renderSteps();
}

function renderKnobs() {
    elements.knobsContainer.innerHTML = '';
    const inst = currentInstrument;
    const info = audioEngine.manifest.instruments[inst];
    const params = [...info.parameters, 'level', ...(sequencer.flams[inst].some(f => f) ? ['flamAmount'] : [])];
    params.forEach(p => {
        const scale = audioEngine.getScaleForParam(inst, p);
        const k = createKnobElement(p === 'flamAmount' ? 'FLAM' : p, scale.indexOf(sequencer.trackParams[inst][p]), 0, scale.length - 1, i => {
            sequencer.setParam(inst, p, scale[i]);
            k.querySelector('.knob-value-display').innerText = scale[i];
        }, () => {
            // Preview sound only on release to avoid flooding
            audioEngine.play(inst, sequencer.trackParams[inst]);
        });
        k.querySelector('.knob-value-display').innerText = sequencer.trackParams[inst][p];
        elements.knobsContainer.appendChild(k);
    });
}

function renderSteps() {
    elements.stepsContainer.innerHTML = '';
    elements.stepButtons = [];
    const track = sequencer.tracks[currentInstrument], flams = sequencer.flams[currentInstrument];
    const currentStepIdx = (sequencer.isPlaying || sequencer.isTrackPlaying) ? sequencer.currentStep : -1;
    for (let i = 0; i < sequencer.numSteps; i++) {
        const unit = document.createElement('div');
        unit.className = 'step-unit';
        const btn = document.createElement('div');
        btn.className = `step-btn ${track[i] === 1 ? 'on-normal' : track[i] === 2 ? 'on-accented' : ''} ${flams[i] ? 'has-flam' : ''} ${i === currentStepIdx ? 'active-step' : ''}`;
        btn.innerHTML = '<span class="flam-indicator">FLAM</span>';
        const num = document.createElement('div');
        num.className = 'step-number';
        num.innerText = i + 1;
        btn.onclick = () => {
            if (isShift()) { sequencer.toggleFlam(currentInstrument, i); renderKnobs(); }
            else {
                const v = sequencer.toggleStep(currentInstrument, i);
                if (v) audioEngine.play(currentInstrument, { ...sequencer.trackParams[currentInstrument], level: sequencer.trackParams[currentInstrument].level + (v === 2 ? 25 : 0) });
            }
            updatePatternUI();
            updateAiButtonText(elements, sequencer, aiModes, state);
        };
        unit.appendChild(btn);
        unit.appendChild(num);
        elements.stepButtons.push(btn);
        elements.stepsContainer.appendChild(unit);
    }
}

function renderFXControls() {
    const container = el('fx-controls-container'), params = sequencer.trackParams[currentInstrument];
    const activeModules = FX_PAGES[state.fxPage];
    el('fx-page-info').innerText = `${state.fxPage + 1} / ${FX_PAGES.length}`;
    container.innerHTML = activeModules.map(m => `
        <div class="fx-module ${params[m + 'Enabled'] ? 'enabled' : ''}" data-mod="${m}">
            <h3><div class="toggle-fx"></div><span>${m.toUpperCase().replace('FILTER', ' FILTER')}</span></h3>
            <div class="fx-controls" id="fx-ctrl-${m}"></div>
        </div>`).join('');

    container.querySelectorAll('.fx-module').forEach(mod => {
        const m = mod.dataset.mod;
        mod.querySelector('h3').onclick = () => {
            const s = !sequencer.trackParams[currentInstrument][m + 'Enabled'];
            sequencer.setParam(currentInstrument, m + 'Enabled', s);
            mod.classList.toggle('enabled', s);
            if (s) audioEngine.play(currentInstrument, sequencer.trackParams[currentInstrument]);
        };
        const ctrls = {
            lpFilter: [['Cutoff', 'lpFilterCutoff'], ['Reso', 'lpFilterResonance']],
            hpFilter: [['Cutoff', 'hpFilterCutoff'], ['Reso', 'hpFilterResonance']],
            saturation: [['Drive', 'saturationDrive']],
            compression: [['Thresh', 'compressionThreshold'], ['Ratio', 'compressionRatio']],
            sidechain: [['Amt', 'sidechainAmount'], ['Rel', 'sidechainRelease']],
            delay: [['Time', 'delayTime'], ['Fdbk', 'delayFeedback'], ['Mix', 'delayMix']],
            reverb: [['Mix', 'reverbMix']]
        }[m];
        ctrls.forEach(([l, p]) => {
            const inst = currentInstrument;
            const k = createKnobElement(l, params[p], 0, 100, v => {
                sequencer.setParam(inst, p, v);
            }, () => {
                // Preview sound only on release to avoid flooding
                if (sequencer.trackParams[inst][m + 'Enabled']) {
                    audioEngine.play(inst, sequencer.trackParams[inst]);
                }
            });
            k.classList.add('fx-control-unit');
            el(`fx-ctrl-${m}`).appendChild(k);
        });
    });
}

async function init() {
    audioEngine = new AudioEngine({ onError: m => showToast(m, 'error') });
    await audioEngine.init();
    sequencer = new Sequencer(audioEngine);
    aiPrompts = await fetch('ai-prompts.json').then(r => r.json());

    // Initialize visualizer
    const vizCanvas = el('visualizer-bg');
    if (vizCanvas) {
        visualizer = new NeonVisualizer(vizCanvas);
        visualizer.play();
    }

    setupUI();
    renderAll();
    updateAiModeUI();
    if (window.lucide) window.lucide.createIcons();
    elements.statusText.innerText = "SYSTEM READY";
}

function setupUI() {
    elements.playLabel = document.querySelector('.transport-play-labels .label-default');


    // Cloud setup
    const cloud = setupCloud(room, { sequencer, elements, renderAll, syncGlobalKnobs, updateTrackUI, state });
    const { performCommit, updateSaveButtonState } = cloud;

    // Connect state change callback to save button updates
    onStateChange = updateSaveButtonState;

    // Play button
    elements.playBtn.onclick = async () => {
        if (isShift()) {
            sequencer.stop();
            sequencer.resetAll();
            state.bank = 1; state.fxPage = 0; state.aiModeIdx = 0;
            currentInstrument = 'bassDrum';
            elements.trackNameInput.value = "";
            elements.trackDescriptionInput.value = "";
            elements.trackDescriptionPanel.classList.add('hidden');
            elements.instName.innerText = "BASS DRUM";
            syncGlobalKnobs();
            elements.playLabel.innerText = "START";
            elements.playBtn.classList.remove('playing', 'track-mode', 'song-mode');
            elements.trackModeToggle.classList.remove('active');
            elements.songModeToggle.classList.remove('active');
            el('pattern-selector').classList.remove('track-mode-active');
            queryAll('.inst-btn').forEach(btn => btn.classList.toggle('active', btn.dataset.inst === currentInstrument));
            updateBankUI(); renderFXControls(); renderKnobs(); updateTrackUI(); updateAiModeUI(); updateAiButtonText(elements, sequencer, aiModes, state);
            showToast("SYSTEM RESET", "success");
            return;
        }
        if (audioEngine.ctx.state === 'suspended') await audioEngine.ctx.resume();
        if (sequencer.isPlaying) {
            sequencer.stop(); sequencer.isTrackPlaying = false;
            queryAll('.step-btn').forEach(b => b.classList.remove('active-step'));
        } else {
            if (sequencer.songMode && sequencer.trackMeasures[0] === null) return showToast("EMPTY TRACK", "error");
            if (sequencer.songMode) {
                sequencer.currentTrackMeasure = 0;
                sequencer.switchPattern(sequencer.trackMeasures[0] || 'A', true);
                sequencer.isTrackPlaying = true;
            }
            sequencer.start();
            if (cloud.currentTrack?.id) {
                cloud.recordPlay(cloud.currentTrack.id);
            }
            updateTrackUI(); updatePatternUI(); syncGlobalKnobs();
        }
        elements.playLabel.innerText = sequencer.isPlaying ? "STOP" : "START";
        elements.playBtn.classList.toggle('playing', sequencer.isPlaying);
        updatePlayButtonReady();
    };

    // Transport knobs
    const addKnob = (id, label, val, min, max, cb, disp) => {
        const k = createKnobElement(label, val, min, max, cb);
        el(id).appendChild(k);
        if (disp) k.querySelector('.knob-value-display').innerText = disp;
        return k;
    };
    elements.knobRefs.bpm = addKnob('bpm-knob-container', 'BPM', sequencer.bpm, 40, 240, v => { sequencer.bpm = v; if (visualizer) visualizer.setBpm(v); });
    elements.knobRefs.steps = addKnob('step-count-knob-container', 'STEPS', [16, 32].indexOf(sequencer.numSteps), 0, 1, i => {
        const v = [16, 32][i];
        if (v === 32 && sequencer.numSteps === 16) sequencer.doublePattern();
        sequencer.numSteps = sequencer.patterns[sequencer.currentPatternId].numSteps = v;
        elements.knobRefs.steps.querySelector('.knob-value-display').innerText = v;
        renderSteps();
    }, sequencer.numSteps);
    elements.knobRefs.scale = addKnob('scale-knob-container', 'SCALE', 0, 0, 3, i => {
        sequencer.patterns[sequencer.currentPatternId].scale = scales[i].v;
        elements.knobRefs.scale.querySelector('.knob-value-display').innerText = scales[i].l;
    }, '1x');
    elements.knobRefs.shuffle = addKnob('shuffle-knob-container', 'SHUFFLE', 0, 0, 100, v => sequencer.patterns[sequencer.currentPatternId].shuffle = v);
    elements.knobRefs.master = addKnob('master-volume-knob-container', 'MASTER', 80, 0, 100, v => { sequencer.masterVolume = v; audioEngine.setMasterVolume(v); });

    // Track inputs
    elements.trackNameInput.oninput = e => sequencer.trackName = e.target.value;
    elements.trackDescriptionInput.oninput = e => sequencer.trackDescription = e.target.value;
    elements.trackThumbnailContainer.onclick = () => {
        import('./ai-handler.js').then(m => m.generateTrackThumbnail(sequencer, aiPrompts, elements));
    };
    elements.trackInfoBtn.onclick = () => {
        elements.trackDescriptionPanel.classList.toggle('hidden');
        elements.trackInfoBtn.classList.toggle('active');
    };
    elements.trackMeasureInput.onchange = e => {
        const v = Math.max(1, Math.min(96, parseInt(e.target.value) || 1));
        sequencer.currentTrackMeasure = v - 1;
        if (!sequencer.isTrackPlaying) {
            const pid = sequencer.trackMeasures[sequencer.currentTrackMeasure];
            if (pid) { sequencer.switchPattern(pid, true); updatePatternUI(); }
        }
        updateTrackUI();
    };

    // Banks
    queryAll('.bank-btn').forEach(b => b.onclick = () => { state.bank = +b.dataset.bank; updateBankUI(); });

    // Pattern selector
    const ids = banks[state.bank];
    el('pattern-selector').innerHTML = ids.map(id => `
        <div class="ui-unit">
            <button class="btn-machine btn-square pattern-btn ${id === sequencer.currentPatternId ? 'active' : ''}" data-id="${id}">
                <span class="save-indicator">SAVE</span><span class="chain-indicator">CHAIN</span>
            </button>
            <div class="ui-label">${id}</div>
        </div>`).join('');

    // Instruments
    const insts = Object.keys(audioEngine.manifest.instruments).filter(k => !['closedToOpen', 'openToClosed'].includes(k));
    elements.instButtonGroup.innerHTML = insts.map(k => `
        <div class="inst-unit">
            <button class="btn-machine btn-square inst-btn ${k === currentInstrument ? 'active' : ''}" data-inst="${k}"></button>
            <div class="ui-label" style="height:2.4em">${audioEngine.manifest.instruments[k].displayName}</div>
        </div>`).join('');

    elements.instButtonGroup.onclick = e => {
        const b = e.target.closest('.inst-btn');
        if (!b) return;
        currentInstrument = b.dataset.inst;
        elements.instName.innerText = audioEngine.manifest.instruments[currentInstrument].displayName.toUpperCase();
        queryAll('.inst-btn').forEach(btn => btn.classList.toggle('active', btn.dataset.inst === currentInstrument));
        renderAll();
    };

    // Pattern selector events
    let chainT;
    el('pattern-selector').onclick = e => {
        const b = e.target.closest('.pattern-btn');
        if (!b) return;
        const id = b.dataset.id, curr = sequencer.currentPatternId;
        if (sequencer.trackMode && !sequencer.isTrackPlaying) {
            sequencer.trackMeasures[sequencer.currentTrackMeasure] = id;
            updateTrackUI(); sequencer.switchPattern(id, true); updatePatternUI();
            if (sequencer.currentTrackMeasure < 95) sequencer.currentTrackMeasure++;
            updateAiButtonText(elements, sequencer, aiModes, state);
            return updateTrackUI();
        }
        if (state.clear) { sequencer.clearPattern(id); if (curr === id) renderSteps(); updateAiButtonText(elements, sequencer, aiModes, state); return; }
        if (isShift() && curr !== id) sequencer.copyPattern(curr, id);
        if (chainT) clearTimeout(chainT);
        const inChain = sequencer.patternChain.includes(id);
        sequencer.switchPattern(id, true); updatePatternUI();
        if (!inChain && sequencer.patternChain.length) chainT = setTimeout(() => { sequencer.patternChain = []; updatePatternUI(); }, 300);
    };

    el('pattern-selector').ondblclick = e => {
        const b = e.target.closest('.pattern-btn');
        if (!b || isShift()) return;
        if (chainT) clearTimeout(chainT);
        sequencer.togglePatternInChain(b.dataset.id); updatePatternUI();
        updatePlayButtonReady();
    };

    // Control buttons
    elements.shiftBtn.onclick = () => { state.shift = !state.shift; updateShiftUI(); };
    elements.clearBtn.onclick = () => { state.clear = !state.clear; elements.clearBtn.classList.toggle('active', state.clear); updateShiftUI(); };

    elements.trackModeToggle.onclick = () => {
        if (isShift()) {
            sequencer.trackMeasures.fill(null);
            sequencer.currentTrackMeasure = 0;
            sequencer.trackName = "";
            sequencer.trackDescription = "";
            return updateTrackUI();
        }
        sequencer.trackMode = !sequencer.trackMode;
        el('pattern-selector').classList.toggle('track-mode-active', sequencer.trackMode);
        elements.trackModeToggle.classList.toggle('active', sequencer.trackMode);
        elements.playBtn.classList.toggle('track-mode', sequencer.trackMode);
        state.aiModeIdx = sequencer.trackMode ? 2 : 0;
        updateAiModeUI(); updatePatternUI();
    };

    elements.songModeToggle.onclick = () => {
        sequencer.songMode = !sequencer.songMode;
        elements.songModeToggle.classList.toggle('active', sequencer.songMode);
        elements.playBtn.classList.toggle('song-mode', sequencer.songMode);
        state.aiModeIdx = sequencer.songMode ? 2 : (sequencer.trackMode ? 2 : 0);
        updateAiModeUI();
        updatePlayButtonReady();
    };

    // AI controls
    elements.aiModeBtn.onclick = () => { state.aiModeIdx = (state.aiModeIdx + 1) % 3; updateAiModeUI(); };
    elements.walkthroughBtn.onclick = () => { state.aiWalkthrough = !state.aiWalkthrough; elements.walkthroughBtn.classList.toggle('active', state.aiWalkthrough); };

    elements.aiPrompt.oninput = () => {
        const val = elements.aiPrompt.value.toLowerCase();
        if (val.includes('track')) { state.aiModeIdx = 2; updateAiModeUI(); }
        else if (val.includes('chain')) { state.aiModeIdx = 1; updateAiModeUI(); }
        else if (val.includes('pattern')) { state.aiModeIdx = 0; updateAiModeUI(); }
        updateAiButtonText(elements, sequencer, aiModes, state);
    };

    elements.aiBtn.onclick = () => handleAiGeneration({
        sequencer, audioEngine, elements, state, aiModes, aiPrompts, FX_PAGES, banks, scales,
        performCommit, renderAll, renderKnobs, renderSteps, renderFXControls, syncGlobalKnobs,
        updateBankUI, updateTrackUI, updatePatternUI, updateAiModeUI, currentInstrument, setCurrentInstrument
    });

    // FX pager
    el('fx-prev').onclick = () => { state.fxPage = (state.fxPage - 1 + FX_PAGES.length) % FX_PAGES.length; renderFXControls(); };
    el('fx-next').onclick = () => { state.fxPage = (state.fxPage + 1) % FX_PAGES.length; renderFXControls(); };

    // Keyboard
    window.onkeydown = e => { if (e.key === 'Shift') { state.shiftPressed = true; updateShiftUI(); } };
    window.onkeyup = e => { if (e.key === 'Shift') { state.shiftPressed = false; updateShiftUI(); } };

    // Sequencer callbacks
    sequencer.onPatternChange = id => {
        const target = banks[1].includes(id) ? 1 : 2;
        if (target !== state.bank) { state.bank = target; updateBankUI(); } else updatePatternUI();
        syncGlobalKnobs(); updateTrackUI();
    };
    sequencer.onTrackUpdate = updateTrackUI;
    sequencer.onInstrumentTrigger = (k, stepIdx) => {
        const b = document.querySelector(`.inst-btn[data-inst="${k}"]`);
        if (b) { b.classList.add('trigger'); setTimeout(() => b.classList.remove('trigger'), 80); }
        if (k === currentInstrument) {
            const btn = elements.stepButtons[stepIdx];
            if (btn) { btn.classList.add('hit-active'); setTimeout(() => btn.classList.remove('hit-active'), 100); }
        }
        if (visualizer) visualizer.trigger(k);
    };
    sequencer.onStepChange = s => {
        elements.stepDisplay.innerText = `STEP: ${s + 1}`;
        elements.stepButtons.forEach((b, i) => b.classList.toggle('active-step', i === s));
    };
}

init();
