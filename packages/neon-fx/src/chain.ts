/**
 * Neon Audio Plugin - Chain
 *
 * Utility for creating and managing chains of audio plugins.
 * Handles routing, serialization, and bulk operations.
 */

import { AudioPlugin } from './base';
import type { PluginState } from './types';

export class PluginChain {
  readonly ctx: AudioContext;
  private _plugins: AudioPlugin[];
  private _input: GainNode;
  private _output: GainNode;

  constructor(audioContext: AudioContext) {
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
  get input(): GainNode {
    return this._input;
  }

  /** Output node - connect this to destination */
  get output(): GainNode {
    return this._output;
  }

  /** Get all plugins in the chain */
  get plugins(): AudioPlugin[] {
    return [...this._plugins];
  }

  /** Get number of plugins in chain */
  get length(): number {
    return this._plugins.length;
  }

  /**
   * Add a plugin to the end of the chain
   */
  add(plugin: AudioPlugin): PluginChain {
    return this.insert(plugin, this._plugins.length);
  }

  /**
   * Insert a plugin at a specific position
   */
  insert(plugin: AudioPlugin, index: number): PluginChain {
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
   */
  remove(pluginOrIndex: AudioPlugin | number): AudioPlugin | null {
    let index: number;
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
   */
  move(fromIndex: number, toIndex: number): PluginChain {
    if (fromIndex < 0 || fromIndex >= this._plugins.length) return this;
    toIndex = Math.max(0, Math.min(this._plugins.length - 1, toIndex));

    const [plugin] = this._plugins.splice(fromIndex, 1);
    this._plugins.splice(toIndex, 0, plugin);
    this._rewire();
    return this;
  }

  /**
   * Replace a plugin at a specific position
   */
  replace(index: number, newPlugin: AudioPlugin): AudioPlugin | null {
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
   */
  get(index: number): AudioPlugin | undefined {
    return this._plugins[index];
  }

  /**
   * Find plugin by id
   */
  findById(id: string): AudioPlugin | undefined {
    return this._plugins.find(p => (p.constructor as typeof AudioPlugin).id === id);
  }

  /**
   * Find all plugins by category
   */
  findByCategory(category: string): AudioPlugin[] {
    return this._plugins.filter(p => (p.constructor as typeof AudioPlugin).category === category);
  }

  /**
   * Clear all plugins from the chain
   */
  clear(destroy: boolean = false): void {
    for (const plugin of this._plugins) {
      plugin.disconnect();
      if (destroy) {
        plugin.destroy();
      }
    }
    this._plugins = [];
    this._rewire();
  }

  /** Rewire all connections in the chain */
  private _rewire(): void {
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
   */
  connect(destination: AudioNode | AudioPlugin | PluginChain): AudioNode | AudioPlugin | PluginChain {
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
   */
  disconnect(destination?: AudioNode | AudioPlugin | PluginChain): void {
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
   */
  bypassAll(bypassed: boolean): void {
    for (const plugin of this._plugins) {
      plugin.bypassed = bypassed;
    }
  }

  /**
   * Serialize chain state
   */
  serialize(): PluginState[] {
    return this._plugins.map(plugin => plugin.serialize());
  }

  /**
   * Deserialize chain state (requires plugins to already exist in chain)
   */
  deserialize(states: Partial<PluginState>[]): void {
    states.forEach((state, index) => {
      if (this._plugins[index]) {
        this._plugins[index].deserialize(state);
      }
    });
  }

  /**
   * Destroy the chain and all plugins
   */
  destroy(): void {
    this.clear(true);
    this._input.disconnect();
    this._output.disconnect();
  }

  /**
   * Create iterator for for...of loops
   */
  [Symbol.iterator](): Iterator<AudioPlugin> {
    return this._plugins[Symbol.iterator]();
  }

  /**
   * ForEach iteration
   */
  forEach(callback: (plugin: AudioPlugin, index: number, array: AudioPlugin[]) => void): void {
    this._plugins.forEach(callback);
  }

  /**
   * Map over plugins
   */
  map<T>(callback: (plugin: AudioPlugin, index: number, array: AudioPlugin[]) => T): T[] {
    return this._plugins.map(callback);
  }
}

/**
 * Create a chain from an array of plugins
 */
export function createChain(audioContext: AudioContext, plugins: AudioPlugin[] = []): PluginChain {
  const chain = new PluginChain(audioContext);
  for (const plugin of plugins) {
    chain.add(plugin);
  }
  return chain;
}

/** Connectable type for parallel chain */
type Connectable = AudioPlugin | PluginChain;

/**
 * Parallel routing - split signal to multiple plugins and sum outputs
 */
export class ParallelChain {
  readonly ctx: AudioContext;
  private _plugins: Connectable[];
  private _input: GainNode;
  private _output: GainNode;

  constructor(audioContext: AudioContext) {
    this.ctx = audioContext;
    this._plugins = [];

    this._input = this.ctx.createGain();
    this._output = this.ctx.createGain();
  }

  get input(): GainNode {
    return this._input;
  }

  get output(): GainNode {
    return this._output;
  }

  get plugins(): Connectable[] {
    return [...this._plugins];
  }

  /**
   * Add a parallel branch
   */
  add(plugin: Connectable): ParallelChain {
    this._plugins.push(plugin);
    this._input.connect(plugin.input);
    plugin.output.connect(this._output);
    return this;
  }

  /**
   * Remove a parallel branch
   */
  remove(pluginOrIndex: Connectable | number): Connectable | null {
    let index: number;
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
    if (removed instanceof AudioPlugin) {
      removed.disconnect(this._output);
    } else {
      removed.output.disconnect(this._output);
    }
    return removed;
  }

  connect(destination: AudioNode | Connectable): AudioNode | Connectable {
    if ('input' in destination && destination.input instanceof GainNode) {
      this._output.connect(destination.input);
    } else {
      this._output.connect(destination as AudioNode);
    }
    return destination;
  }

  disconnect(destination?: AudioNode | Connectable): void {
    if (destination) {
      if ('input' in destination && destination.input instanceof GainNode) {
        this._output.disconnect(destination.input);
      } else {
        this._output.disconnect(destination as AudioNode);
      }
    } else {
      this._output.disconnect();
    }
  }

  destroy(): void {
    for (const plugin of this._plugins) {
      this._input.disconnect(plugin.input);
      if (plugin instanceof AudioPlugin) {
        plugin.disconnect(this._output);
        plugin.destroy();
      } else {
        plugin.output.disconnect(this._output);
        plugin.destroy();
      }
    }
    this._plugins = [];
    this._input.disconnect();
  }
}
