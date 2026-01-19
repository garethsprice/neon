/**
 * Neon Cloud - State Diffing
 *
 * Generic state diffing system for detecting changes between versions.
 * Configurable for different project structures.
 */

import { deepEqual } from './utils';
import type {
  DiffConfig,
  DiffResult,
  ScalarChange,
  ObjectFieldChanges,
  ObjectModification
} from './types';

/**
 * Default diff configuration for music projects
 */
export const DEFAULT_DIFF_CONFIG: DiffConfig = {
  // Top-level fields to track (simple equality check)
  scalarFields: ['bpm', 'name', 'description', 'thumbnailUrl'],

  // Object fields where we track which keys changed
  objectFields: ['patterns', 'trackParams'],

  // Array fields where we track length and content changes
  arrayFields: ['trackMeasures', 'patternChain'],

  // Fields to ignore in diffing
  ignoreFields: ['_id', 'id', 'createdAt', 'updatedAt']
};

/**
 * Diff two states and return a detailed change summary
 */
export function diffState(
  prev: Record<string, unknown> | null | undefined,
  curr: Record<string, unknown>,
  config: DiffConfig = DEFAULT_DIFF_CONFIG
): DiffResult {
  const changes: DiffResult = {
    isInitial: !prev,
    hasChanges: false,
    scalar: {},
    objects: {},
    arrays: {},
    summary: []
  };

  if (!prev) {
    changes.hasChanges = true;
    changes.summary.push('Initial commit');
    return changes;
  }

  // Check scalar fields
  for (const field of config.scalarFields) {
    const prevVal = prev[field];
    const currVal = curr[field];
    if (prevVal !== currVal) {
      changes.scalar[field] = { prev: prevVal, curr: currVal };
      changes.hasChanges = true;
    }
  }

  // Check object fields (patterns, trackParams, etc.)
  for (const field of config.objectFields) {
    const prevObj = (prev[field] || {}) as Record<string, unknown>;
    const currObj = (curr[field] || {}) as Record<string, unknown>;
    const allKeys = new Set([...Object.keys(prevObj), ...Object.keys(currObj)]);

    const fieldChanges: ObjectFieldChanges = { added: [], removed: [], modified: [] };

    for (const key of allKeys) {
      const prevVal = prevObj[key];
      const currVal = currObj[key];

      if (!prevVal && currVal) {
        fieldChanges.added.push(key);
      } else if (prevVal && !currVal) {
        fieldChanges.removed.push(key);
      } else if (!deepEqual(prevVal, currVal)) {
        // For patterns, try to identify which sub-keys changed
        if (typeof prevVal === 'object' && typeof currVal === 'object') {
          const subChanges = getModifiedSubKeys(
            prevVal as Record<string, unknown>,
            currVal as Record<string, unknown>
          );
          fieldChanges.modified.push({ key, subChanges });
        } else {
          fieldChanges.modified.push({ key, subChanges: [] });
        }
      }
    }

    if (fieldChanges.added.length || fieldChanges.removed.length || fieldChanges.modified.length) {
      changes.objects[field] = fieldChanges;
      changes.hasChanges = true;
    }
  }

  // Check array fields
  for (const field of config.arrayFields) {
    const prevArr = (prev[field] || []) as unknown[];
    const currArr = (curr[field] || []) as unknown[];
    const prevLength = Array.isArray(prevArr) ? prevArr.filter(x => x !== null).length : 0;
    const currLength = Array.isArray(currArr) ? currArr.filter(x => x !== null).length : 0;
    const changed = JSON.stringify(prevArr) !== JSON.stringify(currArr);

    if (changed) {
      changes.arrays[field] = { prevLength, currLength, changed };
      changes.hasChanges = true;
    }
  }

  // Generate summary strings
  changes.summary = generateSummary(changes, prev, curr);

  return changes;
}

/**
 * Get which sub-keys of an object changed
 */
function getModifiedSubKeys(
  prev: Record<string, unknown> | null | undefined,
  curr: Record<string, unknown> | null | undefined
): string[] {
  const modified: string[] = [];
  const allKeys = new Set([...Object.keys(prev || {}), ...Object.keys(curr || {})]);

  for (const key of allKeys) {
    if (!deepEqual(prev?.[key], curr?.[key])) {
      modified.push(key);
    }
  }

  return modified;
}

/**
 * Generate human-readable summary strings from changes
 */
function generateSummary(
  changes: DiffResult,
  _prev: Record<string, unknown>,
  _curr: Record<string, unknown>
): string[] {
  const parts: string[] = [];

  // Scalar changes
  if (changes.scalar.bpm) {
    const bpmChange = changes.scalar.bpm as ScalarChange;
    parts.push(`Tempo: ${bpmChange.prev} → ${bpmChange.curr} BPM`);
  }
  if (changes.scalar.name) {
    const nameChange = changes.scalar.name as ScalarChange;
    parts.push(`Renamed to "${nameChange.curr}"`);
  }
  if (changes.scalar.description) {
    parts.push('Updated description');
  }
  if (changes.scalar.thumbnailUrl) {
    parts.push('New artwork');
  }

  // Object changes (patterns, params)
  for (const [field, fieldChanges] of Object.entries(changes.objects)) {
    if (field === 'patterns') {
      if (fieldChanges.added.length) {
        parts.push(`Added patterns: ${fieldChanges.added.join(', ')}`);
      }
      if (fieldChanges.removed.length) {
        parts.push(`Cleared patterns: ${fieldChanges.removed.join(', ')}`);
      }
      if (fieldChanges.modified.length) {
        const details = fieldChanges.modified.map((m: ObjectModification) => {
          if (m.subChanges.length) {
            // Filter to just track changes
            const tracks = m.subChanges.filter(s => s === 'tracks');
            return tracks.length ? m.key : `${m.key} (${m.subChanges.join(', ')})`;
          }
          return m.key;
        });
        parts.push(`Modified patterns: ${details.join(', ')}`);
      }
    } else if (field === 'trackParams') {
      if (fieldChanges.modified.length) {
        const details = fieldChanges.modified.map((m: ObjectModification) => {
          return m.subChanges.length ? `${m.key} (${m.subChanges.join(', ')})` : m.key;
        });
        parts.push(`Sound tweaks: ${details.join(', ')}`);
      }
    }
  }

  // Array changes
  if (changes.arrays.trackMeasures) {
    const { prevLength, currLength } = changes.arrays.trackMeasures;
    if (currLength !== prevLength) {
      parts.push(`Arrangement: ${prevLength} → ${currLength} measures`);
    } else {
      parts.push('Arrangement reordered');
    }
  }
  if (changes.arrays.patternChain) {
    parts.push('Pattern chain updated');
  }

  return parts;
}

/**
 * Check if a changes object has any meaningful changes
 */
export function hasChanges(changes: DiffResult): boolean {
  return changes.hasChanges;
}

/**
 * Create a custom diff config by extending the default
 */
export function createDiffConfig(overrides: Partial<DiffConfig> = {}): DiffConfig {
  return {
    scalarFields: [...(overrides.scalarFields || DEFAULT_DIFF_CONFIG.scalarFields)],
    objectFields: [...(overrides.objectFields || DEFAULT_DIFF_CONFIG.objectFields)],
    arrayFields: [...(overrides.arrayFields || DEFAULT_DIFF_CONFIG.arrayFields)],
    ignoreFields: [...(overrides.ignoreFields || DEFAULT_DIFF_CONFIG.ignoreFields)]
  };
}
