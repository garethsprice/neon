/* ==========================================================================
   NEON NOISE - Main Application
   Built on create-neon-app patterns
   ========================================================================== */

import { NoiseEngine } from './noise-engine.js';
import { VinylEffect } from './vinyl-effect.js';
import {
    createKnob,
    createLedButton,
    createMachineButton,
    createSpectrumAnalyzer,
    showToast
} from '../neon-ui/index.js';
import { AdaptiveNoise } from '../neon-fx/index.js';
import { setupCloud } from './cloud.js';

// --------------------------------------------------------------------------
// DOM ELEMENTS
// --------------------------------------------------------------------------
const saveBtn = document.getElementById('save-btn');
const loadBtn = document.getElementById('load-btn');
const powerBtn = document.getElementById('power-btn');
const masterKnobContainer = document.getElementById('master-knob');
const channelsContainer = document.getElementById('channels');
const adaptiveControls = document.getElementById('adaptive-controls');
const adaptiveSection = document.getElementById('adaptive-section');
const vinylControls = document.getElementById('vinyl-controls');
const micVizContainer = document.getElementById('mic-viz-container');
const visualizerContainer = document.getElementById('visualizer-container');
const statusText = document.getElementById('status-text');

// --------------------------------------------------------------------------
// STATE
// --------------------------------------------------------------------------
const engine = new NoiseEngine();
let vinylEffect = null;
let adaptivePlugin = null;
let micStream = null;
let micSource = null;
let adaptiveBaseVolumes = {};
let lastKnobValues = { white: 0, pink: 0, brown: 0, green: 0 };
let knobUpdateTimeout = null;
let isRunning = false;
let animationFrame = null;

// --------------------------------------------------------------------------
// STATUS
// --------------------------------------------------------------------------
function setStatus(message) {
    statusText.textContent = message;
}

// --------------------------------------------------------------------------
// SPECTRUM ANALYZERS
// --------------------------------------------------------------------------
const outputAnalyzer = createSpectrumAnalyzer({
    label: 'OUTPUT',
    color: 'neon',
    mode: 'bars',
    smoothing: 0.7
});
visualizerContainer.appendChild(outputAnalyzer.element);

const micAnalyzer = createSpectrumAnalyzer({
    label: 'MIC INPUT',
    color: 'magenta',
    mode: 'bars',
    smoothing: 0.6
});
micVizContainer.appendChild(micAnalyzer.element);

// --------------------------------------------------------------------------
// MASTER VOLUME KNOB
// --------------------------------------------------------------------------
const masterKnob = createKnob({
    value: 70,
    min: 0,
    max: 100,
    color: 'yellow',
    size: 'small',
    onChange: (val) => {
        engine.setMasterVolume(val / 100);
    }
});
masterKnobContainer.appendChild(masterKnob.element);
engine.setMasterVolume(0.7);

// --------------------------------------------------------------------------
// NOISE CHANNEL KNOBS
// --------------------------------------------------------------------------
const noiseChannels = [
    { type: 'brown', label: 'BROWN', color: 'orange', defaultValue: 50 },
    { type: 'pink', label: 'PINK', color: 'magenta', defaultValue: 50 },
    { type: 'green', label: 'GREEN', color: 'green', defaultValue: 50 },
    { type: 'white', label: 'WHITE', color: 'cyan', defaultValue: 50 }
];

const channelKnobs = {};
const channelToggles = {};
const channelEnabled = { brown: true, pink: true, green: true, white: true };

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
            // Only apply volume if channel is enabled
            if (channelEnabled[channel.type]) {
                engine.setChannelVolume(channel.type, val / 100);
            }
        }
    });

    const toggle = createLedButton({
        label: 'ON',
        color: channel.color,
        toggle: true,
        active: true, // Start enabled
        size: 'small',
        onClick: (active) => {
            channelEnabled[channel.type] = active;
            if (active) {
                // Restore volume from knob
                engine.setChannelVolume(channel.type, knob.getValue() / 100);
            } else {
                // Mute channel
                engine.setChannelVolume(channel.type, 0);
            }
        }
    });

    wrapper.appendChild(knob.element);
    wrapper.appendChild(toggle.element);
    channelsContainer.appendChild(wrapper);
    channelKnobs[channel.type] = knob;
    channelToggles[channel.type] = toggle;

    // Set initial volume
    engine.setChannelVolume(channel.type, channel.defaultValue / 100);
});

// --------------------------------------------------------------------------
// ADAPTIVE MODE CONTROLS
// --------------------------------------------------------------------------
const adaptiveButton = createLedButton({
    label: 'ADAPTIVE',
    color: 'magenta',
    toggle: true,
    onClick: toggleAdaptive
});
adaptiveControls.appendChild(adaptiveButton.element);

const calibrateButton = createMachineButton({
    label: 'CALIBRATE',
    color: 'cyan',
    onClick: calibrateToEnvironment
});
calibrateButton.element.id = 'calibrate-btn';
adaptiveControls.appendChild(calibrateButton.element);

const sensitivityKnob = createKnob({
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
adaptiveControls.appendChild(sensitivityKnob.element);

// --------------------------------------------------------------------------
// VINYL EFFECT CONTROLS
// --------------------------------------------------------------------------
let vinylKnobs = {};
let vinylOutputLevel = 0.3; // Default vinyl mix level
let vinylEnabled = true;

// Level (output gain) control group
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
vinylControls.appendChild(levelGroup);
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
vinylControls.appendChild(hissGroup);
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
vinylControls.appendChild(crackleGroup);
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
vinylControls.appendChild(clunkGroup);

// Store toggle references for sync
vinylKnobs.clunkToggle = clunkToggle;
vinylKnobs.rpm33Btn = rpm33Btn;
vinylKnobs.rpm45Btn = rpm45Btn;

// --------------------------------------------------------------------------
// POWER TOGGLE
// --------------------------------------------------------------------------
async function togglePower() {
    // If fading (warming up or cooling down), instantly shut off
    if (engine.isFading) {
        engine.instantStop();
        if (vinylEffect) {
            vinylEffect.stop();
        }
        isRunning = false;
        powerBtn.classList.remove('playing', 'warming-up', 'cooling-down');
        setStatus('READY');
        cancelAnimationFrame(animationFrame);
        outputAnalyzer.clear();
        micAnalyzer.clear();
        return;
    }

    if (!isRunning) {
        // Start with warming-up state (blinking)
        isRunning = true;
        powerBtn.classList.add('warming-up');
        setStatus('WARMING UP');
        draw();

        // Wait for fade-in to complete
        await engine.start();

        // Initialize and start vinyl effect (needs audio context from engine)
        if (!vinylEffect && engine.context) {
            vinylEffect = new VinylEffect(engine.context);
            vinylEffect.connect(engine.masterGain);
            // Apply current knob values
            vinylEffect.setHissLevel(vinylKnobs.hiss.getValue() / 100);
            vinylEffect.setCrackleEnabled(true);
            vinylEffect.setCrackleIntensity(vinylKnobs.crackle.getValue() / 100);
            vinylEffect.setOutputLevel(vinylEnabled ? vinylOutputLevel : 0);
        }
        if (vinylEffect) {
            vinylEffect.start();
        }

        // Switch to fully playing state
        powerBtn.classList.remove('warming-up');
        powerBtn.classList.add('playing');
        setStatus('GENERATING NOISE');
        showToast('Noise generation started', 'success');
    } else {
        // Stop adaptive mode if running
        if (adaptivePlugin && adaptivePlugin.isRunning) {
            adaptivePlugin.stop();
            if (knobUpdateTimeout) {
                clearTimeout(knobUpdateTimeout);
                knobUpdateTimeout = null;
            }
            // Reset knobs to base values
            Object.keys(adaptiveBaseVolumes).forEach(type => {
                if (type === 'master' || type === 'vinylHiss') return;
                const baseVolume = adaptiveBaseVolumes[type];
                if (channelKnobs[type]) {
                    channelKnobs[type].setValue(Math.round(baseVolume * 100));
                }
                // Reset audio if channel is enabled
                if (channelEnabled[type] && engine.channels[type]?.gain) {
                    engine.setChannelVolume(type, baseVolume);
                }
            });
            // Reset vinyl hiss
            if (vinylEffect && adaptiveBaseVolumes.vinylHiss !== undefined) {
                vinylEffect.setHissLevel(adaptiveBaseVolumes.vinylHiss);
                vinylKnobs.hiss.setValue(Math.round(adaptiveBaseVolumes.vinylHiss * 100));
            }
            adaptiveButton.setActive(false);
            micVizContainer.classList.add('hidden');
            adaptiveSection.classList.remove('active');
        }

        // Stop vinyl effect
        if (vinylEffect) {
            vinylEffect.stop();
        }

        // Switch to cooling-down state (blinking LED)
        powerBtn.classList.remove('playing');
        powerBtn.classList.remove('warming-up');
        powerBtn.classList.add('cooling-down');
        setStatus('COOLING DOWN');

        // Wait for fade-out to complete
        await engine.stop();

        // Fully stopped
        isRunning = false;
        powerBtn.classList.remove('cooling-down');
        setStatus('READY');
        showToast('Noise generation stopped', 'info');
        cancelAnimationFrame(animationFrame);
        outputAnalyzer.clear();
        micAnalyzer.clear();
    }
}

powerBtn.addEventListener('click', togglePower);

// --------------------------------------------------------------------------
// ADAPTIVE MODE TOGGLE
// --------------------------------------------------------------------------
async function toggleAdaptive(active) {
    if (!isRunning && active) {
        // Start engine first with warming-up state
        isRunning = true;
        powerBtn.classList.add('warming-up');
        setStatus('WARMING UP');
        draw();

        await engine.start();

        // Initialize and start vinyl effect
        if (!vinylEffect && engine.context) {
            vinylEffect = new VinylEffect(engine.context);
            vinylEffect.connect(engine.masterGain);
            vinylEffect.setHissLevel(vinylKnobs.hiss.getValue() / 100);
            vinylEffect.setCrackleEnabled(true);
            vinylEffect.setCrackleIntensity(vinylKnobs.crackle.getValue() / 100);
            vinylEffect.setOutputLevel(vinylEnabled ? vinylOutputLevel : 0);
        }
        if (vinylEffect) {
            vinylEffect.start();
        }

        powerBtn.classList.remove('warming-up');
        powerBtn.classList.add('playing');
        setStatus('GENERATING NOISE');
    }

    if (active) {
        // Store base volumes (including vinyl)
        adaptiveBaseVolumes = { ...engine.volumes };
        if (vinylEffect) {
            adaptiveBaseVolumes.vinylHiss = vinylEffect.params.hissLevel;
        }

        // Create adaptive plugin if needed
        if (!adaptivePlugin) {
            adaptivePlugin = new AdaptiveNoise(engine.context, {
                sensitivity: sensitivityKnob.getValue(),
                onUpdate: (controlValues) => {
                    Object.keys(controlValues).forEach(type => {
                        if (type === 'master') return;
                        // Skip disabled channels
                        if (!channelEnabled[type]) return;

                        const baseVolume = adaptiveBaseVolumes[type];
                        const boost = controlValues[type];
                        const targetVolume = Math.min(1, baseVolume + boost);

                        // Update audio (smooth transition)
                        if (engine.channels[type] && engine.channels[type].gain) {
                            engine.channels[type].gain.gain.setTargetAtTime(
                                targetVolume,
                                engine.context.currentTime,
                                0.1
                            );
                        }

                        // Store for throttled knob update
                        lastKnobValues[type] = Math.round(targetVolume * 100);
                    });

                    // Update vinyl hiss based on low-mid frequencies (blend of brown and pink)
                    if (vinylEffect && adaptiveBaseVolumes.vinylHiss !== undefined) {
                        const vinylBoost = (controlValues.brown * 0.6 + controlValues.pink * 0.4);
                        const targetVinylHiss = Math.min(1, adaptiveBaseVolumes.vinylHiss + vinylBoost);
                        vinylEffect.setHissLevel(targetVinylHiss);
                        lastKnobValues.vinylHiss = Math.round(targetVinylHiss * 100);
                    }

                    // Throttle knob UI updates
                    if (!knobUpdateTimeout) {
                        knobUpdateTimeout = setTimeout(() => {
                            Object.keys(lastKnobValues).forEach(type => {
                                if (channelKnobs[type]) {
                                    channelKnobs[type].setValue(lastKnobValues[type]);
                                }
                            });
                            // Update vinyl hiss knob
                            if (lastKnobValues.vinylHiss !== undefined) {
                                vinylKnobs.hiss.setValue(lastKnobValues.vinylHiss);
                            }
                            knobUpdateTimeout = null;
                        }, 100);
                    }
                }
            });
        }

        // Get microphone access
        if (!micStream) {
            try {
                micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
                micSource = engine.context.createMediaStreamSource(micStream);
                micSource.connect(adaptivePlugin.sidechainInput);
            } catch (e) {
                console.error('Mic access denied:', e);
                showToast('Microphone access denied', 'error');
                adaptiveButton.setActive(false);
                return;
            }
        }

        adaptivePlugin.start();
        micVizContainer.classList.remove('hidden');
        requestAnimationFrame(() => micAnalyzer.resize());
        adaptiveSection.classList.add('active');
        setStatus('ADAPTIVE MODE - LISTENING');
        showToast('Adaptive mode enabled - listening to environment', 'success');
    } else {
        if (adaptivePlugin) {
            adaptivePlugin.stop();
            if (knobUpdateTimeout) {
                clearTimeout(knobUpdateTimeout);
                knobUpdateTimeout = null;
            }
            // Reset to base values
            Object.keys(adaptiveBaseVolumes).forEach(type => {
                if (type === 'master') return;
                const baseVolume = adaptiveBaseVolumes[type];
                engine.setChannelVolume(type, baseVolume);
                if (channelKnobs[type]) {
                    channelKnobs[type].setValue(Math.round(baseVolume * 100));
                }
            });
        }
        micVizContainer.classList.add('hidden');
        adaptiveSection.classList.remove('active');
        setStatus(isRunning ? 'GENERATING NOISE' : 'READY');
        showToast('Adaptive mode disabled', 'info');
    }

    adaptiveButton.setActive(active);
}

// --------------------------------------------------------------------------
// CALIBRATE TO ENVIRONMENT (one-shot capture)
// --------------------------------------------------------------------------
async function calibrateToEnvironment() {
    // Ensure engine is running
    if (!isRunning) {
        await engine.start();
        isRunning = true;
        powerBtn.classList.add('playing');
        setStatus('GENERATING NOISE');
        draw();
    }

    // Get microphone access if needed
    let tempMicStream = micStream;
    let tempMicSource = micSource;
    let tempAnalyser = null;

    if (!tempMicStream) {
        try {
            tempMicStream = await navigator.mediaDevices.getUserMedia({ audio: true });
            tempMicSource = engine.context.createMediaStreamSource(tempMicStream);
        } catch (e) {
            console.error('Mic access denied:', e);
            showToast('Microphone access denied', 'error');
            return;
        }
    }

    // Create temporary analyser for calibration
    tempAnalyser = engine.context.createAnalyser();
    tempAnalyser.fftSize = 512;
    tempMicSource.connect(tempAnalyser);

    // Show calibrating state
    calibrateButton.setActive(true);
    setStatus('CALIBRATING...');
    showToast('Listening to environment...', 'info');

    // Capture multiple samples over 1.5 seconds for averaging
    const samples = [];
    const sampleCount = 15;
    const sampleInterval = 100;

    for (let i = 0; i < sampleCount; i++) {
        await new Promise(resolve => setTimeout(resolve, sampleInterval));

        const dataArray = new Uint8Array(tempAnalyser.frequencyBinCount);
        tempAnalyser.getByteFrequencyData(dataArray);
        samples.push(dataArray);
    }

    // Average the samples
    const avgData = new Uint8Array(tempAnalyser.frequencyBinCount);
    for (let i = 0; i < avgData.length; i++) {
        let sum = 0;
        for (const sample of samples) {
            sum += sample[i];
        }
        avgData[i] = Math.round(sum / samples.length);
    }

    // Analyze frequency bands (similar to adaptive noise mapping)
    // Bin size = sampleRate / fftSize ≈ 44100 / 512 ≈ 86Hz per bin
    const getRangeEnergy = (startBin, endBin) => {
        let sum = 0;
        for (let i = startBin; i <= endBin && i < avgData.length; i++) {
            sum += avgData[i];
        }
        return sum / (endBin - startBin + 1) / 255; // Normalize to 0-1
    };

    // Map frequency ranges to noise types
    const energies = {
        brown: getRangeEnergy(0, 4),       // 0-344Hz (low rumble)
        pink: getRangeEnergy(5, 15),       // 430-1290Hz (mid-low)
        green: getRangeEnergy(16, 50),     // 1376-4300Hz (mid, speech range)
        white: getRangeEnergy(51, 150)     // 4386-12900Hz (high)
    };

    // Calculate overall environmental volume (average across all frequencies)
    const overallEnergy = getRangeEnergy(0, Math.min(150, avgData.length - 1));
    const silenceThreshold = 0.05; // Below this = silence
    const quietThreshold = 0.15;   // Below this = quiet environment

    // Calculate new volumes based on environment
    const sensitivity = sensitivityKnob.getValue() / 100;
    const newVolumes = {};

    if (overallEnergy < silenceThreshold) {
        // Silent environment - no noise needed
        Object.keys(energies).forEach(type => {
            newVolumes[type] = 0;
        });
    } else if (overallEnergy < quietThreshold) {
        // Quiet environment - minimal noise, scaled to volume
        const volumeScale = overallEnergy / quietThreshold;
        Object.keys(energies).forEach(type => {
            newVolumes[type] = Math.min(1, energies[type] * volumeScale * sensitivity * 2);
        });
    } else {
        // Noisy environment - mask sounds with complementary noise
        // Scale based on both per-band energy and overall volume
        const volumeScale = Math.min(1, overallEnergy / 0.4); // Max out at 40% energy
        Object.keys(energies).forEach(type => {
            const bandBoost = energies[type] * sensitivity;
            newVolumes[type] = Math.min(1, bandBoost * volumeScale * 1.5);
        });
    }

    // Apply new volumes with smooth transition
    Object.keys(newVolumes).forEach(type => {
        const targetVolume = newVolumes[type];
        engine.setChannelVolume(type, targetVolume);
        if (channelKnobs[type]) {
            channelKnobs[type].setValue(Math.round(targetVolume * 100));
        }
    });

    // Disconnect temporary analyser (keep mic connected if we got a new stream)
    tempMicSource.disconnect(tempAnalyser);

    // Store the mic stream for future use if we created a new one
    if (!micStream && tempMicStream) {
        micStream = tempMicStream;
        micSource = tempMicSource;
    }

    // Done
    calibrateButton.setActive(false);
    setStatus('CALIBRATED');

    // Show appropriate message based on detected environment
    if (overallEnergy < silenceThreshold) {
        showToast('Silent environment - noise disabled', 'info');
    } else if (overallEnergy < quietThreshold) {
        showToast('Quiet environment - minimal noise', 'info');
    } else {
        showToast('Noise levels adjusted to mask environment', 'success');
    }

    // Reset status after a moment
    setTimeout(() => {
        if (isRunning && !adaptiveButton.isActive?.()) {
            setStatus('GENERATING NOISE');
        }
    }, 2000);
}

// --------------------------------------------------------------------------
// VISUALIZATION LOOP
// --------------------------------------------------------------------------
function draw() {
    animationFrame = requestAnimationFrame(draw);

    // Update output analyzer (keep showing during fade-out)
    if ((engine.isRunning || engine.isFading) && engine.analyser) {
        const bufferLength = engine.analyser.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);
        engine.getAnalyserData(dataArray);
        outputAnalyzer.update(dataArray);
    }

    // Update mic analyzer
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
    if (e.code === 'Space' && !e.target.matches('input, textarea')) {
        e.preventDefault();
        togglePower();
    }
});

// --------------------------------------------------------------------------
// SYNC KNOBS (for loading presets)
// --------------------------------------------------------------------------
function syncKnobs() {
    Object.keys(channelKnobs).forEach(type => {
        channelKnobs[type].setValue(engine.volumes[type] * 100);
        // Sync channel toggles
        if (channelToggles[type]) {
            channelToggles[type].setActive(channelEnabled[type]);
        }
    });
    masterKnob.setValue(engine.volumes.master * 100);
    if (adaptivePlugin) {
        sensitivityKnob.setValue(adaptivePlugin.getParam('sensitivity'));
    }
    // Sync vinyl controls
    if (vinylEffect) {
        const currentLevel = vinylEffect.output.gain.value;
        vinylEnabled = currentLevel > 0;
        vinylOutputLevel = vinylEnabled ? currentLevel : vinylOutputLevel;
        vinylKnobs.level.setValue(vinylOutputLevel * 100);
        vinylKnobs.vinylToggle.setActive(vinylEnabled);
        vinylKnobs.hiss.setValue(vinylEffect.params.hissLevel * 100);
        vinylKnobs.crackle.setValue(vinylEffect.params.crackleIntensity * 100);
        vinylKnobs.clunkToggle.setActive(vinylEffect.params.clunkEnabled);
        if (vinylEffect.params.clunkSpeed === '33') {
            vinylKnobs.rpm33Btn.classList.add('active');
            vinylKnobs.rpm45Btn.classList.remove('active');
        } else {
            vinylKnobs.rpm45Btn.classList.add('active');
            vinylKnobs.rpm33Btn.classList.remove('active');
        }
    }
}

// Helper to get/set channel enabled state (for cloud serialization)
function getChannelEnabled() {
    return { ...channelEnabled };
}

function setChannelEnabled(state) {
    if (!state) return;
    Object.keys(state).forEach(type => {
        if (typeof state[type] === 'boolean') {
            channelEnabled[type] = state[type];
            // Apply to audio
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
    const cloud = setupCloud(room, {
        engine,
        syncKnobs,
        saveBtn,
        loadBtn,
        getVinylEffect: () => vinylEffect,
        getChannelEnabled,
        setChannelEnabled
    });
} catch (e) {
    console.log('Cloud features unavailable:', e.message);
}

// --------------------------------------------------------------------------
// INITIALIZATION
// --------------------------------------------------------------------------
setStatus('READY');
console.log('Neon Noise initialized');
