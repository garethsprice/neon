/**
 * AudioEngine - Synth audio engine with oscillators and FX chains
 */

import {
  LowpassFilter,
  Reverb,
  Compressor,
  Saturation,
  Delay,
  Oscillator,
  Envelope,
  type WaveformType
} from '@neon/fx';

export interface TrackParams {
  waveType: WaveformType;
  detune: number;
  filterCutoff: number;
  filterReso: number;
  attack: number;
  decay: number;
  sustain: number;
  release: number;
  delayTime: number;
  delayMix: number;
  reverbMix: number;
  saturationDrive: number;
  [key: string]: unknown;
}

export interface GlobalParams {
  masterVolume: number;
  bpm: number;
}

interface TrackChain {
  oscillator: Oscillator;
  envelope: Envelope;
  filter: LowpassFilter;
  saturation: Saturation;
  delay: Delay;
  reverb: Reverb;
  output: GainNode;
}

export class AudioEngine {
  ctx: AudioContext;
  masterGain: GainNode;
  analyser: AnalyserNode;
  masterFilter: LowpassFilter;
  masterCompressor: Compressor;
  trackChains: Map<number, TrackChain>;
  globalParams: GlobalParams;
  trackParams: TrackParams[];
  private noteTrackMap: Map<number, number> = new Map();

  constructor() {
    this.ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.value = 0.5;

    // Visualizer setup
    this.analyser = this.ctx.createAnalyser();
    this.analyser.fftSize = 256;

    // Master effects chain using neon-fx
    this.masterFilter = new LowpassFilter(this.ctx, { cutoff: 20000, resonance: 0 });
    this.masterCompressor = new Compressor(this.ctx, {
      threshold: -12,
      ratio: 4,
      attack: 10,
      release: 100,
      knee: 10,
      makeupGain: 0
    });

    // Per-track effect chains
    this.trackChains = new Map();

    // Route: masterGain -> masterFilter -> masterCompressor -> analyser -> destination
    this.masterGain.connect(this.masterFilter.input);
    this.masterFilter.connect(this.masterCompressor);
    this.masterCompressor.output.connect(this.analyser);
    this.analyser.connect(this.ctx.destination);

    // Global Parameters
    this.globalParams = {
      masterVolume: 0.5,
      bpm: 120
    };

    // Per-track Parameters
    this.trackParams = Array.from({ length: 4 }, () => ({
      waveType: 'sawtooth' as WaveformType,
      detune: 0,
      filterCutoff: 2000,
      filterReso: 1,
      attack: 0.1,
      decay: 0.2,
      sustain: 0.5,
      release: 0.5,
      delayTime: 0.3,
      delayMix: 0.2,
      reverbMix: 0.3,
      saturationDrive: 0
    }));

    // Initialize per-track effect chains
    for (let i = 0; i < 4; i++) {
      this.setupTrackChain(i);
    }
  }

  setupTrackChain(trackIdx: number): void {
    const params = this.trackParams[trackIdx];

    // Create oscillator (pure waveform generator)
    const oscillator = new Oscillator(this.ctx, {
      waveform: params.waveType,
      detune: params.detune
    });

    // Create envelope (ADSR amplitude shaping)
    const envelope = new Envelope(this.ctx, {
      attack: params.attack,
      decay: params.decay,
      sustain: params.sustain,
      release: params.release
    });

    // Create per-track effects using neon-fx plugins
    const filter = new LowpassFilter(this.ctx, {
      cutoff: params.filterCutoff,
      resonance: params.filterReso * 5
    });

    const saturation = new Saturation(this.ctx, {
      drive: params.saturationDrive || 0,
      mix: 100
    });
    saturation.bypassed = true; // Off by default

    const delay = new Delay(this.ctx, {
      time: params.delayTime * 1000, // Convert to ms
      feedback: 40,
      mix: params.delayMix * 100,
      damping: 0
    });

    const reverb = new Reverb(this.ctx, {
      mix: params.reverbMix * 100,
      decay: 2.0,
      damping: 50,
      preDelay: 10
    });

    // Output node
    const output = this.ctx.createGain();

    // Routing: oscillator -> envelope -> filter -> saturation -> delay -> reverb -> output
    oscillator.connect(envelope);
    envelope.connect(filter);
    filter.connect(saturation);
    saturation.connect(delay);
    delay.connect(reverb);
    reverb.output.connect(output);

    output.connect(this.masterGain);

    this.trackChains.set(trackIdx, {
      oscillator,
      envelope,
      filter,
      saturation,
      delay,
      reverb,
      output
    });
  }

  async resume(): Promise<void> {
    if (this.ctx.state === 'suspended') {
      await this.ctx.resume();
    }
  }

  updateParam(name: string, value: unknown, trackIdx: number = 0): void {
    const rampTime = 0.05;

    if (name === 'masterVolume') {
      this.globalParams.masterVolume = value as number;
      this.masterGain.gain.setTargetAtTime(value as number, this.ctx.currentTime, 0.1);
      return;
    }
    if (name === 'bpm') {
      this.globalParams.bpm = value as number;
      return;
    }

    const p = this.trackParams[trackIdx];
    const chain = this.trackChains.get(trackIdx);

    if (p && chain) {
      (p as Record<string, unknown>)[name] = value;

      // Update oscillator parameters
      if (name === 'waveType') {
        chain.oscillator.waveform = value as WaveformType;
      }
      if (name === 'detune') {
        chain.oscillator.detune = value as number;
      }

      // Update envelope parameters
      if (name === 'attack') {
        chain.envelope.attack = value as number;
      }
      if (name === 'decay') {
        chain.envelope.decay = value as number;
      }
      if (name === 'sustain') {
        chain.envelope.sustain = value as number;
      }
      if (name === 'release') {
        chain.envelope.release = value as number;
      }

      // Update neon-fx effect plugins
      if (name === 'filterCutoff') {
        chain.filter.setParam('cutoff', value as number, rampTime);
      }
      if (name === 'filterReso') {
        chain.filter.setParam('resonance', (value as number) * 5, rampTime);
      }
      if (name === 'delayTime') {
        chain.delay.setParam('time', (value as number) * 1000, rampTime); // Convert to ms
      }
      if (name === 'delayMix') {
        chain.delay.setParam('mix', (value as number) * 100, rampTime);
      }
      if (name === 'reverbMix') {
        chain.reverb.setParam('mix', (value as number) * 100, rampTime);
      }
      if (name === 'saturationDrive') {
        if ((value as number) > 0) {
          chain.saturation.setParam('drive', value as number, rampTime);
          chain.saturation.bypassed = false;
        } else {
          chain.saturation.bypassed = true;
        }
      }
    }
  }

  getParams(trackIdx: number): TrackParams {
    return this.trackParams[trackIdx] || this.trackParams[0];
  }

  noteOn(note: number, freq: number, trackIdx: number = 0): void {
    // If note is already playing, release it first
    if (this.noteTrackMap.has(note)) {
      this.noteOff(note);
    }

    const chain = this.trackChains.get(trackIdx);
    if (!chain) return;

    // Start oscillator and trigger envelope
    chain.oscillator.start(note, freq);
    chain.envelope.noteOn(note);
    this.noteTrackMap.set(note, trackIdx);
  }

  noteOff(note: number, _trackIdx: number = 0): void {
    const trackIdx = this.noteTrackMap.get(note);
    if (trackIdx === undefined) return;

    const chain = this.trackChains.get(trackIdx);
    if (chain) {
      // Trigger envelope release, then stop oscillator after release completes
      chain.envelope.noteOff(note);
      const releaseTime = chain.envelope.release;
      chain.oscillator.stopAfter(note, releaseTime + 0.05);
    }

    this.noteTrackMap.delete(note);
  }

  triggerNote(trackIdx: number, _noteIndex: number, freq: number, durationSeconds: number = 0.1): void {
    const chain = this.trackChains.get(trackIdx);
    if (!chain) return;

    // Use a unique note ID combining frequency and track to avoid collisions
    const noteId = Math.floor(freq * 1000) + trackIdx * 100000;

    // Start oscillator and trigger envelope with duration
    chain.oscillator.start(noteId, freq);
    chain.envelope.trigger(noteId, durationSeconds);

    // Stop oscillator after envelope completes (duration + release)
    const totalTime = durationSeconds + chain.envelope.release + 0.05;
    chain.oscillator.stopAfter(noteId, totalTime);
  }
}
