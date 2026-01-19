/**
 * Neon Cloud - Type Definitions
 */

/** Track visibility options */
export type TrackVisibility = 'public' | 'private';

/** Remix source information */
export interface RemixSource {
  track_id: string;
  commit_id: string | null;
  owner: string;
  name: string;
}

/** Track statistics */
export interface TrackStats {
  likes?: number;
  plays?: number;
  commits?: number;
  remixes?: number;
  bpm?: number;
  [key: string]: unknown;
}

/** Track record */
export interface Track {
  id: string;
  name: string;
  description: string;
  owner: string;
  visibility: TrackVisibility;
  thumbnail_url: string | null;
  head_commit_id: string | null;
  remixed_from: RemixSource | null;
  stats: TrackStats;
  created_at?: string;
  updated_at?: string;
}

/** Commit record */
export interface Commit {
  id: string;
  track_id: string;
  parent_id: string | null;
  author: string;
  message: string;
  data: Record<string, unknown>;
  created_at?: string;
}

/** Like record */
export interface Like {
  id: string;
  track_id: string;
  username: string;
  created_at?: string;
}

/** Play record */
export interface Play {
  id: string;
  track_id: string;
  username?: string;
  created_at?: string;
}

/** User information */
export interface User {
  username: string;
  [key: string]: unknown;
}

/** Scalar change detail */
export interface ScalarChange {
  prev: unknown;
  curr: unknown;
}

/** Object field modification detail */
export interface ObjectModification {
  key: string;
  subChanges: string[];
}

/** Object field changes */
export interface ObjectFieldChanges {
  added: string[];
  removed: string[];
  modified: ObjectModification[];
}

/** Array field changes */
export interface ArrayFieldChanges {
  prevLength: number;
  currLength: number;
  changed: boolean;
}

/** State diff result */
export interface DiffResult {
  isInitial: boolean;
  hasChanges: boolean;
  scalar: Record<string, ScalarChange>;
  objects: Record<string, ObjectFieldChanges>;
  arrays: Record<string, ArrayFieldChanges>;
  summary: string[];
}

/** Diff configuration */
export interface DiffConfig {
  scalarFields: string[];
  objectFields: string[];
  arrayFields: string[];
  ignoreFields: string[];
}

/** Commit options */
export interface CommitOptions {
  force?: boolean;
  visibility?: TrackVisibility;
  isInitial?: boolean;
  isRemix?: boolean;
  remixSource?: RemixSource;
}

/** Track metadata for commits */
export interface TrackMetadata {
  name?: string;
  description?: string;
  thumbnailUrl?: string;
  stats?: TrackStats;
}

/** Commit result */
export interface CommitResult {
  track?: Track;
  commit?: Commit;
  message?: string;
  isNewTrack?: boolean;
  isRemix?: boolean;
  error?: string;
}

/** Load result */
export interface LoadResult {
  track?: Track;
  commit?: Commit;
  data?: Record<string, unknown>;
  isHistory?: boolean;
  error?: string;
  message?: string;
}

/** Feed options */
export interface FeedOptions {
  filter?: 'all' | 'mine';
  page?: number;
  pageSize?: number;
  sortBy?: 'recent' | 'popular';
}

/** Enriched track with stats and user info */
export interface EnrichedTrack extends Track {
  isLiked: boolean;
  isOwner: boolean;
  latestCommit?: Commit;
}

/** Feed result */
export interface FeedResult {
  items: EnrichedTrack[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

/** Event callback type */
export type EventCallback<T = unknown> = (data: T) => void;

/** Change event data */
export interface ChangeEventData {
  type: string;
  data: unknown;
}

/** Committed event data */
export interface CommittedEventData {
  track: Track;
  commit: Commit;
  isNewTrack: boolean;
  isRemix: boolean;
}

/** Loaded event data */
export interface LoadedEventData {
  track: Track;
  commit: Commit;
  isHistory: boolean;
}

/** CloudStore options */
export interface CloudStoreOptions {
  room?: WebsimSocketInstance;
  diffConfig?: DiffConfig;
  generateCommitMessage?: CommitMessageGenerator;
  getCurrentUser?: () => Promise<User>;
  collectionPrefix?: string;
}

/** Commit message generator function */
export type CommitMessageGenerator = (
  changes: DiffResult,
  prevData: Record<string, unknown> | null,
  currData: Record<string, unknown>,
  options?: CommitOptions
) => Promise<string> | string;

/** Track loader config */
export interface TrackLoaderConfig {
  stopPlayback?: () => void;
  applyState: (data: Record<string, unknown>) => void;
  updateUI?: () => void;
  closeSidebar?: () => void;
  autoPlayDelay?: number;
}

/** Load options for loader functions */
export interface LoadOptions {
  autoPlay?: boolean;
  startPlayback?: () => void;
  isPlaying?: boolean;
}

/** Loader result */
export interface LoaderResult {
  success: boolean;
  data?: Record<string, unknown>;
  error?: string;
}

/** App prompts for commit generation */
export interface AppPrompt {
  type: string;
  examples: string;
}

/** Commit generator options */
export interface CommitGeneratorOptions {
  maxLength?: number;
  useAI?: boolean;
}
