/**
 * AudioEngine - Optimized synth audio engine with shared effects
 *
 * Performance optimizations:
 * - Shared reverb/delay send buses (1 each instead of 8)
 * - Minimal per-track chain (osc → env → filter → pan → output)
 * - Lazy effect instantiation (only create when enabled)
 * - Playback latency hint for better buffering
 */

import {
  LowpassFilter,
  HighpassFilter,
  Reverb,
  Compressor,
  Limiter,
  Saturation,
  Distortion,
  Bitcrusher,
  StereoPanner,
  Phaser,
  Flanger,
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
  hpFilterCutoff: number;
  hpFilterReso: number;
  attack: number;
  decay: number;
  sustain: number;
  release: number;
  delayTime: number;
  delayMix: number;
  reverbMix: number;
  saturationDrive: number;
  distortionEnabled: boolean;
  distortionDrive: number;
  distortionTone: number;
  bitcrusherEnabled: boolean;
  bitcrusherBits: number;
  bitcrusherDownsample: number;
  panEnabled: boolean;
  panPosition: number;
  phaserEnabled: boolean;
  phaserRate: number;
  phaserDepth: number;
  phaserMix: number;
  flangerEnabled: boolean;
  flangerRate: number;
  flangerDepth: number;
  flangerMix: number;
  spatialEnabled: boolean;
  spatialX: number;
  spatialY: number;
  spatialZ: number;
  [key: string]: unknown;
}

export interface GlobalParams {
  masterVolume: number;
  bpm: number;
}

// Minimal per-track chain - only essential nodes
interface TrackChain {
  oscillator: Oscillator;
  envelope: Envelope;
  hpFilter: HighpassFilter;
  lpFilter: LowpassFilter;
  panner: StereoPanner;
  output: GainNode;
  delaySend: GainNode;
  reverbSend: GainNode;
  // Optional effects - only created when enabled
  saturation?: Saturation;
  distortion?: Distortion;
  bitcrusher?: Bitcrusher;
  phaser?: Phaser;
  flanger?: Flanger;
}

export class AudioEngine {
  ctx: AudioContext;
  masterGain: GainNode;
  analyser: AnalyserNode;
  masterCompressor: Compressor;
  masterLimiter: Limiter;

  // Shared send effects (huge CPU savings)
  sharedDelay: Delay;
  sharedReverb: Reverb;
  delayBus: GainNode;
  reverbBus: GainNode;

  trackChains: Map<number, TrackChain>;
  globalParams: GlobalParams;
  trackParams: TrackParams[];
  private noteTrackMap: Map<number, number> = new Map();

  constructor() {
    // Use 'playback' latency hint for more buffer room (reduces crackling)
    this.ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)({
      latencyHint: 'playback'
    });

    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.value = 0.5;

    // Visualizer setup - smaller FFT for performance
    this.analyser = this.ctx.createAnalyser();
    this.analyser.fftSize = 128; // Reduced from 256

    // Master effects chain
    this.masterCompressor = new Compressor(this.ctx, {
      threshold: -12,
      ratio: 4,
      attack: 10,
      release: 100,
      knee: 10,
      makeupGain: 0
    });
    this.masterLimiter = new Limiter(this.ctx, { threshold: -1, release: 50 });

    // Shared send effect buses
    this.delayBus = this.ctx.createGain();
    this.reverbBus = this.ctx.createGain();

    // Single shared delay for all tracks
    this.sharedDelay = new Delay(this.ctx, {
      time: 300,
      feedback: 40,
      mix: 100, // Full wet - dry/wet controlled by send amount
      damping: 20
    });

    // Single shared reverb for all tracks
    this.sharedReverb = new Reverb(this.ctx, {
      mix: 100, // Full wet - dry/wet controlled by send amount
      decay: 2.0,
      damping: 50,
      preDelay: 10
    });

    // Per-track effect chains
    this.trackChains = new Map();

    // Routing:
    // tracks -> masterGain -> masterCompressor -> masterLimiter -> analyser -> destination
    // tracks -> delaySend -> delayBus -> sharedDelay -> masterGain
    // tracks -> reverbSend -> reverbBus -> sharedReverb -> masterGain

    this.delayBus.connect(this.sharedDelay.input);
    this.sharedDelay.output.connect(this.masterGain);

    this.reverbBus.connect(this.sharedReverb.input);
    this.sharedReverb.output.connect(this.masterGain);

    this.masterGain.connect(this.masterCompressor.input);
    this.masterCompressor.connect(this.masterLimiter);
    this.masterLimiter.output.connect(this.analyser);
    this.analyser.connect(this.ctx.destination);

    // Global Parameters
    this.globalParams = {
      masterVolume: 0.5,
      bpm: 120
    };

    // Per-track Parameters (8 tracks)
    const defaultSpatialX = [-50, -30, 30, 50, -40, 40, -20, 20];

    this.trackParams = Array.from({ length: 8 }, (_, i) => ({
      waveType: 'sawtooth' as WaveformType,
      detune: 0,
      filterCutoff: 2000,
      filterReso: 1,
      hpFilterCutoff: 20,
      hpFilterReso: 0,
      attack: 0.1,
      decay: 0.2,
      sustain: 0.5,
      release: 0.5,
      delayTime: 0.3,
      delayMix: 0,
      reverbMix: 0,
      saturationDrive: 0,
      distortionEnabled: false,
      distortionDrive: 50,
      distortionTone: 50,
      bitcrusherEnabled: false,
      bitcrusherBits: 12,
      bitcrusherDownsample: 1,
      panEnabled: false,
      panPosition: 50,
      phaserEnabled: false,
      phaserRate: 0.5,
      phaserDepth: 70,
      phaserMix: 50,
      flangerEnabled: false,
      flangerRate: 0.3,
      flangerDepth: 70,
      flangerMix: 50,
      spatialEnabled: false,
      spatialX: defaultSpatialX[i],
      spatialY: 0,
      spatialZ: 0
    }));

    // Initialize per-track chains (8 tracks)
    for (let i = 0; i < 8; i++) {
      this.setupTrackChain(i);
    }
  }

  setupTrackChain(trackIdx: number): void {
    const params = this.trackParams[trackIdx];

    // Core synth chain - always created
    const oscillator = new Oscillator(this.ctx, {
      waveform: params.waveType,
      detune: params.detune
    });

    const envelope = new Envelope(this.ctx, {
      attack: params.attack,
      decay: params.decay,
      sustain: params.sustain,
      release: params.release
    });

    const hpFilter = new HighpassFilter(this.ctx, {
      cutoff: params.hpFilterCutoff,
      resonance: params.hpFilterReso * 5
    });

    const lpFilter = new LowpassFilter(this.ctx, {
      cutoff: params.filterCutoff,
      resonance: params.filterReso * 5
    });

    const panner = new StereoPanner(this.ctx, {
      pan: (params.panPosition - 50) * 2
    });

    // Output and send nodes
    const output = this.ctx.createGain();
    const delaySend = this.ctx.createGain();
    const reverbSend = this.ctx.createGain();

    delaySend.gain.value = params.delayMix;
    reverbSend.gain.value = params.reverbMix;

    // Simple routing: osc -> env -> hp -> lp -> panner -> output
    oscillator.connect(envelope);
    envelope.connect(hpFilter);
    hpFilter.connect(lpFilter);
    lpFilter.connect(panner);
    panner.output.connect(output);

    // Send routing (post-filter, pre-output)
    panner.output.connect(delaySend);
    panner.output.connect(reverbSend);
    delaySend.connect(this.delayBus);
    reverbSend.connect(this.reverbBus);

    output.connect(this.masterGain);

    this.trackChains.set(trackIdx, {
      oscillator,
      envelope,
      hpFilter,
      lpFilter,
      panner,
      output,
      delaySend,
      reverbSend
    });
  }

  // Lazy create optional effect and insert into chain
  private ensureEffect<T>(
    trackIdx: number,
    effectKey: keyof TrackChain,
    createFn: () => T
  ): T {
    const chain = this.trackChains.get(trackIdx);
    if (!chain) throw new Error(`Track ${trackIdx} not found`);

    if (!chain[effectKey]) {
      const effect = createFn();
      (chain as unknown as Record<string, unknown>)[effectKey] = effect;
    }
    return chain[effectKey] as T;
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

      // Oscillator
      if (name === 'waveType') {
        chain.oscillator.waveform = value as WaveformType;
      }
      if (name === 'detune') {
        chain.oscillator.detune = value as number;
      }

      // Envelope
      if (name === 'attack') chain.envelope.attack = value as number;
      if (name === 'decay') chain.envelope.decay = value as number;
      if (name === 'sustain') chain.envelope.sustain = value as number;
      if (name === 'release') chain.envelope.release = value as number;

      // Filters
      if (name === 'filterCutoff') {
        chain.lpFilter.setParam('cutoff', value as number, rampTime);
      }
      if (name === 'filterReso') {
        chain.lpFilter.setParam('resonance', (value as number) * 5, rampTime);
      }
      if (name === 'hpFilterCutoff') {
        chain.hpFilter.setParam('cutoff', value as number, rampTime);
      }
      if (name === 'hpFilterReso') {
        chain.hpFilter.setParam('resonance', (value as number) * 5, rampTime);
      }

      // Send effects (just adjust send amount - shared effects)
      if (name === 'delayMix') {
        chain.delaySend.gain.setTargetAtTime(value as number, this.ctx.currentTime, rampTime);
      }
      if (name === 'delayTime') {
        this.sharedDelay.setParam('time', (value as number) * 1000, rampTime);
      }
      if (name === 'reverbMix') {
        chain.reverbSend.gain.setTargetAtTime(value as number, this.ctx.currentTime, rampTime);
      }

      // Panner
      if (name === 'panEnabled') {
        chain.panner.bypassed = !(value as boolean);
      }
      if (name === 'panPosition') {
        chain.panner.setParam('pan', ((value as number) - 50) * 2, rampTime);
      }

      // Saturation - lazy create
      if (name === 'saturationDrive') {
        if ((value as number) > 0) {
          const sat = this.ensureEffect(trackIdx, 'saturation', () => {
            const s = new Saturation(this.ctx, { drive: value as number, mix: 100 });
            this.insertEffectAfterFilter(trackIdx, s);
            return s;
          });
          sat.setParam('drive', value as number, rampTime);
          sat.bypassed = false;
        } else if (chain.saturation) {
          chain.saturation.bypassed = true;
        }
      }

      // Distortion - lazy create
      if (name === 'distortionEnabled') {
        if (value as boolean) {
          const dist = this.ensureEffect(trackIdx, 'distortion', () => {
            const d = new Distortion(this.ctx, {
              drive: p.distortionDrive,
              tone: p.distortionTone,
              mix: 100
            });
            this.insertEffectAfterFilter(trackIdx, d);
            return d;
          });
          dist.bypassed = false;
        } else if (chain.distortion) {
          chain.distortion.bypassed = true;
        }
      }
      if (name === 'distortionDrive' && chain.distortion) {
        chain.distortion.setParam('drive', value as number, rampTime);
      }
      if (name === 'distortionTone' && chain.distortion) {
        chain.distortion.setParam('tone', value as number, rampTime);
      }

      // Bitcrusher - lazy create
      if (name === 'bitcrusherEnabled') {
        if (value as boolean) {
          const bc = this.ensureEffect(trackIdx, 'bitcrusher', () => {
            const b = new Bitcrusher(this.ctx, {
              bits: p.bitcrusherBits,
              downsample: p.bitcrusherDownsample,
              mix: 100
            });
            this.insertEffectAfterFilter(trackIdx, b);
            return b;
          });
          bc.bypassed = false;
        } else if (chain.bitcrusher) {
          chain.bitcrusher.bypassed = true;
        }
      }
      if (name === 'bitcrusherBits' && chain.bitcrusher) {
        chain.bitcrusher.setParam('bits', value as number, rampTime);
      }
      if (name === 'bitcrusherDownsample' && chain.bitcrusher) {
        chain.bitcrusher.setParam('downsample', value as number, rampTime);
      }

      // Phaser - lazy create
      if (name === 'phaserEnabled') {
        if (value as boolean) {
          const ph = this.ensureEffect(trackIdx, 'phaser', () => {
            const phaser = new Phaser(this.ctx, {
              rate: p.phaserRate,
              depth: p.phaserDepth,
              mix: p.phaserMix
            });
            this.insertEffectAfterFilter(trackIdx, phaser);
            return phaser;
          });
          ph.bypassed = false;
        } else if (chain.phaser) {
          chain.phaser.bypassed = true;
        }
      }
      if (name === 'phaserRate' && chain.phaser) {
        chain.phaser.setParam('rate', value as number, rampTime);
      }
      if (name === 'phaserDepth' && chain.phaser) {
        chain.phaser.setParam('depth', value as number, rampTime);
      }
      if (name === 'phaserMix' && chain.phaser) {
        chain.phaser.setParam('mix', value as number, rampTime);
      }

      // Flanger - lazy create
      if (name === 'flangerEnabled') {
        if (value as boolean) {
          const fl = this.ensureEffect(trackIdx, 'flanger', () => {
            const flanger = new Flanger(this.ctx, {
              rate: p.flangerRate,
              depth: p.flangerDepth,
              mix: p.flangerMix
            });
            this.insertEffectAfterFilter(trackIdx, flanger);
            return flanger;
          });
          fl.bypassed = false;
        } else if (chain.flanger) {
          chain.flanger.bypassed = true;
        }
      }
      if (name === 'flangerRate' && chain.flanger) {
        chain.flanger.setParam('rate', value as number, rampTime);
      }
      if (name === 'flangerDepth' && chain.flanger) {
        chain.flanger.setParam('depth', value as number, rampTime);
      }
      if (name === 'flangerMix' && chain.flanger) {
        chain.flanger.setParam('mix', value as number, rampTime);
      }

      // Spatial (simplified - just use panner for now, spatial is expensive)
      if (name === 'spatialEnabled' || name === 'spatialX') {
        // Map spatial X to stereo pan for performance
        if (p.spatialEnabled) {
          chain.panner.bypassed = false;
          chain.panner.setParam('pan', p.spatialX, rampTime);
        }
      }
    }
  }

  // Insert an effect into the chain after the LP filter
  private insertEffectAfterFilter(trackIdx: number, effect: { input: AudioNode; output: AudioNode }): void {
    const chain = this.trackChains.get(trackIdx);
    if (!chain) return;

    // For simplicity, we just set bypass on/off rather than rewiring
    // The effect processes in parallel when enabled
    chain.lpFilter.output.connect(effect.input);
    effect.output.connect(chain.panner.input);
  }

  getParams(trackIdx: number): TrackParams {
    return this.trackParams[trackIdx] || this.trackParams[0];
  }

  noteOn(note: number, freq: number, trackIdx: number = 0): void {
    if (this.noteTrackMap.has(note)) {
      this.noteOff(note);
    }

    const chain = this.trackChains.get(trackIdx);
    if (!chain) return;

    chain.oscillator.start(note, freq);
    chain.envelope.noteOn(note);
    this.noteTrackMap.set(note, trackIdx);
  }

  noteOff(note: number, _trackIdx: number = 0): void {
    const trackIdx = this.noteTrackMap.get(note);
    if (trackIdx === undefined) return;

    const chain = this.trackChains.get(trackIdx);
    if (chain) {
      chain.envelope.noteOff(note);
      const releaseTime = chain.envelope.release;
      chain.oscillator.stopAfter(note, releaseTime + 0.05);
    }

    this.noteTrackMap.delete(note);
  }

  triggerNote(trackIdx: number, _noteIndex: number, freq: number, durationSeconds: number = 0.1): void {
    const chain = this.trackChains.get(trackIdx);
    if (!chain) return;

    const noteId = Math.floor(freq * 1000) + trackIdx * 100000;

    chain.oscillator.start(noteId, freq);
    chain.envelope.trigger(noteId, durationSeconds);

    const totalTime = durationSeconds + chain.envelope.release + 0.05;
    chain.oscillator.stopAfter(noteId, totalTime);
  }
}
