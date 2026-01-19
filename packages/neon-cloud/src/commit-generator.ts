/**
 * neon-cloud/commit-generator.ts
 * AI-powered commit message generation
 */

import type { DiffResult, CommitOptions, AppPrompt, CommitGeneratorOptions } from './types';

/**
 * App-specific prompts for commit message generation
 */
const APP_PROMPTS: Record<string, AppPrompt> = {
  drums: {
    type: 'drum machine track',
    examples: '"Added punchy kick pattern to B", "Cranked up the tempo", "New hi-hat groove in A and C"'
  },
  synth: {
    type: 'synth track',
    examples: '"New acid bassline in track 1", "Added dreamy pad progression", "Tweaked filter resonance"'
  },
  noise: {
    type: 'noise preset',
    examples: '"Boosted pink noise for warmth", "Added vinyl crackle", "Calm rain atmosphere"'
  },
  generic: {
    type: 'music project',
    examples: '"Updated settings", "New sound design", "Tweaked parameters"'
  }
};

/**
 * Create a commit message generator for a specific app type
 */
export function createCommitMessageGenerator(
  appType: string = 'generic',
  options: CommitGeneratorOptions = {}
) {
  const { maxLength = 60, useAI = true } = options;
  const prompts = APP_PROMPTS[appType] || APP_PROMPTS.generic;

  /**
   * Generate a commit message based on changes
   */
  return async function generateCommitMessage(
    changes: DiffResult,
    _prevData: Record<string, unknown> | null,
    _currData: Record<string, unknown>,
    commitOptions: CommitOptions = {}
  ): Promise<string> {
    // Handle remix case
    if (commitOptions.isRemix && commitOptions.remixSource) {
      return `Remixed from @${commitOptions.remixSource.owner}/${commitOptions.remixSource.name}`;
    }

    // Handle initial commit
    if (changes.isInitial) {
      return 'Initial commit';
    }

    // Handle no changes
    if (!changes.summary || changes.summary.length === 0) {
      return 'Minor adjustments';
    }

    // Build summary parts
    const parts = changes.summary;

    // Try AI generation if enabled
    if (useAI && typeof websim !== 'undefined' && websim.chat?.completions?.create) {
      try {
        const response = await websim.chat.completions.create({
          messages: [{
            role: 'user',
            content: `Generate a brief, meaningful commit message (max 50 chars) for a ${prompts.type}. These changes were made:\n\n${parts.join('\n')}\n\nWrite a concise message that captures the essence of these changes. Reply with ONLY the message, no quotes. Examples: ${prompts.examples}`
          }]
        });
        return response.content.trim().replace(/^["']|["']$/g, '').substring(0, maxLength);
      } catch (e) {
        console.warn('AI commit message generation failed:', e);
        // Fall through to default
      }
    }

    // Fallback: use first summary item
    return parts[0]?.substring(0, maxLength) || 'Updated ' + prompts.type;
  };
}

/**
 * Generate a simple procedural commit message (no AI)
 * Useful for apps like neon-noise that don't need AI-generated messages
 */
export function generateSimpleCommitMessage(
  changes: DiffResult,
  _prevData: Record<string, unknown> | null,
  _currData: Record<string, unknown>,
  options: CommitOptions = {}
): string {
  // Handle remix case
  if (options.isRemix && options.remixSource) {
    return `Remixed from @${options.remixSource.owner}/${options.remixSource.name}`;
  }

  // Handle initial commit
  if (changes.isInitial) {
    return 'Initial preset';
  }

  // Handle no changes
  if (!changes.summary || changes.summary.length === 0) {
    return 'Minor adjustments';
  }

  // Build message from changes
  const parts: string[] = [];

  // Check for scalar changes
  if (changes.scalar) {
    for (const [key, change] of Object.entries(changes.scalar)) {
      if (typeof change.prev === 'number' && typeof change.curr === 'number') {
        const prevPct = Math.round((change.prev as number) * 100);
        const currPct = Math.round((change.curr as number) * 100);
        parts.push(`${key}: ${prevPct}% → ${currPct}%`);
      } else {
        parts.push(`${key}: ${change.prev} → ${change.curr}`);
      }
    }
  }

  // Check for object changes
  if (changes.objects) {
    for (const [key, objChanges] of Object.entries(changes.objects)) {
      if (objChanges.modified?.length) {
        parts.push(`Updated ${objChanges.modified.length} ${key}`);
      }
      if (objChanges.added?.length) {
        parts.push(`Added ${objChanges.added.length} ${key}`);
      }
      if (objChanges.removed?.length) {
        parts.push(`Removed ${objChanges.removed.length} ${key}`);
      }
    }
  }

  // Return first few parts or fallback
  if (parts.length === 0) {
    return changes.summary?.[0]?.substring(0, 60) || 'Updated preset';
  }

  return parts.slice(0, 2).join(', ').substring(0, 60);
}
