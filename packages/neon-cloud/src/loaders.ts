/**
 * neon-cloud/loaders.ts
 * Track and commit loading utilities
 */

import { showToast } from '@neon/ui';
import type { CloudStore } from './store';
import type { TrackLoaderConfig, LoadOptions, LoaderResult } from './types';

/**
 * Create track/commit loader with standardized load-and-play workflow
 */
export function createTrackLoader(config: TrackLoaderConfig) {
  const {
    stopPlayback,
    applyState,
    updateUI,
    closeSidebar,
    autoPlayDelay = 150
  } = config;

  /**
   * Load a specific commit (historical version)
   */
  async function loadCommit(
    store: CloudStore,
    commitId: string,
    options: LoadOptions = {}
  ): Promise<LoaderResult> {
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
      applyState(result.data!);

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
      return { success: false, error: (err as Error).message };
    }
  }

  /**
   * Load a track (latest version)
   */
  async function loadTrack(
    store: CloudStore,
    trackId: string,
    options: LoadOptions = {}
  ): Promise<LoaderResult> {
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
      applyState(result.data!);

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
      return { success: false, error: (err as Error).message };
    }
  }

  /**
   * Create a new track (reset to defaults)
   */
  async function createNewTrack(
    store: CloudStore,
    resetState: () => void,
    options: { isPlaying?: boolean } = {}
  ): Promise<LoaderResult> {
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
