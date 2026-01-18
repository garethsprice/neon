/**
 * Neon App - Audio Engine
 *
 * Template for Web Audio API integration following neon app patterns.
 * Customize this for your specific audio needs.
 */

export class AudioEngine {
    constructor(options = {}) {
        this.ctx = null;
        this.masterGain = null;
        this.masterVolume = options.masterVolume ?? 0.8;
        this.onError = options.onError || console.error;

        // App state (customize for your needs)
        this.name = '';
        this.description = '';
        this.thumbnailUrl = null;

        // Parameters (customize for your needs)
        this.params = {
            bpm: 120,
            // Add your app-specific parameters here
        };
    }

    /**
     * Initialize the audio context
     * Call this on first user interaction (click/touch)
     */
    async init() {
        if (this.ctx) return;

        try {
            this.ctx = new (window.AudioContext || window.webkitAudioContext)();

            // Create master gain
            this.masterGain = this.ctx.createGain();
            this.masterGain.gain.value = this.masterVolume;
            this.masterGain.connect(this.ctx.destination);

            // Resume if suspended (browser autoplay policy)
            if (this.ctx.state === 'suspended') {
                await this.ctx.resume();
            }

            console.log('Audio engine initialized');
        } catch (e) {
            this.onError('Failed to initialize audio');
            console.error('Audio init error:', e);
        }
    }

    /**
     * Ensure audio context is running
     */
    async ensureRunning() {
        if (!this.ctx) {
            await this.init();
        } else if (this.ctx.state === 'suspended') {
            await this.ctx.resume();
        }
    }

    /**
     * Set master volume (0-100)
     */
    setMasterVolume(value) {
        this.masterVolume = value / 100;
        if (this.masterGain) {
            this.masterGain.gain.setTargetAtTime(this.masterVolume, this.ctx.currentTime, 0.05);
        }
    }

    /**
     * Update a parameter
     */
    setParam(key, value) {
        this.params[key] = value;
        // Add parameter-specific handling here
    }

    /**
     * Serialize state for cloud save
     */
    serialize() {
        return {
            name: this.name,
            description: this.description,
            thumbnailUrl: this.thumbnailUrl,
            masterVolume: Math.round(this.masterVolume * 100),
            params: { ...this.params },
            // Add your app-specific state here
        };
    }

    /**
     * Deserialize state from cloud load
     */
    deserialize(data) {
        if (data.name !== undefined) this.name = data.name;
        if (data.description !== undefined) this.description = data.description;
        if (data.thumbnailUrl !== undefined) this.thumbnailUrl = data.thumbnailUrl;
        if (data.masterVolume !== undefined) {
            this.setMasterVolume(data.masterVolume);
        }
        if (data.params) {
            this.params = { ...this.params, ...data.params };
        }
        // Add your app-specific deserialization here
    }

    /**
     * Clean up resources
     */
    dispose() {
        if (this.ctx) {
            this.ctx.close();
            this.ctx = null;
        }
    }
}

/**
 * Factory function for creating audio engine
 */
export function createAudioEngine(options = {}) {
    return new AudioEngine(options);
}
