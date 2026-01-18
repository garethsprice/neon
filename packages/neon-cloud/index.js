/**
 * Neon Cloud - Collaborative Music Project Library
 *
 * A git-like versioning and collaboration system for music applications.
 * Provides track management, commit history, likes, plays, and real-time sync.
 *
 * @example
 * import { CloudStore, createCloudStore } from './neon-cloud/index.js';
 *
 * // Create a store with WebsimSocket
 * const store = createCloudStore({
 *     room: new WebsimSocket(),
 *     getCurrentUser: () => websim.getCurrentUser(),
 *     generateCommitMessage: async (changes) => {
 *         // Custom AI-powered commit message generation
 *         return changes.summary[0] || 'Updated';
 *     }
 * });
 *
 * // Listen for events
 * store.on('committed', ({ track, commit }) => {
 *     showToast(`Saved: ${commit.message}`);
 * });
 *
 * store.on('loaded', ({ track, commit, data }) => {
 *     sequencer.deserialize(data);
 *     renderUI();
 * });
 *
 * // Commit changes
 * const result = await store.commit(
 *     sequencer.serialize(),
 *     { name: 'My Track', bpm: 120 }
 * );
 *
 * // Load a track
 * await store.loadTrack(trackId);
 *
 * // Get feed data
 * const feed = await store.getFeed({ filter: 'all', page: 1 });
 */

// Main store class
export { CloudStore, createCloudStore } from './store.js';

// Diffing utilities
export {
    diffState,
    hasChanges,
    createDiffConfig,
    DEFAULT_DIFF_CONFIG
} from './diff.js';

// Utility functions
export {
    timeAgo,
    deepEqual,
    generateId,
    debounce
} from './utils.js';

// Track/commit loading helpers
export { createTrackLoader } from './loaders.js';

// Commit message generation
export {
    createCommitMessageGenerator,
    generateSimpleCommitMessage
} from './commit-generator.js';

// UI Components
export {
    createCloudEventHandlers,
    createSaveButtonManager,
    createHistoryIndicator
} from './components/event-handlers.js';
