/**
 * Neon Audio Plugins
 *
 * A collection of chainable Web Audio API plugins with a standardized interface.
 *
 * ## Quick Start
 *
 * ```javascript
 * import { Filter, Compressor, Reverb, PluginChain } from './plugins/index.js';
 *
 * const ctx = new AudioContext();
 *
 * // Create plugins
 * const filter = new Filter(ctx, { cutoff: 2000 });
 * const compressor = new Compressor(ctx, { threshold: -18 });
 * const reverb = new Reverb(ctx, { mix: 30 });
 *
 * // Chain them together
 * const chain = new PluginChain(ctx);
 * chain.add(filter).add(compressor).add(reverb);
 *
 * // Connect to audio graph
 * sourceNode.connect(chain.input);
 * chain.connect(ctx.destination);
 *
 * // Adjust parameters in real-time
 * filter.setParam('cutoff', 1000, 0.1);  // ramp over 100ms
 * ```
 */

// Base class and utilities
export { AudioPlugin, setupBypassRouting } from './base.js';

// Filter plugins
export {
    Filter,
    LowpassFilter,
    HighpassFilter,
    BandpassFilter
} from './filter.js';

// Saturation/distortion plugins
export {
    Saturation,
    createSaturationCurve,
    createTubeCurve,
    createTapeCurve,
    createHardClipCurve
} from './saturation.js';

// Dynamics plugins
export {
    Compressor,
    Limiter
} from './compressor.js';

// Sidechain plugins
export {
    Sidechain,
    RhythmicSidechain
} from './sidechain.js';

// Adaptive noise plugin
export { AdaptiveNoise } from './adaptive-noise.js';

// Reverb plugins
export {
    Reverb,
    PlateReverb,
    HallReverb,
    RoomReverb,
    generateImpulseResponse
} from './reverb.js';

// Delay plugins
export {
    Delay,
    PingPongDelay,
    SlapbackDelay
} from './delay.js';

// Chain utilities
export {
    PluginChain,
    ParallelChain,
    createChain
} from './chain.js';

/**
 * Registry of all available plugins for dynamic instantiation
 */
export const pluginRegistry = {
    // Filters
    'filter': () => import('./filter.js').then(m => m.Filter),
    'lowpass-filter': () => import('./filter.js').then(m => m.LowpassFilter),
    'highpass-filter': () => import('./filter.js').then(m => m.HighpassFilter),
    'bandpass-filter': () => import('./filter.js').then(m => m.BandpassFilter),

    // Saturation
    'saturation': () => import('./saturation.js').then(m => m.Saturation),

    // Dynamics
    'compressor': () => import('./compressor.js').then(m => m.Compressor),
    'limiter': () => import('./compressor.js').then(m => m.Limiter),

    // Sidechain
    'sidechain': () => import('./sidechain.js').then(m => m.Sidechain),
    'rhythmic-sidechain': () => import('./sidechain.js').then(m => m.RhythmicSidechain),

    // Adaptive
    'adaptive-noise': () => import('./adaptive-noise.js').then(m => m.AdaptiveNoise),

    // Reverb
    'reverb': () => import('./reverb.js').then(m => m.Reverb),
    'plate-reverb': () => import('./reverb.js').then(m => m.PlateReverb),
    'hall-reverb': () => import('./reverb.js').then(m => m.HallReverb),
    'room-reverb': () => import('./reverb.js').then(m => m.RoomReverb),

    // Delay
    'delay': () => import('./delay.js').then(m => m.Delay),
    'ping-pong-delay': () => import('./delay.js').then(m => m.PingPongDelay),
    'slapback-delay': () => import('./delay.js').then(m => m.SlapbackDelay)
};

/**
 * Create a plugin by id
 * @param {string} id - Plugin id
 * @param {AudioContext} audioContext
 * @param {Object} options
 * @returns {Promise<AudioPlugin>}
 */
export async function createPlugin(id, audioContext, options = {}) {
    const loader = pluginRegistry[id];
    if (!loader) {
        throw new Error(`Unknown plugin id: ${id}`);
    }
    const PluginClass = await loader();
    return new PluginClass(audioContext, options);
}

/**
 * Get all available plugin ids
 * @returns {string[]}
 */
export function getAvailablePlugins() {
    return Object.keys(pluginRegistry);
}
