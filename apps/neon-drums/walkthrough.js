import { showToast } from './ui-utils.js';

const sleep = ms => new Promise(r => setTimeout(r, ms));
const el = id => document.getElementById(id);
const queryAll = s => document.querySelectorAll(s);

export async function runWalkthrough(data, ctx) {
    const { sequencer, audioEngine, elements, state, FX_PAGES, banks, scales, currentInstrument, setCurrentInstrument, renderAll, renderKnobs, renderSteps, renderFXControls, syncGlobalKnobs, updateBankUI, updateTrackUI, updatePatternUI, updateAiModeUI } = ctx;

    const reasoning = Array.isArray(data.reasoning) ? [...data.reasoning] : [];
    const checkAbort = () => { if (state.abortAiGen) throw new Error("ABORTED"); };

    // Helper to show reasoning with emphasis
    const showReasoning = (msg) => {
        if (msg) showToast(`💡 ${msg}`, 'info');
    };

    elements.statusText.innerText = "BUILDING COMPOSITION...";

    // Show initial reasoning if available
    if (reasoning.length > 0) {
        showReasoning(reasoning.shift());
        await sleep(800);
    }

    // 1. Animate BPM
    if (data.bpm && data.bpm !== sequencer.bpm) {
        if (reasoning.length > 0) showReasoning(reasoning.shift());
        showToast(`Setting tempo to ${data.bpm} BPM`, 'info');
        const startBpm = sequencer.bpm, endBpm = data.bpm, steps = 10;
        for (let i = 0; i <= steps; i++) {
            checkAbort();
            const val = Math.round(startBpm + (endBpm - startBpm) * (i / steps));
            sequencer.bpm = val;
            elements.knobRefs.bpm.updateValue(val);
            await sleep(20);
        }
    } else if (data.bpm) {
        sequencer.bpm = data.bpm;
        elements.knobRefs.bpm.updateValue(data.bpm);
    }

    // 2. Walkthrough params
    if (data.params) {
        for (const [instKey, pDataInst] of Object.entries(data.params)) {
            checkAbort();
            const dispName = audioEngine.manifest.instruments[instKey]?.displayName;
            if (!dispName || !sequencer.trackParams[instKey]) continue;

            const instParamsChanged = Object.entries(pDataInst).some(([pName, pVal]) =>
                sequencer.trackParams[instKey][pName] !== pVal
            );
            if (!instParamsChanged) {
                Object.entries(pDataInst).forEach(([pName, pVal]) => sequencer.setParam(instKey, pName, pVal));
                continue;
            }

            if (reasoning.length > 0) showReasoning(reasoning.shift());
            setCurrentInstrument(instKey);
            elements.instName.innerText = dispName.toUpperCase();

            const instSection = el('instrument-select');
            instSection.classList.add('ai-focus');
            queryAll('.inst-btn').forEach(btn => btn.classList.toggle('active', btn.dataset.inst === instKey));
            renderAll();
            await sleep(300);
            instSection.classList.remove('ai-focus');

            showToast(`Shaping ${dispName} sound...`, 'info');
            const instControls = el('instrument-controls');
            const pluginSidebar = el('plugin-sidebar');
            instControls.classList.add('ai-focus');

            for (const [pName, pVal] of Object.entries(pDataInst)) {
                checkAbort();
                if (sequencer.trackParams[instKey][pName] === pVal) continue;

                sequencer.setParam(instKey, pName, pVal);

                let fxPageIdx = -1;
                FX_PAGES.forEach((page, idx) => {
                    if (page.some(modName => pName.startsWith(modName))) fxPageIdx = idx;
                });

                if (fxPageIdx !== -1) {
                    state.fxPage = fxPageIdx;
                    renderFXControls();
                    pluginSidebar.classList.add('ai-focus');
                    const modName = FX_PAGES[fxPageIdx].find(m => pName.startsWith(m));
                    const modEl = document.querySelector(`.fx-module[data-mod="${modName}"]`);
                    if (modEl) modEl.classList.add('ai-focus');
                }

                let shouldAudition = true;
                if (pName.endsWith('Enabled') && !pVal) shouldAudition = false;
                const fxMods = ['lpFilter', 'hpFilter', 'saturation', 'compression', 'sidechain', 'reverb'];
                for (const mod of fxMods) {
                    if (pName.startsWith(mod) && pName !== mod + 'Enabled' && !sequencer.trackParams[instKey][mod + 'Enabled']) {
                        shouldAudition = false;
                    }
                }

                if (shouldAudition) {
                    audioEngine.play(instKey, sequencer.trackParams[instKey]);
                    renderKnobs(); renderFXControls();
                    await sleep(80);
                } else {
                    renderKnobs(); renderFXControls();
                    await sleep(30);
                }

                if (fxPageIdx !== -1) {
                    pluginSidebar.classList.remove('ai-focus');
                    queryAll('.fx-module').forEach(m => m.classList.remove('ai-focus'));
                }
            }
            instControls.classList.remove('ai-focus');
            await sleep(150);
        }
    }

    // 3. Animate Pattern Hits
    const patternsToLoad = data.patterns ? Object.entries(data.patterns) : (data.pattern ? [[sequencer.currentPatternId, data]] : []);

    // In CHAIN mode, set up the chain from pattern IDs before programming
    if (ctx.targetMode === 'CHAIN' && patternsToLoad.length > 0 && (!data.track || !data.track.length)) {
        const patternIds = patternsToLoad.map(([pId]) => pId);
        sequencer.trackMeasures.fill(null);
        patternIds.forEach((p, i) => { if (i < 96) sequencer.trackMeasures[i] = p; });
        // Set patternChain for visual indicator on pattern buttons
        sequencer.patternChain = [...patternIds];
        updateTrackUI();
        updatePatternUI();
        // Enable track mode to show the chain
        if (!sequencer.trackMode) elements.trackModeToggle.click();
        showToast(`Chain: ${patternIds.join(' → ')}`, 'info');
        await sleep(600);
    }

    for (const [pId, pData] of patternsToLoad) {
        checkAbort();

        // Skip invalid pattern IDs
        const existingPattern = sequencer.patterns[pId];
        if (!existingPattern) {
            console.warn(`Skipping invalid pattern ID: ${pId}`);
            continue;
        }

        const pattern = pData.pattern || pData;

        // Check what changed
        const metadataChanged = (pData.numSteps && pData.numSteps !== existingPattern.numSteps) ||
                              (pData.scale && Math.abs(pData.scale - (existingPattern.scale || 1)) > 0.01) ||
                              (pData.shuffle !== undefined && pData.shuffle !== (existingPattern.shuffle || 0));

        const anyHitsChanged = pattern && Object.keys(pattern).some(instKey => {
            if (!sequencer.INSTS.includes(instKey)) return false;
            const currentHits = existingPattern.tracks[instKey];
            const trackData = pattern[instKey];
            if (!currentHits || !trackData) return false;
            return Array.isArray(trackData)
                ? trackData.some((v, i) => (typeof v === 'boolean' ? (v ? 1 : 0) : (parseInt(v) || 0)) !== currentHits[i])
                : Object.entries(trackData).some(([idx, v]) => (typeof v === 'boolean' ? (v ? 1 : 0) : (parseInt(v) || 0)) !== currentHits[parseInt(idx)]);
        });

        const anyFlamsChanged = pData.flams ? Object.keys(pData.flams).some(instKey => {
            if (!sequencer.INSTS.includes(instKey)) return false;
            const currentFlams = existingPattern.flams[instKey];
            const flamData = pData.flams[instKey];
            if (!currentFlams || !flamData) return false;
            return Array.isArray(flamData)
                ? flamData.some((v, i) => !!v !== currentFlams[i])
                : Object.entries(flamData).some(([idx, v]) => !!v !== currentFlams[parseInt(idx)]);
        }) : false;

        if (metadataChanged || anyHitsChanged || anyFlamsChanged) {
            if (reasoning.length > 0) showReasoning(reasoning.shift());
            showToast(`Building pattern ${pId}...`, 'info');
            sequencer.loadPattern({ numSteps: pData.numSteps, scale: pData.scale, shuffle: pData.shuffle, pattern: {} }, pId);
            sequencer.switchPattern(pId, true);
            state.bank = banks[1].includes(pId) ? 1 : 2;
            syncGlobalKnobs(); updateBankUI();
            await sleep(500);
        } else {
            sequencer.loadPattern({ numSteps: pData.numSteps, scale: pData.scale, shuffle: pData.shuffle, pattern: {} }, pId);
        }

        // Process hits
        if (pattern) {
            const hitInsts = Object.keys(pattern).filter(k => sequencer.INSTS.includes(k));
            for (const instKey of hitInsts) {
                checkAbort();
                const trackData = pattern[instKey];
                if (!trackData) continue;

                const currentHits = sequencer.patterns[pId].tracks[instKey];
                if (!currentHits) continue;

                const hitsChanged = Array.isArray(trackData)
                    ? trackData.some((v, i) => (typeof v === 'boolean' ? (v ? 1 : 0) : (parseInt(v) || 0)) !== currentHits[i])
                    : Object.entries(trackData).some(([idx, v]) => (typeof v === 'boolean' ? (v ? 1 : 0) : (parseInt(v) || 0)) !== currentHits[parseInt(idx)]);

                if (hitsChanged) {
                    const dispName = audioEngine.manifest.instruments[instKey]?.displayName || instKey;
                    setCurrentInstrument(instKey);
                    elements.instName.innerText = dispName.toUpperCase();
                    queryAll('.inst-btn').forEach(btn => btn.classList.toggle('active', btn.dataset.inst === instKey));
                    state.bank = banks[1].includes(pId) ? 1 : 2;
                    updateBankUI();
                    renderKnobs();

                    showToast(`Programming ${dispName}...`, 'info');
                    const seqSection = el('sequencer');
                    seqSection.classList.add('ai-focus');

                    sequencer.patterns[pId].tracks[instKey].fill(0);
                    renderSteps();
                    await sleep(150);

                    const hitSteps = Array.isArray(trackData)
                        ? trackData.map((v, i) => [i, v]).filter(pair => pair[1] > 0)
                        : Object.entries(trackData).filter(pair => pair[1] > 0);

                    for (const [stepStr, val] of hitSteps) {
                        checkAbort();
                        const sIdx = parseInt(stepStr);
                        if (sIdx >= 32) continue;
                        const numVal = typeof val === 'boolean' ? (val ? 1 : 0) : Math.max(0, Math.min(2, parseInt(val) || 0));
                        sequencer.patterns[pId].tracks[instKey][sIdx] = numVal;
                        const btns = queryAll('.step-btn');
                        if (btns[sIdx]) btns[sIdx].className = `step-btn ${numVal === 1 ? 'on-normal' : numVal === 2 ? 'on-accented' : ''} ${sequencer.patterns[pId].flams[instKey][sIdx] ? 'has-flam' : ''}`;
                        await sleep(60);
                    }

                    audioEngine.play(instKey, sequencer.trackParams[instKey]);
                    await sleep(200);
                    seqSection.classList.remove('ai-focus');
                } else {
                    sequencer.loadPattern({ pattern: { [instKey]: trackData } }, pId);
                }
            }
        }

        // Flams
        const flamInsts = pData.flams ? Object.keys(pData.flams).filter(k => sequencer.INSTS.includes(k)) : [];
        for (const instKey of flamInsts) {
            checkAbort();
            const flamData = pData.flams[instKey];
            if (!flamData) continue;

            const currentFlams = sequencer.patterns[pId].flams[instKey];
            if (!currentFlams) continue;

            const flamsChanged = Array.isArray(flamData)
                ? flamData.some((v, i) => !!v !== currentFlams[i])
                : Object.entries(flamData).some(([idx, v]) => !!v !== currentFlams[parseInt(idx)]);

            if (flamsChanged) {
                const dispName = audioEngine.manifest.instruments[instKey]?.displayName || instKey;
                setCurrentInstrument(instKey);
                elements.instName.innerText = dispName.toUpperCase();
                queryAll('.inst-btn').forEach(btn => btn.classList.toggle('active', btn.dataset.inst === instKey));
                renderKnobs();

                showToast(`Adding flams to ${dispName}...`, 'info');
                const seqSection = el('sequencer');
                seqSection.classList.add('ai-focus');

                const flamEntries = Array.isArray(flamData) ? flamData.map((v, i) => [i, v]) : Object.entries(flamData);
                for (const [stepStr, val] of flamEntries) {
                    checkAbort();
                    const sIdx = parseInt(stepStr);
                    if (sIdx >= 32) continue;
                    sequencer.patterns[pId].flams[instKey][sIdx] = !!val;
                    renderSteps();
                    await sleep(40);
                }

                await sleep(150);
                seqSection.classList.remove('ai-focus');
            } else {
                sequencer.loadPattern({ flams: { [instKey]: flamData } }, pId);
            }
        }

        // Audition pattern
        if (reasoning.length > 0) showReasoning(reasoning.shift());
        showToast(`Auditioning pattern ${pId}...`, 'info');
        elements.playLabel.innerText = "STOP";
        elements.playBtn.classList.add('playing');
        sequencer.start();
        const cycleTime = (60000 / sequencer.bpm / 4) * (sequencer.patterns[pId].scale || 1.0) * sequencer.numSteps;

        const auditionStart = Date.now();
        while (Date.now() - auditionStart < cycleTime) {
            checkAbort();
            await sleep(100);
        }

        sequencer.stop();
        elements.playLabel.innerText = "START";
        elements.playBtn.classList.remove('playing');
        queryAll('.step-btn').forEach(b => b.classList.remove('active-step'));
        await sleep(300);
    }

    // 4. Track structure
    if (data.track && data.track.length) {
        checkAbort();
        const currentTrack = sequencer.trackMeasures.filter(m => m !== null);
        const trackChanged = JSON.stringify(data.track) !== JSON.stringify(currentTrack);

        if (trackChanged) {
            if (reasoning.length > 0) showReasoning(reasoning.shift());
            showToast(`Arranging ${data.track.length} measures...`, 'info');

            sequencer.trackMeasures.fill(null);
            data.track.forEach((p, i) => { if (i < 96) sequencer.trackMeasures[i] = p; });
            updateTrackUI();

            if (ctx.targetMode === 'TRACK') {
                if (sequencer.trackMode) elements.trackModeToggle.click();
                if (!sequencer.songMode) elements.songModeToggle.click();
                await sleep(500);
            }
        } else {
            sequencer.trackMeasures.fill(null);
            data.track.forEach((p, i) => { if (i < 96) sequencer.trackMeasures[i] = p; });
            updateTrackUI();
        }
    }

    // 5. Track name & Description
    if (data.description && !sequencer.trackDescription) {
        checkAbort();
        showToast("Writing creative brief...", 'info');
        elements.trackDescriptionInput.value = "";
        const desc = data.description;
        for (let i = 0; i < desc.length; i++) {
            checkAbort();
            elements.trackDescriptionInput.value += desc[i];
            sequencer.trackDescription = elements.trackDescriptionInput.value;
            if (i % 3 === 0) await sleep(10);
        }
        await sleep(300);
    } else if (data.description) {
        sequencer.trackDescription = data.description;
        elements.trackDescriptionInput.value = data.description;
    }

    if (data.trackName && data.trackName !== sequencer.trackName) {
        // Show any remaining reasoning
        while (reasoning.length > 0) {
            checkAbort();
            showReasoning(reasoning.shift());
            await sleep(600);
        }
        showToast(`Naming: "${data.trackName}"`, 'info');
        elements.trackNameInput.value = "";
        for (const char of data.trackName) {
            checkAbort();
            elements.trackNameInput.value += char;
            sequencer.trackName = elements.trackNameInput.value;
            await sleep(25);
        }
        await sleep(200);
    } else if (data.trackName) {
        sequencer.trackName = data.trackName;
        elements.trackNameInput.value = data.trackName;
    }

    // Show any remaining reasoning at the end
    while (reasoning.length > 0) {
        checkAbort();
        showReasoning(reasoning.shift());
        await sleep(600);
    }
}
