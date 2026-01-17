/**
 * Neon Audio Plugin System - Base Class
 *
 * Standard interface for chainable Web Audio API plugins.
 *
 * ## Plugin Specification
 *
 * Each plugin must:
 * 1. Extend AudioPlugin base class
 * 2. Implement static metadata (id, name, parameterDefinitions)
 * 3. Create audio nodes in constructor and wire them between _input and _output
 * 4. Implement _applyParam(name, value, rampTime) to handle parameter changes
 * 5. Implement _bypass(bypassed) to handle bypass state
 *
 * ## Usage
 *
 * ```javascript
 * const filter = new LowpassFilter(audioContext, { cutoff: 1000 });
 * const compressor = new Compressor(audioContext);
 *
 * // Chain plugins
 * sourceNode.connect(filter.input);
 * filter.connect(compressor);
 * compressor.connect(audioContext.destination);
 *
 * // Adjust parameters
 * filter.setParam('cutoff', 2000, 0.1); // ramp over 100ms
 *
 * // Bypass
 * filter.bypassed = true;
 * ```
 *
 * ## Parameter Definition Format
 *
 * ```javascript
 * static get parameterDefinitions() {
 *   return [
 *     {
 *       name: 'cutoff',        // Internal parameter name
 *       label: 'Cutoff',       // Display label
 *       min: 20,               // Minimum value
 *       max: 20000,            // Maximum value
 *       default: 1000,         // Default value
 *       unit: 'Hz',            // Unit for display
 *       scale: 'log',          // 'linear' or 'log' for UI controls
 *     }
 *   ];
 * }
 * ```
 */

export class AudioPlugin {
    /**
     * @param {AudioContext} audioContext - Web Audio API context
     * @param {Object} options - Initial parameter values
     */
    constructor(audioContext, options = {}) {
        if (!audioContext) {
            throw new Error('AudioPlugin requires an AudioContext');
        }

        this.ctx = audioContext;
        this._bypassed = false;
        this._params = {};

        // Create input/output gain nodes for routing
        this._input = this.ctx.createGain();
        this._output = this.ctx.createGain();

        // Bypass routing nodes
        this._bypassGain = this.ctx.createGain();
        this._wetGain = this.ctx.createGain();
        this._bypassGain.gain.value = 0;
        this._wetGain.gain.value = 1;

        // Initialize parameters from definitions with defaults
        const defs = this.constructor.parameterDefinitions || [];
        defs.forEach(def => {
            this._params[def.name] = options[def.name] ?? def.default ?? 0;
        });
    }

    // ─────────────────────────────────────────────────────────────────
    // Static Metadata (override in subclasses)
    // ─────────────────────────────────────────────────────────────────

    /** Unique plugin identifier */
    static get id() {
        return 'base';
    }

    /** Human-readable plugin name */
    static get name() {
        return 'Audio Plugin';
    }

    /** Plugin description */
    static get description() {
        return 'Base audio plugin class';
    }

    /** Plugin category: 'filter', 'dynamics', 'modulation', 'time', 'distortion' */
    static get category() {
        return 'utility';
    }

    /**
     * Parameter definitions array
     * @returns {Array<{name: string, label: string, min: number, max: number, default: number, unit?: string, scale?: string}>}
     */
    static get parameterDefinitions() {
        return [];
    }

    // ─────────────────────────────────────────────────────────────────
    // Audio Graph Connection
    // ─────────────────────────────────────────────────────────────────

    /** Input node - connect sources here */
    get input() {
        return this._input;
    }

    /** Output node - connect this to destination */
    get output() {
        return this._output;
    }

    /**
     * Connect output to another node or plugin
     * @param {AudioNode|AudioPlugin} destination
     * @param {number} [outputIndex]
     * @param {number} [inputIndex]
     * @returns {AudioNode|AudioPlugin} The destination for chaining
     */
    connect(destination, outputIndex, inputIndex) {
        if (destination instanceof AudioPlugin) {
            this._output.connect(destination.input, outputIndex, inputIndex);
        } else {
            this._output.connect(destination, outputIndex, inputIndex);
        }
        return destination;
    }

    /**
     * Disconnect output
     * @param {AudioNode|AudioPlugin} [destination]
     */
    disconnect(destination) {
        if (destination) {
            if (destination instanceof AudioPlugin) {
                this._output.disconnect(destination.input);
            } else {
                this._output.disconnect(destination);
            }
        } else {
            this._output.disconnect();
        }
    }

    // ─────────────────────────────────────────────────────────────────
    // Parameters
    // ─────────────────────────────────────────────────────────────────

    /** Get all current parameter values */
    get params() {
        return { ...this._params };
    }

    /**
     * Get a parameter value
     * @param {string} name - Parameter name
     * @returns {number}
     */
    getParam(name) {
        return this._params[name];
    }

    /**
     * Set a parameter value
     * @param {string} name - Parameter name
     * @param {number} value - New value
     * @param {number} [rampTime=0] - Time in seconds to ramp to new value
     */
    setParam(name, value, rampTime = 0) {
        const def = this.constructor.parameterDefinitions.find(d => d.name === name);
        if (def) {
            // Clamp to min/max
            value = Math.max(def.min ?? -Infinity, Math.min(def.max ?? Infinity, value));
        }
        this._params[name] = value;
        this._applyParam(name, value, rampTime);
    }

    /**
     * Set multiple parameters at once
     * @param {Object} params - Object of name: value pairs
     * @param {number} [rampTime=0] - Time in seconds to ramp
     */
    setParams(params, rampTime = 0) {
        Object.entries(params).forEach(([name, value]) => {
            this.setParam(name, value, rampTime);
        });
    }

    /**
     * Apply parameter change to audio nodes (override in subclass)
     * @param {string} name - Parameter name
     * @param {number} value - New value
     * @param {number} rampTime - Ramp time in seconds
     * @protected
     */
    _applyParam(name, value, rampTime) {
        // Override in subclass
    }

    /**
     * Helper to set AudioParam with optional ramping
     * @param {AudioParam} audioParam
     * @param {number} value
     * @param {number} rampTime
     * @protected
     */
    _setAudioParam(audioParam, value, rampTime) {
        const now = this.ctx.currentTime;
        if (rampTime > 0) {
            audioParam.setTargetAtTime(value, now, rampTime / 3);
        } else {
            audioParam.setValueAtTime(value, now);
        }
    }

    // ─────────────────────────────────────────────────────────────────
    // Bypass
    // ─────────────────────────────────────────────────────────────────

    /** Whether the plugin is bypassed */
    get bypassed() {
        return this._bypassed;
    }

    set bypassed(value) {
        this._bypassed = !!value;
        const now = this.ctx.currentTime;
        const rampTime = 0.02;

        if (this._bypassed) {
            this._wetGain.gain.setTargetAtTime(0, now, rampTime);
            this._bypassGain.gain.setTargetAtTime(1, now, rampTime);
        } else {
            this._wetGain.gain.setTargetAtTime(1, now, rampTime);
            this._bypassGain.gain.setTargetAtTime(0, now, rampTime);
        }

        this._bypass(this._bypassed);
    }

    /**
     * Handle bypass state change (override in subclass if needed)
     * @param {boolean} bypassed
     * @protected
     */
    _bypass(bypassed) {
        // Override in subclass if additional handling needed
    }

    // ─────────────────────────────────────────────────────────────────
    // Lifecycle
    // ─────────────────────────────────────────────────────────────────

    /**
     * Clean up resources
     */
    destroy() {
        this.disconnect();
        this._input.disconnect();
    }

    // ─────────────────────────────────────────────────────────────────
    // Serialization
    // ─────────────────────────────────────────────────────────────────

    /**
     * Serialize plugin state
     * @returns {Object}
     */
    serialize() {
        return {
            id: this.constructor.id,
            bypassed: this._bypassed,
            params: { ...this._params }
        };
    }

    /**
     * Restore plugin state
     * @param {Object} state
     */
    deserialize(state) {
        if (state.params) {
            this.setParams(state.params);
        }
        if (state.bypassed !== undefined) {
            this.bypassed = state.bypassed;
        }
    }
}

/**
 * Helper to create a standard bypass routing setup
 * Call this after creating processing nodes in subclass constructor
 *
 * @param {AudioPlugin} plugin - The plugin instance
 * @param {AudioNode} processingInput - First node in processing chain
 * @param {AudioNode} processingOutput - Last node in processing chain
 */
export function setupBypassRouting(plugin, processingInput, processingOutput) {
    // Dry path (bypass)
    plugin._input.connect(plugin._bypassGain);
    plugin._bypassGain.connect(plugin._output);

    // Wet path (processed)
    plugin._input.connect(processingInput);
    processingOutput.connect(plugin._wetGain);
    plugin._wetGain.connect(plugin._output);
}
