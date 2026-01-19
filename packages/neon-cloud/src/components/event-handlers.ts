/**
 * neon-cloud/components/event-handlers.ts
 * Reusable event handlers for cloud UI interactions
 */

import { showToast } from '@neon/ui';
import type { CloudStore } from '../store';
import type { Track, Commit } from '../types';

interface CloudEventHandlersOptions {
  deleteConfirmMessage?: string;
}

interface RemixResult {
  data: Record<string, unknown>;
  source: { id: string; name: string; owner: string } | null;
}

/**
 * Create standard cloud event handlers bound to a CloudStore instance
 */
export function createCloudEventHandlers(store: CloudStore, options: CloudEventHandlersOptions = {}) {
  const {
    deleteConfirmMessage = 'Delete this track? This cannot be undone.'
  } = options;

  return {
    /**
     * Toggle like on a track
     */
    async handleLike(trackId: string, e?: Event): Promise<{ liked: boolean }> {
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
     */
    async handleDelete(
      trackId: string,
      e?: Event,
      onDeleted?: (trackId: string) => void
    ): Promise<boolean> {
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
     */
    async toggleVisibility(
      trackId: string,
      currentVisibility: string,
      e?: Event
    ): Promise<string> {
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
     */
    async recordPlay(trackId: string): Promise<void> {
      try {
        await store.recordPlay(trackId);
      } catch (err) {
        // Silently ignore play recording errors
        console.warn('Play recording failed:', err);
      }
    },

    /**
     * Fork/remix a track
     */
    async handleRemix(
      trackId: string,
      onRemix?: (data: Record<string, unknown>, source: { id: string; name: string; owner: string } | null) => void
    ): Promise<RemixResult | null> {
      try {
        const result = await store.loadTrack(trackId);
        if (result.error) {
          showToast('REMIX FAILED: ' + result.error, 'error');
          return null;
        }

        // Get remix source info
        const track = store.tracks.find((t: Track) => t.id === trackId);
        const remixSource = track ? {
          id: track.id,
          name: track.name,
          owner: track.owner
        } : null;

        if (onRemix) {
          onRemix(result.data!, remixSource);
        }

        showToast('REMIXING...', 'info');
        return { data: result.data!, source: remixSource };
      } catch (err) {
        console.error('Remix failed:', err);
        showToast('REMIX FAILED', 'error');
        throw err;
      }
    }
  };
}

interface SaveButtonManagerConfig {
  store: CloudStore;
  button: HTMLElement | null;
  getState: () => Record<string, unknown>;
  noChangesClass?: string;
}

/**
 * Create a save button state manager
 */
export function createSaveButtonManager(config: SaveButtonManagerConfig) {
  const { store, button, getState, noChangesClass = 'no-changes' } = config;

  function update(): void {
    if (!button) return;

    const currentData = getState();
    const { hasChanges } = store.checkForChanges(currentData);
    const canSave = hasChanges || store.lastCommitData === null;

    (button as HTMLButtonElement).disabled = !canSave;
    button.classList.toggle(noChangesClass, !canSave);
  }

  // Return update function for manual calls
  return { update };
}

interface HistoryIndicatorConfig {
  store: CloudStore;
  indicator: HTMLElement | null;
  visibleClass?: string;
}

declare const lucide: { createIcons: (options: { nodes: HTMLElement[] }) => void } | undefined;

/**
 * Create history indicator manager
 */
export function createHistoryIndicator(config: HistoryIndicatorConfig) {
  const { store, indicator, visibleClass = 'visible' } = config;

  function update(): void {
    if (!indicator) return;

    if (store.isViewingHistory && store.currentCommitId) {
      const commit = store.commits.find((c: Commit) => c.id === store.currentCommitId);
      indicator.classList.add(visibleClass);
      indicator.innerHTML = `<i data-lucide="history"></i> VIEWING: ${commit?.message || 'Historical version'}`;

      // Re-initialize Lucide icons if available
      if (typeof lucide !== 'undefined') {
        lucide.createIcons({ nodes: [indicator] });
      }
    } else {
      indicator.classList.remove(visibleClass);
    }
  }

  return { update };
}
