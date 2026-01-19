/**
 * Tests for neon-cloud state diffing functions
 */

import { describe, it, expect } from 'vitest';
import { diffState, hasChanges, createDiffConfig, DEFAULT_DIFF_CONFIG } from '../src/diff';

describe('DEFAULT_DIFF_CONFIG', () => {
    it('has expected scalar fields', () => {
        expect(DEFAULT_DIFF_CONFIG.scalarFields).toContain('bpm');
        expect(DEFAULT_DIFF_CONFIG.scalarFields).toContain('name');
        expect(DEFAULT_DIFF_CONFIG.scalarFields).toContain('description');
        expect(DEFAULT_DIFF_CONFIG.scalarFields).toContain('thumbnailUrl');
    });

    it('has expected object fields', () => {
        expect(DEFAULT_DIFF_CONFIG.objectFields).toContain('patterns');
        expect(DEFAULT_DIFF_CONFIG.objectFields).toContain('trackParams');
    });

    it('has expected array fields', () => {
        expect(DEFAULT_DIFF_CONFIG.arrayFields).toContain('trackMeasures');
        expect(DEFAULT_DIFF_CONFIG.arrayFields).toContain('patternChain');
    });

    it('has expected ignore fields', () => {
        expect(DEFAULT_DIFF_CONFIG.ignoreFields).toContain('_id');
        expect(DEFAULT_DIFF_CONFIG.ignoreFields).toContain('id');
        expect(DEFAULT_DIFF_CONFIG.ignoreFields).toContain('createdAt');
        expect(DEFAULT_DIFF_CONFIG.ignoreFields).toContain('updatedAt');
    });
});

describe('diffState', () => {
    describe('initial commit', () => {
        it('returns initial commit when prev is null', () => {
            const curr = { bpm: 120, name: 'Test' };
            const result = diffState(null, curr);

            expect(result.isInitial).toBe(true);
            expect(result.hasChanges).toBe(true);
            expect(result.summary).toContain('Initial commit');
        });

        it('returns initial commit when prev is undefined', () => {
            const curr = { bpm: 120 };
            const result = diffState(undefined, curr);

            expect(result.isInitial).toBe(true);
            expect(result.hasChanges).toBe(true);
        });
    });

    describe('scalar field changes', () => {
        it('detects bpm change', () => {
            const prev = { bpm: 120 };
            const curr = { bpm: 140 };
            const result = diffState(prev, curr);

            expect(result.hasChanges).toBe(true);
            expect(result.scalar.bpm).toEqual({ prev: 120, curr: 140 });
            expect(result.summary).toContain('Tempo: 120 → 140 BPM');
        });

        it('detects name change', () => {
            const prev = { name: 'Old Name' };
            const curr = { name: 'New Name' };
            const result = diffState(prev, curr);

            expect(result.hasChanges).toBe(true);
            expect(result.scalar.name).toEqual({ prev: 'Old Name', curr: 'New Name' });
            expect(result.summary).toContain('Renamed to "New Name"');
        });

        it('detects description change', () => {
            const prev = { description: 'Old desc' };
            const curr = { description: 'New desc' };
            const result = diffState(prev, curr);

            expect(result.hasChanges).toBe(true);
            expect(result.scalar.description).toBeDefined();
            expect(result.summary).toContain('Updated description');
        });

        it('detects thumbnailUrl change', () => {
            const prev = { thumbnailUrl: 'old.png' };
            const curr = { thumbnailUrl: 'new.png' };
            const result = diffState(prev, curr);

            expect(result.hasChanges).toBe(true);
            expect(result.summary).toContain('New artwork');
        });

        it('detects no changes when values are equal', () => {
            const prev = { bpm: 120, name: 'Test' };
            const curr = { bpm: 120, name: 'Test' };
            const result = diffState(prev, curr);

            expect(result.hasChanges).toBe(false);
            expect(Object.keys(result.scalar)).toHaveLength(0);
        });
    });

    describe('object field changes', () => {
        it('detects added pattern', () => {
            const prev = { patterns: {} };
            const curr = { patterns: { pattern1: { tracks: [] } } };
            const result = diffState(prev, curr);

            expect(result.hasChanges).toBe(true);
            expect(result.objects.patterns.added).toContain('pattern1');
            expect(result.summary.some(s => s.includes('Added patterns'))).toBe(true);
        });

        it('detects removed pattern', () => {
            const prev = { patterns: { pattern1: { tracks: [] } } };
            const curr = { patterns: {} };
            const result = diffState(prev, curr);

            expect(result.hasChanges).toBe(true);
            expect(result.objects.patterns.removed).toContain('pattern1');
            expect(result.summary.some(s => s.includes('Cleared patterns'))).toBe(true);
        });

        it('detects modified pattern', () => {
            const prev = { patterns: { pattern1: { tracks: [1, 0, 1] } } };
            const curr = { patterns: { pattern1: { tracks: [1, 1, 1] } } };
            const result = diffState(prev, curr);

            expect(result.hasChanges).toBe(true);
            expect(result.objects.patterns.modified.length).toBe(1);
            expect(result.objects.patterns.modified[0].key).toBe('pattern1');
            expect(result.summary.some(s => s.includes('Modified patterns'))).toBe(true);
        });

        it('detects trackParams changes', () => {
            const prev = { trackParams: { kick: { volume: 0.8 } } };
            const curr = { trackParams: { kick: { volume: 1.0 } } };
            const result = diffState(prev, curr);

            expect(result.hasChanges).toBe(true);
            expect(result.objects.trackParams.modified[0].key).toBe('kick');
            expect(result.summary.some(s => s.includes('Sound tweaks'))).toBe(true);
        });

        it('handles undefined object fields', () => {
            const prev = {};
            const curr = { patterns: { pattern1: {} } };
            const result = diffState(prev, curr);

            expect(result.hasChanges).toBe(true);
            expect(result.objects.patterns.added).toContain('pattern1');
        });
    });

    describe('array field changes', () => {
        it('detects trackMeasures length change', () => {
            const prev = { trackMeasures: [1, 2] };
            const curr = { trackMeasures: [1, 2, 3, 4] };
            const result = diffState(prev, curr);

            expect(result.hasChanges).toBe(true);
            expect(result.arrays.trackMeasures.prevLength).toBe(2);
            expect(result.arrays.trackMeasures.currLength).toBe(4);
            expect(result.summary.some(s => s.includes('Arrangement'))).toBe(true);
        });

        it('detects trackMeasures content change', () => {
            const prev = { trackMeasures: [1, 2, 3] };
            const curr = { trackMeasures: [3, 2, 1] };
            const result = diffState(prev, curr);

            expect(result.hasChanges).toBe(true);
            expect(result.arrays.trackMeasures.changed).toBe(true);
            expect(result.summary.some(s => s.includes('reordered'))).toBe(true);
        });

        it('detects patternChain changes', () => {
            const prev = { patternChain: ['A', 'B'] };
            const curr = { patternChain: ['A', 'B', 'C'] };
            const result = diffState(prev, curr);

            expect(result.hasChanges).toBe(true);
            expect(result.summary).toContain('Pattern chain updated');
        });

        it('filters null values when counting length', () => {
            const prev = { trackMeasures: [1, null, 2] };
            const curr = { trackMeasures: [1, 2, 3] };
            const result = diffState(prev, curr);

            expect(result.arrays.trackMeasures.prevLength).toBe(2);
            expect(result.arrays.trackMeasures.currLength).toBe(3);
        });

        it('handles undefined array fields', () => {
            const prev = {};
            const curr = { trackMeasures: [1, 2] };
            const result = diffState(prev, curr);

            expect(result.hasChanges).toBe(true);
            expect(result.arrays.trackMeasures.prevLength).toBe(0);
            expect(result.arrays.trackMeasures.currLength).toBe(2);
        });
    });

    describe('combined changes', () => {
        it('detects multiple types of changes', () => {
            const prev = {
                bpm: 120,
                name: 'Song 1',
                patterns: { A: { tracks: [] } },
                trackMeasures: [1, 2]
            };
            const curr = {
                bpm: 140,
                name: 'Song 2',
                patterns: { A: { tracks: [] }, B: { tracks: [] } },
                trackMeasures: [1, 2, 3, 4]
            };
            const result = diffState(prev, curr);

            expect(result.hasChanges).toBe(true);
            expect(result.scalar.bpm).toBeDefined();
            expect(result.scalar.name).toBeDefined();
            expect(result.objects.patterns.added).toContain('B');
            expect(result.arrays.trackMeasures).toBeDefined();
            expect(result.summary.length).toBeGreaterThan(1);
        });

        it('returns no changes for identical states', () => {
            const state = {
                bpm: 120,
                name: 'Test',
                patterns: { A: { tracks: [1, 0, 1] } },
                trackParams: { kick: { volume: 0.8 } },
                trackMeasures: [1, 2, 3]
            };
            const result = diffState(state, { ...state });

            expect(result.hasChanges).toBe(false);
            expect(Object.keys(result.scalar)).toHaveLength(0);
            expect(Object.keys(result.objects)).toHaveLength(0);
            expect(Object.keys(result.arrays)).toHaveLength(0);
        });
    });

    describe('custom config', () => {
        it('uses custom scalar fields', () => {
            const config = createDiffConfig({ scalarFields: ['customField'] });
            const prev = { customField: 'old', bpm: 120 };
            const curr = { customField: 'new', bpm: 140 };
            const result = diffState(prev, curr, config);

            expect(result.scalar.customField).toBeDefined();
            expect(result.scalar.bpm).toBeUndefined();
        });

        it('uses custom object fields', () => {
            const config = createDiffConfig({ objectFields: ['customObj'] });
            const prev = { customObj: { a: 1 }, patterns: {} };
            const curr = { customObj: { a: 2 }, patterns: { p1: {} } };
            const result = diffState(prev, curr, config);

            expect(result.objects.customObj).toBeDefined();
            expect(result.objects.patterns).toBeUndefined();
        });
    });
});

describe('hasChanges', () => {
    it('returns true when changes exist', () => {
        const changes = { hasChanges: true };
        expect(hasChanges(changes as ReturnType<typeof diffState>)).toBe(true);
    });

    it('returns false when no changes exist', () => {
        const changes = { hasChanges: false };
        expect(hasChanges(changes as ReturnType<typeof diffState>)).toBe(false);
    });
});

describe('createDiffConfig', () => {
    it('returns default config when no overrides provided', () => {
        const config = createDiffConfig();
        expect(config.scalarFields).toEqual(DEFAULT_DIFF_CONFIG.scalarFields);
        expect(config.objectFields).toEqual(DEFAULT_DIFF_CONFIG.objectFields);
        expect(config.arrayFields).toEqual(DEFAULT_DIFF_CONFIG.arrayFields);
        expect(config.ignoreFields).toEqual(DEFAULT_DIFF_CONFIG.ignoreFields);
    });

    it('overrides scalar fields', () => {
        const config = createDiffConfig({ scalarFields: ['custom'] });
        expect(config.scalarFields).toEqual(['custom']);
        expect(config.objectFields).toEqual(DEFAULT_DIFF_CONFIG.objectFields);
    });

    it('overrides object fields', () => {
        const config = createDiffConfig({ objectFields: ['custom'] });
        expect(config.objectFields).toEqual(['custom']);
        expect(config.scalarFields).toEqual(DEFAULT_DIFF_CONFIG.scalarFields);
    });

    it('overrides array fields', () => {
        const config = createDiffConfig({ arrayFields: ['custom'] });
        expect(config.arrayFields).toEqual(['custom']);
    });

    it('overrides ignore fields', () => {
        const config = createDiffConfig({ ignoreFields: ['custom'] });
        expect(config.ignoreFields).toEqual(['custom']);
    });

    it('returns new arrays (not references)', () => {
        const config = createDiffConfig();
        config.scalarFields.push('test');
        expect(DEFAULT_DIFF_CONFIG.scalarFields).not.toContain('test');
    });
});
