/**
 * Tests for neon-fx AudioPlugin base class
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { AudioPlugin, setupBypassRouting } from '../src/base';
import { MockAudioContext, createMockAudioContext, MockGainNode } from '../__mocks__/web-audio';

// Type for testing protected members
type TestablePlugin = AudioPlugin & {
  ctx: MockAudioContext;
  _input: MockGainNode;
  _output: MockGainNode;
  _bypassGain: MockGainNode;
  _wetGain: MockGainNode;
  _bypassed: boolean;
  _params: Record<string, number>;
  _setAudioParam: (audioParam: { setValueAtTime: (v: number, t: number) => void; setTargetAtTime: (t: number, s: number, c: number) => void }, value: number, rampTime: number) => void;
  _lastApplied?: { name: string; value: number; rampTime: number };
  _bypassCalled?: boolean;
};

describe('AudioPlugin', () => {
  let audioContext: MockAudioContext;

  beforeEach(() => {
    audioContext = createMockAudioContext();
  });

  describe('constructor', () => {
    it('throws error when AudioContext is not provided', () => {
      expect(() => new AudioPlugin(undefined as unknown as AudioContext)).toThrow('AudioPlugin requires an AudioContext');
      expect(() => new AudioPlugin(null as unknown as AudioContext)).toThrow('AudioPlugin requires an AudioContext');
    });

    it('creates input and output gain nodes', () => {
      const plugin = new AudioPlugin(audioContext as unknown as AudioContext) as TestablePlugin;
      expect(plugin._input).toBeDefined();
      expect(plugin._output).toBeDefined();
    });

    it('creates bypass routing nodes', () => {
      const plugin = new AudioPlugin(audioContext as unknown as AudioContext) as TestablePlugin;
      expect(plugin._bypassGain).toBeDefined();
      expect(plugin._wetGain).toBeDefined();
      expect(plugin._bypassGain.gain.value).toBe(0);
      expect(plugin._wetGain.gain.value).toBe(1);
    });

    it('stores audioContext reference', () => {
      const plugin = new AudioPlugin(audioContext as unknown as AudioContext) as TestablePlugin;
      expect(plugin.ctx).toBe(audioContext);
    });

    it('initializes with bypassed = false', () => {
      const plugin = new AudioPlugin(audioContext as unknown as AudioContext) as TestablePlugin;
      expect(plugin._bypassed).toBe(false);
    });
  });

  describe('static metadata', () => {
    it('has default id', () => {
      expect(AudioPlugin.id).toBe('base');
    });

    it('has default name', () => {
      expect(AudioPlugin.name).toBe('Audio Plugin');
    });

    it('has default description', () => {
      expect(AudioPlugin.description).toBe('Base audio plugin class');
    });

    it('has default category', () => {
      expect(AudioPlugin.category).toBe('utility');
    });

    it('has empty parameterDefinitions', () => {
      expect(AudioPlugin.parameterDefinitions).toEqual([]);
    });
  });

  describe('input/output accessors', () => {
    it('exposes input node', () => {
      const plugin = new AudioPlugin(audioContext as unknown as AudioContext) as TestablePlugin;
      expect(plugin.input).toBe(plugin._input);
    });

    it('exposes output node', () => {
      const plugin = new AudioPlugin(audioContext as unknown as AudioContext) as TestablePlugin;
      expect(plugin.output).toBe(plugin._output);
    });
  });

  describe('connect/disconnect', () => {
    it('connects to AudioNode', () => {
      const plugin = new AudioPlugin(audioContext as unknown as AudioContext) as TestablePlugin;
      const destination = audioContext.createGain();

      plugin.connect(destination as unknown as AudioNode);
      expect(plugin._output._connections.length).toBe(1);
      expect(plugin._output._connections[0].destination).toBe(destination);
    });

    it('connects to another AudioPlugin', () => {
      const plugin1 = new AudioPlugin(audioContext as unknown as AudioContext) as TestablePlugin;
      const plugin2 = new AudioPlugin(audioContext as unknown as AudioContext) as TestablePlugin;

      plugin1.connect(plugin2);
      expect(plugin1._output._connections.length).toBe(1);
      expect(plugin1._output._connections[0].destination).toBe(plugin2.input);
    });

    it('returns destination for chaining', () => {
      const plugin1 = new AudioPlugin(audioContext as unknown as AudioContext);
      const plugin2 = new AudioPlugin(audioContext as unknown as AudioContext);

      const result = plugin1.connect(plugin2);
      expect(result).toBe(plugin2);
    });

    it('disconnects from specific destination', () => {
      const plugin = new AudioPlugin(audioContext as unknown as AudioContext) as TestablePlugin;
      const dest1 = audioContext.createGain();
      const dest2 = audioContext.createGain();

      plugin.connect(dest1 as unknown as AudioNode);
      plugin.connect(dest2 as unknown as AudioNode);
      expect(plugin._output._connections.length).toBe(2);

      plugin.disconnect(dest1 as unknown as AudioNode);
      expect(plugin._output._connections.length).toBe(1);
      expect(plugin._output._connections[0].destination).toBe(dest2);
    });

    it('disconnects from AudioPlugin', () => {
      const plugin1 = new AudioPlugin(audioContext as unknown as AudioContext) as TestablePlugin;
      const plugin2 = new AudioPlugin(audioContext as unknown as AudioContext);

      plugin1.connect(plugin2);
      plugin1.disconnect(plugin2);
      expect(plugin1._output._connections.length).toBe(0);
    });

    it('disconnects all when no destination specified', () => {
      const plugin = new AudioPlugin(audioContext as unknown as AudioContext) as TestablePlugin;
      plugin.connect(audioContext.createGain() as unknown as AudioNode);
      plugin.connect(audioContext.createGain() as unknown as AudioNode);

      plugin.disconnect();
      expect(plugin._output._connections.length).toBe(0);
    });
  });

  describe('parameters', () => {
    class TestPlugin extends AudioPlugin {
      _lastApplied?: { name: string; value: number; rampTime: number };

      static get parameterDefinitions() {
        return [
          { name: 'volume', min: 0, max: 1, default: 0.5 },
          { name: 'frequency', min: 20, max: 20000, default: 1000 }
        ] as const;
      }

      protected _applyParam(name: string, value: number, rampTime: number): void {
        this._lastApplied = { name, value, rampTime };
      }
    }

    it('initializes params from definitions', () => {
      const plugin = new TestPlugin(audioContext as unknown as AudioContext) as TestPlugin & TestablePlugin;
      expect(plugin._params.volume).toBe(0.5);
      expect(plugin._params.frequency).toBe(1000);
    });

    it('accepts initial options override', () => {
      const plugin = new TestPlugin(audioContext as unknown as AudioContext, { volume: 0.8 }) as TestPlugin & TestablePlugin;
      expect(plugin._params.volume).toBe(0.8);
      expect(plugin._params.frequency).toBe(1000);
    });

    it('params getter returns copy', () => {
      const plugin = new TestPlugin(audioContext as unknown as AudioContext) as TestPlugin & TestablePlugin;
      const params = plugin.params;
      params.volume = 0.9;
      expect(plugin._params.volume).toBe(0.5);
    });

    it('getParam returns parameter value', () => {
      const plugin = new TestPlugin(audioContext as unknown as AudioContext);
      expect(plugin.getParam('volume')).toBe(0.5);
    });

    it('setParam updates parameter value', () => {
      const plugin = new TestPlugin(audioContext as unknown as AudioContext) as TestPlugin & TestablePlugin;
      plugin.setParam('volume', 0.8);
      expect(plugin._params.volume).toBe(0.8);
    });

    it('setParam clamps to min/max', () => {
      const plugin = new TestPlugin(audioContext as unknown as AudioContext) as TestPlugin & TestablePlugin;
      plugin.setParam('volume', 2);
      expect(plugin._params.volume).toBe(1);

      plugin.setParam('volume', -1);
      expect(plugin._params.volume).toBe(0);
    });

    it('setParam calls _applyParam', () => {
      const plugin = new TestPlugin(audioContext as unknown as AudioContext);
      plugin.setParam('volume', 0.7, 0.1);
      expect(plugin._lastApplied).toEqual({ name: 'volume', value: 0.7, rampTime: 0.1 });
    });

    it('setParams sets multiple parameters', () => {
      const plugin = new TestPlugin(audioContext as unknown as AudioContext) as TestPlugin & TestablePlugin;
      plugin.setParams({ volume: 0.3, frequency: 500 });
      expect(plugin._params.volume).toBe(0.3);
      expect(plugin._params.frequency).toBe(500);
    });
  });

  describe('_setAudioParam helper', () => {
    it('sets value immediately when rampTime is 0', () => {
      const plugin = new AudioPlugin(audioContext as unknown as AudioContext) as TestablePlugin;
      const gainNode = audioContext.createGain();

      plugin._setAudioParam(gainNode.gain as unknown as AudioParam, 0.5, 0);
      expect(gainNode.gain._scheduledValues[0]).toEqual({
        type: 'setValueAtTime',
        value: 0.5,
        time: 0
      });
    });

    it('uses setTargetAtTime when rampTime > 0', () => {
      const plugin = new AudioPlugin(audioContext as unknown as AudioContext) as TestablePlugin;
      const gainNode = audioContext.createGain();

      plugin._setAudioParam(gainNode.gain as unknown as AudioParam, 0.5, 0.3);
      const scheduled = gainNode.gain._scheduledValues[0];
      expect(scheduled.type).toBe('setTargetAtTime');
      expect(scheduled.target).toBe(0.5);
      expect(scheduled.startTime).toBe(0);
      expect(scheduled.timeConstant).toBeCloseTo(0.1, 5);
    });
  });

  describe('bypass', () => {
    it('bypassed getter returns bypass state', () => {
      const plugin = new AudioPlugin(audioContext as unknown as AudioContext);
      expect(plugin.bypassed).toBe(false);
    });

    it('setting bypassed to true updates gains', () => {
      const plugin = new AudioPlugin(audioContext as unknown as AudioContext) as TestablePlugin;
      plugin.bypassed = true;

      expect(plugin._bypassed).toBe(true);
      expect(plugin._wetGain.gain.value).toBe(0);
      expect(plugin._bypassGain.gain.value).toBe(1);
    });

    it('setting bypassed to false updates gains', () => {
      const plugin = new AudioPlugin(audioContext as unknown as AudioContext) as TestablePlugin;
      plugin.bypassed = true;
      plugin.bypassed = false;

      expect(plugin._bypassed).toBe(false);
      expect(plugin._wetGain.gain.value).toBe(1);
      expect(plugin._bypassGain.gain.value).toBe(0);
    });

    it('calls _bypass method', () => {
      class TestBypassPlugin extends AudioPlugin {
        _bypassCalled?: boolean;

        protected _bypass(bypassed: boolean): void {
          this._bypassCalled = bypassed;
        }
      }

      const plugin = new TestBypassPlugin(audioContext as unknown as AudioContext) as TestBypassPlugin & { _bypassCalled?: boolean };
      plugin.bypassed = true;
      expect(plugin._bypassCalled).toBe(true);

      plugin.bypassed = false;
      expect(plugin._bypassCalled).toBe(false);
    });

    it('coerces value to boolean', () => {
      const plugin = new AudioPlugin(audioContext as unknown as AudioContext) as TestablePlugin;
      plugin.bypassed = 1 as unknown as boolean;
      expect(plugin._bypassed).toBe(true);

      plugin.bypassed = 0 as unknown as boolean;
      expect(plugin._bypassed).toBe(false);

      plugin.bypassed = 'true' as unknown as boolean;
      expect(plugin._bypassed).toBe(true);
    });
  });

  describe('destroy', () => {
    it('disconnects output and input', () => {
      const plugin = new AudioPlugin(audioContext as unknown as AudioContext) as TestablePlugin;
      const destination = audioContext.createGain();
      plugin.connect(destination as unknown as AudioNode);

      plugin.destroy();
      expect(plugin._output._connections.length).toBe(0);
    });
  });

  describe('serialization', () => {
    class TestSerializePlugin extends AudioPlugin {
      static get id() { return 'test-plugin'; }
      static get parameterDefinitions() {
        return [
          { name: 'volume', min: 0, max: 1, default: 0.5 }
        ] as const;
      }
    }

    it('serialize returns plugin state', () => {
      const plugin = new TestSerializePlugin(audioContext as unknown as AudioContext, { volume: 0.8 });
      plugin.bypassed = true;

      const state = plugin.serialize();
      expect(state).toEqual({
        id: 'test-plugin',
        bypassed: true,
        params: { volume: 0.8 }
      });
    });

    it('deserialize restores params', () => {
      const plugin = new TestSerializePlugin(audioContext as unknown as AudioContext) as TestSerializePlugin & TestablePlugin;
      plugin.deserialize({ params: { volume: 0.3 } });
      expect(plugin._params.volume).toBe(0.3);
    });

    it('deserialize restores bypassed state', () => {
      const plugin = new TestSerializePlugin(audioContext as unknown as AudioContext) as TestSerializePlugin & TestablePlugin;
      plugin.deserialize({ bypassed: true });
      expect(plugin._bypassed).toBe(true);
    });

    it('deserialize handles partial state', () => {
      const plugin = new TestSerializePlugin(audioContext as unknown as AudioContext) as TestSerializePlugin & TestablePlugin;
      plugin.deserialize({});
      expect(plugin._params.volume).toBe(0.5);
      expect(plugin._bypassed).toBe(false);
    });
  });
});

describe('setupBypassRouting', () => {
  let audioContext: MockAudioContext;

  beforeEach(() => {
    audioContext = createMockAudioContext();
  });

  it('connects dry path (bypass)', () => {
    const plugin = new AudioPlugin(audioContext as unknown as AudioContext) as TestablePlugin;
    const processingInput = audioContext.createGain();
    const processingOutput = audioContext.createGain();

    setupBypassRouting(plugin, processingInput as unknown as AudioNode, processingOutput as unknown as AudioNode);

    // Check input -> bypassGain connection
    const inputConnections = plugin._input._connections;
    const bypassConnection = inputConnections.find(c => c.destination === plugin._bypassGain);
    expect(bypassConnection).toBeDefined();

    // Check bypassGain -> output connection
    const bypassConnections = plugin._bypassGain._connections;
    const outputConnection = bypassConnections.find(c => c.destination === plugin._output);
    expect(outputConnection).toBeDefined();
  });

  it('connects wet path (processed)', () => {
    const plugin = new AudioPlugin(audioContext as unknown as AudioContext) as TestablePlugin;
    const processingInput = audioContext.createGain();
    const processingOutput = audioContext.createGain();

    setupBypassRouting(plugin, processingInput as unknown as AudioNode, processingOutput as unknown as AudioNode);

    // Check input -> processingInput connection
    const inputConnections = plugin._input._connections;
    const processingConnection = inputConnections.find(c => c.destination === processingInput);
    expect(processingConnection).toBeDefined();

    // Check processingOutput -> wetGain connection
    const procOutputConnections = processingOutput._connections;
    const wetConnection = procOutputConnections.find(c => c.destination === plugin._wetGain);
    expect(wetConnection).toBeDefined();

    // Check wetGain -> output connection
    const wetConnections = plugin._wetGain._connections;
    const outputConnection = wetConnections.find(c => c.destination === plugin._output);
    expect(outputConnection).toBeDefined();
  });
});
