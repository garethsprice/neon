/**
 * NEON SYNTH 2 - AI Handler
 * AI generation logic and prompt management
 *
 * Uses shared AI utilities from @neon/ai for genre detection and creative tools.
 */

import {
  type AIPromptsConfig,
  type ThumbnailPromptConfig,
  detectGenreFromKeywords,
  detectGenre,
  generateCreativeBrief as sharedGenerateBrief,
  generateSuggestion as sharedGenerateSuggestion,
  buildThumbnailPrompt as sharedBuildThumbnail,
  DEFAULT_GENRES,
  CREATIVE_BRIEF_PROMPT
} from '@neon/ai';

export interface AIPrompts {
  system: string;
  creativeBrief: string;
  improve: string;
  thumbnail: ThumbnailPromptConfig;
  /** Synth-specific genre augmentations */
  genreAugments: Record<string, string>;
}

/** Default parameter values for the synth engine */
export const DEFAULTS: Record<string, number | boolean | string> = {
  waveType: 'sawtooth',
  detune: 0,
  filterCutoff: 2000,
  filterReso: 1,
  hpFilterCutoff: 20,
  hpFilterReso: 0,
  attack: 0.1,
  decay: 0.2,
  sustain: 0.5,
  release: 0.5,
  delayTime: 0.3,
  delayMix: 0.2,
  reverbMix: 0.3,
  saturationDrive: 0,
  distortionEnabled: false,
  distortionDrive: 50,
  distortionTone: 50,
  bitcrusherEnabled: false,
  bitcrusherBits: 12,
  bitcrusherDownsample: 1,
  panEnabled: false,
  panPosition: 50,
  phaserEnabled: false,
  phaserRate: 0.5,
  phaserDepth: 70,
  phaserMix: 50,
  flangerEnabled: false,
  flangerRate: 0.3,
  flangerDepth: 70,
  flangerMix: 50,
  spatialEnabled: false,
  spatialX: 0,
  spatialY: 0,
  spatialZ: 0
};

export interface BuildThumbnailOptions {
  title: string;
  description: string;
  aiPromptText: string;
  skill: string | null;
}

export interface BuildSystemPromptOptions {
  targetMode: string;
  state: CurrentState;
  skill: string | null;
  prompt: string;
}

export interface CurrentState {
  trackName: string;
  trackDescription: string | null;
  thumbnailUrl: string | null;
  thumbnailPrompt: string | null;
  trackSkill: string | null;
  trackNames: string[];
  trackParams: Record<string, Record<string, unknown>>;
  globalParams: Record<string, unknown>;
  steps: number;
  numKeys: number;
  rootKey: number;
  rootOctave: number;
  tracks: (number | null | [number, number])[][];
  selectedTrackIdx: number;
  currentPatternId: string;
  patterns: Record<string, unknown>;
}

// Default AI prompts (loaded from ai-prompts.json)
let aiPrompts: AIPrompts = {
  system: '',
  creativeBrief: CREATIVE_BRIEF_PROMPT,
  genreAugments: {},
  improve: "Suggest ONE improvement for this synth track. STATE: {{STATE}}\nReply with ONLY a short prompt.",
  thumbnail: {
    basePrompt: 'Create album cover art for an electronic music track',
    template: 'Create striking album artwork. {{GENRE_ARTWORK}}. ABSOLUTELY NO TEXT. Style: {{STYLE}}',
    styleHints: [
      'Retro synthwave aesthetic with neon grid landscapes',
      'Dark cyberpunk cityscape with rain and neon',
      'Abstract geometric shapes with glowing outlines',
      'Futuristic space scene with nebulae',
      'Minimalist design with bold typography'
    ]
  }
};

/**
 * Load AI prompts from JSON file
 */
export function loadAiPrompts(): Promise<AIPrompts> {
  return fetch('./ai-prompts.json')
    .then(r => r.json())
    .then((data: AIPrompts) => {
      aiPrompts = data;
      return aiPrompts;
    })
    .catch(() => {
      // Use defaults
      return aiPrompts;
    });
}

/**
 * Get current AI prompts
 */
export function getAiPrompts(): AIPrompts {
  return aiPrompts;
}

/**
 * Detect genre from prompt using keyword matching
 */
export function detectGenreFromPrompt(prompt: string): string | null {
  return detectGenreFromKeywords(prompt, DEFAULT_GENRES);
}

/**
 * Detect genre using AI (with fallback to keywords)
 */
export async function detectGenreWithAI(prompt: string): Promise<string | null> {
  return detectGenre(prompt, { genres: DEFAULT_GENRES, useAI: true });
}

/**
 * Generate creative brief using AI
 */
export async function generateCreativeBrief(prompt: string): Promise<string | null> {
  return sharedGenerateBrief(prompt, { creativeBrief: aiPrompts.creativeBrief } as AIPromptsConfig);
}

/**
 * Build keyboard range description for AI prompt
 * @param state - Current state with numKeys, rootKey, rootOctave
 * @returns Keyboard description text
 */
export function buildKeyboardDescription(state: CurrentState): string {
  const numKeys = state.numKeys || 12;
  const rootKey = state.rootKey ?? 0;
  const rootOctave = state.rootOctave ?? 3;
  const noteNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

  if (numKeys <= 24) {
    // Small keyboard - relative to root
    const rootNoteName = noteNames[rootKey];
    const lowNote = `${rootNoteName}${rootOctave}`;
    const highOctave = rootOctave + Math.floor((numKeys - 1) / 12);
    const highNoteIdx = (rootKey + numKeys - 1) % 12;
    const highNote = `${noteNames[highNoteIdx]}${highOctave}`;
    return `
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
    return `
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
}

/**
 * Build target mode instruction for AI prompt
 * @param targetMode - 'PATTERN' or 'TRACK'
 * @param state - Current state
 * @returns Target mode instruction text
 */
export function buildTargetModeInstruction(targetMode: string, state: CurrentState): string {
  if (targetMode === 'PATTERN') {
    return `TARGET MODE: PATTERN - Create a single loop.
- Keep steps at ${state.steps} (do not change)
- Keep numKeys at ${state.numKeys} (do not change)
- Create all 4 tracks to work together as a cohesive loop
- Focus on a tight, instantly usable groove`;
  } else {
    return `TARGET MODE: TRACK - Create a FULL song-length composition.
- The canvas has ${state.steps} steps (${state.steps / 16} bars) and ${state.numKeys} keys - USE ALL OF IT
- Fill ALL ${state.steps} steps with musical content across all 4 tracks
- Create variation and progression: intro, build, climax, breakdown, outro
- Use the full note range: bass (indices 15-30), leads (39-55), pads (30-50), arps (50-70)
- Each track array MUST have exactly ${state.steps} entries`;
  }
}

/**
 * Build the complete system prompt for AI generation
 * @param options - Options for building the prompt
 * @returns Complete system prompt
 */
export function buildSystemPrompt(options: BuildSystemPromptOptions): string {
  const { targetMode, state, skill, prompt } = options;

  const targetModeInstruction = buildTargetModeInstruction(targetMode, state);
  const keyboardDescription = buildKeyboardDescription(state);

  // Add genre-specific augmentation
  let genreAugment = '';
  if (skill && aiPrompts.genreAugments?.[skill]) {
    genreAugment = `\n\nGENRE GUIDANCE:\n${aiPrompts.genreAugments[skill]}`;
  }

  // Include FX system documentation if loaded
  const fxDocumentation = aiPrompts.system ? `\n\n${aiPrompts.system}` : '';

  return `You are a synth sound designer and music producer with deep knowledge of music theory and composition.${genreAugment}${fxDocumentation}

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
- steps: 16, 32, or 64 (song length)
- "tracks" is an array of up to 8 arrays, one per synth track
- Each step value:
  - null = empty/rest step
  - number = note index with duration 1 step
  - [noteIndex, duration] = note that sustains for multiple steps

DURATION FORMAT (CRITICAL):
When a note has duration > 1, put [noteIndex, duration] at the START step only.
The following steps covered by that note's duration should be null (the note is still playing).

EXAMPLE: A 4-step sustained note starting at step 0:
CORRECT: [[30, 4], null, null, null, 27, null, null, null, ...]
WRONG:   [30, 30, 30, 30, 27, 27, 27, 27, ...]  // This creates separate notes!

DURATION GUIDELINES:
- Melodies/Leads: 1-2 steps (punchy, rhythmic)
- Bass: 2-4 steps (sustained, groovy)
- Arpeggios: 1 step always (rapid, sequenced)
- Pads: 4-8 steps (long, sustained chords)
- DEFAULT TO SHORT DURATIONS (1-2) for rhythmic parts!

TRACK ROLES (up to 8 independent synth tracks - use as many as needed):
- tracks[0]: Sub Bass (very low indices 12-24, sine/triangle, foundation)
- tracks[1]: Bass (low indices 20-32, sawtooth/square, main bass groove)
- tracks[2]: Lead/Melody (mid indices 36-52, sawtooth, main melodic content)
- tracks[3]: Chords/Stabs (mid indices 32-48, short chords, harmonic support)
- tracks[4]: Pads (mid indices 30-50, sine/triangle, long sustained, heavy reverb)
- tracks[5]: Arp 1 (high indices 48-64, fast patterns, delay)
- tracks[6]: Arp 2/Texture (high indices 52-70, counterpoint to Arp 1)
- tracks[7]: FX/Perc (any range, textural hits, risers, impacts)

Use 4-6 tracks for simpler pieces, all 8 for rich, layered productions.
Not every track needs content - leave tracks empty (all nulls) if not needed.

REASONING: Include a "reasoning" array with 3-6 brief notes explaining your creative choices.
Example: ["Setting dark techno vibe at 130 BPM", "Dual arps for movement", "Sub bass for weight"]

OUTPUT JSON SCHEMA:
{
  "trackName": "Creative Title",
  "trackNames": ["Sub","Bass","Lead","Chords","Pad","Arp1","Arp2","FX"],
  "rootKey": 0,
  "trackParams": {"0":{...},"1":{...},...},
  "globalParams": {"bpm": 120},
  "tracks": [[sub],[bass],[lead],[chords],[pad],[arp1],[arp2],[fx]],
  "reasoning": ["reason1","reason2"]
}

EXAMPLE OUTPUT (4 tracks used, 16 steps):
{"trackName":"Neon Pulse","trackNames":["Sub","Bass","Lead","Pad"],"trackParams":{"1":{"waveType":"square","filterCutoff":800},"2":{"delayMix":0.3}},"globalParams":{"bpm":128},"tracks":[[15,null,null,null,15,null,null,null,15,null,null,null,15,null,null,null],[27,null,null,null,27,null,null,null,27,null,null,null,27,null,null,null],[39,40,41,39,40,41,39,40,41,39,40,41,39,40,41,39],[[30,8],null,null,null,null,null,null,null,[30,8],null,null,null,null,null,null,null]],"reasoning":["Dark techno vibe","Sub + bass for weight","Square bass for punch"]}

CRITICAL RULES:
1. "tracks" is an array of up to 8 arrays at the ROOT level
2. Each track array MUST have EXACTLY ${state.steps} entries (use null for empty steps)
3. For sustained notes: [noteIndex, duration] at START only, then null for remaining duration
4. Only output trackParams that DIFFER from defaults - omit unchanged values!
5. Include only as many tracks as needed - don't pad with empty tracks

User request: "${prompt}"`;
}

/**
 * Build thumbnail generation prompt
 */
export function buildThumbnailPrompt(options: BuildThumbnailOptions): string {
  return sharedBuildThumbnail({
    title: options.title,
    description: options.description,
    prompt: options.aiPromptText,
    genre: options.skill
  }, { thumbnail: aiPrompts.thumbnail, genres: DEFAULT_GENRES } as AIPromptsConfig);
}

/**
 * Generate improvement suggestion
 */
export async function generateSuggestion(state: CurrentState): Promise<string | null> {
  return sharedGenerateSuggestion(state as unknown as Record<string, unknown>, { improve: aiPrompts.improve } as AIPromptsConfig);
}
