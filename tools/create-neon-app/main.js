/* ==========================================================================
   NEON APP STARTER KIT - JavaScript
   ========================================================================== */

import { createKnob, createFxModule } from '../../packages/neon-ui/index.js';
import { Filter } from '../../packages/neon-fx/index.js';

// --------------------------------------------------------------------------
// DOM ELEMENTS
// --------------------------------------------------------------------------
const saveBtn = document.getElementById('save-btn');
const loadBtn = document.getElementById('load-btn');
const startBtn = document.getElementById('start-btn');
const statusText = document.getElementById('status-text');
const stepDisplay = document.getElementById('step-display');
const toastContainer = document.getElementById('toast-container');
const masterVolumeContainer = document.getElementById('master-volume-knob');
const aiPromptInput = document.getElementById('ai-prompt');
const aiGenBtn = document.getElementById('ai-gen-btn');
const aiWalkthroughBtn = document.getElementById('ai-walkthrough-btn');
const aiCopilot = document.getElementById('ai-copilot');
const fxContainer = document.getElementById('fx-container');

// --------------------------------------------------------------------------
// STATE
// --------------------------------------------------------------------------
let isRunning = false;
let currentStep = 1;
let masterVolume = 80;
let walkthroughEnabled = true;

// Audio context and plugins (created on first interaction)
let audioContext = null;
let filterPlugin = null;

// --------------------------------------------------------------------------
// TOAST NOTIFICATIONS
// --------------------------------------------------------------------------
function showToast(message, type = 'info', duration = 3000) {
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    toastContainer.appendChild(toast);

    setTimeout(() => {
        toast.style.animation = 'toast-out 0.3s ease-out forwards';
        setTimeout(() => toast.remove(), 300);
    }, duration);
}

// --------------------------------------------------------------------------
// STATUS BAR
// --------------------------------------------------------------------------
function setStatus(message) {
    statusText.textContent = message;
}

function setStep(step) {
    currentStep = step;
    stepDisplay.textContent = `STEP: ${step}`;
}

// --------------------------------------------------------------------------
// KNOBS
// --------------------------------------------------------------------------
const masterVolumeKnob = createKnob({
    value: masterVolume,
    min: 0,
    max: 100,
    color: 'yellow',
    size: 'small',
    onChange: (val) => {
        masterVolume = val;
        // Add your volume control logic here
    }
});
masterVolumeContainer.appendChild(masterVolumeKnob.element);

// --------------------------------------------------------------------------
// AUDIO PLUGINS (neon-fx)
// --------------------------------------------------------------------------

// Initialize audio context on first user interaction
async function initAudio() {
    if (audioContext) return;

    audioContext = new AudioContext();

    // Create filter plugin
    filterPlugin = new Filter(audioContext, {
        cutoff: 2000,
        resonance: 5
    });

    // Connect filter to destination (you'd normally connect your audio source first)
    // source.connect(filterPlugin.input);
    filterPlugin.connect(audioContext.destination);

    showToast('Audio initialized', 'success');
}

// Create Filter FX module UI
const filterModule = createFxModule({
    name: 'FILTER',
    enabled: false,
    controls: [
        {
            label: 'CUTOFF',
            value: 2000,
            min: 20,
            max: 20000,
            onChange: (val) => {
                filterPlugin?.setParam('cutoff', val, 0.05);
            }
        },
        {
            label: 'RESO',
            value: 5,
            min: 0,
            max: 30,
            onChange: (val) => {
                filterPlugin?.setParam('resonance', val, 0.05);
            }
        }
    ],
    onToggle: async (enabled) => {
        await initAudio();
        if (filterPlugin) {
            filterPlugin.bypassed = !enabled;
        }
        showToast(`Filter ${enabled ? 'enabled' : 'bypassed'}`, 'info');
    }
});

fxContainer.appendChild(filterModule.element);

// --------------------------------------------------------------------------
// AI COPILOT
// --------------------------------------------------------------------------

// Update button text based on prompt state
function updateAiButtonText() {
    const hasPrompt = aiPromptInput.value.trim().length > 0;

    if (hasPrompt) {
        aiGenBtn.innerText = "AI GEN";
        aiGenBtn.classList.remove('demo-attract');
    } else {
        aiGenBtn.innerText = "DEMO";
        aiGenBtn.classList.add('demo-attract');
    }
}

// Demo mode - stub for your implementation
async function runDemoMode() {
    showToast('Running demo...', 'info');

    // Add your demo logic here
    // This could generate sample content, show a tutorial, etc.
    await new Promise(resolve => setTimeout(resolve, 1500));

    showToast('Demo complete!', 'success');
}

// AI generation handler
async function handleAiGeneration() {
    const prompt = aiPromptInput.value.trim();
    const isDemo = !prompt;

    // Add loading state
    aiCopilot.classList.add('ai-loading');
    aiGenBtn.disabled = true;

    try {
        if (isDemo) {
            await runDemoMode();
        } else {
            // Add your AI generation logic here
            showToast('Generating...', 'info');
            await new Promise(resolve => setTimeout(resolve, 1500));
            showToast('Generation complete!', 'success');
        }
    } catch (error) {
        showToast('Generation failed', 'error');
        console.error(error);
    } finally {
        aiCopilot.classList.remove('ai-loading');
        aiGenBtn.disabled = false;
        updateAiButtonText();
    }
}

aiGenBtn.addEventListener('click', handleAiGeneration);

aiPromptInput.addEventListener('input', updateAiButtonText);

aiPromptInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
        aiGenBtn.click();
    }
});

aiWalkthroughBtn.addEventListener('click', () => {
    walkthroughEnabled = !walkthroughEnabled;
    aiWalkthroughBtn.classList.toggle('active', walkthroughEnabled);
    showToast(`Walkthrough ${walkthroughEnabled ? 'enabled' : 'disabled'}`, 'info');
});

// Initialize button text
updateAiButtonText();

// --------------------------------------------------------------------------
// BUTTON HANDLERS
// --------------------------------------------------------------------------
saveBtn.addEventListener('click', () => {
    showToast('Saving...', 'info');
    // Add your save logic here
    setTimeout(() => {
        showToast('Saved successfully!', 'success');
    }, 500);
});

loadBtn.addEventListener('click', () => {
    showToast('Loading...', 'info');
    // Add your load logic here
    setTimeout(() => {
        showToast('Loaded successfully!', 'success');
    }, 500);
});

startBtn.addEventListener('click', () => {
    isRunning = !isRunning;

    if (isRunning) {
        startBtn.classList.add('playing');
        setStatus('RUNNING');
        showToast('Started', 'success');
    } else {
        startBtn.classList.remove('playing');
        setStatus('STOPPED');
        showToast('Stopped', 'info');
    }
});

// --------------------------------------------------------------------------
// INITIALIZATION
// --------------------------------------------------------------------------
function init() {
    setStatus('SYSTEM ONLINE');
    setStep(1);
    console.log('Neon App initialized');
}

// Initialize on DOM ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}
