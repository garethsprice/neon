/**
 * @neon/fx Playground
 * Audio effects demonstration with Oscillator, Envelope, LFO, and full effect chain
 */

import {
  LowpassFilter,
  Saturation,
  Bitcrusher,
  Distortion,
  Compressor,
  Limiter,
  Delay,
  Reverb,
  Phaser,
  Flanger,
  StereoPanner,
  SpatialPanner,
  Oscillator,
  Envelope,
  LFO,
  LFO_PRESETS,
  OSCILLATOR_PRESETS,
  ENVELOPE_PRESETS,
  type WaveformType,
  type LFOWaveform,
  type DistortionType
} from '@neon/fx';

import { createKeyboard, type KeyboardComponent } from '@neon/ui';

import { ALL_PRESETS, getPresetById, type SoundPreset, type SequenceNote } from './presets/index';

let audioContext: AudioContext | null = null;
let sourceNode: OscillatorNode | AudioBufferSourceNode | null = null;

// Effect chain
let filter: LowpassFilter | null = null;
let saturation: Saturation | null = null;
let bitcrusher: Bitcrusher | null = null;
let distortion: Distortion | null = null;
let compressor: Compressor | null = null;
let delay: Delay | null = null;
let reverb: Reverb | null = null;
let phaser: Phaser | null = null;
let flanger: Flanger | null = null;
let panner: StereoPanner | null = null;
let spatialPanner: SpatialPanner | null = null;
let limiter: Limiter | null = null;
let analyser: AnalyserNode | null = null;

// Synth components
let oscillator: Oscillator | null = null;
let envelope: Envelope | null = null;

// Keyboard component
let keyboardComponent: KeyboardComponent | null = null;

// LFO
let lfo: LFO | null = null;
let lfoEnabled = false;
let lfoTarget = 'none';

let isPlaying = false;

const statusEl = document.getElementById('status')!;
const canvas = document.getElementById('waveform') as HTMLCanvasElement;
const ctx = canvas.getContext('2d')!;

// Note tracking for keyboard
const activeNotes = new Set<number>();

// Keyboard mapping: computer key -> note number (MIDI-style, relative to C4)
const keyMap: Record<string, number> = {
  'a': 60, // C4
  'w': 61, // C#4
  's': 62, // D4
  'e': 63, // D#4
  'd': 64, // E4
  'f': 65, // F4
  't': 66, // F#4
  'g': 67, // G4
  'y': 68, // G#4
  'h': 69, // A4
  'u': 70, // A#4
  'j': 71, // B4
  'k': 72, // C5
  'o': 73, // C#5
  'l': 74, // D5
  'p': 75, // D#5
  ';': 76, // E5
};

// Note frequencies (A4 = 440Hz)
function midiToFreq(midi: number): number {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

function log(message: string): void {
  statusEl.textContent = message;
  console.log(message);
}

function updateActiveNotesDisplay(): void {
  const el = document.getElementById('active-notes');
  if (el) {
    el.textContent = `Active: ${activeNotes.size}`;
  }
}

// Effect presets
const EFFECT_PRESETS = {
  delay: {
    default: { time: 300, feedback: 40, damping: 0, mix: 30 },
    pingpong: { time: 250, feedback: 50, damping: 20, mix: 35 },
    slapback: { time: 80, feedback: 10, damping: 30, mix: 40 }
  },
  reverb: {
    default: { decay: 2, damping: 50, preDelay: 10, mix: 30 },
    plate: { decay: 1.5, damping: 30, preDelay: 5, mix: 35 },
    hall: { decay: 3, damping: 60, preDelay: 20, mix: 25 },
    room: { decay: 0.5, damping: 70, preDelay: 2, mix: 20 }
  },
  phaser: {
    default: { rate: 0.5, depth: 70, feedback: 40, stages: 4, baseFreq: 1000, mix: 50 },
    vintage: { rate: 0.3, depth: 80, feedback: 60, stages: 6, baseFreq: 800, mix: 50 }
  },
  flanger: {
    default: { rate: 0.3, depth: 70, feedback: 50, delay: 5, mix: 50 },
    jet: { rate: 0.15, depth: 90, feedback: 80, delay: 3, mix: 60 },
    subtle: { rate: 0.5, depth: 40, feedback: 20, delay: 7, mix: 35 }
  },
  bitcrusher: {
    retro: { bits: 8, downsample: 4, mix: 100 },
    lofi: { bits: 4, downsample: 8, mix: 80 },
    telephone: { bits: 6, downsample: 3, mix: 100 }
  },
  distortion: {
    overdrive: { drive: 40, tone: 60, level: 60, mix: 100 },
    fuzz: { drive: 70, tone: 40, level: 50, mix: 100 },
    crunch: { drive: 50, tone: 50, level: 55, mix: 100 },
    heavy: { drive: 80, tone: 45, level: 45, mix: 100 }
  }
};

async function initAudio(): Promise<void> {
  if (audioContext) {
    log('Audio already initialized');
    return;
  }

  audioContext = new AudioContext();
  analyser = audioContext.createAnalyser();
  analyser.fftSize = 2048;

  // Create synth components
  oscillator = new Oscillator(audioContext, {
    waveform: 'sawtooth',
    detune: 0,
    gain: 0.8
  });

  envelope = new Envelope(audioContext, {
    attack: 0.01,
    decay: 0.1,
    sustain: 0.7,
    release: 0.3
  });

  // Create LFO (starts disabled)
  lfo = new LFO(audioContext, {
    rate: 1,
    depth: 50,
    waveform: 'sine',
    autoStart: true
  });

  // Create effect chain (all bypassed by default)
  filter = new LowpassFilter(audioContext, { cutoff: 5000, resonance: 1 });
  filter.bypassed = true;

  saturation = new Saturation(audioContext, { drive: 20, mix: 100 });
  saturation.bypassed = true;

  bitcrusher = new Bitcrusher(audioContext, { bits: 8, downsample: 1, mix: 100 });
  bitcrusher.bypassed = true;

  distortion = new Distortion(audioContext, { drive: 50, tone: 50, level: 50, mix: 100, type: 'overdrive' });
  distortion.bypassed = true;

  compressor = new Compressor(audioContext, { threshold: -24, ratio: 4, attack: 10, release: 100 });
  compressor.bypassed = true;

  delay = new Delay(audioContext, { time: 300, feedback: 40, mix: 30, damping: 0 });
  delay.bypassed = true;

  reverb = new Reverb(audioContext, { decay: 2, damping: 50, mix: 30, preDelay: 10 });
  reverb.bypassed = true;

  phaser = new Phaser(audioContext, { rate: 0.5, depth: 70, feedback: 40, stages: 4, baseFreq: 1000, mix: 50 });
  phaser.bypassed = true;

  flanger = new Flanger(audioContext, { rate: 0.3, depth: 70, feedback: 50, delay: 5, mix: 50 });
  flanger.bypassed = true;

  panner = new StereoPanner(audioContext, { pan: 0 });

  spatialPanner = new SpatialPanner(audioContext, {
    positionX: 0,
    positionY: 0,
    positionZ: 0,
    distanceModel: 'inverse',
    panningModel: 'HRTF',
    refDistance: 1,
    maxDistance: 100,
    rolloffFactor: 1
  });
  spatialPanner.bypassed = true;

  // Limiter at the end to prevent clipping (always enabled)
  limiter = new Limiter(audioContext, { threshold: -3, release: 100 });

  // Connect synth chain: oscillator -> envelope -> filter -> ... -> panner -> spatialPanner -> limiter -> output
  oscillator.connect(envelope);
  envelope.connect(filter);
  filter.connect(saturation);
  saturation.connect(bitcrusher);
  bitcrusher.connect(distortion);
  distortion.connect(compressor);
  compressor.connect(delay);
  delay.connect(reverb);
  reverb.connect(phaser);
  phaser.connect(flanger);
  flanger.connect(panner);
  panner.connect(spatialPanner);
  spatialPanner.connect(limiter);
  limiter.output.connect(analyser);
  analyser.connect(audioContext.destination);

  // Build keyboard UI using neon-ui component
  const keyboardContainer = document.getElementById('keyboard');
  if (keyboardContainer) {
    keyboardContainer.innerHTML = '';
    keyboardComponent = createKeyboard({
      numKeys: 88,
      rootNote: 9,  // A (piano starts at A0)
      octave: 0,
      size: 'medium',
      showLabels: true,
      onNoteOn: (keyIndex: number) => {
        const midiNote = 21 + keyIndex;  // A0 = MIDI 21
        playNote(midiNote);
      },
      onNoteOff: (keyIndex: number) => {
        const midiNote = 21 + keyIndex;
        stopNote(midiNote);
      }
    });
    keyboardContainer.appendChild(keyboardComponent.element);

    // Scroll to middle C (C4 = MIDI 60, keyIndex 39)
    setTimeout(() => {
      const scrollPos = 39 * 36 - keyboardComponent!.scrollContainer.clientWidth / 2;
      keyboardComponent!.scrollContainer.scrollLeft = Math.max(0, scrollPos);
    }, 0);
  }

  // Update UI to show bypassed state
  updateBypassedUI();

  // Start visualization
  visualize();

  log('Audio initialized. Use keyboard or click keys to play. All effects bypassed by default.');
}

function updateBypassedUI(): void {
  const effects = [
    { name: 'filter', fx: filter },
    { name: 'saturation', fx: saturation },
    { name: 'bitcrusher', fx: bitcrusher },
    { name: 'distortion', fx: distortion },
    { name: 'compressor', fx: compressor },
    { name: 'delay', fx: delay },
    { name: 'reverb', fx: reverb },
    { name: 'phaser', fx: phaser },
    { name: 'flanger', fx: flanger },
    { name: 'limiter', fx: limiter }
  ];

  effects.forEach(({ name, fx }) => {
    if (fx) {
      const module = document.getElementById(`${name}-module`);
      const btn = document.querySelector(`.fx-bypass[data-fx="${name}"]`);
      module?.classList.toggle('bypassed', fx.bypassed);
      btn?.classList.toggle('active', fx.bypassed);
    }
  });

  // Update LFO enable button
  const lfoBtn = document.getElementById('lfo-enable');
  lfoBtn?.classList.toggle('lfo-enabled', lfoEnabled);
  if (lfoBtn) {
    lfoBtn.textContent = lfoEnabled ? 'Enabled' : 'Enable';
  }
}

function connectLfoToTarget(): void {
  if (!lfo || !audioContext) return;

  // Disconnect from previous target
  lfo.disconnect();

  if (!lfoEnabled || lfoTarget === 'none') {
    return;
  }

  // Calculate depth based on target
  const depthValue = parseFloat((document.getElementById('lfo-depth') as HTMLInputElement).value);

  switch (lfoTarget) {
    case 'filter-cutoff':
      if (filter) {
        // Scale depth for filter cutoff (0-100 -> 0-2000 Hz modulation)
        lfo.setDepth(depthValue * 20, 0);
        lfo.connect((filter as unknown as { _filter: BiquadFilterNode })._filter?.frequency || filter.input);
      }
      break;
    case 'filter-resonance':
      if (filter) {
        lfo.setDepth(depthValue / 10, 0);
        lfo.connect((filter as unknown as { _filter: BiquadFilterNode })._filter?.Q || filter.input);
      }
      break;
    case 'osc-detune':
      if (oscillator) {
        // Modulate detune (0-100 -> 0-50 cents)
        lfo.setDepth(depthValue / 2, 0);
        // Note: Oscillator doesn't expose detune AudioParam directly in our implementation
        // This would need the oscillator to expose its internal nodes
      }
      break;
    case 'delay-time':
      if (delay) {
        // Small modulation for delay time (0-100 -> 0-0.01s)
        lfo.setDepth(depthValue / 10000, 0);
        lfo.connect((delay as unknown as { _delay: DelayNode })._delay?.delayTime);
      }
      break;
    case 'delay-feedback':
      if (delay) {
        lfo.setDepth(depthValue / 200, 0);
        lfo.connect((delay as unknown as { _feedbackGain: GainNode })._feedbackGain?.gain);
      }
      break;
    case 'panner-pan':
      if (panner) {
        // Modulate pan position (0-100 -> 0-1 range, full stereo sweep)
        lfo.setDepth(depthValue / 100, 0);
        lfo.connect((panner as unknown as { _panner: StereoPannerNode })._panner?.pan);
      }
      break;
    case 'spatial-x':
      if (spatialPanner) {
        // Modulate X position (0-100 -> 0-10 meters range)
        lfo.setDepth(depthValue / 10, 0);
        lfo.connect(spatialPanner.positionXParam);
      }
      break;
    case 'spatial-y':
      if (spatialPanner) {
        // Modulate Y position
        lfo.setDepth(depthValue / 10, 0);
        lfo.connect(spatialPanner.positionYParam);
      }
      break;
    case 'spatial-z':
      if (spatialPanner) {
        // Modulate Z position
        lfo.setDepth(depthValue / 10, 0);
        lfo.connect(spatialPanner.positionZParam);
      }
      break;
  }

  log(`LFO connected to ${lfoTarget}`);
}

function playNote(note: number): void {
  if (!audioContext || !oscillator || !envelope) {
    log('Initialize audio first!');
    return;
  }

  if (activeNotes.has(note)) return;

  const freq = midiToFreq(note);
  oscillator.start(note, freq);
  envelope.noteOn(note);

  activeNotes.add(note);
  updateActiveNotesDisplay();

  // Update UI via keyboard component
  if (keyboardComponent && note >= 21 && note <= 108) {
    keyboardComponent.setKeyVisualState(note - 21, true);
  }

  log(`Note ON: ${note} (${freq.toFixed(1)} Hz)`);
}

function stopNote(note: number): void {
  if (!oscillator || !envelope) return;
  if (!activeNotes.has(note)) return;

  envelope.noteOff(note);
  oscillator.stopAfter(note, envelope.release + 0.05);

  activeNotes.delete(note);
  updateActiveNotesDisplay();

  // Update UI via keyboard component
  if (keyboardComponent && note >= 21 && note <= 108) {
    keyboardComponent.setKeyVisualState(note - 21, false);
  }

  log(`Note OFF: ${note}`);
}

// Keyboard event handlers
document.addEventListener('keydown', (e) => {
  if (e.repeat) return;
  const note = keyMap[e.key.toLowerCase()];
  if (note !== undefined) {
    e.preventDefault();
    playNote(note);
  }
});

document.addEventListener('keyup', (e) => {
  const note = keyMap[e.key.toLowerCase()];
  if (note !== undefined) {
    e.preventDefault();
    stopNote(note);
  }
});

function playTone(): void {
  if (!audioContext || !filter) {
    log('Initialize audio first!');
    return;
  }

  stopAudio();

  const osc = audioContext.createOscillator();
  osc.type = 'sawtooth';
  osc.frequency.value = 220;

  // Add slight vibrato
  const vibratoLfo = audioContext.createOscillator();
  const lfoGain = audioContext.createGain();
  vibratoLfo.frequency.value = 5;
  lfoGain.gain.value = 3;
  vibratoLfo.connect(lfoGain);
  lfoGain.connect(osc.frequency);
  vibratoLfo.start();

  osc.connect(filter.input);
  osc.start();

  sourceNode = osc;
  isPlaying = true;
  log('Playing sawtooth tone at 220 Hz (bypasses synth engine)');
}

function playNoise(): void {
  if (!audioContext || !filter) {
    log('Initialize audio first!');
    return;
  }

  stopAudio();

  // Generate white noise
  const bufferSize = audioContext.sampleRate * 2;
  const buffer = audioContext.createBuffer(1, bufferSize, audioContext.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) {
    data[i] = Math.random() * 2 - 1;
  }

  const noise = audioContext.createBufferSource();
  noise.buffer = buffer;
  noise.loop = true;

  const gain = audioContext.createGain();
  gain.gain.value = 0.3;

  noise.connect(gain);
  gain.connect(filter.input);
  noise.start();

  sourceNode = noise;
  isPlaying = true;
  log('Playing white noise (bypasses synth engine)');
}

function stopAudio(): void {
  if (sourceNode) {
    try {
      sourceNode.stop();
    } catch {
      // Already stopped
    }
    sourceNode.disconnect();
    sourceNode = null;
  }
  isPlaying = false;
  log('Audio stopped');
}

function visualize(): void {
  if (!analyser) return;

  const bufferLength = analyser.frequencyBinCount;
  const dataArray = new Uint8Array(bufferLength);

  // Set canvas size
  canvas.width = canvas.offsetWidth * window.devicePixelRatio;
  canvas.height = canvas.offsetHeight * window.devicePixelRatio;
  ctx.scale(window.devicePixelRatio, window.devicePixelRatio);

  const width = canvas.offsetWidth;
  const height = canvas.offsetHeight;

  function draw() {
    requestAnimationFrame(draw);

    if (!analyser) return;

    analyser.getByteTimeDomainData(dataArray);

    ctx.fillStyle = 'rgba(10, 10, 15, 0.3)';
    ctx.fillRect(0, 0, width, height);

    ctx.lineWidth = 2;
    ctx.strokeStyle = '#00ffff';
    ctx.beginPath();

    const sliceWidth = width / bufferLength;
    let x = 0;

    for (let i = 0; i < bufferLength; i++) {
      const v = dataArray[i] / 128.0;
      const y = (v * height) / 2;

      if (i === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }

      x += sliceWidth;
    }

    ctx.lineTo(width, height / 2);
    ctx.stroke();
  }

  draw();
}

// Apply a full sound preset (oscillator, envelope, all effects)
function applySoundPreset(preset: SoundPreset): void {
  if (!audioContext || !oscillator || !envelope) {
    log('Initialize audio first!');
    return;
  }

  // Apply oscillator settings
  oscillator.waveform = preset.oscillator.waveform;
  oscillator.detune = preset.oscillator.detune;
  oscillator.gain = preset.oscillator.gain / 100;

  // Update oscillator UI
  (document.getElementById('osc-waveform') as HTMLSelectElement).value = preset.oscillator.waveform;
  (document.getElementById('osc-detune') as HTMLInputElement).value = String(preset.oscillator.detune);
  (document.getElementById('osc-gain') as HTMLInputElement).value = String(preset.oscillator.gain);
  document.getElementById('osc-detune-value')!.textContent = `${preset.oscillator.detune} ct`;
  document.getElementById('osc-gain-value')!.textContent = `${preset.oscillator.gain}%`;

  // Apply envelope settings
  envelope.attack = preset.envelope.attack;
  envelope.decay = preset.envelope.decay;
  envelope.sustain = preset.envelope.sustain;
  envelope.release = preset.envelope.release;

  // Update envelope UI
  (document.getElementById('env-attack') as HTMLInputElement).value = String(preset.envelope.attack * 1000);
  (document.getElementById('env-decay') as HTMLInputElement).value = String(preset.envelope.decay * 1000);
  (document.getElementById('env-sustain') as HTMLInputElement).value = String(preset.envelope.sustain * 100);
  (document.getElementById('env-release') as HTMLInputElement).value = String(preset.envelope.release * 1000);
  document.getElementById('env-attack-value')!.textContent = `${Math.round(preset.envelope.attack * 1000)} ms`;
  document.getElementById('env-decay-value')!.textContent = `${Math.round(preset.envelope.decay * 1000)} ms`;
  document.getElementById('env-sustain-value')!.textContent = `${Math.round(preset.envelope.sustain * 100)}%`;
  document.getElementById('env-release-value')!.textContent = `${Math.round(preset.envelope.release * 1000)} ms`;

  // Apply effect settings
  const effectsConfig: Array<{
    name: string;
    fx: { bypassed: boolean; setParam: (name: string, value: number, ramp: number) => void } | null;
    config: { enabled: boolean; params: Record<string, number> };
  }> = [
    { name: 'filter', fx: filter, config: preset.filter },
    { name: 'saturation', fx: saturation, config: preset.saturation },
    { name: 'bitcrusher', fx: bitcrusher, config: preset.bitcrusher },
    { name: 'distortion', fx: distortion, config: preset.distortion },
    { name: 'compressor', fx: compressor, config: preset.compressor },
    { name: 'delay', fx: delay, config: preset.delay },
    { name: 'reverb', fx: reverb, config: preset.reverb },
    { name: 'phaser', fx: phaser, config: preset.phaser },
    { name: 'flanger', fx: flanger, config: preset.flanger }
  ];

  effectsConfig.forEach(({ name, fx, config }) => {
    if (fx) {
      fx.bypassed = !config.enabled;

      // Apply parameters
      Object.entries(config.params).forEach(([param, value]) => {
        fx.setParam(param, value, 0.05);
      });

      // Update UI
      applyEffectPresetToUI(name, config.params);
    }
  });

  // Apply panner setting if present
  if (preset.panner && panner) {
    panner.setParam('pan', preset.panner.pan, 0.05);
    const panValue = preset.panner.pan;
    let label: string;
    if (panValue < -5) {
      label = `L ${Math.abs(panValue)}%`;
    } else if (panValue > 5) {
      label = `R ${panValue}%`;
    } else {
      label = 'Center';
    }
    (document.getElementById('panner-pan') as HTMLInputElement).value = String(panValue);
    document.getElementById('panner-pan-value')!.textContent = label;
  }

  // Update bypassed UI state
  updateBypassedUI();

  log(`Preset loaded: ${preset.name}`);
}

// Update UI controls for an effect preset
function applyEffectPresetToUI(fxName: string, params: Record<string, number>): void {
  Object.entries(params).forEach(([param, value]) => {
    const input = document.getElementById(`${fxName}-${param}`) as HTMLInputElement;
    const valueEl = document.getElementById(`${fxName}-${param}-value`);
    if (input) {
      input.value = String(value);
    }
    if (valueEl) {
      // Format value display based on param type
      if (param === 'time' || param === 'preDelay' || param === 'predelay') {
        valueEl.textContent = `${Math.round(value)} ms`;
      } else if (param === 'decay') {
        valueEl.textContent = `${value.toFixed(1)} s`;
      } else if (param === 'rate') {
        valueEl.textContent = `${value.toFixed(2)} Hz`;
      } else if (param === 'baseFreq' || param === 'basefreq' || param === 'cutoff') {
        valueEl.textContent = `${Math.round(value)} Hz`;
      } else if (param === 'delay') {
        valueEl.textContent = `${value} ms`;
      } else if (param === 'stages') {
        valueEl.textContent = String(value);
      } else if (param === 'bits') {
        valueEl.textContent = `${Math.round(value)} bit`;
      } else if (param === 'downsample') {
        valueEl.textContent = `${Math.round(value)}x`;
      } else if (param === 'threshold') {
        valueEl.textContent = `${value} dB`;
      } else if (param === 'ratio') {
        valueEl.textContent = `${value}:1`;
      } else if (param === 'attack' || param === 'release') {
        valueEl.textContent = `${value} ms`;
      } else if (param === 'resonance') {
        valueEl.textContent = String(value);
      } else {
        valueEl.textContent = `${value}%`;
      }
    }
  });
}

// Helper to update UI for a preset
function applyPresetToUI(fxName: string, preset: Record<string, number>): void {
  Object.entries(preset).forEach(([param, value]) => {
    const input = document.getElementById(`${fxName}-${param}`) as HTMLInputElement;
    const valueEl = document.getElementById(`${fxName}-${param}-value`);
    if (input) {
      input.value = String(value);
      if (valueEl) {
        // Format value display based on param type
        if (param === 'time' || param === 'preDelay' || param === 'predelay') {
          valueEl.textContent = `${Math.round(value)} ms`;
        } else if (param === 'decay') {
          valueEl.textContent = `${value.toFixed(1)} s`;
        } else if (param === 'rate') {
          valueEl.textContent = `${value.toFixed(2)} Hz`;
        } else if (param === 'baseFreq' || param === 'basefreq') {
          valueEl.textContent = `${Math.round(value)} Hz`;
        } else if (param === 'delay') {
          valueEl.textContent = `${value} ms`;
        } else if (param === 'stages') {
          valueEl.textContent = String(value);
        } else {
          valueEl.textContent = `${value}%`;
        }
      }
    }
  });
}

// ============ EVENT HANDLERS ============

document.getElementById('start-audio')?.addEventListener('click', initAudio);
document.getElementById('play-tone')?.addEventListener('click', playTone);
document.getElementById('play-noise')?.addEventListener('click', playNoise);
document.getElementById('stop-audio')?.addEventListener('click', () => {
  stopAudio();
  stopSequence();
  stopSpatialAnimation();
  const spatialPlayBtn = document.getElementById('spatial-play-btn');
  if (spatialPlayBtn) {
    spatialPlayBtn.classList.remove('active');
    spatialPlayBtn.textContent = 'Play';
  }
});

// ============ LFO CONTROLS ============

document.getElementById('lfo-enable')?.addEventListener('click', () => {
  lfoEnabled = !lfoEnabled;
  connectLfoToTarget();
  updateBypassedUI();
  log(`LFO ${lfoEnabled ? 'enabled' : 'disabled'}`);
});

document.getElementById('lfo-rate')?.addEventListener('input', (e) => {
  const value = parseFloat((e.target as HTMLInputElement).value);
  lfo?.setRate(value, 0.05);
  document.getElementById('lfo-rate-value')!.textContent = `${value.toFixed(1)} Hz`;
});

document.getElementById('lfo-depth')?.addEventListener('input', (e) => {
  const value = parseFloat((e.target as HTMLInputElement).value);
  document.getElementById('lfo-depth-value')!.textContent = String(value);
  connectLfoToTarget(); // Reconnect with new depth
});

document.getElementById('lfo-waveform')?.addEventListener('change', (e) => {
  const value = (e.target as HTMLSelectElement).value as LFOWaveform;
  if (lfo) {
    lfo.waveform = value;
    log(`LFO waveform: ${value}`);
  }
});

document.getElementById('lfo-target')?.addEventListener('change', (e) => {
  lfoTarget = (e.target as HTMLSelectElement).value;
  connectLfoToTarget();
});

// LFO presets
document.querySelectorAll('.lfo-preset-btn').forEach((btn) => {
  btn.addEventListener('click', (e) => {
    const presetName = (e.target as HTMLElement).dataset.preset as keyof typeof LFO_PRESETS;
    const preset = LFO_PRESETS[presetName];
    if (preset && lfo) {
      lfo.setRate(preset.rate, 0.05);
      lfo.waveform = preset.waveform;

      // Update UI
      (document.getElementById('lfo-rate') as HTMLInputElement).value = String(preset.rate);
      (document.getElementById('lfo-waveform') as HTMLSelectElement).value = preset.waveform;
      document.getElementById('lfo-rate-value')!.textContent = `${preset.rate.toFixed(1)} Hz`;

      log(`LFO preset: ${presetName}`);
    }
  });
});

// ============ OSCILLATOR CONTROLS ============

document.getElementById('osc-waveform')?.addEventListener('change', (e) => {
  const value = (e.target as HTMLSelectElement).value as WaveformType;
  if (oscillator) {
    oscillator.waveform = value;
    log(`Oscillator waveform: ${value}`);
  }
});

document.getElementById('osc-detune')?.addEventListener('input', (e) => {
  const value = parseFloat((e.target as HTMLInputElement).value);
  if (oscillator) {
    oscillator.detune = value;
  }
  document.getElementById('osc-detune-value')!.textContent = `${value} ct`;
});

document.getElementById('osc-gain')?.addEventListener('input', (e) => {
  const value = parseFloat((e.target as HTMLInputElement).value);
  if (oscillator) {
    oscillator.gain = value / 100;
  }
  document.getElementById('osc-gain-value')!.textContent = `${value}%`;
});

// Oscillator presets
document.querySelectorAll('.preset-btn').forEach((btn) => {
  btn.addEventListener('click', (e) => {
    const presetName = (e.target as HTMLElement).dataset.preset as keyof typeof OSCILLATOR_PRESETS;
    const preset = OSCILLATOR_PRESETS[presetName];
    if (preset && oscillator) {
      oscillator.waveform = preset.waveform;
      oscillator.detune = preset.detune;

      // Update UI
      (document.getElementById('osc-waveform') as HTMLSelectElement).value = preset.waveform;
      (document.getElementById('osc-detune') as HTMLInputElement).value = String(preset.detune);
      document.getElementById('osc-detune-value')!.textContent = `${preset.detune} ct`;

      log(`Oscillator preset: ${presetName}`);
    }
  });
});

// ============ ENVELOPE CONTROLS ============

document.getElementById('env-attack')?.addEventListener('input', (e) => {
  const value = parseFloat((e.target as HTMLInputElement).value);
  if (envelope) {
    envelope.attack = value / 1000;
  }
  document.getElementById('env-attack-value')!.textContent = `${value} ms`;
});

document.getElementById('env-decay')?.addEventListener('input', (e) => {
  const value = parseFloat((e.target as HTMLInputElement).value);
  if (envelope) {
    envelope.decay = value / 1000;
  }
  document.getElementById('env-decay-value')!.textContent = `${value} ms`;
});

document.getElementById('env-sustain')?.addEventListener('input', (e) => {
  const value = parseFloat((e.target as HTMLInputElement).value);
  if (envelope) {
    envelope.sustain = value / 100;
  }
  document.getElementById('env-sustain-value')!.textContent = `${value}%`;
});

document.getElementById('env-release')?.addEventListener('input', (e) => {
  const value = parseFloat((e.target as HTMLInputElement).value);
  if (envelope) {
    envelope.release = value / 1000;
  }
  document.getElementById('env-release-value')!.textContent = `${value} ms`;
});

// Envelope presets
document.querySelectorAll('.env-preset-btn').forEach((btn) => {
  btn.addEventListener('click', (e) => {
    const presetName = (e.target as HTMLElement).dataset.preset as keyof typeof ENVELOPE_PRESETS;
    const preset = ENVELOPE_PRESETS[presetName];
    if (preset && envelope) {
      envelope.attack = preset.attack;
      envelope.decay = preset.decay;
      envelope.sustain = preset.sustain;
      envelope.release = preset.release;

      // Update UI
      (document.getElementById('env-attack') as HTMLInputElement).value = String(preset.attack * 1000);
      (document.getElementById('env-decay') as HTMLInputElement).value = String(preset.decay * 1000);
      (document.getElementById('env-sustain') as HTMLInputElement).value = String(preset.sustain * 100);
      (document.getElementById('env-release') as HTMLInputElement).value = String(preset.release * 1000);

      document.getElementById('env-attack-value')!.textContent = `${Math.round(preset.attack * 1000)} ms`;
      document.getElementById('env-decay-value')!.textContent = `${Math.round(preset.decay * 1000)} ms`;
      document.getElementById('env-sustain-value')!.textContent = `${Math.round(preset.sustain * 100)}%`;
      document.getElementById('env-release-value')!.textContent = `${Math.round(preset.release * 1000)} ms`;

      log(`Envelope preset: ${presetName}`);
    }
  });
});

// ============ FILTER CONTROLS ============

document.getElementById('filter-cutoff')?.addEventListener('input', (e) => {
  const value = parseFloat((e.target as HTMLInputElement).value);
  filter?.setParam('cutoff', value, 0.05);
  document.getElementById('filter-cutoff-value')!.textContent = `${Math.round(value)} Hz`;
});

document.getElementById('filter-resonance')?.addEventListener('input', (e) => {
  const value = parseFloat((e.target as HTMLInputElement).value);
  filter?.setParam('resonance', value, 0.05);
  document.getElementById('filter-resonance-value')!.textContent = String(value);
});

// ============ SATURATION CONTROLS ============

document.getElementById('saturation-drive')?.addEventListener('input', (e) => {
  const value = parseFloat((e.target as HTMLInputElement).value);
  saturation?.setParam('drive', value, 0.05);
  document.getElementById('saturation-drive-value')!.textContent = `${value}%`;
});

document.getElementById('saturation-mix')?.addEventListener('input', (e) => {
  const value = parseFloat((e.target as HTMLInputElement).value);
  saturation?.setParam('mix', value, 0.05);
  document.getElementById('saturation-mix-value')!.textContent = `${value}%`;
});

// ============ BITCRUSHER CONTROLS ============

document.getElementById('bitcrusher-bits')?.addEventListener('input', (e) => {
  const value = parseFloat((e.target as HTMLInputElement).value);
  bitcrusher?.setParam('bits', value, 0);
  document.getElementById('bitcrusher-bits-value')!.textContent = `${Math.round(value)} bit`;
});

document.getElementById('bitcrusher-downsample')?.addEventListener('input', (e) => {
  const value = parseFloat((e.target as HTMLInputElement).value);
  bitcrusher?.setParam('downsample', value, 0);
  document.getElementById('bitcrusher-downsample-value')!.textContent = `${Math.round(value)}x`;
});

document.getElementById('bitcrusher-mix')?.addEventListener('input', (e) => {
  const value = parseFloat((e.target as HTMLInputElement).value);
  bitcrusher?.setParam('mix', value, 0.05);
  document.getElementById('bitcrusher-mix-value')!.textContent = `${value}%`;
});

// ============ DISTORTION CONTROLS ============

document.getElementById('distortion-drive')?.addEventListener('input', (e) => {
  const value = parseFloat((e.target as HTMLInputElement).value);
  distortion?.setParam('drive', value, 0.05);
  document.getElementById('distortion-drive-value')!.textContent = `${value}%`;
});

document.getElementById('distortion-tone')?.addEventListener('input', (e) => {
  const value = parseFloat((e.target as HTMLInputElement).value);
  distortion?.setParam('tone', value, 0.05);
  document.getElementById('distortion-tone-value')!.textContent = `${value}%`;
});

document.getElementById('distortion-level')?.addEventListener('input', (e) => {
  const value = parseFloat((e.target as HTMLInputElement).value);
  distortion?.setParam('level', value, 0.05);
  document.getElementById('distortion-level-value')!.textContent = `${value}%`;
});

document.getElementById('distortion-mix')?.addEventListener('input', (e) => {
  const value = parseFloat((e.target as HTMLInputElement).value);
  distortion?.setParam('mix', value, 0.05);
  document.getElementById('distortion-mix-value')!.textContent = `${value}%`;
});

document.getElementById('distortion-type')?.addEventListener('change', (e) => {
  const value = (e.target as HTMLSelectElement).value as DistortionType;
  if (distortion) {
    distortion.type = value;
    log(`Distortion type: ${value}`);
  }
});

// ============ COMPRESSOR CONTROLS ============

document.getElementById('compressor-threshold')?.addEventListener('input', (e) => {
  const value = parseFloat((e.target as HTMLInputElement).value);
  compressor?.setParam('threshold', value, 0.05);
  document.getElementById('compressor-threshold-value')!.textContent = `${value} dB`;
});

document.getElementById('compressor-ratio')?.addEventListener('input', (e) => {
  const value = parseFloat((e.target as HTMLInputElement).value);
  compressor?.setParam('ratio', value, 0.05);
  document.getElementById('compressor-ratio-value')!.textContent = `${value}:1`;
});

document.getElementById('compressor-attack')?.addEventListener('input', (e) => {
  const value = parseFloat((e.target as HTMLInputElement).value);
  compressor?.setParam('attack', value, 0.05);
  document.getElementById('compressor-attack-value')!.textContent = `${value} ms`;
});

document.getElementById('compressor-release')?.addEventListener('input', (e) => {
  const value = parseFloat((e.target as HTMLInputElement).value);
  compressor?.setParam('release', value, 0.05);
  document.getElementById('compressor-release-value')!.textContent = `${value} ms`;
});

// ============ DELAY CONTROLS ============

document.getElementById('delay-time')?.addEventListener('input', (e) => {
  const value = parseFloat((e.target as HTMLInputElement).value);
  delay?.setParam('time', value, 0.05);
  document.getElementById('delay-time-value')!.textContent = `${Math.round(value)} ms`;
});

document.getElementById('delay-feedback')?.addEventListener('input', (e) => {
  const value = parseFloat((e.target as HTMLInputElement).value);
  delay?.setParam('feedback', value, 0.05);
  document.getElementById('delay-feedback-value')!.textContent = `${value}%`;
});

document.getElementById('delay-damping')?.addEventListener('input', (e) => {
  const value = parseFloat((e.target as HTMLInputElement).value);
  delay?.setParam('damping', value, 0.05);
  document.getElementById('delay-damping-value')!.textContent = `${value}%`;
});

document.getElementById('delay-mix')?.addEventListener('input', (e) => {
  const value = parseFloat((e.target as HTMLInputElement).value);
  delay?.setParam('mix', value, 0.05);
  document.getElementById('delay-mix-value')!.textContent = `${value}%`;
});

// ============ REVERB CONTROLS ============

document.getElementById('reverb-decay')?.addEventListener('input', (e) => {
  const value = parseFloat((e.target as HTMLInputElement).value);
  reverb?.setParam('decay', value, 0.05);
  document.getElementById('reverb-decay-value')!.textContent = `${value.toFixed(1)} s`;
});

document.getElementById('reverb-damping')?.addEventListener('input', (e) => {
  const value = parseFloat((e.target as HTMLInputElement).value);
  reverb?.setParam('damping', value, 0.05);
  document.getElementById('reverb-damping-value')!.textContent = `${value}%`;
});

document.getElementById('reverb-predelay')?.addEventListener('input', (e) => {
  const value = parseFloat((e.target as HTMLInputElement).value);
  reverb?.setParam('preDelay', value, 0.05);
  document.getElementById('reverb-predelay-value')!.textContent = `${value} ms`;
});

document.getElementById('reverb-mix')?.addEventListener('input', (e) => {
  const value = parseFloat((e.target as HTMLInputElement).value);
  reverb?.setParam('mix', value, 0.05);
  document.getElementById('reverb-mix-value')!.textContent = `${value}%`;
});

// ============ PHASER CONTROLS ============

document.getElementById('phaser-rate')?.addEventListener('input', (e) => {
  const value = parseFloat((e.target as HTMLInputElement).value);
  phaser?.setParam('rate', value, 0.05);
  document.getElementById('phaser-rate-value')!.textContent = `${value.toFixed(2)} Hz`;
});

document.getElementById('phaser-depth')?.addEventListener('input', (e) => {
  const value = parseFloat((e.target as HTMLInputElement).value);
  phaser?.setParam('depth', value, 0.05);
  document.getElementById('phaser-depth-value')!.textContent = `${value}%`;
});

document.getElementById('phaser-feedback')?.addEventListener('input', (e) => {
  const value = parseFloat((e.target as HTMLInputElement).value);
  phaser?.setParam('feedback', value, 0.05);
  document.getElementById('phaser-feedback-value')!.textContent = `${value}%`;
});

document.getElementById('phaser-stages')?.addEventListener('input', (e) => {
  const value = parseFloat((e.target as HTMLInputElement).value);
  phaser?.setParam('stages', value, 0);
  document.getElementById('phaser-stages-value')!.textContent = String(value);
});

document.getElementById('phaser-basefreq')?.addEventListener('input', (e) => {
  const value = parseFloat((e.target as HTMLInputElement).value);
  phaser?.setParam('baseFreq', value, 0.05);
  document.getElementById('phaser-basefreq-value')!.textContent = `${Math.round(value)} Hz`;
});

document.getElementById('phaser-mix')?.addEventListener('input', (e) => {
  const value = parseFloat((e.target as HTMLInputElement).value);
  phaser?.setParam('mix', value, 0.05);
  document.getElementById('phaser-mix-value')!.textContent = `${value}%`;
});

// ============ FLANGER CONTROLS ============

document.getElementById('flanger-rate')?.addEventListener('input', (e) => {
  const value = parseFloat((e.target as HTMLInputElement).value);
  flanger?.setParam('rate', value, 0.05);
  document.getElementById('flanger-rate-value')!.textContent = `${value.toFixed(2)} Hz`;
});

document.getElementById('flanger-depth')?.addEventListener('input', (e) => {
  const value = parseFloat((e.target as HTMLInputElement).value);
  flanger?.setParam('depth', value, 0.05);
  document.getElementById('flanger-depth-value')!.textContent = `${value}%`;
});

document.getElementById('flanger-feedback')?.addEventListener('input', (e) => {
  const value = parseFloat((e.target as HTMLInputElement).value);
  flanger?.setParam('feedback', value, 0.05);
  document.getElementById('flanger-feedback-value')!.textContent = `${value}%`;
});

document.getElementById('flanger-delay')?.addEventListener('input', (e) => {
  const value = parseFloat((e.target as HTMLInputElement).value);
  flanger?.setParam('delay', value, 0.05);
  document.getElementById('flanger-delay-value')!.textContent = `${value} ms`;
});

document.getElementById('flanger-mix')?.addEventListener('input', (e) => {
  const value = parseFloat((e.target as HTMLInputElement).value);
  flanger?.setParam('mix', value, 0.05);
  document.getElementById('flanger-mix-value')!.textContent = `${value}%`;
});

// ============ PANNER CONTROLS ============

document.getElementById('panner-pan')?.addEventListener('input', (e) => {
  const value = parseFloat((e.target as HTMLInputElement).value);
  panner?.setParam('pan', value, 0.05);
  // Display value: Left, Center, or Right
  let label: string;
  if (value < -5) {
    label = `L ${Math.abs(value)}%`;
  } else if (value > 5) {
    label = `R ${value}%`;
  } else {
    label = 'Center';
  }
  document.getElementById('panner-pan-value')!.textContent = label;
});

// ============ SPATIAL PANNER CONTROLS ============

// Update the XY pad dot position and size based on Y (depth effect)
function updateSpatialDot(): void {
  const dot = document.getElementById('spatial-dot') as HTMLElement | null;
  if (!dot || !spatialPanner) return;

  const x = spatialPanner.getParam('positionX');
  const y = spatialPanner.getParam('positionY');
  const z = spatialPanner.getParam('positionZ');

  // Convert from -100..100 to 0..100% position
  const left = (x + 100) / 2;
  const top = (100 - z) / 2; // Invert Z so positive is forward (top)

  dot.style.left = `${left}%`;
  dot.style.top = `${top}%`;

  // 3D depth effect: Y controls size (up = closer/larger, down = farther/smaller)
  // Y range: -100 to 100, map to scale 0.5 to 1.5
  const scale = 1 + (y / 200); // Y=100 -> 1.5, Y=0 -> 1.0, Y=-100 -> 0.5

  // Also adjust opacity and shadow for more depth
  const opacity = 0.6 + (y + 100) / 250; // Y=100 -> 1.0, Y=-100 -> 0.6
  const shadowBlur = 15 + (y / 5); // Y=100 -> 35, Y=-100 -> -5 (clamped)
  const shadowSpread = Math.max(0, 30 + (y / 4)); // Y=100 -> 55, Y=-100 -> 5

  dot.style.transform = `translate(-50%, -50%) scale(${scale})`;
  dot.style.opacity = String(Math.max(0.4, Math.min(1, opacity)));
  dot.style.boxShadow = `0 0 ${Math.max(5, shadowBlur)}px var(--cyan), 0 0 ${shadowSpread}px rgba(0,255,255,${0.3 + y/400})`;
}

// XY Pad interaction
const spatialXYPad = document.getElementById('spatial-xy-pad');
let isDraggingSpatial = false;

function handleSpatialXYMove(e: MouseEvent | TouchEvent): void {
  if (!spatialXYPad || !spatialPanner) return;

  const rect = spatialXYPad.getBoundingClientRect();
  const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
  const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;

  // Calculate position as percentage
  let xPercent = ((clientX - rect.left) / rect.width) * 100;
  let yPercent = ((clientY - rect.top) / rect.height) * 100;

  // Clamp to bounds
  xPercent = Math.max(0, Math.min(100, xPercent));
  yPercent = Math.max(0, Math.min(100, yPercent));

  // Convert to -100..100 range
  const x = (xPercent * 2) - 100;
  const z = 100 - (yPercent * 2); // Invert Y for Z axis

  spatialPanner.setParam('positionX', x, 0.02);
  spatialPanner.setParam('positionZ', z, 0.02);

  // Update sliders and display
  (document.getElementById('spatial-x') as HTMLInputElement).value = String(Math.round(x));
  (document.getElementById('spatial-z') as HTMLInputElement).value = String(Math.round(z));
  document.getElementById('spatial-x-value')!.textContent = String(Math.round(x));
  document.getElementById('spatial-z-value')!.textContent = String(Math.round(z));

  updateSpatialDot();
}

spatialXYPad?.addEventListener('mousedown', (e) => {
  isDraggingSpatial = true;
  handleSpatialXYMove(e);
});

document.addEventListener('mousemove', (e) => {
  if (isDraggingSpatial) handleSpatialXYMove(e);
});

document.addEventListener('mouseup', () => {
  isDraggingSpatial = false;
});

spatialXYPad?.addEventListener('touchstart', (e) => {
  e.preventDefault();
  isDraggingSpatial = true;
  handleSpatialXYMove(e);
});

spatialXYPad?.addEventListener('touchmove', (e) => {
  e.preventDefault();
  if (isDraggingSpatial) handleSpatialXYMove(e);
});

spatialXYPad?.addEventListener('touchend', () => {
  isDraggingSpatial = false;
});

// X Position slider
document.getElementById('spatial-x')?.addEventListener('input', (e) => {
  const value = parseFloat((e.target as HTMLInputElement).value);
  spatialPanner?.setParam('positionX', value, 0.05);
  document.getElementById('spatial-x-value')!.textContent = String(Math.round(value));
  updateSpatialDot();
});

// Y Position slider
document.getElementById('spatial-y')?.addEventListener('input', (e) => {
  const value = parseFloat((e.target as HTMLInputElement).value);
  spatialPanner?.setParam('positionY', value, 0.05);
  document.getElementById('spatial-y-value')!.textContent = String(Math.round(value));
  updateSpatialDot();
});

// Z Position slider
document.getElementById('spatial-z')?.addEventListener('input', (e) => {
  const value = parseFloat((e.target as HTMLInputElement).value);
  spatialPanner?.setParam('positionZ', value, 0.05);
  document.getElementById('spatial-z-value')!.textContent = String(Math.round(value));
  updateSpatialDot();
});

// Rolloff slider
document.getElementById('spatial-rolloff')?.addEventListener('input', (e) => {
  const value = parseFloat((e.target as HTMLInputElement).value);
  spatialPanner?.setParam('rolloffFactor', value, 0.05);
  document.getElementById('spatial-rolloff-value')!.textContent = value.toFixed(1);
});

// Distance model select
document.getElementById('spatial-distance-model')?.addEventListener('change', (e) => {
  const value = (e.target as HTMLSelectElement).value as 'linear' | 'inverse' | 'exponential';
  if (spatialPanner) {
    spatialPanner.distanceModel = value;
    log(`Spatial panner distance model: ${value}`);
  }
});

// Panning model select
document.getElementById('spatial-panning-model')?.addEventListener('change', (e) => {
  const value = (e.target as HTMLSelectElement).value as 'HRTF' | 'equalpower';
  if (spatialPanner) {
    spatialPanner.panningModel = value;
    log(`Spatial panner model: ${value}`);
  }
});

// Spatial Panner Play Animation
let spatialAnimationId: number | null = null;
let spatialAnimationRunning = false;

interface SpatialTarget {
  x: number;
  y: number;
  z: number;
  startX: number;
  startY: number;
  startZ: number;
  startTime: number;
  duration: number;
}

let spatialTarget: SpatialTarget | null = null;

function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

function pickNewSpatialTarget(): void {
  if (!spatialPanner) return;

  const currentX = spatialPanner.getParam('positionX');
  const currentY = spatialPanner.getParam('positionY');
  const currentZ = spatialPanner.getParam('positionZ');

  // Pick random target position
  const targetX = (Math.random() * 2 - 1) * 80; // -80 to 80
  const targetY = (Math.random() * 2 - 1) * 50; // -50 to 50
  const targetZ = (Math.random() * 2 - 1) * 80; // -80 to 80

  spatialTarget = {
    x: targetX,
    y: targetY,
    z: targetZ,
    startX: currentX,
    startY: currentY,
    startZ: currentZ,
    startTime: performance.now(),
    duration: 1500 + Math.random() * 2000 // 1.5-3.5 seconds
  };
}

function animateSpatialPanner(): void {
  if (!spatialAnimationRunning || !spatialPanner || !spatialTarget) return;

  const now = performance.now();
  const elapsed = now - spatialTarget.startTime;
  const progress = Math.min(1, elapsed / spatialTarget.duration);
  const easedProgress = easeInOutCubic(progress);

  // Interpolate position
  const x = spatialTarget.startX + (spatialTarget.x - spatialTarget.startX) * easedProgress;
  const y = spatialTarget.startY + (spatialTarget.y - spatialTarget.startY) * easedProgress;
  const z = spatialTarget.startZ + (spatialTarget.z - spatialTarget.startZ) * easedProgress;

  spatialPanner.setParam('positionX', x, 0);
  spatialPanner.setParam('positionY', y, 0);
  spatialPanner.setParam('positionZ', z, 0);

  // Update UI
  (document.getElementById('spatial-x') as HTMLInputElement).value = String(Math.round(x));
  (document.getElementById('spatial-y') as HTMLInputElement).value = String(Math.round(y));
  (document.getElementById('spatial-z') as HTMLInputElement).value = String(Math.round(z));
  document.getElementById('spatial-x-value')!.textContent = String(Math.round(x));
  document.getElementById('spatial-y-value')!.textContent = String(Math.round(y));
  document.getElementById('spatial-z-value')!.textContent = String(Math.round(z));
  updateSpatialDot();

  // Pick new target when reached
  if (progress >= 1) {
    pickNewSpatialTarget();
  }

  spatialAnimationId = requestAnimationFrame(animateSpatialPanner);
}

function startSpatialAnimation(): void {
  if (spatialAnimationRunning) return;
  spatialAnimationRunning = true;

  // Auto-enable the spatial panner when playing
  if (spatialPanner?.bypassed) {
    spatialPanner.bypassed = false;
    document.getElementById('spatial-panner-module')?.classList.remove('bypassed');
    document.querySelector('.fx-bypass[data-fx="spatial-panner"]')?.classList.remove('active');
  }

  pickNewSpatialTarget();
  animateSpatialPanner();
  log('Spatial panner animation started');
}

function stopSpatialAnimation(): void {
  spatialAnimationRunning = false;
  if (spatialAnimationId !== null) {
    cancelAnimationFrame(spatialAnimationId);
    spatialAnimationId = null;
  }
  spatialTarget = null;
  log('Spatial panner animation stopped');
}

document.getElementById('spatial-play-btn')?.addEventListener('click', (e) => {
  const btn = e.target as HTMLButtonElement;
  if (spatialAnimationRunning) {
    stopSpatialAnimation();
    btn.classList.remove('active');
    btn.textContent = 'Play';
  } else {
    startSpatialAnimation();
    btn.classList.add('active');
    btn.textContent = 'Stop';
  }
});

// ============ LIMITER CONTROLS ============

document.getElementById('limiter-ceiling')?.addEventListener('input', (e) => {
  const value = parseFloat((e.target as HTMLInputElement).value);
  limiter?.setParam('threshold', value, 0.05);
  document.getElementById('limiter-ceiling-value')!.textContent = `${value} dB`;
});

document.getElementById('limiter-release')?.addEventListener('input', (e) => {
  const value = parseFloat((e.target as HTMLInputElement).value);
  limiter?.setParam('release', value, 0.05);
  document.getElementById('limiter-release-value')!.textContent = `${value} ms`;
});

// Update limiter reduction meter
function updateLimiterMeter(): void {
  if (limiter) {
    const reduction = limiter.reduction;
    const reductionEl = document.getElementById('limiter-reduction');
    if (reductionEl) {
      reductionEl.textContent = `${reduction.toFixed(1)} dB`;
      // Color based on reduction amount
      if (reduction < -6) {
        reductionEl.style.color = '#ff4444';
      } else if (reduction < -3) {
        reductionEl.style.color = '#ffaa00';
      } else {
        reductionEl.style.color = '#ffcc00';
      }
    }
  }
  requestAnimationFrame(updateLimiterMeter);
}

// Start meter when audio initializes (will be called after initAudio)
setTimeout(() => {
  if (audioContext) updateLimiterMeter();
}, 100);

// ============ EFFECT PRESETS ============

document.querySelectorAll('.fx-preset-btn').forEach((btn) => {
  btn.addEventListener('click', (e) => {
    const target = e.target as HTMLElement;
    const fxName = target.dataset.fx as keyof typeof EFFECT_PRESETS;
    const presetName = target.dataset.preset as string;

    const presets = EFFECT_PRESETS[fxName];
    if (!presets) return;

    const preset = presets[presetName as keyof typeof presets];
    if (!preset) return;

    // Get the effect instance
    let fx: { setParam: (name: string, value: number, ramp: number) => void } | null = null;
    switch (fxName) {
      case 'delay': fx = delay; break;
      case 'reverb': fx = reverb; break;
      case 'phaser': fx = phaser; break;
      case 'flanger': fx = flanger; break;
      case 'bitcrusher': fx = bitcrusher; break;
      case 'distortion': fx = distortion; break;
    }

    if (fx) {
      // Apply all preset values
      Object.entries(preset).forEach(([param, value]) => {
        fx!.setParam(param, value, 0.05);
      });

      // Update UI
      applyPresetToUI(fxName, preset);

      log(`${fxName} preset: ${presetName}`);
    }
  });
});

// ============ BYPASS BUTTONS ============

document.querySelectorAll('.fx-bypass').forEach((btn) => {
  btn.addEventListener('click', (e) => {
    const fxName = (e.target as HTMLElement).dataset.fx;
    if (fxName === 'lfo') return; // Handled separately

    const module = document.getElementById(`${fxName}-module`);

    let fx: { bypassed: boolean } | null = null;
    switch (fxName) {
      case 'filter': fx = filter; break;
      case 'saturation': fx = saturation; break;
      case 'bitcrusher': fx = bitcrusher; break;
      case 'distortion': fx = distortion; break;
      case 'compressor': fx = compressor; break;
      case 'delay': fx = delay; break;
      case 'reverb': fx = reverb; break;
      case 'phaser': fx = phaser; break;
      case 'flanger': fx = flanger; break;
      case 'panner': fx = panner; break;
      case 'spatial-panner': fx = spatialPanner; break;
      case 'limiter': fx = limiter; break;
    }

    if (fx) {
      fx.bypassed = !fx.bypassed;
      module?.classList.toggle('bypassed', fx.bypassed);
      (e.target as HTMLElement).classList.toggle('active', fx.bypassed);
      log(`${fxName} ${fx.bypassed ? 'bypassed' : 'enabled'}`);
    }
  });
});

// Auto-initialize audio on first user interaction (required by browser autoplay policy)
const autoInit = () => {
  if (!audioContext) {
    initAudio();
  }
  document.removeEventListener('click', autoInit);
  document.removeEventListener('keydown', autoInit);
};

document.addEventListener('click', autoInit);
document.addEventListener('keydown', autoInit);

// ============ SEQUENCE PLAYER ============

// Legacy sequences object - now mostly handled by presets.ts
// Kept for backwards compatibility
const SEQUENCES: Record<string, { bpm: number; notes: SequenceNote[] }> = {};

let sequenceTimeouts: number[] = [];
let isSequencePlaying = false;
let currentSequenceBtn: HTMLElement | null = null;

function stopSequence(): void {
  sequenceTimeouts.forEach(id => clearTimeout(id));
  sequenceTimeouts = [];
  isSequencePlaying = false;

  // Stop all active notes
  activeNotes.forEach(note => stopNote(note));

  // Update UI
  if (currentSequenceBtn) {
    currentSequenceBtn.classList.remove('playing');
    currentSequenceBtn = null;
  }

  log('Sequence stopped');
}

function playSequence(presetId: string, btn: HTMLElement, applySettings: boolean = true): void {
  if (!audioContext || !oscillator || !envelope) {
    log('Initialize audio first!');
    return;
  }

  // Stop any playing sequence
  stopSequence();

  // Try to get preset first, then fall back to SEQUENCES for backwards compat
  const preset = getPresetById(presetId);
  const sequence = preset || SEQUENCES[presetId];

  if (!sequence) {
    log(`Unknown preset: ${presetId}`);
    return;
  }

  // If it's a full preset and we should apply settings, do so
  if (preset && applySettings) {
    applySoundPreset(preset);
  }

  isSequencePlaying = true;
  currentSequenceBtn = btn;
  btn.classList.add('playing');

  const bpm = preset ? preset.bpm : (sequence as { bpm: number }).bpm;
  const notes = preset ? preset.notes : (sequence as { notes: SequenceNote[] }).notes;
  const beatDuration = 60 / bpm; // seconds per beat
  let time = 0;

  notes.forEach((noteData, index) => {
    const noteOnTime = time * 1000;
    const noteDuration = noteData.duration * beatDuration * 1000;
    const gap = (noteData.gap ?? 0.05) * beatDuration * 1000; // Small gap between notes

    // Schedule note on
    const onTimeout = setTimeout(() => {
      if (isSequencePlaying) {
        playNote(noteData.note);
      }
    }, noteOnTime);
    sequenceTimeouts.push(onTimeout);

    // Schedule note off
    const offTimeout = setTimeout(() => {
      if (isSequencePlaying) {
        stopNote(noteData.note);
      }
    }, noteOnTime + noteDuration - gap);
    sequenceTimeouts.push(offTimeout);

    // Only advance time if gap is not exactly 0
    // gap: 0 means "this note is part of a chord, play next note simultaneously"
    if (noteData.gap !== 0) {
      time += noteData.duration * beatDuration;
    }

    // Loop the sequence
    if (index === notes.length - 1) {
      const loopTimeout = setTimeout(() => {
        if (isSequencePlaying) {
          playSequence(presetId, btn, false); // Don't re-apply settings on loop
        }
      }, time * 1000 + 200);
      sequenceTimeouts.push(loopTimeout);
    }
  });

  log(`Playing: ${preset ? preset.name : presetId}`);
}

// Preset button handlers
document.querySelectorAll('.preset-play-btn').forEach((btn) => {
  btn.addEventListener('click', (e) => {
    const presetId = (e.target as HTMLElement).dataset.preset;
    if (presetId) {
      playSequence(presetId, e.target as HTMLElement);
    }
  });
});

// Legacy sequence button handlers (backwards compatibility)
document.querySelectorAll('.seq-btn:not(.stop-seq)').forEach((btn) => {
  btn.addEventListener('click', (e) => {
    const seqName = (e.target as HTMLElement).dataset.sequence;
    if (seqName) {
      playSequence(seqName, e.target as HTMLElement);
    }
  });
});

document.getElementById('stop-sequence')?.addEventListener('click', stopSequence);

console.log('@neon/fx Playground loaded');
