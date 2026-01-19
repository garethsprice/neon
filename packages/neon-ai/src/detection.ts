/**
 * Neon AI - Genre & Skill Detection
 *
 * Functions to detect genre and production skills from user prompts.
 * Uses keyword matching first (fast), then AI detection (accurate).
 */

import type { Genre, GenreLibrary, Skill, SkillLibrary } from './types';
import { DEFAULT_GENRES } from './genres';
import { DEFAULT_SKILLS } from './skills';
import { DETECT_GENRE_PROMPT } from './prompts/detect-genre';
import { DETECT_SKILL_PROMPT } from './prompts/detect-skill';
import { complete, cleanResponseId } from './completions';

// =============================================================================
// GENRE DETECTION
// =============================================================================

/**
 * Detect genre from prompt using keyword matching (fast, no API call)
 */
export function detectGenreFromKeywords(
  prompt: string,
  genres: GenreLibrary = DEFAULT_GENRES
): string | null {
  if (!prompt) return null;

  const promptLower = prompt.toLowerCase();

  for (const [genreId, genre] of Object.entries(genres)) {
    if (genre.keywords?.some(kw => promptLower.includes(kw.toLowerCase()))) {
      return genreId;
    }
  }

  return null;
}

/**
 * Detect genre using AI (slower but more accurate)
 */
export async function detectGenreWithAI(
  prompt: string,
  genres: GenreLibrary = DEFAULT_GENRES
): Promise<string | null> {
  if (!prompt) return null;

  try {
    const detectPrompt = DETECT_GENRE_PROMPT.replace('{{PROMPT}}', prompt);
    const response = await complete(detectPrompt);
    const detectedGenre = cleanResponseId(response);

    // Verify it's a valid genre
    if (genres[detectedGenre]) {
      return detectedGenre;
    }

    // Try to find a partial match
    for (const genreId of Object.keys(genres)) {
      if (detectedGenre.includes(genreId) || genreId.includes(detectedGenre)) {
        return genreId;
      }
    }
  } catch (e) {
    console.warn('Could not detect genre with AI:', e);
  }

  return null;
}

/**
 * Detect genre using keywords first, then AI fallback
 */
export async function detectGenre(
  prompt: string,
  options: {
    genres?: GenreLibrary;
    useAI?: boolean;
  } = {}
): Promise<string | null> {
  const { genres = DEFAULT_GENRES, useAI = true } = options;

  // Try keyword matching first (fast)
  const keywordMatch = detectGenreFromKeywords(prompt, genres);
  if (keywordMatch) return keywordMatch;

  // Fall back to AI if enabled
  if (useAI) {
    return detectGenreWithAI(prompt, genres);
  }

  return null;
}

// =============================================================================
// SKILL DETECTION
// =============================================================================

/**
 * Detect relevant production skills from prompt context
 * Returns an array of skill IDs that might be relevant
 */
export function detectSkillsFromContext(
  prompt: string,
  skills: SkillLibrary = DEFAULT_SKILLS
): string[] {
  if (!prompt) return [];

  const promptLower = prompt.toLowerCase();
  const detected: string[] = [];

  // Common skill-related keywords
  const skillKeywords: Record<string, string[]> = {
    'mixing': ['mix', 'mixing', 'balance', 'levels', 'eq', 'compression'],
    'mastering': ['master', 'mastering', 'loud', 'loudness', 'final'],
    'arrangement': ['arrange', 'arrangement', 'structure', 'build', 'breakdown', 'drop'],
    'drum-programming': ['drums', 'beat', 'rhythm', 'groove', 'percussion', 'kick', 'snare', 'hat'],
    'groove-design': ['groove', 'swing', 'shuffle', 'feel', 'pocket'],
    'synth-sound-design': ['synth', 'sound design', 'patch', 'preset', 'oscillator', 'filter'],
    'bass-design': ['bass', 'sub', 'low end', 'bassline'],
    'buildup-design': ['buildup', 'build-up', 'riser', 'tension', 'drop'],
    'live-performance': ['live', 'dj', 'performance', 'set', 'mix'],
  };

  for (const [skillId, keywords] of Object.entries(skillKeywords)) {
    if (skills[skillId] && keywords.some(kw => promptLower.includes(kw))) {
      detected.push(skillId);
    }
  }

  return detected;
}

/**
 * Detect primary skill using AI
 */
export async function detectSkillWithAI(
  prompt: string,
  skills: SkillLibrary = DEFAULT_SKILLS
): Promise<string | null> {
  if (!prompt) return null;

  try {
    const detectPrompt = DETECT_SKILL_PROMPT.replace('{{PROMPT}}', prompt);
    const response = await complete(detectPrompt);
    const detectedSkill = cleanResponseId(response);

    // Verify it's a valid skill
    if (skills[detectedSkill]) {
      return detectedSkill;
    }

    // Try to find a partial match
    for (const skillId of Object.keys(skills)) {
      if (detectedSkill.includes(skillId) || skillId.includes(detectedSkill)) {
        return skillId;
      }
    }
  } catch (e) {
    console.warn('Could not detect skill with AI:', e);
  }

  return null;
}

// =============================================================================
// COMBINED DETECTION
// =============================================================================

/**
 * Detection result with genre and skills
 */
export interface DetectionResult {
  /** Detected genre ID */
  genre: string | null;
  /** Genre definition (if found) */
  genreData: Genre | null;
  /** Detected skill IDs */
  skills: string[];
  /** Skill definitions (if found) */
  skillsData: Skill[];
}

/**
 * Detect both genre and relevant skills from a prompt
 */
export async function detect(
  prompt: string,
  options: {
    genres?: GenreLibrary;
    skills?: SkillLibrary;
    useAI?: boolean;
  } = {}
): Promise<DetectionResult> {
  const {
    genres = DEFAULT_GENRES,
    skills = DEFAULT_SKILLS,
    useAI = true,
  } = options;

  // Detect genre
  const genre = await detectGenre(prompt, { genres, useAI });
  const genreData = genre ? genres[genre] : null;

  // Detect skills from context
  const detectedSkills = detectSkillsFromContext(prompt, skills);
  const skillsData = detectedSkills
    .map(id => skills[id])
    .filter((s): s is Skill => s !== undefined);

  return {
    genre,
    genreData,
    skills: detectedSkills,
    skillsData,
  };
}

// =============================================================================
// PROMPT AUGMENTATION
// =============================================================================

/**
 * Build an augmented system prompt with genre and skill guidance
 */
export function buildAugmentedPrompt(
  basePrompt: string,
  options: {
    genre?: string | null;
    skills?: string[];
    genres?: GenreLibrary;
    skillsLibrary?: SkillLibrary;
  } = {}
): string {
  const {
    genre,
    skills = [],
    genres = DEFAULT_GENRES,
    skillsLibrary = DEFAULT_SKILLS,
  } = options;

  let augmented = basePrompt;

  // Add genre guidance
  if (genre && genres[genre]) {
    const genreData = genres[genre];
    augmented += `\n\n=== GENRE: ${genreData.name.toUpperCase()} ===\n${genreData.aesthetic}`;
    if (genreData.bpmRange) {
      augmented += `\nTypical BPM: ${genreData.bpmRange[0]}-${genreData.bpmRange[1]}`;
    }
  }

  // Add skill guidance
  if (skills.length > 0) {
    const skillAugments = skills
      .map(id => skillsLibrary[id])
      .filter((s): s is Skill => s !== undefined)
      .map(s => s.augment);

    if (skillAugments.length > 0) {
      augmented += `\n\n=== PRODUCTION GUIDANCE ===\n${skillAugments.join('\n\n')}`;
    }
  }

  return augmented;
}

/**
 * Auto-detect and augment a prompt based on user input
 */
export async function autoAugmentPrompt(
  basePrompt: string,
  userInput: string,
  options: {
    genres?: GenreLibrary;
    skills?: SkillLibrary;
    useAI?: boolean;
  } = {}
): Promise<{ prompt: string; detection: DetectionResult }> {
  const detection = await detect(userInput, options);

  const prompt = buildAugmentedPrompt(basePrompt, {
    genre: detection.genre,
    skills: detection.skills,
    genres: options.genres,
    skillsLibrary: options.skills,
  });

  return { prompt, detection };
}
