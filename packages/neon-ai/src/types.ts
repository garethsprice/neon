/**
 * Neon AI - Type Definitions
 *
 * Common type definitions for AI-powered features.
 */

// =============================================================================
// GENRES - Aesthetic and style guidance
// =============================================================================

/**
 * Genre definition for aesthetic/style guidance.
 * Genres define the sonic aesthetic, cultural context, and visual style.
 */
export interface Genre {
  /** Display name */
  name: string;
  /** Brief description of the genre */
  description?: string;
  /** Keywords that trigger this genre detection */
  keywords: string[];
  /** Aesthetic guidance for AI generation */
  aesthetic: string;
  /** Artwork style guidance for thumbnails */
  artwork?: string;
  /** Typical BPM range [min, max] */
  bpmRange?: [number, number];
  /** Related/similar genres */
  related?: string[];
}

/**
 * Collection of genres, keyed by genre ID (lowercase)
 */
export type GenreLibrary = Record<string, Genre>;

// =============================================================================
// SKILLS - Technique and expertise guidance
// =============================================================================

/**
 * Skill definition for technique/expertise guidance.
 * Skills define specific production techniques that can be applied to any genre.
 */
export interface Skill {
  /** Display name */
  name: string;
  /** Brief description of the skill */
  description?: string;
  /** Technical guidance for AI generation */
  augment: string;
  /** Skill category for organization */
  category?: 'production' | 'mixing' | 'arrangement' | 'sound-design' | 'performance';
  /** Applicable app types (if empty, applies to all) */
  applicableTo?: ('drums' | 'synth' | 'noise' | 'all')[];
}

/**
 * Collection of skills, keyed by skill ID (lowercase, hyphenated)
 */
export type SkillLibrary = Record<string, Skill>;

// =============================================================================
// PROMPTS & CONFIGURATION
// =============================================================================

/**
 * Thumbnail generation prompt configuration.
 */
export interface ThumbnailPromptConfig {
  /** Base context prompt for image generation */
  basePrompt?: string;
  /** Template with {{GENRE_ARTWORK}} and {{STYLE}} placeholders */
  template?: string;
  /** Array of style hints for variety */
  styleHints?: string[];
}

/**
 * AI prompts configuration loaded from ai-prompts.json.
 */
export interface AIPromptsConfig {
  /** Prompt for generating creative briefs. Placeholder: {{PROMPT}} */
  creativeBrief?: string;
  /** Prompt for detecting genre. Placeholder: {{PROMPT}} */
  detectGenre?: string;
  /** Prompt for suggesting improvements. Placeholder: {{STATE}} */
  improve?: string;
  /** Thumbnail generation config */
  thumbnail?: ThumbnailPromptConfig | string;
  /** Available genres */
  genres?: GenreLibrary;
  /** Available production skills */
  productionSkills?: SkillLibrary;
}

/**
 * Options for thumbnail prompt building.
 */
export interface ThumbnailOptions {
  /** Track title */
  title?: string;
  /** Track description or creative brief */
  description?: string;
  /** Original user prompt */
  prompt?: string;
  /** Detected genre */
  genre?: string | null;
  /** Applied production skills */
  skills?: string[];
}
