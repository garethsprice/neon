/**
 * neon-cloud/loaders.js
 * Track and commit loading utilities
 */

import { showToast } from '../neon-ui/index.js';

/**
 * Create track/commit loader with standardized load-and-play workflow
 * @param {object} config - Configuration
 * @param {Function} config.stopPlayback - Function to stop current playback
 * @param {Function} config.applyState - Function to apply loaded state data
 * @param {Function} [config.updateUI] - Function to update UI after load
 * @param {Function} [config.closeSidebar] - Function to close sidebar/feed panel
 * @param {number} [config.autoPlayDelay=150] - Delay before auto-play in ms
 * @returns {object} Loader functions
 */
export function createTrackLoader(config) {
    const {
        stopPlayback,
        applyState,
        updateUI,
        closeSidebar,
        autoPlayDelay = 150
    } = config;

    /**
     * Load a specific commit (historical version)
     * @param {CloudStore} store - CloudStore instance
     * @param {string} commitId - Commit ID to load
     * @param {object} [options] - Load options
     * @param {boolean} [options.autoPlay=false] - Start playback after loading
     * @param {Function} [options.startPlayback] - Function to start playback
     * @param {boolean} [options.isPlaying=false] - Whether currently playing
     */
    async function loadCommit(store, commitId, options = {}) {
        const { autoPlay = false, startPlayback, isPlaying = false } = options;

        // Stop playback before loading
        if (isPlaying && stopPlayback) {
            stopPlayback();
        }

        try {
            const result = await store.loadCommit(commitId);

            if (result.error) {
                showToast('LOAD FAILED: ' + result.error, 'error');
                return { success: false, error: result.error };
            }

            // Apply the loaded state
            applyState(result.data);

            // Update UI if provided
            if (updateUI) updateUI();

            // Close sidebar if provided
            if (closeSidebar) closeSidebar();

            // Show appropriate message
            const commit = store.commits.find(c => c.id === commitId);
            const msgPrefix = store.isViewingHistory
                ? `LOADED HISTORY: ${commit?.message || 'Previous version'}`
                : 'LOADED';
            showToast(msgPrefix, 'info');

            // Auto-play if requested
            if (autoPlay && startPlayback) {
                setTimeout(() => {
                    startPlayback();
                }, autoPlayDelay);
            }

            return { success: true, data: result.data };
        } catch (err) {
            console.error('Load commit failed:', err);
            showToast('LOAD FAILED', 'error');
            return { success: false, error: err.message };
        }
    }

    /**
     * Load a track (latest version)
     * @param {CloudStore} store - CloudStore instance
     * @param {string} trackId - Track ID to load
     * @param {object} [options] - Load options
     * @param {boolean} [options.autoPlay=false] - Start playback after loading
     * @param {Function} [options.startPlayback] - Function to start playback
     * @param {boolean} [options.isPlaying=false] - Whether currently playing
     */
    async function loadTrack(store, trackId, options = {}) {
        const { autoPlay = false, startPlayback, isPlaying = false } = options;

        // Stop playback before loading
        if (isPlaying && stopPlayback) {
            stopPlayback();
        }

        try {
            const result = await store.loadTrack(trackId);

            if (result.error) {
                showToast('LOAD FAILED: ' + result.error, 'error');
                return { success: false, error: result.error };
            }

            // Apply the loaded state
            applyState(result.data);

            // Update UI if provided
            if (updateUI) updateUI();

            // Close sidebar if provided
            if (closeSidebar) closeSidebar();

            // Show load message with track name
            const track = store.tracks.find(t => t.id === trackId);
            showToast(`LOADED: ${track?.name || 'Track'}`, 'info');

            // Auto-play if requested
            if (autoPlay && startPlayback) {
                setTimeout(() => {
                    startPlayback();
                }, autoPlayDelay);
            }

            return { success: true, data: result.data };
        } catch (err) {
            console.error('Load track failed:', err);
            showToast('LOAD FAILED', 'error');
            return { success: false, error: err.message };
        }
    }

    /**
     * Create a new track (reset to defaults)
     * @param {CloudStore} store - CloudStore instance
     * @param {Function} resetState - Function to reset app to default state
     * @param {object} [options] - Options
     * @param {boolean} [options.isPlaying=false] - Whether currently playing
     */
    async function createNewTrack(store, resetState, options = {}) {
        const { isPlaying = false } = options;

        // Stop playback before resetting
        if (isPlaying && stopPlayback) {
            stopPlayback();
        }

        // Reset store state
        store.reset();

        // Reset app state
        resetState();

        // Update UI if provided
        if (updateUI) updateUI();

        showToast('NEW TRACK', 'info');
        return { success: true };
    }

    return {
        loadCommit,
        loadTrack,
        createNewTrack
    };
}
