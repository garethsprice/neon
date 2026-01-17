/**
 * Neon Cloud - CloudStore
 *
 * Main store class for managing tracks, commits, likes, and plays.
 * Provides a git-like versioning system for music projects.
 */

import { diffState, hasChanges, DEFAULT_DIFF_CONFIG } from './diff.js';
import { timeAgo, generateId } from './utils.js';

/**
 * Event emitter mixin
 */
class EventEmitter {
    constructor() {
        this._listeners = {};
    }

    on(event, callback) {
        if (!this._listeners[event]) this._listeners[event] = [];
        this._listeners[event].push(callback);
        return () => this.off(event, callback);
    }

    off(event, callback) {
        if (!this._listeners[event]) return;
        this._listeners[event] = this._listeners[event].filter(cb => cb !== callback);
    }

    emit(event, data) {
        if (!this._listeners[event]) return;
        this._listeners[event].forEach(cb => cb(data));
    }
}

/**
 * CloudStore - Manages collaborative music project data
 */
export class CloudStore extends EventEmitter {
    /**
     * @param {Object} options
     * @param {Object} options.room - WebsimSocket room instance
     * @param {Object} options.diffConfig - Custom diff configuration
     * @param {Function} options.generateCommitMessage - Custom commit message generator
     * @param {Function} options.getCurrentUser - Function to get current user
     * @param {string} options.collectionPrefix - Prefix for collection names (default: '')
     */
    constructor(options = {}) {
        super();

        this.room = options.room;
        this.diffConfig = options.diffConfig || DEFAULT_DIFF_CONFIG;
        this.generateCommitMessage = options.generateCommitMessage || this._defaultCommitMessage.bind(this);
        this.getCurrentUser = options.getCurrentUser || (() => Promise.resolve({ username: 'anonymous' }));
        this.collectionPrefix = options.collectionPrefix || '';

        // Collections
        this.tracks = [];
        this.commits = [];
        this.likes = [];
        this.plays = [];

        // Current state
        this.currentTrack = null;
        this.currentCommitId = null;
        this.isViewingHistory = false;
        this.lastCommitData = null;

        // Subscribe to collections if room provided
        if (this.room) {
            this._setupSubscriptions();
        }
    }

    /**
     * Get collection name with prefix
     */
    _col(name) {
        return this.collectionPrefix ? `${this.collectionPrefix}_${name}` : name;
    }

    /**
     * Setup real-time subscriptions
     */
    _setupSubscriptions() {
        this.room.collection(this._col('track_v1')).subscribe(tracks => {
            this.tracks = tracks;
            this.emit('tracks', tracks);
            this.emit('change', { type: 'tracks', data: tracks });
        });

        this.room.collection(this._col('commit_v1')).subscribe(commits => {
            this.commits = commits;
            this.emit('commits', commits);
            this.emit('change', { type: 'commits', data: commits });
        });

        this.room.collection(this._col('like_v1')).subscribe(likes => {
            this.likes = likes;
            this.emit('likes', likes);
            this.emit('change', { type: 'likes', data: likes });
        });

        this.room.collection(this._col('play_v1')).subscribe(plays => {
            this.plays = plays;
            this.emit('plays', plays);
            this.emit('change', { type: 'plays', data: plays });
        });

        // Real-time messages
        this.room.onmessage = (event) => {
            this.emit('message', event.data);
        };
    }

    /**
     * Default commit message generator
     */
    async _defaultCommitMessage(changes, prevData, currData, options = {}) {
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

    /**
     * Find a track by ID
     */
    findTrack(trackId) {
        return this.tracks.find(t => t.id === trackId);
    }

    /**
     * Find track by owner and name
     */
    findTrackByOwnerName(owner, name) {
        return this.tracks.find(t => t.owner === owner && t.name === name);
    }

    /**
     * Get commit history for a track (newest first)
     */
    getTrackHistory(trackId) {
        return this.commits
            .filter(c => c.track_id === trackId)
            .sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));
    }

    /**
     * Get stats for a track
     */
    getTrackStats(trackId) {
        return {
            likes: this.likes.filter(l => l.track_id === trackId).length,
            plays: this.plays.filter(p => p.track_id === trackId).length,
            commits: this.commits.filter(c => c.track_id === trackId).length,
            remixes: this.tracks.filter(t => t.remixed_from?.track_id === trackId).length
        };
    }

    /**
     * Check if user has liked a track
     */
    async hasLiked(trackId) {
        const user = await this.getCurrentUser();
        return this.likes.some(l => l.track_id === trackId && l.username === user.username);
    }

    /**
     * Check if current data has changes from last commit
     */
    checkForChanges(currentData) {
        const changes = diffState(this.lastCommitData, currentData, this.diffConfig);
        return { changes, hasChanges: hasChanges(changes) };
    }

    /**
     * Commit changes to a track
     * @param {Object} data - Serialized project data
     * @param {Object} metadata - Track metadata (name, description, thumbnailUrl, stats)
     * @param {Object} options - Commit options
     * @returns {Object} { track, commit }
     */
    async commit(data, metadata = {}, options = {}) {
        const user = await this.getCurrentUser();

        // Check for changes
        const changes = diffState(this.lastCommitData, data, this.diffConfig);
        if (this.lastCommitData && !hasChanges(changes) && !options.force) {
            return { error: 'NO_CHANGES', message: 'No changes to save' };
        }

        let track = this.currentTrack;
        let isNewTrack = false;
        let isRemix = false;
        let remixSource = null;

        // Determine if we need a new track
        if (!track && metadata.name) {
            track = this.findTrackByOwnerName(user.username, metadata.name);
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
            track = await this.room.collection(this._col('track_v1')).create({
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
            remixSource
        });

        // Create commit
        const commit = await this.room.collection(this._col('commit_v1')).create({
            track_id: track.id,
            parent_id: isNewTrack ? null : track.head_commit_id,
            author: user.username,
            message: message,
            data: data
        });

        // Update track's head and metadata
        await this.room.collection(this._col('track_v1')).update(track.id, {
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

    /**
     * Load a specific commit
     */
    async loadCommit(commitId) {
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

    /**
     * Load the latest version of a track
     */
    async loadTrack(trackId) {
        const track = this.findTrack(trackId);
        if (!track || !track.head_commit_id) {
            return { error: 'NOT_FOUND', message: 'Track not found' };
        }

        return this.loadCommit(track.head_commit_id);
    }

    /**
     * Toggle like on a track
     */
    async toggleLike(trackId) {
        const user = await this.getCurrentUser();
        const existingLike = this.likes.find(l => l.track_id === trackId && l.username === user.username);

        if (existingLike) {
            await this.room.collection(this._col('like_v1')).delete(existingLike.id);
            this.emit('unliked', { trackId });
            return { liked: false };
        } else {
            await this.room.collection(this._col('like_v1')).create({ track_id: trackId });
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

    /**
     * Record a play
     */
    async recordPlay(trackId) {
        const user = await this.getCurrentUser();
        await this.room.collection(this._col('play_v1')).create({ track_id: trackId });

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

    /**
     * Delete a track and all its commits
     */
    async deleteTrack(trackId) {
        const user = await this.getCurrentUser();
        const track = this.findTrack(trackId);

        if (!track || track.owner !== user.username) {
            return { error: 'UNAUTHORIZED', message: 'Cannot delete this track' };
        }

        // Delete all commits
        const trackCommits = this.commits.filter(c => c.track_id === trackId);
        for (const commit of trackCommits) {
            await this.room.collection(this._col('commit_v1')).delete(commit.id);
        }

        // Delete the track
        await this.room.collection(this._col('track_v1')).delete(trackId);

        // Clear current state if it was this track
        if (this.currentTrack?.id === trackId) {
            this.currentTrack = null;
            this.currentCommitId = null;
            this.lastCommitData = null;
        }

        this.emit('deleted', { trackId });
        return { success: true };
    }

    /**
     * Update track visibility
     */
    async setVisibility(trackId, visibility) {
        const user = await this.getCurrentUser();
        const track = this.findTrack(trackId);

        if (!track || track.owner !== user.username) {
            return { error: 'UNAUTHORIZED', message: 'Cannot modify this track' };
        }

        await this.room.collection(this._col('track_v1')).update(trackId, { visibility });
        this.emit('visibilityChanged', { trackId, visibility });
        return { success: true, visibility };
    }

    /**
     * Get filtered and paginated tracks for feed
     */
    async getFeed(options = {}) {
        const {
            filter = 'all',  // 'all' | 'mine'
            page = 1,
            pageSize = 10,
            sortBy = 'recent'
        } = options;

        const user = await this.getCurrentUser();

        let filtered = filter === 'mine'
            ? this.tracks.filter(t => t.owner === user.username)
            : this.tracks.filter(t => t.visibility === 'public');

        // Sort
        if (sortBy === 'recent') {
            filtered.sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));
        } else if (sortBy === 'popular') {
            filtered.sort((a, b) => {
                const aStats = this.getTrackStats(a.id);
                const bStats = this.getTrackStats(b.id);
                return (bStats.plays + bStats.likes) - (aStats.plays + aStats.likes);
            });
        }

        const total = filtered.length;
        const totalPages = Math.ceil(total / pageSize);
        const startIdx = (page - 1) * pageSize;
        const items = filtered.slice(startIdx, startIdx + pageSize);

        // Enrich with stats
        const enriched = await Promise.all(items.map(async track => ({
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

    /**
     * Reset current working state
     */
    reset() {
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
export function createCloudStore(options) {
    return new CloudStore(options);
}
