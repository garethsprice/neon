/**
 * Neon Cloud - CloudStore
 *
 * Main store class for managing tracks, commits, likes, and plays.
 * Provides a git-like versioning system for music projects.
 */

import { diffState, hasChanges, DEFAULT_DIFF_CONFIG } from './diff';
import type {
  Track,
  Commit,
  Like,
  Play,
  User,
  DiffConfig,
  DiffResult,
  CloudStoreOptions,
  CommitMessageGenerator,
  CommitOptions,
  TrackMetadata,
  CommitResult,
  LoadResult,
  FeedOptions,
  FeedResult,
  EnrichedTrack,
  EventCallback,
  ChangeEventData,
  CommittedEventData,
  LoadedEventData,
  RemixSource,
  TrackStats
} from './types';

type EventMap = {
  tracks: Track[];
  commits: Commit[];
  likes: Like[];
  plays: Play[];
  change: ChangeEventData;
  message: unknown;
  committed: CommittedEventData;
  loaded: LoadedEventData;
  liked: { trackId: string };
  unliked: { trackId: string };
  played: { trackId: string };
  deleted: { trackId: string };
  visibilityChanged: { trackId: string; visibility: string };
  reset: void;
};

/**
 * Event emitter mixin
 */
class EventEmitter {
  private _listeners: Record<string, EventCallback[]> = {};

  on<K extends keyof EventMap>(event: K, callback: EventCallback<EventMap[K]>): () => void {
    if (!this._listeners[event]) this._listeners[event] = [];
    this._listeners[event].push(callback as EventCallback);
    return () => this.off(event, callback);
  }

  off<K extends keyof EventMap>(event: K, callback: EventCallback<EventMap[K]>): void {
    if (!this._listeners[event]) return;
    this._listeners[event] = this._listeners[event].filter(cb => cb !== callback);
  }

  protected emit<K extends keyof EventMap>(event: K, data?: EventMap[K]): void {
    if (!this._listeners[event]) return;
    this._listeners[event].forEach(cb => cb(data));
  }
}

/**
 * CloudStore - Manages collaborative music project data
 */
export class CloudStore extends EventEmitter {
  readonly room?: WebsimSocketInstance;
  readonly diffConfig: DiffConfig;
  readonly generateCommitMessage: CommitMessageGenerator;
  readonly getCurrentUser: () => Promise<User>;
  readonly collectionPrefix: string;

  tracks: Track[] = [];
  commits: Commit[] = [];
  likes: Like[] = [];
  plays: Play[] = [];

  currentTrack: Track | null = null;
  currentCommitId: string | null = null;
  isViewingHistory: boolean = false;
  lastCommitData: Record<string, unknown> | null = null;

  constructor(options: CloudStoreOptions = {}) {
    super();

    this.room = options.room;
    this.diffConfig = options.diffConfig || DEFAULT_DIFF_CONFIG;
    this.generateCommitMessage = options.generateCommitMessage || this._defaultCommitMessage.bind(this);
    this.getCurrentUser = options.getCurrentUser || (() => Promise.resolve({ username: 'anonymous' }));
    this.collectionPrefix = options.collectionPrefix || '';

    // Subscribe to collections if room provided
    if (this.room) {
      this._setupSubscriptions();
    }
  }

  /** Get collection name with prefix */
  private _col(name: string): string {
    return this.collectionPrefix ? `${this.collectionPrefix}_${name}` : name;
  }

  /** Setup real-time subscriptions */
  private _setupSubscriptions(): void {
    if (!this.room) return;

    this.room.collection<Track & WebsimCollectionRecord>(this._col('track_v1')).subscribe((tracks) => {
      this.tracks = tracks;
      this.emit('tracks', tracks);
      this.emit('change', { type: 'tracks', data: tracks });
    });

    this.room.collection<Commit & WebsimCollectionRecord>(this._col('commit_v1')).subscribe((commits) => {
      this.commits = commits;
      this.emit('commits', commits);
      this.emit('change', { type: 'commits', data: commits });
    });

    this.room.collection<Like & WebsimCollectionRecord>(this._col('like_v1')).subscribe((likes) => {
      this.likes = likes;
      this.emit('likes', likes);
      this.emit('change', { type: 'likes', data: likes });
    });

    this.room.collection<Play & WebsimCollectionRecord>(this._col('play_v1')).subscribe((plays) => {
      this.plays = plays;
      this.emit('plays', plays);
      this.emit('change', { type: 'plays', data: plays });
    });

    // Real-time messages
    this.room.onmessage = (event) => {
      this.emit('message', event.data);
    };
  }

  /** Default commit message generator */
  private async _defaultCommitMessage(
    changes: DiffResult,
    _prevData: Record<string, unknown> | null,
    _currData: Record<string, unknown>,
    options: CommitOptions = {}
  ): Promise<string> {
    if (options.isRemix && options.remixSource) {
      return `Remixed from @${options.remixSource.owner}/${options.remixSource.name}`;
    }

    if (changes.isInitial) {
      return 'Initial commit';
    }

    if (changes.summary.length === 0) {
      return 'Minor adjustments';
    }

    // Return first summary item, truncated
    return changes.summary[0].substring(0, 60);
  }

  /** Find a track by ID */
  findTrack(trackId: string): Track | undefined {
    return this.tracks.find(t => t.id === trackId);
  }

  /** Find track by owner and name */
  findTrackByOwnerName(owner: string, name: string): Track | undefined {
    return this.tracks.find(t => t.owner === owner && t.name === name);
  }

  /** Get commit history for a track (newest first) */
  getTrackHistory(trackId: string): Commit[] {
    return this.commits
      .filter(c => c.track_id === trackId)
      .sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime());
  }

  /** Get stats for a track */
  getTrackStats(trackId: string): TrackStats {
    return {
      likes: this.likes.filter(l => l.track_id === trackId).length,
      plays: this.plays.filter(p => p.track_id === trackId).length,
      commits: this.commits.filter(c => c.track_id === trackId).length,
      remixes: this.tracks.filter(t => t.remixed_from?.track_id === trackId).length
    };
  }

  /** Check if user has liked a track */
  async hasLiked(trackId: string): Promise<boolean> {
    const user = await this.getCurrentUser();
    return this.likes.some(l => l.track_id === trackId && l.username === user.username);
  }

  /** Check if current data has changes from last commit */
  checkForChanges(currentData: Record<string, unknown>): { changes: DiffResult; hasChanges: boolean } {
    const changes = diffState(this.lastCommitData, currentData, this.diffConfig);
    return { changes, hasChanges: hasChanges(changes) };
  }

  /** Commit changes to a track */
  async commit(
    data: Record<string, unknown>,
    metadata: TrackMetadata = {},
    options: CommitOptions = {}
  ): Promise<CommitResult> {
    if (!this.room) {
      return { error: 'NO_ROOM', message: 'No room connection' } as CommitResult;
    }

    const user = await this.getCurrentUser();

    // Check for changes
    const changes = diffState(this.lastCommitData, data, this.diffConfig);
    if (this.lastCommitData && !hasChanges(changes) && !options.force) {
      return { error: 'NO_CHANGES', message: 'No changes to save' } as CommitResult;
    }

    let track = this.currentTrack;
    let isNewTrack = false;
    let isRemix = false;
    let remixSource: RemixSource | null = null;

    // Determine if we need a new track
    if (!track && metadata.name) {
      track = this.findTrackByOwnerName(user.username, metadata.name) || null;
    }

    // If track exists but belongs to someone else, create a remix
    if (track && track.owner !== user.username) {
      remixSource = {
        track_id: track.id,
        commit_id: track.head_commit_id,
        owner: track.owner,
        name: track.name
      };
      track = null;
      isRemix = true;
    }

    // Create new track if needed
    if (!track) {
      isNewTrack = true;
      track = await this.room.collection<Track & WebsimCollectionRecord>(this._col('track_v1')).create({
        name: metadata.name || 'Untitled',
        description: metadata.description || '',
        owner: user.username,
        visibility: options.visibility || 'public',
        thumbnail_url: metadata.thumbnailUrl || null,
        head_commit_id: null,
        remixed_from: remixSource,
        stats: metadata.stats || {}
      });
    }

    // Generate commit message
    const message = await this.generateCommitMessage(changes, this.lastCommitData, data, {
      isInitial: isNewTrack && !isRemix,
      isRemix,
      remixSource: remixSource || undefined
    });

    // Create commit
    const commit = await this.room.collection<Commit & WebsimCollectionRecord>(this._col('commit_v1')).create({
      track_id: track.id,
      parent_id: isNewTrack ? null : track.head_commit_id,
      author: user.username,
      message: message,
      data: data
    });

    // Update track's head and metadata
    await this.room.collection<Track & WebsimCollectionRecord>(this._col('track_v1')).update(track.id, {
      head_commit_id: commit.id,
      name: metadata.name || track.name,
      description: metadata.description || track.description || '',
      thumbnail_url: metadata.thumbnailUrl || track.thumbnail_url,
      stats: metadata.stats || track.stats
    });

    // Update local state
    this.currentTrack = { ...track, head_commit_id: commit.id };
    this.currentCommitId = commit.id;
    this.isViewingHistory = false;
    this.lastCommitData = data;

    // Send notification if remix
    if (isRemix && remixSource) {
      this.room.send({
        type: 'track_remixed',
        trackName: metadata.name,
        targetUsername: remixSource.owner,
        senderUsername: user.username
      });
    }

    this.emit('committed', { track: this.currentTrack, commit, isNewTrack, isRemix });

    return { track: this.currentTrack, commit, message, isNewTrack, isRemix };
  }

  /** Load a specific commit */
  async loadCommit(commitId: string): Promise<LoadResult> {
    const commit = this.commits.find(c => c.id === commitId);
    if (!commit || !commit.data) {
      return { error: 'NOT_FOUND', message: 'Commit not found' };
    }

    const track = this.findTrack(commit.track_id);
    if (!track) {
      return { error: 'NOT_FOUND', message: 'Track not found' };
    }

    this.currentTrack = track;
    this.currentCommitId = commitId;
    this.isViewingHistory = track.head_commit_id !== commitId;
    this.lastCommitData = commit.data;

    this.emit('loaded', { track, commit, isHistory: this.isViewingHistory });

    return { track, commit, data: commit.data, isHistory: this.isViewingHistory };
  }

  /** Load the latest version of a track */
  async loadTrack(trackId: string): Promise<LoadResult> {
    const track = this.findTrack(trackId);
    if (!track || !track.head_commit_id) {
      return { error: 'NOT_FOUND', message: 'Track not found' };
    }

    return this.loadCommit(track.head_commit_id);
  }

  /** Toggle like on a track */
  async toggleLike(trackId: string): Promise<{ liked: boolean }> {
    if (!this.room) {
      return { liked: false };
    }

    const user = await this.getCurrentUser();
    const existingLike = this.likes.find(l => l.track_id === trackId && l.username === user.username);

    if (existingLike) {
      await this.room.collection<Like & WebsimCollectionRecord>(this._col('like_v1')).delete(existingLike.id);
      this.emit('unliked', { trackId });
      return { liked: false };
    } else {
      await this.room.collection<Like & WebsimCollectionRecord>(this._col('like_v1')).create({ track_id: trackId });
      const track = this.findTrack(trackId);
      if (track && track.owner !== user.username) {
        this.room.send({
          type: 'track_liked',
          trackName: track.name,
          targetUsername: track.owner,
          senderUsername: user.username
        });
      }
      this.emit('liked', { trackId });
      return { liked: true };
    }
  }

  /** Record a play */
  async recordPlay(trackId: string): Promise<void> {
    if (!this.room) return;

    const user = await this.getCurrentUser();
    await this.room.collection<Play & WebsimCollectionRecord>(this._col('play_v1')).create({ track_id: trackId });

    const track = this.findTrack(trackId);
    if (track && track.owner !== user.username) {
      this.room.send({
        type: 'track_played',
        trackName: track.name,
        targetUsername: track.owner,
        senderUsername: user.username
      });
    }

    this.emit('played', { trackId });
  }

  /** Delete a track and all its commits */
  async deleteTrack(trackId: string): Promise<{ success?: boolean; error?: string; message?: string }> {
    if (!this.room) {
      return { error: 'NO_ROOM', message: 'No room connection' };
    }

    const user = await this.getCurrentUser();
    const track = this.findTrack(trackId);

    if (!track || track.owner !== user.username) {
      return { error: 'UNAUTHORIZED', message: 'Cannot delete this track' };
    }

    // Delete all commits
    const trackCommits = this.commits.filter(c => c.track_id === trackId);
    for (const commit of trackCommits) {
      await this.room.collection<Commit & WebsimCollectionRecord>(this._col('commit_v1')).delete(commit.id);
    }

    // Delete the track
    await this.room.collection<Track & WebsimCollectionRecord>(this._col('track_v1')).delete(trackId);

    // Clear current state if it was this track
    if (this.currentTrack?.id === trackId) {
      this.currentTrack = null;
      this.currentCommitId = null;
      this.lastCommitData = null;
    }

    this.emit('deleted', { trackId });
    return { success: true };
  }

  /** Update track visibility */
  async setVisibility(
    trackId: string,
    visibility: string
  ): Promise<{ success?: boolean; visibility?: string; error?: string; message?: string }> {
    if (!this.room) {
      return { error: 'NO_ROOM', message: 'No room connection' };
    }

    const user = await this.getCurrentUser();
    const track = this.findTrack(trackId);

    if (!track || track.owner !== user.username) {
      return { error: 'UNAUTHORIZED', message: 'Cannot modify this track' };
    }

    await this.room.collection<Track & WebsimCollectionRecord>(this._col('track_v1')).update(trackId, { visibility });
    this.emit('visibilityChanged', { trackId, visibility });
    return { success: true, visibility };
  }

  /** Get filtered and paginated tracks for feed */
  async getFeed(options: FeedOptions = {}): Promise<FeedResult> {
    const {
      filter = 'all',
      page = 1,
      pageSize = 10,
      sortBy = 'recent'
    } = options;

    const user = await this.getCurrentUser();

    const filtered = filter === 'mine'
      ? this.tracks.filter(t => t.owner === user.username)
      : this.tracks.filter(t => t.visibility === 'public');

    // Sort
    if (sortBy === 'recent') {
      filtered.sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime());
    } else if (sortBy === 'popular') {
      filtered.sort((a, b) => {
        const aStats = this.getTrackStats(a.id);
        const bStats = this.getTrackStats(b.id);
        return ((bStats.plays || 0) + (bStats.likes || 0)) - ((aStats.plays || 0) + (aStats.likes || 0));
      });
    }

    const total = filtered.length;
    const totalPages = Math.ceil(total / pageSize);
    const startIdx = (page - 1) * pageSize;
    const items = filtered.slice(startIdx, startIdx + pageSize);

    // Enrich with stats
    const enriched: EnrichedTrack[] = await Promise.all(items.map(async track => ({
      ...track,
      stats: {
        ...track.stats,
        ...this.getTrackStats(track.id)
      },
      isLiked: await this.hasLiked(track.id),
      isOwner: track.owner === user.username,
      latestCommit: this.commits.find(c => c.id === track.head_commit_id)
    })));

    return {
      items: enriched,
      page,
      pageSize,
      total,
      totalPages
    };
  }

  /** Reset current working state */
  reset(): void {
    this.currentTrack = null;
    this.currentCommitId = null;
    this.isViewingHistory = false;
    this.lastCommitData = null;
    this.emit('reset');
  }
}

/**
 * Create a CloudStore instance
 */
export function createCloudStore(options: CloudStoreOptions): CloudStore {
  return new CloudStore(options);
}
