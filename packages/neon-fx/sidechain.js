/**
 * Neon Audio Plugin - Sidechain
 *
 * Sidechain ducking effect for the classic "pumping" sound.
 * Uses envelope following to duck the main signal based on sidechain input.
 */

import { AudioPlugin, setupBypassRouting } from './base.js';

export class Sidechain extends AudioPlugin {
    /**
     * @param {AudioContext} audioContext
     * @param {Object} options
     * @param {number} [options.amount=50] - Duck amount 0-100%
     * @param {number} [options.attack=5] - Attack time in ms
     * @param {number} [options.release=100] - Release time in ms
     * @param {number} [options.threshold=-20] - Threshold in dB
     */
    constructor(audioContext, options = {}) {
        super(audioContext, options);

        // Main signal gain (this gets ducked)
        this._duckGain = this.ctx.createGain();
        this._duckGain.gain.value = 1;

        // Sidechain input and analysis chain
        this._sidechainInput = this.ctx.createGain();
        this._analyser = this.ctx.createAnalyser();
        this._analyser.fftSize = 256;
        this._analyser.smoothingTimeConstant = 0.3;

        // Connect sidechain to analyser
        this._sidechainInput.connect(this._analyser);

        // Setup bypass routing for main signal
        setupBypassRouting(this, this._duckGain, this._duckGain);

        // Envelope state
        this._envelope = 1;
        this._targetEnvelope = 1;
        this._isRunning = false;
        this._analysisBuffer = new Float32Array(this._analyser.fftSize);

        // Start envelope follower
        this._startEnvelopeFollower();
    }

    static get id() {
        return 'sidechain';
    }

    static get name() {
        return 'Sidechain';
    }

    static get description() {
        return 'Sidechain ducking for pumping effects';
    }

    static get category() {
        return 'dynamics';
    }

    static get parameterDefinitions() {
        return [
            {
                name: 'amount',
                label: 'Amount',
                min: 0,
                max: 100,
                default: 50,
                unit: '%',
                scale: 'linear'
            },
            {
                name: 'attack',
                label: 'Attack',
                min: 1,
                max: 100,
                default: 5,
                unit: 'ms',
                scale: 'log'
            },
            {
                name: 'release',
                label: 'Release',
                min: 10,
                max: 1000,
                default: 100,
                unit: 'ms',
                scale: 'log'
            },
            {
                name: 'threshold',
                label: 'Threshold',
                min: -60,
                max: 0,
                default: -20,
                unit: 'dB',
                scale: 'linear'
            }
        ];
    }

    /** Sidechain input node - connect trigger source here */
    get sidechainInput() {
        return this._sidechainInput;
    }

    _startEnvelopeFollower() {
        if (this._isRunning) return;
        this._isRunning = true;

        const process = () => {
            if (!this._isRunning) return;

            // Get time domain data
            this._analyser.getFloatTimeDomainData(this._analysisBuffer);

            // Calculate RMS level
            let sum = 0;
            for (let i = 0; i < this._analysisBuffer.length; i++) {
                sum += this._analysisBuffer[i] * this._analysisBuffer[i];
            }
            const rms = Math.sqrt(sum / this._analysisBuffer.length);

            // Convert to dB
            const db = 20 * Math.log10(rms + 0.0001);

            // Compare to threshold
            const threshold = this._params.threshold;
            const amount = this._params.amount / 100;

            if (db > threshold) {
                // Signal above threshold - duck
                const overThreshold = db - threshold;
                const duckFactor = Math.max(0, 1 - (overThreshold / 40) * amount);
                this._targetEnvelope = duckFactor;
            } else {
                // Signal below threshold - release
                this._targetEnvelope = 1;
            }

            // Smooth envelope with attack/release
            const attackCoef = Math.exp(-1 / (this._params.attack * this.ctx.sampleRate / 1000));
            const releaseCoef = Math.exp(-1 / (this._params.release * this.ctx.sampleRate / 1000));

            if (this._targetEnvelope < this._envelope) {
                // Attack (ducking)
                this._envelope = attackCoef * this._envelope + (1 - attackCoef) * this._targetEnvelope;
            } else {
                // Release
                this._envelope = releaseCoef * this._envelope + (1 - releaseCoef) * this._targetEnvelope;
            }

            // Apply to gain
            const now = this.ctx.currentTime;
            this._duckGain.gain.setValueAtTime(this._envelope, now);

            requestAnimationFrame(process);
        };

        requestAnimationFrame(process);
    }

    _stopEnvelopeFollower() {
        this._isRunning = false;
    }

    _applyParam(name, value, rampTime) {
        // Parameters are read directly in the envelope follower loop
    }

    _bypass(bypassed) {
        if (bypassed) {
            this._duckGain.gain.setValueAtTime(1, this.ctx.currentTime);
        }
    }

    /** Get current duck level (0-1) for metering */
    get duckLevel() {
        return this._envelope;
    }

    destroy() {
        this._stopEnvelopeFollower();
        super.destroy();
    }

    /** Access the main gain node */
    get node() {
        return this._duckGain;
    }
}

/**
 * Rhythmic sidechain with built-in trigger generator
 * Creates pumping effect synced to a tempo without external input
 */
export class RhythmicSidechain extends AudioPlugin {
    /**
     * @param {AudioContext} audioContext
     * @param {Object} options
     * @param {number} [options.amount=50] - Duck amount 0-100%
     * @param {number} [options.rate=4] - Pumps per beat (1, 2, 4, 8)
     * @param {number} [options.attack=5] - Attack time in ms
     * @param {number} [options.release=100] - Release time in ms
     * @param {number} [options.bpm=120] - Tempo in BPM
     */
    constructor(audioContext, options = {}) {
        super(audioContext, options);

        // Main signal gain
        this._duckGain = this.ctx.createGain();
        this._duckGain.gain.value = 1;

        // Setup bypass routing
        setupBypassRouting(this, this._duckGain, this._duckGain);

        // Rhythmic state
        this._isRunning = false;
        this._nextTriggerTime = 0;
    }

    static get id() {
        return 'rhythmic-sidechain';
    }

    static get name() {
        return 'Rhythmic Sidechain';
    }

    static get description() {
        return 'Tempo-synced pumping effect';
    }

    static get category() {
        return 'dynamics';
    }

    static get parameterDefinitions() {
        return [
            {
                name: 'amount',
                label: 'Amount',
                min: 0,
                max: 100,
                default: 50,
                unit: '%',
                scale: 'linear'
            },
            {
                name: 'rate',
                label: 'Rate',
                min: 1,
                max: 8,
                default: 4,
                unit: 'x',
                scale: 'linear'
            },
            {
                name: 'attack',
                label: 'Attack',
                min: 1,
                max: 100,
                default: 5,
                unit: 'ms',
                scale: 'log'
            },
            {
                name: 'release',
                label: 'Release',
                min: 10,
                max: 500,
                default: 100,
                unit: 'ms',
                scale: 'log'
            },
            {
                name: 'bpm',
                label: 'BPM',
                min: 40,
                max: 240,
                default: 120,
                unit: '',
                scale: 'linear'
            }
        ];
    }

    /** Start the rhythmic pumping */
    start(startTime = this.ctx.currentTime) {
        this._isRunning = true;
        this._nextTriggerTime = startTime;
        this._schedulePumps();
    }

    /** Stop the rhythmic pumping */
    stop() {
        this._isRunning = false;
        this._duckGain.gain.cancelScheduledValues(this.ctx.currentTime);
        this._duckGain.gain.setValueAtTime(1, this.ctx.currentTime);
    }

    _schedulePumps() {
        if (!this._isRunning) return;

        const now = this.ctx.currentTime;
        const scheduleAhead = 0.2; // Schedule 200ms ahead

        while (this._nextTriggerTime < now + scheduleAhead) {
            this._schedulePump(this._nextTriggerTime);

            // Calculate next trigger time based on BPM and rate
            const beatDuration = 60 / this._params.bpm;
            const triggerInterval = beatDuration / this._params.rate;
            this._nextTriggerTime += triggerInterval;
        }

        setTimeout(() => this._schedulePumps(), 100);
    }

    _schedulePump(time) {
        const amount = this._params.amount / 100;
        const duckLevel = 1 - amount;
        const attackTime = this._params.attack / 1000;
        const releaseTime = this._params.release / 1000;

        // Duck down
        this._duckGain.gain.setValueAtTime(1, time);
        this._duckGain.gain.linearRampToValueAtTime(duckLevel, time + attackTime);

        // Release back up
        this._duckGain.gain.setTargetAtTime(1, time + attackTime, releaseTime / 3);
    }

    _applyParam(name, value, rampTime) {
        // Parameters are read when scheduling pumps
    }

    _bypass(bypassed) {
        if (bypassed) {
            this.stop();
        }
    }

    destroy() {
        this.stop();
        super.destroy();
    }

    /** Access the gain node */
    get node() {
        return this._duckGain;
    }
}
