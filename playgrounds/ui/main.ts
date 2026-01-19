/**
 * @neon/ui Playground
 * Interactive component gallery
 */

import {
  createKnob,
  createLedButton,
  createMachineButton,
  createActionButton,
  createStepButton,
  createPatternBank,
  createKeyboard,
  createPianoRoll,
  createSpectrumAnalyzer,
  showToast
} from '@neon/ui';

// Helper to mount component
function mount(id: string, element: HTMLElement): void {
  const container = document.getElementById(id);
  if (container) {
    container.appendChild(element);
  }
}

// ============ KNOBS ============
const knobVolume = createKnob({
  label: 'VOL',
  min: 0,
  max: 100,
  value: 50,
  color: 'purple',
  onChange: (v) => {
    const display = document.getElementById('knob-volume-value');
    if (display) display.textContent = String(Math.round(v));
  }
});
mount('knob-volume', knobVolume.element);

const knobPan = createKnob({
  label: 'PAN',
  min: -100,
  max: 100,
  value: 0,
  color: 'cyan',
  onChange: (v) => {
    const display = document.getElementById('knob-pan-value');
    if (display) display.textContent = String(Math.round(v));
  }
});
mount('knob-pan', knobPan.element);

const knobFilter = createKnob({
  label: 'FILT',
  min: 0,
  max: 100,
  value: 100,
  color: 'magenta',
  onChange: (v) => {
    const display = document.getElementById('knob-filter-value');
    if (display) display.textContent = String(Math.round(v));
  }
});
mount('knob-filter', knobFilter.element);

const knobResonance = createKnob({
  label: 'RES',
  min: 0,
  max: 100,
  value: 0,
  color: 'green',
  onChange: (v) => {
    const display = document.getElementById('knob-resonance-value');
    if (display) display.textContent = String(Math.round(v));
  }
});
mount('knob-resonance', knobResonance.element);

// ============ BUTTONS ============
const ledButton1 = createLedButton({
  label: 'MUTE',
  color: 'purple',
  active: false,
  onClick: (active) => showToast(`Mute: ${active ? 'ON' : 'OFF'}`, 'info')
});
mount('led-button-1', ledButton1.element);

const ledButton2 = createLedButton({
  label: 'SOLO',
  color: 'cyan',
  active: false,
  onClick: (active) => showToast(`Solo: ${active ? 'ON' : 'OFF'}`, 'info')
});
mount('led-button-2', ledButton2.element);

const ledButton3 = createLedButton({
  label: 'REC',
  color: 'green',
  active: true,
  onClick: (active) => showToast(`Record: ${active ? 'ON' : 'OFF'}`, 'info')
});
mount('led-button-3', ledButton3.element);

const machineButton = createMachineButton({
  label: 'START',
  color: 'cyan',
  onClick: () => showToast('Machine button clicked!', 'success')
});
mount('machine-button-1', machineButton.element);

const actionButton = createActionButton({
  text: 'SAVE',
  iconHtml: '💾',
  onClick: () => showToast('Saved!', 'success')
});
mount('action-button-1', actionButton.element);

// ============ STEP BUTTONS ============
const stepContainer = document.getElementById('step-buttons-container');
if (stepContainer) {
  for (let i = 0; i < 16; i++) {
    const step = createStepButton({
      stepNumber: i + 1,
      value: i % 4 === 0 ? 1 : 0,
      onClick: (value) => {
        console.log(`Step ${i}: ${value}`);
      }
    });
    stepContainer.appendChild(step.element);
  }
}

// ============ PATTERN BANK ============
const patternBank = createPatternBank({
  activeColor: 'cyan',
  label: 'PATTERNS',
  onSelect: (id) => showToast(`Pattern ${id} selected`, 'info'),
  onCopy: (from, to) => showToast(`Copied ${from} → ${to}`, 'success'),
  onClear: (id) => showToast(`Cleared pattern ${id}`, 'warning')
});
mount('pattern-bank-container', patternBank.element);

// ============ KEYBOARD ============
const keyboard = createKeyboard({
  numKeys: 25,
  rootNote: 48,
  onNoteOn: (note, freq) => {
    console.log(`Note ON: ${note} (${freq.toFixed(2)} Hz)`);
    showToast(`Note ${note}: ${freq.toFixed(1)} Hz`, 'info');
  },
  onNoteOff: (note) => {
    console.log(`Note OFF: ${note}`);
  }
});
mount('keyboard-container', keyboard.element);

// ============ PIANO ROLL ============
const pianoRoll = createPianoRoll({
  steps: 16,
  numKeys: 12,
  bpm: 120,
  trackNames: ['Lead', 'Bass', 'Pad', 'Arp'],
  onPlay: (step, notes) => {
    console.log(`Playing step ${step}`, notes);
  }
});
mount('piano-roll-container', pianoRoll.element);

document.getElementById('piano-roll-play')?.addEventListener('click', () => {
  pianoRoll.start();
  showToast('Playing...', 'info');
});

document.getElementById('piano-roll-stop')?.addEventListener('click', () => {
  pianoRoll.stop();
  showToast('Stopped', 'info');
});

document.getElementById('piano-roll-clear')?.addEventListener('click', () => {
  pianoRoll.clearAll();
  showToast('Cleared all tracks', 'warning');
});

// ============ SPECTRUM ANALYZER ============
let audioContext: AudioContext | null = null;
let analyser: AnalyserNode | null = null;
let spectrumAnalyzer: ReturnType<typeof createSpectrumAnalyzer> | null = null;

document.getElementById('spectrum-start')?.addEventListener('click', async () => {
  if (!audioContext) {
    audioContext = new AudioContext();
    analyser = audioContext.createAnalyser();
    analyser.fftSize = 256;

    // Create oscillator for demo
    const osc = audioContext.createOscillator();
    const gain = audioContext.createGain();
    gain.gain.value = 0.3;

    osc.type = 'sawtooth';
    osc.frequency.value = 220;
    osc.connect(gain);
    gain.connect(analyser);
    analyser.connect(audioContext.destination);
    osc.start();

    // Add some modulation
    const lfo = audioContext.createOscillator();
    lfo.frequency.value = 2;
    const lfoGain = audioContext.createGain();
    lfoGain.gain.value = 50;
    lfo.connect(lfoGain);
    lfoGain.connect(osc.frequency);
    lfo.start();

    spectrumAnalyzer = createSpectrumAnalyzer({
      color: 'cyan'
    });
    mount('spectrum-container', spectrumAnalyzer.element);

    // Animation loop
    const dataArray = new Uint8Array(analyser.frequencyBinCount);
    function animate() {
      if (analyser && spectrumAnalyzer) {
        analyser.getByteFrequencyData(dataArray);
        spectrumAnalyzer.update(dataArray);
      }
      requestAnimationFrame(animate);
    }
    animate();

    showToast('Audio started!', 'success');
  }
});

// ============ TOASTS ============
document.getElementById('toast-info')?.addEventListener('click', () => {
  showToast('This is an info message', 'info');
});

document.getElementById('toast-success')?.addEventListener('click', () => {
  showToast('Operation completed successfully!', 'success');
});

document.getElementById('toast-error')?.addEventListener('click', () => {
  showToast('An error occurred', 'error');
});

document.getElementById('toast-warning')?.addEventListener('click', () => {
  showToast('Warning: Check your settings', 'warning');
});

console.log('@neon/ui Playground loaded');
