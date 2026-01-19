/**
 * Neon Noise - Cloud Integration
 *
 * Minimal cloud setup using @neon/cloud's createCloudApp.
 */

import { showToast } from '@neon/ui';
import { createCloudApp } from '@neon/cloud';
import type { AudioEngine } from './audio-engine';
import type { VinylEffect } from '@neon/fx';

interface CloudContext {
  engine: AudioEngine;
  syncKnobs: () => void;
  saveBtn: HTMLElement | null;
  loadBtn: HTMLElement | null;
  getVinylEffect: () => VinylEffect | null;
  getChannelEnabled: () => Record<string, boolean>;
  setChannelEnabled: (state: Record<string, boolean>) => void;
}

export function setupCloud(room: WebsimSocketInstance, ctx: CloudContext) {
  const { engine, syncKnobs, saveBtn, loadBtn, getVinylEffect, getChannelEnabled, setChannelEnabled } = ctx;

  // Combined state getter (engine + vinyl + channels)
  function getCombinedState(): Record<string, unknown> {
    const state = engine.serialize() as unknown as Record<string, unknown>;
    const vinylEffect = getVinylEffect?.();
    if (vinylEffect) {
      state.vinyl = vinylEffect.serialize();
    }
    if (getChannelEnabled) {
      state.channelEnabled = getChannelEnabled();
    }
    return state;
  }

  // Combined state setter
  function applyCombinedState(data: Record<string, unknown>): void {
    engine.deserialize(data as Parameters<AudioEngine['deserialize']>[0]);
    const vinylEffect = getVinylEffect?.();
    if (vinylEffect && data.vinyl) {
      vinylEffect.deserialize(data.vinyl as Parameters<VinylEffect['deserialize']>[0]);
    }
    if (setChannelEnabled && data.channelEnabled) {
      setChannelEnabled(data.channelEnabled as Record<string, boolean>);
    }
  }

  const cloud = createCloudApp({
    room,
    appType: 'noise',
    showToast,
    collectionPrefix: 'noise_',
    useLucideIcons: false, // Noise app uses simple text icons
    enableHistory: false,  // Simpler preset system

    // State management
    getState: getCombinedState,
    setState: applyCombinedState,
    renderUI: syncKnobs,

    // Track metadata
    getTrackMeta: () => {
      // Auto-generate name based on active noise types
      let name = engine.name;
      if (!name) {
        const noiseTypes: string[] = [];
        if (engine.volumes.white > 0.3) noiseTypes.push('White');
        if (engine.volumes.pink > 0.3) noiseTypes.push('Pink');
        if (engine.volumes.brown > 0.3) noiseTypes.push('Brown');
        if (engine.volumes.green > 0.3) noiseTypes.push('Green');
        const vinylEffect = getVinylEffect?.();
        if (vinylEffect && vinylEffect.vinylParams.hissLevel > 0.3) noiseTypes.push('Vinyl');
        name = noiseTypes.length > 0 ? `${noiseTypes.join(' + ')} Mix` : 'Custom Noise';
        engine.name = name;
      }
      return {
        name,
        description: engine.description || '',
        stats: {
          channels: Object.keys(engine.volumes).filter(k => k !== 'master' && engine.volumes[k as keyof typeof engine.volumes] > 0.1).length
        }
      };
    },

    // Diff configuration
    diffConfig: {
      scalarFields: ['name', 'description', 'sensitivity'],
      objectFields: ['volumes', 'vinyl', 'channelEnabled'],
      arrayFields: []
    },

    // Custom element IDs for noise's simpler UI
    elements: {
      saveBtn: saveBtn?.id || 'save-btn',
      loadBtn: loadBtn?.id || 'load-btn',
      sidebar: 'presets-sidebar',
      closeSidebarBtn: 'close-sidebar-btn',
      feedContainer: 'preset-feed',
      pagination: 'feed-pagination',
      filterAll: 'filter-all',
      filterMine: 'filter-mine'
    },

    // Custom feed item template for noise presets
    feedTemplate: {
      renderPreview: (track) => {
        const data = (track.latestCommit?.data || {}) as Record<string, unknown>;
        const volumes = (data.volumes || {}) as Record<string, number>;
        return `
          <div class="preset-colors">
            <span class="color-bar white" style="opacity: ${volumes.white || 0}"></span>
            <span class="color-bar pink" style="opacity: ${volumes.pink || 0}"></span>
            <span class="color-bar brown" style="opacity: ${volumes.brown || 0}"></span>
            <span class="color-bar green" style="opacity: ${volumes.green || 0}"></span>
          </div>
        `;
      },
      renderStats: () => '', // No stats for noise presets
      itemClass: 'noise-preset'
    }
  });

  return {
    performCommit: cloud.save,
    renderFeed: cloud.renderFeed,
    loadPreset: cloud.loadTrack,
    updateSaveButtonState: cloud.updateSaveButton,
    get currentTrack() { return cloud.currentTrack; }
  };
}
