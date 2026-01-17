import { showToast } from './ui-utils.js';
import { runWalkthrough } from './walkthrough.js';

const el = id => document.getElementById(id);
const queryAll = s => document.querySelectorAll(s);

// Default values - only send if different (exported for testing)
export const DEFAULTS = {
    bpm: 120, level: 80, flamAmount: 20,
    // Instrument params - most default to middle of scale
    tune: 70, attack: 70, decay: 70, tone: 70, snappy: 70,
    velocity: 100, // rimshot/handclap only - scale is [50, 100], default is 100
    // FX defaults
    saturationEnabled: false, saturationDrive: 20,
    compressionEnabled: false, compressionThreshold: 50, compressionRatio: 50,
    sidechainEnabled: false, sidechainAmount: 50, sidechainRelease: 30,
    reverbEnabled: false, reverbMix: 15,
    lpFilterEnabled: false, lpFilterCutoff: 100, lpFilterResonance: 0,
    hpFilterEnabled: false, hpFilterCutoff: 0, hpFilterResonance: 0,
    // Pattern defaults
    numSteps: 16, scale: 1, shuffle: 0
};

// Exported for testing
export function isDiff(val, def) {
    if (val === def) return false;
    if (typeof val === 'boolean') return val !== def;
    if (typeof val === 'number') return Math.abs(val - def) > 0.01;
    return val !== def;
}

// Remap AI pattern names to valid sequencer IDs (A-P) - exported for testing
export function remapPatternIds(data, validIds) {
    if (!data.patterns) return data;

    const aiPatternNames = Object.keys(data.patterns);

    // Check if pattern names are already valid IDs
    const needsRemapping = aiPatternNames.some(name => !validIds.includes(name));
    if (!needsRemapping) return data;

    // Create mapping from AI names to valid IDs in order
    const idMapping = {};
    aiPatternNames.forEach((name, idx) => {
        if (idx < validIds.length) {
            idMapping[name] = validIds[idx];
        }
    });

    // Remap patterns object
    const remappedPatterns = {};
    Object.entries(data.patterns).forEach(([name, patternData]) => {
        const newId = idMapping[name];
        if (newId) {
            remappedPatterns[newId] = patternData;
        }
    });

    // Remap track array if present
    let remappedTrack = data.track;
    if (data.track && Array.isArray(data.track)) {
        remappedTrack = data.track.map(name => idMapping[name] || name);
    }

    return {
        ...data,
        patterns: remappedPatterns,
        track: remappedTrack
    };
}

export function buildCurrentState(sequencer, targetMode) {
    const state = {};

    // Only include BPM if not default
    if (isDiff(sequencer.bpm, DEFAULTS.bpm)) state.bpm = sequencer.bpm;
    if (sequencer.trackName) state.trackName = sequencer.trackName;
    if (sequencer.trackDescription) state.description = sequencer.trackDescription;

    // Params - only include non-default values
    const params = {};
    Object.entries(sequencer.trackParams).forEach(([inst, pSet]) => {
        const changed = {};
        Object.entries(pSet).forEach(([p, v]) => {
            const def = DEFAULTS[p];
            if (def !== undefined && isDiff(v, def)) changed[p] = v;
            // For instrument-specific params (tune, attack, etc), include if not middle value
            else if (def === undefined && v !== 50) changed[p] = v;
        });
        if (Object.keys(changed).length) params[inst] = changed;
    });
    if (Object.keys(params).length) state.params = params;

    // Patterns - sparse format, only non-empty
    const patterns = {};
    const patternIds = targetMode === 'PATTERN'
        ? [sequencer.currentPatternId]
        : sequencer.IDS;

    patternIds.forEach(id => {
        const p = sequencer.patterns[id];
        const pData = {};

        // Metadata only if non-default
        if (isDiff(p.numSteps, DEFAULTS.numSteps)) pData.numSteps = p.numSteps;
        if (isDiff(p.scale, DEFAULTS.scale)) pData.scale = p.scale;
        if (isDiff(p.shuffle, DEFAULTS.shuffle)) pData.shuffle = p.shuffle;

        // Tracks - sparse, only hits > 0
        const tracks = {};
        Object.entries(p.tracks).forEach(([inst, hits]) => {
            const sparse = {};
            hits.forEach((v, i) => { if (v > 0) sparse[i] = v; });
            if (Object.keys(sparse).length) tracks[inst] = sparse;
        });
        if (Object.keys(tracks).length) pData.pattern = tracks;

        // Flams - sparse, only true values
        const flams = {};
        Object.entries(p.flams).forEach(([inst, f]) => {
            const sparse = {};
            f.forEach((v, i) => { if (v) sparse[i] = true; });
            if (Object.keys(sparse).length) flams[inst] = sparse;
        });
        if (Object.keys(flams).length) pData.flams = flams;

        // Only include pattern if it has content
        if (Object.keys(pData).length) patterns[id] = pData;
    });
    if (Object.keys(patterns).length) state.patterns = patterns;

    // Track arrangement - only for TRACK/CHAIN mode, only non-null
    if (targetMode !== 'PATTERN') {
        const track = sequencer.trackMeasures.filter(m => m !== null);
        if (track.length) state.track = track;
    }

    return state;
}

export function applyInstant(data, ctx) {
    const { sequencer, elements, state, banks, updateBankUI, updatePatternUI, syncGlobalKnobs, updateTrackUI } = ctx;

    if (data.bpm) {
        sequencer.bpm = data.bpm;
        elements.knobRefs.bpm.updateValue(data.bpm);
    }

    if (data.params) {
        Object.entries(data.params).forEach(([inst, pSet]) => {
            if (!sequencer.trackParams[inst]) return;
            Object.entries(pSet).forEach(([p, v]) => {
                sequencer.setParam(inst, p, v);
            });
        });
    }

    if (data.patterns) {
        const patternIds = Object.keys(data.patterns);

        // In CHAIN mode, set up the chain from pattern IDs before loading
        if (ctx.targetMode === 'CHAIN' && patternIds.length > 0 && (!data.track || !data.track.length)) {
            sequencer.trackMeasures.fill(null);
            patternIds.forEach((p, i) => { if (i < 96) sequencer.trackMeasures[i] = p; });
            // Set patternChain for visual indicator on pattern buttons
            sequencer.patternChain = [...patternIds];
            updateTrackUI();
            updatePatternUI();
            // Enable track mode to show the chain
            if (!sequencer.trackMode) elements.trackModeToggle.click();
        }

        Object.entries(data.patterns).forEach(([id, pData]) => {
            sequencer.loadPattern(pData, id);
        });
    }

    state.bank = banks[1].includes(sequencer.currentPatternId) ? 1 : 2;
    updateBankUI();
    syncGlobalKnobs();

    if (data.track && data.track.length) {
        sequencer.trackMeasures.fill(null);
        data.track.forEach((p, i) => { if (i < 96) sequencer.trackMeasures[i] = p; });
        updateTrackUI();
        if (ctx.targetMode === 'TRACK') {
            if (sequencer.trackMode) elements.trackModeToggle.click();
            if (!sequencer.songMode) elements.songModeToggle.click();
        }
    }

    if (data.trackName) {
        sequencer.trackName = data.trackName;
        elements.trackNameInput.value = data.trackName;
    }

    if (data.description && !sequencer.trackDescription) {
        sequencer.trackDescription = data.description;
        elements.trackDescriptionInput.value = data.description;
    }
}

// Check if we should show "Demo" / "Suggest" / "AI Gen" button
export function updateAiButtonText(elements, sequencer, aiModes, stateObj) {
    if (stateObj.isAiGenerating) return; // Don't change during generation
    const hasPrompt = elements.aiPrompt.value.trim().length > 0;
    // Check for existing pattern content
    let hasContent = false;
    for (const id of sequencer.IDS) {
        const p = sequencer.patterns[id];
        if (p && Object.values(p.tracks).some(t => t.some(v => v > 0))) {
            hasContent = true;
            break;
        }
    }
    // DEMO: empty prompt + empty track (instant demo)
    // SUGGEST: empty prompt + existing content (get improvement suggestion)
    // AI GEN: has prompt (execute the prompt)
    if (hasPrompt) {
        elements.aiBtn.innerText = "AI GEN";
        elements.aiBtn.classList.remove('demo-attract');
    } else if (hasContent) {
        elements.aiBtn.innerText = "SUGGEST";
        elements.aiBtn.classList.remove('demo-attract');
    } else {
        elements.aiBtn.innerText = "DEMO";
        elements.aiBtn.classList.add('demo-attract');
    }
}

export async function generateTrackThumbnail(sequencer, aiPrompts, elements) {
    const thumbContainer = elements.trackThumbnailContainer;
    if (!thumbContainer) return;

    thumbContainer.classList.add('loading');
    try {
        const name = sequencer.trackName;
        const brief = sequencer.trackDescription;
        const creativeBrief = elements.aiPrompt?.value?.trim() || '';

        // Build style from all available context
        const parts = [name, brief, creativeBrief].filter(Boolean);
        const style = parts.length > 0 ? parts.join(' - ') : "Electronic drum machine music";

        // Get genre-specific artwork guidance
        const skill = sequencer.trackSkill;
        const skillArtwork = skill && aiPrompts.skills?.[skill]?.artwork
            ? `Visual style: ${aiPrompts.skills[skill].artwork}`
            : "Abstract electronic music aesthetics, bold colors, geometric or organic shapes";

        const prompt = aiPrompts.thumbnail
            .replace('{{SKILL_ARTWORK}}', skillArtwork)
            .replace('{{STYLE}}', style);

        const result = await websim.imageGen({
            prompt: prompt,
            aspect_ratio: "1:1"
        });

        sequencer.thumbnailUrl = result.url;
        thumbContainer.innerHTML = `<img src="${result.url}">`;
        showToast("TRACK ART GENERATED", "success");
    } catch (e) {
        console.error("Thumbnail generation error:", e);
        showToast("FAILED TO GENERATE ART", "error");
    } finally {
        thumbContainer.classList.remove('loading');
    }
}

export async function handleAiGeneration(ctx) {
    const { sequencer, audioEngine, elements, state, aiModes, aiPrompts, FX_PAGES, banks, scales, performCommit, renderAll, renderKnobs, renderSteps, renderFXControls, syncGlobalKnobs, updateBankUI, updateTrackUI, updatePatternUI, updateAiModeUI, currentInstrument, setCurrentInstrument } = ctx;

    if (state.isAiGenerating) {
        state.abortAiGen = true;
        elements.aiBtn.disabled = true;
        elements.aiBtn.innerText = "STOPPING...";
        return;
    }

    const targetMode = aiModes[state.aiModeIdx];
    const currentState = buildCurrentState(sequencer, targetMode);
    const promptWasEmpty = !elements.aiPrompt.value.trim();

    // Check for actual pattern content (notes in patterns)
    let hasExistingContent = false;
    for (const id of sequencer.IDS) {
        const p = sequencer.patterns[id];
        if (p && Object.values(p.tracks).some(t => t.some(v => v > 0))) {
            hasExistingContent = true;
            break;
        }
    }

    // If prompt is empty and track has content, generate improvement suggestion (don't auto-execute)
    if (promptWasEmpty && hasExistingContent) {
        state.isAiGenerating = true;
        const aiCopilot = document.getElementById('ai-copilot');
        aiCopilot.classList.add('ai-loading');
        elements.aiBtn.innerText = "...";
        elements.statusText.innerText = "ANALYZING...";

        try {
            const promptToUse = aiPrompts.improve.replace('{{STATE}}', JSON.stringify(currentState));
            const suggestion = await websim.chat.completions.create({
                messages: [{ role: "user", content: promptToUse }],
            });
            const prompt = suggestion.content.trim().replace(/['"]/g, '');
            elements.aiPrompt.value = prompt;
            showToast(`Suggested: "${prompt}"`, 'info');
            elements.statusText.innerText = "EDIT & GENERATE";
        } catch (e) {
            const fallbacks = ['Add more groove and swing', 'Enhance with sidechain pumping', 'Create energy build-up', 'Add percussive fills'];
            elements.aiPrompt.value = fallbacks[Math.floor(Math.random() * fallbacks.length)];
            elements.statusText.innerText = "SUGGESTION READY";
        } finally {
            state.isAiGenerating = false;
            aiCopilot.classList.remove('ai-loading');
            updateAiButtonText(elements, sequencer, aiModes, state);
        }
        return; // Wait for user confirmation before executing
    }

    // If prompt is empty and track is blank, generate creative prompt AND auto-execute
    if (promptWasEmpty && !hasExistingContent) {
        try {
            const suggestion = await websim.chat.completions.create({
                messages: [{ role: "user", content: aiPrompts.demo }],
            });
            elements.aiPrompt.value = suggestion.content.trim().replace(/['"]/g, '');
        } catch (e) {
            const fallbacks = ['Driving Berlin techno', 'Deep hypnotic groove', 'Industrial breakbeat', 'Acid house energy'];
            elements.aiPrompt.value = fallbacks[Math.floor(Math.random() * fallbacks.length)];
        }
        // Continue to execute generation below
    }

    // Generate creative brief and detect skill if not set (for new tracks or when starting fresh)
    const hasCreativeBrief = sequencer.trackDescription && sequencer.trackDescription.trim().length > 0;
    const userPromptText = elements.aiPrompt.value;

    if (!hasCreativeBrief && !hasExistingContent) {
        const aiCopilot = document.getElementById('ai-copilot');
        aiCopilot.classList.add('ai-loading');
        elements.statusText.innerText = "CRAFTING VISION...";

        try {
            // Detect skill/genre and generate creative brief in parallel
            const [skillResponse, briefResponse] = await Promise.all([
                websim.chat.completions.create({
                    messages: [{ role: "user", content: aiPrompts.detectSkill.replace('{{PROMPT}}', userPromptText) }],
                }),
                websim.chat.completions.create({
                    messages: [{ role: "user", content: aiPrompts.creativeBrief.replace('{{PROMPT}}', userPromptText) }],
                })
            ]);

            // Set the detected skill
            const detectedSkill = skillResponse.content.trim().toLowerCase().replace(/['"]/g, '');
            if (aiPrompts.skills[detectedSkill]) {
                sequencer.trackSkill = detectedSkill;
                showToast(`SKILL: ${aiPrompts.skills[detectedSkill].name}`, "info");
            }

            // Set the creative brief
            const creativeBrief = briefResponse.content.trim().replace(/^["']|["']$/g, '');
            sequencer.trackDescription = creativeBrief;
            if (elements.trackDescriptionInput) {
                elements.trackDescriptionInput.value = creativeBrief;
            }

            // Show the description panel briefly to indicate it was set
            if (elements.trackDescriptionPanel) {
                elements.trackDescriptionPanel.classList.remove('hidden');
                elements.trackInfoBtn?.classList.add('active');
            }

            showToast("CREATIVE BRIEF SET", "info");
        } catch (e) {
            console.warn("Could not generate creative brief:", e);
            // Continue without brief - not critical
        }
    }

    // If no skill detected yet but we have a prompt, try to detect skill
    if (!sequencer.trackSkill && userPromptText) {
        try {
            // Try keyword matching first (faster, no API call)
            const promptLower = userPromptText.toLowerCase();
            for (const [skillId, skill] of Object.entries(aiPrompts.skills)) {
                if (skill.keywords.some(kw => promptLower.includes(kw))) {
                    sequencer.trackSkill = skillId;
                    break;
                }
            }
        } catch (e) {
            // Ignore - skill detection is optional
        }
    }

    state.isAiGenerating = true;
    state.abortAiGen = false;

    const aiCopilot = document.getElementById('ai-copilot');
    aiCopilot.classList.add('ai-loading');
    elements.aiBtn.innerText = "STOP";
    elements.aiModeBtn.disabled = true;
    elements.walkthroughBtn.disabled = true;

    elements.statusText.innerText = "AI COMPOSING...";

    // Build system prompt with skill augmentation
    let systemPrompt = aiPrompts.system;
    if (sequencer.trackSkill && aiPrompts.skills[sequencer.trackSkill]) {
        systemPrompt += `\n\n${aiPrompts.skills[sequencer.trackSkill].augment}`;
    }

    // Build compact prompt with creative brief context
    const stateStr = Object.keys(currentState).length ? `\nSTATE:${JSON.stringify(currentState)}` : '';
    const briefContext = sequencer.trackDescription ? `\nVISION: ${sequencer.trackDescription}` : '';
    const userPrompt = elements.aiPrompt.value;
    const userContent = `[${targetMode}] ${userPrompt}${briefContext}${stateStr}`;

    try {
        const res = await websim.chat.completions.create({
            messages: [
                { role: "system", content: systemPrompt },
                { role: "user", content: userContent }
            ],
            json: true
        });

        // Parse and validate response
        let data;
        try {
            data = JSON.parse(res.content);
        } catch (e) {
            throw new Error("Invalid JSON response");
        }

        // Remap AI pattern names to valid sequencer IDs
        data = remapPatternIds(data, sequencer.IDS);

        // Stop playback before applying
        if (sequencer.isPlaying) elements.playBtn.click();

        if (state.aiWalkthrough) {
            await runWalkthrough(data, {
                ...ctx,
                targetMode,
                currentInstrument,
                setCurrentInstrument
            });
        } else {
            applyInstant(data, { ...ctx, targetMode });
        }

        renderAll();

        // Auto-start playback
        if (!sequencer.isPlaying) {
            elements.playBtn.click();
        }

        // Show completion
        const trackLen = data.track ? data.track.length : 0;
        const patternCount = data.patterns ? Object.keys(data.patterns).length : 0;
        let msg = "Composition complete!";

        if (targetMode === 'CHAIN' && patternCount > 0) {
            msg = `${patternCount}-pattern chain ready! Double-click to add/remove`;
        } else if (trackLen) {
            msg = `${trackLen}-measure track ready!`;
        } else if (patternCount > 1) {
            msg = `${patternCount} patterns generated!`;
        }

        elements.statusText.innerText = msg.toUpperCase();
        elements.statusText.style.color = "#fff";
        showToast(msg, "success");

        // Generate thumbnail if not set
        if (!sequencer.thumbnailUrl) {
            await generateTrackThumbnail(sequencer, aiPrompts, elements);
        }

        // Auto-commit if named
        if (data.trackName) setTimeout(() => performCommit(), 1000);

        // Reset status after delay
        setTimeout(() => {
            if (elements.statusText.innerText === msg.toUpperCase()) {
                elements.statusText.innerText = "SYSTEM READY";
                elements.statusText.style.color = "";
            }
        }, 8000);

        // Generate suggested next step after completion
        setTimeout(async () => {
            try {
                const newState = buildCurrentState(sequencer, targetMode);
                const suggestPrompt = aiPrompts.improve.replace('{{STATE}}', JSON.stringify(newState));
                const suggestion = await websim.chat.completions.create({
                    messages: [{ role: "user", content: suggestPrompt }],
                });
                elements.aiPrompt.value = suggestion.content.trim().replace(/['\"]/g, '');
                updateAiButtonText(elements, sequencer, aiModes, state);
            } catch (e) {
                // Silently ignore suggestion errors
            }
        }, 2000);

    } catch (err) {
        if (err.message === "ABORTED") {
            showToast("Generation stopped.", "info");
        } else {
            console.error("AI Error:", err);
            showToast("AI error - try again", "error");
            elements.statusText.innerText = "AI ERROR";
        }
    } finally {
        state.isAiGenerating = false;
        state.abortAiGen = false;
        elements.aiBtn.disabled = false;
        elements.aiBtn.innerText = "AI GEN";
        elements.aiModeBtn.disabled = false;
        elements.walkthroughBtn.disabled = false;
        aiCopilot.classList.remove('ai-loading');
        if (["AI COMPOSING...", "THINKING...", "ANALYZING..."].includes(elements.statusText.innerText)) {
            elements.statusText.innerText = "SYSTEM READY";
        }
        queryAll('.ai-focus').forEach(e => e.classList.remove('ai-focus'));
    }
}
