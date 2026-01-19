/**
 * Neon AI - Prompts
 *
 * All prompt templates and configurations for AI features.
 * Each prompt is in its own file for easy editing.
 *
 * @example
 * import { CREATIVE_BRIEF_PROMPT, DETECT_GENRE_PROMPT } from '@neon/ai';
 */

// Individual prompt exports
export { CREATIVE_BRIEF_PROMPT } from './creative-brief';
export { DETECT_GENRE_PROMPT } from './detect-genre';
export { DETECT_SKILL_PROMPT } from './detect-skill';
export { IMPROVE_PROMPT } from './improve';

// Thumbnail prompt configuration
export {
  THUMBNAIL_BASE_PROMPT,
  THUMBNAIL_TEMPLATE,
  THUMBNAIL_STYLE_HINTS,
  DEFAULT_THUMBNAIL_CONFIG,
} from './thumbnail';

// Import for combined object
import { CREATIVE_BRIEF_PROMPT } from './creative-brief';
import { DETECT_GENRE_PROMPT } from './detect-genre';
import { DETECT_SKILL_PROMPT } from './detect-skill';
import { IMPROVE_PROMPT } from './improve';

/**
 * Default AI prompt templates as a combined object.
 * Apps should load their own prompts from ai-prompts.json and merge with these defaults.
 */
export const DEFAULT_PROMPTS = {
  creativeBrief: CREATIVE_BRIEF_PROMPT,
  detectGenre: DETECT_GENRE_PROMPT,
  detectSkill: DETECT_SKILL_PROMPT,
  improve: IMPROVE_PROMPT,
} as const;

// Re-export types for convenience
export type { ThumbnailPromptConfig, AIPromptsConfig, Genre, Skill } from '../types';
