/**
 * Web Audio API Mocks for testing
 *
 * Provides minimal mock implementations of Web Audio API objects
 * needed to test AudioPlugin classes.
 */

/**
 * Mock AudioParam - tracks scheduled values and ramps
 */
export class MockAudioParam {
    constructor(defaultValue = 0) {
        this._value = defaultValue;
        this._scheduledValues = [];
    }

    get value() {
        return this._value;
    }

    set value(v) {
        this._value = v;
    }

    setValueAtTime(value, time) {
        this._value = value;
        this._scheduledValues.push({ type: 'setValueAtTime', value, time });
        return this;
    }

    setTargetAtTime(target, startTime, timeConstant) {
        this._value = target;
        this._scheduledValues.push({ type: 'setTargetAtTime', target, startTime, timeConstant });
        return this;
    }

    linearRampToValueAtTime(value, endTime) {
        this._value = value;
        this._scheduledValues.push({ type: 'linearRampToValueAtTime', value, endTime });
        return this;
    }

    exponentialRampToValueAtTime(value, endTime) {
        this._value = value;
        this._scheduledValues.push({ type: 'exponentialRampToValueAtTime', value, endTime });
        return this;
    }

    cancelScheduledValues(startTime) {
        this._scheduledValues = [];
        return this;
    }
}

/**
 * Mock GainNode
 */
export class MockGainNode {
    constructor(context) {
        this.context = context;
        this.gain = new MockAudioParam(1);
        this._connections = [];
    }

    connect(destination, outputIndex, inputIndex) {
        this._connections.push({ destination, outputIndex, inputIndex });
        return destination;
    }

    disconnect(destination) {
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
    constructor(context) {
        this.context = context;
        this.type = 'lowpass';
        this.frequency = new MockAudioParam(350);
        this.Q = new MockAudioParam(1);
        this.gain = new MockAudioParam(0);
        this.detune = new MockAudioParam(0);
        this._connections = [];
    }

    connect(destination, outputIndex, inputIndex) {
        this._connections.push({ destination, outputIndex, inputIndex });
        return destination;
    }

    disconnect(destination) {
        if (destination) {
            this._connections = this._connections.filter(c => c.destination !== destination);
        } else {
            this._connections = [];
        }
    }

    getFrequencyResponse(frequencyArray, magResponseOutput, phaseResponseOutput) {
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
    constructor(context) {
        this.context = context;
        this.type = 'sine';
        this.frequency = new MockAudioParam(440);
        this.detune = new MockAudioParam(0);
        this._connections = [];
        this._started = false;
        this._stopped = false;
    }

    connect(destination, outputIndex, inputIndex) {
        this._connections.push({ destination, outputIndex, inputIndex });
        return destination;
    }

    disconnect(destination) {
        if (destination) {
            this._connections = this._connections.filter(c => c.destination !== destination);
        } else {
            this._connections = [];
        }
    }

    start(when) {
        this._started = true;
        this._startTime = when;
    }

    stop(when) {
        this._stopped = true;
        this._stopTime = when;
    }
}

/**
 * Mock DelayNode
 */
export class MockDelayNode {
    constructor(context, maxDelayTime = 1) {
        this.context = context;
        this.delayTime = new MockAudioParam(0);
        this._maxDelayTime = maxDelayTime;
        this._connections = [];
    }

    connect(destination, outputIndex, inputIndex) {
        this._connections.push({ destination, outputIndex, inputIndex });
        return destination;
    }

    disconnect(destination) {
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
    constructor(context) {
        this.context = context;
        this.threshold = new MockAudioParam(-24);
        this.knee = new MockAudioParam(30);
        this.ratio = new MockAudioParam(12);
        this.attack = new MockAudioParam(0.003);
        this.release = new MockAudioParam(0.25);
        this.reduction = new MockAudioParam(0);
        this._connections = [];
    }

    connect(destination, outputIndex, inputIndex) {
        this._connections.push({ destination, outputIndex, inputIndex });
        return destination;
    }

    disconnect(destination) {
        if (destination) {
            this._connections = this._connections.filter(c => c.destination !== destination);
        } else {
            this._connections = [];
        }
    }
}

/**
 * Mock AudioDestinationNode
 */
export class MockAudioDestinationNode {
    constructor(context) {
        this.context = context;
        this.maxChannelCount = 2;
        this.numberOfInputs = 1;
        this.numberOfOutputs = 0;
    }
}

/**
 * Mock AudioContext
 */
export class MockAudioContext {
    constructor() {
        this.state = 'running';
        this.sampleRate = 44100;
        this.currentTime = 0;
        this.destination = new MockAudioDestinationNode(this);
        this._nodes = [];
    }

    createGain() {
        const node = new MockGainNode(this);
        this._nodes.push(node);
        return node;
    }

    createBiquadFilter() {
        const node = new MockBiquadFilterNode(this);
        this._nodes.push(node);
        return node;
    }

    createOscillator() {
        const node = new MockOscillatorNode(this);
        this._nodes.push(node);
        return node;
    }

    createDelay(maxDelayTime) {
        const node = new MockDelayNode(this, maxDelayTime);
        this._nodes.push(node);
        return node;
    }

    createDynamicsCompressor() {
        const node = new MockDynamicsCompressorNode(this);
        this._nodes.push(node);
        return node;
    }

    resume() {
        this.state = 'running';
        return Promise.resolve();
    }

    suspend() {
        this.state = 'suspended';
        return Promise.resolve();
    }

    close() {
        this.state = 'closed';
        return Promise.resolve();
    }
}

/**
 * Create a fresh mock AudioContext for testing
 */
export function createMockAudioContext() {
    return new MockAudioContext();
}
