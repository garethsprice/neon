/**
 * NEON SYNTH 2 - Main Application
 * Built on create-neon-app starter kit
 */

import { AudioEngine } from './audio-engine';
import {
  createKnob,
  showToast,
  createKeyboard,
  createPianoRoll,
  createPatternBank,
  createTrackPanel,
  createThumbnailModal
} from '@neon/ui';
import type { ThumbnailModalComponent } from '@neon/ui/thumbnail-modal';
import type { KnobComponent } from '@neon/ui/knob';
import type { KeyboardComponent } from '@neon/ui/keyboard';
import type { PianoRollComponent } from '@neon/ui/piano-roll';
import type { PatternBankComponent, PatternId } from '@neon/ui/pattern-bank';
import type { TrackPanelComponent } from '@neon/ui/track-panel';
import { Midi } from "@tonejs/midi";
import { runWalkthrough, WalkthroughContext } from './walkthrough';
import { setupCloud, SynthState } from './cloud';
import { createVisualizer, Visualizer } from './visualizer';
import {
  loadAiPrompts,
  getAiPrompts,
  detectGenreFromPrompt,
  detectGenreWithAI,
  generateCreativeBrief,
  buildSystemPrompt,
  buildThumbnailPrompt,
  generateSuggestion as generateAiSuggestion,
  CurrentState
} from './ai-handler';
import { DEFAULT_GENRES } from '@neon/ai';

// Load AI prompts from JSON file
loadAiPrompts();

// WebsimSocket type declaration
declare const WebsimSocket: new () => WebsimSocketInstance;

// Lucide icons declaration
declare global {
  interface Window {
    lucide?: {
      createIcons: () => void;
    };
  }
}

interface Pattern {
  tracks: (number | null | [number, number])[][];
  trackParams: Record<string, unknown>[];
}

/**
 * SYNTH APPLICATION CLASS
 */
class SynthApp {
  engine: AudioEngine;
  walkthroughEnabled: boolean = true;
  knobs: Record<string, KnobComponent> = {};

  // AI Target modes
  aiTargetModes: string[] = ['PATTERN', 'TRACK'];
  aiTargetModeIdx: number = 1;
  abortAiGen: boolean = false;

  // Pattern Bank state
  patterns: Record<string, Pattern> = {};
  currentPatternId: PatternId = 'A';

  // Track metadata
  trackName: string = '';
  trackDescription: string = '';
  thumbnailUrl: string | null = null;
  thumbnailPrompt: string | null = null;
  trackSkill: string | null = null;

  // UI Components
  thumbnailModal!: ThumbnailModalComponent;
  keyboard!: KeyboardComponent;
  pianoRoll!: PianoRollComponent;
  patternBank!: PatternBankComponent;
  trackPanel!: TrackPanelComponent;
  visualizer!: Visualizer;
  cloud?: ReturnType<typeof setupCloud>;

  // DOM Elements
  bpmInput!: HTMLInputElement;
  startBtn!: HTMLElement;
  saveBtn!: HTMLElement;
  loadBtn!: HTMLElement;
  resetBtn!: HTMLElement;
  midiImportBtn!: HTMLElement;
  midiExportBtn!: HTMLElement;
  midiInput!: HTMLInputElement;
  aiPromptInput!: HTMLInputElement;
  aiGenBtn!: HTMLElement;
  aiTargetBtn!: HTMLElement;
  aiWalkthroughBtn!: HTMLElement;
  aiCopilot!: HTMLElement;
  rootKeySelect!: HTMLSelectElement;
  octaveSelect!: HTMLSelectElement;
  keyboardSizeSelect!: HTMLSelectElement;
  communityToggleBtn!: HTMLElement;
  closeCommunityBtn!: HTMLElement;
  communitySidebar!: HTMLElement;
  feedFilterAll!: HTMLElement;
  feedFilterMine!: HTMLElement;
  statusText!: HTMLElement;
  stepDisplay!: HTMLElement;
  toastContainer!: HTMLElement;
  visualizerCanvas!: HTMLCanvasElement;

  // Visualizer note state
  visualizerNoteHeld: boolean = false;
  visualizerNoteKeyIndex: number | null = null;
  keyboardExpanded: boolean = false;

  // FX Pagination
  fxPage: number = 0;
  static readonly FX_PAGES = [
    ['lpFilter', 'hpFilter', 'saturation', 'distortion', 'bitcrusher'],
    ['phaser', 'flanger', 'pan', 'delay', 'reverb'],
    ['spatial3d']
  ];

  constructor() {
    this.engine = new AudioEngine();
    this.initializeEmptyPatterns();
    this.initUI();
    this.initVisualizer();
  }

  /**
   * PATTERN INITIALIZATION
   */
  initializeEmptyPatterns(): void {
    const patternIds = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];
    patternIds.forEach(id => {
      this.patterns[id] = this.createEmptyTrack();
    });
  }

  createEmptyTrack(): Pattern {
    return {
      tracks: [[], [], [], []],
      trackParams: [{}, {}, {}, {}]
    };
  }

  /**
   * UI INITIALIZATION
   */
  initUI(): void {
    // DOM Elements
    this.bpmInput = document.getElementById('bpm-input') as HTMLInputElement;
    this.startBtn = document.getElementById('start-btn')!;
    this.saveBtn = document.getElementById('save-btn')!;
    this.loadBtn = document.getElementById('load-btn')!;
    this.resetBtn = document.getElementById('reset-btn')!;
    this.midiImportBtn = document.getElementById('midi-import-btn')!;
    this.midiExportBtn = document.getElementById('midi-export-btn')!;
    this.midiInput = document.getElementById('midi-input') as HTMLInputElement;
    this.aiPromptInput = document.getElementById('ai-prompt') as HTMLInputElement;
    this.aiGenBtn = document.getElementById('ai-gen-btn')!;
    this.aiTargetBtn = document.getElementById('ai-target-btn')!;
    this.aiWalkthroughBtn = document.getElementById('ai-walkthrough-btn')!;
    this.aiCopilot = document.getElementById('ai-copilot')!;
    this.rootKeySelect = document.getElementById('root-key-select') as HTMLSelectElement;
    this.octaveSelect = document.getElementById('octave-select') as HTMLSelectElement;
    this.keyboardSizeSelect = document.getElementById('keyboard-size-select') as HTMLSelectElement;
    this.communityToggleBtn = document.getElementById('community-toggle-btn')!;
    this.closeCommunityBtn = document.getElementById('close-community-btn')!;
    this.communitySidebar = document.getElementById('community-sidebar')!;
    this.feedFilterAll = document.getElementById('feed-filter-all')!;
    this.feedFilterMine = document.getElementById('feed-filter-mine')!;
    this.statusText = document.getElementById('status-text')!;
    this.stepDisplay = document.getElementById('step-display')!;
    this.toastContainer = document.getElementById('toast-container')!;
    this.visualizerCanvas = document.getElementById('visualizer') as HTMLCanvasElement;

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
    const resumeAudio = (): void => { this.engine.resume(); };
    window.addEventListener('touchstart', resumeAudio, { once: true });
    window.addEventListener('mousedown', resumeAudio, { once: true });

    // Initialize Lucide icons
    if (window.lucide) window.lucide.createIcons();

    this.setStatus('SYSTEM ONLINE');
  }

  /**
   * CLOUD INITIALIZATION
   */
  initCloud(): void {
    try {
      const room = new WebsimSocket();
      this.cloud = setupCloud(room, {
        getState: () => this.getCurrentState('ALL') as SynthState,
        setState: (state: Partial<SynthState>) => this.applyState(state as Record<string, unknown>, 'ALL'),
        renderAll: () => this.refreshUIForTrack(this.getSelectedTrack()),
        visibility: 'public'
      });
    } catch (e) {
      console.warn('Cloud features unavailable:', (e as Error).message);
    }
  }

  /**
   * PATTERN BANK INITIALIZATION
   */
  initPatternBank(): void {
    const patternBankContainer = document.getElementById('pattern-bank-container');
    if (!patternBankContainer) return;

    this.patternBank = createPatternBank({
      numSlots: 8,
      activeColor: 'cyan',
      label: 'TRACKS',
      onSelect: (id) => this.switchTrack(id),
      onCopy: (fromId, toId) => this.copyTrack(fromId, toId),
      onClear: (id) => this.clearTrack(id)
    });

    patternBankContainer.appendChild(this.patternBank.element);
    this.updateTrackIndicators();
  }

  /**
   * TRACK PANEL INITIALIZATION
   */
  initTrackPanel(): void {
    const trackPanelContainer = document.getElementById('track-panel-container');
    if (!trackPanelContainer) return;

    this.trackPanel = createTrackPanel({
      title: this.trackName,
      description: this.trackDescription,
      thumbnailUrl: this.thumbnailUrl,
      compact: false,
      titlePlaceholder: 'TRACK TITLE',
      descriptionPlaceholder: 'Add a description...',
      onTitleChange: (title: string) => {
        this.trackName = title;
      },
      onDescriptionChange: (desc: string) => {
        this.trackDescription = desc;
      },
      onThumbnailClick: () => this.openThumbnailModal()
    });

    trackPanelContainer.appendChild(this.trackPanel.element);

    // Create thumbnail modal
    this.thumbnailModal = createThumbnailModal({
      thumbnailUrl: this.thumbnailUrl,
      prompt: this.thumbnailPrompt || '',
      generateThumbnail: async (prompt: string) => {
        const result = await websim.imageGen({
          prompt,
          aspect_ratio: '1:1'
        });
        return result.url;
      },
      onSave: (url, prompt) => {
        this.thumbnailUrl = url;
        this.thumbnailPrompt = prompt;
        this.trackPanel.setThumbnail(url);
      },
      showToast
    });
  }

  /**
   * PATTERN METHODS
   */
  saveCurrentTrack(id: string): void {
    this.patterns[id] = {
      tracks: this.pianoRoll.getTracksAsTracker(),
      trackParams: JSON.parse(JSON.stringify(this.engine.trackParams))
    };
    this.updateTrackIndicators();
  }

  loadPattern(id: string): void {
    const pattern = this.patterns[id];
    if (!pattern) return;

    // Apply synth parameters
    if (pattern.trackParams) {
      for (const [idx, params] of Object.entries(pattern.trackParams)) {
        const tIdx = parseInt(idx);
        for (const [key, val] of Object.entries(params as Record<string, unknown>)) {
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

  switchTrack(id: PatternId): void {
    if (id === this.currentPatternId) return;

    // Save current pattern before switching
    this.saveCurrentTrack(this.currentPatternId);

    // Load new pattern
    this.currentPatternId = id;
    this.loadPattern(id);

    showToast(`PATTERN ${id}`, 'info');
  }

  copyTrack(fromId: PatternId, toId: PatternId): void {
    this.saveCurrentTrack(this.currentPatternId);
    this.patterns[toId] = JSON.parse(JSON.stringify(this.patterns[fromId]));
    this.updateTrackIndicators();
    showToast(`COPIED ${fromId} -> ${toId}`, 'success');
  }

  clearTrack(id: PatternId): void {
    this.patterns[id] = this.createEmptyTrack();
    this.updateTrackIndicators();

    if (id === this.currentPatternId) {
      this.pianoRoll.clearAll();
      this.pianoRoll.setSteps(16);
    }

    showToast(`CLEARED PATTERN ${id}`, 'info');
  }

  updateTrackIndicators(): void {
    if (!this.patternBank) return;

    const patternIds = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'] as const;
    patternIds.forEach(id => {
      const pattern = this.patterns[id];
      const hasData = pattern && pattern.tracks &&
        pattern.tracks.some(track => track && track.some(note => note !== null));
      this.patternBank?.setPatternHasData(id, hasData);
    });
  }

  /**
   * THUMBNAIL GENERATION
   */
  /**
   * Open the thumbnail modal for viewing/editing
   */
  openThumbnailModal(): void {
    // Build current prompt if not set
    let prompt = this.thumbnailPrompt || '';
    if (!prompt) {
      prompt = buildThumbnailPrompt({
        title: this.trackName || 'Untitled Track',
        description: this.trackDescription || '',
        aiPromptText: this.aiPromptInput?.value?.trim() || '',
        skill: this.trackSkill
      });
    }

    this.thumbnailModal.setThumbnail(this.thumbnailUrl, prompt);
    this.thumbnailModal.open();
  }

  /**
   * Generate thumbnail silently (used after AI generation)
   */
  async generateThumbnail(): Promise<void> {
    if (!this.trackPanel) return;

    const prompt = buildThumbnailPrompt({
      title: this.trackName || 'Untitled Track',
      description: this.trackDescription || '',
      aiPromptText: this.aiPromptInput?.value?.trim() || '',
      skill: this.trackSkill
    });

    this.trackPanel.setThumbnailLoading(true);
    showToast('Creating album artwork...', 'ai');

    try {
      const result = await websim.imageGen({
        prompt,
        aspect_ratio: '1:1'
      });

      this.thumbnailUrl = result.url;
      this.thumbnailPrompt = prompt;
      this.trackPanel.setThumbnail(result.url);
      showToast('Album art generated!', 'ai');
    } catch (err) {
      console.error('Thumbnail generation failed:', err);
      this.trackPanel.setThumbnailLoading(false);
      showToast('Artwork generation failed', 'error');
    }
  }

  /**
   * SUGGESTION GENERATION
   */
  generateSuggestion(targetMode: string = 'PATTERN'): void {
    setTimeout(async () => {
      try {
        const currentState = this.getCurrentState(targetMode);
        const suggestion = await generateAiSuggestion(currentState);
        if (suggestion) {
          this.aiPromptInput.value = suggestion;
          this.updateAiButtonText();
        }
      } catch {
        // Silently ignore suggestion errors
      }
    }, 2000);
  }

  /**
   * KNOB INITIALIZATION (static knobs only)
   */
  initKnobs(): void {
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
      onChange: (val: number) => this.engine.updateParam('masterVolume', val / 100)
    });
    masterVolumeContainer?.appendChild(masterKnob.element);
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
      onChange: (val: number) => this.updateParamWithRetrigger('detune', val, this.getSelectedTrack()),
      formatValue: (v: number) => (v > 0 ? '+' : '') + Math.round(v)
    });
    document.getElementById('detune-knob')?.appendChild(detuneKnob.element);
    this.knobs.detune = detuneKnob;

    // Envelope - Attack
    const attackKnob = createKnob({
      label: 'ATTACK',
      value: 0.1,
      min: 0.01,
      max: 2,
      step: 0.01,
      color: 'green',
      size: 'small',
      onChange: (val: number) => this.updateParamWithRetrigger('attack', val, this.getSelectedTrack())
    });
    document.getElementById('attack-knob')?.appendChild(attackKnob.element);
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
      onChange: (val: number) => this.updateParamWithRetrigger('decay', val, this.getSelectedTrack())
    });
    document.getElementById('decay-knob')?.appendChild(decayKnob.element);
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
      onChange: (val: number) => this.updateParamWithRetrigger('sustain', val, this.getSelectedTrack())
    });
    document.getElementById('sustain-knob')?.appendChild(sustainKnob.element);
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
      onChange: (val: number) => this.updateParamWithRetrigger('release', val, this.getSelectedTrack())
    });
    document.getElementById('release-knob')?.appendChild(releaseKnob.element);
    this.knobs.release = releaseKnob;

    // Render paginated FX controls
    this.renderFXControls();
  }

  /**
   * FX CONTROL DEFINITIONS
   */
  getFXControlDefs(): Record<string, { name: string; controls: Array<{ id: string; label: string; param: string; min: number; max: number; step: number; value: number; color: string; format?: (v: number) => string; onChange?: (val: number) => void }> }> {
    return {
      lpFilter: {
        name: 'LP FILTER',
        controls: [
          { id: 'cutoff', label: 'CUTOFF', param: 'filterCutoff', min: 20, max: 15000, step: 1, value: 2000, color: 'cyan', format: (v) => String(Math.round(v)) },
          { id: 'reso', label: 'RESO', param: 'filterReso', min: 0, max: 20, step: 0.1, value: 1, color: 'cyan' }
        ]
      },
      hpFilter: {
        name: 'HP FILTER',
        controls: [
          { id: 'hpCutoff', label: 'CUTOFF', param: 'hpFilterCutoff', min: 20, max: 2000, step: 1, value: 20, color: 'cyan', format: (v) => String(Math.round(v)) },
          { id: 'hpReso', label: 'RESO', param: 'hpFilterReso', min: 0, max: 20, step: 0.1, value: 0, color: 'cyan' }
        ]
      },
      saturation: {
        name: 'SATURATE',
        controls: [
          { id: 'satDrive', label: 'DRIVE', param: 'saturationDrive', min: 0, max: 100, step: 1, value: 0, color: 'orange' }
        ]
      },
      distortion: {
        name: 'DISTORT',
        controls: [
          { id: 'distDrive', label: 'DRIVE', param: 'distortionDrive', min: 0, max: 100, step: 1, value: 0, color: 'orange',
            onChange: (val) => {
              this.engine.updateParam('distortionDrive', val, this.getSelectedTrack());
              this.engine.updateParam('distortionEnabled', val > 0, this.getSelectedTrack());
            }
          },
          { id: 'distTone', label: 'TONE', param: 'distortionTone', min: 0, max: 100, step: 1, value: 50, color: 'orange' }
        ]
      },
      bitcrusher: {
        name: 'CRUSH',
        controls: [
          { id: 'bits', label: 'BITS', param: 'bitcrusherBits', min: 1, max: 16, step: 1, value: 16, color: 'red', format: (v) => String(Math.round(v)),
            onChange: (val) => {
              this.engine.updateParam('bitcrusherBits', val, this.getSelectedTrack());
              this.engine.updateParam('bitcrusherEnabled', val < 16, this.getSelectedTrack());
            }
          },
          { id: 'downsample', label: 'CRUSH', param: 'bitcrusherDownsample', min: 1, max: 50, step: 1, value: 1, color: 'red', format: (v) => String(Math.round(v)),
            onChange: (val) => {
              this.engine.updateParam('bitcrusherDownsample', val, this.getSelectedTrack());
              this.engine.updateParam('bitcrusherEnabled', val > 1, this.getSelectedTrack());
            }
          }
        ]
      },
      pan: {
        name: 'PAN',
        controls: [
          { id: 'pan', label: 'PAN', param: 'panPosition', min: 0, max: 100, step: 1, value: 50, color: 'yellow',
            format: (v) => v < 50 ? `L${50 - v}` : v > 50 ? `R${v - 50}` : 'C',
            onChange: (val) => {
              this.engine.updateParam('panPosition', val, this.getSelectedTrack());
              this.engine.updateParam('panEnabled', val !== 50, this.getSelectedTrack());
            }
          }
        ]
      },
      delay: {
        name: 'DELAY',
        controls: [
          { id: 'delayMix', label: 'MIX', param: 'delayMix', min: 0, max: 0.8, step: 0.01, value: 0.2, color: 'purple' },
          { id: 'delayTime', label: 'TIME', param: 'delayTime', min: 0.05, max: 1, step: 0.01, value: 0.3, color: 'purple' }
        ]
      },
      reverb: {
        name: 'REVERB',
        controls: [
          { id: 'reverbMix', label: 'MIX', param: 'reverbMix', min: 0, max: 1, step: 0.01, value: 0.3, color: 'purple' }
        ]
      },
      phaser: {
        name: 'PHASER',
        controls: [
          { id: 'phaserRate', label: 'RATE', param: 'phaserRate', min: 0.01, max: 10, step: 0.01, value: 0.5, color: 'magenta',
            onChange: (val) => {
              this.engine.updateParam('phaserRate', val, this.getSelectedTrack());
              this.engine.updateParam('phaserEnabled', true, this.getSelectedTrack());
            }
          },
          { id: 'phaserDepth', label: 'DEPTH', param: 'phaserDepth', min: 0, max: 100, step: 1, value: 70, color: 'magenta',
            onChange: (val) => {
              this.engine.updateParam('phaserDepth', val, this.getSelectedTrack());
              this.engine.updateParam('phaserEnabled', val > 0, this.getSelectedTrack());
            }
          },
          { id: 'phaserMix', label: 'MIX', param: 'phaserMix', min: 0, max: 100, step: 1, value: 50, color: 'magenta' }
        ]
      },
      flanger: {
        name: 'FLANGER',
        controls: [
          { id: 'flangerRate', label: 'RATE', param: 'flangerRate', min: 0.01, max: 10, step: 0.01, value: 0.3, color: 'magenta',
            onChange: (val) => {
              this.engine.updateParam('flangerRate', val, this.getSelectedTrack());
              this.engine.updateParam('flangerEnabled', true, this.getSelectedTrack());
            }
          },
          { id: 'flangerDepth', label: 'DEPTH', param: 'flangerDepth', min: 0, max: 100, step: 1, value: 70, color: 'magenta',
            onChange: (val) => {
              this.engine.updateParam('flangerDepth', val, this.getSelectedTrack());
              this.engine.updateParam('flangerEnabled', val > 0, this.getSelectedTrack());
            }
          },
          { id: 'flangerMix', label: 'MIX', param: 'flangerMix', min: 0, max: 100, step: 1, value: 50, color: 'magenta' }
        ]
      },
      spatial3d: {
        name: '3D SPATIAL',
        controls: [
          { id: 'spatialX', label: 'X', param: 'spatialX', min: -100, max: 100, step: 1, value: 0, color: 'green',
            format: (v) => v < 0 ? `L${Math.abs(v)}` : v > 0 ? `R${v}` : 'C',
            onChange: (val) => {
              this.engine.updateParam('spatialX', val, this.getSelectedTrack());
              this.engine.updateParam('spatialEnabled', true, this.getSelectedTrack());
            }
          },
          { id: 'spatialY', label: 'Y', param: 'spatialY', min: -100, max: 100, step: 1, value: 0, color: 'green',
            format: (v) => v < 0 ? `D${Math.abs(v)}` : v > 0 ? `U${v}` : 'C',
            onChange: (val) => {
              this.engine.updateParam('spatialY', val, this.getSelectedTrack());
              this.engine.updateParam('spatialEnabled', true, this.getSelectedTrack());
            }
          },
          { id: 'spatialZ', label: 'Z', param: 'spatialZ', min: -100, max: 100, step: 1, value: 0, color: 'green',
            format: (v) => v < 0 ? `B${Math.abs(v)}` : v > 0 ? `F${v}` : 'C',
            onChange: (val) => {
              this.engine.updateParam('spatialZ', val, this.getSelectedTrack());
              this.engine.updateParam('spatialEnabled', true, this.getSelectedTrack());
            }
          }
        ]
      }
    };
  }

  /**
   * RENDER FX CONTROLS (paginated)
   */
  renderFXControls(): void {
    const container = document.getElementById('fx-controls-container');
    if (!container) return;

    // Clear container
    container.innerHTML = '';

    // Update page info
    const pageInfo = document.getElementById('fx-page-info');
    if (pageInfo) pageInfo.textContent = `${this.fxPage + 1} / ${SynthApp.FX_PAGES.length}`;

    // Get current page FX modules
    const activeModules = SynthApp.FX_PAGES[this.fxPage];
    const fxDefs = this.getFXControlDefs();
    const params = this.engine.getParams(this.getSelectedTrack());

    for (const fxKey of activeModules) {
      const def = fxDefs[fxKey];
      if (!def) continue;

      // Create FX module element
      const moduleEl = document.createElement('div');
      moduleEl.className = 'fx-module';
      moduleEl.innerHTML = `
        <div class="fx-module-header">
          <span class="fx-module-name">${def.name}</span>
        </div>
        <div class="fx-controls"></div>
      `;

      const controlsEl = moduleEl.querySelector('.fx-controls')!;

      // Create knobs for this module
      for (const ctrl of def.controls) {
        const knobContainer = document.createElement('div');
        knobContainer.className = 'knob-slot';

        // Get current value from params
        const currentValue = (params as Record<string, unknown>)[ctrl.param] as number ?? ctrl.value;

        const knob = createKnob({
          label: ctrl.label,
          value: currentValue,
          min: ctrl.min,
          max: ctrl.max,
          step: ctrl.step,
          color: ctrl.color as 'cyan' | 'magenta' | 'yellow' | 'green' | 'orange' | 'purple' | 'red',
          size: 'small',
          onChange: ctrl.onChange || ((val: number) => this.engine.updateParam(ctrl.param, val, this.getSelectedTrack())),
          formatValue: ctrl.format
        });

        knobContainer.appendChild(knob.element);
        controlsEl.appendChild(knobContainer);

        // Store knob reference
        this.knobs[ctrl.param] = knob;
      }

      container.appendChild(moduleEl);
    }
  }

  /**
   * KEYBOARD INITIALIZATION
   */
  initKeyboard(): void {
    const keyboardEl = document.getElementById('keyboard');

    this.keyboard = createKeyboard({
      numKeys: 12,
      rootNote: 0,
      octave: 3,
      showLabels: true,
      onNoteOn: (keyIndex: number, freq: number) => {
        this.engine.resume();
        this.engine.noteOn(keyIndex, freq, this.getSelectedTrack());
        this.pianoRoll?.highlightNoteLabel(keyIndex, true);
      },
      onNoteOff: (keyIndex: number) => {
        this.engine.noteOff(keyIndex, this.getSelectedTrack());
        this.pianoRoll?.highlightNoteLabel(keyIndex, false);
      }
    });
    keyboardEl?.appendChild(this.keyboard.element);

    // Helper method for sequencer compatibility
    (this.keyboard as unknown as { getFreq: (keyIndex: number) => number }).getFreq = (keyIndex: number) => this.keyboard.getFrequency(keyIndex);
  }

  setKeyboardSize(numKeys: number): void {
    if (this.keyboard && this.keyboard.destroy) {
      this.keyboard.destroy();
    }

    const keyboardEl = document.getElementById('keyboard');
    if (keyboardEl) keyboardEl.innerHTML = '';

    let newRootNote: number;
    let newOctave: number;
    if (numKeys > 24) {
      newRootNote = 9;
      newOctave = 0;
      this.keyboardExpanded = true;
    } else {
      newRootNote = parseInt(this.rootKeySelect?.value || '0');
      newOctave = parseInt(this.octaveSelect?.value || '3');
      this.keyboardExpanded = false;
    }

    this.keyboard = createKeyboard({
      numKeys: numKeys,
      rootNote: newRootNote,
      octave: newOctave,
      showLabels: true,
      onNoteOn: (keyIndex: number, freq: number) => {
        this.engine.resume();
        this.engine.noteOn(keyIndex, freq, this.getSelectedTrack());
        this.pianoRoll?.highlightNoteLabel(keyIndex, true);
      },
      onNoteOff: (keyIndex: number) => {
        this.engine.noteOff(keyIndex, this.getSelectedTrack());
        this.pianoRoll?.highlightNoteLabel(keyIndex, false);
      }
    });
    keyboardEl?.appendChild(this.keyboard.element);
    (this.keyboard as unknown as { getFreq: (keyIndex: number) => number }).getFreq = (keyIndex: number) => this.keyboard.getFrequency(keyIndex);

    if (this.pianoRoll) {
      this.pianoRoll.setNumKeys(numKeys);
      this.pianoRoll.setRange(newRootNote, newOctave);
    }

    if (this.rootKeySelect) {
      this.rootKeySelect.disabled = numKeys > 24;
    }
    if (this.octaveSelect) {
      this.octaveSelect.disabled = numKeys > 24;
    }

    this.initScrollSync();
  }

  updateKeyboardRange(): void {
    const numKeys = parseInt(this.keyboardSizeSelect?.value || '12');
    if (numKeys <= 24) {
      const rootNote = parseInt(this.rootKeySelect.value);
      const octave = parseInt(this.octaveSelect.value);
      this.keyboard.setRange(rootNote, octave);
      if (this.pianoRoll) {
        this.pianoRoll.setRange(rootNote, octave);
      }
    }
  }

  /**
   * PIANO ROLL INITIALIZATION
   */
  initPianoRoll(): void {
    const pianoRollContainer = document.getElementById('piano-roll-container');

    this.pianoRoll = createPianoRoll({
      label: 'PIANO ROLL',
      steps: 16,
      numKeys: 12,
      rootNote: parseInt(this.rootKeySelect?.value || '0'),
      octave: parseInt(this.octaveSelect?.value || '3'),
      maxTracks: 4,
      bpm: 120,
      vertical: true,
      loop: true,
      showTrackTabs: false,
      showStepNumbers: false,
      fallingMode: true,
      onTrackSelect: (trackIdx: number) => {
        this.refreshUIForTrack(trackIdx);
      },
      onPlay: (stepIndex: number, notes: Array<{ trackIdx: number; noteIdx: number; freq: number | null; duration: number }>) => {
        this.setStep(stepIndex + 1);
        const bpm = this.pianoRoll.bpm || 120;
        const stepDurationSeconds = 60 / bpm / 4;
        notes.forEach(({ trackIdx, noteIdx, freq, duration }) => {
          const frequency = freq || this.keyboard.getFrequency(noteIdx);
          const noteDuration = stepDurationSeconds * duration;
          this.engine.triggerNote(trackIdx, noteIdx, frequency, noteDuration);
        });
      },
      onPlayStateChange: (isPlaying: boolean) => {
        this.startBtn.classList.toggle('playing', isPlaying);
        this.setStatus(isPlaying ? 'PLAYING' : 'STOPPED');
        if (isPlaying) {
          this.engine.resume();
        }
      },
      onKeyHighlight: (keyIndex: number, active: boolean) => {
        if (this.keyboard && this.keyboard.setKeyVisualState) {
          this.keyboard.setKeyVisualState(keyIndex, active);
        }
      },
      getFrequency: (noteIndex: number) => this.keyboard.getFrequency(noteIndex)
    });

    pianoRollContainer?.appendChild(this.pianoRoll.element);
    this.initScrollSync();
  }

  /**
   * SCROLL SYNC (Keyboard <-> Piano Roll)
   */
  initScrollSync(): void {
    let syncing = false;

    const keyboardScroll = this.keyboard?.scrollContainer;
    const pianoRollLabels = this.pianoRoll?.getNoteLabelsElement();
    const pianoRollScroll = this.pianoRoll?.scrollArea;

    if (!keyboardScroll) return;

    keyboardScroll.addEventListener('scroll', () => {
      if (syncing) return;
      syncing = true;
      const scrollLeft = keyboardScroll.scrollLeft;
      if (pianoRollLabels) pianoRollLabels.scrollLeft = scrollLeft;
      if (pianoRollScroll) pianoRollScroll.scrollLeft = scrollLeft;
      requestAnimationFrame(() => { syncing = false; });
    });

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

  /**
   * EVENT LISTENERS
   */
  initEventListeners(): void {
    // Transport
    this.startBtn.addEventListener('click', () => this.togglePlayback());

    // BPM
    this.bpmInput.addEventListener('input', (e) => {
      const val = parseFloat((e.target as HTMLInputElement).value);
      if (!isNaN(val)) {
        this.engine.updateParam('bpm', val);
        if (this.pianoRoll) this.pianoRoll.setBPM(val);
      }
    });

    // Reset
    this.resetBtn.addEventListener('click', () => this.reset());

    // MIDI
    this.midiImportBtn.addEventListener('click', () => this.midiInput.click());
    this.midiExportBtn.addEventListener('click', () => this.saveMidi());
    this.midiInput.addEventListener('change', (e) => this.loadMidi(e));

    // Wave buttons
    document.querySelectorAll('.wave-btn').forEach(btn => {
      btn.addEventListener('click', () => this.setWaveType((btn as HTMLElement).dataset.wave!));
    });

    // Keyboard controls
    this.keyboardSizeSelect.addEventListener('change', (e) => {
      this.setKeyboardSize(parseInt((e.target as HTMLSelectElement).value));
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
      const modeDesc = mode === 'TRACK' ? 'entire song (all synths)' : 'current track only';
      showToast(`Target: ${modeDesc}`, 'info');
    });

    // Visualizer click
    this.visualizerCanvas.style.cursor = 'pointer';
    this.visualizerCanvas.addEventListener('click', () => this.playVisualizerNote());
    this.visualizerCanvas.addEventListener('dblclick', () => this.toggleVisualizerNote());

    // FX pagination
    document.getElementById('fx-prev')?.addEventListener('click', () => {
      this.fxPage = (this.fxPage - 1 + SynthApp.FX_PAGES.length) % SynthApp.FX_PAGES.length;
      this.renderFXControls();
    });
    document.getElementById('fx-next')?.addEventListener('click', () => {
      this.fxPage = (this.fxPage + 1) % SynthApp.FX_PAGES.length;
      this.renderFXControls();
    });
  }

  getCKeyIndex(): number {
    if (this.keyboardExpanded) {
      return 39;
    } else {
      const rootNote = parseInt(this.rootKeySelect?.value || '0');
      return (12 - rootNote) % 12;
    }
  }

  playVisualizerNote(): void {
    if (this.visualizerNoteHeld) return;

    this.engine.resume();
    const cKeyIndex = this.getCKeyIndex();
    const freq = this.keyboard.getFrequency(cKeyIndex);
    const track = this.getSelectedTrack();

    this.keyboard.setKeyVisualState(cKeyIndex, true);
    this.engine.noteOn(cKeyIndex, freq, track);

    setTimeout(() => {
      if (!this.visualizerNoteHeld) {
        this.engine.noteOff(cKeyIndex, track);
        this.keyboard.setKeyVisualState(cKeyIndex, false);
      }
    }, 200);
  }

  toggleVisualizerNote(): void {
    this.engine.resume();
    const cKeyIndex = this.getCKeyIndex();
    const freq = this.keyboard.getFrequency(cKeyIndex);
    const track = this.getSelectedTrack();

    if (this.visualizerNoteHeld) {
      this.visualizerNoteHeld = false;
      this.engine.noteOff(this.visualizerNoteKeyIndex!, track);
      this.keyboard.setKeyVisualState(this.visualizerNoteKeyIndex!, false);
      this.visualizerNoteKeyIndex = null;
      this.visualizerCanvas.classList.remove('note-held');
    } else {
      this.visualizerNoteHeld = true;
      this.visualizerNoteKeyIndex = cKeyIndex;
      this.keyboard.setKeyVisualState(cKeyIndex, true);
      this.engine.noteOn(cKeyIndex, freq, track);
      this.visualizerCanvas.classList.add('note-held');
    }
  }

  /**
   * HELPERS
   */
  getSelectedTrack(): number {
    return this.pianoRoll?.selectedTrackIdx || 0;
  }

  setStatus(message: string): void {
    this.statusText.textContent = message;
  }

  setStep(step: number): void {
    this.stepDisplay.textContent = `STEP: ${step}`;
  }

  /**
   * PLAYBACK
   */
  togglePlayback(): void {
    this.pianoRoll.toggle();
  }

  /**
   * WAVE TYPE
   */
  setWaveType(type: string): void {
    document.querySelectorAll('.wave-btn').forEach(b => {
      b.classList.toggle('active', (b as HTMLElement).dataset.wave === type);
    });
    this.engine.updateParam('waveType', type, this.getSelectedTrack());
    this.engine.resume();
    this.retriggerStuckNotes();
  }

  /**
   * RETRIGGER STUCK NOTES
   */
  retriggerStuckNotes(): void {
    if (!this.keyboard) return;
    const track = this.getSelectedTrack();

    const stuckKeys = this.keyboard.getStuckKeys();
    stuckKeys.forEach((keyIndex: number) => {
      const freq = this.keyboard.getFrequency(keyIndex);
      this.engine.noteOff(keyIndex, track);
      this.engine.noteOn(keyIndex, freq, track);
    });

    if (this.visualizerNoteHeld && this.visualizerNoteKeyIndex !== null) {
      const freq = this.keyboard.getFrequency(this.visualizerNoteKeyIndex);
      this.engine.noteOff(this.visualizerNoteKeyIndex, track);
      this.engine.noteOn(this.visualizerNoteKeyIndex, freq, track);
    }
  }

  updateParamWithRetrigger(param: string, value: unknown, track: number): void {
    this.engine.updateParam(param, value, track);
    this.retriggerStuckNotes();
  }

  /**
   * UI REFRESH FOR TRACK
   */
  refreshUIForTrack(trackIdx: number): void {
    const params = this.engine.getParams(trackIdx);

    // Update wave buttons
    document.querySelectorAll('.wave-btn').forEach(b => {
      b.classList.toggle('active', (b as HTMLElement).dataset.wave === params.waveType);
    });

    // Update static knobs (non-FX)
    const staticKnobs = ['masterVolume', 'detune', 'attack', 'decay', 'sustain', 'release'];
    for (const key of staticKnobs) {
      if (this.knobs[key]) {
        const val = (params as Record<string, unknown>)[key] as number;
        if (val !== undefined) this.knobs[key].setValue(val);
      }
    }

    // Re-render FX controls with current track values
    this.renderFXControls();
  }

  /**
   * RESET
   */
  reset(): void {
    if (this.pianoRoll && this.pianoRoll.isPlaying) {
      this.pianoRoll.toggle();
    }

    const defaults: Record<string, unknown> = {
      masterVolume: 50,
      detune: 0,
      filterCutoff: 2000,
      filterReso: 1,
      hpFilterCutoff: 20,
      hpFilterReso: 0,
      attack: 0.1,
      decay: 0.2,
      sustain: 0.5,
      release: 0.5,
      saturationDrive: 0,
      distortionDrive: 0,
      distortionTone: 50,
      bitcrusherBits: 16,
      bitcrusherDownsample: 1,
      panPosition: 50,
      phaserRate: 0.5,
      phaserDepth: 70,
      phaserMix: 50,
      flangerRate: 0.3,
      flangerDepth: 70,
      flangerMix: 50,
      spatialX: 0,
      spatialY: 0,
      spatialZ: 0,
      delayMix: 0.2,
      delayTime: 0.3,
      reverbMix: 0.3,
      waveType: 'sawtooth',
      bpm: 120,
      steps: 16,
      rootKey: 0,
      rootOctave: 3
    };

    for (const [key, val] of Object.entries(defaults)) {
      if (this.knobs[key]) {
        this.knobs[key].setValue(val as number);
        this.engine.updateParam(key, val);
      } else if (key === 'waveType') {
        this.setWaveType(val as string);
      } else if (key === 'bpm') {
        this.bpmInput.value = String(val);
        this.engine.updateParam(key, val);
        if (this.pianoRoll) this.pianoRoll.setBPM(val as number);
      }
    }

    if (this.pianoRoll) {
      this.pianoRoll.setSteps(defaults.steps as number);
      this.pianoRoll.clearAll();
    }

    this.keyboardSizeSelect.value = '12';
    this.rootKeySelect.value = String(defaults.rootKey);
    this.rootKeySelect.disabled = false;
    this.octaveSelect.value = String(defaults.rootOctave);
    this.octaveSelect.disabled = false;
    this.setKeyboardSize(12);

    this.initializeEmptyPatterns();
    this.currentPatternId = 'A';
    if (this.patternBank) {
      this.patternBank.setActivePattern('A');
      this.updateTrackIndicators();
    }

    this.trackName = '';
    this.trackDescription = '';
    this.thumbnailUrl = null;
    this.thumbnailPrompt = null;
    this.trackSkill = null;
    if (this.trackPanel) {
      this.trackPanel.setTitle('');
      this.trackPanel.setDescription('');
      this.trackPanel.setThumbnail(null);
    }

    this.startBtn.classList.remove('playing');
    this.setStatus('SYNTH RESET');

    showToast('SYNTH RESET', 'info');
  }

  /**
   * AI COPILOT
   */
  updateAiButtonText(): void {
    const hasPrompt = this.aiPromptInput.value.trim().length > 0;

    if (hasPrompt) {
      this.aiGenBtn.innerText = "AI GEN";
      this.aiGenBtn.classList.remove('demo-attract');
    } else {
      this.aiGenBtn.innerText = "DEMO";
      this.aiGenBtn.classList.add('demo-attract');
    }
  }

  async runDemoMode(): Promise<void> {
    showToast('Loading demo track...', 'ai');

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

    await this.applyState(demoState, 'ALL');
    showToast('Demo track loaded - hit play!', 'ai');
  }

  async handleAIRequest(): Promise<void> {
    const prompt = this.aiPromptInput.value.trim();
    const isDemo = !prompt;

    this.aiCopilot.classList.add('ai-loading');
    (this.aiGenBtn as HTMLButtonElement).disabled = true;
    this.setStatus('AI COMPOSING...');

    try {
      if (isDemo) {
        await this.runDemoMode();
      } else {
        const targetMode = this.aiTargetModes[this.aiTargetModeIdx];

        if (targetMode === 'TRACK') {
          if (this.pianoRoll.numKeys !== 88) {
            this.keyboardSizeSelect.value = '88';
            this.setKeyboardSize(88);
            showToast('Expanded to full 88-note range', 'ai');
          }

          const trackLengths = [64, 64, 128, 128];
          const targetSteps = trackLengths[Math.floor(Math.random() * trackLengths.length)];
          if (this.pianoRoll.steps < targetSteps) {
            this.pianoRoll.setSteps(targetSteps);
            const bars = targetSteps / 16;
            showToast(`Preparing ${bars}-bar canvas for full arrangement`, 'ai');
          }
        }

        const currentState = this.getCurrentState(targetMode);

        const hasExistingContent = currentState.tracks.some(
          t => t && t.some(note => note !== null)
        );
        const hasCreativeBrief = this.trackDescription && this.trackDescription.trim().length > 0;

        // Thumbnail generation - will be started after creative brief is established
        let thumbnailPromise: Promise<void> | null = null;

        if (!hasCreativeBrief && !hasExistingContent) {
          this.setStatus('CRAFTING VISION...');
          showToast('Analyzing style and genre...', 'ai');

          try {
            const [detectedGenre, creativeBrief] = await Promise.all([
              detectGenreWithAI(prompt),
              generateCreativeBrief(prompt)
            ]);

            if (detectedGenre) {
              this.trackSkill = detectedGenre;
              const genreData = DEFAULT_GENRES[detectedGenre];
              if (genreData) {
                showToast(`Genre detected: ${genreData.name}`, 'ai');
              }
            }

            if (creativeBrief) {
              this.trackDescription = creativeBrief;
              if (this.trackPanel) {
                // Stream the creative brief word by word
                const words = creativeBrief.split(' ');
                let currentText = '';
                this.trackPanel.showDescription(true);

                for (let i = 0; i < words.length; i++) {
                  currentText += (i > 0 ? ' ' : '') + words[i];
                  this.trackPanel.setDescription(currentText);
                  await new Promise(resolve => setTimeout(resolve, 30));
                }
              }
              showToast('Creative vision established', 'ai');
            }

            // Now start thumbnail generation with creative brief context
            if (!this.thumbnailUrl) {
              thumbnailPromise = this.generateThumbnail();
            }
          } catch (e) {
            console.warn('Could not generate creative brief:', e);
            if (!this.trackSkill) {
              this.trackSkill = detectGenreFromPrompt(prompt);
            }
          }
        } else if (!this.thumbnailUrl) {
          // No new brief generated, but still need thumbnail
          thumbnailPromise = this.generateThumbnail();
        }

        if (!this.trackSkill && prompt) {
          this.trackSkill = detectGenreFromPrompt(prompt);
        }

        this.setStatus('AI COMPOSING...');
        showToast('Composing synth tracks...', 'ai');

        const systemPrompt = buildSystemPrompt({
          targetMode,
          state: currentState,
          skill: this.trackSkill,
          prompt
        });

        const briefContext = this.trackDescription ? `\nCREATIVE VISION: ${this.trackDescription}` : '';

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

        if (this.walkthroughEnabled) {
          this.abortAiGen = false;
          const walkthroughCtx: WalkthroughContext = {
            app: this as unknown as WalkthroughContext['app'],
            engine: this.engine,
            pianoRoll: this.pianoRoll as unknown as WalkthroughContext['pianoRoll'],
            keyboard: this.keyboard as unknown as WalkthroughContext['keyboard'],
            knobs: this.knobs,
            targetMode,
            aborted: false
          };
          Object.defineProperty(walkthroughCtx, 'aborted', {
            get: () => this.abortAiGen
          });
          try {
            await runWalkthrough(result, walkthroughCtx);
            showToast('Synth track complete!', 'ai');

            this.saveCurrentTrack(this.currentPatternId);
            this.updateTrackIndicators();

            // Wait for thumbnail if it was started
            if (thumbnailPromise) {
              await thumbnailPromise;
            }

            this.generateSuggestion(targetMode);
          } catch (err) {
            if ((err as Error).message === 'ABORTED') {
              showToast('Generation aborted', 'info');
            } else {
              throw err;
            }
          }
        } else {
          await this.applyState(result, targetMode);
          showToast('Synth parameters applied', 'ai');

          this.saveCurrentTrack(this.currentPatternId);
          this.updateTrackIndicators();

          // Wait for thumbnail if it was started
          if (thumbnailPromise) {
            await thumbnailPromise;
          }

          this.generateSuggestion(targetMode);
        }

        this.aiPromptInput.value = '';
      }
    } catch (err) {
      console.error('AI Request failed:', err);
      showToast('AI REQUEST FAILED', 'error');
    } finally {
      this.aiCopilot.classList.remove('ai-loading');
      (this.aiGenBtn as HTMLButtonElement).disabled = false;
      this.abortAiGen = false;
      this.updateAiButtonText();
    }
  }

  /**
   * STATE MANAGEMENT
   */
  getCurrentState(targetMode: string = 'ALL'): CurrentState {
    const selectedIdx = this.pianoRoll.selectedTrackIdx;
    const allTracks = this.pianoRoll.getTracksAsTracker();

    let tracks: (number | null | [number, number])[][];
    let trackParams: Record<string, Record<string, unknown>>;

    if (targetMode === 'TRACK') {
      tracks = allTracks.map((t, idx) => idx === selectedIdx ? t : []);
      trackParams = { [selectedIdx]: this.engine.trackParams[selectedIdx] as unknown as Record<string, unknown> };
    } else {
      tracks = allTracks;
      trackParams = this.engine.trackParams as unknown as Record<string, Record<string, unknown>>;
    }

    this.saveCurrentTrack(this.currentPatternId);

    return {
      trackName: this.trackName?.trim() || '',
      trackDescription: this.trackDescription,
      thumbnailUrl: this.thumbnailUrl,
      thumbnailPrompt: this.thumbnailPrompt,
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

  async applyState(state: Record<string, unknown>, targetMode: string = 'ALL'): Promise<void> {
    const selectedIdx = this.pianoRoll.selectedTrackIdx;

    if (state.trackName) {
      this.trackName = state.trackName as string;
      if (this.trackPanel) this.trackPanel.setTitle(state.trackName as string);
    }
    if (state.trackDescription !== undefined) {
      this.trackDescription = state.trackDescription as string;
      if (this.trackPanel) this.trackPanel.setDescription(state.trackDescription as string);
    }
    if (state.thumbnailUrl !== undefined) {
      this.thumbnailUrl = state.thumbnailUrl as string | null;
      if (this.trackPanel) this.trackPanel.setThumbnail(state.thumbnailUrl as string | null);
    }
    if (state.thumbnailPrompt !== undefined) {
      this.thumbnailPrompt = state.thumbnailPrompt as string | null;
    }
    if (state.trackSkill !== undefined) {
      this.trackSkill = state.trackSkill as string | null;
    }

    if (state.patterns) {
      this.patterns = JSON.parse(JSON.stringify(state.patterns));
      this.updateTrackIndicators();
    }
    if (state.currentPatternId) {
      this.currentPatternId = state.currentPatternId as PatternId;
      if (this.patternBank) this.patternBank.setActivePattern(state.currentPatternId as PatternId);
    }

    if (state.steps) {
      this.pianoRoll.setSteps(state.steps as number);
    }
    if (state.numKeys !== undefined && [12, 25, 49, 61, 88].includes(state.numKeys as number)) {
      this.keyboardSizeSelect.value = String(state.numKeys);
      this.setKeyboardSize(state.numKeys as number);
    }
    if (state.rootKey !== undefined) {
      this.rootKeySelect.value = String(state.rootKey);
    }
    if (state.rootOctave !== undefined) {
      this.octaveSelect.value = String(state.rootOctave);
    }
    this.updateKeyboardRange();

    if (state.globalParams) {
      const gp = state.globalParams as Record<string, unknown>;
      if (gp.bpm !== undefined) {
        this.bpmInput.value = String(gp.bpm);
        this.engine.updateParam('bpm', gp.bpm);
        if (this.pianoRoll) this.pianoRoll.setBPM(gp.bpm as number);
      }
    }

    if (state.trackParams) {
      const tp = state.trackParams as Record<string, unknown>;
      if (Array.isArray(tp)) {
        tp.forEach((params, tIdx) => {
          if (targetMode === 'PATTERN' && tIdx !== selectedIdx) return;
          for (const [key, val] of Object.entries(params as Record<string, unknown>)) {
            this.engine.updateParam(key, val, tIdx);
          }
        });
      } else {
        for (const [idx, params] of Object.entries(tp)) {
          const tIdx = parseInt(idx);
          if (targetMode === 'PATTERN' && tIdx !== selectedIdx) continue;
          for (const [key, val] of Object.entries(params as Record<string, unknown>)) {
            this.engine.updateParam(key, val, tIdx);
          }
        }
      }
      this.refreshUIForTrack(selectedIdx);
    }

    if (state.trackNames) {
      const tn = state.trackNames as string[];
      if (targetMode === 'TRACK') {
        this.pianoRoll.setTrackNames(tn);
      } else if (tn[selectedIdx]) {
        const names = [...this.pianoRoll.trackNames];
        names[selectedIdx] = tn[selectedIdx];
        this.pianoRoll.setTrackNames(names);
      }
    }

    if (state.tracks) {
      const tracks = state.tracks as (number | null | [number, number])[][];
      if (targetMode === 'PATTERN') {
        const existingTracks = this.pianoRoll.getTracksAsTracker();
        const mergedTracks = existingTracks.map((track, idx) => {
          if (idx === selectedIdx && tracks[idx] && tracks[idx].length > 0) {
            return tracks[idx];
          }
          return track;
        });
        this.pianoRoll.setTracksFromTracker(mergedTracks);
      } else {
        this.pianoRoll.setTracksFromTracker(tracks);
      }
    }
  }

  /**
   * MIDI IMPORT/EXPORT
   */
  async saveMidi(): Promise<void> {
    const midi = new Midi();
    const bpm = this.engine.globalParams.bpm;
    midi.header.setTempo(bpm);

    const startOctave = parseInt(this.octaveSelect.value);
    const rootKey = parseInt(this.rootKeySelect.value);
    const baseNote = (startOctave + 1) * 12 + rootKey;

    const trackerTracks = this.pianoRoll.getTracksAsTracker();
    const stepDuration = 15 / bpm;

    trackerTracks.forEach((trackData, i) => {
      if (trackData.some(n => n !== null)) {
        const midiTrack = midi.addTrack();
        midiTrack.name = this.pianoRoll.trackNames[i] || `Track ${i + 1}`;
        midiTrack.channel = i;

        trackData.forEach((noteData, stepIdx) => {
          if (noteData !== null) {
            let noteIdx: number;
            let noteDuration: number;
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
            } catch {
              console.warn("Invalid note skipped", midiNote);
            }
          }
        });
      }
    });

    const midiData = midi.toArray();
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

  async loadMidi(event: Event): Promise<void> {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;

    try {
      const arrayBuffer = await file.arrayBuffer();
      const midi = new Midi(arrayBuffer);

      if (midi.header.tempos.length > 0) {
        const bpm = Math.round(midi.header.tempos[0].bpm);
        this.bpmInput.value = String(bpm);
        this.engine.updateParam('bpm', bpm);
        this.pianoRoll.setBPM(bpm);
      }

      const durationSteps = Math.ceil(midi.duration * (this.engine.globalParams.bpm / 60) * 4);
      let stepsToSet = 16;
      if (durationSteps > 64) stepsToSet = 128;
      else if (durationSteps > 32) stepsToSet = 64;
      else if (durationSteps > 16) stepsToSet = 32;

      this.pianoRoll.setSteps(stepsToSet);

      let minNote = 127;
      midi.tracks.forEach((track: { notes: Array<{ midi: number }> }) => {
        track.notes.forEach((note: { midi: number }) => {
          if (note.midi < minNote) minNote = note.midi;
        });
      });

      this.rootKeySelect.value = '0';

      let idealOctave = Math.floor(minNote / 12) - 1;
      idealOctave = Math.max(1, Math.min(5, idealOctave));

      this.octaveSelect.value = String(idealOctave);
      this.updateKeyboardRange();

      const baseNote = (idealOctave + 1) * 12;

      const stepsPerSecond = (this.engine.globalParams.bpm / 60) * 4;
      const newTracks: (number | null | [number, number])[][] = [];
      let trackCount = 0;
      midi.tracks.forEach((track: { notes: Array<{ midi: number; time: number; duration: number }> }) => {
        if (track.notes.length > 0 && trackCount < 4) {
          const seqTrack: (number | null | [number, number])[] = new Array(stepsToSet).fill(null);
          track.notes.forEach((note: { midi: number; time: number; duration: number }) => {
            const step = Math.round(note.time * stepsPerSecond);
            if (step < stepsToSet) {
              const relIndex = note.midi - baseNote;
              if (relIndex >= 0 && relIndex < 18) {
                const durationSteps = Math.max(1, Math.round(note.duration * stepsPerSecond));
                const clampedDuration = Math.min(durationSteps, stepsToSet - step);
                seqTrack[step] = clampedDuration > 1 ? [relIndex, clampedDuration] : relIndex;
              }
            }
          });
          newTracks.push(seqTrack);
          trackCount++;
        }
      });

      while (newTracks.length < 4) {
        newTracks.push(new Array(stepsToSet).fill(null));
      }

      this.pianoRoll.setTracksFromTracker(newTracks);

      showToast('MIDI IMPORTED', 'success');
    } catch (err) {
      console.error('Error loading MIDI:', err);
      showToast('MIDI IMPORT FAILED', 'error');
    } finally {
      this.midiInput.value = '';
    }
  }

  /**
   * VISUALIZER
   */
  initVisualizer(): void {
    this.visualizer = createVisualizer(this.visualizerCanvas, this.engine.analyser);
  }
}

// INITIALIZE
window.addEventListener('DOMContentLoaded', () => {
  new SynthApp();
});
