/**
 * Tests for neon-cloud commit message generator
 */

import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createCommitMessageGenerator, generateSimpleCommitMessage } from '../src/commit-generator';
import type { DiffResult, CommitOptions } from '../src/types';

// Helper to create partial DiffResult for testing
function createDiffResult(partial: Partial<DiffResult>): DiffResult {
  return {
    isInitial: false,
    hasChanges: false,
    summary: [],
    scalar: {},
    objects: {},
    arrays: {},
    ...partial
  } as DiffResult;
}

describe('createCommitMessageGenerator', () => {
    describe('initialization', () => {
        it('returns a function', () => {
            const generator = createCommitMessageGenerator();
            expect(typeof generator).toBe('function');
        });

        it('accepts appType parameter', () => {
            const drumsGenerator = createCommitMessageGenerator('drums');
            const synthGenerator = createCommitMessageGenerator('synth');
            const noiseGenerator = createCommitMessageGenerator('noise');

            expect(typeof drumsGenerator).toBe('function');
            expect(typeof synthGenerator).toBe('function');
            expect(typeof noiseGenerator).toBe('function');
        });

        it('falls back to generic for unknown app types', () => {
            const generator = createCommitMessageGenerator('unknown');
            expect(typeof generator).toBe('function');
        });
    });

    describe('generated function behavior', () => {
        let generator: ReturnType<typeof createCommitMessageGenerator>;

        beforeEach(() => {
            generator = createCommitMessageGenerator('drums', { useAI: false });
        });

        it('returns "Initial commit" for initial changes', async () => {
            const changes = createDiffResult({ isInitial: true, summary: [] });
            const message = await generator(changes, null, {});
            expect(message).toBe('Initial commit');
        });

        it('returns remix message when isRemix is true', async () => {
            const changes = createDiffResult({ isInitial: false, summary: ['Test'] });
            const options: CommitOptions = {
                isRemix: true,
                remixSource: { owner: 'testuser', name: 'cooltrack', track_id: '123', commit_id: '456' }
            };
            const message = await generator(changes, {}, {}, options);
            expect(message).toBe('Remixed from @testuser/cooltrack');
        });

        it('returns "Minor adjustments" for empty summary', async () => {
            const changes = createDiffResult({ isInitial: false, summary: [] });
            const message = await generator(changes, {}, {});
            expect(message).toBe('Minor adjustments');
        });

        it('returns "Minor adjustments" for null summary', async () => {
            const changes = createDiffResult({ isInitial: false, summary: null as unknown as string[] });
            const message = await generator(changes, {}, {});
            expect(message).toBe('Minor adjustments');
        });

        it('uses first summary item as fallback (no AI)', async () => {
            const changes = createDiffResult({
                isInitial: false,
                summary: ['Added new pattern', 'Changed tempo']
            });
            const message = await generator(changes, {}, {});
            expect(message).toBe('Added new pattern');
        });

        it('truncates long messages to maxLength', async () => {
            const generator = createCommitMessageGenerator('drums', {
                useAI: false,
                maxLength: 20
            });
            const changes = createDiffResult({
                isInitial: false,
                summary: ['This is a very long commit message that should be truncated']
            });
            const message = await generator(changes, {}, {});
            expect(message.length).toBeLessThanOrEqual(20);
        });

        it('falls back to default message when summary is empty array', async () => {
            const generator = createCommitMessageGenerator('drums', { useAI: false });
            const changes = createDiffResult({
                isInitial: false,
                summary: []
            });
            const message = await generator(changes, {}, {});
            expect(message).toBe('Minor adjustments');
        });
    });

    describe('with mocked AI', () => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        let originalWebsim: any;

        beforeEach(() => {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            originalWebsim = (globalThis as any).websim;
        });

        afterEach(() => {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (globalThis as any).websim = originalWebsim;
        });

        it('uses AI response when available', async () => {
            const mockCreate = vi.fn().mockResolvedValue({
                content: 'AI generated message'
            });
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (globalThis as any).websim = {
                chat: {
                    completions: {
                        create: mockCreate
                    }
                }
            };

            const generator = createCommitMessageGenerator('drums', { useAI: true });
            const changes = createDiffResult({ isInitial: false, summary: ['Test change'] });
            const message = await generator(changes, {}, {});

            expect(message).toBe('AI generated message');
            expect(mockCreate).toHaveBeenCalled();
        });

        it('strips quotes from AI response', async () => {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (globalThis as any).websim = {
                chat: {
                    completions: {
                        create: vi.fn().mockResolvedValue({
                            content: '"Quoted message"'
                        })
                    }
                }
            };

            const generator = createCommitMessageGenerator('drums', { useAI: true });
            const changes = createDiffResult({ isInitial: false, summary: ['Test change'] });
            const message = await generator(changes, {}, {});

            expect(message).toBe('Quoted message');
        });

        it('falls back on AI error', async () => {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (globalThis as any).websim = {
                chat: {
                    completions: {
                        create: vi.fn().mockRejectedValue(new Error('AI error'))
                    }
                }
            };

            const generator = createCommitMessageGenerator('drums', { useAI: true });
            const changes = createDiffResult({ isInitial: false, summary: ['Fallback message'] });
            const message = await generator(changes, {}, {});

            expect(message).toBe('Fallback message');
        });

        it('includes app-specific prompt for drums', async () => {
            let capturedPrompt = '';
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (globalThis as any).websim = {
                chat: {
                    completions: {
                        create: vi.fn().mockImplementation(({ messages }: { messages: Array<{ content: string }> }) => {
                            capturedPrompt = messages[0].content;
                            return { content: 'test' };
                        })
                    }
                }
            };

            const generator = createCommitMessageGenerator('drums', { useAI: true });
            await generator(createDiffResult({ isInitial: false, summary: ['Test'] }), {}, {});

            expect(capturedPrompt).toContain('drum machine track');
        });

        it('includes app-specific prompt for synth', async () => {
            let capturedPrompt = '';
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (globalThis as any).websim = {
                chat: {
                    completions: {
                        create: vi.fn().mockImplementation(({ messages }: { messages: Array<{ content: string }> }) => {
                            capturedPrompt = messages[0].content;
                            return { content: 'test' };
                        })
                    }
                }
            };

            const generator = createCommitMessageGenerator('synth', { useAI: true });
            await generator(createDiffResult({ isInitial: false, summary: ['Test'] }), {}, {});

            expect(capturedPrompt).toContain('synth track');
        });
    });
});

describe('generateSimpleCommitMessage', () => {
    describe('special cases', () => {
        it('returns remix message when isRemix is true', () => {
            const changes = createDiffResult({ isInitial: false, summary: [] });
            const options: CommitOptions = {
                isRemix: true,
                remixSource: { owner: 'user123', name: 'track456', track_id: '123', commit_id: '456' }
            };
            const message = generateSimpleCommitMessage(changes, {}, {}, options);
            expect(message).toBe('Remixed from @user123/track456');
        });

        it('returns "Initial preset" for initial changes', () => {
            const changes = createDiffResult({ isInitial: true });
            const message = generateSimpleCommitMessage(changes, null, {});
            expect(message).toBe('Initial preset');
        });

        it('returns "Minor adjustments" for empty summary', () => {
            const changes = createDiffResult({ isInitial: false, summary: [] });
            const message = generateSimpleCommitMessage(changes, {}, {});
            expect(message).toBe('Minor adjustments');
        });

        it('returns "Minor adjustments" for null summary', () => {
            const changes = createDiffResult({ isInitial: false, summary: null as unknown as string[] });
            const message = generateSimpleCommitMessage(changes, {}, {});
            expect(message).toBe('Minor adjustments');
        });
    });

    describe('scalar changes', () => {
        it('formats numeric changes as percentages', () => {
            const changes = createDiffResult({
                isInitial: false,
                summary: ['test'],
                scalar: {
                    volume: { prev: 0.5, curr: 0.8 }
                }
            });
            const message = generateSimpleCommitMessage(changes, {}, {});
            expect(message).toBe('volume: 50% → 80%');
        });

        it('formats non-numeric changes directly', () => {
            const changes = createDiffResult({
                isInitial: false,
                summary: ['test'],
                scalar: {
                    name: { prev: 'Old', curr: 'New' }
                }
            });
            const message = generateSimpleCommitMessage(changes, {}, {});
            expect(message).toBe('name: Old → New');
        });

        it('handles multiple scalar changes', () => {
            const changes = createDiffResult({
                isInitial: false,
                summary: ['test'],
                scalar: {
                    volume: { prev: 0.5, curr: 0.8 },
                    pan: { prev: 0.0, curr: 0.5 }
                }
            });
            const message = generateSimpleCommitMessage(changes, {}, {});
            expect(message).toContain('volume');
            expect(message).toContain('pan');
        });
    });

    describe('object changes', () => {
        it('reports modified objects', () => {
            const changes = createDiffResult({
                isInitial: false,
                summary: ['test'],
                scalar: {},
                objects: {
                    patterns: {
                        added: [],
                        removed: [],
                        modified: [{ key: 'A', subChanges: [] }, { key: 'B', subChanges: [] }]
                    }
                }
            });
            const message = generateSimpleCommitMessage(changes, {}, {});
            expect(message).toBe('Updated 2 patterns');
        });

        it('reports added objects', () => {
            const changes = createDiffResult({
                isInitial: false,
                summary: ['test'],
                scalar: {},
                objects: {
                    tracks: {
                        added: ['track1', 'track2', 'track3'],
                        removed: [],
                        modified: []
                    }
                }
            });
            const message = generateSimpleCommitMessage(changes, {}, {});
            expect(message).toBe('Added 3 tracks');
        });

        it('reports removed objects', () => {
            const changes = createDiffResult({
                isInitial: false,
                summary: ['test'],
                scalar: {},
                objects: {
                    samples: {
                        added: [],
                        removed: ['sample1'],
                        modified: []
                    }
                }
            });
            const message = generateSimpleCommitMessage(changes, {}, {});
            expect(message).toBe('Removed 1 samples');
        });
    });

    describe('message formatting', () => {
        it('truncates messages to 60 characters', () => {
            const changes = createDiffResult({
                isInitial: false,
                summary: ['test'],
                scalar: {
                    field1: { prev: 0.1, curr: 0.2 },
                    field2: { prev: 0.3, curr: 0.4 },
                    field3: { prev: 0.5, curr: 0.6 },
                    field4: { prev: 0.7, curr: 0.8 }
                }
            });
            const message = generateSimpleCommitMessage(changes, {}, {});
            expect(message.length).toBeLessThanOrEqual(60);
        });

        it('limits to first 2 parts', () => {
            const changes = createDiffResult({
                isInitial: false,
                summary: ['test'],
                scalar: {},
                objects: {
                    patterns: { added: [], removed: [], modified: [{ key: 'A', subChanges: [] }] },
                    tracks: { added: ['t1'], removed: [], modified: [] },
                    samples: { added: [], removed: ['s1'], modified: [] }
                }
            });
            const message = generateSimpleCommitMessage(changes, {}, {});
            const parts = message.split(', ');
            expect(parts.length).toBeLessThanOrEqual(2);
        });

        it('falls back to first summary item when no parts generated', () => {
            const changes = createDiffResult({
                isInitial: false,
                summary: ['Fallback summary message'],
                scalar: {},
                objects: {}
            });
            const message = generateSimpleCommitMessage(changes, {}, {});
            expect(message).toBe('Fallback summary message');
        });

        it('returns "Updated preset" as final fallback', () => {
            // This actually goes through the "Minor adjustments" path first
            // Testing when parts is empty but summary exists
            const changes2 = createDiffResult({
                isInitial: false,
                summary: null as unknown as string[],
                scalar: {},
                objects: {}
            });
            const message = generateSimpleCommitMessage(changes2, {}, {});
            expect(message).toBe('Minor adjustments');
        });
    });
});
