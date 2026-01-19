/**
 * Web Audio API Mocks for testing
 *
 * Provides minimal mock implementations of Web Audio API objects
 * needed to test AudioPlugin classes.
 */

interface ScheduledValue {
  type: string;
  value?: number;
  target?: number;
  time?: number;
  startTime?: number;
  endTime?: number;
  timeConstant?: number;
}

interface MockConnection {
  destination: unknown;
  outputIndex?: number;
  inputIndex?: number;
}

type DistanceModelType = 'linear' | 'inverse' | 'exponential';
type PanningModelType = 'equalpower' | 'HRTF';

/**
 * Mock AudioParam - tracks scheduled values and ramps
 */
export class MockAudioParam {
  _value: number;
  _scheduledValues: ScheduledValue[];

  constructor(defaultValue: number = 0) {
    this._value = defaultValue;
    this._scheduledValues = [];
  }

  get value(): number {
    return this._value;
  }

  set value(v: number) {
    this._value = v;
  }

  setValueAtTime(value: number, time: number): this {
    this._value = value;
    this._scheduledValues.push({ type: 'setValueAtTime', value, time });
    return this;
  }

  setTargetAtTime(target: number, startTime: number, timeConstant: number): this {
    this._value = target;
    this._scheduledValues.push({ type: 'setTargetAtTime', target, startTime, timeConstant });
    return this;
  }

  linearRampToValueAtTime(value: number, endTime: number): this {
    this._value = value;
    this._scheduledValues.push({ type: 'linearRampToValueAtTime', value, endTime });
    return this;
  }

  exponentialRampToValueAtTime(value: number, endTime: number): this {
    this._value = value;
    this._scheduledValues.push({ type: 'exponentialRampToValueAtTime', value, endTime });
    return this;
  }

  cancelScheduledValues(_startTime: number): this {
    this._scheduledValues = [];
    return this;
  }
}

/**
 * Mock GainNode
 */
export class MockGainNode {
  context: MockAudioContext;
  gain: MockAudioParam;
  _connections: MockConnection[];

  constructor(context: MockAudioContext) {
    this.context = context;
    this.gain = new MockAudioParam(1);
    this._connections = [];
  }

  connect(destination: unknown, outputIndex?: number, inputIndex?: number): unknown {
    this._connections.push({ destination, outputIndex, inputIndex });
    return destination;
  }

  disconnect(destination?: unknown): void {
    if (destination) {
      this._connections = this._connections.filter(c => c.destination !== destination);
    } else {
      this._connections = [];
    }
  }
}

/**
 * Mock BiquadFilterNode
 */
export class MockBiquadFilterNode {
  context: MockAudioContext;
  type: BiquadFilterType;
  frequency: MockAudioParam;
  Q: MockAudioParam;
  gain: MockAudioParam;
  detune: MockAudioParam;
  _connections: MockConnection[];

  constructor(context: MockAudioContext) {
    this.context = context;
    this.type = 'lowpass';
    this.frequency = new MockAudioParam(350);
    this.Q = new MockAudioParam(1);
    this.gain = new MockAudioParam(0);
    this.detune = new MockAudioParam(0);
    this._connections = [];
  }

  connect(destination: unknown, outputIndex?: number, inputIndex?: number): unknown {
    this._connections.push({ destination, outputIndex, inputIndex });
    return destination;
  }

  disconnect(destination?: unknown): void {
    if (destination) {
      this._connections = this._connections.filter(c => c.destination !== destination);
    } else {
      this._connections = [];
    }
  }

  getFrequencyResponse(
    _frequencyArray: Float32Array,
    magResponseOutput: Float32Array,
    phaseResponseOutput: Float32Array
  ): void {
    // Fill with mock values
    for (let i = 0; i < magResponseOutput.length; i++) {
      magResponseOutput[i] = 1;
      phaseResponseOutput[i] = 0;
    }
  }
}

/**
 * Mock OscillatorNode
 */
export class MockOscillatorNode {
  context: MockAudioContext;
  type: OscillatorType;
  frequency: MockAudioParam;
  detune: MockAudioParam;
  _connections: MockConnection[];
  _started: boolean;
  _stopped: boolean;
  _startTime?: number;
  _stopTime?: number;

  constructor(context: MockAudioContext) {
    this.context = context;
    this.type = 'sine';
    this.frequency = new MockAudioParam(440);
    this.detune = new MockAudioParam(0);
    this._connections = [];
    this._started = false;
    this._stopped = false;
  }

  connect(destination: unknown, outputIndex?: number, inputIndex?: number): unknown {
    this._connections.push({ destination, outputIndex, inputIndex });
    return destination;
  }

  disconnect(destination?: unknown): void {
    if (destination) {
      this._connections = this._connections.filter(c => c.destination !== destination);
    } else {
      this._connections = [];
    }
  }

  start(when?: number): void {
    this._started = true;
    this._startTime = when;
  }

  stop(when?: number): void {
    this._stopped = true;
    this._stopTime = when;
  }
}

/**
 * Mock DelayNode
 */
export class MockDelayNode {
  context: MockAudioContext;
  delayTime: MockAudioParam;
  _maxDelayTime: number;
  _connections: MockConnection[];

  constructor(context: MockAudioContext, maxDelayTime: number = 1) {
    this.context = context;
    this.delayTime = new MockAudioParam(0);
    this._maxDelayTime = maxDelayTime;
    this._connections = [];
  }

  connect(destination: unknown, outputIndex?: number, inputIndex?: number): unknown {
    this._connections.push({ destination, outputIndex, inputIndex });
    return destination;
  }

  disconnect(destination?: unknown): void {
    if (destination) {
      this._connections = this._connections.filter(c => c.destination !== destination);
    } else {
      this._connections = [];
    }
  }
}

/**
 * Mock DynamicsCompressorNode
 */
export class MockDynamicsCompressorNode {
  context: MockAudioContext;
  threshold: MockAudioParam;
  knee: MockAudioParam;
  ratio: MockAudioParam;
  attack: MockAudioParam;
  release: MockAudioParam;
  reduction: number;
  _connections: MockConnection[];

  constructor(context: MockAudioContext) {
    this.context = context;
    this.threshold = new MockAudioParam(-24);
    this.knee = new MockAudioParam(30);
    this.ratio = new MockAudioParam(12);
    this.attack = new MockAudioParam(0.003);
    this.release = new MockAudioParam(0.25);
    this.reduction = 0;
    this._connections = [];
  }

  connect(destination: unknown, outputIndex?: number, inputIndex?: number): unknown {
    this._connections.push({ destination, outputIndex, inputIndex });
    return destination;
  }

  disconnect(destination?: unknown): void {
    if (destination) {
      this._connections = this._connections.filter(c => c.destination !== destination);
    } else {
      this._connections = [];
    }
  }
}

/**
 * Mock WaveShaperNode
 */
export class MockWaveShaperNode {
  context: MockAudioContext;
  curve: Float32Array | null;
  oversample: OverSampleType;
  _connections: MockConnection[];

  constructor(context: MockAudioContext) {
    this.context = context;
    this.curve = null;
    this.oversample = 'none';
    this._connections = [];
  }

  connect(destination: unknown, outputIndex?: number, inputIndex?: number): unknown {
    this._connections.push({ destination, outputIndex, inputIndex });
    return destination;
  }

  disconnect(destination?: unknown): void {
    if (destination) {
      this._connections = this._connections.filter(c => c.destination !== destination);
    } else {
      this._connections = [];
    }
  }
}

/**
 * Mock ConvolverNode
 */
export class MockConvolverNode {
  context: MockAudioContext;
  buffer: AudioBuffer | null;
  normalize: boolean;
  _connections: MockConnection[];

  constructor(context: MockAudioContext) {
    this.context = context;
    this.buffer = null;
    this.normalize = true;
    this._connections = [];
  }

  connect(destination: unknown, outputIndex?: number, inputIndex?: number): unknown {
    this._connections.push({ destination, outputIndex, inputIndex });
    return destination;
  }

  disconnect(destination?: unknown): void {
    if (destination) {
      this._connections = this._connections.filter(c => c.destination !== destination);
    } else {
      this._connections = [];
    }
  }
}

/**
 * Mock StereoPannerNode
 */
export class MockStereoPannerNode {
  context: MockAudioContext;
  pan: MockAudioParam;
  _connections: MockConnection[];

  constructor(context: MockAudioContext) {
    this.context = context;
    this.pan = new MockAudioParam(0);
    this._connections = [];
  }

  connect(destination: unknown, outputIndex?: number, inputIndex?: number): unknown {
    this._connections.push({ destination, outputIndex, inputIndex });
    return destination;
  }

  disconnect(destination?: unknown): void {
    if (destination) {
      this._connections = this._connections.filter(c => c.destination !== destination);
    } else {
      this._connections = [];
    }
  }
}

/**
 * Mock PannerNode (3D spatial audio)
 */
export class MockPannerNode {
  context: MockAudioContext;
  positionX: MockAudioParam;
  positionY: MockAudioParam;
  positionZ: MockAudioParam;
  orientationX: MockAudioParam;
  orientationY: MockAudioParam;
  orientationZ: MockAudioParam;
  distanceModel: DistanceModelType;
  panningModel: PanningModelType;
  refDistance: number;
  maxDistance: number;
  rolloffFactor: number;
  coneInnerAngle: number;
  coneOuterAngle: number;
  coneOuterGain: number;
  _connections: MockConnection[];

  constructor(context: MockAudioContext) {
    this.context = context;
    this.positionX = new MockAudioParam(0);
    this.positionY = new MockAudioParam(0);
    this.positionZ = new MockAudioParam(0);
    this.orientationX = new MockAudioParam(1);
    this.orientationY = new MockAudioParam(0);
    this.orientationZ = new MockAudioParam(0);
    this.distanceModel = 'inverse';
    this.panningModel = 'HRTF';
    this.refDistance = 1;
    this.maxDistance = 10000;
    this.rolloffFactor = 1;
    this.coneInnerAngle = 360;
    this.coneOuterAngle = 360;
    this.coneOuterGain = 0;
    this._connections = [];
  }

  connect(destination: unknown, outputIndex?: number, inputIndex?: number): unknown {
    this._connections.push({ destination, outputIndex, inputIndex });
    return destination;
  }

  disconnect(destination?: unknown): void {
    if (destination) {
      this._connections = this._connections.filter(c => c.destination !== destination);
    } else {
      this._connections = [];
    }
  }
}

/**
 * Mock AnalyserNode
 */
export class MockAnalyserNode {
  context: MockAudioContext;
  fftSize: number;
  frequencyBinCount: number;
  smoothingTimeConstant: number;
  minDecibels: number;
  maxDecibels: number;
  _connections: MockConnection[];

  constructor(context: MockAudioContext) {
    this.context = context;
    this.fftSize = 2048;
    this.frequencyBinCount = 1024;
    this.smoothingTimeConstant = 0.8;
    this.minDecibels = -100;
    this.maxDecibels = -30;
    this._connections = [];
  }

  connect(destination: unknown, outputIndex?: number, inputIndex?: number): unknown {
    this._connections.push({ destination, outputIndex, inputIndex });
    return destination;
  }

  disconnect(destination?: unknown): void {
    if (destination) {
      this._connections = this._connections.filter(c => c.destination !== destination);
    } else {
      this._connections = [];
    }
  }

  getByteFrequencyData(array: Uint8Array): void {
    for (let i = 0; i < array.length; i++) {
      array[i] = 0;
    }
  }

  getFloatFrequencyData(array: Float32Array): void {
    for (let i = 0; i < array.length; i++) {
      array[i] = -100;
    }
  }

  getByteTimeDomainData(array: Uint8Array): void {
    for (let i = 0; i < array.length; i++) {
      array[i] = 128;
    }
  }

  getFloatTimeDomainData(array: Float32Array): void {
    for (let i = 0; i < array.length; i++) {
      array[i] = 0;
    }
  }
}

/**
 * Mock AudioDestinationNode
 */
export class MockAudioDestinationNode {
  context: MockAudioContext;
  maxChannelCount: number;
  numberOfInputs: number;
  numberOfOutputs: number;

  constructor(context: MockAudioContext) {
    this.context = context;
    this.maxChannelCount = 2;
    this.numberOfInputs = 1;
    this.numberOfOutputs = 0;
  }
}

/**
 * Mock AudioBuffer
 */
export class MockAudioBuffer {
  sampleRate: number;
  length: number;
  duration: number;
  numberOfChannels: number;
  private _channels: Float32Array[];

  constructor(options: { numberOfChannels: number; length: number; sampleRate: number }) {
    this.numberOfChannels = options.numberOfChannels;
    this.length = options.length;
    this.sampleRate = options.sampleRate;
    this.duration = options.length / options.sampleRate;
    this._channels = [];
    for (let i = 0; i < options.numberOfChannels; i++) {
      this._channels.push(new Float32Array(options.length));
    }
  }

  getChannelData(channel: number): Float32Array {
    return this._channels[channel];
  }

  copyFromChannel(destination: Float32Array, channelNumber: number, startInChannel?: number): void {
    const source = this._channels[channelNumber];
    const start = startInChannel || 0;
    for (let i = 0; i < destination.length && i + start < source.length; i++) {
      destination[i] = source[i + start];
    }
  }

  copyToChannel(source: Float32Array, channelNumber: number, startInChannel?: number): void {
    const dest = this._channels[channelNumber];
    const start = startInChannel || 0;
    for (let i = 0; i < source.length && i + start < dest.length; i++) {
      dest[i + start] = source[i];
    }
  }
}

/**
 * Mock AudioContext
 */
export class MockAudioContext {
  state: AudioContextState;
  sampleRate: number;
  currentTime: number;
  destination: MockAudioDestinationNode;
  _nodes: unknown[];

  constructor() {
    this.state = 'running';
    this.sampleRate = 44100;
    this.currentTime = 0;
    this.destination = new MockAudioDestinationNode(this);
    this._nodes = [];
  }

  createGain(): MockGainNode {
    const node = new MockGainNode(this);
    this._nodes.push(node);
    return node;
  }

  createBiquadFilter(): MockBiquadFilterNode {
    const node = new MockBiquadFilterNode(this);
    this._nodes.push(node);
    return node;
  }

  createOscillator(): MockOscillatorNode {
    const node = new MockOscillatorNode(this);
    this._nodes.push(node);
    return node;
  }

  createDelay(maxDelayTime?: number): MockDelayNode {
    const node = new MockDelayNode(this, maxDelayTime);
    this._nodes.push(node);
    return node;
  }

  createDynamicsCompressor(): MockDynamicsCompressorNode {
    const node = new MockDynamicsCompressorNode(this);
    this._nodes.push(node);
    return node;
  }

  createWaveShaper(): MockWaveShaperNode {
    const node = new MockWaveShaperNode(this);
    this._nodes.push(node);
    return node;
  }

  createConvolver(): MockConvolverNode {
    const node = new MockConvolverNode(this);
    this._nodes.push(node);
    return node;
  }

  createStereoPanner(): MockStereoPannerNode {
    const node = new MockStereoPannerNode(this);
    this._nodes.push(node);
    return node;
  }

  createPanner(): MockPannerNode {
    const node = new MockPannerNode(this);
    this._nodes.push(node);
    return node;
  }

  createAnalyser(): MockAnalyserNode {
    const node = new MockAnalyserNode(this);
    this._nodes.push(node);
    return node;
  }

  createBuffer(numberOfChannels: number, length: number, sampleRate: number): MockAudioBuffer {
    return new MockAudioBuffer({ numberOfChannels, length, sampleRate });
  }

  decodeAudioData(_arrayBuffer: ArrayBuffer): Promise<MockAudioBuffer> {
    // Return a mock buffer
    return Promise.resolve(new MockAudioBuffer({
      numberOfChannels: 2,
      length: this.sampleRate,
      sampleRate: this.sampleRate
    }));
  }

  resume(): Promise<void> {
    this.state = 'running';
    return Promise.resolve();
  }

  suspend(): Promise<void> {
    this.state = 'suspended';
    return Promise.resolve();
  }

  close(): Promise<void> {
    this.state = 'closed';
    return Promise.resolve();
  }
}

/**
 * Create a fresh mock AudioContext for testing
 */
export function createMockAudioContext(): MockAudioContext {
  return new MockAudioContext();
}
