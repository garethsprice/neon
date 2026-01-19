/**
 * Neon Cloud - Thumbnail Generation
 *
 * AI-powered album art / thumbnail generation utilities.
 */

import type { AIPromptsConfig, ThumbnailOptions, ThumbnailPromptConfig } from './types';
import { DEFAULT_THUMBNAIL_CONFIG } from './prompts';

/**
 * Build a thumbnail generation prompt from options
 */
export function buildThumbnailPrompt(
  options: ThumbnailOptions,
  config: AIPromptsConfig = {}
): string {
  const { title, description, prompt: userPrompt, genre } = options;
  const thumbnailConfig = config.thumbnail;

  // Build style from available context
  const parts = [title, description, userPrompt].filter(Boolean);
  const style = parts.length > 0 ? parts.join(' - ') : 'Electronic music';

  // Get genre-specific artwork guidance
  const genreArtwork = genre && config.genres?.[genre]?.artwork
    ? `Visual style: ${config.genres[genre].artwork}`
    : 'Abstract electronic music aesthetics, bold neon colors, geometric or organic shapes';

  // Handle string config (legacy simple prompt)
  if (typeof thumbnailConfig === 'string') {
    return thumbnailConfig
      .replace('{{GENRE_ARTWORK}}', genreArtwork)
      .replace('{{SKILL_ARTWORK}}', genreArtwork) // backward compatibility
      .replace('{{STYLE}}', style);
  }

  // Handle object config (or use defaults)
  const thumbConfig: ThumbnailPromptConfig = (thumbnailConfig as ThumbnailPromptConfig | undefined) || DEFAULT_THUMBNAIL_CONFIG;

  if (thumbConfig.template) {
    return thumbConfig.template
      .replace('{{GENRE_ARTWORK}}', genreArtwork)
      .replace('{{SKILL_ARTWORK}}', genreArtwork) // backward compatibility
      .replace('{{STYLE}}', style);
  }

  // Fallback with style hints
  const styleHints = thumbConfig.styleHints || [];
  const randomStyle = styleHints.length > 0
    ? styleHints[Math.floor(Math.random() * styleHints.length)]
    : '';

  return `${thumbConfig.basePrompt || 'Create album art'}. ${genreArtwork}. ${style}. ${randomStyle}. ABSOLUTELY NO TEXT OR WORDS.`;
}

/**
 * Generate a thumbnail image using websim.imageGen
 *
 * @returns The generated image URL
 */
export async function generateThumbnail(
  options: ThumbnailOptions,
  config: AIPromptsConfig = {}
): Promise<string> {
  const prompt = buildThumbnailPrompt(options, config);

  const result = await websim.imageGen({
    prompt,
    aspect_ratio: '1:1'
  });

  return result.url;
}

/**
 * Generate thumbnail with loading state management
 * Handles common UI patterns for thumbnail generation
 */
export async function generateThumbnailWithUI(
  options: ThumbnailOptions & {
    container?: HTMLElement | null;
    onSuccess?: (url: string) => void;
    onError?: (error: Error) => void;
    showToast?: (message: string, type: 'success' | 'error' | 'info') => void;
  },
  config: AIPromptsConfig = {}
): Promise<string | null> {
  const { container, onSuccess, onError, showToast, ...thumbnailOptions } = options;

  container?.classList.add('loading');

  try {
    const url = await generateThumbnail(thumbnailOptions, config);

    if (container) {
      container.innerHTML = `<img src="${url}">`;
    }

    onSuccess?.(url);
    showToast?.('TRACK ART GENERATED', 'success');

    return url;
  } catch (err) {
    console.error('Thumbnail generation error:', err);
    onError?.(err as Error);
    showToast?.('FAILED TO GENERATE ART', 'error');
    return null;
  } finally {
    container?.classList.remove('loading');
  }
}
