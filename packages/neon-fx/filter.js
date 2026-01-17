/**
 * Neon Audio Plugin - Filter
 *
 * Biquad filter with lowpass, highpass, bandpass, and other modes.
 * Uses Web Audio BiquadFilterNode.
 */

import { AudioPlugin, setupBypassRouting } from './base.js';

export class Filter extends AudioPlugin {
    /**
     * @param {AudioContext} audioContext
     * @param {Object} options
     * @param {string} [options.type='lowpass'] - Filter type
     * @param {number} [options.cutoff=1000] - Cutoff frequency in Hz
     * @param {number} [options.resonance=0] - Resonance (Q) 0-100
     */
    constructor(audioContext, options = {}) {
        super(audioContext, options);

        // Create filter node
        this._filter = this.ctx.createBiquadFilter();
        this._filter.type = options.type || 'lowpass';

        // Apply initial parameters
        this._applyParam('cutoff', this._params.cutoff, 0);
        this._applyParam('resonance', this._params.resonance, 0);

        // Setup bypass routing
        setupBypassRouting(this, this._filter, this._filter);
    }

    static get id() {
        return 'filter';
    }

    static get name() {
        return 'Filter';
    }

    static get description() {
        return 'Biquad filter with multiple modes (lowpass, highpass, bandpass, etc.)';
    }

    static get category() {
        return 'filter';
    }

    static get parameterDefinitions() {
        return [
            {
                name: 'cutoff',
                label: 'Cutoff',
                min: 20,
                max: 20000,
                default: 1000,
                unit: 'Hz',
                scale: 'log'
            },
            {
                name: 'resonance',
                label: 'Resonance',
                min: 0,
                max: 100,
                default: 0,
                unit: '%',
                scale: 'linear'
            }
        ];
    }

    /** Get/set filter type: 'lowpass', 'highpass', 'bandpass', 'lowshelf', 'highshelf', 'peaking', 'notch', 'allpass' */
    get type() {
        return this._filter.type;
    }

    set type(value) {
        this._filter.type = value;
    }

    _applyParam(name, value, rampTime) {
        const now = this.ctx.currentTime;

        switch (name) {
            case 'cutoff':
                if (rampTime > 0) {
                    this._filter.frequency.setTargetAtTime(value, now, rampTime / 3);
                } else {
                    this._filter.frequency.setValueAtTime(value, now);
                }
                break;

            case 'resonance':
                // Map 0-100 to Q value (0-25 is reasonable for most uses)
                const q = (value / 100) * 25;
                if (rampTime > 0) {
                    this._filter.Q.setTargetAtTime(q, now, rampTime / 3);
                } else {
                    this._filter.Q.setValueAtTime(q, now);
                }
                break;
        }
    }

    _bypass(bypassed) {
        // When bypassed, set filter to neutral (full open)
        if (bypassed) {
            this._filter.frequency.setValueAtTime(20000, this.ctx.currentTime);
            this._filter.Q.setValueAtTime(0, this.ctx.currentTime);
        } else {
            // Restore params
            this._applyParam('cutoff', this._params.cutoff, 0.02);
            this._applyParam('resonance', this._params.resonance, 0.02);
        }
    }

    /** Access the underlying BiquadFilterNode */
    get node() {
        return this._filter;
    }
}

/**
 * Lowpass Filter - convenience class
 */
export class LowpassFilter extends Filter {
    constructor(audioContext, options = {}) {
        super(audioContext, { ...options, type: 'lowpass' });
    }

    static get id() {
        return 'lowpass-filter';
    }

    static get name() {
        return 'Lowpass Filter';
    }

    static get description() {
        return 'Removes frequencies above the cutoff point';
    }
}

/**
 * Highpass Filter - convenience class
 */
export class HighpassFilter extends Filter {
    constructor(audioContext, options = {}) {
        super(audioContext, { ...options, type: 'highpass' });
    }

    static get id() {
        return 'highpass-filter';
    }

    static get name() {
        return 'Highpass Filter';
    }

    static get description() {
        return 'Removes frequencies below the cutoff point';
    }
}

/**
 * Bandpass Filter - convenience class
 */
export class BandpassFilter extends Filter {
    constructor(audioContext, options = {}) {
        super(audioContext, { ...options, type: 'bandpass' });
    }

    static get id() {
        return 'bandpass-filter';
    }

    static get name() {
        return 'Bandpass Filter';
    }

    static get description() {
        return 'Allows frequencies near the cutoff point, attenuates others';
    }
}
