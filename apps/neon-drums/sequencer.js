export class Sequencer {
    constructor(audioEngine) {
        this.audio = audioEngine;
        this.IDS = 'ABCDEFGHIJKLMNOP'.split('');
        this.INSTS = ['bassDrum','snareDrum','lowTom','midTom','highTom','rimshot','handclap','closedHiHat','openHiHat','crashCymbal','rideCymbal'];
        
        this.onStepChange = null;
        this.onPatternChange = null;
        this.onInstrumentTrigger = null;
        this.onTrackUpdate = null;

        // Define getters for current pattern tracks/flams once in constructor
        // This avoids "redefine property" errors when initData is called during resets
        Object.defineProperty(this, 'tracks', { get: () => this.patterns[this.currentPatternId]?.tracks });
        Object.defineProperty(this, 'flams', { get: () => this.patterns[this.currentPatternId]?.flams });

        this.initData();
    }

    initData() {
        this.bpm = 120; this.isPlaying = false; this.currentStep = 0; this.numSteps = 16;
        this.currentPatternId = 'A'; this.patterns = {};
        this.IDS.forEach(id => {
            this.patterns[id] = {
                numSteps: 16, scale: 1, shuffle: 0,
                tracks: Object.fromEntries(this.INSTS.map(k => [k, Array(32).fill(0)])),
                flams: Object.fromEntries(this.INSTS.map(k => [k, Array(32).fill(false)]))
            };
        });
        
        this.trackParams = {};
        this.INSTS.forEach(key => {
            const info = this.audio.manifest?.instruments[key] || { parameters: [] };
            this.trackParams[key] = {
                saturationEnabled: false, saturationDrive: 20, compressionEnabled: false, compressionThreshold: 50,
                compressionRatio: 50, sidechainEnabled: false, sidechainAmount: 50, sidechainRelease: 30,
                reverbEnabled: false, reverbMix: 15, delayEnabled: false, delayTime: 30, delayFeedback: 40, delayMix: 30,
                lpFilterEnabled: false, lpFilterCutoff: 100, lpFilterResonance: 0,
                hpFilterEnabled: false, hpFilterCutoff: 0, hpFilterResonance: 0,
                flamAmount: 20, level: 80
            };
            [...info.parameters].forEach(p => {
                const scale = this.audio.getScaleForParam(key, p);
                this.trackParams[key][p] = scale[Math.floor(scale.length / 2)];
            });
            if(this.audio.isLoaded) this.audio.updateFX(key, this.trackParams[key]);
        });

        this.patternChain = []; this.currentChainIndex = 0; this.masterVolume = 80;
        this.trackMode = this.songMode = this.isTrackPlaying = false; this.trackMeasures = Array(96).fill(null);
        this.currentTrackMeasure = 0; this.trackName = ""; this.trackDescription = ""; this.trackSkill = null;
        this.thumbnailUrl = null;
    }

    toggleStep(instrument, step) {
        // Cycle: 0 (Off) -> 1 (Normal) -> 2 (Accented) -> 0
        this.tracks[instrument][step] = (this.tracks[instrument][step] + 1) % 3;
        return this.tracks[instrument][step];
    }

    toggleFlam(instrument, step) {
        this.flams[instrument][step] = !this.flams[instrument][step];
        return this.flams[instrument][step];
    }

    switchPattern(id, keepChain = false) {
        if (this.patterns[id]) {
            this.currentPatternId = id;
            this.numSteps = this.patterns[id].numSteps;
            
            // Only sync the chain index on manual switches (keepChain = false)
            // Automated transitions from the scheduler should not trigger this logic
            // as the scheduler is already managing the index increment.
            if (!keepChain) {
                const idxInChain = this.patternChain.indexOf(id);
                if (idxInChain !== -1) {
                    this.currentChainIndex = idxInChain;
                } else if (this.patternChain.length <= 1) {
                    // Reset if switching to a non-chained pattern and no substantial chain exists
                    this.patternChain = [];
                    this.currentChainIndex = 0;
                }
            }
        }
    }

    togglePatternInChain(id) {
        const idx = this.patternChain.indexOf(id);
        if (idx > -1) {
            this.patternChain.splice(idx, 1);
        } else {
            this.patternChain.push(id);
            // Sort them A-H for predictable flow (standard behavior for bank chaining)
            this.patternChain.sort();
        }
        
        // Sync the current chain index based on the current pattern
        if (this.patternChain.length > 0) {
            const currentIdxInChain = this.patternChain.indexOf(this.currentPatternId);
            this.currentChainIndex = currentIdxInChain !== -1 ? currentIdxInChain : 0;
        } else {
            this.currentChainIndex = 0;
        }
        
        return this.patternChain;
    }

    copyPattern(fromId, toId) {
        if (!this.patterns[fromId] || !this.patterns[toId]) return;
        const from = this.patterns[fromId];
        const to = this.patterns[toId];
        
        to.numSteps = from.numSteps;
        to.scale = from.scale || 1.0;
        to.shuffle = from.shuffle || 0;
        Object.keys(from.tracks).forEach(key => {
            to.tracks[key] = [...from.tracks[key]];
            to.flams[key] = [...from.flams[key]];
        });
    }

    clearPattern(id) {
        if (this.patterns[id]) {
            Object.keys(this.patterns[id].tracks).forEach(key => {
                this.patterns[id].tracks[key].fill(0);
                this.patterns[id].flams[key].fill(false);
            });
        }
    }

    doublePattern() {
        Object.keys(this.tracks).forEach(key => {
            for (let i = 0; i < 16; i++) {
                this.tracks[key][i + 16] = this.tracks[key][i];
                this.flams[key][i + 16] = this.flams[key][i];
            }
        });
        // Update numSteps for current pattern to 32
        this.patterns[this.currentPatternId].numSteps = 32;
        this.numSteps = 32;
    }

    clearAll() {
        Object.keys(this.tracks).forEach(key => {
            this.tracks[key].fill(0);
            this.flams[key].fill(false);
        });
    }

    clearAllPatterns() {
        this.IDS.forEach(id => this.clearPattern(id));
    }

    resetAll() {
        this.initData();
        this.audio.setMasterVolume(80);
    }

    serialize() {
        const patternsData = {};
        this.IDS.forEach(id => {
            const p = this.patterns[id];
            const hasHits = Object.values(p.tracks).some(t => t.some(v => v > 0));
            if (hasHits) {
                const sparseTracks = {};
                Object.entries(p.tracks).forEach(([inst, hits]) => {
                    if (hits.some(v => v > 0)) {
                        const sparse = {};
                        hits.forEach((v, i) => { if (v > 0) sparse[i] = v; });
                        sparseTracks[inst] = sparse;
                    }
                });
                const sparseFlams = {};
                Object.entries(p.flams).forEach(([inst, flams]) => {
                    if (flams.some(v => v)) {
                        const sparse = {};
                        flams.forEach((v, i) => { if (v) sparse[i] = true; });
                        sparseFlams[inst] = sparse;
                    }
                });
                patternsData[id] = {
                    numSteps: p.numSteps,
                    scale: p.scale,
                    shuffle: p.shuffle,
                    tracks: sparseTracks,
                    flams: sparseFlams
                };
            }
        });

        return {
            bpm: this.bpm,
            trackName: this.trackName,
            trackDescription: this.trackDescription,
            trackSkill: this.trackSkill,
            thumbnailUrl: this.thumbnailUrl,
            masterVolume: this.masterVolume,
            trackMeasures: this.trackMeasures,
            trackParams: this.trackParams,
            patterns: patternsData,
            patternChain: this.patternChain,
            songMode: this.songMode,
            trackMode: this.trackMode
        };
    }

    deserialize(data) {
        if (!data) return;
        this.initData(); // Clear first
        if (data.bpm) this.bpm = data.bpm;
        if (data.trackName) this.trackName = data.trackName;
        if (data.trackDescription) this.trackDescription = data.trackDescription;
        if (data.trackSkill) this.trackSkill = data.trackSkill;
        if (data.thumbnailUrl) this.thumbnailUrl = data.thumbnailUrl;
        if (data.masterVolume !== undefined) this.masterVolume = data.masterVolume;
        if (data.songMode !== undefined) this.songMode = data.songMode;
        if (data.trackMode !== undefined) this.trackMode = data.trackMode;
        
        if (data.trackMeasures) {
            this.trackMeasures = [...data.trackMeasures];
        }

        if (data.patternChain) {
            this.patternChain = [...data.patternChain];
        }

        if (data.trackParams) {
            Object.keys(data.trackParams).forEach(inst => {
                if (this.trackParams[inst]) {
                    Object.assign(this.trackParams[inst], data.trackParams[inst]);
                    if (this.audio.isLoaded) this.audio.updateFX(inst, this.trackParams[inst]);
                }
            });
        }

        if (data.patterns) {
            Object.entries(data.patterns).forEach(([id, pData]) => {
                const target = this.patterns[id];
                if (!target) return;
                target.numSteps = pData.numSteps || 16;
                target.scale = pData.scale || 1.0;
                target.shuffle = pData.shuffle || 0;
                
                if (pData.tracks) {
                    Object.entries(pData.tracks).forEach(([inst, hits]) => {
                        if (target.tracks[inst]) {
                            target.tracks[inst].fill(0);
                            Object.entries(hits).forEach(([idx, val]) => {
                                target.tracks[inst][parseInt(idx)] = val;
                            });
                        }
                    });
                }
                
                if (pData.flams) {
                    Object.entries(pData.flams).forEach(([inst, flams]) => {
                        if (target.flams[inst]) {
                            target.flams[inst].fill(false);
                            Object.entries(flams).forEach(([idx, val]) => {
                                target.flams[inst][parseInt(idx)] = val;
                            });
                        }
                    });
                }
            });
        }
        
        // Sync current pattern metadata
        const current = this.patterns[this.currentPatternId];
        this.numSteps = current.numSteps;
    }

    loadGlobalSettings(data) {
        if (data.bpm) this.bpm = data.bpm;
        if (data.trackName) this.trackName = data.trackName;
        if (data.track) {
            this.trackMeasures.fill(null);
            data.track.forEach((p, i) => { if (i < 96) this.trackMeasures[i] = p; });
        }
        if (data.params) {
            Object.keys(data.params).forEach(instKey => {
                if (this.trackParams[instKey]) {
                    Object.entries(data.params[instKey]).forEach(([paramName, value]) => {
                        this.setParam(instKey, paramName, value);
                    });
                }
            });
        }
    }

    loadPattern(data, targetId = null) {
        const id = targetId || this.currentPatternId;
        const targetPattern = this.patterns[id];
        if (!targetPattern) return;

        const pattern = data.pattern || data;
        let finalNumSteps = 16;
        if (data.numSteps) {
            finalNumSteps = parseInt(data.numSteps);
        } else {
            // Infer from content if not specified
            Object.values(pattern).forEach(trackData => {
                if (Array.isArray(trackData) && trackData.length > 16) finalNumSteps = 32;
                if (typeof trackData === 'object' && trackData !== null) {
                    Object.keys(trackData).forEach(k => {
                        if (parseInt(k) >= 16) finalNumSteps = 32;
                    });
                }
            });
        }
        
        targetPattern.numSteps = finalNumSteps;
        // Only update global display state if modifying current pattern
        if (id === this.currentPatternId) {
            this.numSteps = finalNumSteps;
        }

        if (data.scale !== undefined) {
            targetPattern.scale = parseFloat(data.scale);
        }
        if (data.shuffle !== undefined) {
            targetPattern.shuffle = Math.max(0, Math.min(100, parseInt(data.shuffle)));
        }

        Object.keys(pattern).forEach(key => {
            if (targetPattern.tracks[key]) {
                // Reset track first (flams are only cleared if data.flams specifies them)
                targetPattern.tracks[key].fill(0);

                const trackData = pattern[key];
                
                if (Array.isArray(trackData)) {
                    trackData.forEach((val, idx) => {
                        if (idx < 32) {
                            if (typeof val === 'boolean') {
                                targetPattern.tracks[key][idx] = val ? 1 : 0;
                            } else {
                                targetPattern.tracks[key][idx] = Math.max(0, Math.min(2, parseInt(val) || 0));
                            }
                        }
                    });
                } else if (typeof trackData === 'object' && trackData !== null) {
                    // Handle sparse object representation
                    Object.entries(trackData).forEach(([idx, val]) => {
                        const i = parseInt(idx);
                        if (i >= 0 && i < 32) {
                            if (typeof val === 'boolean') {
                                targetPattern.tracks[key][i] = val ? 1 : 0;
                            } else {
                                targetPattern.tracks[key][i] = Math.max(0, Math.min(2, parseInt(val) || 0));
                            }
                        }
                    });
                }
            }
        });

        if (data.flams) {
            Object.keys(data.flams).forEach(key => {
                if (targetPattern.flams[key]) {
                    // Clear flams for this instrument before setting new values
                    targetPattern.flams[key].fill(false);
                    const flamData = data.flams[key];
                    if (Array.isArray(flamData)) {
                        flamData.forEach((val, idx) => {
                            if (idx < 32) targetPattern.flams[key][idx] = !!val;
                        });
                    } else if (typeof flamData === 'object' && flamData !== null) {
                        Object.entries(flamData).forEach(([idx, val]) => {
                            const i = parseInt(idx);
                            if (i >= 0 && i < 32) targetPattern.flams[key][i] = !!val;
                        });
                    }
                }
            });
        }

    }

    setParam(instrument, param, value) {
        if (this.trackParams[instrument]) {
            // Check if it's a discrete sample param
            const instInfo = this.audio.manifest.instruments[instrument];
            if (instInfo.parameters.includes(param) || param === 'level') {
                const scale = this.audio.getScaleForParam(instrument, param);
                const closest = scale.reduce((prev, curr) => 
                    Math.abs(curr - value) < Math.abs(prev - value) ? curr : prev
                );
                this.trackParams[instrument][param] = closest;
            } else {
                // It's an FX or continuous param
                this.trackParams[instrument][param] = value;
                this.audio.updateFX(instrument, this.trackParams[instrument]);
            }
        }
    }

    start() {
        if (this.isPlaying) return;
        this.isPlaying = true;
        this.currentStep = 0;
        this.schedule();
    }

    stop() {
        this.isPlaying = false;
        if (this.timerId) clearTimeout(this.timerId);
        this.currentStep = 0;
    }

    schedule() {
        if (!this.isPlaying && !this.isTrackPlaying) return;

        // Sidechain Trigger: Check if Bass Drum hits this step
        if (this.tracks['bassDrum'] && this.tracks['bassDrum'][this.currentStep] > 0) {
            this.audio.triggerSidechain('bassDrum', (inst, param) => {
                const params = this.trackParams[inst];
                return params ? params[param] : false;
            });
        }

        // Play active tracks for current step
        Object.keys(this.tracks).forEach(instKey => {
            const hitType = this.tracks[instKey][this.currentStep];
            const isFlam = this.flams[instKey][this.currentStep];

            if (hitType > 0) {
                const params = { ...this.trackParams[instKey] };
                // If accented (2), boost the level significantly
                if (hitType === 2) {
                    params.level = Math.min(100, params.level + 25);
                }

                if (isFlam) {
                    // Flam: play grace note now, main note delayed
                    const graceParams = { ...params, level: params.level * 0.5 };
                    this.audio.play(instKey, graceParams);
                    const flamDelay = this.trackParams[instKey].flamAmount || 20;
                    setTimeout(() => {
                        this.audio.play(instKey, params);
                        if (this.onInstrumentTrigger) this.onInstrumentTrigger(instKey, this.currentStep);
                    }, flamDelay);
                } else {
                    this.audio.play(instKey, params);
                    if (this.onInstrumentTrigger) this.onInstrumentTrigger(instKey, this.currentStep);
                }
            }
        });

        if (this.onStepChange) this.onStepChange(this.currentStep);

        const pattern = this.patterns[this.currentPatternId];
        const scaleMultiplier = pattern.scale || 1.0;
        const shuffleAmount = pattern.shuffle || 0;
        const baseStepDuration = (60000 / this.bpm / 4) * scaleMultiplier;
        
        // Calculate shuffle delay: delays even-indexed steps (1, 3, 5...)
        // Step 1 (idx 0) is odd-numbered, Step 2 (idx 1) is even-numbered.
        const delayMs = baseStepDuration * (shuffleAmount / 100) * 0.5;
        
        let nextInterval = baseStepDuration;
        // If we are currently on an ODD index (0, 2...) we are moving TO an EVEN index (1, 3...). 
        // We increase the interval to delay the even index.
        if (this.currentStep % 2 === 0) {
            nextInterval += delayMs;
        } else {
            // If we are currently on an EVEN index (1, 3...) we are moving TO an ODD index.
            // We decrease the interval to compensate and stay on the grid.
            nextInterval -= delayMs;
        }
        
        this.currentStep = (this.currentStep + 1);

        // Advance Pattern if at end of loop
        if (this.currentStep >= this.numSteps) {
            this.currentStep = 0;
            
            if (this.isTrackPlaying) {
                this.currentTrackMeasure++;
                // End of track reached or empty measure
                if (this.currentTrackMeasure >= 96 || this.trackMeasures[this.currentTrackMeasure] === null) {
                    this.currentTrackMeasure = 0;
                }
                
                const nextId = this.trackMeasures[this.currentTrackMeasure];
                if (nextId) {
                    this.switchPattern(nextId, true);
                    if (this.onPatternChange) this.onPatternChange(nextId);
                }
                if (this.onTrackUpdate) this.onTrackUpdate(this.currentTrackMeasure, nextId);
            } else if (this.patternChain.length > 1) {
                this.currentChainIndex = (this.currentChainIndex + 1) % this.patternChain.length;
                const nextId = this.patternChain[this.currentChainIndex];
                this.switchPattern(nextId, true);
                if (this.onPatternChange) this.onPatternChange(nextId);
            }
        }
        
        this.timerId = setTimeout(() => this.schedule(), nextInterval);
    }
}