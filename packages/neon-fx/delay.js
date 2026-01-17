/**
 * Neon Audio Plugin - Delay
 *
 * Stereo delay with feedback, filtering, and sync options.
 */

import { AudioPlugin } from './base.js';

export class Delay extends AudioPlugin {
    /**
     * @param {AudioContext} audioContext
     * @param {Object} options
     * @param {number} [options.time=300] - Delay time in ms (10-2000)
     * @param {number} [options.feedback=40] - Feedback amount 0-100%
     * @param {number} [options.mix=30] - Wet/dry mix 0-100%
     * @param {number} [options.damping=0] - High frequency damping 0-100%
     */
    constructor(audioContext, options = {}) {
        super(audioContext, options);

        // Delay node (max 2 seconds)
        this._delay = this.ctx.createDelay(2.0);
        this._delay.delayTime.value = (this._params.time || 300) / 1000;

        // Feedback loop
        this._feedbackGain = this.ctx.createGain();
        this._feedbackGain.gain.value = (this._params.feedback || 40) / 100;

        // Damping filter in feedback loop
        this._dampingFilter = this.ctx.createBiquadFilter();
        this._dampingFilter.type = 'lowpass';
        this._dampingFilter.frequency.value = 20000;

        // Dry/wet mixing
        this._dryGain = this.ctx.createGain();
        this._wetGain = this.ctx.createGain();
        this._outputMixer = this.ctx.createGain();

        // Wire the processing chain
        // Dry path: input -> dryGain -> outputMixer
        // Wet path: input -> delay -> dampingFilter -> feedbackGain -> delay (loop)
        //                          -> wetGain -> outputMixer

        // Feedback loop
        this._delay.connect(this._dampingFilter);
        this._dampingFilter.connect(this._feedbackGain);
        this._feedbackGain.connect(this._delay);

        // Wet output from delay
        this._dampingFilter.connect(this._wetGain);
        this._wetGain.connect(this._outputMixer);

        // Dry path
        this._dryGain.connect(this._outputMixer);

        // Apply initial parameters
        this._applyParam('mix', this._params.mix, 0);
        this._applyParam('damping', this._params.damping, 0);

        // Input routing
        this._input.connect(this._delay);
        this._input.connect(this._dryGain);
        this._input.connect(this._bypassGain);

        // Output routing
        this._bypassGain.connect(this._output);
        this._outputMixer.connect(this._output);
    }

    static get id() {
        return 'delay';
    }

    static get name() {
        return 'Delay';
    }

    static get description() {
        return 'Stereo delay with feedback and damping';
    }

    static get category() {
        return 'time';
    }

    static get parameterDefinitions() {
        return [
            {
                name: 'time',
                label: 'Time',
                min: 10,
                max: 2000,
                default: 300,
                unit: 'ms',
                scale: 'log'
            },
            {
                name: 'feedback',
                label: 'Feedback',
                min: 0,
                max: 100,
                default: 40,
                unit: '%',
                scale: 'linear'
            },
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
                name: 'damping',
                label: 'Damping',
                min: 0,
                max: 100,
                default: 0,
                unit: '%',
                scale: 'linear'
            }
        ];
    }

    _applyParam(name, value, rampTime) {
        switch (name) {
            case 'time':
                const timeSec = value / 1000;
                this._setAudioParam(this._delay.delayTime, timeSec, rampTime);
                break;

            case 'feedback':
                const feedbackGain = value / 100;
                this._setAudioParam(this._feedbackGain.gain, feedbackGain, rampTime);
                break;

            case 'mix':
                const wet = value / 100;
                const dry = 1 - wet * 0.5; // Keep some dry signal
                this._setAudioParam(this._wetGain.gain, wet, rampTime);
                this._setAudioParam(this._dryGain.gain, dry, rampTime);
                break;

            case 'damping':
                // Map damping to filter frequency (100% = 1000Hz, 0% = 20000Hz)
                const freq = 20000 - (value / 100) * 19000;
                this._setAudioParam(this._dampingFilter.frequency, freq, rampTime);
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

    /** Access the delay node */
    get node() {
        return this._delay;
    }
}

/**
 * Ping Pong Delay - stereo delay with alternating left/right
 */
export class PingPongDelay extends Delay {
    constructor(audioContext, options = {}) {
        super(audioContext, {
            time: 250,
            feedback: 50,
            mix: 35,
            damping: 20,
            ...options
        });

        // Create stereo panning for ping-pong effect
        this._panLeft = this.ctx.createStereoPanner();
        this._panRight = this.ctx.createStereoPanner();
        this._panLeft.pan.value = -0.8;
        this._panRight.pan.value = 0.8;

        // Second delay for ping-pong
        this._delay2 = this.ctx.createDelay(2.0);
        this._delay2.delayTime.value = this._delay.delayTime.value;

        // Rewire for ping-pong: left -> right -> left...
        this._dampingFilter.disconnect();
        this._feedbackGain.disconnect();

        // Left delay -> pan left -> right delay
        this._delay.connect(this._panLeft);
        this._panLeft.connect(this._wetGain);
        this._delay.connect(this._delay2);

        // Right delay -> pan right -> feedback to left delay
        this._delay2.connect(this._panRight);
        this._panRight.connect(this._wetGain);
        this._delay2.connect(this._dampingFilter);
        this._dampingFilter.connect(this._feedbackGain);
        this._feedbackGain.connect(this._delay);
    }

    static get id() {
        return 'ping-pong-delay';
    }

    static get name() {
        return 'Ping Pong Delay';
    }

    static get description() {
        return 'Stereo delay with alternating left/right echoes';
    }

    _applyParam(name, value, rampTime) {
        super._applyParam(name, value, rampTime);

        // Sync second delay time
        if (name === 'time' && this._delay2) {
            const timeSec = value / 1000;
            this._setAudioParam(this._delay2.delayTime, timeSec, rampTime);
        }
    }
}

/**
 * Slapback Delay - short delay for rockabilly/vintage sound
 */
export class SlapbackDelay extends Delay {
    constructor(audioContext, options = {}) {
        super(audioContext, {
            time: 80,
            feedback: 10,
            mix: 40,
            damping: 30,
            ...options
        });
    }

    static get id() {
        return 'slapback-delay';
    }

    static get name() {
        return 'Slapback Delay';
    }

    static get description() {
        return 'Short vintage-style delay';
    }
}
