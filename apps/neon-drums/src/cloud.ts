/**
 * Neon Drums - Cloud Integration
 *
 * Minimal cloud setup using @neon/cloud's createCloudApp.
 */

import { showToast } from '@neon/ui';
import { createCloudApp } from '@neon/cloud';
import type { Sequencer } from './sequencer';
import type { Elements, AppState } from './ai-handler';

export interface CloudContext {
  sequencer: Sequencer;
  elements: Elements;
  renderAll: () => void;
  syncGlobalKnobs: () => void;
  updateTrackUI: () => void;
  state: AppState;
}

export function setupCloud(room: WebsimSocketInstance, ctx: CloudContext) {
  const { sequencer, elements, renderAll, syncGlobalKnobs, updateTrackUI, state } = ctx;

  const cloud = createCloudApp({
    room,
    appType: 'drums',
    showToast,
    visibility: (state.visibility || 'public') as 'public' | 'private',

    // State management
    getState: () => sequencer.serialize() as unknown as Record<string, unknown>,
    setState: (data) => sequencer.deserialize(data as Parameters<typeof sequencer.deserialize>[0]),

    // UI refresh
    renderUI: () => {
      renderAll();
      syncGlobalKnobs();
      updateTrackUI();
    },

    // Track metadata
    getTrackMeta: () => ({
      name: sequencer.trackName,
      description: sequencer.trackDescription,
      thumbnailUrl: sequencer.thumbnailUrl,
      stats: {
        bpm: sequencer.bpm,
        measures: sequencer.trackMeasures.filter(m => m !== null).length
      }
    }),

    // Generate track name via AI
    generateTrackName: async () => {
      try {
        const suggested = await websim.chat.completions.create({
          messages: [{ role: 'system', content: 'Suggest a 2-word cool name for a techno track. Respond with only the name.' }]
        });
        const name = suggested.content.trim();
        sequencer.trackName = name;
        if (elements.trackNameInput) elements.trackNameInput.value = name;
        return name;
      } catch {
        return 'Untitled';
      }
    },

    // Diff configuration for change detection
    diffConfig: {
      scalarFields: ['bpm', 'trackName', 'trackDescription', 'thumbnailUrl', 'masterVolume'],
      objectFields: ['patterns', 'trackParams', 'flams'],
      arrayFields: ['trackMeasures', 'patternChain']
    },

    // Element ID overrides (uses defaults for most)
    elements: {
      saveBtn: 'global-save-btn',
      loadBtn: 'global-load-btn'
    },

    // Callbacks
    onLoad: () => {
      elements.communitySidebar?.classList.remove('open');
      elements.communityToggleBtn?.classList.remove('active');
    }
  });

  // Return compatible interface
  return {
    performCommit: cloud.save,
    renderFeed: cloud.renderFeed,
    recordPlay: cloud.recordPlay,
    loadTrack: cloud.loadTrack,
    loadCommit: cloud.loadCommit,
    updateSaveButtonState: cloud.updateSaveButton,
    get currentTrack() { return cloud.currentTrack; },
    get currentCommitId() { return cloud.currentCommitId; },
    get isViewingHistory() { return cloud.isViewingHistory; }
  };
}
