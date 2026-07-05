/**
 * @neon/instruments - Schedulable instrument modules for the Neon suite.
 *
 * Sources (drum kits, synths, noise generators) implementing a unified
 * InstrumentModule contract: sample-accurate noteOn/noteOff/trigger with an
 * AudioContext-clock `time` argument, a parameter surface compatible with
 * @neon/fx ParameterDefinition, and a registry mirroring the fx pluginRegistry.
 */

export { InstrumentModule } from './base';
export { TR909Kit, type TR909KitOptions, type TR909Lane, type CompressedManifest, type SampleData } from './tr909-kit';
export { PolySynth, type PolySynthOptions, type PolySynthWaveform } from './poly-synth';
export { NoiseModule, type NoiseLane } from './noise-module';
export {
  midiToFrequency,
  type InstrumentCategory,
  type NoteMode,
  type NoteEvent,
  type InstrumentState,
  type InstrumentConstructor,
  type InstrumentDescriptor
} from './types';

import type { InstrumentModule } from './base';
import type { InstrumentConstructor, InstrumentDescriptor } from './types';

/** Instrument loader function type (lazy import, mirrors fx PluginLoader). */
type InstrumentLoader = () => Promise<InstrumentConstructor>;

/**
 * Registry of all available instruments for dynamic instantiation.
 */
export const instrumentRegistry: Record<string, InstrumentLoader> = {
  'tr909-kit': () => import('./tr909-kit').then(m => m.TR909Kit as unknown as InstrumentConstructor),
  'poly-synth': () => import('./poly-synth').then(m => m.PolySynth as unknown as InstrumentConstructor),
  'noise': () => import('./noise-module').then(m => m.NoiseModule as unknown as InstrumentConstructor)
};

/**
 * Static descriptors for instrument pickers — kept in sync with each class's
 * static metadata (asserted by tests) so the UI never needs to load a module
 * just to list it.
 */
export const instrumentDescriptors: InstrumentDescriptor[] = [
  {
    id: 'tr909-kit',
    name: '909 Kit',
    description: 'TR-909 drum kit with velocity-layered sample playback',
    category: 'drums',
    noteMode: 'lanes',
    lanes: [
      'bassDrum', 'snareDrum', 'lowTom', 'midTom', 'highTom',
      'rimshot', 'handclap', 'closedHiHat', 'openHiHat',
      'crashCymbal', 'rideCymbal'
    ]
  },
  {
    id: 'poly-synth',
    name: 'Poly Synth',
    description: 'Polyphonic subtractive synth with lowpass filter and ADSR',
    category: 'synth',
    noteMode: 'pitched'
  },
  {
    id: 'noise',
    name: 'Noise',
    description: 'White/pink/brown/green noise colors with scheduled gating',
    category: 'noise',
    noteMode: 'lanes',
    lanes: ['white', 'pink', 'brown', 'green']
  }
];

/**
 * Create an instrument by id.
 */
export async function createInstrument(
  id: string,
  audioContext: AudioContext,
  options: Record<string, unknown> = {}
): Promise<InstrumentModule> {
  const loader = instrumentRegistry[id];
  if (!loader) {
    throw new Error(`Unknown instrument id: ${id}`);
  }
  const InstrumentClass = await loader();
  return new InstrumentClass(audioContext, options);
}

/**
 * Get descriptors for all available instruments.
 */
export function getAvailableInstruments(): InstrumentDescriptor[] {
  return [...instrumentDescriptors];
}
