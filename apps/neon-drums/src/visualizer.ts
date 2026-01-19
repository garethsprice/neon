/**
 * Neon Drums Visualizer
 *
 * Wraps the shared @neon/ui visualizer with drums-specific color mappings.
 */

import { createVisualizer, type VisualizerComponent } from '@neon/ui';

// Map drum instruments to color channels
const INSTRUMENT_CHANNELS: Record<string, string> = {
  bassDrum: 'cyan',
  snareDrum: 'cyan',
  lowTom: 'magenta',
  midTom: 'magenta',
  highTom: 'magenta',
  rimshot: 'purple',
  handclap: 'purple',
  closedHiHat: 'lime',
  openHiHat: 'lime',
  crashCymbal: 'orange',
  rideCymbal: 'orange'
};

export interface NeonVisualizer extends VisualizerComponent {
  /** Trigger visualization for a drum instrument */
  triggerInstrument: (instrument: string) => void;
}

/**
 * Create the drums visualizer with instrument mappings
 */
export function createDrumsVisualizer(canvas: HTMLCanvasElement): NeonVisualizer {
  const visualizer = createVisualizer(canvas, {
    channels: ['cyan', 'magenta', 'purple', 'lime', 'orange'],
    colors: {
      cyan: '#00ffff',
      magenta: '#ff00ff',
      purple: '#bf5fff',
      lime: '#39ff14',
      orange: '#ff6600'
    }
  });

  return {
    ...visualizer,
    triggerInstrument(instrument: string): void {
      const channel = INSTRUMENT_CHANNELS[instrument];
      if (channel) {
        visualizer.trigger(channel, 0.4);
      }
    }
  };
}
