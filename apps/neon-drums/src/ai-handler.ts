/**
 * AI Handler - AI-powered pattern generation and suggestions
 *
 * Uses shared AI utilities from @neon/ai for genre detection and thumbnail generation.
 */

import { showToast, createThumbnailModal, type ThumbnailModalComponent } from '@neon/ui';
import {
  detectGenreFromKeywords,
  detectGenre,
  buildThumbnailPrompt,
  generateThumbnail,
  DEFAULT_GENRES
} from '@neon/ai';
import { runWalkthrough } from './walkthrough';
import type { Sequencer, PatternId } from './sequencer';
import type { AudioEngine } from './audio-engine';

// Default values - only send if different (exported for testing)
export const DEFAULTS: Record<string, number | boolean> = {
  bpm: 120,
  level: 80,
  flamAmount: 20,
  tune: 70,
  attack: 70,
  decay: 70,
  tone: 70,
  snappy: 70,
  velocity: 100,
  // Filters
  lpFilterEnabled: false,
  lpFilterCutoff: 100,
  lpFilterResonance: 0,
  hpFilterEnabled: false,
  hpFilterCutoff: 0,
  hpFilterResonance: 0,
  // Saturation
  saturationEnabled: false,
  saturationDrive: 20,
  // Distortion
  distortionEnabled: false,
  distortionDrive: 50,
  distortionTone: 50,
  // Bitcrusher
  bitcrusherEnabled: false,
  bitcrusherBits: 12,
  bitcrusherDownsample: 1,
  // Compression
  compressionEnabled: false,
  compressionThreshold: 50,
  compressionRatio: 50,
  // Pan
  panEnabled: false,
  panPosition: 50,
  // Sidechain
  sidechainEnabled: false,
  sidechainAmount: 50,
  sidechainRelease: 30,
  // Delay
  delayEnabled: false,
  delayTime: 30,
  delayFeedback: 40,
  delayMix: 30,
  // Reverb
  reverbEnabled: false,
  reverbMix: 15,
  // Pattern
  numSteps: 16,
  scale: 1,
  shuffle: 0
};

export interface Elements {
  playBtn: HTMLElement | null;
  communityToggleBtn: HTMLElement | null;
  closeCommunityBtn: HTMLElement | null;
  communitySidebar: HTMLElement | null;
  globalSaveBtn: HTMLElement | null;
  globalLoadBtn: HTMLElement | null;
  feedFilterAll: HTMLElement | null;
  feedFilterMine: HTMLElement | null;
  playLabel: HTMLElement | null;
  shiftBtn: HTMLElement | null;
  clearBtn: HTMLElement | null;
  aiBtn: HTMLElement | null;
  aiPrompt: HTMLInputElement | null;
  aiModeBtn: HTMLElement | null;
  walkthroughBtn: HTMLElement | null;
  knobRefs: Record<string, { updateValue: (v: number) => void; querySelector: (s: string) => HTMLElement | null }>;
  stepButtons: HTMLElement[];
  trackModeToggle: HTMLElement | null;
  songModeToggle: HTMLElement | null;
  trackNameInput: HTMLInputElement | null;
  trackDescriptionInput: HTMLTextAreaElement | null;
  trackDescriptionPanel: HTMLElement | null;
  trackInfoBtn: HTMLElement | null;
  trackMeasureInput: HTMLInputElement | null;
  trackThumbnailContainer: HTMLElement | null;
  trackPatternDisplay: HTMLElement | null;
  instButtonGroup: HTMLElement | null;
  knobsContainer: HTMLElement | null;
  stepsContainer: HTMLElement | null;
  instName: HTMLElement | null;
  stepDisplay: HTMLElement | null;
  statusText: HTMLElement | null;
}

export interface AppState {
  shift: boolean;
  shiftPressed: boolean;
  clear: boolean;
  bank: number;
  aiModeIdx: number;
  aiWalkthrough: boolean;
  fxPage: number;
  visibility: string;
  isAiGenerating?: boolean;
  abortAiGen?: boolean;
}

export interface AIPrompts {
  system: string;
  improve: string;
  demo: string;
  creativeBrief: string;
  placeholders: Record<string, string>;
  /** Drums-specific genre augmentations (909-focused production guidance) */
  genreAugments: Record<string, string>;
}

export interface AIContext {
  sequencer: Sequencer;
  audioEngine: AudioEngine;
  elements: Elements;
  state: AppState;
  aiModes: string[];
  aiPrompts: AIPrompts;
  FX_PAGES: string[][];
  banks: Record<number, PatternId[]>;
  scales: { l: string; v: number }[];
  performCommit: () => Promise<void>;
  renderAll: () => void;
  renderKnobs: () => void;
  renderSteps: () => void;
  renderFXControls: () => void;
  syncGlobalKnobs: () => void;
  updateBankUI: () => void;
  updateTrackUI: () => void;
  updatePatternUI: () => void;
  updateAiModeUI: () => void;
  currentInstrument: string;
  setCurrentInstrument: (inst: string) => void;
  targetMode?: string;
}

export interface AIGenerationData {
  bpm?: number;
  trackName?: string;
  description?: string;
  params?: Record<string, Record<string, number>>;
  patterns?: Record<PatternId, {
    pattern?: Record<string, number[] | Record<string, number>>;
    flams?: Record<string, boolean[] | Record<string, boolean>>;
    numSteps?: number;
    scale?: number;
    shuffle?: number;
  }>;
  track?: PatternId[];
  reasoning?: string[];
}

// Suggestion/brief responses are inserted directly into input fields as text.
// A model (or the local stub) echoing a JSON payload must never land there. Exported for testing.
export function looksLikeJsonBlob(text: string): boolean {
  const t = text.trim();
  return t.startsWith('{') || t.startsWith('[') || t.startsWith('```');
}

// Exported for testing
export function isDiff(val: unknown, def: unknown): boolean {
  if (val === def) return false;
  if (typeof val === 'boolean') return val !== def;
  if (typeof val === 'number' && typeof def === 'number') return Math.abs(val - def) > 0.01;
  return val !== def;
}

// Remap AI pattern names to valid sequencer IDs (A-P) - exported for testing
export function remapPatternIds(data: AIGenerationData, validIds: PatternId[]): AIGenerationData {
  if (!data.patterns) return data;

  const aiPatternNames = Object.keys(data.patterns);

  const needsRemapping = aiPatternNames.some(name => !validIds.includes(name));
  if (!needsRemapping) return data;

  const idMapping: Record<string, PatternId> = {};
  aiPatternNames.forEach((name, idx) => {
    if (idx < validIds.length) {
      idMapping[name] = validIds[idx];
    }
  });

  const remappedPatterns: Record<PatternId, typeof data.patterns[string]> = {};
  Object.entries(data.patterns).forEach(([name, patternData]) => {
    const newId = idMapping[name];
    if (newId) {
      remappedPatterns[newId] = patternData;
    }
  });

  let remappedTrack = data.track;
  if (data.track && Array.isArray(data.track)) {
    remappedTrack = data.track.map(name => idMapping[name] || name);
  }

  return {
    ...data,
    patterns: remappedPatterns,
    track: remappedTrack
  };
}

export function buildCurrentState(sequencer: Sequencer, targetMode: string): Record<string, unknown> {
  const state: Record<string, unknown> = {};

  if (isDiff(sequencer.bpm, DEFAULTS.bpm)) state.bpm = sequencer.bpm;
  if (sequencer.trackName) state.trackName = sequencer.trackName;
  if (sequencer.trackDescription) state.description = sequencer.trackDescription;

  const params: Record<string, Record<string, unknown>> = {};
  Object.entries(sequencer.trackParams).forEach(([inst, pSet]) => {
    const changed: Record<string, unknown> = {};
    Object.entries(pSet).forEach(([p, v]) => {
      const def = DEFAULTS[p];
      if (def !== undefined && isDiff(v, def)) changed[p] = v;
      else if (def === undefined && v !== 50) changed[p] = v;
    });
    if (Object.keys(changed).length) params[inst] = changed;
  });
  if (Object.keys(params).length) state.params = params;

  const patterns: Record<PatternId, Record<string, unknown>> = {};
  const patternIds = targetMode === 'PATTERN'
    ? [sequencer.currentPatternId]
    : sequencer.IDS;

  patternIds.forEach(id => {
    const p = sequencer.patterns[id];
    const pData: Record<string, unknown> = {};

    if (isDiff(p.numSteps, DEFAULTS.numSteps)) pData.numSteps = p.numSteps;
    if (isDiff(p.scale, DEFAULTS.scale)) pData.scale = p.scale;
    if (isDiff(p.shuffle, DEFAULTS.shuffle)) pData.shuffle = p.shuffle;

    const tracks: Record<string, Record<string, number>> = {};
    Object.entries(p.tracks).forEach(([inst, hits]) => {
      const sparse: Record<string, number> = {};
      hits.forEach((v, i) => { if (v > 0) sparse[i] = v; });
      if (Object.keys(sparse).length) tracks[inst] = sparse;
    });
    if (Object.keys(tracks).length) pData.pattern = tracks;

    const flams: Record<string, Record<string, boolean>> = {};
    Object.entries(p.flams).forEach(([inst, f]) => {
      const sparse: Record<string, boolean> = {};
      f.forEach((v, i) => { if (v) sparse[i] = true; });
      if (Object.keys(sparse).length) flams[inst] = sparse;
    });
    if (Object.keys(flams).length) pData.flams = flams;

    if (Object.keys(pData).length) patterns[id] = pData;
  });
  if (Object.keys(patterns).length) state.patterns = patterns;

  if (targetMode !== 'PATTERN') {
    const track = sequencer.trackMeasures.filter(m => m !== null);
    if (track.length) state.track = track;
  }

  return state;
}

export function applyInstant(data: AIGenerationData, ctx: AIContext): void {
  const { sequencer, elements, state, banks, updateBankUI, updatePatternUI, syncGlobalKnobs, updateTrackUI } = ctx;

  if (data.bpm) {
    sequencer.bpm = data.bpm;
    elements.knobRefs.bpm?.updateValue(data.bpm);
  }

  if (data.params) {
    Object.entries(data.params).forEach(([inst, pSet]) => {
      if (!sequencer.trackParams[inst]) return;
      Object.entries(pSet).forEach(([p, v]) => {
        sequencer.setParam(inst, p, v);
      });
    });
  }

  if (data.patterns) {
    const patternIds = Object.keys(data.patterns);

    if (ctx.targetMode === 'CHAIN' && patternIds.length > 0 && (!data.track || !data.track.length)) {
      sequencer.trackMeasures.fill(null);
      patternIds.forEach((p, i) => { if (i < 96) sequencer.trackMeasures[i] = p; });
      sequencer.patternChain = [...patternIds];
      updateTrackUI();
      updatePatternUI();
      if (!sequencer.trackMode) elements.trackModeToggle?.click();
    }

    Object.entries(data.patterns).forEach(([id, pData]) => {
      sequencer.loadPattern(pData as Parameters<typeof sequencer.loadPattern>[0], id);
    });
  }

  state.bank = banks[1].includes(sequencer.currentPatternId) ? 1 : 2;
  updateBankUI();
  syncGlobalKnobs();

  if (data.track && data.track.length) {
    sequencer.trackMeasures.fill(null);
    data.track.forEach((p, i) => { if (i < 96) sequencer.trackMeasures[i] = p; });
    updateTrackUI();
    if (ctx.targetMode === 'TRACK') {
      if (sequencer.trackMode) elements.trackModeToggle?.click();
      if (!sequencer.songMode) elements.songModeToggle?.click();
    }
  }

  if (data.trackName) {
    sequencer.trackName = data.trackName;
    if (elements.trackNameInput) elements.trackNameInput.value = data.trackName;
  }

  if (data.description && !sequencer.trackDescription) {
    sequencer.trackDescription = data.description;
    if (elements.trackDescriptionInput) elements.trackDescriptionInput.value = data.description;
  }
}

// Check if we should show "Demo" / "Suggest" / "AI Gen" button
export function updateAiButtonText(elements: Elements, sequencer: Sequencer, aiModes: string[], stateObj: AppState): void {
  if (stateObj.isAiGenerating) return;
  const hasPrompt = elements.aiPrompt?.value.trim().length ?? 0 > 0;
  let hasContent = false;
  for (const id of sequencer.IDS) {
    const p = sequencer.patterns[id];
    if (p && Object.values(p.tracks).some(t => t.some(v => v > 0))) {
      hasContent = true;
      break;
    }
  }
  if (hasPrompt) {
    if (elements.aiBtn) {
      elements.aiBtn.innerText = "AI GEN";
      elements.aiBtn.classList.remove('demo-attract');
    }
  } else if (hasContent) {
    if (elements.aiBtn) {
      elements.aiBtn.innerText = "SUGGEST";
      elements.aiBtn.classList.remove('demo-attract');
    }
  } else {
    if (elements.aiBtn) {
      elements.aiBtn.innerText = "DEMO";
      elements.aiBtn.classList.add('demo-attract');
    }
  }
}

// Thumbnail modal instance (singleton per app)
let thumbnailModal: ThumbnailModalComponent | null = null;

/**
 * Get or create the thumbnail modal
 */
export function getThumbnailModal(sequencer: Sequencer, elements: Elements): ThumbnailModalComponent {
  if (!thumbnailModal) {
    thumbnailModal = createThumbnailModal({
      thumbnailUrl: sequencer.thumbnailUrl,
      prompt: sequencer.thumbnailPrompt || '',
      generateThumbnail: async (prompt: string) => {
        const url = await generateThumbnail({
          title: sequencer.trackName,
          description: sequencer.trackDescription,
          prompt,
          genre: sequencer.trackSkill,
        }, { genres: DEFAULT_GENRES });
        return url;
      },
      onSave: (url, prompt) => {
        sequencer.thumbnailUrl = url;
        sequencer.thumbnailPrompt = prompt;
        if (elements.trackThumbnailContainer) {
          elements.trackThumbnailContainer.innerHTML = `<img src="${url}">`;
        }
      },
      showToast
    });
  }
  return thumbnailModal;
}

/**
 * Open the thumbnail modal for viewing/editing
 */
export function openThumbnailModal(sequencer: Sequencer, elements: Elements): void {
  const modal = getThumbnailModal(sequencer, elements);

  // Build current prompt if not set
  let prompt = sequencer.thumbnailPrompt || '';
  if (!prompt) {
    prompt = buildThumbnailPrompt({
      title: sequencer.trackName,
      description: sequencer.trackDescription,
      prompt: elements.aiPrompt?.value?.trim(),
      genre: sequencer.trackSkill,
    }, { genres: DEFAULT_GENRES });
  }

  modal.setThumbnail(sequencer.thumbnailUrl || null, prompt);
  modal.open();
}

/**
 * Generate thumbnail silently (used after AI generation)
 */
export async function generateTrackThumbnail(sequencer: Sequencer, elements: Elements): Promise<void> {
  const prompt = buildThumbnailPrompt({
    title: sequencer.trackName,
    description: sequencer.trackDescription,
    prompt: elements.aiPrompt?.value?.trim(),
    genre: sequencer.trackSkill,
  }, { genres: DEFAULT_GENRES });

  if (elements.trackThumbnailContainer) {
    elements.trackThumbnailContainer.classList.add('loading');
  }

  try {
    const url = await generateThumbnail({
      title: sequencer.trackName,
      description: sequencer.trackDescription,
      prompt: elements.aiPrompt?.value?.trim(),
      genre: sequencer.trackSkill,
    }, { genres: DEFAULT_GENRES });

    sequencer.thumbnailUrl = url;
    sequencer.thumbnailPrompt = prompt;

    if (elements.trackThumbnailContainer) {
      elements.trackThumbnailContainer.innerHTML = `<img src="${url}">`;
    }

    showToast('TRACK ART GENERATED', 'success');
  } catch (err) {
    console.error('Thumbnail generation failed:', err);
    showToast('FAILED TO GENERATE ART', 'error');
  } finally {
    if (elements.trackThumbnailContainer) {
      elements.trackThumbnailContainer.classList.remove('loading');
    }
  }
}

export async function handleAiGeneration(ctx: AIContext): Promise<void> {
  const { sequencer, elements, state, aiModes, aiPrompts, performCommit, renderAll } = ctx;

  const el = (id: string): HTMLElement | null => document.getElementById(id);
  const queryAll = (s: string): NodeListOf<Element> => document.querySelectorAll(s);

  if (state.isAiGenerating) {
    state.abortAiGen = true;
    if (elements.aiBtn) {
      (elements.aiBtn as HTMLButtonElement).disabled = true;
      elements.aiBtn.innerText = "STOPPING...";
    }
    return;
  }

  const targetMode = aiModes[state.aiModeIdx];
  const currentState = buildCurrentState(sequencer, targetMode);
  const promptWasEmpty = !elements.aiPrompt?.value.trim();

  let hasExistingContent = false;
  for (const id of sequencer.IDS) {
    const p = sequencer.patterns[id];
    if (p && Object.values(p.tracks).some(t => t.some(v => v > 0))) {
      hasExistingContent = true;
      break;
    }
  }

  if (promptWasEmpty && hasExistingContent) {
    state.isAiGenerating = true;
    const aiCopilot = el('ai-copilot');
    aiCopilot?.classList.add('ai-loading');
    if (elements.aiBtn) elements.aiBtn.innerText = "...";
    if (elements.statusText) elements.statusText.innerText = "ANALYZING...";

    try {
      const promptToUse = aiPrompts.improve.replace('{{STATE}}', JSON.stringify(currentState));
      const suggestion = await websim.chat.completions.create({
        messages: [{ role: "user", content: promptToUse }],
      });
      if (looksLikeJsonBlob(suggestion.content)) throw new Error('AI returned JSON instead of a text suggestion');
      const prompt = suggestion.content.trim().replace(/['"]/g, '');
      if (elements.aiPrompt) elements.aiPrompt.value = prompt;
      showToast(`Suggested: "${prompt}"`, 'info');
      if (elements.statusText) elements.statusText.innerText = "EDIT & GENERATE";
    } catch {
      const fallbacks = ['Add more groove and swing', 'Enhance with sidechain pumping', 'Create energy build-up', 'Add percussive fills'];
      if (elements.aiPrompt) elements.aiPrompt.value = fallbacks[Math.floor(Math.random() * fallbacks.length)];
      if (elements.statusText) elements.statusText.innerText = "SUGGESTION READY";
    } finally {
      state.isAiGenerating = false;
      aiCopilot?.classList.remove('ai-loading');
      updateAiButtonText(elements, sequencer, aiModes, state);
    }
    return;
  }

  if (promptWasEmpty && !hasExistingContent) {
    try {
      const suggestion = await websim.chat.completions.create({
        messages: [{ role: "user", content: aiPrompts.demo }],
      });
      if (looksLikeJsonBlob(suggestion.content)) throw new Error('AI returned JSON instead of a text prompt');
      if (elements.aiPrompt) elements.aiPrompt.value = suggestion.content.trim().replace(/['"]/g, '');
    } catch {
      const fallbacks = ['Driving Berlin techno', 'Deep hypnotic groove', 'Industrial breakbeat', 'Acid house energy'];
      if (elements.aiPrompt) elements.aiPrompt.value = fallbacks[Math.floor(Math.random() * fallbacks.length)];
    }
  }

  const hasCreativeBrief = sequencer.trackDescription && sequencer.trackDescription.trim().length > 0;
  const userPromptText = elements.aiPrompt?.value || '';

  // Start thumbnail generation early (don't await - runs in background)
  let thumbnailPromise: Promise<void> | null = null;
  if (!sequencer.thumbnailUrl && userPromptText) {
    if (elements.trackThumbnailContainer) {
      elements.trackThumbnailContainer.classList.add('loading');
    }
    // Start generating thumbnail immediately using prompt text
    thumbnailPromise = (async () => {
      try {
        const url = await generateThumbnail({
          title: userPromptText.slice(0, 50), // Use prompt as initial title
          description: '',
          prompt: userPromptText,
          genre: sequencer.trackSkill,
        }, { genres: DEFAULT_GENRES });

        sequencer.thumbnailUrl = url;
        sequencer.thumbnailPrompt = userPromptText;

        if (elements.trackThumbnailContainer) {
          elements.trackThumbnailContainer.innerHTML = `<img src="${url}">`;
        }
      } catch (err) {
        console.warn('Early thumbnail generation failed:', err);
      } finally {
        if (elements.trackThumbnailContainer) {
          elements.trackThumbnailContainer.classList.remove('loading');
        }
      }
    })();
  }

  if (!hasCreativeBrief && !hasExistingContent) {
    const aiCopilot = el('ai-copilot');
    aiCopilot?.classList.add('ai-loading');
    if (elements.statusText) elements.statusText.innerText = "CRAFTING VISION...";

    showToast("Analyzing your creative direction...", "ai", 3000);

    try {
      // Run genre detection and creative brief in parallel
      const [detectedGenre, briefResponse] = await Promise.all([
        detectGenre(userPromptText, { genres: DEFAULT_GENRES, useAI: true }),
        websim.chat.completions.create({
          messages: [{ role: "user", content: aiPrompts.creativeBrief.replace('{{PROMPT}}', userPromptText) }],
        })
      ]);

      if (detectedGenre && DEFAULT_GENRES[detectedGenre]) {
        sequencer.trackSkill = detectedGenre;
        const genreInfo = DEFAULT_GENRES[detectedGenre];
        showToast(`Detected genre: ${genreInfo.name} - I'll use authentic ${genreInfo.name} production techniques`, "ai", 4000);
      }

      const creativeBrief = briefResponse.content.trim().replace(/^["']|["']$/g, '');
      if (looksLikeJsonBlob(creativeBrief)) throw new Error('AI returned JSON instead of a creative brief');
      sequencer.trackDescription = creativeBrief;

      // Stream the creative brief word by word
      if (elements.trackDescriptionInput) {
        elements.trackDescriptionInput.value = '';
        const words = creativeBrief.split(' ');
        let currentText = '';

        for (let i = 0; i < words.length; i++) {
          currentText += (i > 0 ? ' ' : '') + words[i];
          elements.trackDescriptionInput.value = currentText;
          // Small delay between words for streaming effect
          await new Promise(resolve => setTimeout(resolve, 30));
        }
      }

      if (elements.trackDescriptionPanel) {
        elements.trackDescriptionPanel.classList.remove('hidden');
        elements.trackInfoBtn?.classList.add('active');
      }

      showToast("Vision locked in! Now composing your track...", "ai", 3000);
    } catch (err) {
      console.warn("Could not generate creative brief:", err);
    }
  }

  if (!sequencer.trackSkill && userPromptText) {
    const detectedGenre = detectGenreFromKeywords(userPromptText, DEFAULT_GENRES);
    if (detectedGenre) {
      sequencer.trackSkill = detectedGenre;
    }
  }

  state.isAiGenerating = true;
  state.abortAiGen = false;

  const aiCopilot = el('ai-copilot');
  aiCopilot?.classList.add('ai-loading');
  if (elements.aiBtn) elements.aiBtn.innerText = "STOP";
  if (elements.aiModeBtn) (elements.aiModeBtn as HTMLButtonElement).disabled = true;
  if (elements.walkthroughBtn) (elements.walkthroughBtn as HTMLButtonElement).disabled = true;

  if (elements.statusText) elements.statusText.innerText = "AI COMPOSING...";

  // Show mode-specific AI toast
  const modeMessages: Record<string, string> = {
    'PATTERN': 'Crafting a single loop - focusing on groove and feel',
    'CHAIN': 'Building a multi-pattern progression with intro, build, and drop',
    'TRACK': 'Composing full arrangement with multiple sections and dynamics'
  };
  showToast(modeMessages[targetMode] || 'Generating...', 'ai', 4000);

  let systemPrompt = aiPrompts.system;
  if (sequencer.trackSkill && aiPrompts.genreAugments[sequencer.trackSkill]) {
    systemPrompt += `\n\n${aiPrompts.genreAugments[sequencer.trackSkill]}`;
    showToast(`Applying ${DEFAULT_GENRES[sequencer.trackSkill]?.name || sequencer.trackSkill} production rules`, 'ai', 3000);
  }

  const stateStr = Object.keys(currentState).length ? `\nSTATE:${JSON.stringify(currentState)}` : '';
  const briefContext = sequencer.trackDescription ? `\nVISION: ${sequencer.trackDescription}` : '';
  const userPrompt = elements.aiPrompt?.value || '';
  const userContent = `[${targetMode}] ${userPrompt}${briefContext}${stateStr}`;

  try {
    const res = await websim.chat.completions.create({
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userContent }
      ],
      json: true
    });

    let data: AIGenerationData;
    try {
      data = JSON.parse(res.content);
    } catch {
      throw new Error("Invalid JSON response");
    }

    data = remapPatternIds(data, sequencer.IDS);

    // Show AI reasoning if available
    if (data.reasoning && data.reasoning.length > 0) {
      data.reasoning.forEach((reason, i) => {
        setTimeout(() => showToast(reason, 'ai', 5000), i * 1500);
      });
    }

    // Show track name toast
    if (data.trackName) {
      showToast(`Track: "${data.trackName}"`, 'ai', 4000);
    }

    // Show pattern/arrangement info
    const patternCount = data.patterns ? Object.keys(data.patterns).length : 0;
    if (patternCount > 1) {
      showToast(`Created ${patternCount} unique patterns for variety`, 'ai', 3500);
    }

    // Show FX info if params are set
    if (data.params) {
      const fxInstruments = Object.keys(data.params).filter(inst => {
        const p = data.params![inst];
        return Object.keys(p).some(k => k.includes('Enabled') && p[k]);
      });
      if (fxInstruments.length > 0) {
        showToast(`Applied FX processing to ${fxInstruments.join(', ')}`, 'ai', 3500);
      }
    }

    if (sequencer.isPlaying) elements.playBtn?.click();

    if (state.aiWalkthrough) {
      await runWalkthrough(data, {
        ...ctx,
        targetMode,
        currentInstrument: ctx.currentInstrument,
        setCurrentInstrument: ctx.setCurrentInstrument
      });
    } else {
      applyInstant(data, { ...ctx, targetMode });
    }

    renderAll();

    if (!sequencer.isPlaying) {
      elements.playBtn?.click();
    }

    const trackLen = data.track ? data.track.length : 0;
    let msg = "Composition complete!";

    if (targetMode === 'CHAIN' && patternCount > 0) {
      msg = `${patternCount}-pattern chain ready! Double-click to add/remove`;
    } else if (trackLen) {
      msg = `${trackLen}-measure track ready!`;
    } else if (patternCount > 1) {
      msg = `${patternCount} patterns generated!`;
    }

    if (elements.statusText) {
      elements.statusText.innerText = msg.toUpperCase();
      elements.statusText.style.color = "#fff";
    }
    showToast(msg, "success");

    // Wait for early thumbnail if started, or generate now if needed
    if (thumbnailPromise) {
      await thumbnailPromise;
    } else if (!sequencer.thumbnailUrl) {
      await generateTrackThumbnail(sequencer, elements);
    }

    if (data.trackName) setTimeout(() => performCommit(), 1000);

    setTimeout(() => {
      if (elements.statusText?.innerText === msg.toUpperCase()) {
        elements.statusText.innerText = "SYSTEM READY";
        elements.statusText.style.color = "";
      }
    }, 8000);

    setTimeout(async () => {
      try {
        const newState = buildCurrentState(sequencer, targetMode);
        const suggestPrompt = aiPrompts.improve.replace('{{STATE}}', JSON.stringify(newState));
        const suggestion = await websim.chat.completions.create({
          messages: [{ role: "user", content: suggestPrompt }],
        });
        if (elements.aiPrompt && !looksLikeJsonBlob(suggestion.content)) {
          elements.aiPrompt.value = suggestion.content.trim().replace(/['"]/g, '');
        }
        updateAiButtonText(elements, sequencer, aiModes, state);
      } catch {
        // Silently ignore suggestion errors
      }
    }, 2000);

  } catch (err) {
    const error = err as Error;
    if (error.message === "ABORTED") {
      showToast("Generation stopped.", "info");
    } else {
      console.error("AI Error:", err);
      showToast("AI error - try again", "error");
      if (elements.statusText) elements.statusText.innerText = "AI ERROR";
    }
  } finally {
    state.isAiGenerating = false;
    state.abortAiGen = false;
    if (elements.aiBtn) {
      (elements.aiBtn as HTMLButtonElement).disabled = false;
      elements.aiBtn.innerText = "AI GEN";
    }
    if (elements.aiModeBtn) (elements.aiModeBtn as HTMLButtonElement).disabled = false;
    if (elements.walkthroughBtn) (elements.walkthroughBtn as HTMLButtonElement).disabled = false;
    aiCopilot?.classList.remove('ai-loading');
    if (elements.statusText && ["AI COMPOSING...", "THINKING...", "ANALYZING..."].includes(elements.statusText.innerText)) {
      elements.statusText.innerText = "SYSTEM READY";
    }
    queryAll('.ai-focus').forEach(e => e.classList.remove('ai-focus'));
  }
}
