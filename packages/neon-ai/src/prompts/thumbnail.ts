/**
 * Neon AI - Thumbnail Prompt Configuration
 *
 * Configuration for generating album artwork and thumbnails.
 * Override these in your app's ai-prompts.json file.
 */

import type { ThumbnailPromptConfig } from '../types';

/**
 * Base prompt for image generation.
 * Sets the context for the AI image generator.
 */
export const THUMBNAIL_BASE_PROMPT =
  'Create album cover art for an electronic music track';

/**
 * Template for building the full thumbnail prompt.
 * Placeholders:
 *   {{SKILL_ARTWORK}} - Genre-specific artwork guidance
 *   {{STYLE}} - Random style hint from the list below
 */
export const THUMBNAIL_TEMPLATE =
  'Create striking album artwork. {{SKILL_ARTWORK}}. ABSOLUTELY NO TEXT. Style: {{STYLE}}';

/**
 * Style hints for variety in thumbnail generation.
 * A random hint is selected for each generation.
 */
export const THUMBNAIL_STYLE_HINTS: readonly string[] = [
  'Retro synthwave aesthetic with neon grid landscapes',
  'Abstract geometric shapes with glowing outlines',
  'Futuristic space scene with nebulae',
  'Minimalist design with bold colors',
] as const;

/**
 * Default thumbnail prompt configuration.
 * Used when apps don't provide their own thumbnail config.
 */
export const DEFAULT_THUMBNAIL_CONFIG: Required<ThumbnailPromptConfig> = {
  basePrompt: THUMBNAIL_BASE_PROMPT,
  template: THUMBNAIL_TEMPLATE,
  styleHints: [...THUMBNAIL_STYLE_HINTS],
};
