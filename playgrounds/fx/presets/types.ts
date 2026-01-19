/**
 * Sound Preset Types
 */

export interface SequenceNote {
  note: number;
  duration: number;
  gap?: number;
}

export interface OscillatorSettings {
  waveform: 'sine' | 'square' | 'sawtooth' | 'triangle';
  detune: number;
  gain: number;
}

export interface EnvelopeSettings {
  attack: number;   // seconds
  decay: number;    // seconds
  sustain: number;  // 0-1
  release: number;  // seconds
}

export interface EffectSettings {
  enabled: boolean;
  params: Record<string, number>;
}

export interface SoundPreset {
  id: string;
  name: string;
  description: string;
  category: 'classical' | 'electronic' | 'ambient' | 'retro' | 'synth';

  // Sequence
  bpm: number;
  notes: SequenceNote[];

  // Synth settings
  oscillator: OscillatorSettings;
  envelope: EnvelopeSettings;

  // Effects chain
  filter: EffectSettings;
  saturation: EffectSettings;
  bitcrusher: EffectSettings;
  distortion: EffectSettings;
  compressor: EffectSettings;
  delay: EffectSettings;
  reverb: EffectSettings;
  phaser: EffectSettings;
  flanger: EffectSettings;
  panner?: { pan: number };  // Optional panner setting (-100 to 100)
}
