/**
 * neon-cloud/components/event-handlers.js
 * Reusable event handlers for cloud UI interactions
 */

import { showToast } from '../../neon-ui/index.js';

/**
 * Create standard cloud event handlers bound to a CloudStore instance
 * @param {CloudStore} store - The CloudStore instance
 * @param {object} [options] - Configuration options
 * @param {string} [options.deleteConfirmMessage] - Custom delete confirmation message
 * @returns {object} Event handler functions
 */
export function createCloudEventHandlers(store, options = {}) {
    const {
        deleteConfirmMessage = 'Delete this track? This cannot be undone.'
    } = options;

    return {
        /**
         * Toggle like on a track
         * @param {string} trackId - Track ID to like/unlike
         * @param {Event} [e] - Event object (will be stopped)
         */
        async handleLike(trackId, e) {
            if (e) e.stopPropagation();
            try {
                const result = await store.toggleLike(trackId);
                showToast(
                    result.liked ? 'ADDED TO LIKES' : 'REMOVED FROM LIKES',
                    result.liked ? 'success' : 'info'
                );
                return result;
            } catch (err) {
                console.error('Like failed:', err);
                showToast('LIKE FAILED', 'error');
                throw err;
            }
        },

        /**
         * Delete a track with confirmation
         * @param {string} trackId - Track ID to delete
         * @param {Event} [e] - Event object (will be stopped)
         * @param {Function} [onDeleted] - Callback after deletion
         */
        async handleDelete(trackId, e, onDeleted) {
            if (e) e.stopPropagation();
            if (!confirm(deleteConfirmMessage)) return false;

            try {
                await store.deleteTrack(trackId);
                showToast('TRACK DELETED', 'info');
                if (onDeleted) onDeleted(trackId);
                return true;
            } catch (err) {
                console.error('Delete failed:', err);
                showToast('DELETE FAILED', 'error');
                throw err;
            }
        },

        /**
         * Toggle track visibility between public and private
         * @param {string} trackId - Track ID
         * @param {string} currentVisibility - Current visibility ('public' or 'private')
         * @param {Event} [e] - Event object (will be stopped)
         */
        async toggleVisibility(trackId, currentVisibility, e) {
            if (e) e.stopPropagation();
            const newVisibility = currentVisibility === 'private' ? 'public' : 'private';

            try {
                await store.setVisibility(trackId, newVisibility);
                showToast(`TRACK IS NOW ${newVisibility.toUpperCase()}`, 'info');
                return newVisibility;
            } catch (err) {
                console.error('Visibility change failed:', err);
                showToast('VISIBILITY CHANGE FAILED', 'error');
                throw err;
            }
        },

        /**
         * Record a play event for a track
         * @param {string} trackId - Track ID
         */
        async recordPlay(trackId) {
            try {
                await store.recordPlay(trackId);
            } catch (err) {
                // Silently ignore play recording errors
                console.warn('Play recording failed:', err);
            }
        },

        /**
         * Fork/remix a track
         * @param {string} trackId - Track ID to remix
         * @param {Function} onRemix - Callback with track data to apply
         */
        async handleRemix(trackId, onRemix) {
            try {
                const result = await store.loadTrack(trackId);
                if (result.error) {
                    showToast('REMIX FAILED: ' + result.error, 'error');
                    return null;
                }

                // Get remix source info
                const track = store.tracks.find(t => t.id === trackId);
                const remixSource = track ? {
                    id: track.id,
                    name: track.name,
                    owner: track.owner
                } : null;

                if (onRemix) {
                    onRemix(result.data, remixSource);
                }

                showToast('REMIXING...', 'info');
                return { data: result.data, source: remixSource };
            } catch (err) {
                console.error('Remix failed:', err);
                showToast('REMIX FAILED', 'error');
                throw err;
            }
        }
    };
}

/**
 * Create a save button state manager
 * @param {object} config - Configuration
 * @param {CloudStore} config.store - CloudStore instance
 * @param {HTMLElement} config.button - Save button element
 * @param {Function} config.getState - Function that returns current app state
 * @param {string} [config.noChangesClass='no-changes'] - Class to add when no changes
 */
export function createSaveButtonManager(config) {
    const { store, button, getState, noChangesClass = 'no-changes' } = config;

    function update() {
        if (!button) return;

        const currentData = getState();
        const { hasChanges } = store.checkForChanges(currentData);
        const canSave = hasChanges || store.lastCommitData === null;

        button.disabled = !canSave;
        button.classList.toggle(noChangesClass, !canSave);
    }

    // Return update function for manual calls
    return { update };
}

/**
 * Create history indicator manager
 * @param {object} config - Configuration
 * @param {CloudStore} config.store - CloudStore instance
 * @param {HTMLElement} config.indicator - History indicator element
 * @param {string} [config.visibleClass='visible'] - Class when indicator is visible
 */
export function createHistoryIndicator(config) {
    const { store, indicator, visibleClass = 'visible' } = config;

    function update() {
        if (!indicator) return;

        if (store.isViewingHistory && store.currentCommitId) {
            const commit = store.commits.find(c => c.id === store.currentCommitId);
            indicator.classList.add(visibleClass);
            indicator.innerHTML = `<i data-lucide="history"></i> VIEWING: ${commit?.message || 'Historical version'}`;

            // Re-initialize Lucide icons if available
            if (window.lucide) {
                window.lucide.createIcons({ nodes: [indicator] });
            }
        } else {
            indicator.classList.remove(visibleClass);
        }
    }

    return { update };
}
