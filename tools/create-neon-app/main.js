/* ==========================================================================
   NEON APP STARTER KIT - Main Application

   This template demonstrates best practices for neon apps:
   - Modular file structure (main.js, audio-engine.js, cloud.js)
   - Shared UI components from neon-ui
   - Cloud integration from neon-cloud
   - Proper DOM helpers (el, queryAll)
   ========================================================================== */

import { AudioEngine } from './audio-engine.js';
import { setupCloud } from './cloud.js';
import {
    createKnob,
    createFxModule,
    showToast,
    el,
    queryAll
} from '../../packages/neon-ui/index.js';
import { Filter } from '../../packages/neon-fx/index.js';

// --------------------------------------------------------------------------
// GLOBALS
// --------------------------------------------------------------------------
const room = new WebsimSocket();

// --------------------------------------------------------------------------
// APP CLASS
// --------------------------------------------------------------------------
class NeonApp {
    constructor() {
        this.engine = new AudioEngine({
            onError: (msg) => showToast(msg, 'error')
        });

        // State
        this.isRunning = false;
        this.currentStep = 1;
        this.walkthroughEnabled = true;
        this.aiPrompts = null;

        // FX plugins
        this.filterPlugin = null;

        // DOM element references
        this.elements = {
            saveBtn: el('save-btn'),
            loadBtn: el('load-btn'),
            startBtn: el('start-btn'),
            statusText: el('status-text'),
            stepDisplay: el('step-display'),
            toastContainer: el('toast-container'),
            masterVolumeContainer: el('master-volume-knob'),
            aiPromptInput: el('ai-prompt'),
            aiGenBtn: el('ai-gen-btn'),
            aiWalkthroughBtn: el('ai-walkthrough-btn'),
            aiCopilot: el('ai-copilot'),
            fxContainer: el('fx-container'),
            // Community sidebar elements
            communityToggleBtn: el('community-toggle-btn'),
            closeCommunityBtn: el('close-community-btn'),
            communitySidebar: el('community-sidebar'),
            feedFilterAll: el('feed-filter-all'),
            feedFilterMine: el('feed-filter-mine')
        };

        // Knob references
        this.knobs = {};
    }

    // -------------------------------------------------------------------------
    // INITIALIZATION
    // -------------------------------------------------------------------------

    async init() {
        // Load AI prompts
        await this.loadAiPrompts();

        // Setup UI
        this.setupKnobs();
        this.setupFxModules();
        this.setupEventHandlers();
        this.setupCloud();

        // Initialize UI state
        this.setStatus('SYSTEM ONLINE');
        this.setStep(1);
        this.updateAiButtonText();

        console.log('Neon App initialized');
    }

    async loadAiPrompts() {
        try {
            this.aiPrompts = await fetch('ai-prompts.json').then(r => r.json());
        } catch (e) {
            console.warn('Could not load AI prompts:', e);
            this.aiPrompts = {
                placeholders: { default: 'Describe what you want...' },
                systemPrompt: 'You are a helpful creative assistant.'
            };
        }
    }

    // -------------------------------------------------------------------------
    // CLOUD INTEGRATION
    // -------------------------------------------------------------------------

    setupCloud() {
        this.cloud = setupCloud(room, {
            engine: this.engine,
            elements: this.elements,
            renderAll: () => this.renderAll(),
            syncUI: () => this.syncUI()
        });

        // Update save button state when changes occur
        this.onStateChange = () => this.cloud.updateSaveButtonState();
    }

    // -------------------------------------------------------------------------
    // UI SETUP
    // -------------------------------------------------------------------------

    setupKnobs() {
        // Master volume knob
        this.knobs.masterVolume = createKnob({
            value: 80,
            min: 0,
            max: 100,
            color: 'yellow',
            size: 'small',
            onChange: (val) => {
                this.engine.setMasterVolume(val);
                this.onStateChange?.();
            }
        });
        this.elements.masterVolumeContainer?.appendChild(this.knobs.masterVolume.element);
    }

    setupFxModules() {
        // Filter FX module
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
                        this.filterPlugin?.setParam('cutoff', val, 0.05);
                    }
                },
                {
                    label: 'RESO',
                    value: 5,
                    min: 0,
                    max: 30,
                    onChange: (val) => {
                        this.filterPlugin?.setParam('resonance', val, 0.05);
                    }
                }
            ],
            onToggle: async (enabled) => {
                await this.initAudio();
                if (this.filterPlugin) {
                    this.filterPlugin.bypassed = !enabled;
                }
                showToast(`Filter ${enabled ? 'enabled' : 'bypassed'}`, 'info');
            }
        });

        this.elements.fxContainer?.appendChild(filterModule.element);
    }

    setupEventHandlers() {
        // Start/stop button
        this.elements.startBtn?.addEventListener('click', () => this.toggleRunning());

        // AI controls
        this.elements.aiGenBtn?.addEventListener('click', () => this.handleAiGeneration());

        this.elements.aiPromptInput?.addEventListener('input', () => this.updateAiButtonText());

        this.elements.aiPromptInput?.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                this.elements.aiGenBtn?.click();
            }
        });

        this.elements.aiWalkthroughBtn?.addEventListener('click', () => {
            this.walkthroughEnabled = !this.walkthroughEnabled;
            this.elements.aiWalkthroughBtn.classList.toggle('active', this.walkthroughEnabled);
            showToast(`Walkthrough ${this.walkthroughEnabled ? 'enabled' : 'disabled'}`, 'info');
        });
    }

    // -------------------------------------------------------------------------
    // AUDIO
    // -------------------------------------------------------------------------

    async initAudio() {
        await this.engine.init();

        if (!this.filterPlugin && this.engine.ctx) {
            this.filterPlugin = new Filter(this.engine.ctx, {
                cutoff: 2000,
                resonance: 5
            });
            this.filterPlugin.connect(this.engine.masterGain);
        }
    }

    // -------------------------------------------------------------------------
    // PLAYBACK
    // -------------------------------------------------------------------------

    toggleRunning() {
        this.isRunning = !this.isRunning;

        if (this.isRunning) {
            this.elements.startBtn?.classList.add('playing');
            this.setStatus('RUNNING');
            showToast('Started', 'success');
            this.initAudio(); // Ensure audio is ready
        } else {
            this.elements.startBtn?.classList.remove('playing');
            this.setStatus('STOPPED');
            showToast('Stopped', 'info');
        }
    }

    // -------------------------------------------------------------------------
    // STATUS & DISPLAY
    // -------------------------------------------------------------------------

    setStatus(message) {
        if (this.elements.statusText) {
            this.elements.statusText.textContent = message;
        }
    }

    setStep(step) {
        this.currentStep = step;
        if (this.elements.stepDisplay) {
            this.elements.stepDisplay.textContent = `STEP: ${step}`;
        }
    }

    // -------------------------------------------------------------------------
    // AI COPILOT
    // -------------------------------------------------------------------------

    updateAiButtonText() {
        const hasPrompt = this.elements.aiPromptInput?.value.trim().length > 0;

        if (this.elements.aiGenBtn) {
            if (hasPrompt) {
                this.elements.aiGenBtn.innerText = "AI GEN";
                this.elements.aiGenBtn.classList.remove('demo-attract');
            } else {
                this.elements.aiGenBtn.innerText = "DEMO";
                this.elements.aiGenBtn.classList.add('demo-attract');
            }
        }
    }

    async runDemoMode() {
        showToast('Running demo...', 'info');

        // Add your demo logic here
        await new Promise(resolve => setTimeout(resolve, 1500));

        showToast('Demo complete!', 'success');
    }

    async handleAiGeneration() {
        const prompt = this.elements.aiPromptInput?.value.trim();
        const isDemo = !prompt;

        // Add loading state
        this.elements.aiCopilot?.classList.add('ai-loading');
        if (this.elements.aiGenBtn) this.elements.aiGenBtn.disabled = true;

        try {
            if (isDemo) {
                await this.runDemoMode();
            } else {
                // AI generation with websim
                showToast('Generating...', 'info');

                const response = await websim.chat.completions.create({
                    messages: [
                        {
                            role: 'system',
                            content: this.aiPrompts?.systemPrompt || 'You are a helpful creative assistant.'
                        },
                        {
                            role: 'user',
                            content: prompt
                        }
                    ]
                });

                // Handle AI response
                console.log('AI response:', response.content);
                showToast('Generation complete!', 'success');

                // Clear prompt after success
                if (this.elements.aiPromptInput) {
                    this.elements.aiPromptInput.value = '';
                }
            }
        } catch (error) {
            showToast('Generation failed', 'error');
            console.error('AI generation error:', error);
        } finally {
            this.elements.aiCopilot?.classList.remove('ai-loading');
            if (this.elements.aiGenBtn) this.elements.aiGenBtn.disabled = false;
            this.updateAiButtonText();
        }
    }

    // -------------------------------------------------------------------------
    // RENDERING
    // -------------------------------------------------------------------------

    renderAll() {
        // Called after state changes
        // Add your UI refresh logic here
        this.onStateChange?.();
    }

    syncUI() {
        // Sync UI with engine state after load
        this.knobs.masterVolume?.setValue(Math.round(this.engine.masterVolume * 100));
        // Add other UI sync here
    }
}

// --------------------------------------------------------------------------
// INITIALIZATION
// --------------------------------------------------------------------------

const app = new NeonApp();

// Initialize on DOM ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => app.init());
} else {
    app.init();
}

// Export for debugging
window.neonApp = app;
