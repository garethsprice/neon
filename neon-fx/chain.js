/**
 * Neon Audio Plugin - Chain
 *
 * Utility for creating and managing chains of audio plugins.
 * Handles routing, serialization, and bulk operations.
 */

import { AudioPlugin } from './base.js';

export class PluginChain {
    /**
     * @param {AudioContext} audioContext
     */
    constructor(audioContext) {
        if (!audioContext) {
            throw new Error('PluginChain requires an AudioContext');
        }

        this.ctx = audioContext;
        this._plugins = [];

        // Input/output nodes for the chain
        this._input = this.ctx.createGain();
        this._output = this.ctx.createGain();

        // Direct connection when chain is empty
        this._input.connect(this._output);
    }

    /** Input node - connect sources here */
    get input() {
        return this._input;
    }

    /** Output node - connect this to destination */
    get output() {
        return this._output;
    }

    /** Get all plugins in the chain */
    get plugins() {
        return [...this._plugins];
    }

    /** Get number of plugins in chain */
    get length() {
        return this._plugins.length;
    }

    /**
     * Add a plugin to the end of the chain
     * @param {AudioPlugin} plugin
     * @returns {PluginChain} this for chaining
     */
    add(plugin) {
        return this.insert(plugin, this._plugins.length);
    }

    /**
     * Insert a plugin at a specific position
     * @param {AudioPlugin} plugin
     * @param {number} index
     * @returns {PluginChain} this for chaining
     */
    insert(plugin, index) {
        if (!(plugin instanceof AudioPlugin)) {
            throw new Error('Plugin must be an instance of AudioPlugin');
        }

        index = Math.max(0, Math.min(this._plugins.length, index));
        this._plugins.splice(index, 0, plugin);
        this._rewire();
        return this;
    }

    /**
     * Remove a plugin from the chain
     * @param {AudioPlugin|number} pluginOrIndex - Plugin instance or index
     * @returns {AudioPlugin|null} The removed plugin
     */
    remove(pluginOrIndex) {
        let index;
        if (typeof pluginOrIndex === 'number') {
            index = pluginOrIndex;
        } else {
            index = this._plugins.indexOf(pluginOrIndex);
        }

        if (index < 0 || index >= this._plugins.length) {
            return null;
        }

        const [removed] = this._plugins.splice(index, 1);
        removed.disconnect();
        this._rewire();
        return removed;
    }

    /**
     * Move a plugin to a new position
     * @param {number} fromIndex
     * @param {number} toIndex
     * @returns {PluginChain} this for chaining
     */
    move(fromIndex, toIndex) {
        if (fromIndex < 0 || fromIndex >= this._plugins.length) return this;
        toIndex = Math.max(0, Math.min(this._plugins.length - 1, toIndex));

        const [plugin] = this._plugins.splice(fromIndex, 1);
        this._plugins.splice(toIndex, 0, plugin);
        this._rewire();
        return this;
    }

    /**
     * Replace a plugin at a specific position
     * @param {number} index
     * @param {AudioPlugin} newPlugin
     * @returns {AudioPlugin|null} The replaced plugin
     */
    replace(index, newPlugin) {
        if (index < 0 || index >= this._plugins.length) return null;
        if (!(newPlugin instanceof AudioPlugin)) {
            throw new Error('Plugin must be an instance of AudioPlugin');
        }

        const old = this._plugins[index];
        old.disconnect();
        this._plugins[index] = newPlugin;
        this._rewire();
        return old;
    }

    /**
     * Get plugin at index
     * @param {number} index
     * @returns {AudioPlugin|undefined}
     */
    get(index) {
        return this._plugins[index];
    }

    /**
     * Find plugin by id
     * @param {string} id - Plugin id (e.g., 'filter', 'compressor')
     * @returns {AudioPlugin|undefined}
     */
    findById(id) {
        return this._plugins.find(p => p.constructor.id === id);
    }

    /**
     * Find all plugins by category
     * @param {string} category - Plugin category
     * @returns {AudioPlugin[]}
     */
    findByCategory(category) {
        return this._plugins.filter(p => p.constructor.category === category);
    }

    /**
     * Clear all plugins from the chain
     * @param {boolean} [destroy=false] - Also destroy the plugins
     */
    clear(destroy = false) {
        for (const plugin of this._plugins) {
            plugin.disconnect();
            if (destroy) {
                plugin.destroy();
            }
        }
        this._plugins = [];
        this._rewire();
    }

    /**
     * Rewire all connections in the chain
     * @private
     */
    _rewire() {
        // Disconnect everything from input
        this._input.disconnect();

        if (this._plugins.length === 0) {
            // Empty chain - direct connection
            this._input.connect(this._output);
            return;
        }

        // Connect input to first plugin
        this._input.connect(this._plugins[0].input);

        // Connect plugins in series
        for (let i = 0; i < this._plugins.length - 1; i++) {
            this._plugins[i].disconnect();
            this._plugins[i].connect(this._plugins[i + 1]);
        }

        // Connect last plugin to output
        this._plugins[this._plugins.length - 1].disconnect();
        this._plugins[this._plugins.length - 1].output.connect(this._output);
    }

    /**
     * Connect chain output to another node or plugin
     * @param {AudioNode|AudioPlugin|PluginChain} destination
     * @returns {AudioNode|AudioPlugin|PluginChain}
     */
    connect(destination) {
        if (destination instanceof PluginChain) {
            this._output.connect(destination.input);
        } else if (destination instanceof AudioPlugin) {
            this._output.connect(destination.input);
        } else {
            this._output.connect(destination);
        }
        return destination;
    }

    /**
     * Disconnect chain output
     * @param {AudioNode|AudioPlugin|PluginChain} [destination]
     */
    disconnect(destination) {
        if (destination) {
            if (destination instanceof PluginChain || destination instanceof AudioPlugin) {
                this._output.disconnect(destination.input);
            } else {
                this._output.disconnect(destination);
            }
        } else {
            this._output.disconnect();
        }
    }

    /**
     * Bypass all plugins in the chain
     * @param {boolean} bypassed
     */
    bypassAll(bypassed) {
        for (const plugin of this._plugins) {
            plugin.bypassed = bypassed;
        }
    }

    /**
     * Serialize chain state
     * @returns {Array<Object>}
     */
    serialize() {
        return this._plugins.map(plugin => plugin.serialize());
    }

    /**
     * Deserialize chain state (requires plugins to already exist in chain)
     * @param {Array<Object>} states
     */
    deserialize(states) {
        states.forEach((state, index) => {
            if (this._plugins[index]) {
                this._plugins[index].deserialize(state);
            }
        });
    }

    /**
     * Destroy the chain and all plugins
     */
    destroy() {
        this.clear(true);
        this._input.disconnect();
        this._output.disconnect();
    }

    /**
     * Create iterator for for...of loops
     */
    [Symbol.iterator]() {
        return this._plugins[Symbol.iterator]();
    }

    /**
     * ForEach iteration
     * @param {Function} callback
     */
    forEach(callback) {
        this._plugins.forEach(callback);
    }

    /**
     * Map over plugins
     * @param {Function} callback
     * @returns {Array}
     */
    map(callback) {
        return this._plugins.map(callback);
    }
}

/**
 * Create a chain from an array of plugins
 * @param {AudioContext} audioContext
 * @param {AudioPlugin[]} plugins
 * @returns {PluginChain}
 */
export function createChain(audioContext, plugins = []) {
    const chain = new PluginChain(audioContext);
    for (const plugin of plugins) {
        chain.add(plugin);
    }
    return chain;
}

/**
 * Parallel routing - split signal to multiple plugins and sum outputs
 */
export class ParallelChain {
    /**
     * @param {AudioContext} audioContext
     */
    constructor(audioContext) {
        this.ctx = audioContext;
        this._plugins = [];

        this._input = this.ctx.createGain();
        this._output = this.ctx.createGain();
    }

    get input() {
        return this._input;
    }

    get output() {
        return this._output;
    }

    get plugins() {
        return [...this._plugins];
    }

    /**
     * Add a parallel branch
     * @param {AudioPlugin|PluginChain} plugin
     * @returns {ParallelChain}
     */
    add(plugin) {
        this._plugins.push(plugin);
        this._input.connect(plugin.input);
        plugin.output.connect(this._output);
        return this;
    }

    /**
     * Remove a parallel branch
     * @param {AudioPlugin|PluginChain|number} pluginOrIndex
     * @returns {AudioPlugin|PluginChain|null}
     */
    remove(pluginOrIndex) {
        let index;
        if (typeof pluginOrIndex === 'number') {
            index = pluginOrIndex;
        } else {
            index = this._plugins.indexOf(pluginOrIndex);
        }

        if (index < 0 || index >= this._plugins.length) {
            return null;
        }

        const [removed] = this._plugins.splice(index, 1);
        this._input.disconnect(removed.input);
        removed.disconnect(this._output);
        return removed;
    }

    connect(destination) {
        if (destination.input) {
            this._output.connect(destination.input);
        } else {
            this._output.connect(destination);
        }
        return destination;
    }

    disconnect(destination) {
        if (destination) {
            if (destination.input) {
                this._output.disconnect(destination.input);
            } else {
                this._output.disconnect(destination);
            }
        } else {
            this._output.disconnect();
        }
    }

    destroy() {
        for (const plugin of this._plugins) {
            this._input.disconnect(plugin.input);
            plugin.disconnect(this._output);
            if (plugin.destroy) plugin.destroy();
        }
        this._plugins = [];
        this._input.disconnect();
    }
}
