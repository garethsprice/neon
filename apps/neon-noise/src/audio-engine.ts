/**
 * AudioEngine - Multi-channel noise generator
 */

type NoiseType = 'white' | 'pink' | 'brown' | 'green';

interface NoiseChannel {
  gain: GainNode | null;
  node: AudioNode | null;
}

interface Volumes {
  white: number;
  pink: number;
  brown: number;
  green: number;
  master: number;
}

interface SerializedEngine {
  volumes: Volumes;
  sensitivity: number;
  name?: string;
  description?: string;
}

export class AudioEngine {
  context: AudioContext | null = null;
  isRunning = false;
  isFading = false;
  masterGain: GainNode | null = null;
  analyser: AnalyserNode | null = null;
  micAnalyser: AnalyserNode | null = null;
  micStream: MediaStream | null = null;
  isAdaptive = false;
  sensitivity = 0.4;
  fadeDuration = 5.0;
  name?: string;
  description?: string;

  channels: Record<NoiseType, NoiseChannel> = {
    white: { gain: null, node: null },
    pink: { gain: null, node: null },
    brown: { gain: null, node: null },
    green: { gain: null, node: null }
  };

  volumes: Volumes = {
    white: 0.5,
    pink: 0.5,
    brown: 0.5,
    green: 0.5,
    master: 0.7
  };

  async start(): Promise<void> {
    if (!this.context) {
      this.context = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
      this.setupNodes();
    }
    if (this.context.state === 'suspended') {
      await this.context.resume();
    }

    this.isRunning = true;
    this.isFading = true;

    const startTime = performance.now();
    const duration = this.fadeDuration * 1000;
    const targetVolume = this.volumes.master;
    this.masterGain!.gain.value = 0;

    return new Promise(resolve => {
      const animate = (): void => {
        const elapsed = performance.now() - startTime;
        const linearProgress = Math.min(elapsed / duration, 1);
        const easedProgress = linearProgress * linearProgress * linearProgress;
        this.masterGain!.gain.value = targetVolume * easedProgress;

        if (linearProgress < 1 && this.isRunning) {
          requestAnimationFrame(animate);
        } else {
          this.isFading = false;
          resolve();
        }
      };
      requestAnimationFrame(animate);
    });
  }

  async toggleAdaptive(): Promise<boolean> {
    if (this.isAdaptive) {
      this.isAdaptive = false;
      (Object.keys(this.channels) as NoiseType[]).forEach(type => {
        this.setChannelVolume(type, this.volumes[type]);
      });
      return false;
    } else {
      if (!this.micStream) {
        try {
          this.micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
          const micSource = this.context!.createMediaStreamSource(this.micStream);
          this.micAnalyser = this.context!.createAnalyser();
          this.micAnalyser.fftSize = 512;
          micSource.connect(this.micAnalyser);
        } catch (e) {
          console.error("Mic access denied", e);
          return false;
        }
      }
      this.isAdaptive = true;
      return true;
    }
  }

  async stop(): Promise<void> {
    this.isRunning = false;
    this.isFading = true;

    if (this.context && this.masterGain) {
      const startTime = performance.now();
      const duration = this.fadeDuration * 1000;
      const startVolume = this.masterGain.gain.value;

      await new Promise<void>(resolve => {
        const animate = (): void => {
          const elapsed = performance.now() - startTime;
          const progress = Math.min(elapsed / duration, 1);
          this.masterGain!.gain.value = startVolume * (1 - progress);

          if (progress < 1 && !this.isRunning) {
            requestAnimationFrame(animate);
          } else {
            this.isFading = false;
            resolve();
          }
        };
        requestAnimationFrame(animate);
      });

      if (!this.isRunning) {
        this.context.suspend();
      }
    }
  }

  instantStop(): void {
    this.isRunning = false;
    this.isFading = false;
    if (this.context && this.masterGain) {
      this.masterGain.gain.value = 0;
      this.context.suspend();
    }
  }

  setupNodes(): void {
    this.masterGain = this.context!.createGain();
    this.masterGain.gain.value = 0;

    this.analyser = this.context!.createAnalyser();
    this.analyser.fftSize = 256;
    this.analyser.smoothingTimeConstant = 0.8;

    this.masterGain.connect(this.analyser);
    this.analyser.connect(this.context!.destination);

    (Object.keys(this.channels) as NoiseType[]).forEach(type => {
      const gain = this.context!.createGain();
      gain.gain.value = this.volumes[type];
      gain.connect(this.masterGain!);

      const node = this.createNoiseNode(type);
      node.connect(gain);

      this.channels[type].gain = gain;
      this.channels[type].node = node;
    });
  }

  createNoiseNode(type: NoiseType): AudioNode {
    const bufferSize = 2 * this.context!.sampleRate;
    const noiseBuffer = this.context!.createBuffer(1, bufferSize, this.context!.sampleRate);
    const output = noiseBuffer.getChannelData(0);

    if (type === 'white') {
      for (let i = 0; i < bufferSize; i++) {
        output[i] = Math.random() * 2 - 1;
      }
    } else if (type === 'pink') {
      let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
      for (let i = 0; i < bufferSize; i++) {
        const white = Math.random() * 2 - 1;
        b0 = 0.99886 * b0 + white * 0.0555179;
        b1 = 0.99332 * b1 + white * 0.0750759;
        b2 = 0.96900 * b2 + white * 0.1538520;
        b3 = 0.86650 * b3 + white * 0.3104856;
        b4 = 0.55000 * b4 + white * 0.5329522;
        b5 = -0.7616 * b5 - white * 0.0168980;
        output[i] = b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362;
        output[i] *= 0.11;
        b6 = white * 0.115926;
      }
    } else if (type === 'brown') {
      let lastOut = 0.0;
      for (let i = 0; i < bufferSize; i++) {
        const white = Math.random() * 2 - 1;
        const out = (lastOut + (0.02 * white)) / 1.02;
        output[i] = out * 3.5;
        lastOut = out;
      }
    } else if (type === 'green') {
      for (let i = 0; i < bufferSize; i++) {
        output[i] = Math.random() * 2 - 1;
      }
    }

    const source = this.context!.createBufferSource();
    source.buffer = noiseBuffer;
    source.loop = true;
    source.start(0);

    if (type === 'green') {
      const filter = this.context!.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.value = 1000;
      filter.Q.value = 1.5;
      source.connect(filter);
      return filter;
    }

    return source;
  }

  setMasterVolume(val: number): void {
    this.volumes.master = val;
    if (this.masterGain && !this.isFading) {
      this.masterGain.gain.setTargetAtTime(val, this.context!.currentTime, 0.03);
    }
  }

  setChannelVolume(type: NoiseType, val: number): void {
    this.volumes[type] = val;
    if (this.channels[type] && this.channels[type].gain) {
      this.channels[type].gain!.gain.setTargetAtTime(val, this.context!.currentTime, 0.03);
    }
  }

  getAnalyserData(array: Uint8Array<ArrayBuffer>): void {
    if (this.analyser) {
      this.analyser.getByteFrequencyData(array);
    }
  }

  getMicAnalyserData(array: Uint8Array<ArrayBuffer>): void {
    if (this.micAnalyser) {
      this.micAnalyser.getByteFrequencyData(array);
    }
  }

  setSensitivity(val: number): void {
    this.sensitivity = val;
  }

  updateAdaptive(): void {
    if (!this.isAdaptive || !this.micAnalyser) return;

    const dataArray = new Uint8Array(this.micAnalyser.frequencyBinCount);
    this.micAnalyser.getByteFrequencyData(dataArray);

    const getRangeEnergy = (startBin: number, endBin: number): number => {
      let sum = 0;
      for (let i = startBin; i <= endBin; i++) {
        sum += dataArray[i];
      }
      return sum / (endBin - startBin + 1) / 255;
    };

    const energies: Record<NoiseType, number> = {
      brown: getRangeEnergy(0, 4),
      pink: getRangeEnergy(5, 15),
      green: getRangeEnergy(16, 50),
      white: getRangeEnergy(51, 150)
    };

    (Object.keys(energies) as NoiseType[]).forEach(type => {
      const boost = energies[type] * this.sensitivity;
      const targetVal = Math.min(1.0, this.volumes[type] + boost);
      if (this.channels[type] && this.channels[type].gain) {
        this.channels[type].gain!.gain.setTargetAtTime(targetVal, this.context!.currentTime, 0.1);
      }
    });
  }

  serialize(): SerializedEngine {
    return {
      volumes: { ...this.volumes },
      sensitivity: this.sensitivity,
      name: this.name || '',
      description: this.description || ''
    };
  }

  deserialize(data: Partial<SerializedEngine>): void {
    if (data.volumes) {
      (Object.keys(data.volumes) as (keyof Volumes)[]).forEach(key => {
        if (key === 'master') {
          this.setMasterVolume(data.volumes![key]);
        } else if (this.channels[key]) {
          this.setChannelVolume(key, data.volumes![key]);
        }
      });
    }
    if (typeof data.sensitivity === 'number') {
      this.sensitivity = data.sensitivity;
    }
    if (data.name) {
      this.name = data.name;
    }
    if (data.description) {
      this.description = data.description;
    }
  }
}
