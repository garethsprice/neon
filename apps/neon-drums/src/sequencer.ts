/**
 * Sequencer - Pattern-based drum sequencer with track arrangement
 */

import type { AudioEngine, FXParams } from './audio-engine';

export type PatternId = string;
export type InstrumentKey = string;

export interface PatternData {
  numSteps: number;
  scale: number;
  shuffle: number;
  tracks: Record<InstrumentKey, number[]>;
  flams: Record<InstrumentKey, boolean[]>;
}

export interface TrackParams extends FXParams {
  level: number;
  flamAmount: number;
  [key: string]: unknown;
}

export interface SerializedData {
  bpm: number;
  trackName: string;
  trackDescription: string;
  trackSkill: string | null;
  thumbnailUrl: string | null;
  thumbnailPrompt: string | null;
  masterVolume: number;
  trackMeasures: (PatternId | null)[];
  trackParams: Record<InstrumentKey, TrackParams>;
  patterns: Record<PatternId, SerializedPattern>;
  patternChain: PatternId[];
  songMode: boolean;
  trackMode: boolean;
}

export interface SerializedPattern {
  numSteps: number;
  scale: number;
  shuffle: number;
  tracks: Record<InstrumentKey, Record<string, number>>;
  flams: Record<InstrumentKey, Record<string, boolean>>;
}

export interface LoadPatternData {
  pattern?: Record<InstrumentKey, number[] | Record<string, number>>;
  flams?: Record<InstrumentKey, boolean[] | Record<string, boolean>>;
  numSteps?: number;
  scale?: number;
  shuffle?: number;
}

export class Sequencer {
  audio: AudioEngine;
  IDS: PatternId[] = 'ABCDEFGHIJKLMNOP'.split('');
  INSTS: InstrumentKey[] = [
    'bassDrum', 'snareDrum', 'lowTom', 'midTom', 'highTom',
    'rimshot', 'handclap', 'closedHiHat', 'openHiHat',
    'crashCymbal', 'rideCymbal'
  ];

  onStepChange: ((step: number) => void) | null = null;
  onPatternChange: ((id: PatternId) => void) | null = null;
  onInstrumentTrigger: ((inst: InstrumentKey, stepIdx: number) => void) | null = null;
  onTrackUpdate: ((measure?: number, id?: PatternId | null) => void) | null = null;

  bpm = 120;
  isPlaying = false;
  currentStep = 0;
  numSteps = 16;
  currentPatternId: PatternId = 'A';
  patterns: Record<PatternId, PatternData> = {};
  trackParams: Record<InstrumentKey, TrackParams> = {};
  patternChain: PatternId[] = [];
  currentChainIndex = 0;
  masterVolume = 80;
  trackMode = false;
  songMode = false;
  isTrackPlaying = false;
  trackMeasures: (PatternId | null)[] = Array(96).fill(null);
  currentTrackMeasure = 0;
  trackName = "";
  trackDescription = "";
  trackSkill: string | null = null;
  thumbnailUrl: string | null = null;
  thumbnailPrompt: string | null = null;
  timerId: ReturnType<typeof setTimeout> | null = null;

  constructor(audioEngine: AudioEngine) {
    this.audio = audioEngine;

    Object.defineProperty(this, 'tracks', {
      get: () => this.patterns[this.currentPatternId]?.tracks
    });
    Object.defineProperty(this, 'flams', {
      get: () => this.patterns[this.currentPatternId]?.flams
    });

    this.initData();
  }

  get tracks(): Record<InstrumentKey, number[]> {
    return this.patterns[this.currentPatternId]?.tracks;
  }

  get flams(): Record<InstrumentKey, boolean[]> {
    return this.patterns[this.currentPatternId]?.flams;
  }

  initData(): void {
    this.bpm = 120;
    this.isPlaying = false;
    this.currentStep = 0;
    this.numSteps = 16;
    this.currentPatternId = 'A';
    this.patterns = {};

    this.IDS.forEach(id => {
      this.patterns[id] = {
        numSteps: 16,
        scale: 1,
        shuffle: 0,
        tracks: Object.fromEntries(this.INSTS.map(k => [k, Array(32).fill(0)])),
        flams: Object.fromEntries(this.INSTS.map(k => [k, Array(32).fill(false)]))
      };
    });

    this.trackParams = {} as Record<InstrumentKey, TrackParams>;
    this.INSTS.forEach(key => {
      const info = this.audio.manifest?.instruments[key] || { parameters: [] };
      this.trackParams[key] = {
        saturationEnabled: false,
        saturationDrive: 20,
        compressionEnabled: false,
        compressionThreshold: 50,
        compressionRatio: 50,
        sidechainEnabled: false,
        sidechainAmount: 50,
        sidechainRelease: 30,
        reverbEnabled: false,
        reverbMix: 15,
        delayEnabled: false,
        delayTime: 30,
        delayFeedback: 40,
        delayMix: 30,
        lpFilterEnabled: false,
        lpFilterCutoff: 100,
        lpFilterResonance: 0,
        hpFilterEnabled: false,
        hpFilterCutoff: 0,
        hpFilterResonance: 0,
        flamAmount: 20,
        level: 80
      };
      [...info.parameters].forEach(p => {
        const scale = this.audio.getScaleForParam(key, p);
        this.trackParams[key][p] = scale[Math.floor(scale.length / 2)];
      });
      if (this.audio.isLoaded) this.audio.updateFX(key, this.trackParams[key]);
    });

    this.patternChain = [];
    this.currentChainIndex = 0;
    this.masterVolume = 80;
    this.trackMode = false;
    this.songMode = false;
    this.isTrackPlaying = false;
    this.trackMeasures = Array(96).fill(null);
    this.currentTrackMeasure = 0;
    this.trackName = "";
    this.trackDescription = "";
    this.trackSkill = null;
    this.thumbnailUrl = null;
    this.thumbnailPrompt = null;
  }

  toggleStep(instrument: InstrumentKey, step: number): number {
    this.tracks[instrument][step] = (this.tracks[instrument][step] + 1) % 3;
    return this.tracks[instrument][step];
  }

  toggleFlam(instrument: InstrumentKey, step: number): boolean {
    this.flams[instrument][step] = !this.flams[instrument][step];
    return this.flams[instrument][step];
  }

  switchPattern(id: PatternId, keepChain = false): void {
    if (this.patterns[id]) {
      this.currentPatternId = id;
      this.numSteps = this.patterns[id].numSteps;

      if (!keepChain) {
        const idxInChain = this.patternChain.indexOf(id);
        if (idxInChain !== -1) {
          this.currentChainIndex = idxInChain;
        } else if (this.patternChain.length <= 1) {
          this.patternChain = [];
          this.currentChainIndex = 0;
        }
      }
    }
  }

  togglePatternInChain(id: PatternId): PatternId[] {
    const idx = this.patternChain.indexOf(id);
    if (idx > -1) {
      this.patternChain.splice(idx, 1);
    } else {
      this.patternChain.push(id);
      this.patternChain.sort();
    }

    if (this.patternChain.length > 0) {
      const currentIdxInChain = this.patternChain.indexOf(this.currentPatternId);
      this.currentChainIndex = currentIdxInChain !== -1 ? currentIdxInChain : 0;
    } else {
      this.currentChainIndex = 0;
    }

    return this.patternChain;
  }

  copyPattern(fromId: PatternId, toId: PatternId): void {
    if (!this.patterns[fromId] || !this.patterns[toId]) return;
    const from = this.patterns[fromId];
    const to = this.patterns[toId];

    to.numSteps = from.numSteps;
    to.scale = from.scale || 1.0;
    to.shuffle = from.shuffle || 0;
    Object.keys(from.tracks).forEach(key => {
      to.tracks[key] = [...from.tracks[key]];
      to.flams[key] = [...from.flams[key]];
    });
  }

  clearPattern(id: PatternId): void {
    if (this.patterns[id]) {
      Object.keys(this.patterns[id].tracks).forEach(key => {
        this.patterns[id].tracks[key].fill(0);
        this.patterns[id].flams[key].fill(false);
      });
    }
  }

  doublePattern(): void {
    Object.keys(this.tracks).forEach(key => {
      for (let i = 0; i < 16; i++) {
        this.tracks[key][i + 16] = this.tracks[key][i];
        this.flams[key][i + 16] = this.flams[key][i];
      }
    });
    this.patterns[this.currentPatternId].numSteps = 32;
    this.numSteps = 32;
  }

  clearAll(): void {
    Object.keys(this.tracks).forEach(key => {
      this.tracks[key].fill(0);
      this.flams[key].fill(false);
    });
  }

  clearAllPatterns(): void {
    this.IDS.forEach(id => this.clearPattern(id));
  }

  resetAll(): void {
    this.initData();
    this.audio.setMasterVolume(80);
  }

  serialize(): SerializedData {
    const patternsData: Record<PatternId, SerializedPattern> = {};
    this.IDS.forEach(id => {
      const p = this.patterns[id];
      const hasHits = Object.values(p.tracks).some(t => t.some(v => v > 0));
      if (hasHits) {
        const sparseTracks: Record<InstrumentKey, Record<string, number>> = {};
        Object.entries(p.tracks).forEach(([inst, hits]) => {
          if (hits.some(v => v > 0)) {
            const sparse: Record<string, number> = {};
            hits.forEach((v, i) => { if (v > 0) sparse[i] = v; });
            sparseTracks[inst] = sparse;
          }
        });
        const sparseFlams: Record<InstrumentKey, Record<string, boolean>> = {};
        Object.entries(p.flams).forEach(([inst, flams]) => {
          if (flams.some(v => v)) {
            const sparse: Record<string, boolean> = {};
            flams.forEach((v, i) => { if (v) sparse[i] = true; });
            sparseFlams[inst] = sparse;
          }
        });
        patternsData[id] = {
          numSteps: p.numSteps,
          scale: p.scale,
          shuffle: p.shuffle,
          tracks: sparseTracks,
          flams: sparseFlams
        };
      }
    });

    return {
      bpm: this.bpm,
      trackName: this.trackName,
      trackDescription: this.trackDescription,
      trackSkill: this.trackSkill,
      thumbnailUrl: this.thumbnailUrl,
      thumbnailPrompt: this.thumbnailPrompt,
      masterVolume: this.masterVolume,
      trackMeasures: this.trackMeasures,
      trackParams: this.trackParams,
      patterns: patternsData,
      patternChain: this.patternChain,
      songMode: this.songMode,
      trackMode: this.trackMode
    };
  }

  deserialize(data: Partial<SerializedData>): void {
    if (!data) return;
    this.initData();
    if (data.bpm) this.bpm = data.bpm;
    if (data.trackName) this.trackName = data.trackName;
    if (data.trackDescription) this.trackDescription = data.trackDescription;
    if (data.trackSkill) this.trackSkill = data.trackSkill;
    if (data.thumbnailUrl) this.thumbnailUrl = data.thumbnailUrl;
    if (data.thumbnailPrompt) this.thumbnailPrompt = data.thumbnailPrompt;
    if (data.masterVolume !== undefined) this.masterVolume = data.masterVolume;
    if (data.songMode !== undefined) this.songMode = data.songMode;
    if (data.trackMode !== undefined) this.trackMode = data.trackMode;

    if (data.trackMeasures) {
      this.trackMeasures = [...data.trackMeasures];
    }

    if (data.patternChain) {
      this.patternChain = [...data.patternChain];
    }

    if (data.trackParams) {
      Object.keys(data.trackParams).forEach(inst => {
        if (this.trackParams[inst]) {
          Object.assign(this.trackParams[inst], data.trackParams![inst]);
          if (this.audio.isLoaded) this.audio.updateFX(inst, this.trackParams[inst]);
        }
      });
    }

    if (data.patterns) {
      Object.entries(data.patterns).forEach(([id, pData]) => {
        const target = this.patterns[id];
        if (!target) return;
        target.numSteps = pData.numSteps || 16;
        target.scale = pData.scale || 1.0;
        target.shuffle = pData.shuffle || 0;

        if (pData.tracks) {
          Object.entries(pData.tracks).forEach(([inst, hits]) => {
            if (target.tracks[inst]) {
              target.tracks[inst].fill(0);
              Object.entries(hits).forEach(([idx, val]) => {
                target.tracks[inst][parseInt(idx)] = val;
              });
            }
          });
        }

        if (pData.flams) {
          Object.entries(pData.flams).forEach(([inst, flams]) => {
            if (target.flams[inst]) {
              target.flams[inst].fill(false);
              Object.entries(flams).forEach(([idx, val]) => {
                target.flams[inst][parseInt(idx)] = val;
              });
            }
          });
        }
      });
    }

    const current = this.patterns[this.currentPatternId];
    this.numSteps = current.numSteps;
  }

  loadGlobalSettings(data: {
    bpm?: number;
    trackName?: string;
    track?: PatternId[];
    params?: Record<InstrumentKey, Record<string, unknown>>;
  }): void {
    if (data.bpm) this.bpm = data.bpm;
    if (data.trackName) this.trackName = data.trackName;
    if (data.track) {
      this.trackMeasures.fill(null);
      data.track.forEach((p, i) => { if (i < 96) this.trackMeasures[i] = p; });
    }
    if (data.params) {
      Object.keys(data.params).forEach(instKey => {
        if (this.trackParams[instKey]) {
          Object.entries(data.params![instKey]).forEach(([paramName, value]) => {
            this.setParam(instKey, paramName, value as number);
          });
        }
      });
    }
  }

  loadPattern(data: LoadPatternData, targetId: PatternId | null = null): void {
    const id = targetId || this.currentPatternId;
    const targetPattern = this.patterns[id];
    if (!targetPattern) return;

    const pattern = data.pattern || data;
    let finalNumSteps = 16;
    if (data.numSteps) {
      finalNumSteps = data.numSteps;
    } else {
      Object.values(pattern as Record<string, unknown>).forEach(trackData => {
        if (Array.isArray(trackData) && trackData.length > 16) finalNumSteps = 32;
        if (typeof trackData === 'object' && trackData !== null) {
          Object.keys(trackData as Record<string, unknown>).forEach(k => {
            if (parseInt(k) >= 16) finalNumSteps = 32;
          });
        }
      });
    }

    targetPattern.numSteps = finalNumSteps;
    if (id === this.currentPatternId) {
      this.numSteps = finalNumSteps;
    }

    if (data.scale !== undefined) {
      targetPattern.scale = data.scale;
    }
    if (data.shuffle !== undefined) {
      targetPattern.shuffle = Math.max(0, Math.min(100, data.shuffle));
    }

    const patternData = data.pattern || {};
    Object.keys(patternData).forEach(key => {
      if (targetPattern.tracks[key]) {
        targetPattern.tracks[key].fill(0);

        const trackData = patternData[key];

        if (Array.isArray(trackData)) {
          trackData.forEach((val, idx) => {
            if (idx < 32) {
              if (typeof val === 'boolean') {
                targetPattern.tracks[key][idx] = val ? 1 : 0;
              } else {
                targetPattern.tracks[key][idx] = Math.max(0, Math.min(2, parseInt(String(val)) || 0));
              }
            }
          });
        } else if (typeof trackData === 'object' && trackData !== null) {
          Object.entries(trackData as Record<string, number | boolean>).forEach(([idx, val]) => {
            const i = parseInt(idx);
            if (i >= 0 && i < 32) {
              if (typeof val === 'boolean') {
                targetPattern.tracks[key][i] = val ? 1 : 0;
              } else {
                targetPattern.tracks[key][i] = Math.max(0, Math.min(2, parseInt(String(val)) || 0));
              }
            }
          });
        }
      }
    });

    if (data.flams) {
      Object.keys(data.flams).forEach(key => {
        if (targetPattern.flams[key]) {
          targetPattern.flams[key].fill(false);
          const flamData = data.flams![key];
          if (Array.isArray(flamData)) {
            flamData.forEach((val, idx) => {
              if (idx < 32) targetPattern.flams[key][idx] = !!val;
            });
          } else if (typeof flamData === 'object' && flamData !== null) {
            Object.entries(flamData).forEach(([idx, val]) => {
              const i = parseInt(idx);
              if (i >= 0 && i < 32) targetPattern.flams[key][i] = !!val;
            });
          }
        }
      });
    }
  }

  setParam(instrument: InstrumentKey, param: string, value: number): void {
    if (this.trackParams[instrument]) {
      const instInfo = this.audio.manifest?.instruments[instrument];
      if (instInfo?.parameters.includes(param) || param === 'level') {
        const scale = this.audio.getScaleForParam(instrument, param);
        const closest = scale.reduce((prev, curr) =>
          Math.abs(curr - value) < Math.abs(prev - value) ? curr : prev
        );
        this.trackParams[instrument][param] = closest;
      } else {
        this.trackParams[instrument][param] = value;
        this.audio.updateFX(instrument, this.trackParams[instrument]);
      }
    }
  }

  start(): void {
    if (this.isPlaying) return;
    this.isPlaying = true;
    this.currentStep = 0;
    this.schedule();
  }

  stop(): void {
    this.isPlaying = false;
    if (this.timerId) clearTimeout(this.timerId);
    this.currentStep = 0;
  }

  schedule(): void {
    if (!this.isPlaying && !this.isTrackPlaying) return;

    if (this.tracks['bassDrum'] && this.tracks['bassDrum'][this.currentStep] > 0) {
      this.audio.triggerSidechain('bassDrum', (inst, param) => {
        const params = this.trackParams[inst];
        return params ? params[param] : false;
      });
    }

    Object.keys(this.tracks).forEach(instKey => {
      const hitType = this.tracks[instKey][this.currentStep];
      const isFlam = this.flams[instKey][this.currentStep];

      if (hitType > 0) {
        const params = { ...this.trackParams[instKey] };
        if (hitType === 2) {
          params.level = Math.min(100, params.level + 25);
        }

        if (isFlam) {
          const graceParams = { ...params, level: params.level * 0.5 };
          this.audio.play(instKey, graceParams);
          const flamDelay = this.trackParams[instKey].flamAmount || 20;
          setTimeout(() => {
            this.audio.play(instKey, params);
            if (this.onInstrumentTrigger) this.onInstrumentTrigger(instKey, this.currentStep);
          }, flamDelay);
        } else {
          this.audio.play(instKey, params);
          if (this.onInstrumentTrigger) this.onInstrumentTrigger(instKey, this.currentStep);
        }
      }
    });

    if (this.onStepChange) this.onStepChange(this.currentStep);

    const pattern = this.patterns[this.currentPatternId];
    const scaleMultiplier = pattern.scale || 1.0;
    const shuffleAmount = pattern.shuffle || 0;
    const baseStepDuration = (60000 / this.bpm / 4) * scaleMultiplier;

    const delayMs = baseStepDuration * (shuffleAmount / 100) * 0.5;

    let nextInterval = baseStepDuration;
    if (this.currentStep % 2 === 0) {
      nextInterval += delayMs;
    } else {
      nextInterval -= delayMs;
    }

    this.currentStep = (this.currentStep + 1);

    if (this.currentStep >= this.numSteps) {
      this.currentStep = 0;

      if (this.isTrackPlaying) {
        this.currentTrackMeasure++;
        if (this.currentTrackMeasure >= 96 || this.trackMeasures[this.currentTrackMeasure] === null) {
          this.currentTrackMeasure = 0;
        }

        const nextId = this.trackMeasures[this.currentTrackMeasure];
        if (nextId) {
          this.switchPattern(nextId, true);
          if (this.onPatternChange) this.onPatternChange(nextId);
        }
        if (this.onTrackUpdate) this.onTrackUpdate(this.currentTrackMeasure, nextId);
      } else if (this.patternChain.length > 1) {
        this.currentChainIndex = (this.currentChainIndex + 1) % this.patternChain.length;
        const nextId = this.patternChain[this.currentChainIndex];
        this.switchPattern(nextId, true);
        if (this.onPatternChange) this.onPatternChange(nextId);
      }
    }

    this.timerId = setTimeout(() => this.schedule(), nextInterval);
  }
}
