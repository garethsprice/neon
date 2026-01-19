/**
 * Neon Cloud - Collaborative Music Project Library
 *
 * A git-like versioning and collaboration system for music applications.
 * Provides track management, commit history, likes, plays, and real-time sync.
 *
 * @example
 * import { CloudStore, createCloudStore } from '@neon/cloud';
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

// Types
export type {
  TrackVisibility,
  RemixSource,
  TrackStats,
  Track,
  Commit,
  Like,
  Play,
  User,
  ScalarChange,
  ObjectModification,
  ObjectFieldChanges,
  ArrayFieldChanges,
  DiffResult,
  DiffConfig,
  CommitOptions,
  TrackMetadata,
  CommitResult,
  LoadResult,
  FeedOptions,
  EnrichedTrack,
  FeedResult,
  EventCallback,
  ChangeEventData,
  CommittedEventData,
  LoadedEventData,
  CloudStoreOptions,
  CommitMessageGenerator,
  TrackLoaderConfig,
  LoadOptions,
  LoaderResult,
  AppPrompt,
  CommitGeneratorOptions
} from './types';

// Main store class
export { CloudStore, createCloudStore } from './store';

// Diffing utilities
export {
  diffState,
  hasChanges,
  createDiffConfig,
  DEFAULT_DIFF_CONFIG
} from './diff';

// Utility functions
export {
  timeAgo,
  deepEqual,
  generateId,
  debounce
} from './utils';

// Track/commit loading helpers
export { createTrackLoader } from './loaders';

// Commit message generation
export {
  createCommitMessageGenerator,
  generateSimpleCommitMessage
} from './commit-generator';

// UI Components
export {
  createCloudEventHandlers,
  createSaveButtonManager,
  createHistoryIndicator
} from './components/event-handlers';

// High-level app integration
export {
  createCloudApp,
  type CloudAppConfig,
  type CloudAppInstance,
  type CloudElements,
  type FeedItemTemplate,
  type AppType
} from './cloud-app';
