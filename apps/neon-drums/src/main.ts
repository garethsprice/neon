/**
 * Neon Drums - Main Application
 *
 * AI-909 Rhythm Composer - A drum machine with AI-powered pattern generation
 */

import { AudioEngine } from './audio-engine';
import { Sequencer, type PatternId } from './sequencer';
import { showToast, createKnobElement, el, queryAll } from '@neon/ui';
import { setupCloud } from './cloud';
import { handleAiGeneration, updateAiButtonText, generateTrackThumbnail, openThumbnailModal, type Elements, type AppState, type AIPrompts } from './ai-handler';
import { createDrumsVisualizer, type NeonVisualizer } from './visualizer';

let audioEngine: AudioEngine;
let sequencer: Sequencer;
let currentInstrument = 'bassDrum';
let aiPrompts: AIPrompts;
let visualizer: NeonVisualizer | null = null;

const elements: Elements = {
  playBtn: el('play-pause'),
  communityToggleBtn: el('community-toggle-btn'),
  closeCommunityBtn: el('close-community-btn'),
  communitySidebar: el('community-sidebar'),
  globalSaveBtn: el('global-save-btn'),
  globalLoadBtn: el('global-load-btn'),
  feedFilterAll: el('feed-filter-all'),
  feedFilterMine: el('feed-filter-mine'),
  playLabel: null,
  shiftBtn: el('shift-btn'),
  clearBtn: el('clear-btn'),
  aiBtn: el('ai-gen-btn'),
  aiPrompt: el('ai-prompt') as HTMLInputElement | null,
  aiModeBtn: el('ai-mode-btn'),
  walkthroughBtn: el('ai-walkthrough-btn'),
  knobRefs: {} as Record<string, { updateValue: (v: number) => void; querySelector: (s: string) => HTMLElement | null }>,
  stepButtons: [],
  trackModeToggle: el('track-mode-toggle'),
  songModeToggle: el('song-mode-toggle'),
  trackNameInput: el('track-name-input') as HTMLInputElement | null,
  trackDescriptionInput: el('track-description-input') as HTMLTextAreaElement | null,
  trackDescriptionPanel: el('track-description-panel'),
  trackInfoBtn: el('track-info-btn'),
  trackMeasureInput: el('track-measure-input') as HTMLInputElement | null,
  trackThumbnailContainer: el('track-thumbnail-container'),
  trackPatternDisplay: el('track-pattern-display'),
  instButtonGroup: el('inst-button-group'),
  knobsContainer: el('knobs-container'),
  stepsContainer: el('steps-container'),
  instName: el('current-inst-name'),
  stepDisplay: el('step-display'),
  statusText: el('status-text')
};

const state: AppState = { shift: false, shiftPressed: false, clear: false, bank: 1, aiModeIdx: 2, aiWalkthrough: true, fxPage: 0, visibility: 'public' };
const banks: Record<number, PatternId[]> = { 1: 'ABCDEFGH'.split(''), 2: 'IJKLMNOP'.split('') };
const FX_PAGES = [['lpFilter', 'hpFilter', 'saturation'], ['compression', 'sidechain'], ['delay', 'reverb']];
const aiModes = ['PATTERN', 'CHAIN', 'TRACK'];
const scales = [{ l: '1x', v: 1 }, { l: '3/4', v: 0.667 }, { l: '1.5x', v: 0.5 }, { l: '2x', v: 0.333 }];

const isShift = (): boolean => state.shift || state.shiftPressed;
const setCurrentInstrument = (inst: string): void => { currentInstrument = inst; };

function updateShiftUI(): void {
  const active = isShift();
  elements.shiftBtn?.classList.toggle('active', active);
  elements.playBtn?.classList.toggle('shift-active', active);
  elements.clearBtn?.classList.toggle('shift-active', active);
  el('pattern-selector')?.classList.toggle('shift-active', active);
  elements.stepsContainer?.classList.toggle('shift-active', active);
  elements.trackModeToggle?.classList.toggle('shift-active', active);
  if (active && state.clear) {
    sequencer.clearAllPatterns();
    state.shift = state.clear = false;
    elements.clearBtn?.classList.remove('active');
    renderAll();
    updateShiftUI();
    showToast("ALL PATTERNS CLEARED", "success");
  }
}

let onStateChange: (() => void) | null = null;
const renderAll = (): void => {
  renderKnobs();
  renderSteps();
  renderFXControls();
  updatePatternUI();
  updateAiButtonText(elements, sequencer, aiModes, state);
  updatePlayButtonReady();
  onStateChange?.();
};

function updatePlayButtonReady(): void {
  elements.playBtn?.classList.remove('ready-pattern', 'ready-chain', 'ready-track');
  if (sequencer.isPlaying) return;

  const hasPattern = Object.values(sequencer.patterns[sequencer.currentPatternId].tracks).some(t => t.some(v => v > 0));
  const hasChain = sequencer.patternChain.length > 1;
  const hasTrack = sequencer.trackMeasures.some(m => m !== null);

  if (sequencer.songMode && hasTrack) {
    elements.playBtn?.classList.add('ready-track');
  } else if (hasChain) {
    elements.playBtn?.classList.add('ready-chain');
  } else if (hasPattern) {
    elements.playBtn?.classList.add('ready-pattern');
  }
}

function syncGlobalKnobs(): void {
  elements.knobRefs.bpm?.updateValue(sequencer.bpm);
  elements.knobRefs.steps?.updateValue([16, 32].indexOf(sequencer.numSteps));
  const stepsDisplay = elements.knobRefs.steps?.querySelector('.knob-value-display');
  if (stepsDisplay) stepsDisplay.innerText = String(sequencer.numSteps);
  const p = sequencer.patterns[sequencer.currentPatternId];
  const sIdx = scales.findIndex(s => Math.abs(s.v - (p.scale || 1.0)) < 0.01);
  elements.knobRefs.scale?.updateValue(sIdx !== -1 ? sIdx : 0);
  const scaleDisplay = elements.knobRefs.scale?.querySelector('.knob-value-display');
  if (scaleDisplay) scaleDisplay.innerText = scales[sIdx !== -1 ? sIdx : 0].l;
  elements.knobRefs.shuffle?.updateValue(p.shuffle || 0);
  elements.knobRefs.master?.updateValue(sequencer.masterVolume);
}

const updateAiModeUI = (): void => {
  const m = aiModes[state.aiModeIdx];
  if (elements.aiModeBtn) {
    elements.aiModeBtn.innerText = m;
    elements.aiModeBtn.className = `btn-action btn-ai-mode mode-${m.toLowerCase()}`;
  }
  if (elements.aiPrompt && aiPrompts?.placeholders) {
    elements.aiPrompt.placeholder = aiPrompts.placeholders[m];
  }
};

function updateBankUI(): void {
  const ids = banks[state.bank];
  queryAll('.pattern-btn').forEach((b, i) => {
    (b as HTMLElement).dataset.id = ids[i];
    const label = b.closest('.ui-unit')?.querySelector('.ui-label');
    if (label) label.textContent = ids[i];
  });
  queryAll('.bank-btn').forEach(b => b.classList.toggle('active', +(b as HTMLElement).dataset.bank! === state.bank));
  updatePatternUI();
}

function updateTrackUI(): void {
  const m = sequencer.currentTrackMeasure;
  const p = sequencer.trackMeasures[m] || "--";
  if (elements.trackMeasureInput) elements.trackMeasureInput.value = String(m + 1);
  if (elements.trackPatternDisplay) elements.trackPatternDisplay.innerText = String(p);
  const last = sequencer.trackMeasures.findLastIndex(v => v !== null) + 1;
  const totalLabel = el('measure-total-label');
  if (totalLabel) totalLabel.innerText = last > 1 ? `/ ${last}` : `/ 96`;

  if (elements.trackNameInput) elements.trackNameInput.value = sequencer.trackName || "";
  if (elements.trackDescriptionInput) elements.trackDescriptionInput.value = sequencer.trackDescription || "";

  const currentThumbSrc = elements.trackThumbnailContainer?.querySelector('img')?.src;
  if (sequencer.thumbnailUrl && currentThumbSrc !== sequencer.thumbnailUrl) {
    if (elements.trackThumbnailContainer) elements.trackThumbnailContainer.innerHTML = `<img src="${sequencer.thumbnailUrl}">`;
  } else if (!sequencer.thumbnailUrl && currentThumbSrc) {
    if (elements.trackThumbnailContainer) elements.trackThumbnailContainer.innerHTML = `<div class="thumb-placeholder"><i data-lucide="image"></i></div>`;
    if ((window as unknown as { lucide?: { createIcons: () => void } }).lucide) {
      (window as unknown as { lucide: { createIcons: () => void } }).lucide.createIcons();
    }
  }
}

function updatePatternUI(): void {
  const curr = sequencer.currentPatternId;
  const chain = sequencer.patternChain;
  queryAll('.pattern-btn').forEach(b => {
    const id = (b as HTMLElement).dataset.id!;
    b.classList.toggle('active', id === curr);
    b.classList.toggle('chained', chain.includes(id));
    const p = sequencer.patterns[id];
    b.classList.toggle('is-empty', !Object.values(p.tracks).some(t => t.some(v => v > 0)));
  });
  queryAll('.inst-btn').forEach(b => {
    const t = sequencer.patterns[curr].tracks[(b as HTMLElement).dataset.inst!];
    b.classList.toggle('is-empty', !t || !t.some(v => v > 0));
  });
  renderSteps();
}

function renderKnobs(): void {
  if (!elements.knobsContainer) return;
  elements.knobsContainer.innerHTML = '';
  const inst = currentInstrument;
  const info = audioEngine.manifest?.instruments[inst];
  if (!info) return;
  const params = [...info.parameters, 'level', ...(sequencer.flams[inst].some(f => f) ? ['flamAmount'] : [])];
  params.forEach(p => {
    const scale = audioEngine.getScaleForParam(inst, p);
    const k = createKnobElement(p === 'flamAmount' ? 'FLAM' : p, scale.indexOf(sequencer.trackParams[inst][p] as number), 0, scale.length - 1, (i: number) => {
      sequencer.setParam(inst, p, scale[i]);
      const display = k.querySelector('.knob-value-display');
      if (display) display.textContent = String(scale[i]);
    }, () => {
      audioEngine.play(inst, sequencer.trackParams[inst]);
    });
    const display = k.querySelector('.knob-value-display');
    if (display) display.textContent = String(sequencer.trackParams[inst][p]);
    elements.knobsContainer!.appendChild(k);
  });
}

function renderSteps(): void {
  if (!elements.stepsContainer) return;
  elements.stepsContainer.innerHTML = '';
  elements.stepButtons = [];
  const track = sequencer.tracks[currentInstrument];
  const flams = sequencer.flams[currentInstrument];
  const currentStepIdx = (sequencer.isPlaying || sequencer.isTrackPlaying) ? sequencer.currentStep : -1;
  for (let i = 0; i < sequencer.numSteps; i++) {
    const unit = document.createElement('div');
    unit.className = 'step-unit';
    const btn = document.createElement('div');
    btn.className = `step-btn ${track[i] === 1 ? 'on-normal' : track[i] === 2 ? 'on-accented' : ''} ${flams[i] ? 'has-flam' : ''} ${i === currentStepIdx ? 'active-step' : ''}`;
    btn.innerHTML = '<span class="flam-indicator">FLAM</span>';
    const num = document.createElement('div');
    num.className = 'step-number';
    num.innerText = String(i + 1);
    btn.onclick = (): void => {
      if (isShift()) {
        sequencer.toggleFlam(currentInstrument, i);
        renderKnobs();
      } else {
        const v = sequencer.toggleStep(currentInstrument, i);
        if (v) audioEngine.play(currentInstrument, { ...sequencer.trackParams[currentInstrument], level: (sequencer.trackParams[currentInstrument].level as number) + (v === 2 ? 25 : 0) });
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

function renderFXControls(): void {
  const container = el('fx-controls-container');
  if (!container) return;
  const params = sequencer.trackParams[currentInstrument];
  const activeModules = FX_PAGES[state.fxPage];
  const pageInfo = el('fx-page-info');
  if (pageInfo) pageInfo.innerText = `${state.fxPage + 1} / ${FX_PAGES.length}`;
  container.innerHTML = activeModules.map(m => `
    <div class="fx-module ${params[m + 'Enabled'] ? 'enabled' : ''}" data-mod="${m}">
      <h3><div class="toggle-fx"></div><span>${m.toUpperCase().replace('FILTER', ' FILTER')}</span></h3>
      <div class="fx-controls" id="fx-ctrl-${m}"></div>
    </div>`).join('');

  container.querySelectorAll('.fx-module').forEach(mod => {
    const m = (mod as HTMLElement).dataset.mod!;
    const h3 = mod.querySelector('h3');
    if (h3) {
      h3.onclick = (): void => {
        const s = !sequencer.trackParams[currentInstrument][m + 'Enabled'];
        sequencer.setParam(currentInstrument, m + 'Enabled', s ? 1 : 0);
        mod.classList.toggle('enabled', s);
        if (s) audioEngine.play(currentInstrument, sequencer.trackParams[currentInstrument]);
      };
    }
    const ctrls: Record<string, [string, string][]> = {
      lpFilter: [['Cutoff', 'lpFilterCutoff'], ['Reso', 'lpFilterResonance']],
      hpFilter: [['Cutoff', 'hpFilterCutoff'], ['Reso', 'hpFilterResonance']],
      saturation: [['Drive', 'saturationDrive']],
      compression: [['Thresh', 'compressionThreshold'], ['Ratio', 'compressionRatio']],
      sidechain: [['Amt', 'sidechainAmount'], ['Rel', 'sidechainRelease']],
      delay: [['Time', 'delayTime'], ['Fdbk', 'delayFeedback'], ['Mix', 'delayMix']],
      reverb: [['Mix', 'reverbMix']]
    };
    ctrls[m]?.forEach(([l, p]) => {
      const inst = currentInstrument;
      const k = createKnobElement(l, params[p] as number, 0, 100, (v: number) => {
        sequencer.setParam(inst, p, v);
      }, () => {
        if (sequencer.trackParams[inst][m + 'Enabled']) {
          audioEngine.play(inst, sequencer.trackParams[inst]);
        }
      });
      k.classList.add('fx-control-unit');
      el(`fx-ctrl-${m}`)?.appendChild(k);
    });
  });
}

async function init(): Promise<void> {
  audioEngine = new AudioEngine({ onError: m => showToast(m, 'error') });
  await audioEngine.init();
  sequencer = new Sequencer(audioEngine);
  aiPrompts = await fetch('ai-prompts.json').then(r => r.json());

  const vizCanvas = el('visualizer-bg') as HTMLCanvasElement | null;
  if (vizCanvas) {
    visualizer = createDrumsVisualizer(vizCanvas);
    visualizer.play();
  }

  setupUI();
  renderAll();
  updateAiModeUI();
  if ((window as unknown as { lucide?: { createIcons: () => void } }).lucide) {
    (window as unknown as { lucide: { createIcons: () => void } }).lucide.createIcons();
  }
  if (elements.statusText) elements.statusText.innerText = "SYSTEM READY";
}

function setupUI(): void {
  elements.playLabel = document.querySelector('.transport-play-labels .label-default');

  // Cloud setup (optional - may not be available outside websim)
  let performCommit: () => Promise<void> = async () => {};
  let updateSaveButtonState: () => void = () => {};
  let cloud: ReturnType<typeof setupCloud> | null = null;

  try {
    const room = new WebsimSocket();
    cloud = setupCloud(room, { sequencer, elements, renderAll, syncGlobalKnobs, updateTrackUI, state });
    performCommit = cloud.performCommit;
    updateSaveButtonState = cloud.updateSaveButtonState;
    onStateChange = updateSaveButtonState;
  } catch (e) {
    console.warn('Cloud features unavailable:', (e as Error).message);
  }

  // Play button
  if (elements.playBtn) {
    elements.playBtn.onclick = async (): Promise<void> => {
      if (isShift()) {
        sequencer.stop();
        sequencer.resetAll();
        state.bank = 1;
        state.fxPage = 0;
        state.aiModeIdx = 0;
        currentInstrument = 'bassDrum';
        if (elements.trackNameInput) elements.trackNameInput.value = "";
        if (elements.trackDescriptionInput) elements.trackDescriptionInput.value = "";
        elements.trackDescriptionPanel?.classList.add('hidden');
        if (elements.instName) elements.instName.innerText = "BASS DRUM";
        syncGlobalKnobs();
        if (elements.playLabel) elements.playLabel.innerText = "START";
        elements.playBtn?.classList.remove('playing', 'track-mode', 'song-mode');
        elements.trackModeToggle?.classList.remove('active');
        elements.songModeToggle?.classList.remove('active');
        el('pattern-selector')?.classList.remove('track-mode-active');
        queryAll('.inst-btn').forEach(btn => btn.classList.toggle('active', (btn as HTMLElement).dataset.inst === currentInstrument));
        updateBankUI();
        renderFXControls();
        renderKnobs();
        updateTrackUI();
        updateAiModeUI();
        updateAiButtonText(elements, sequencer, aiModes, state);
        showToast("SYSTEM RESET", "success");
        return;
      }
      if (audioEngine.ctx.state === 'suspended') await audioEngine.ctx.resume();
      if (sequencer.isPlaying) {
        sequencer.stop();
        sequencer.isTrackPlaying = false;
        queryAll('.step-btn').forEach(b => b.classList.remove('active-step'));
      } else {
        if (sequencer.songMode && sequencer.trackMeasures[0] === null) {
          showToast("EMPTY TRACK", "error");
          return;
        }
        if (sequencer.songMode) {
          sequencer.currentTrackMeasure = 0;
          sequencer.switchPattern(sequencer.trackMeasures[0] || 'A', true);
          sequencer.isTrackPlaying = true;
        }
        sequencer.start();
        if (cloud?.currentTrack?.id) {
          cloud.recordPlay(cloud.currentTrack.id);
        }
        updateTrackUI();
        updatePatternUI();
        syncGlobalKnobs();
      }
      if (elements.playLabel) elements.playLabel.innerText = sequencer.isPlaying ? "STOP" : "START";
      elements.playBtn?.classList.toggle('playing', sequencer.isPlaying);
      updatePlayButtonReady();
    };
  }

  // Transport knobs
  const addKnob = (id: string, label: string, val: number, min: number, max: number, cb: (v: number) => void, disp?: string): { updateValue: (v: number) => void; querySelector: (s: string) => HTMLElement | null } => {
    const k = createKnobElement(label, val, min, max, cb);
    el(id)?.appendChild(k);
    if (disp) {
      const display = k.querySelector('.knob-value-display');
      if (display) display.textContent = disp;
    }
    return k as unknown as { updateValue: (v: number) => void; querySelector: (s: string) => HTMLElement | null };
  };

  elements.knobRefs.bpm = addKnob('bpm-knob-container', 'BPM', sequencer.bpm, 40, 240, v => { sequencer.bpm = v; if (visualizer) visualizer.setBpm(v); });
  elements.knobRefs.steps = addKnob('step-count-knob-container', 'STEPS', [16, 32].indexOf(sequencer.numSteps), 0, 1, i => {
    const v = [16, 32][i];
    if (v === 32 && sequencer.numSteps === 16) sequencer.doublePattern();
    sequencer.numSteps = sequencer.patterns[sequencer.currentPatternId].numSteps = v;
    const display = elements.knobRefs.steps?.querySelector('.knob-value-display');
    if (display) display.textContent = String(v);
    renderSteps();
  }, String(sequencer.numSteps));
  elements.knobRefs.scale = addKnob('scale-knob-container', 'SCALE', 0, 0, 3, i => {
    sequencer.patterns[sequencer.currentPatternId].scale = scales[i].v;
    const display = elements.knobRefs.scale?.querySelector('.knob-value-display');
    if (display) display.textContent = scales[i].l;
  }, '1x');
  elements.knobRefs.shuffle = addKnob('shuffle-knob-container', 'SHUFFLE', 0, 0, 100, v => { sequencer.patterns[sequencer.currentPatternId].shuffle = v; });
  elements.knobRefs.master = addKnob('master-volume-knob-container', 'MASTER', 80, 0, 100, v => { sequencer.masterVolume = v; audioEngine.setMasterVolume(v); });

  // Track inputs
  if (elements.trackNameInput) {
    elements.trackNameInput.oninput = (e): void => { sequencer.trackName = (e.target as HTMLInputElement).value; };
  }
  if (elements.trackDescriptionInput) {
    elements.trackDescriptionInput.oninput = (e): void => { sequencer.trackDescription = (e.target as HTMLTextAreaElement).value; };
  }
  if (elements.trackThumbnailContainer) {
    elements.trackThumbnailContainer.onclick = (): void => {
      openThumbnailModal(sequencer, elements);
    };
  }
  if (elements.trackInfoBtn) {
    elements.trackInfoBtn.onclick = (): void => {
      elements.trackDescriptionPanel?.classList.toggle('hidden');
      elements.trackInfoBtn?.classList.toggle('active');
    };
  }
  if (elements.trackMeasureInput) {
    elements.trackMeasureInput.onchange = (e): void => {
      const v = Math.max(1, Math.min(96, parseInt((e.target as HTMLInputElement).value) || 1));
      sequencer.currentTrackMeasure = v - 1;
      if (!sequencer.isTrackPlaying) {
        const pid = sequencer.trackMeasures[sequencer.currentTrackMeasure];
        if (pid) {
          sequencer.switchPattern(pid, true);
          updatePatternUI();
        }
      }
      updateTrackUI();
    };
  }

  // Banks
  queryAll('.bank-btn').forEach(b => {
    (b as HTMLElement).onclick = (): void => { state.bank = +(b as HTMLElement).dataset.bank!; updateBankUI(); };
  });

  // Pattern selector
  const ids = banks[state.bank];
  const patternSelector = el('pattern-selector');
  if (patternSelector) {
    patternSelector.innerHTML = ids.map(id => `
      <div class="ui-unit">
        <button class="btn-machine btn-square pattern-btn ${id === sequencer.currentPatternId ? 'active' : ''}" data-id="${id}">
          <span class="save-indicator">SAVE</span><span class="chain-indicator">CHAIN</span>
        </button>
        <div class="ui-label">${id}</div>
      </div>`).join('');
  }

  // Instruments
  const insts = Object.keys(audioEngine.manifest?.instruments || {}).filter(k => !['closedToOpen', 'openToClosed'].includes(k));
  if (elements.instButtonGroup) {
    elements.instButtonGroup.innerHTML = insts.map(k => `
      <div class="inst-unit">
        <button class="btn-machine btn-square inst-btn ${k === currentInstrument ? 'active' : ''}" data-inst="${k}"></button>
        <div class="ui-label" style="height:2.4em">${audioEngine.manifest?.instruments[k].displayName}</div>
      </div>`).join('');
  }

  if (elements.instButtonGroup) {
    elements.instButtonGroup.onclick = (e): void => {
      const b = (e.target as HTMLElement).closest('.inst-btn') as HTMLElement | null;
      if (!b) return;
      currentInstrument = b.dataset.inst!;
      if (elements.instName) elements.instName.innerText = audioEngine.manifest?.instruments[currentInstrument].displayName.toUpperCase() || '';
      queryAll('.inst-btn').forEach(btn => btn.classList.toggle('active', (btn as HTMLElement).dataset.inst === currentInstrument));
      renderAll();
    };
  }

  // Pattern selector events
  let chainT: ReturnType<typeof setTimeout> | null = null;
  if (patternSelector) {
    patternSelector.onclick = (e): void => {
      const b = (e.target as HTMLElement).closest('.pattern-btn') as HTMLElement | null;
      if (!b) return;
      const id = b.dataset.id!;
      const curr = sequencer.currentPatternId;
      if (sequencer.trackMode && !sequencer.isTrackPlaying) {
        sequencer.trackMeasures[sequencer.currentTrackMeasure] = id;
        updateTrackUI();
        sequencer.switchPattern(id, true);
        updatePatternUI();
        if (sequencer.currentTrackMeasure < 95) sequencer.currentTrackMeasure++;
        updateAiButtonText(elements, sequencer, aiModes, state);
        updateTrackUI();
        return;
      }
      if (state.clear) {
        sequencer.clearPattern(id);
        if (curr === id) renderSteps();
        updateAiButtonText(elements, sequencer, aiModes, state);
        return;
      }
      if (isShift() && curr !== id) sequencer.copyPattern(curr, id);
      if (chainT) clearTimeout(chainT);
      const inChain = sequencer.patternChain.includes(id);
      sequencer.switchPattern(id, true);
      updatePatternUI();
      if (!inChain && sequencer.patternChain.length) {
        chainT = setTimeout(() => { sequencer.patternChain = []; updatePatternUI(); }, 300);
      }
    };

    patternSelector.ondblclick = (e): void => {
      const b = (e.target as HTMLElement).closest('.pattern-btn') as HTMLElement | null;
      if (!b || isShift()) return;
      if (chainT) clearTimeout(chainT);
      sequencer.togglePatternInChain(b.dataset.id!);
      updatePatternUI();
      updatePlayButtonReady();
    };
  }

  // Control buttons
  if (elements.shiftBtn) {
    elements.shiftBtn.onclick = (): void => { state.shift = !state.shift; updateShiftUI(); };
  }
  if (elements.clearBtn) {
    elements.clearBtn.onclick = (): void => { state.clear = !state.clear; elements.clearBtn?.classList.toggle('active', state.clear); updateShiftUI(); };
  }

  if (elements.trackModeToggle) {
    elements.trackModeToggle.onclick = (): void => {
      if (isShift()) {
        sequencer.trackMeasures.fill(null);
        sequencer.currentTrackMeasure = 0;
        sequencer.trackName = "";
        sequencer.trackDescription = "";
        updateTrackUI();
        return;
      }
      sequencer.trackMode = !sequencer.trackMode;
      el('pattern-selector')?.classList.toggle('track-mode-active', sequencer.trackMode);
      elements.trackModeToggle?.classList.toggle('active', sequencer.trackMode);
      elements.playBtn?.classList.toggle('track-mode', sequencer.trackMode);
      state.aiModeIdx = sequencer.trackMode ? 2 : 0;
      updateAiModeUI();
      updatePatternUI();
    };
  }

  if (elements.songModeToggle) {
    elements.songModeToggle.onclick = (): void => {
      sequencer.songMode = !sequencer.songMode;
      elements.songModeToggle?.classList.toggle('active', sequencer.songMode);
      elements.playBtn?.classList.toggle('song-mode', sequencer.songMode);
      state.aiModeIdx = sequencer.songMode ? 2 : (sequencer.trackMode ? 2 : 0);
      updateAiModeUI();
      updatePlayButtonReady();
    };
  }

  // AI controls
  if (elements.aiModeBtn) {
    elements.aiModeBtn.onclick = (): void => { state.aiModeIdx = (state.aiModeIdx + 1) % 3; updateAiModeUI(); };
  }
  if (elements.walkthroughBtn) {
    elements.walkthroughBtn.onclick = (): void => { state.aiWalkthrough = !state.aiWalkthrough; elements.walkthroughBtn?.classList.toggle('active', state.aiWalkthrough); };
  }

  if (elements.aiPrompt) {
    elements.aiPrompt.oninput = (): void => {
      const val = elements.aiPrompt?.value.toLowerCase() || '';
      if (val.includes('track')) { state.aiModeIdx = 2; updateAiModeUI(); }
      else if (val.includes('chain')) { state.aiModeIdx = 1; updateAiModeUI(); }
      else if (val.includes('pattern')) { state.aiModeIdx = 0; updateAiModeUI(); }
      updateAiButtonText(elements, sequencer, aiModes, state);
    };
  }

  if (elements.aiBtn) {
    elements.aiBtn.onclick = (): void => {
      handleAiGeneration({
        sequencer,
        audioEngine,
        elements,
        state,
        aiModes,
        aiPrompts,
        FX_PAGES,
        banks,
        scales,
        performCommit,
        renderAll,
        renderKnobs,
        renderSteps,
        renderFXControls,
        syncGlobalKnobs,
        updateBankUI,
        updateTrackUI,
        updatePatternUI,
        updateAiModeUI,
        currentInstrument,
        setCurrentInstrument
      });
    };
  }

  // FX pager
  el('fx-prev')?.addEventListener('click', () => { state.fxPage = (state.fxPage - 1 + FX_PAGES.length) % FX_PAGES.length; renderFXControls(); });
  el('fx-next')?.addEventListener('click', () => { state.fxPage = (state.fxPage + 1) % FX_PAGES.length; renderFXControls(); });

  // Keyboard
  window.onkeydown = (e): void => { if (e.key === 'Shift') { state.shiftPressed = true; updateShiftUI(); } };
  window.onkeyup = (e): void => { if (e.key === 'Shift') { state.shiftPressed = false; updateShiftUI(); } };

  // Sequencer callbacks
  sequencer.onPatternChange = (id): void => {
    const target = banks[1].includes(id) ? 1 : 2;
    if (target !== state.bank) { state.bank = target; updateBankUI(); } else updatePatternUI();
    syncGlobalKnobs();
    updateTrackUI();
  };
  sequencer.onTrackUpdate = updateTrackUI;
  sequencer.onInstrumentTrigger = (k, stepIdx): void => {
    const b = document.querySelector(`.inst-btn[data-inst="${k}"]`);
    if (b) { b.classList.add('trigger'); setTimeout(() => b.classList.remove('trigger'), 80); }
    if (k === currentInstrument) {
      const btn = elements.stepButtons[stepIdx];
      if (btn) { btn.classList.add('hit-active'); setTimeout(() => btn.classList.remove('hit-active'), 100); }
    }
    if (visualizer) visualizer.triggerInstrument(k);
  };
  sequencer.onStepChange = (s): void => {
    if (elements.stepDisplay) elements.stepDisplay.innerText = `STEP: ${s + 1}`;
    elements.stepButtons.forEach((b, i) => b.classList.toggle('active-step', i === s));
  };
}

init();
