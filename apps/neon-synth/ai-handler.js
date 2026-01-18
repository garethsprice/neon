/* ==========================================================================
   NEON SYNTH 2 - AI Handler
   AI generation logic and prompt management
   ========================================================================== */

import { showToast } from '../../packages/neon-ui/index.js';

// Default AI prompts (loaded from ai-prompts.json)
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

/**
 * Load AI prompts from JSON file
 */
export function loadAiPrompts() {
    return fetch('./ai-prompts.json')
        .then(r => r.json())
        .then(data => {
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
export function getAiPrompts() {
    return aiPrompts;
}

/**
 * Detect skill/genre from prompt using keyword matching
 * @param {string} prompt - User's prompt
 * @returns {string|null} - Detected skill ID or null
 */
export function detectSkillFromKeywords(prompt) {
    if (!prompt) return null;

    const promptLower = prompt.toLowerCase();
    for (const [skillId, skill] of Object.entries(aiPrompts.skills || {})) {
        if (skill.keywords && skill.keywords.some(kw => promptLower.includes(kw))) {
            return skillId;
        }
    }
    return null;
}

/**
 * Detect skill/genre using AI
 * @param {string} prompt - User's prompt
 * @returns {Promise<string|null>} - Detected skill ID or null
 */
export async function detectSkillWithAI(prompt) {
    try {
        const response = await websim.chat.completions.create({
            messages: [{ role: "user", content: aiPrompts.detectSkill.replace('{{PROMPT}}', prompt) }]
        });
        const detectedSkill = response.content.trim().toLowerCase().replace(/['"]/g, '');
        if (aiPrompts.skills && aiPrompts.skills[detectedSkill]) {
            return detectedSkill;
        }
    } catch (e) {
        console.warn('Could not detect skill with AI:', e);
    }
    return null;
}

/**
 * Generate creative brief using AI
 * @param {string} prompt - User's prompt
 * @returns {Promise<string|null>} - Creative brief or null
 */
export async function generateCreativeBrief(prompt) {
    try {
        const response = await websim.chat.completions.create({
            messages: [{ role: "user", content: aiPrompts.creativeBrief.replace('{{PROMPT}}', prompt) }]
        });
        return response.content.trim().replace(/^["']|["']$/g, '');
    } catch (e) {
        console.warn('Could not generate creative brief:', e);
        return null;
    }
}

/**
 * Build keyboard range description for AI prompt
 * @param {object} state - Current state with numKeys, rootKey, rootOctave
 * @returns {string} - Keyboard description text
 */
export function buildKeyboardDescription(state) {
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
 * @param {string} targetMode - 'PATTERN' or 'TRACK'
 * @param {object} state - Current state
 * @returns {string} - Target mode instruction text
 */
export function buildTargetModeInstruction(targetMode, state) {
    if (targetMode === 'PATTERN') {
        return `TARGET MODE: PATTERN - Create a single loop using the CURRENT settings.
- Keep steps at ${state.steps} (do not change)
- Keep numKeys at ${state.numKeys} (do not change)
- Create all 4 patterns to work together as a cohesive loop
- Focus on a tight, instantly usable groove`;
    } else {
        return `TARGET MODE: TRACK - Create a FULL composition using ALL available space.
- The canvas has ${state.steps} steps (${state.steps / 16} bars) and ${state.numKeys} keys - USE ALL OF IT
- You MUST fill ALL ${state.steps} steps with musical content (no empty sections)
- You MUST use ALL 4 patterns: Pattern 0=Bass, Pattern 1=Lead, Pattern 2=Pads, Pattern 3=Arps
- Each pattern array MUST have exactly ${state.steps} entries
- Create variation and progression across all ${state.steps / 16} bars
- Use the full note range: bass (indices 15-30), leads (39-55), pads (30-50), arps (50-70)
- CRITICAL: Do not leave patterns empty or short - fill the entire ${state.steps} steps for ALL 4 patterns`;
    }
}

/**
 * Build the complete system prompt for AI generation
 * @param {object} options - Options for building the prompt
 * @returns {string} - Complete system prompt
 */
export function buildSystemPrompt(options) {
    const { targetMode, state, skill, prompt } = options;

    const targetModeInstruction = buildTargetModeInstruction(targetMode, state);
    const keyboardDescription = buildKeyboardDescription(state);

    // Add skill-specific augmentation
    let skillAugment = '';
    if (skill && aiPrompts.skills?.[skill]?.augment) {
        skillAugment = `\n\nGENRE GUIDANCE:\n${aiPrompts.skills[skill].augment}`;
    }

    return `You are a synth sound designer and music producer with deep knowledge of music theory and composition.${skillAugment}

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
  "tracks": array of 4 pattern arrays, each with EXACTLY ${state.steps} entries - FILL ALL STEPS,
  "reasoning": string[] (3-6 brief creative notes explaining key choice, musical decisions, etc.)
}

CRITICAL RULES:
1. "tracks" must be an array of 4 pattern arrays. Each pattern MUST have exactly ${state.steps} entries.
2. Do NOT leave patterns empty. Do NOT make patterns shorter than ${state.steps} steps. FILL THE ENTIRE CANVAS.
3. For sustained notes: use [noteIndex, duration] at the START only, then null for the remaining duration steps.
4. Do NOT repeat note indices to make longer notes - that creates separate retriggered notes, not sustained ones.

User request: "${prompt}"`;
}

/**
 * Build thumbnail generation prompt
 * @param {object} options - Options for thumbnail
 * @returns {string} - Thumbnail prompt
 */
export function buildThumbnailPrompt(options) {
    const { title, description, aiPromptText, skill } = options;

    // Build style from all available context
    const parts = [title, description, aiPromptText].filter(Boolean);
    const style = parts.length > 0 ? parts.join(' - ') : 'Electronic synth music';

    // Get skill-specific artwork guidance
    const skillArtwork = skill && aiPrompts.skills?.[skill]?.artwork
        ? `Visual style: ${aiPrompts.skills[skill].artwork}`
        : 'Abstract electronic music aesthetics, bold neon colors, geometric or organic shapes';

    // Use template if available, otherwise fallback
    if (aiPrompts.thumbnail?.template) {
        return aiPrompts.thumbnail.template
            .replace('{{SKILL_ARTWORK}}', skillArtwork)
            .replace('{{STYLE}}', style);
    } else {
        const styleHints = aiPrompts.thumbnail?.styleHints || [];
        const randomStyle = styleHints[Math.floor(Math.random() * styleHints.length)] || '';
        return `${aiPrompts.thumbnail?.basePrompt || 'Create album art'}. ${skillArtwork}. ${style}. ${randomStyle}. ABSOLUTELY NO TEXT OR WORDS.`;
    }
}

/**
 * Generate improvement suggestion
 * @param {object} state - Current state
 * @returns {Promise<string|null>} - Suggested prompt or null
 */
export async function generateSuggestion(state) {
    try {
        const suggestPrompt = aiPrompts.improve.replace('{{STATE}}', JSON.stringify(state));
        const suggestion = await websim.chat.completions.create({
            messages: [{ role: 'user', content: suggestPrompt }]
        });
        return suggestion.content.trim().replace(/['"]/g, '');
    } catch (e) {
        console.warn('Could not generate suggestion:', e);
        return null;
    }
}
