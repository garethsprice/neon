/**
 * Neon AI - AI Utilities for Music Apps
 *
 * AI-powered features for music applications:
 * - Genre library (aesthetic/style guidance)
 * - Skills library (technique/expertise guidance)
 * - Genre & skill detection (keyword + AI hybrid)
 * - Prompt augmentation with genre/skill guidance
 * - Creative brief generation
 * - Thumbnail/artwork generation
 *
 * @example
 * import {
 *   detect,
 *   buildAugmentedPrompt,
 *   completeJSON,
 *   generateCreativeBrief
 * } from '@neon/ai';
 *
 * // Detect genre and skills from user prompt
 * const { genre, skills, genreData } = await detect(userPrompt);
 *
 * // Build augmented system prompt with genre/skill guidance
 * const systemPrompt = buildAugmentedPrompt(basePrompt, { genre, skills });
 *
 * // Generate with augmented prompt
 * const result = await completeJSON(systemPrompt, userPrompt);
 *
 * // Generate creative brief
 * const brief = await generateCreativeBrief(userPrompt);
 */

// =============================================================================
// TYPES
// =============================================================================

export type {
  // Genre types
  Genre,
  GenreLibrary,
  // Skill types
  Skill,
  SkillLibrary,
  // Prompts & config
  ThumbnailPromptConfig,
  AIPromptsConfig,
  ThumbnailOptions,
} from './types';

// =============================================================================
// GENRES - Aesthetic/style guidance
// =============================================================================

export {
  // Individual genres
  house,
  techno,
  techHouse,
  trance,
  hardTrance,
  psytrance,
  acid,
  garage,
  dnb,
  hiphop,
  ebm,
  italo,
  eurodance,
  nuDisco,
  ambient,
  hardcore,
  hardstyle,
  gabber,
  donk,
  nightcore,
  world,
  synthwave,
  dubstep,
  edm,
  glitchHop,
  chiptune,
  pop,
  experimental,
  chillwave,
  darksynth,
  vaporwave,
  cinematic,
  // Full library
  DEFAULT_GENRES,
  // Utilities
  getGenre,
  mergeGenres,
} from './genres';

// =============================================================================
// SKILLS - Technique/expertise guidance
// =============================================================================

export {
  // Individual skills
  drumProgramming,
  grooveDesign,
  synthSoundDesign,
  bassDesign,
  mixing,
  mastering,
  arrangement,
  buildupDesign,
  livePerformance,
  // Full library
  DEFAULT_SKILLS,
  // Utilities
  getSkill,
  mergeSkills,
  getSkillsForApp,
  getSkillsByCategory,
} from './skills';

// =============================================================================
// PROMPTS - Prompt templates
// =============================================================================

export {
  // Default prompt templates
  CREATIVE_BRIEF_PROMPT,
  DETECT_GENRE_PROMPT,
  DETECT_SKILL_PROMPT,
  IMPROVE_PROMPT,
  DEFAULT_PROMPTS,
  // Thumbnail prompts
  THUMBNAIL_BASE_PROMPT,
  THUMBNAIL_TEMPLATE,
  THUMBNAIL_STYLE_HINTS,
  DEFAULT_THUMBNAIL_CONFIG,
} from './prompts';

// =============================================================================
// COMPLETIONS - AI API wrapper
// =============================================================================

export type {
  MessageRole,
  ChatMessage,
  CompletionOptions,
  CompletionResponse,
} from './completions';

export {
  createCompletion,
  complete,
  completeWithSystem,
  completeJSON,
  cleanResponse,
  cleanResponseId,
} from './completions';

// =============================================================================
// DETECTION - Genre & skill detection
// =============================================================================

export type { DetectionResult } from './detection';

export {
  // Genre detection
  detectGenreFromKeywords,
  detectGenreWithAI,
  detectGenre,
  // Skill detection
  detectSkillsFromContext,
  detectSkillWithAI as detectProductionSkillWithAI,
  // Combined detection
  detect,
  // Prompt augmentation
  buildAugmentedPrompt,
  autoAugmentPrompt,
} from './detection';

// =============================================================================
// CREATIVE UTILITIES
// =============================================================================

export {
  generateCreativeBrief,
  generateSuggestion,
  generateTrackName
} from './creative';

// =============================================================================
// THUMBNAIL GENERATION
// =============================================================================

export {
  buildThumbnailPrompt,
  generateThumbnail,
  generateThumbnailWithUI
} from './thumbnail';
