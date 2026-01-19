/**
 * NEON SYNTH 2 - Cloud Integration
 *
 * Minimal cloud setup using @neon/cloud's createCloudApp.
 */

import { showToast } from '@neon/ui';
import { createCloudApp } from '@neon/cloud';

export interface SynthState {
  trackName: string;
  trackDescription: string;
  thumbnailUrl: string | null;
  trackSkill: string | null;
  trackNames: string[];
  trackParams: Record<string, Record<string, unknown>>;
  globalParams: Record<string, unknown>;
  steps: number;
  numKeys: number;
  rootKey: number;
  rootOctave: number;
  tracks: (number | null | [number, number])[][];
  selectedTrackIdx: number;
  currentPatternId: string;
  patterns: Record<string, unknown>;
}

export interface CloudContext {
  getState: () => SynthState;
  setState: (state: Partial<SynthState>) => void;
  renderAll: () => void;
  visibility: 'public' | 'private';
}

export function setupCloud(room: WebsimSocketInstance, ctx: CloudContext) {
  const { getState, setState, renderAll, visibility } = ctx;

  const cloud = createCloudApp({
    room,
    appType: 'synth',
    showToast,
    visibility,

    // State management
    getState: () => getState() as unknown as Record<string, unknown>,
    setState: (data) => setState(data as unknown as Partial<SynthState>),
    renderUI: renderAll,

    // Track metadata
    getTrackMeta: () => {
      const state = getState();
      return {
        name: state.trackName,
        description: state.trackDescription,
        thumbnailUrl: state.thumbnailUrl || undefined,
        stats: {
          bpm: state.globalParams?.bpm as number || 120,
          numKeys: state.numKeys,
          steps: state.steps
        }
      };
    },

    // Generate track name via AI
    generateTrackName: async () => {
      try {
        const suggested = await websim.chat.completions.create({
          messages: [{ role: 'system', content: 'Suggest a 2-word cool name for a synth track. Respond with only the name.' }]
        });
        const name = suggested.content.trim();
        setState({ trackName: name });
        return name;
      } catch {
        setState({ trackName: 'Untitled' });
        return 'Untitled';
      }
    },

    // Diff configuration
    diffConfig: {
      scalarFields: ['trackName', 'trackDescription', 'thumbnailUrl', 'steps', 'numKeys', 'rootKey', 'rootOctave', 'selectedTrackIdx'],
      objectFields: ['trackParams', 'globalParams', 'patterns'],
      arrayFields: ['tracks', 'trackNames']
    },

    elements: {
      saveBtn: 'global-save-btn',
      loadBtn: 'global-load-btn'
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
