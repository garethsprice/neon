/**
 * Neon Audio Plugin - Saturation
 *
 * Soft-clipping waveshaper for warmth and harmonic distortion.
 * Uses Web Audio WaveShaperNode with custom transfer curves.
 */

import { AudioPlugin, setupBypassRouting } from './base.js';

/**
 * Generate a soft-clipping saturation curve
 * @param {number} amount - Saturation amount (0-1)
 * @param {number} [samples=44100] - Number of samples in curve
 * @returns {Float32Array}
 */
function createSaturationCurve(amount, samples = 44100) {
    const curve = new Float32Array(samples);
    const k = amount * 20;

    for (let i = 0; i < samples; i++) {
        const x = (i * 2) / (samples - 1) - 1;
        curve[i] = k === 0 ? x : ((1 + k) * x) / (1 + k * Math.abs(x));
    }

    return curve;
}

/**
 * Generate a tube-style saturation curve
 * @param {number} amount - Saturation amount (0-1)
 * @param {number} [samples=44100]
 * @returns {Float32Array}
 */
function createTubeCurve(amount, samples = 44100) {
    const curve = new Float32Array(samples);
    const k = amount * 10;

    for (let i = 0; i < samples; i++) {
        const x = (i * 2) / (samples - 1) - 1;
        // Asymmetric soft clipping for tube-like harmonics
        if (x >= 0) {
            curve[i] = Math.tanh(x * (1 + k));
        } else {
            curve[i] = Math.tanh(x * (1 + k * 0.5));
        }
    }

    return curve;
}

/**
 * Generate a tape-style saturation curve
 * @param {number} amount - Saturation amount (0-1)
 * @param {number} [samples=44100]
 * @returns {Float32Array}
 */
function createTapeCurve(amount, samples = 44100) {
    const curve = new Float32Array(samples);

    for (let i = 0; i < samples; i++) {
        const x = (i * 2) / (samples - 1) - 1;
        // Softer saturation with slight compression
        const drive = 1 + amount * 3;
        curve[i] = Math.tanh(x * drive) / Math.tanh(drive);
    }

    return curve;
}

/**
 * Generate a hard-clipping distortion curve
 * @param {number} threshold - Clipping threshold (0-1)
 * @param {number} [samples=44100]
 * @returns {Float32Array}
 */
function createHardClipCurve(threshold, samples = 44100) {
    const curve = new Float32Array(samples);
    const t = Math.max(0.01, 1 - threshold);

    for (let i = 0; i < samples; i++) {
        const x = (i * 2) / (samples - 1) - 1;
        curve[i] = Math.max(-t, Math.min(t, x));
    }

    return curve;
}

export class Saturation extends AudioPlugin {
    /**
     * @param {AudioContext} audioContext
     * @param {Object} options
     * @param {number} [options.drive=0] - Drive amount 0-100
     * @param {string} [options.mode='soft'] - Saturation mode: 'soft', 'tube', 'tape', 'hard'
     */
    constructor(audioContext, options = {}) {
        super(audioContext, options);

        this._mode = options.mode || 'soft';

        // Create waveshaper
        this._shaper = this.ctx.createWaveShaper();
        this._shaper.oversample = '4x'; // Reduce aliasing

        // Input gain for driving the saturation
        this._driveGain = this.ctx.createGain();
        this._driveGain.gain.value = 1;

        // Output gain for level compensation
        this._outputGain = this.ctx.createGain();
        this._outputGain.gain.value = 1;

        // Wire processing chain
        this._driveGain.connect(this._shaper);
        this._shaper.connect(this._outputGain);

        // Apply initial parameters
        this._updateCurve();

        // Setup bypass routing
        setupBypassRouting(this, this._driveGain, this._outputGain);
    }

    static get id() {
        return 'saturation';
    }

    static get name() {
        return 'Saturation';
    }

    static get description() {
        return 'Adds warmth and harmonic distortion through soft clipping';
    }

    static get category() {
        return 'distortion';
    }

    static get parameterDefinitions() {
        return [
            {
                name: 'drive',
                label: 'Drive',
                min: 0,
                max: 100,
                default: 0,
                unit: '%',
                scale: 'linear'
            },
            {
                name: 'mix',
                label: 'Mix',
                min: 0,
                max: 100,
                default: 100,
                unit: '%',
                scale: 'linear'
            }
        ];
    }

    /** Get/set saturation mode */
    get mode() {
        return this._mode;
    }

    set mode(value) {
        if (['soft', 'tube', 'tape', 'hard'].includes(value)) {
            this._mode = value;
            this._updateCurve();
        }
    }

    _updateCurve() {
        const amount = this._params.drive / 100;

        switch (this._mode) {
            case 'tube':
                this._shaper.curve = createTubeCurve(amount);
                break;
            case 'tape':
                this._shaper.curve = createTapeCurve(amount);
                break;
            case 'hard':
                this._shaper.curve = createHardClipCurve(amount);
                break;
            case 'soft':
            default:
                this._shaper.curve = createSaturationCurve(amount);
                break;
        }

        // Compensate output level (saturation adds perceived loudness)
        const compensation = 1 / (1 + amount * 0.5);
        this._outputGain.gain.setValueAtTime(compensation, this.ctx.currentTime);
    }

    _applyParam(name, value, rampTime) {
        switch (name) {
            case 'drive':
                this._updateCurve();
                break;

            case 'mix':
                // Mix controls wet/dry blend
                const wet = value / 100;
                this._setAudioParam(this._wetGain.gain, wet, rampTime);
                this._setAudioParam(this._bypassGain.gain, 1 - wet, rampTime);
                break;
        }
    }

    _bypass(bypassed) {
        if (bypassed) {
            this._shaper.curve = createSaturationCurve(0);
        } else {
            this._updateCurve();
        }
    }

    /** Access the underlying WaveShaperNode */
    get node() {
        return this._shaper;
    }
}

// Export curve generators for custom use
export { createSaturationCurve, createTubeCurve, createTapeCurve, createHardClipCurve };
