import {
    LowpassFilter,
    Reverb,
    Compressor,
    Saturation,
    Delay
} from '../../packages/neon-fx/index.js';

export class AudioEngine {
    constructor() {
        this.ctx = new (window.AudioContext || window.webkitAudioContext)();
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

        // Active voices
        this.voices = new Map();

        // Global Parameters
        this.globalParams = {
            masterVolume: 0.5,
            bpm: 120
        };

        // Per-track Parameters
        this.trackParams = Array.from({ length: 4 }, () => ({
            waveType: 'sawtooth',
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

    setupTrackChain(trackIdx) {
        // Create per-track effects using neon-fx plugins
        const filter = new LowpassFilter(this.ctx, {
            cutoff: this.trackParams[trackIdx].filterCutoff,
            resonance: this.trackParams[trackIdx].filterReso * 5
        });

        const saturation = new Saturation(this.ctx, {
            drive: this.trackParams[trackIdx].saturationDrive || 0,
            mix: 100
        });
        saturation.bypassed = true; // Off by default

        const delay = new Delay(this.ctx, {
            time: this.trackParams[trackIdx].delayTime * 1000, // Convert to ms
            feedback: 40,
            mix: this.trackParams[trackIdx].delayMix * 100,
            damping: 0
        });

        const reverb = new Reverb(this.ctx, {
            mix: this.trackParams[trackIdx].reverbMix * 100,
            decay: 2.0,
            damping: 50,
            preDelay: 10
        });

        // Input/output nodes
        const input = this.ctx.createGain();
        const output = this.ctx.createGain();

        // Routing: input -> filter -> saturation -> delay -> reverb -> output
        input.connect(filter.input);
        filter.connect(saturation);
        saturation.connect(delay);
        delay.connect(reverb);
        reverb.output.connect(output);

        output.connect(this.masterGain);

        this.trackChains.set(trackIdx, {
            input,
            filter,
            saturation,
            delay,
            reverb,
            output
        });
    }

    async resume() {
        if (this.ctx.state === 'suspended') {
            await this.ctx.resume();
        }
    }

    updateParam(name, value, trackIdx = 0) {
        const rampTime = 0.05;

        if (name === 'masterVolume') {
            this.globalParams.masterVolume = value;
            this.masterGain.gain.setTargetAtTime(value, this.ctx.currentTime, 0.1);
            return;
        }
        if (name === 'bpm') {
            this.globalParams.bpm = value;
            return;
        }

        const p = this.trackParams[trackIdx];
        const chain = this.trackChains.get(trackIdx);

        if (p && chain) {
            p[name] = value;

            // Update neon-fx plugins
            if (name === 'filterCutoff') {
                chain.filter.setParam('cutoff', value, rampTime);
            }
            if (name === 'filterReso') {
                chain.filter.setParam('resonance', value * 5, rampTime);
            }
            if (name === 'delayTime') {
                chain.delay.setParam('time', value * 1000, rampTime); // Convert to ms
            }
            if (name === 'delayMix') {
                chain.delay.setParam('mix', value * 100, rampTime);
            }
            if (name === 'reverbMix') {
                chain.reverb.setParam('mix', value * 100, rampTime);
            }
            if (name === 'saturationDrive') {
                if (value > 0) {
                    chain.saturation.setParam('drive', value, rampTime);
                    chain.saturation.bypassed = false;
                } else {
                    chain.saturation.bypassed = true;
                }
            }
        }
    }

    getParams(trackIdx) {
        return this.trackParams[trackIdx] || this.trackParams[0];
    }

    noteOn(note, freq, trackIdx = 0) {
        if (this.voices.has(note)) return;
        const p = this.trackParams[trackIdx];
        const chain = this.trackChains.get(trackIdx);
        if (!chain) return;

        const osc = this.ctx.createOscillator();
        const vca = this.ctx.createGain();

        osc.type = p.waveType;
        osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
        osc.detune.setValueAtTime(p.detune, this.ctx.currentTime);

        vca.gain.setValueAtTime(0, this.ctx.currentTime);
        const attackTime = this.ctx.currentTime + p.attack;
        vca.gain.linearRampToValueAtTime(1, attackTime);
        vca.gain.linearRampToValueAtTime(p.sustain, attackTime + p.decay);

        osc.connect(vca);
        vca.connect(chain.input);

        osc.start();

        this.voices.set(note, { osc, vca, trackIdx });
    }

    noteOff(note, trackIdx = 0) {
        const voice = this.voices.get(note);
        if (!voice) return;
        const p = this.trackParams[voice.trackIdx];

        const { osc, vca } = voice;
        const releaseTime = this.ctx.currentTime + p.release;

        vca.gain.cancelScheduledValues(this.ctx.currentTime);
        vca.gain.setValueAtTime(vca.gain.value, this.ctx.currentTime);
        vca.gain.exponentialRampToValueAtTime(0.001, releaseTime);

        setTimeout(() => {
            osc.stop();
            osc.disconnect();
            vca.disconnect();
        }, p.release * 1000 + 100);

        this.voices.delete(note);
    }

    triggerNote(trackIdx, noteIndex, freq, durationSeconds = 0.1) {
        const p = this.trackParams[trackIdx];
        const chain = this.trackChains.get(trackIdx);
        if (!chain) return;

        const osc = this.ctx.createOscillator();
        const vca = this.ctx.createGain();

        osc.type = p.waveType;
        osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
        osc.detune.setValueAtTime(p.detune, this.ctx.currentTime);

        vca.gain.setValueAtTime(0, this.ctx.currentTime);
        const attackTime = this.ctx.currentTime + p.attack;
        vca.gain.linearRampToValueAtTime(1, attackTime);
        const decayEnd = attackTime + p.decay;
        vca.gain.linearRampToValueAtTime(p.sustain, decayEnd);

        const releaseStartTime = Math.max(decayEnd, this.ctx.currentTime + durationSeconds);
        const releaseEndTime = releaseStartTime + p.release;

        vca.gain.setValueAtTime(p.sustain, releaseStartTime);
        vca.gain.exponentialRampToValueAtTime(0.001, releaseEndTime);

        osc.connect(vca);
        vca.connect(chain.input);

        osc.start();
        osc.stop(releaseEndTime);

        setTimeout(() => {
            osc.disconnect();
            vca.disconnect();
        }, (releaseEndTime - this.ctx.currentTime) * 1000 + 100);
    }
}
