/**
 * Neon Audio Plugin - Compressor
 *
 * Dynamics compressor for controlling dynamic range.
 * Uses Web Audio DynamicsCompressorNode.
 */

import { AudioPlugin, setupBypassRouting } from './base.js';

export class Compressor extends AudioPlugin {
    /**
     * @param {AudioContext} audioContext
     * @param {Object} options
     * @param {number} [options.threshold=-24] - Threshold in dB (-100 to 0)
     * @param {number} [options.ratio=12] - Compression ratio (1 to 20)
     * @param {number} [options.attack=3] - Attack time in ms (0 to 1000)
     * @param {number} [options.release=250] - Release time in ms (0 to 1000)
     * @param {number} [options.knee=30] - Knee width in dB (0 to 40)
     * @param {number} [options.makeupGain=0] - Makeup gain in dB (-12 to 12)
     */
    constructor(audioContext, options = {}) {
        super(audioContext, options);

        // Create compressor node
        this._compressor = this.ctx.createDynamicsCompressor();

        // Create makeup gain
        this._makeupGain = this.ctx.createGain();
        this._makeupGain.gain.value = 1;

        // Wire processing chain
        this._compressor.connect(this._makeupGain);

        // Apply initial parameters
        this._applyParam('threshold', this._params.threshold, 0);
        this._applyParam('ratio', this._params.ratio, 0);
        this._applyParam('attack', this._params.attack, 0);
        this._applyParam('release', this._params.release, 0);
        this._applyParam('knee', this._params.knee, 0);
        this._applyParam('makeupGain', this._params.makeupGain, 0);

        // Setup bypass routing
        setupBypassRouting(this, this._compressor, this._makeupGain);
    }

    static get id() {
        return 'compressor';
    }

    static get name() {
        return 'Compressor';
    }

    static get description() {
        return 'Dynamics compressor for controlling dynamic range';
    }

    static get category() {
        return 'dynamics';
    }

    static get parameterDefinitions() {
        return [
            {
                name: 'threshold',
                label: 'Threshold',
                min: -100,
                max: 0,
                default: -24,
                unit: 'dB',
                scale: 'linear'
            },
            {
                name: 'ratio',
                label: 'Ratio',
                min: 1,
                max: 20,
                default: 12,
                unit: ':1',
                scale: 'linear'
            },
            {
                name: 'attack',
                label: 'Attack',
                min: 0,
                max: 1000,
                default: 3,
                unit: 'ms',
                scale: 'log'
            },
            {
                name: 'release',
                label: 'Release',
                min: 0,
                max: 1000,
                default: 250,
                unit: 'ms',
                scale: 'log'
            },
            {
                name: 'knee',
                label: 'Knee',
                min: 0,
                max: 40,
                default: 30,
                unit: 'dB',
                scale: 'linear'
            },
            {
                name: 'makeupGain',
                label: 'Makeup',
                min: -12,
                max: 12,
                default: 0,
                unit: 'dB',
                scale: 'linear'
            }
        ];
    }

    _applyParam(name, value, rampTime) {
        const now = this.ctx.currentTime;

        switch (name) {
            case 'threshold':
                if (rampTime > 0) {
                    this._compressor.threshold.setTargetAtTime(value, now, rampTime / 3);
                } else {
                    this._compressor.threshold.setValueAtTime(value, now);
                }
                break;

            case 'ratio':
                if (rampTime > 0) {
                    this._compressor.ratio.setTargetAtTime(value, now, rampTime / 3);
                } else {
                    this._compressor.ratio.setValueAtTime(value, now);
                }
                break;

            case 'attack':
                // Convert ms to seconds
                const attackSec = value / 1000;
                if (rampTime > 0) {
                    this._compressor.attack.setTargetAtTime(attackSec, now, rampTime / 3);
                } else {
                    this._compressor.attack.setValueAtTime(attackSec, now);
                }
                break;

            case 'release':
                // Convert ms to seconds
                const releaseSec = value / 1000;
                if (rampTime > 0) {
                    this._compressor.release.setTargetAtTime(releaseSec, now, rampTime / 3);
                } else {
                    this._compressor.release.setValueAtTime(releaseSec, now);
                }
                break;

            case 'knee':
                if (rampTime > 0) {
                    this._compressor.knee.setTargetAtTime(value, now, rampTime / 3);
                } else {
                    this._compressor.knee.setValueAtTime(value, now);
                }
                break;

            case 'makeupGain':
                // Convert dB to linear gain
                const gain = Math.pow(10, value / 20);
                this._setAudioParam(this._makeupGain.gain, gain, rampTime);
                break;
        }
    }

    _bypass(bypassed) {
        // Compressor bypasses cleanly via the base class routing
    }

    /** Get current gain reduction in dB (for metering) */
    get reduction() {
        return this._compressor.reduction;
    }

    /** Access the underlying DynamicsCompressorNode */
    get node() {
        return this._compressor;
    }
}

/**
 * Limiter - Compressor preset for limiting
 */
export class Limiter extends Compressor {
    constructor(audioContext, options = {}) {
        super(audioContext, {
            threshold: -6,
            ratio: 20,
            attack: 0.3,
            release: 100,
            knee: 0,
            makeupGain: 0,
            ...options
        });
    }

    static get id() {
        return 'limiter';
    }

    static get name() {
        return 'Limiter';
    }

    static get description() {
        return 'Hard limiter to prevent clipping';
    }

    static get parameterDefinitions() {
        return [
            {
                name: 'threshold',
                label: 'Ceiling',
                min: -24,
                max: 0,
                default: -6,
                unit: 'dB',
                scale: 'linear'
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
                name: 'makeupGain',
                label: 'Gain',
                min: 0,
                max: 12,
                default: 0,
                unit: 'dB',
                scale: 'linear'
            }
        ];
    }
}
