/**
 * Neon FX Type Definitions
 */

export interface ParameterDefinition {
  name: string;
  label?: string;
  min: number;
  max: number;
  default: number;
  unit?: string;
  scale?: 'linear' | 'log';
}

export interface PluginState {
  id: string;
  bypassed: boolean;
  params: Record<string, number>;
}

export type PluginCategory = 'filter' | 'dynamics' | 'modulation' | 'time' | 'distortion' | 'utility' | 'noise';

export type BiquadFilterType =
  | 'lowpass'
  | 'highpass'
  | 'bandpass'
  | 'lowshelf'
  | 'highshelf'
  | 'peaking'
  | 'notch'
  | 'allpass';

export type SaturationMode = 'soft' | 'tube' | 'tape' | 'hard';

export interface AudioPluginConstructor {
  new (audioContext: AudioContext, options?: Record<string, number>): AudioPluginInterface;
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly category: PluginCategory;
  readonly parameterDefinitions: readonly ParameterDefinition[];
}

export interface AudioPluginInterface {
  readonly input: GainNode;
  readonly output: GainNode;
  readonly params: Record<string, number>;
  bypassed: boolean;

  connect(destination: AudioNode | AudioPluginInterface, outputIndex?: number, inputIndex?: number): AudioNode | AudioPluginInterface;
  disconnect(destination?: AudioNode | AudioPluginInterface): void;
  getParam(name: string): number;
  setParam(name: string, value: number, rampTime?: number): void;
  setParams(params: Record<string, number>, rampTime?: number): void;
  destroy(): void;
  serialize(): PluginState;
  deserialize(state: Partial<PluginState>): void;
}
