/* ==========================================================================
   NEON NOISE - Main Application
   ========================================================================== */

import { AudioEngine } from './audio-engine';
import {
  createKnob,
  createLedButton,
  createMachineButton,
  createSpectrumAnalyzer,
  showToast,
  el,
  type KnobComponent,
  type LedButtonComponent,
  type MachineButtonComponent,
  type SpectrumAnalyzerComponent
} from '@neon/ui';
import { AdaptiveNoise, VinylEffect } from '@neon/fx';
import { setupCloud } from './cloud';

type NoiseType = 'white' | 'pink' | 'brown' | 'green';

// --------------------------------------------------------------------------
// DOM ELEMENTS
// --------------------------------------------------------------------------
const saveBtn = el('save-btn') as HTMLButtonElement | null;
const loadBtn = el('load-btn') as HTMLButtonElement | null;
const powerBtn = el('power-btn') as HTMLButtonElement | null;
const masterKnobContainer = el('master-knob');
const channelsContainer = el('channels');
const adaptiveControls = el('adaptive-controls');
const adaptiveSection = el('adaptive-section');
const vinylControls = el('vinyl-controls');
const micVizContainer = el('mic-viz-container');
const visualizerContainer = el('visualizer-container');
const statusText = el('status-text');

// --------------------------------------------------------------------------
// STATE
// --------------------------------------------------------------------------
const engine = new AudioEngine();
let vinylEffect: VinylEffect | null = null;
let adaptivePlugin: AdaptiveNoise | null = null;
let micStream: MediaStream | null = null;
let micSource: MediaStreamAudioSourceNode | null = null;
let adaptiveBaseVolumes: Record<string, number> = {};
const lastKnobValues: Record<string, number> = { white: 0, pink: 0, brown: 0, green: 0 };
let knobUpdateTimeout: ReturnType<typeof setTimeout> | null = null;
let isRunning = false;
let animationFrame: number | null = null;

// --------------------------------------------------------------------------
// STATUS
// --------------------------------------------------------------------------
function setStatus(message: string): void {
  if (statusText) statusText.textContent = message;
}

// --------------------------------------------------------------------------
// SPECTRUM ANALYZERS
// --------------------------------------------------------------------------
const outputAnalyzer: SpectrumAnalyzerComponent = createSpectrumAnalyzer({
  label: 'OUTPUT',
  color: 'cyan',
  mode: 'bars',
  smoothing: 0.7
});
visualizerContainer?.appendChild(outputAnalyzer.element);

const micAnalyzer: SpectrumAnalyzerComponent = createSpectrumAnalyzer({
  label: 'MIC INPUT',
  color: 'magenta',
  mode: 'bars',
  smoothing: 0.6
});
micVizContainer?.appendChild(micAnalyzer.element);

// --------------------------------------------------------------------------
// MASTER VOLUME KNOB
// --------------------------------------------------------------------------
const masterKnob: KnobComponent = createKnob({
  value: 70,
  min: 0,
  max: 100,
  color: 'yellow',
  size: 'small',
  onChange: (val) => {
    engine.setMasterVolume(val / 100);
  }
});
masterKnobContainer?.appendChild(masterKnob.element);
engine.setMasterVolume(0.7);

// --------------------------------------------------------------------------
// NOISE CHANNEL KNOBS
// --------------------------------------------------------------------------
interface NoiseChannel {
  type: NoiseType;
  label: string;
  color: 'orange' | 'magenta' | 'green' | 'cyan';
  defaultValue: number;
}

const noiseChannels: NoiseChannel[] = [
  { type: 'brown', label: 'BROWN', color: 'orange', defaultValue: 50 },
  { type: 'pink', label: 'PINK', color: 'magenta', defaultValue: 50 },
  { type: 'green', label: 'GREEN', color: 'green', defaultValue: 50 },
  { type: 'white', label: 'WHITE', color: 'cyan', defaultValue: 50 }
];

const channelKnobs: Record<NoiseType, KnobComponent> = {} as Record<NoiseType, KnobComponent>;
const channelToggles: Record<NoiseType, LedButtonComponent> = {} as Record<NoiseType, LedButtonComponent>;
const channelEnabled: Record<NoiseType, boolean> = { brown: true, pink: true, green: true, white: true };

noiseChannels.forEach(channel => {
  const wrapper = document.createElement('div');
  wrapper.className = `channel-knob ${channel.type}`;

  const knob = createKnob({
    label: channel.label,
    value: channel.defaultValue,
    min: 0,
    max: 100,
    color: channel.color,
    size: 'large',
    onChange: (val) => {
      if (channelEnabled[channel.type]) {
        engine.setChannelVolume(channel.type, val / 100);
      }
    }
  });

  const toggle = createLedButton({
    label: 'ON',
    color: channel.color,
    toggle: true,
    active: true,
    size: 'small',
    onClick: (active) => {
      channelEnabled[channel.type] = active;
      if (active) {
        engine.setChannelVolume(channel.type, knob.getValue() / 100);
      } else {
        engine.setChannelVolume(channel.type, 0);
      }
    }
  });

  wrapper.appendChild(knob.element);
  wrapper.appendChild(toggle.element);
  channelsContainer?.appendChild(wrapper);
  channelKnobs[channel.type] = knob;
  channelToggles[channel.type] = toggle;

  engine.setChannelVolume(channel.type, channel.defaultValue / 100);
});

// --------------------------------------------------------------------------
// ADAPTIVE MODE CONTROLS
// --------------------------------------------------------------------------
const adaptiveButton: LedButtonComponent = createLedButton({
  label: 'ADAPTIVE',
  color: 'magenta',
  toggle: true,
  onClick: toggleAdaptive
});
adaptiveControls?.appendChild(adaptiveButton.element);

const calibrateButton: MachineButtonComponent = createMachineButton({
  label: 'CALIBRATE',
  color: 'cyan',
  onClick: calibrateToEnvironment
});
calibrateButton.element.id = 'calibrate-btn';
adaptiveControls?.appendChild(calibrateButton.element);

const sensitivityKnob: KnobComponent = createKnob({
  label: 'SENSITIVITY',
  value: 50,
  min: 0,
  max: 100,
  color: 'purple',
  onChange: (val) => {
    if (adaptivePlugin) {
      adaptivePlugin.setParam('sensitivity', val);
    }
  }
});
adaptiveControls?.appendChild(sensitivityKnob.element);

// --------------------------------------------------------------------------
// VINYL EFFECT CONTROLS
// --------------------------------------------------------------------------
interface VinylKnobs {
  level: KnobComponent;
  vinylToggle: LedButtonComponent;
  hiss: KnobComponent;
  crackle: KnobComponent;
  clunkToggle: LedButtonComponent;
  rpm33Btn: HTMLButtonElement;
  rpm45Btn: HTMLButtonElement;
}

const vinylKnobs: Partial<VinylKnobs> = {};
let vinylOutputLevel = 0.3;
let vinylEnabled = true;

// Level control group
const levelGroup = document.createElement('div');
levelGroup.className = 'vinyl-control-group';

const levelKnob = createKnob({
  label: 'LEVEL',
  value: 30,
  min: 0,
  max: 100,
  color: 'yellow',
  onChange: (val) => {
    vinylOutputLevel = val / 100;
    if (vinylEffect && vinylEnabled) {
      vinylEffect.setOutputLevel(vinylOutputLevel);
    }
  }
});
levelGroup.appendChild(levelKnob.element);

const vinylToggle = createLedButton({
  label: 'ON',
  color: 'yellow',
  toggle: true,
  active: true,
  size: 'small',
  onClick: (active) => {
    vinylEnabled = active;
    if (vinylEffect) {
      vinylEffect.setOutputLevel(active ? vinylOutputLevel : 0);
    }
  }
});
levelGroup.appendChild(vinylToggle.element);
vinylControls?.appendChild(levelGroup);
vinylKnobs.level = levelKnob;
vinylKnobs.vinylToggle = vinylToggle;

// Hiss control group
const hissGroup = document.createElement('div');
hissGroup.className = 'vinyl-control-group';

const hissKnob = createKnob({
  label: 'HISS',
  value: 50,
  min: 0,
  max: 100,
  color: 'yellow',
  onChange: (val) => {
    if (vinylEffect) {
      vinylEffect.setHissLevel(val / 100);
    }
  }
});
hissGroup.appendChild(hissKnob.element);
vinylControls?.appendChild(hissGroup);
vinylKnobs.hiss = hissKnob;

// Crackle control group
const crackleGroup = document.createElement('div');
crackleGroup.className = 'vinyl-control-group';

const crackleKnob = createKnob({
  label: 'CRACKLE',
  value: 50,
  min: 0,
  max: 100,
  color: 'yellow',
  onChange: (val) => {
    if (vinylEffect) {
      vinylEffect.setCrackleIntensity(val / 100);
    }
  }
});
crackleGroup.appendChild(crackleKnob.element);
vinylControls?.appendChild(crackleGroup);
vinylKnobs.crackle = crackleKnob;

// Clunk control group
const clunkGroup = document.createElement('div');
clunkGroup.className = 'vinyl-control-group';

const clunkLabel = document.createElement('div');
clunkLabel.className = 'group-label';
clunkLabel.textContent = 'CLUNK';
clunkGroup.appendChild(clunkLabel);

const clunkToggleRow = document.createElement('div');
clunkToggleRow.className = 'vinyl-toggle-row';

const clunkToggle = createLedButton({
  label: 'ON',
  color: 'yellow',
  toggle: true,
  size: 'small',
  onClick: (active) => {
    if (vinylEffect) {
      vinylEffect.setClunkEnabled(active);
    }
  }
});
clunkToggleRow.appendChild(clunkToggle.element);

// RPM selector
const rpmToggle = document.createElement('div');
rpmToggle.className = 'vinyl-rpm-toggle';

const rpm33Btn = document.createElement('button');
rpm33Btn.textContent = '33';
rpm33Btn.className = 'active';
rpm33Btn.addEventListener('click', () => {
  rpm33Btn.classList.add('active');
  rpm45Btn.classList.remove('active');
  if (vinylEffect) {
    vinylEffect.setClunkSpeed('33');
  }
});

const rpm45Btn = document.createElement('button');
rpm45Btn.textContent = '45';
rpm45Btn.addEventListener('click', () => {
  rpm45Btn.classList.add('active');
  rpm33Btn.classList.remove('active');
  if (vinylEffect) {
    vinylEffect.setClunkSpeed('45');
  }
});

rpmToggle.appendChild(rpm33Btn);
rpmToggle.appendChild(rpm45Btn);
clunkToggleRow.appendChild(rpmToggle);
clunkGroup.appendChild(clunkToggleRow);
vinylControls?.appendChild(clunkGroup);

vinylKnobs.clunkToggle = clunkToggle;
vinylKnobs.rpm33Btn = rpm33Btn;
vinylKnobs.rpm45Btn = rpm45Btn;

// --------------------------------------------------------------------------
// POWER TOGGLE
// --------------------------------------------------------------------------
async function togglePower(): Promise<void> {
  if (engine.isFading) {
    engine.instantStop();
    if (vinylEffect) {
      vinylEffect.stop();
    }
    isRunning = false;
    powerBtn?.classList.remove('playing', 'warming-up', 'cooling-down');
    setStatus('READY');
    if (animationFrame) cancelAnimationFrame(animationFrame);
    outputAnalyzer.clear();
    micAnalyzer.clear();
    return;
  }

  if (!isRunning) {
    isRunning = true;
    powerBtn?.classList.add('warming-up');
    setStatus('WARMING UP');
    draw();

    await engine.start();

    if (!vinylEffect && engine.context) {
      vinylEffect = new VinylEffect(engine.context);
      vinylEffect.connect(engine.masterGain!);
      vinylEffect.setHissLevel(vinylKnobs.hiss!.getValue() / 100);
      vinylEffect.setCrackleEnabled(true);
      vinylEffect.setCrackleIntensity(vinylKnobs.crackle!.getValue() / 100);
      vinylEffect.setOutputLevel(vinylEnabled ? vinylOutputLevel : 0);
    }
    if (vinylEffect) {
      vinylEffect.start();
    }

    powerBtn?.classList.remove('warming-up');
    powerBtn?.classList.add('playing');
    setStatus('GENERATING NOISE');
    showToast('Noise generation started', 'success');
  } else {
    if (adaptivePlugin && adaptivePlugin.isRunning) {
      adaptivePlugin.stop();
      if (knobUpdateTimeout) {
        clearTimeout(knobUpdateTimeout);
        knobUpdateTimeout = null;
      }
      Object.keys(adaptiveBaseVolumes).forEach(type => {
        if (type === 'master' || type === 'vinylHiss') return;
        const baseVolume = adaptiveBaseVolumes[type];
        if (channelKnobs[type as NoiseType]) {
          channelKnobs[type as NoiseType].setValue(Math.round(baseVolume * 100));
        }
        if (channelEnabled[type as NoiseType] && engine.channels[type as NoiseType]?.gain) {
          engine.setChannelVolume(type as NoiseType, baseVolume);
        }
      });
      if (vinylEffect && adaptiveBaseVolumes.vinylHiss !== undefined) {
        vinylEffect.setHissLevel(adaptiveBaseVolumes.vinylHiss);
        vinylKnobs.hiss!.setValue(Math.round(adaptiveBaseVolumes.vinylHiss * 100));
      }
      adaptiveButton.setActive(false);
      micVizContainer?.classList.add('hidden');
      adaptiveSection?.classList.remove('active');
    }

    if (vinylEffect) {
      vinylEffect.stop();
    }

    powerBtn?.classList.remove('playing');
    powerBtn?.classList.remove('warming-up');
    powerBtn?.classList.add('cooling-down');
    setStatus('COOLING DOWN');

    await engine.stop();

    isRunning = false;
    powerBtn?.classList.remove('cooling-down');
    setStatus('READY');
    showToast('Noise generation stopped', 'info');
    if (animationFrame) cancelAnimationFrame(animationFrame);
    outputAnalyzer.clear();
    micAnalyzer.clear();
  }
}

powerBtn?.addEventListener('click', togglePower);

// --------------------------------------------------------------------------
// ADAPTIVE MODE TOGGLE
// --------------------------------------------------------------------------
async function toggleAdaptive(active: boolean): Promise<void> {
  if (!isRunning && active) {
    isRunning = true;
    powerBtn?.classList.add('warming-up');
    setStatus('WARMING UP');
    draw();

    await engine.start();

    if (!vinylEffect && engine.context) {
      vinylEffect = new VinylEffect(engine.context);
      vinylEffect.connect(engine.masterGain!);
      vinylEffect.setHissLevel(vinylKnobs.hiss!.getValue() / 100);
      vinylEffect.setCrackleEnabled(true);
      vinylEffect.setCrackleIntensity(vinylKnobs.crackle!.getValue() / 100);
      vinylEffect.setOutputLevel(vinylEnabled ? vinylOutputLevel : 0);
    }
    if (vinylEffect) {
      vinylEffect.start();
    }

    powerBtn?.classList.remove('warming-up');
    powerBtn?.classList.add('playing');
    setStatus('GENERATING NOISE');
  }

  if (active) {
    adaptiveBaseVolumes = { ...engine.volumes };
    if (vinylEffect) {
      adaptiveBaseVolumes.vinylHiss = vinylEffect.vinylParams.hissLevel;
    }

    if (!adaptivePlugin) {
      adaptivePlugin = new AdaptiveNoise(engine.context!, {
        sensitivity: sensitivityKnob.getValue(),
        onUpdate: (controlValues) => {
          Object.keys(controlValues).forEach(type => {
            if (type === 'master') return;
            if (!channelEnabled[type as NoiseType]) return;

            const baseVolume = adaptiveBaseVolumes[type];
            const boost = controlValues[type as NoiseType];
            const targetVolume = Math.min(1, baseVolume + boost);

            if (engine.channels[type as NoiseType] && engine.channels[type as NoiseType].gain) {
              engine.channels[type as NoiseType].gain!.gain.setTargetAtTime(
                targetVolume,
                engine.context!.currentTime,
                0.1
              );
            }

            lastKnobValues[type] = Math.round(targetVolume * 100);
          });

          if (vinylEffect && adaptiveBaseVolumes.vinylHiss !== undefined) {
            const vinylBoost = (controlValues.brown * 0.6 + controlValues.pink * 0.4);
            const targetVinylHiss = Math.min(1, adaptiveBaseVolumes.vinylHiss + vinylBoost);
            vinylEffect.setHissLevel(targetVinylHiss);
            lastKnobValues.vinylHiss = Math.round(targetVinylHiss * 100);
          }

          if (!knobUpdateTimeout) {
            knobUpdateTimeout = setTimeout(() => {
              Object.keys(lastKnobValues).forEach(type => {
                if (channelKnobs[type as NoiseType]) {
                  channelKnobs[type as NoiseType].setValue(lastKnobValues[type]);
                }
              });
              if (lastKnobValues.vinylHiss !== undefined) {
                vinylKnobs.hiss!.setValue(lastKnobValues.vinylHiss);
              }
              knobUpdateTimeout = null;
            }, 100);
          }
        }
      });
    }

    if (!micStream) {
      try {
        micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
        micSource = engine.context!.createMediaStreamSource(micStream);
        micSource.connect(adaptivePlugin.sidechainInput);
      } catch (e) {
        console.error('Mic access denied:', e);
        showToast('Microphone access denied', 'error');
        adaptiveButton.setActive(false);
        return;
      }
    }

    adaptivePlugin.start();
    micVizContainer?.classList.remove('hidden');
    requestAnimationFrame(() => micAnalyzer.resize());
    adaptiveSection?.classList.add('active');
    setStatus('ADAPTIVE MODE - LISTENING');
    showToast('Adaptive mode enabled - listening to environment', 'success');
  } else {
    if (adaptivePlugin) {
      adaptivePlugin.stop();
      if (knobUpdateTimeout) {
        clearTimeout(knobUpdateTimeout);
        knobUpdateTimeout = null;
      }
      Object.keys(adaptiveBaseVolumes).forEach(type => {
        if (type === 'master') return;
        const baseVolume = adaptiveBaseVolumes[type];
        engine.setChannelVolume(type as NoiseType, baseVolume);
        if (channelKnobs[type as NoiseType]) {
          channelKnobs[type as NoiseType].setValue(Math.round(baseVolume * 100));
        }
      });
    }
    micVizContainer?.classList.add('hidden');
    adaptiveSection?.classList.remove('active');
    setStatus(isRunning ? 'GENERATING NOISE' : 'READY');
    showToast('Adaptive mode disabled', 'info');
  }

  adaptiveButton.setActive(active);
}

// --------------------------------------------------------------------------
// CALIBRATE TO ENVIRONMENT
// --------------------------------------------------------------------------
async function calibrateToEnvironment(): Promise<void> {
  if (!isRunning) {
    await engine.start();
    isRunning = true;
    powerBtn?.classList.add('playing');
    setStatus('GENERATING NOISE');
    draw();
  }

  let tempMicStream = micStream;
  let tempMicSource = micSource;
  let tempAnalyser: AnalyserNode | null = null;

  if (!tempMicStream) {
    try {
      tempMicStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      tempMicSource = engine.context!.createMediaStreamSource(tempMicStream);
    } catch (e) {
      console.error('Mic access denied:', e);
      showToast('Microphone access denied', 'error');
      return;
    }
  }

  tempAnalyser = engine.context!.createAnalyser();
  tempAnalyser.fftSize = 512;
  tempMicSource!.connect(tempAnalyser);

  calibrateButton.setActive(true);
  setStatus('CALIBRATING...');
  showToast('Listening to environment...', 'info');

  const samples: Uint8Array[] = [];
  const sampleCount = 15;
  const sampleInterval = 100;

  for (let i = 0; i < sampleCount; i++) {
    await new Promise(resolve => setTimeout(resolve, sampleInterval));

    const dataArray = new Uint8Array(tempAnalyser.frequencyBinCount);
    tempAnalyser.getByteFrequencyData(dataArray);
    samples.push(dataArray);
  }

  const avgData = new Uint8Array(tempAnalyser.frequencyBinCount);
  for (let i = 0; i < avgData.length; i++) {
    let sum = 0;
    for (const sample of samples) {
      sum += sample[i];
    }
    avgData[i] = Math.round(sum / samples.length);
  }

  const getRangeEnergy = (startBin: number, endBin: number): number => {
    let sum = 0;
    for (let i = startBin; i <= endBin && i < avgData.length; i++) {
      sum += avgData[i];
    }
    return sum / (endBin - startBin + 1) / 255;
  };

  const energies: Record<NoiseType, number> = {
    brown: getRangeEnergy(0, 4),
    pink: getRangeEnergy(5, 15),
    green: getRangeEnergy(16, 50),
    white: getRangeEnergy(51, 150)
  };

  const overallEnergy = getRangeEnergy(0, Math.min(150, avgData.length - 1));
  const silenceThreshold = 0.05;
  const quietThreshold = 0.15;

  const sensitivity = sensitivityKnob.getValue() / 100;
  const newVolumes: Record<NoiseType, number> = {} as Record<NoiseType, number>;

  if (overallEnergy < silenceThreshold) {
    (Object.keys(energies) as NoiseType[]).forEach(type => {
      newVolumes[type] = 0;
    });
  } else if (overallEnergy < quietThreshold) {
    const volumeScale = overallEnergy / quietThreshold;
    (Object.keys(energies) as NoiseType[]).forEach(type => {
      newVolumes[type] = Math.min(1, energies[type] * volumeScale * sensitivity * 2);
    });
  } else {
    const volumeScale = Math.min(1, overallEnergy / 0.4);
    (Object.keys(energies) as NoiseType[]).forEach(type => {
      const bandBoost = energies[type] * sensitivity;
      newVolumes[type] = Math.min(1, bandBoost * volumeScale * 1.5);
    });
  }

  (Object.keys(newVolumes) as NoiseType[]).forEach(type => {
    const targetVolume = newVolumes[type];
    engine.setChannelVolume(type, targetVolume);
    if (channelKnobs[type]) {
      channelKnobs[type].setValue(Math.round(targetVolume * 100));
    }
  });

  tempMicSource!.disconnect(tempAnalyser);

  if (!micStream && tempMicStream) {
    micStream = tempMicStream;
    micSource = tempMicSource;
  }

  calibrateButton.setActive(false);
  setStatus('CALIBRATED');

  if (overallEnergy < silenceThreshold) {
    showToast('Silent environment - noise disabled', 'info');
  } else if (overallEnergy < quietThreshold) {
    showToast('Quiet environment - minimal noise', 'info');
  } else {
    showToast('Noise levels adjusted to mask environment', 'success');
  }

  setTimeout(() => {
    if (isRunning && !adaptiveButton.isActive?.()) {
      setStatus('GENERATING NOISE');
    }
  }, 2000);
}

// --------------------------------------------------------------------------
// VISUALIZATION LOOP
// --------------------------------------------------------------------------
function draw(): void {
  animationFrame = requestAnimationFrame(draw);

  if ((engine.isRunning || engine.isFading) && engine.analyser) {
    const bufferLength = engine.analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    engine.getAnalyserData(dataArray);
    outputAnalyzer.update(dataArray);
  }

  if (adaptivePlugin && adaptivePlugin.isRunning && adaptivePlugin.analyser) {
    const micData = new Uint8Array(adaptivePlugin.analyser.frequencyBinCount);
    adaptivePlugin.analyser.getByteFrequencyData(micData);
    micAnalyzer.update(micData);
  }
}

// --------------------------------------------------------------------------
// KEYBOARD SHORTCUTS
// --------------------------------------------------------------------------
document.addEventListener('keydown', (e) => {
  if (e.code === 'Space' && !(e.target as HTMLElement).matches('input, textarea')) {
    e.preventDefault();
    togglePower();
  }
});

// --------------------------------------------------------------------------
// SYNC KNOBS (for loading presets)
// --------------------------------------------------------------------------
function syncKnobs(): void {
  (Object.keys(channelKnobs) as NoiseType[]).forEach(type => {
    channelKnobs[type].setValue(engine.volumes[type] * 100);
    if (channelToggles[type]) {
      channelToggles[type].setActive(channelEnabled[type]);
    }
  });
  masterKnob.setValue(engine.volumes.master * 100);
  if (adaptivePlugin) {
    sensitivityKnob.setValue(adaptivePlugin.getParam('sensitivity'));
  }
  if (vinylEffect) {
    const currentLevel = vinylEffect.output.gain.value;
    vinylEnabled = currentLevel > 0;
    vinylOutputLevel = vinylEnabled ? currentLevel : vinylOutputLevel;
    vinylKnobs.level!.setValue(vinylOutputLevel * 100);
    vinylKnobs.vinylToggle!.setActive(vinylEnabled);
    vinylKnobs.hiss!.setValue(vinylEffect.vinylParams.hissLevel * 100);
    vinylKnobs.crackle!.setValue(vinylEffect.vinylParams.crackleIntensity * 100);
    vinylKnobs.clunkToggle!.setActive(vinylEffect.vinylParams.clunkEnabled);
    if (vinylEffect.vinylParams.clunkSpeed === '33') {
      vinylKnobs.rpm33Btn!.classList.add('active');
      vinylKnobs.rpm45Btn!.classList.remove('active');
    } else {
      vinylKnobs.rpm45Btn!.classList.add('active');
      vinylKnobs.rpm33Btn!.classList.remove('active');
    }
  }
}

function getChannelEnabled(): Record<string, boolean> {
  return { ...channelEnabled };
}

function setChannelEnabled(state: Record<string, boolean>): void {
  if (!state) return;
  (Object.keys(state) as NoiseType[]).forEach(type => {
    if (typeof state[type] === 'boolean') {
      channelEnabled[type] = state[type];
      if (state[type]) {
        engine.setChannelVolume(type, channelKnobs[type]?.getValue() / 100 || 0);
      } else {
        engine.setChannelVolume(type, 0);
      }
    }
  });
}

// --------------------------------------------------------------------------
// CLOUD INTEGRATION
// --------------------------------------------------------------------------
try {
  const room = new WebsimSocket();
  setupCloud(room, {
    engine,
    syncKnobs,
    saveBtn,
    loadBtn,
    getVinylEffect: () => vinylEffect,
    getChannelEnabled,
    setChannelEnabled
  });
} catch (e) {
  console.warn('Cloud features unavailable:', (e as Error).message);
}

// --------------------------------------------------------------------------
// INITIALIZATION
// --------------------------------------------------------------------------
setStatus('READY');
