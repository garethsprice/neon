/**
 * Neon AI - Completions API
 *
 * Wrapper around websim.chat.completions for AI-powered generation.
 * Provides typed interfaces and error handling.
 */

/**
 * Message role for chat completions
 */
export type MessageRole = 'system' | 'user' | 'assistant';

/**
 * Chat message format
 */
export interface ChatMessage {
  role: MessageRole;
  content: string;
}

/**
 * Options for chat completion requests
 */
export interface CompletionOptions {
  /** Chat messages */
  messages: ChatMessage[];
  /** Request JSON response format */
  json?: boolean;
  /** Temperature (0-1, lower = more deterministic) */
  temperature?: number;
}

/**
 * Response from chat completion
 */
export interface CompletionResponse {
  /** The generated content */
  content: string;
  /** Raw response (if available) */
  raw?: unknown;
}

/**
 * Create a chat completion using the websim AI API.
 * This is the low-level wrapper - prefer higher-level functions when possible.
 *
 * @example
 * const response = await createCompletion({
 *   messages: [
 *     { role: 'system', content: 'You are a music producer.' },
 *     { role: 'user', content: 'Create a techno beat' }
 *   ],
 *   json: true
 * });
 */
export async function createCompletion(options: CompletionOptions): Promise<CompletionResponse> {
  const response = await websim.chat.completions.create({
    messages: options.messages,
    json: options.json,
  });

  return {
    content: response.content,
    raw: response,
  };
}

/**
 * Simple text completion with a single user prompt
 */
export async function complete(prompt: string): Promise<string> {
  const response = await createCompletion({
    messages: [{ role: 'user', content: prompt }],
  });
  return response.content.trim();
}

/**
 * Complete with a system prompt and user prompt
 */
export async function completeWithSystem(
  systemPrompt: string,
  userPrompt: string,
  options: { json?: boolean } = {}
): Promise<string> {
  const response = await createCompletion({
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
    json: options.json,
  });
  return response.content;
}

/**
 * Complete and parse as JSON
 */
export async function completeJSON<T = unknown>(
  systemPrompt: string,
  userPrompt: string
): Promise<T> {
  // OpenAI's json_object response_format rejects requests unless the word
  // "json" appears in the messages; guarantee it for all callers.
  const mentionsJson = /json/i.test(systemPrompt) || /json/i.test(userPrompt);
  const system = mentionsJson
    ? systemPrompt
    : `${systemPrompt}\n\nRespond with a valid JSON object.`;
  const response = await completeWithSystem(system, userPrompt, { json: true });
  return JSON.parse(response) as T;
}

/**
 * Clean response text by removing quotes and trimming
 */
export function cleanResponse(text: string): string {
  return text.trim().replace(/^["']|["']$/g, '');
}

/**
 * Clean response and convert to lowercase (for IDs/keys)
 */
export function cleanResponseId(text: string): string {
  return cleanResponse(text).toLowerCase().replace(/['"]/g, '');
}
