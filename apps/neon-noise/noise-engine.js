export class NoiseEngine {
    constructor() {
        this.context = null;
        this.isRunning = false;
        this.isFading = false; // Track if currently fading in/out
        this.masterGain = null;
        this.analyser = null;
        this.micAnalyser = null;
        this.micStream = null;
        this.isAdaptive = false;
        this.sensitivity = 0.4;
        this.fadeDuration = 5.0; // Fade duration in seconds
        this.channels = {
            white: { gain: null, node: null },
            pink: { gain: null, node: null },
            brown: { gain: null, node: null },
            green: { gain: null, node: null }
        };
        this.volumes = {
            white: 0.5,
            pink: 0.5,
            brown: 0.5,
            green: 0.5,
            master: 0.7
        };
    }

    async start() {
        if (!this.context) {
            this.context = new (window.AudioContext || window.webkitAudioContext)();
            this.setupNodes();
        }
        if (this.context.state === 'suspended') {
            await this.context.resume();
        }

        this.isRunning = true;
        this.isFading = true;

        // Manually animate fade-in so visualizer shows the ramp
        // Use ease-in curve (cubic) for more gradual perceived volume increase
        const startTime = performance.now();
        const duration = this.fadeDuration * 1000;
        const targetVolume = this.volumes.master;
        this.masterGain.gain.value = 0;

        return new Promise(resolve => {
            const animate = () => {
                const elapsed = performance.now() - startTime;
                const linearProgress = Math.min(elapsed / duration, 1);
                // Cubic ease-in: starts very slow, accelerates
                const easedProgress = linearProgress * linearProgress * linearProgress;
                this.masterGain.gain.value = targetVolume * easedProgress;

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

    async toggleAdaptive() {
        if (this.isAdaptive) {
            this.isAdaptive = false;
            // Reset volumes to their slider values
            Object.keys(this.channels).forEach(type => {
                this.setChannelVolume(type, this.volumes[type]);
            });
            return false;
        } else {
            if (!this.micStream) {
                try {
                    this.micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
                    const micSource = this.context.createMediaStreamSource(this.micStream);
                    this.micAnalyser = this.context.createAnalyser();
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

    async stop() {
        this.isRunning = false;
        this.isFading = true;

        if (this.context && this.masterGain) {
            // Manually animate fade-out so visualizer shows the ramp
            const startTime = performance.now();
            const duration = this.fadeDuration * 1000;
            const startVolume = this.masterGain.gain.value;

            await new Promise(resolve => {
                const animate = () => {
                    const elapsed = performance.now() - startTime;
                    const progress = Math.min(elapsed / duration, 1);
                    this.masterGain.gain.value = startVolume * (1 - progress);

                    if (progress < 1 && !this.isRunning) {
                        requestAnimationFrame(animate);
                    } else {
                        this.isFading = false;
                        resolve();
                    }
                };
                requestAnimationFrame(animate);
            });

            // Only suspend if still stopped (user might have restarted during fade)
            if (!this.isRunning) {
                this.context.suspend();
            }
        }
    }

    // Instantly stop without fade (for cancelling during fade)
    instantStop() {
        this.isRunning = false;
        this.isFading = false;
        if (this.context && this.masterGain) {
            this.masterGain.gain.value = 0;
            this.context.suspend();
        }
    }

    setupNodes() {
        this.masterGain = this.context.createGain();
        this.masterGain.gain.value = 0; // Start silent, fade-in will ramp up
        
        this.analyser = this.context.createAnalyser();
        this.analyser.fftSize = 256;
        this.analyser.smoothingTimeConstant = 0.8;
        
        this.masterGain.connect(this.analyser);
        this.analyser.connect(this.context.destination);

        // Create each noise source
        Object.keys(this.channels).forEach(type => {
            const gain = this.context.createGain();
            gain.gain.value = this.volumes[type];
            gain.connect(this.masterGain);
            
            const node = this.createNoiseNode(type);
            node.connect(gain);
            
            this.channels[type].gain = gain;
            this.channels[type].node = node;
        });
    }

    createNoiseNode(type) {
        const bufferSize = 2 * this.context.sampleRate;
        const noiseBuffer = this.context.createBuffer(1, bufferSize, this.context.sampleRate);
        const output = noiseBuffer.getChannelData(0);

        if (type === 'white') {
            for (let i = 0; i < bufferSize; i++) {
                output[i] = Math.random() * 2 - 1;
            }
        } else if (type === 'pink') {
            let b0, b1, b2, b3, b4, b5, b6;
            b0 = b1 = b2 = b3 = b4 = b5 = b6 = 0.0;
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
                let out = (lastOut + (0.02 * white)) / 1.02;
                output[i] = out * 3.5;
                lastOut = out;
            }
        } else if (type === 'green') {
            // Use white noise as base for green (filtered later)
            for (let i = 0; i < bufferSize; i++) {
                output[i] = Math.random() * 2 - 1;
            }
        }

        const source = this.context.createBufferSource();
        source.buffer = noiseBuffer;
        source.loop = true;
        source.start(0);

        if (type === 'green') {
            const filter = this.context.createBiquadFilter();
            filter.type = 'bandpass';
            filter.frequency.value = 1000;
            filter.Q.value = 1.5;
            source.connect(filter);
            return filter;
        }

        return source;
    }

    setMasterVolume(val) {
        this.volumes.master = val;
        // Don't change gain directly while fading - the fade animation handles it
        if (this.masterGain && !this.isFading) {
            this.masterGain.gain.setTargetAtTime(val, this.context.currentTime, 0.03);
        }
    }

    setChannelVolume(type, val) {
        this.volumes[type] = val;
        if (this.channels[type] && this.channels[type].gain) {
            this.channels[type].gain.gain.setTargetAtTime(val, this.context.currentTime, 0.03);
        }
    }

    getAnalyserData(array) {
        if (this.analyser) {
            this.analyser.getByteFrequencyData(array);
        }
    }

    getMicAnalyserData(array) {
        if (this.micAnalyser) {
            this.micAnalyser.getByteFrequencyData(array);
        }
    }

    setSensitivity(val) {
        this.sensitivity = val;
    }

    updateAdaptive() {
        if (!this.isAdaptive || !this.micAnalyser) return;

        const dataArray = new Uint8Array(this.micAnalyser.frequencyBinCount);
        this.micAnalyser.getByteFrequencyData(dataArray);

        // Map frequency bins to noise types (approximate)
        // Bin size = sampleRate / fftSize = 44100 / 512 = ~86Hz
        const getRangeEnergy = (startBin, endBin) => {
            let sum = 0;
            for (let i = startBin; i <= endBin; i++) {
                sum += dataArray[i];
            }
            return sum / (endBin - startBin + 1) / 255;
        };

        // Energy levels (0 to 1)
        const energies = {
            brown: getRangeEnergy(0, 4),      // 0 - 344Hz
            pink: getRangeEnergy(5, 15),     // 430 - 1290Hz
            green: getRangeEnergy(16, 50),    // 1376 - 4300Hz
            white: getRangeEnergy(51, 150)    // 4386 - 12900Hz
        };

        Object.keys(energies).forEach(type => {
            const boost = energies[type] * this.sensitivity;
            const targetVal = Math.min(1.0, this.volumes[type] + boost);
            if (this.channels[type] && this.channels[type].gain) {
                this.channels[type].gain.gain.setTargetAtTime(targetVal, this.context.currentTime, 0.1);
            }
        });
    }

    serialize() {
        return {
            volumes: { ...this.volumes },
            sensitivity: this.sensitivity,
            name: this.name || '',
            description: this.description || ''
        };
    }

    deserialize(data) {
        if (data.volumes) {
            Object.keys(data.volumes).forEach(key => {
                if (key === 'master') {
                    this.setMasterVolume(data.volumes[key]);
                } else if (this.channels[key]) {
                    this.setChannelVolume(key, data.volumes[key]);
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