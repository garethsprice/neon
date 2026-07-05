/**
 * NEON STUDIO - Cloud Integration
 *
 * Wires the studio's ProjectState into @neon/cloud's git-like versioning.
 * The whole project is the commit payload; STUDIO_DIFF_CONFIG gives the
 * diff engine per-pattern/per-channel granularity for commit messages.
 */

import { showToast } from '@neon/ui';
import { createCloudApp } from '@neon/cloud';
import { STUDIO_DIFF_CONFIG, type ProjectState } from '@neon/engine';

export interface CloudContext {
  getState: () => ProjectState;
  setState: (state: Partial<ProjectState>) => void;
  renderAll: () => void;
  visibility: 'public' | 'private';
}

export function setupCloud(room: WebsimSocketInstance, ctx: CloudContext) {
  const { getState, setState, renderAll, visibility } = ctx;

  const cloud = createCloudApp({
    room,
    appType: 'studio',
    showToast,
    visibility,

    getState: () => getState() as unknown as Record<string, unknown>,
    setState: data => setState(data as unknown as Partial<ProjectState>),
    renderUI: renderAll,

    getTrackMeta: () => {
      const state = getState();
      return {
        name: state.name,
        description: state.description,
        thumbnailUrl: state.thumbnailUrl || undefined,
        stats: {
          bpm: state.bpm,
          patterns: Object.keys(state.patterns).length,
          channels: state.channelOrder.length
        }
      };
    },

    generateTrackName: async () => {
      try {
        const suggested = await websim.chat.completions.create({
          messages: [{
            role: 'system',
            content: 'Suggest a 2-word cool name for an electronic music composition. Respond with only the name.'
          }]
        });
        const name = suggested.content.trim();
        setState({ name });
        return name;
      } catch {
        setState({ name: 'Untitled' });
        return 'Untitled';
      }
    },

    diffConfig: {
      scalarFields: [...STUDIO_DIFF_CONFIG.scalarFields],
      objectFields: [...STUDIO_DIFF_CONFIG.objectFields],
      arrayFields: [...STUDIO_DIFF_CONFIG.arrayFields]
    },

    elements: {
      saveBtn: 'global-save-btn',
      loadBtn: 'global-load-btn'
    }
  });

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
