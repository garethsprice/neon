import {
    LowpassFilter,
    HighpassFilter,
    Saturation,
    Compressor,
    Reverb,
    Delay
} from '../../packages/neon-fx/index.js';

export class AudioEngine {
    constructor(options = {}) {
        this.ctx = new (window.AudioContext || window.webkitAudioContext)();
        this.manifest = null;
        this.buffers = new Map();
        this.isLoaded = false;
        this.onError = options.onError || (() => {});

        // Track effect chains: instrumentKey -> { lpFilter, hpFilter, saturation, compressor, sidechainGain, reverb, ... }
        this.chains = new Map();

        // Master Gain
        this.masterGain = this.ctx.createGain();
        this.masterGain.gain.value = 0.8;
        this.masterGain.connect(this.ctx.destination);

        // Hi-Hat Choking state
        this.openHiHatGainNode = null;
    }

    setMasterVolume(value) {
        // value 0-100
        if (this.ctx) {
            this.masterGain.gain.setTargetAtTime(value / 100, this.ctx.currentTime, 0.02);
        }
    }

    setupChain(instrumentKey) {
        // Create plugins
        const lpFilter = new LowpassFilter(this.ctx, { cutoff: 20000, resonance: 0 });
        const hpFilter = new HighpassFilter(this.ctx, { cutoff: 20, resonance: 0 });
        const saturation = new Saturation(this.ctx, { drive: 0, mix: 100 });
        const compressor = new Compressor(this.ctx, {
            threshold: -24,
            ratio: 12,
            attack: 3,
            release: 250,
            knee: 30,
            makeupGain: 0
        });
        const delay = new Delay(this.ctx, { time: 300, feedback: 40, mix: 0, damping: 0 });
        const reverb = new Reverb(this.ctx, { mix: 0, decay: 1.5, damping: 50, preDelay: 10 });

        // Manual sidechain gain node (triggered externally)
        const sidechainGain = this.ctx.createGain();
        sidechainGain.gain.value = 1.0;

        // Input/output nodes
        const effectInput = this.ctx.createGain();
        const effectOutput = this.ctx.createGain();

        // Routing: Input -> LP Filter -> HP Filter -> Saturation -> Compressor -> Delay -> Sidechain -> Reverb -> Output
        effectInput.connect(lpFilter.input);
        lpFilter.connect(hpFilter);
        hpFilter.connect(saturation);
        saturation.connect(compressor);
        compressor.connect(delay);
        delay.output.connect(sidechainGain);
        sidechainGain.connect(reverb.input);
        reverb.output.connect(effectOutput);

        effectOutput.connect(this.masterGain);

        this.chains.set(instrumentKey, {
            input: effectInput,
            lpFilter,
            hpFilter,
            saturation,
            compressor,
            delay,
            sidechainGain,
            reverb,
            output: effectOutput
        });
    }

    async init() {
        try {
            const resp = await fetch('manifest-sprite-compressed.json');
            const comp = await resp.json();
            const names = { bassDrum: "Bass Drum", snareDrum: "Snare Drum", lowTom: "Low Tom", midTom: "Mid Tom", highTom: "High Tom", rimshot: "Rimshot", handclap: "Hand Clap", closedHiHat: "Closed Hi-Hat", openHiHat: "Open Hi-Hat", crashCymbal: "Crash Cymbal", rideCymbal: "Ride Cymbal" };

            this.manifest = { instruments: {}, data: comp.d, definitions: comp.def };
            Object.keys(comp.def).forEach(k => this.manifest.instruments[k] = { displayName: names[k] || k, parameters: comp.def[k] });

            const sResp = await fetch('tr909-sprite.ogg');
            this.spriteBuffer = await this.ctx.decodeAudioData(await sResp.arrayBuffer());
            this.isLoaded = true;

            Object.keys(this.manifest.instruments).forEach(k => !['closedToOpen','openToClosed'].includes(k) && this.setupChain(k));
            return this.manifest;
        } catch (e) {
            this.onError(`Init Error: ${e.message}`);
            throw e;
        }
    }

    getScaleForParam(instrumentKey, paramName) {
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

    // Matches available samples for specific instrument + params
    getSampleData(instrumentKey, params = {}) {
        const samples = this.manifest.data[instrumentKey];
        const paramNames = this.manifest.definitions[instrumentKey];
        if (!samples || !paramNames) return null;

        let bestSample = samples[0];
        let minTotalDiff = Infinity;

        samples.forEach(sample => {
            let currentDiff = 0;
            // Sample structure: [name, start_ms, dur_ms, p1, p2, ...]
            paramNames.forEach((pName, idx) => {
                const targetVal = params[pName];
                const sampleVal = sample[3 + idx]; // params start at index 3
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

    updateFX(instrumentKey, fxParams) {
        const chain = this.chains.get(instrumentKey);
        if (!chain) return;

        const rampTime = 0.02;

        // LP Filter - map 0-100 to 20-20000Hz exponentially
        if (fxParams.lpFilterEnabled) {
            const freq = 20 * Math.pow(1000, fxParams.lpFilterCutoff / 100);
            const resonance = fxParams.lpFilterResonance * 0.8; // Scale to plugin's 0-100 range
            chain.lpFilter.setParams({ cutoff: freq, resonance }, rampTime);
            chain.lpFilter.bypassed = false;
        } else {
            chain.lpFilter.bypassed = true;
        }

        // HP Filter - map 0-100 to 20-20000Hz exponentially
        if (fxParams.hpFilterEnabled) {
            const freq = 20 * Math.pow(1000, fxParams.hpFilterCutoff / 100);
            const resonance = fxParams.hpFilterResonance * 0.8;
            chain.hpFilter.setParams({ cutoff: freq, resonance }, rampTime);
            chain.hpFilter.bypassed = false;
        } else {
            chain.hpFilter.bypassed = true;
        }

        // Saturation
        if (fxParams.saturationEnabled) {
            chain.saturation.setParam('drive', fxParams.saturationDrive, rampTime);
            chain.saturation.bypassed = false;
        } else {
            chain.saturation.bypassed = true;
        }

        // Compression - map UI values to plugin parameters
        if (fxParams.compressionEnabled) {
            const threshold = -(fxParams.compressionThreshold / 100) * 60; // 0 to -60 dB
            const ratio = 1 + (fxParams.compressionRatio / 100) * 19;      // 1:1 to 20:1
            chain.compressor.setParams({ threshold, ratio }, rampTime);
            chain.compressor.bypassed = false;
        } else {
            chain.compressor.bypassed = true;
        }

        // Reverb - map mix value and use plugin's built-in dry/wet handling
        if (fxParams.reverbEnabled) {
            // Scale mix up slightly for more audible effect (matching original behavior)
            const mix = Math.min(100, fxParams.reverbMix * 1.5);
            chain.reverb.setParam('mix', mix, rampTime);
            chain.reverb.bypassed = false;
        } else {
            chain.reverb.bypassed = true;
        }

        // Delay - map time (0-100 to 10-1000ms) and mix values
        if (fxParams.delayEnabled) {
            const time = 10 + (fxParams.delayTime / 100) * 990; // 10-1000ms
            const feedback = fxParams.delayFeedback || 40;
            const mix = fxParams.delayMix || 30;
            chain.delay.setParams({ time, feedback, mix }, rampTime);
            chain.delay.bypassed = false;
        } else {
            chain.delay.bypassed = true;
        }
    }

    triggerSidechain(sourceInstrumentKey, getParamValueFn) {
        const now = this.ctx.currentTime;
        this.chains.forEach((chain, targetKey) => {
            // Don't duck the trigger source itself
            if (targetKey === sourceInstrumentKey) return;

            const isEnabled = getParamValueFn(targetKey, 'sidechainEnabled');
            if (isEnabled) {
                const amount = getParamValueFn(targetKey, 'sidechainAmount') / 100; // 0 to 1
                const release = (getParamValueFn(targetKey, 'sidechainRelease') / 100) * 0.5 + 0.05; // 50ms to 550ms

                const targetGain = 1.0 - amount;

                chain.sidechainGain.gain.cancelScheduledValues(now);
                chain.sidechainGain.gain.setTargetAtTime(targetGain, now, 0.005); // Rapid dip
                chain.sidechainGain.gain.setTargetAtTime(1.0, now + 0.01, release); // Smooth recovery
            }
        });
    }

    async play(instrumentKey, params = {}) {
        if (!this.isLoaded) return;

        const now = this.ctx.currentTime;
        if (this.ctx.state === 'suspended') {
            await this.ctx.resume();
        }

        // Choke Open Hi-Hat if Closed Hi-Hat is triggered (909 behavior)
        if (instrumentKey === 'closedHiHat' && this.openHiHatGainNode) {
            this.openHiHatGainNode.gain.cancelScheduledValues(now);
            this.openHiHatGainNode.gain.setTargetAtTime(0, now, 0.005);
            this.openHiHatGainNode = null;
        }

        const sampleData = this.getSampleData(instrumentKey, params);
        if (!sampleData) return;

        const [name, startMs, durMs] = sampleData;

        const source = this.ctx.createBufferSource();
        source.buffer = this.spriteBuffer;

        const gainNode = this.ctx.createGain();
        const level = (params.level !== undefined) ? (params.level / 100) : 0.8;
        gainNode.gain.setValueAtTime(level, now);

        // Keep track of Open Hi-Hat to allow choking and prevent overlapping tails
        if (instrumentKey === 'openHiHat') {
            if (this.openHiHatGainNode) {
                this.openHiHatGainNode.gain.cancelScheduledValues(now);
                this.openHiHatGainNode.gain.setTargetAtTime(0, now, 0.005);
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

        source.start(now, startMs / 1000, durMs / 1000);
    }
}
