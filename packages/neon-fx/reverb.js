/**
 * Neon Audio Plugin - Reverb
 *
 * Algorithmic reverb using a network of delays and filters.
 * Also supports convolution reverb when impulse response is provided.
 */

import { AudioPlugin, setupBypassRouting } from './base.js';

/**
 * Generate a simple noise-based impulse response
 * @param {AudioContext} ctx
 * @param {number} duration - Duration in seconds
 * @param {number} decay - Decay rate
 * @param {boolean} reverse - Reverse the impulse
 * @returns {AudioBuffer}
 */
function generateImpulseResponse(ctx, duration, decay, reverse = false) {
    const sampleRate = ctx.sampleRate;
    const length = sampleRate * duration;
    const buffer = ctx.createBuffer(2, length, sampleRate);

    for (let channel = 0; channel < 2; channel++) {
        const channelData = buffer.getChannelData(channel);
        for (let i = 0; i < length; i++) {
            const n = reverse ? length - i : i;
            channelData[i] = (Math.random() * 2 - 1) * Math.pow(1 - n / length, decay);
        }
    }

    return buffer;
}

export class Reverb extends AudioPlugin {
    /**
     * @param {AudioContext} audioContext
     * @param {Object} options
     * @param {number} [options.mix=30] - Wet/dry mix 0-100%
     * @param {number} [options.decay=2] - Decay time in seconds
     * @param {number} [options.damping=50] - High frequency damping 0-100%
     * @param {number} [options.preDelay=10] - Pre-delay in ms
     * @param {AudioBuffer} [options.impulse] - Custom impulse response
     */
    constructor(audioContext, options = {}) {
        super(audioContext, options);

        // Pre-delay
        this._preDelay = this.ctx.createDelay(0.5);
        this._preDelay.delayTime.value = (options.preDelay || 10) / 1000;

        // Convolver for reverb
        this._convolver = this.ctx.createConvolver();

        // Damping filter (lowpass on reverb output)
        this._dampingFilter = this.ctx.createBiquadFilter();
        this._dampingFilter.type = 'lowpass';
        this._dampingFilter.frequency.value = 20000;

        // Dry/wet mixing
        this._dryGain = this.ctx.createGain();
        this._wetGain = this.ctx.createGain();
        this._outputMixer = this.ctx.createGain();

        // Wire the processing chain
        // Dry path: input -> dryGain -> outputMixer
        // Wet path: input -> preDelay -> convolver -> dampingFilter -> wetGain -> outputMixer

        this._preDelay.connect(this._convolver);
        this._convolver.connect(this._dampingFilter);
        this._dampingFilter.connect(this._wetGain);
        this._wetGain.connect(this._outputMixer);
        this._dryGain.connect(this._outputMixer);

        // Generate initial impulse response
        this._updateImpulse();

        // Apply initial parameters
        this._applyParam('mix', this._params.mix, 0);
        this._applyParam('damping', this._params.damping, 0);
        this._applyParam('preDelay', this._params.preDelay, 0);

        // Custom bypass routing for reverb (dry path is separate)
        this._input.connect(this._preDelay);
        this._input.connect(this._dryGain);
        this._input.connect(this._bypassGain);
        this._outputMixer.connect(this._wetGain);

        // Final output routing
        this._bypassGain.connect(this._output);
        this._outputMixer.connect(this._output);
    }

    static get id() {
        return 'reverb';
    }

    static get name() {
        return 'Reverb';
    }

    static get description() {
        return 'Algorithmic reverb with adjustable decay and damping';
    }

    static get category() {
        return 'time';
    }

    static get parameterDefinitions() {
        return [
            {
                name: 'mix',
                label: 'Mix',
                min: 0,
                max: 100,
                default: 30,
                unit: '%',
                scale: 'linear'
            },
            {
                name: 'decay',
                label: 'Decay',
                min: 0.1,
                max: 10,
                default: 2,
                unit: 's',
                scale: 'log'
            },
            {
                name: 'damping',
                label: 'Damping',
                min: 0,
                max: 100,
                default: 50,
                unit: '%',
                scale: 'linear'
            },
            {
                name: 'preDelay',
                label: 'Pre-Delay',
                min: 0,
                max: 200,
                default: 10,
                unit: 'ms',
                scale: 'linear'
            }
        ];
    }

    _updateImpulse() {
        const decay = this._params.decay;
        // Generate impulse response based on decay time
        const impulse = generateImpulseResponse(this.ctx, decay, 2);
        this._convolver.buffer = impulse;
    }

    _applyParam(name, value, rampTime) {
        switch (name) {
            case 'mix':
                const wet = value / 100;
                const dry = 1 - wet * 0.5; // Keep some dry signal
                this._setAudioParam(this._wetGain.gain, wet, rampTime);
                this._setAudioParam(this._dryGain.gain, dry, rampTime);
                break;

            case 'decay':
                this._updateImpulse();
                break;

            case 'damping':
                // Map damping to filter frequency (100% = 1000Hz, 0% = 20000Hz)
                const freq = 20000 - (value / 100) * 19000;
                this._setAudioParam(this._dampingFilter.frequency, freq, rampTime);
                break;

            case 'preDelay':
                const delaySec = value / 1000;
                this._setAudioParam(this._preDelay.delayTime, delaySec, rampTime);
                break;
        }
    }

    _bypass(bypassed) {
        const now = this.ctx.currentTime;
        const rampTime = 0.02;

        if (bypassed) {
            this._wetGain.gain.setTargetAtTime(0, now, rampTime);
            this._dryGain.gain.setTargetAtTime(0, now, rampTime);
            this._bypassGain.gain.setTargetAtTime(1, now, rampTime);
        } else {
            this._bypassGain.gain.setTargetAtTime(0, now, rampTime);
            this._applyParam('mix', this._params.mix, rampTime * 3);
        }
    }

    /**
     * Load a custom impulse response
     * @param {AudioBuffer} buffer - Impulse response buffer
     */
    setImpulse(buffer) {
        this._convolver.buffer = buffer;
    }

    /**
     * Load impulse response from URL
     * @param {string} url - URL to impulse response audio file
     * @returns {Promise<void>}
     */
    async loadImpulse(url) {
        const response = await fetch(url);
        const arrayBuffer = await response.arrayBuffer();
        const audioBuffer = await this.ctx.decodeAudioData(arrayBuffer);
        this.setImpulse(audioBuffer);
    }

    /** Access the convolver node */
    get node() {
        return this._convolver;
    }
}

/**
 * Plate Reverb - preset with dense, metallic character
 */
export class PlateReverb extends Reverb {
    constructor(audioContext, options = {}) {
        super(audioContext, {
            mix: 35,
            decay: 1.5,
            damping: 30,
            preDelay: 5,
            ...options
        });
    }

    static get id() {
        return 'plate-reverb';
    }

    static get name() {
        return 'Plate Reverb';
    }

    static get description() {
        return 'Dense, metallic plate-style reverb';
    }
}

/**
 * Hall Reverb - preset with spacious, natural character
 */
export class HallReverb extends Reverb {
    constructor(audioContext, options = {}) {
        super(audioContext, {
            mix: 25,
            decay: 3,
            damping: 60,
            preDelay: 20,
            ...options
        });
    }

    static get id() {
        return 'hall-reverb';
    }

    static get name() {
        return 'Hall Reverb';
    }

    static get description() {
        return 'Spacious concert hall reverb';
    }
}

/**
 * Room Reverb - preset with small, tight character
 */
export class RoomReverb extends Reverb {
    constructor(audioContext, options = {}) {
        super(audioContext, {
            mix: 20,
            decay: 0.5,
            damping: 70,
            preDelay: 2,
            ...options
        });
    }

    static get id() {
        return 'room-reverb';
    }

    static get name() {
        return 'Room Reverb';
    }

    static get description() {
        return 'Small room ambience';
    }
}

// Export impulse generator for custom use
export { generateImpulseResponse };
