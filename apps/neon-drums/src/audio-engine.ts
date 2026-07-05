/**
 * AudioEngine - Drum machine audio engine with sample playback and FX chains
 */

import {
  LowpassFilter,
  HighpassFilter,
  Saturation,
  Compressor,
  Limiter,
  Reverb,
  Delay,
  StereoPanner,
  Distortion,
  Bitcrusher
} from '@neon/fx';

export type InstrumentKey =
  | 'bassDrum' | 'snareDrum' | 'lowTom' | 'midTom' | 'highTom'
  | 'rimshot' | 'handclap' | 'closedHiHat' | 'openHiHat'
  | 'crashCymbal' | 'rideCymbal' | 'closedToOpen' | 'openToClosed';

export interface InstrumentInfo {
  displayName: string;
  parameters: string[];
}

export interface Manifest {
  instruments: Record<string, InstrumentInfo>;
  data: Record<string, SampleData[]>;
  definitions: Record<string, string[]>;
}

export type SampleData = [string, number, number, ...number[]];

export interface FXParams {
  // Filters
  lpFilterEnabled?: boolean;
  lpFilterCutoff?: number;
  lpFilterResonance?: number;
  hpFilterEnabled?: boolean;
  hpFilterCutoff?: number;
  hpFilterResonance?: number;
  // Saturation
  saturationEnabled?: boolean;
  saturationDrive?: number;
  // Distortion
  distortionEnabled?: boolean;
  distortionDrive?: number;
  distortionTone?: number;
  distortionType?: 'soft' | 'hard' | 'fuzz' | 'overdrive';
  // Bitcrusher
  bitcrusherEnabled?: boolean;
  bitcrusherBits?: number;
  bitcrusherDownsample?: number;
  // Compression
  compressionEnabled?: boolean;
  compressionThreshold?: number;
  compressionRatio?: number;
  // Stereo Panning
  panEnabled?: boolean;
  panPosition?: number;
  // Sidechain
  sidechainEnabled?: boolean;
  sidechainAmount?: number;
  sidechainRelease?: number;
  // Reverb
  reverbEnabled?: boolean;
  reverbMix?: number;
  // Delay
  delayEnabled?: boolean;
  delayTime?: number;
  delayFeedback?: number;
  delayMix?: number;
  [key: string]: unknown;
}

export interface PlayParams extends FXParams {
  level?: number;
  [key: string]: unknown;
}

interface EffectChain {
  input: GainNode;
  lpFilter: LowpassFilter;
  hpFilter: HighpassFilter;
  saturation: Saturation;
  distortion: Distortion;
  bitcrusher: Bitcrusher;
  compressor: Compressor;
  panner: StereoPanner;
  delay: Delay;
  sidechainGain: GainNode;
  reverb: Reverb;
  output: GainNode;
}

export interface AudioEngineOptions {
  onError?: (message: string) => void;
}

export class AudioEngine {
  ctx: AudioContext;
  manifest: Manifest | null = null;
  buffers: Map<string, AudioBuffer> = new Map();
  isLoaded = false;
  onError: (message: string) => void;
  chains: Map<string, EffectChain> = new Map();
  masterGain: GainNode;
  masterLimiter: Limiter;
  openHiHatGainNode: GainNode | null = null;
  spriteBuffer: AudioBuffer | null = null;
  /** Hits scheduled via play() — lets stop cancel the lookahead window. */
  private activeHits: Array<{ source: AudioBufferSourceNode; startTime: number }> = [];

  constructor(options: AudioEngineOptions = {}) {
    this.ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    this.onError = options.onError || (() => {});

    // Master chain: gain -> limiter -> destination
    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.value = 0.8;

    // Master limiter prevents clipping and adds punch
    this.masterLimiter = new Limiter(this.ctx, {
      threshold: -1,  // Brick wall at -1dB
      release: 50     // Fast release for transients
    });

    this.masterGain.connect(this.masterLimiter.input);
    this.masterLimiter.connect(this.ctx.destination);
  }

  setMasterVolume(value: number): void {
    if (this.ctx) {
      this.masterGain.gain.setTargetAtTime(value / 100, this.ctx.currentTime, 0.02);
    }
  }

  setupChain(instrumentKey: string): void {
    // Filters for tone shaping
    const lpFilter = new LowpassFilter(this.ctx, { cutoff: 20000, resonance: 0 });
    const hpFilter = new HighpassFilter(this.ctx, { cutoff: 20, resonance: 0 });

    // Saturation for warmth/analog feel
    const saturation = new Saturation(this.ctx, { drive: 0, mix: 100 });
    saturation.bypassed = true;

    // Distortion for aggressive sounds
    const distortion = new Distortion(this.ctx, { drive: 30, tone: 50, level: 50, mix: 100, type: 'overdrive' });
    distortion.bypassed = true;

    // Bitcrusher for lo-fi/electronic sounds
    const bitcrusher = new Bitcrusher(this.ctx, { bits: 12, downsample: 1, mix: 100 });
    bitcrusher.bypassed = true;

    // Compressor for punch and consistency
    const compressor = new Compressor(this.ctx, {
      threshold: -24,
      ratio: 12,
      attack: 3,
      release: 250,
      knee: 30,
      makeupGain: 0
    });
    compressor.bypassed = true;

    // Stereo panner for positioning in stereo field
    const panner = new StereoPanner(this.ctx, { pan: 0 });

    // Delay for rhythmic effects
    const delay = new Delay(this.ctx, { time: 300, feedback: 40, mix: 0, damping: 0 });
    delay.bypassed = true;

    // Sidechain ducking
    const sidechainGain = this.ctx.createGain();
    sidechainGain.gain.value = 1.0;

    // Reverb for space
    const reverb = new Reverb(this.ctx, { mix: 0, decay: 1.5, damping: 50, preDelay: 10 });
    reverb.bypassed = true;

    const effectInput = this.ctx.createGain();
    const effectOutput = this.ctx.createGain();

    // Signal chain: input -> filters -> saturation -> distortion -> bitcrusher ->
    //               compressor -> panner -> delay -> sidechain -> reverb -> output
    effectInput.connect(lpFilter.input);
    lpFilter.connect(hpFilter);
    hpFilter.connect(saturation);
    saturation.connect(distortion);
    distortion.connect(bitcrusher);
    bitcrusher.connect(compressor);
    compressor.connect(panner);
    panner.connect(delay);
    delay.output.connect(sidechainGain);
    sidechainGain.connect(reverb.input);
    reverb.output.connect(effectOutput);

    effectOutput.connect(this.masterGain);

    this.chains.set(instrumentKey, {
      input: effectInput,
      lpFilter,
      hpFilter,
      saturation,
      distortion,
      bitcrusher,
      compressor,
      panner,
      delay,
      sidechainGain,
      reverb,
      output: effectOutput
    });
  }

  async init(): Promise<Manifest> {
    try {
      const resp = await fetch('manifest-sprite-compressed.json');
      const comp = await resp.json();
      const names: Record<string, string> = {
        bassDrum: "Bass Drum",
        snareDrum: "Snare Drum",
        lowTom: "Low Tom",
        midTom: "Mid Tom",
        highTom: "High Tom",
        rimshot: "Rimshot",
        handclap: "Hand Clap",
        closedHiHat: "Closed Hi-Hat",
        openHiHat: "Open Hi-Hat",
        crashCymbal: "Crash Cymbal",
        rideCymbal: "Ride Cymbal"
      };

      this.manifest = { instruments: {}, data: comp.d, definitions: comp.def };
      Object.keys(comp.def).forEach(k => {
        this.manifest!.instruments[k] = { displayName: names[k] || k, parameters: comp.def[k] };
      });

      const sResp = await fetch('tr909-sprite.ogg');
      this.spriteBuffer = await this.ctx.decodeAudioData(await sResp.arrayBuffer());
      this.isLoaded = true;

      Object.keys(this.manifest.instruments).forEach(k => {
        if (!['closedToOpen', 'openToClosed'].includes(k)) {
          this.setupChain(k);
        }
      });
      return this.manifest;
    } catch (e) {
      const error = e as Error;
      this.onError(`Init Error: ${error.message}`);
      throw e;
    }
  }

  getScaleForParam(instrumentKey: string, paramName: string): number[] {
    if (!this.manifest) return [0, 50, 100];

    if (paramName === 'level') return [0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100];
    if (paramName === 'velocity') return [50, 100];
    if (paramName === 'variation') return [1, 2, 3, 4];
    if (paramName === 'flamAmount') return [10, 12, 14, 16, 18, 20, 22, 24, 26, 28, 30];

    const scaleType = (instrumentKey === 'closedHiHat' || instrumentKey === 'openHiHat' || instrumentKey === 'crashCymbal' || instrumentKey === 'rideCymbal')
      ? 'hihatCymbal' : 'standard';

    const standardScale = [0, 30, 70, 100];
    const hihatScale = [0, 20, 40, 60, 80, 100];

    return scaleType === 'hihatCymbal' ? hihatScale : standardScale;
  }

  getSampleData(instrumentKey: string, params: PlayParams = {}): SampleData | null {
    if (!this.manifest) return null;
    const samples = this.manifest.data[instrumentKey];
    const paramNames = this.manifest.definitions[instrumentKey];
    if (!samples || !paramNames) return null;

    let bestSample = samples[0];
    let minTotalDiff = Infinity;

    samples.forEach(sample => {
      let currentDiff = 0;
      paramNames.forEach((pName, idx) => {
        const targetVal = params[pName] as number | undefined;
        const sampleVal = sample[3 + idx] as number | undefined;
        if (targetVal !== undefined && sampleVal !== undefined) {
          currentDiff += Math.abs(sampleVal - targetVal);
        }
      });

      if (currentDiff < minTotalDiff) {
        minTotalDiff = currentDiff;
        bestSample = sample;
      }
    });

    return bestSample;
  }

  updateFX(instrumentKey: string, fxParams: FXParams): void {
    const chain = this.chains.get(instrumentKey);
    if (!chain) return;

    const rampTime = 0.02;

    // Lowpass Filter
    if (fxParams.lpFilterEnabled) {
      const freq = 20 * Math.pow(1000, (fxParams.lpFilterCutoff || 100) / 100);
      const resonance = (fxParams.lpFilterResonance || 0) * 0.8;
      chain.lpFilter.setParams({ cutoff: freq, resonance }, rampTime);
      chain.lpFilter.bypassed = false;
    } else {
      chain.lpFilter.bypassed = true;
    }

    // Highpass Filter
    if (fxParams.hpFilterEnabled) {
      const freq = 20 * Math.pow(1000, (fxParams.hpFilterCutoff || 0) / 100);
      const resonance = (fxParams.hpFilterResonance || 0) * 0.8;
      chain.hpFilter.setParams({ cutoff: freq, resonance }, rampTime);
      chain.hpFilter.bypassed = false;
    } else {
      chain.hpFilter.bypassed = true;
    }

    // Saturation
    if (fxParams.saturationEnabled) {
      chain.saturation.setParam('drive', fxParams.saturationDrive || 20, rampTime);
      chain.saturation.bypassed = false;
    } else {
      chain.saturation.bypassed = true;
    }

    // Distortion
    if (fxParams.distortionEnabled) {
      chain.distortion.setParam('drive', fxParams.distortionDrive || 50, rampTime);
      chain.distortion.setParam('tone', fxParams.distortionTone || 50, rampTime);
      if (fxParams.distortionType) {
        chain.distortion.type = fxParams.distortionType;
      }
      chain.distortion.bypassed = false;
    } else {
      chain.distortion.bypassed = true;
    }

    // Bitcrusher
    if (fxParams.bitcrusherEnabled) {
      // bits: 1-16, default 12 for subtle effect
      const bits = fxParams.bitcrusherBits !== undefined ? fxParams.bitcrusherBits : 12;
      const downsample = fxParams.bitcrusherDownsample !== undefined ? fxParams.bitcrusherDownsample : 1;
      chain.bitcrusher.setParam('bits', bits, 0);
      chain.bitcrusher.setParam('downsample', downsample, 0);
      chain.bitcrusher.bypassed = false;
    } else {
      chain.bitcrusher.bypassed = true;
    }

    // Compressor
    if (fxParams.compressionEnabled) {
      const threshold = -((fxParams.compressionThreshold || 50) / 100) * 60;
      const ratio = 1 + ((fxParams.compressionRatio || 50) / 100) * 19;
      chain.compressor.setParams({ threshold, ratio }, rampTime);
      chain.compressor.bypassed = false;
    } else {
      chain.compressor.bypassed = true;
    }

    // Stereo Panner
    if (fxParams.panEnabled) {
      // panPosition from UI: 0 (left) to 100 (right), 50 = center
      // StereoPanner expects: -100 (left) to 100 (right), 0 = center
      const uiValue = fxParams.panPosition !== undefined ? fxParams.panPosition : 50;
      const pan = (uiValue - 50) * 2; // Convert 0-100 to -100 to +100
      chain.panner.setParam('pan', pan, rampTime);
      chain.panner.bypassed = false;
    } else {
      chain.panner.bypassed = true;
    }

    // Reverb
    if (fxParams.reverbEnabled) {
      const mix = Math.min(100, (fxParams.reverbMix || 15) * 1.5);
      chain.reverb.setParam('mix', mix, rampTime);
      chain.reverb.bypassed = false;
    } else {
      chain.reverb.bypassed = true;
    }

    // Delay
    if (fxParams.delayEnabled) {
      const time = 10 + ((fxParams.delayTime || 30) / 100) * 990;
      const feedback = fxParams.delayFeedback || 40;
      const mix = fxParams.delayMix || 30;
      chain.delay.setParams({ time, feedback, mix }, rampTime);
      chain.delay.bypassed = false;
    } else {
      chain.delay.bypassed = true;
    }
  }

  /**
   * Set master limiter threshold
   */
  setMasterLimiterThreshold(dB: number): void {
    this.masterLimiter.setParam('threshold', dB, 0.02);
  }

  /**
   * Get current master limiter gain reduction
   */
  getMasterLimiterReduction(): number {
    return this.masterLimiter.reduction;
  }

  /**
   * Duck other instruments from a kick hit. `time` is an absolute
   * AudioContext timestamp (defaults to now for immediate pad hits).
   * Events arrive in time order from the lookahead transport, so plain
   * scheduling suffices — no cancelScheduledValues, which would erase
   * dips already scheduled inside the lookahead window.
   */
  triggerSidechain(
    sourceInstrumentKey: string,
    getParamValueFn: (inst: string, param: string) => unknown,
    time?: number
  ): void {
    const at = time ?? this.ctx.currentTime;
    this.chains.forEach((chain, targetKey) => {
      if (targetKey === sourceInstrumentKey) return;

      const isEnabled = getParamValueFn(targetKey, 'sidechainEnabled');
      if (isEnabled) {
        const amount = (getParamValueFn(targetKey, 'sidechainAmount') as number) / 100;
        const release = ((getParamValueFn(targetKey, 'sidechainRelease') as number) / 100) * 0.5 + 0.05;

        const targetGain = 1.0 - amount;

        chain.sidechainGain.gain.setTargetAtTime(targetGain, at, 0.005);
        chain.sidechainGain.gain.setTargetAtTime(1.0, at + 0.01, release);
      }
    });
  }

  /**
   * Play a hit. `time` is an absolute AudioContext timestamp for
   * sample-accurate sequencing (defaults to now for immediate pad hits).
   * Assumes sequenced callers schedule in non-decreasing time order.
   */
  async play(instrumentKey: string, params: PlayParams = {}, time?: number): Promise<void> {
    if (!this.isLoaded || !this.spriteBuffer) return;

    const when = time ?? this.ctx.currentTime;
    if (this.ctx.state === 'suspended') {
      await this.ctx.resume();
    }

    if (instrumentKey === 'closedHiHat' && this.openHiHatGainNode) {
      this.openHiHatGainNode.gain.setTargetAtTime(0, when, 0.005);
      this.openHiHatGainNode = null;
    }

    const sampleData = this.getSampleData(instrumentKey, params);
    if (!sampleData) return;

    const [, startMs, durMs] = sampleData;

    const source = this.ctx.createBufferSource();
    source.buffer = this.spriteBuffer;

    const gainNode = this.ctx.createGain();
    const level = (params.level !== undefined) ? (params.level / 100) : 0.8;
    gainNode.gain.setValueAtTime(level, when);

    if (instrumentKey === 'openHiHat') {
      if (this.openHiHatGainNode) {
        this.openHiHatGainNode.gain.setTargetAtTime(0, when, 0.005);
      }
      this.openHiHatGainNode = gainNode;
    }

    source.connect(gainNode);

    const chain = this.chains.get(instrumentKey);
    if (chain) {
      gainNode.connect(chain.input);
    } else {
      gainNode.connect(this.masterGain);
    }

    source.start(when, startMs / 1000, durMs / 1000);

    const hit = { source, startTime: when };
    this.activeHits.push(hit);
    source.onended = (): void => {
      this.activeHits = this.activeHits.filter(h => h !== hit);
      if (this.openHiHatGainNode === gainNode) {
        this.openHiHatGainNode = null;
      }
    };
  }

  /**
   * Cancel hits scheduled after `time` (the lookahead window on stop).
   * Hits already sounding ring out, matching the pre-transport behavior.
   */
  silenceAfter(time?: number): void {
    const at = time ?? this.ctx.currentTime;
    for (const hit of this.activeHits) {
      if (hit.startTime > at) {
        hit.source.stop(at);
      }
    }
  }
}
