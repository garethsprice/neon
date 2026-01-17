/**
 * VinylEffect - Authentic vinyl surface noise for neon-noise
 *
 * Components:
 * - Hiss: Filtered white noise with RIAA-like rolloff
 * - Crackle: Random pops and clicks
 * - Clunk: End-of-record rhythmic thump
 */

export class VinylEffect {
    constructor(audioContext) {
        this.ctx = audioContext;
        this.isRunning = false;

        // Output gain (master for vinyl effect)
        this.output = this.ctx.createGain();
        this.output.gain.value = 0;

        // Parameters
        this.params = {
            hissLevel: 0.5,
            crackleEnabled: true,
            crackleIntensity: 0.5,
            clunkEnabled: false,
            clunkSpeed: '33' // '33' or '45' RPM
        };

        // Component nodes
        this._hissNodes = null;
        this._crackleInterval = null;
        this._clunkInterval = null;
        this._clunkBuffer = null;

        this._setupHiss();
        this._setupCrackle();
        this._setupClunk();
    }

    /**
     * Hiss: White noise shaped through RIAA-like filter chain
     * WhiteNoise → Highpass (70Hz) → Lowpass (3kHz) → Lowpass (9kHz) → Gain
     */
    _setupHiss() {
        // Create white noise buffer
        const bufferSize = 2 * this.ctx.sampleRate;
        const noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        const output = noiseBuffer.getChannelData(0);

        for (let i = 0; i < bufferSize; i++) {
            output[i] = Math.random() * 2 - 1;
        }

        // Create source
        const source = this.ctx.createBufferSource();
        source.buffer = noiseBuffer;
        source.loop = true;

        // Highpass filter - remove rumble
        const highpass = this.ctx.createBiquadFilter();
        highpass.type = 'highpass';
        highpass.frequency.value = 70;
        highpass.Q.value = 0.7;

        // First lowpass - main rolloff
        const lowpass1 = this.ctx.createBiquadFilter();
        lowpass1.type = 'lowpass';
        lowpass1.frequency.value = 3000;
        lowpass1.Q.value = 0.5;

        // Second lowpass - gentle top rolloff
        const lowpass2 = this.ctx.createBiquadFilter();
        lowpass2.type = 'lowpass';
        lowpass2.frequency.value = 9000;
        lowpass2.Q.value = 0.5;

        // Hiss gain
        const hissGain = this.ctx.createGain();
        hissGain.gain.value = this.params.hissLevel;

        // Connect chain
        source.connect(highpass);
        highpass.connect(lowpass1);
        lowpass1.connect(lowpass2);
        lowpass2.connect(hissGain);
        hissGain.connect(this.output);

        source.start(0);

        this._hissNodes = {
            source,
            highpass,
            lowpass1,
            lowpass2,
            gain: hissGain
        };
    }

    /**
     * Crackle: Random impulse events with varied timing and amplitude
     */
    _setupCrackle() {
        // Crackle gain node
        this._crackleGain = this.ctx.createGain();
        this._crackleGain.gain.value = 0;

        // Filter to match hiss character
        this._crackleFilter = this.ctx.createBiquadFilter();
        this._crackleFilter.type = 'lowpass';
        this._crackleFilter.frequency.value = 4000;
        this._crackleFilter.Q.value = 0.5;

        this._crackleFilter.connect(this._crackleGain);
        this._crackleGain.connect(this.output);
    }

    _triggerCrackle() {
        if (!this.isRunning || !this.params.crackleEnabled) return;

        const now = this.ctx.currentTime;

        // Random duration 5-20ms
        const duration = 0.005 + Math.random() * 0.015;

        // Random amplitude (some quiet, some louder)
        const amplitude = (0.1 + Math.random() * 0.9) * this.params.crackleIntensity;

        // Create short noise burst
        const sampleRate = this.ctx.sampleRate;
        const samples = Math.floor(duration * sampleRate);
        const buffer = this.ctx.createBuffer(1, samples, sampleRate);
        const data = buffer.getChannelData(0);

        // Sharp attack, exponential decay
        for (let i = 0; i < samples; i++) {
            const t = i / samples;
            const envelope = Math.exp(-t * 8); // Quick decay
            data[i] = (Math.random() * 2 - 1) * envelope;
        }

        const source = this.ctx.createBufferSource();
        source.buffer = buffer;

        // Slight filter variation per crackle
        const filterVariation = 2000 + Math.random() * 4000;
        const filter = this.ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.value = filterVariation;

        const gain = this.ctx.createGain();
        gain.gain.value = amplitude * 0.3; // Scale down to sit in mix

        source.connect(filter);
        filter.connect(gain);
        gain.connect(this._crackleGain);

        source.start(now);
        source.stop(now + duration);

        // Schedule next crackle (Poisson-distributed, avg 2-5 per second based on intensity)
        const avgInterval = 0.2 + (1 - this.params.crackleIntensity) * 0.3;
        const nextInterval = -Math.log(Math.random()) * avgInterval;

        this._crackleTimeout = setTimeout(() => this._triggerCrackle(), nextInterval * 1000);
    }

    /**
     * Clunk: End-of-record thump that loops at 33 or 45 RPM
     */
    _setupClunk() {
        // Generate clunk buffer - low thump with pitch envelope
        const duration = 0.08;
        const sampleRate = this.ctx.sampleRate;
        const samples = Math.floor(duration * sampleRate);
        const buffer = this.ctx.createBuffer(1, samples, sampleRate);
        const data = buffer.getChannelData(0);

        // Synthesize a soft "fwump" - sine with pitch drop and decay
        for (let i = 0; i < samples; i++) {
            const t = i / sampleRate;
            const envelope = Math.exp(-t * 30); // Quick decay
            // Pitch drops from ~100Hz to ~40Hz
            const freq = 100 - 60 * (t / duration);
            const phase = 2 * Math.PI * freq * t;
            data[i] = Math.sin(phase) * envelope * 0.8;
            // Add a bit of noise for texture
            data[i] += (Math.random() * 2 - 1) * envelope * 0.1;
        }

        this._clunkBuffer = buffer;

        // Clunk output chain
        this._clunkGain = this.ctx.createGain();
        this._clunkGain.gain.value = 0;

        // Lowpass to soften
        this._clunkFilter = this.ctx.createBiquadFilter();
        this._clunkFilter.type = 'lowpass';
        this._clunkFilter.frequency.value = 200;
        this._clunkFilter.Q.value = 0.7;

        this._clunkFilter.connect(this._clunkGain);
        this._clunkGain.connect(this.output);
    }

    _triggerClunk() {
        if (!this.isRunning || !this.params.clunkEnabled) return;

        const source = this.ctx.createBufferSource();
        source.buffer = this._clunkBuffer;
        source.connect(this._clunkFilter);
        source.start(this.ctx.currentTime);
    }

    _startClunkLoop() {
        if (this._clunkInterval) {
            clearInterval(this._clunkInterval);
        }

        if (!this.params.clunkEnabled) return;

        // 33 RPM = 1.818s per rotation, 45 RPM = 1.333s per rotation
        const interval = this.params.clunkSpeed === '33' ? 1818 : 1333;

        this._triggerClunk();
        this._clunkInterval = setInterval(() => this._triggerClunk(), interval);
    }

    _stopClunkLoop() {
        if (this._clunkInterval) {
            clearInterval(this._clunkInterval);
            this._clunkInterval = null;
        }
    }

    // Public API

    start() {
        this.isRunning = true;

        // Enable crackle if it should be on
        if (this.params.crackleEnabled) {
            this._crackleGain.gain.value = 1;
            this._triggerCrackle();
        }

        // Enable clunk if it should be on
        if (this.params.clunkEnabled) {
            this._clunkGain.gain.value = 0.5;
            this._startClunkLoop();
        }
    }

    stop() {
        this.isRunning = false;

        // Stop crackle
        if (this._crackleTimeout) {
            clearTimeout(this._crackleTimeout);
            this._crackleTimeout = null;
        }

        // Stop clunk
        this._stopClunkLoop();
    }

    connect(destination) {
        this.output.connect(destination);
    }

    disconnect() {
        this.output.disconnect();
    }

    // Parameter setters

    setHissLevel(value) {
        this.params.hissLevel = value;
        if (this._hissNodes) {
            this._hissNodes.gain.gain.setTargetAtTime(value, this.ctx.currentTime, 0.03);
        }
    }

    setCrackleEnabled(enabled) {
        this.params.crackleEnabled = enabled;

        if (this.isRunning) {
            if (enabled) {
                this._crackleGain.gain.setTargetAtTime(1, this.ctx.currentTime, 0.03);
                this._triggerCrackle();
            } else {
                this._crackleGain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.03);
                if (this._crackleTimeout) {
                    clearTimeout(this._crackleTimeout);
                    this._crackleTimeout = null;
                }
            }
        }
    }

    setCrackleIntensity(value) {
        this.params.crackleIntensity = value;
    }

    setClunkEnabled(enabled) {
        this.params.clunkEnabled = enabled;

        if (this.isRunning) {
            if (enabled) {
                this._clunkGain.gain.setTargetAtTime(0.5, this.ctx.currentTime, 0.03);
                this._startClunkLoop();
            } else {
                this._clunkGain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.03);
                this._stopClunkLoop();
            }
        }
    }

    setClunkSpeed(speed) {
        this.params.clunkSpeed = speed;

        // Restart loop with new timing if running
        if (this.isRunning && this.params.clunkEnabled) {
            this._startClunkLoop();
        }
    }

    setOutputLevel(value) {
        this.output.gain.setTargetAtTime(value, this.ctx.currentTime, 0.03);
    }

    // Serialization

    serialize() {
        return {
            hissLevel: this.params.hissLevel,
            crackleEnabled: this.params.crackleEnabled,
            crackleIntensity: this.params.crackleIntensity,
            clunkEnabled: this.params.clunkEnabled,
            clunkSpeed: this.params.clunkSpeed,
            outputLevel: this.output.gain.value
        };
    }

    deserialize(data) {
        if (typeof data.hissLevel === 'number') {
            this.setHissLevel(data.hissLevel);
        }
        if (typeof data.crackleEnabled === 'boolean') {
            this.setCrackleEnabled(data.crackleEnabled);
        }
        if (typeof data.crackleIntensity === 'number') {
            this.setCrackleIntensity(data.crackleIntensity);
        }
        if (typeof data.clunkEnabled === 'boolean') {
            this.setClunkEnabled(data.clunkEnabled);
        }
        if (data.clunkSpeed === '33' || data.clunkSpeed === '45') {
            this.setClunkSpeed(data.clunkSpeed);
        }
        if (typeof data.outputLevel === 'number') {
            this.setOutputLevel(data.outputLevel);
        }
    }
}
