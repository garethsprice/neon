/**
 * Neon Cloud - Creative AI Utilities
 *
 * AI-powered creative brief and suggestion generation.
 */

import type { AIPromptsConfig } from './types';
import { DEFAULT_PROMPTS } from './prompts';

/**
 * Generate a creative brief from a user prompt using AI
 */
export async function generateCreativeBrief(
  prompt: string,
  config: AIPromptsConfig = {}
): Promise<string | null> {
  if (!prompt) return null;

  const briefPrompt = (config.creativeBrief || DEFAULT_PROMPTS.creativeBrief)
    .replace('{{PROMPT}}', prompt);

  try {
    const response = await websim.chat.completions.create({
      messages: [{ role: 'user', content: briefPrompt }]
    });
    return response.content.trim().replace(/^["']|["']$/g, '');
  } catch (e) {
    console.warn('Could not generate creative brief:', e);
    return null;
  }
}

/**
 * Generate an improvement suggestion based on current state
 */
export async function generateSuggestion(
  state: Record<string, unknown>,
  config: AIPromptsConfig = {}
): Promise<string | null> {
  const improvePrompt = (config.improve || DEFAULT_PROMPTS.improve)
    .replace('{{STATE}}', JSON.stringify(state));

  try {
    const response = await websim.chat.completions.create({
      messages: [{ role: 'user', content: improvePrompt }]
    });
    return response.content.trim().replace(/['"]/g, '');
  } catch (e) {
    console.warn('Could not generate suggestion:', e);
    return null;
  }
}

/**
 * Generate a track name using AI
 */
export async function generateTrackName(
  style?: string,
  appType: string = 'music'
): Promise<string> {
  const prompts: Record<string, string> = {
    drums: 'Suggest a 2-word cool name for a techno track. Respond with only the name.',
    synth: 'Suggest a 2-word cool name for a synth track. Respond with only the name.',
    noise: 'Suggest a 2-word cool name for an ambient noise mix. Respond with only the name.',
    music: 'Suggest a 2-word cool name for a music track. Respond with only the name.'
  };

  const basePrompt = prompts[appType] || prompts.music;
  const prompt = style ? `${basePrompt} Style: ${style}` : basePrompt;

  try {
    const response = await websim.chat.completions.create({
      messages: [{ role: 'system', content: prompt }]
    });
    return response.content.trim();
  } catch {
    return 'Untitled';
  }
}
