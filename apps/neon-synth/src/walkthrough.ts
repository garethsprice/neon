/**
 * NEON SYNTH 2 - AI Walkthrough Mode
 * Animates the application of AI-generated changes step-by-step
 */

import { showToast } from '@neon/ui';
import type { AudioEngine } from './audio-engine';
import type { KnobComponent } from '@neon/ui/knob';

const sleep = (ms: number): Promise<void> => new Promise(r => setTimeout(r, ms));
const el = (id: string): HTMLElement | null => document.getElementById(id);

export interface PianoRollComponent {
  selectedTrackIdx: number;
  trackNames: string[];
  steps: number;
  numKeys: number;
  bpm: number;
  isPlaying: boolean;
  scrollArea: HTMLElement | null;
  setSteps: (steps: number) => void;
  setBPM: (bpm: number) => void;
  setNumKeys: (numKeys: number) => void;
  setRange: (rootNote: number, octave: number) => void;
  selectTrack: (trackIdx: number) => void;
  setTrackName: (trackIdx: number, name: string) => void;
  setTrackNames: (names: string[]) => void;
  setNoteAt: (trackIdx: number, step: number, noteIdx: number, duration?: number) => void;
  clearTrack: (trackIdx: number) => void;
  clearAll: () => void;
  getTracksAsTracker: () => (number | null | [number, number])[][];
  setTracksFromTracker: (tracks: (number | null | [number, number])[][]) => void;
  getNoteLabelsElement: () => HTMLElement | null;
}

export interface KeyboardComponent {
  getFrequency: (keyIndex: number) => number;
  setKeyVisualState: (keyIndex: number, active: boolean) => void;
}

export interface SynthApp {
  trackName: string;
  trackDescription: string;
  thumbnailUrl: string | null;
  trackPanel?: {
    element?: HTMLElement;
    setTitle: (title: string) => void;
    setDescription: (desc: string) => void;
    setThumbnail: (url: string | null) => void;
  };
  setKeyboardSize: (numKeys: number) => void;
  updateKeyboardRange: () => void;
  refreshUIForTrack: (trackIdx: number) => void;
  setWaveType: (type: string) => void;
  getCKeyIndex: () => number;
}

export interface WalkthroughContext {
  app: SynthApp;
  engine: AudioEngine;
  pianoRoll: PianoRollComponent;
  keyboard: KeyboardComponent;
  knobs: Record<string, KnobComponent>;
  targetMode: string;
  aborted: boolean;
}

export interface AIGenerationData {
  trackName?: string;
  trackDescription?: string;
  thumbnailUrl?: string | null;
  trackNames?: string[];
  trackParams?: Record<string, Record<string, unknown>> | Record<string, unknown>[];
  globalParams?: {
    bpm?: number;
    masterVolume?: number;
  };
  rootKey?: number;
  rootOctave?: number;
  steps?: number;
  numKeys?: number;
  tracks?: (number | null | [number, number])[][];
  reasoning?: string[];
}

// Scroll controller for smooth, non-competing scroll animations
class ScrollController {
  scrollArea: HTMLElement | null;
  stepWidth: number;
  targetScroll: number | null = null;
  animationId: number | null = null;

  constructor(scrollArea: HTMLElement | null, stepWidth: number = 24) {
    this.scrollArea = scrollArea;
    this.stepWidth = stepWidth;
  }

  // Check if a step is visible with some padding
  isStepVisible(step: number, padding: number = 0.2): boolean {
    if (!this.scrollArea) return true;

    const scrollLeft = this.scrollArea.scrollLeft;
    const viewWidth = this.scrollArea.clientWidth;
    const stepLeft = step * this.stepWidth;
    const stepRight = stepLeft + this.stepWidth;

    const visibleLeft = scrollLeft + (viewWidth * padding);
    const visibleRight = scrollLeft + viewWidth - (viewWidth * padding);

    return stepLeft >= visibleLeft && stepRight <= visibleRight;
  }

  // Smoothly scroll to center a step, but only if needed
  scrollToStep(step: number, immediate: boolean = false): void {
    if (!this.scrollArea) return;

    // Skip if step is already comfortably visible
    if (!immediate && this.isStepVisible(step, 0.25)) return;

    const viewWidth = this.scrollArea.clientWidth;
    const maxScroll = this.scrollArea.scrollWidth - viewWidth;

    // Target: center the step in view
    const targetScrollLeft = (step * this.stepWidth) - (viewWidth / 2) + (this.stepWidth / 2);
    this.targetScroll = Math.max(0, Math.min(targetScrollLeft, maxScroll));

    // Cancel any existing animation
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
    }

    // Animate scroll with easing
    this.animateScroll();
  }

  animateScroll(): void {
    if (this.targetScroll === null || !this.scrollArea) return;

    const current = this.scrollArea.scrollLeft;
    const diff = this.targetScroll - current;

    // Stop if close enough
    if (Math.abs(diff) < 1) {
      this.scrollArea.scrollLeft = this.targetScroll;
      this.targetScroll = null;
      this.animationId = null;
      return;
    }

    // Ease toward target (larger divisor = smoother but slower)
    const ease = 0.15;
    this.scrollArea.scrollLeft = current + (diff * ease);

    this.animationId = requestAnimationFrame(() => this.animateScroll());
  }

  // Immediately jump to a step (for initial positioning)
  jumpToStep(step: number): void {
    if (!this.scrollArea) return;

    const viewWidth = this.scrollArea.clientWidth;
    const maxScroll = this.scrollArea.scrollWidth - viewWidth;
    const targetScrollLeft = (step * this.stepWidth) - (viewWidth / 2) + (this.stepWidth / 2);

    this.scrollArea.scrollLeft = Math.max(0, Math.min(targetScrollLeft, maxScroll));
    this.targetScroll = null;

    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }
  }

  destroy(): void {
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
    }
  }
}

/**
 * Run walkthrough animation for AI-generated state changes
 * @param data - The AI-generated state to apply
 * @param ctx - Application context with references to app components
 */
export async function runWalkthrough(data: AIGenerationData, ctx: WalkthroughContext): Promise<void> {
  const {
    app,           // SynthApp instance
    engine,        // AudioEngine
    pianoRoll,     // Piano roll component
    keyboard,      // Keyboard component
    knobs,         // Knob references
    targetMode     // 'TRACK' or 'ALL'
  } = ctx;

  const reasoning = Array.isArray(data.reasoning) ? [...data.reasoning] : [];
  const checkAbort = (): void => { if (ctx.aborted) throw new Error("ABORTED"); };

  // Helper to show reasoning with emphasis
  const showReasoning = (msg: string): void => {
    if (msg) showToast(`[AI] ${msg}`, 'info');
  };

  const statusText = el('status-text');
  if (statusText) statusText.innerText = "GENERATING...";

  // Show initial reasoning if available
  if (reasoning.length > 0) {
    showReasoning(reasoning.shift()!);
    await sleep(800);
  }

  // 1. Animate BPM change
  if (data.globalParams?.bpm && data.globalParams.bpm !== engine.globalParams.bpm) {
    checkAbort();
    if (reasoning.length > 0) showReasoning(reasoning.shift()!);
    showToast(`Setting tempo to ${data.globalParams.bpm} BPM`, 'info');

    const startBpm = engine.globalParams.bpm;
    const endBpm = data.globalParams.bpm;
    const steps = 10;
    const bpmInput = el('bpm-input') as HTMLInputElement | null;

    for (let i = 0; i <= steps; i++) {
      checkAbort();
      const val = Math.round(startBpm + (endBpm - startBpm) * (i / steps));
      engine.updateParam('bpm', val);
      if (bpmInput) bpmInput.value = String(val);
      pianoRoll.setBPM(val);
      await sleep(30);
    }
    await sleep(200);
  }

  // 2. Master volume is user-controlled only (AI cannot modify it)

  // 3. Apply musical key changes
  if (data.rootKey !== undefined || data.rootOctave !== undefined) {
    checkAbort();
    const rootKeySelect = el('root-key-select') as HTMLSelectElement | null;
    const octaveSelect = el('octave-select') as HTMLSelectElement | null;
    const keyNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

    if (data.rootKey !== undefined && rootKeySelect) {
      rootKeySelect.value = String(data.rootKey);
      showToast(`Setting key to ${keyNames[data.rootKey]}`, 'info');
    }
    if (data.rootOctave !== undefined && octaveSelect) {
      octaveSelect.value = String(data.rootOctave);
    }
    app.updateKeyboardRange();
    await sleep(200);
  }

  // 4. Apply step count and numKeys changes
  if (data.steps && data.steps !== pianoRoll.steps) {
    checkAbort();
    showToast(`Setting ${data.steps} steps (${data.steps / 16} bars)`, 'info');
    pianoRoll.setSteps(data.steps);
    await sleep(300);
  }

  // 4b. Apply range change (CRITICAL: must happen before programming notes)
  if (data.numKeys && data.numKeys !== pianoRoll.numKeys && [12, 25, 49, 61, 88].includes(data.numKeys)) {
    checkAbort();
    showToast(`Setting ${data.numKeys}-note range`, 'info');
    const rangeSelect = el('keyboard-size-select') as HTMLSelectElement | null;
    if (rangeSelect) rangeSelect.value = String(data.numKeys);
    app.setKeyboardSize(data.numKeys);
    await sleep(300);
  }

  // 5. Walkthrough track parameters with sound audition
  const selectedTrackIdx = pianoRoll.selectedTrackIdx;

  if (data.trackParams) {
    const sidebar = el('sidebar');
    const trackParamsEntries: [number, Record<string, unknown>][] = Array.isArray(data.trackParams)
      ? data.trackParams.map((p, i) => [i, p] as [number, Record<string, unknown>]).filter(([_, p]) => p && Object.keys(p).length > 0)
      : Object.entries(data.trackParams).map(([k, v]) => [parseInt(k), v as Record<string, unknown>]);

    for (const [trackIdx, params] of trackParamsEntries) {
      checkAbort();

      // In PATTERN mode, only modify selected track
      if (targetMode === 'PATTERN' && trackIdx !== selectedTrackIdx) continue;

      const currentParams = engine.trackParams[trackIdx];
      if (!currentParams) continue; // Skip tracks not supported by engine

      const paramsChanged = Object.entries(params).some(([key, val]) =>
        (currentParams as Record<string, unknown>)[key] !== val
      );

      if (!paramsChanged) {
        // Apply silently if nothing changed
        Object.entries(params).forEach(([key, val]) => engine.updateParam(key, val, trackIdx));
        continue;
      }

      // Switch to this track for visual feedback
      if (trackIdx !== pianoRoll.selectedTrackIdx) {
        pianoRoll.selectTrack(trackIdx);
        app.refreshUIForTrack(trackIdx);
        await sleep(200);
      }

      if (reasoning.length > 0) showReasoning(reasoning.shift()!);
      const trackName = pianoRoll.trackNames[trackIdx] || `Track ${trackIdx + 1}`;
      showToast(`Shaping ${trackName} sound...`, 'info');

      sidebar?.classList.add('ai-focus');

      // Group params by category for better visual flow
      const paramCategories: Record<string, string[]> = {
        oscillator: ['waveType', 'detune'],
        filter: ['filterCutoff', 'filterReso'],
        envelope: ['attack', 'decay', 'sustain', 'release'],
        effects: ['delayMix', 'delayTime', 'reverbMix', 'saturationDrive']
      };

      for (const [category, paramNames] of Object.entries(paramCategories)) {
        const categoryParams = paramNames.filter(p => params[p] !== undefined);
        if (categoryParams.length === 0) continue;

        // Highlight the relevant FX module
        const moduleSelector: Record<string, string> = {
          oscillator: '.fx-module:nth-child(1)',
          filter: '.fx-module:nth-child(2)',
          envelope: '.fx-module:nth-child(3)',
          effects: '.fx-module:nth-child(4)'
        };

        const moduleEl = sidebar?.querySelector(moduleSelector[category]);
        if (moduleEl) moduleEl.classList.add('ai-focus');

        for (const paramName of categoryParams) {
          checkAbort();
          const newVal = params[paramName];
          const oldVal = (currentParams as Record<string, unknown>)[paramName];

          if (oldVal === newVal) continue;

          // Handle wave type specially (it's a button toggle, not a knob)
          if (paramName === 'waveType') {
            app.setWaveType(newVal as string);
            await sleep(100);
          } else {
            // Animate knob changes
            engine.updateParam(paramName, newVal, trackIdx);
            if (knobs[paramName]) {
              knobs[paramName].setValue(newVal as number);
            }
            await sleep(50);
          }
        }

        // Audition the sound after each category
        const cKeyIndex = app.getCKeyIndex();
        const freq = keyboard.getFrequency(cKeyIndex);
        engine.noteOn(cKeyIndex, freq, trackIdx);
        keyboard.setKeyVisualState(cKeyIndex, true);
        await sleep(150);
        engine.noteOff(cKeyIndex, trackIdx);
        keyboard.setKeyVisualState(cKeyIndex, false);
        await sleep(100);

        if (moduleEl) moduleEl.classList.remove('ai-focus');
      }

      sidebar?.classList.remove('ai-focus');
      await sleep(200);
    }

    // Switch back to selected track and refresh UI
    if (pianoRoll.selectedTrackIdx !== selectedTrackIdx) {
      pianoRoll.selectTrack(selectedTrackIdx);
    }
    app.refreshUIForTrack(selectedTrackIdx);
  }

  // 6. Apply track names with typing animation
  if (data.trackNames && Array.isArray(data.trackNames)) {
    for (let i = 0; i < data.trackNames.length && i < 4; i++) {
      checkAbort();
      const newName = data.trackNames[i];
      const currentName = pianoRoll.trackNames[i];

      // In PATTERN mode, only update selected track name
      if (targetMode === 'PATTERN' && i !== selectedTrackIdx) continue;

      if (newName && newName !== currentName) {
        // Select the track to show the name change
        pianoRoll.selectTrack(i);
        await sleep(150);

        // Type out the name
        let typedName = '';
        for (const char of newName) {
          checkAbort();
          typedName += char;
          pianoRoll.setTrackName(i, typedName);
          await sleep(40);
        }
        await sleep(100);
      }
    }

    // Return to selected track
    pianoRoll.selectTrack(selectedTrackIdx);
  }

  // 7. Animate note programming in piano roll
  if (data.tracks && Array.isArray(data.tracks)) {
    const pianoRollContainer = el('piano-roll-container');

    // Create scroll controller for smooth, stable scrolling
    const scrollController = new ScrollController(pianoRoll.scrollArea, 24);

    for (let trackIdx = 0; trackIdx < data.tracks.length && trackIdx < 8; trackIdx++) {
      checkAbort();
      const trackData = data.tracks[trackIdx];

      // In PATTERN mode, only modify selected track
      if (targetMode === 'PATTERN' && trackIdx !== selectedTrackIdx) continue;

      // Skip empty tracks
      if (!trackData || !Array.isArray(trackData) || trackData.every(n => n === null)) continue;

      // Check if track actually changed
      const currentTrack = pianoRoll.getTracksAsTracker()[trackIdx];
      const trackChanged = JSON.stringify(trackData) !== JSON.stringify(currentTrack);

      if (!trackChanged) continue;

      if (reasoning.length > 0) showReasoning(reasoning.shift()!);

      // Select this track for visual feedback
      pianoRoll.selectTrack(trackIdx);
      app.refreshUIForTrack(trackIdx);
      await sleep(200);

      const defaultTrackNames = ['Sub', 'Bass', 'Lead', 'Chords', 'Pad', 'Arp1', 'Arp2', 'FX'];
      const trackName = pianoRoll.trackNames[trackIdx] || defaultTrackNames[trackIdx] || `Track ${trackIdx + 1}`;
      showToast(`Programming ${trackName}...`, 'info');

      pianoRollContainer?.classList.add('ai-focus');

      // Clear track first and jump to start (immediate, no animation)
      pianoRoll.clearTrack(trackIdx);
      scrollController.jumpToStep(0);
      await sleep(150);

      // Collect all notes to program
      const notesToProgram: { step: number; noteIdx: number; duration: number }[] = [];
      for (let step = 0; step < trackData.length; step++) {
        const noteData = trackData[step];
        if (noteData !== null) {
          // Handle both formats: number or [noteIndex, duration]
          let noteIdx: number;
          let duration: number;
          if (Array.isArray(noteData)) {
            noteIdx = noteData[0];
            duration = noteData[1] || 1;
          } else {
            noteIdx = noteData;
            duration = 1;
          }
          notesToProgram.push({ step, noteIdx, duration });
        }
      }

      // Program notes one by one with visual and audio feedback
      for (const { step, noteIdx, duration } of notesToProgram) {
        checkAbort();

        // Scroll only when step is near edge of view (controlled, non-competing)
        scrollController.scrollToStep(step);

        // Set the note with duration
        pianoRoll.setNoteAt(trackIdx, step, noteIdx, duration);

        // Play a quick preview of the note
        const freq = keyboard.getFrequency(noteIdx);
        engine.noteOn(noteIdx, freq, trackIdx);
        keyboard.setKeyVisualState(noteIdx, true);

        await sleep(60);

        engine.noteOff(noteIdx, trackIdx);
        keyboard.setKeyVisualState(noteIdx, false);
      }

      pianoRollContainer?.classList.remove('ai-focus');
      await sleep(200);
    }

    // Cleanup scroll controller
    scrollController.destroy();

    // Return to selected track
    pianoRoll.selectTrack(selectedTrackIdx);
    app.refreshUIForTrack(selectedTrackIdx);
  }

  // 8. Type track name with animation
  const newTrackName = data.trackName;
  if (newTrackName) {
    checkAbort();
    const currentTitle = app.trackName || '';

    if (newTrackName !== currentTitle) {
      // Show remaining reasoning
      while (reasoning.length > 0) {
        checkAbort();
        showReasoning(reasoning.shift()!);
        await sleep(600);
      }

      showToast(`Naming: "${newTrackName}"`, 'info');

      // Animate title typing via trackPanel
      if (app.trackPanel) {
        const titleInput = app.trackPanel.element?.querySelector('.neon-track-title-input') as HTMLElement | null;
        if (titleInput) {
          titleInput.classList.add('ai-focus');
          app.trackName = '';
          app.trackPanel.setTitle('');

          for (const char of newTrackName) {
            checkAbort();
            app.trackName += char;
            app.trackPanel.setTitle(app.trackName);
            await sleep(30);
          }

          titleInput.classList.remove('ai-focus');
        }
      } else {
        app.trackName = newTrackName;
      }
      await sleep(200);
    }
  }

  // Show any remaining reasoning
  while (reasoning.length > 0) {
    checkAbort();
    showReasoning(reasoning.shift()!);
    await sleep(600);
  }

  if (statusText) statusText.innerText = "GENERATION COMPLETE";
}
