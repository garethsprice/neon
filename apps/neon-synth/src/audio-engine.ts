/**
 * AudioEngine - Synth audio engine with oscillators and FX chains
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
  SpatialPanner,
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
  // Phaser
  phaserEnabled: boolean;
  phaserRate: number;
  phaserDepth: number;
  phaserMix: number;
  // Flanger
  flangerEnabled: boolean;
  flangerRate: number;
  flangerDepth: number;
  flangerMix: number;
  // Spatial 3D
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

interface TrackChain {
  oscillator: Oscillator;
  envelope: Envelope;
  lpFilter: LowpassFilter;
  hpFilter: HighpassFilter;
  saturation: Saturation;
  distortion: Distortion;
  bitcrusher: Bitcrusher;
  phaser: Phaser;
  flanger: Flanger;
  panner: StereoPanner;
  spatialPanner: SpatialPanner;
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
  masterLimiter: Limiter;
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
    this.masterLimiter = new Limiter(this.ctx, { threshold: -1, release: 50 });

    // Per-track effect chains
    this.trackChains = new Map();

    // Route: masterGain -> masterFilter -> masterCompressor -> masterLimiter -> analyser -> destination
    this.masterGain.connect(this.masterFilter.input);
    this.masterFilter.connect(this.masterCompressor);
    this.masterCompressor.connect(this.masterLimiter);
    this.masterLimiter.output.connect(this.analyser);
    this.analyser.connect(this.ctx.destination);

    // Global Parameters
    this.globalParams = {
      masterVolume: 0.5,
      bpm: 120
    };

    // Per-track Parameters (8 tracks)
    // Default spatial positions spread across stereo field
    const defaultSpatialX = [-50, -30, 30, 50, -40, 40, -20, 20];
    const defaultSpatialZ = [0, 0, 0, 0, -20, -20, -30, -30];

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
      delayMix: 0.2,
      reverbMix: 0.3,
      saturationDrive: 0,
      distortionEnabled: false,
      distortionDrive: 50,
      distortionTone: 50,
      bitcrusherEnabled: false,
      bitcrusherBits: 12,
      bitcrusherDownsample: 1,
      panEnabled: false,
      panPosition: 50,
      // Phaser
      phaserEnabled: false,
      phaserRate: 0.5,
      phaserDepth: 70,
      phaserMix: 50,
      // Flanger
      flangerEnabled: false,
      flangerRate: 0.3,
      flangerDepth: 70,
      flangerMix: 50,
      // Spatial 3D - spread tracks across stereo field by default
      spatialEnabled: false,
      spatialX: defaultSpatialX[i],
      spatialY: 0,
      spatialZ: defaultSpatialZ[i]
    }));

    // Initialize per-track effect chains (8 tracks)
    for (let i = 0; i < 8; i++) {
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
    const lpFilter = new LowpassFilter(this.ctx, {
      cutoff: params.filterCutoff,
      resonance: params.filterReso * 5
    });

    const hpFilter = new HighpassFilter(this.ctx, {
      cutoff: params.hpFilterCutoff,
      resonance: params.hpFilterReso * 5
    });

    const saturation = new Saturation(this.ctx, {
      drive: params.saturationDrive || 0,
      mix: 100
    });
    saturation.bypassed = true; // Off by default

    const distortion = new Distortion(this.ctx, {
      drive: params.distortionDrive,
      tone: params.distortionTone,
      mix: 100
    });
    distortion.bypassed = !params.distortionEnabled;

    const bitcrusher = new Bitcrusher(this.ctx, {
      bits: params.bitcrusherBits,
      downsample: params.bitcrusherDownsample,
      mix: 100
    });
    bitcrusher.bypassed = !params.bitcrusherEnabled;

    // Modulation effects
    const phaser = new Phaser(this.ctx, {
      rate: params.phaserRate,
      depth: params.phaserDepth,
      mix: params.phaserMix
    });
    phaser.bypassed = !params.phaserEnabled;

    const flanger = new Flanger(this.ctx, {
      rate: params.flangerRate,
      depth: params.flangerDepth,
      mix: params.flangerMix
    });
    flanger.bypassed = !params.flangerEnabled;

    // Panning
    const panner = new StereoPanner(this.ctx, {
      pan: (params.panPosition - 50) * 2 // Convert 0-100 to -100 to 100
    });
    panner.bypassed = !params.panEnabled;

    // Spatial 3D positioning
    const spatialPanner = new SpatialPanner(this.ctx, {
      positionX: params.spatialX,
      positionY: params.spatialY,
      positionZ: params.spatialZ,
      panningModel: 'HRTF'
    });
    spatialPanner.bypassed = !params.spatialEnabled;

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

    // Routing: oscillator -> envelope -> hpFilter -> lpFilter -> saturation -> distortion -> bitcrusher -> phaser -> flanger -> panner -> spatialPanner -> delay -> reverb -> output
    oscillator.connect(envelope);
    envelope.connect(hpFilter);
    hpFilter.connect(lpFilter);
    lpFilter.connect(saturation);
    saturation.connect(distortion);
    distortion.connect(bitcrusher);
    bitcrusher.connect(phaser);
    phaser.connect(flanger);
    flanger.connect(panner);
    panner.connect(spatialPanner);
    spatialPanner.connect(delay);
    delay.connect(reverb);
    reverb.output.connect(output);

    output.connect(this.masterGain);

    this.trackChains.set(trackIdx, {
      oscillator,
      envelope,
      lpFilter,
      hpFilter,
      saturation,
      distortion,
      bitcrusher,
      phaser,
      flanger,
      panner,
      spatialPanner,
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
      // Distortion
      if (name === 'distortionEnabled') {
        chain.distortion.bypassed = !(value as boolean);
      }
      if (name === 'distortionDrive') {
        chain.distortion.setParam('drive', value as number, rampTime);
      }
      if (name === 'distortionTone') {
        chain.distortion.setParam('tone', value as number, rampTime);
      }
      // Bitcrusher
      if (name === 'bitcrusherEnabled') {
        chain.bitcrusher.bypassed = !(value as boolean);
      }
      if (name === 'bitcrusherBits') {
        chain.bitcrusher.setParam('bits', value as number, rampTime);
      }
      if (name === 'bitcrusherDownsample') {
        chain.bitcrusher.setParam('downsample', value as number, rampTime);
      }
      // Panner
      if (name === 'panEnabled') {
        chain.panner.bypassed = !(value as boolean);
      }
      if (name === 'panPosition') {
        // Convert 0-100 to -100 to 100
        chain.panner.setParam('pan', ((value as number) - 50) * 2, rampTime);
      }
      // Phaser
      if (name === 'phaserEnabled') {
        chain.phaser.bypassed = !(value as boolean);
      }
      if (name === 'phaserRate') {
        chain.phaser.setParam('rate', value as number, rampTime);
      }
      if (name === 'phaserDepth') {
        chain.phaser.setParam('depth', value as number, rampTime);
      }
      if (name === 'phaserMix') {
        chain.phaser.setParam('mix', value as number, rampTime);
      }
      // Flanger
      if (name === 'flangerEnabled') {
        chain.flanger.bypassed = !(value as boolean);
      }
      if (name === 'flangerRate') {
        chain.flanger.setParam('rate', value as number, rampTime);
      }
      if (name === 'flangerDepth') {
        chain.flanger.setParam('depth', value as number, rampTime);
      }
      if (name === 'flangerMix') {
        chain.flanger.setParam('mix', value as number, rampTime);
      }
      // Spatial 3D
      if (name === 'spatialEnabled') {
        chain.spatialPanner.bypassed = !(value as boolean);
      }
      if (name === 'spatialX') {
        chain.spatialPanner.setParam('positionX', value as number, rampTime);
      }
      if (name === 'spatialY') {
        chain.spatialPanner.setParam('positionY', value as number, rampTime);
      }
      if (name === 'spatialZ') {
        chain.spatialPanner.setParam('positionZ', value as number, rampTime);
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
