/**
 * Neon Synth 2 - Cloud Integration
 *
 * Uses neon-cloud library for collaboration, with app-specific UI rendering.
 */

import { showToast } from '../../packages/neon-ui/index.js';
import { CloudStore, timeAgo } from '../../packages/neon-cloud/index.js';

const el = id => document.getElementById(id);
const queryAll = s => document.querySelectorAll(s);

/**
 * Generate AI-powered commit messages for synth changes
 */
async function generateSynthCommitMessage(changes, prevData, currData, options = {}) {
    if (options.isRemix && options.remixSource) {
        return `Remixed from @${options.remixSource.owner}/${options.remixSource.name}`;
    }

    if (changes.isInitial) {
        return "Initial commit";
    }

    if (changes.summary.length === 0) {
        return "Minor adjustments";
    }

    const parts = changes.summary;

    try {
        const response = await websim.chat.completions.create({
            messages: [{
                role: "user",
                content: `Generate a brief, meaningful commit message (max 50 chars) for a synth track. These changes were made:\n\n${parts.join('\n')}\n\nWrite a concise message that captures the essence of these changes. Reply with ONLY the message, no quotes. Examples: "New acid bassline in track 1", "Added dreamy pad progression", "Tweaked filter resonance"`
            }]
        });
        return response.content.trim().replace(/^["']|["']$/g, '').substring(0, 60);
    } catch (e) {
        return parts[0]?.substring(0, 60) || "Updated track";
    }
}

export function setupCloud(room, ctx) {
    const { app, engine, pianoRoll, elements } = ctx;

    // Create cloud store with synth-specific configuration
    const store = new CloudStore({
        room,
        getCurrentUser: () => websim.getCurrentUser(),
        generateCommitMessage: generateSynthCommitMessage,
        diffConfig: {
            scalarFields: ['songTitle', 'bpm', 'rootKey', 'rootOctave', 'steps', 'numKeys', 'trackName', 'trackDescription', 'thumbnailUrl', 'currentPatternId', 'trackSkill'],
            objectFields: ['trackParams', 'globalParams', 'patterns'],
            arrayFields: ['tracks', 'trackNames'],
            ignoreFields: ['_id', 'id', 'createdAt', 'updatedAt', 'selectedTrackIdx']
        }
    });

    // UI state
    let currentFilter = 'all';
    let currentPage = 1;
    const pageSize = 10;

    // Get current synth state for saving
    function getCurrentState() {
        // Save current pattern before getting state
        if (app.saveCurrentToPattern) {
            app.saveCurrentToPattern(app.currentPatternId);
        }

        return {
            songTitle: app.trackName?.trim() || 'Untitled',
            trackName: app.trackName || '',
            trackDescription: app.trackDescription || '',
            thumbnailUrl: app.thumbnailUrl || null,
            trackSkill: app.trackSkill || null,
            trackNames: pianoRoll.trackNames,
            trackParams: engine.trackParams,
            globalParams: {
                ...engine.globalParams,
                masterVolume: Math.round(engine.globalParams.masterVolume * 100)
            },
            steps: pianoRoll.steps,
            numKeys: pianoRoll.numKeys,
            rootKey: parseInt(elements.rootKeySelect.value),
            rootOctave: parseInt(elements.octaveSelect.value),
            tracks: pianoRoll.getTracksAsTracker(),
            currentPatternId: app.currentPatternId || 'A',
            patterns: app.patterns ? JSON.parse(JSON.stringify(app.patterns)) : {}
        };
    }

    // Apply state to synth
    function applyState(state) {
        if (state.songTitle && !state.trackName) {
            // Use songTitle as trackName for backwards compatibility
            app.trackName = state.songTitle;
            if (app.trackPanel) app.trackPanel.setTitle(state.songTitle);
        }

        // Apply track metadata
        if (state.trackName !== undefined) {
            app.trackName = state.trackName;
            if (app.trackPanel) app.trackPanel.setTitle(state.trackName);
        }
        if (state.trackDescription !== undefined) {
            app.trackDescription = state.trackDescription;
            if (app.trackPanel) app.trackPanel.setDescription(state.trackDescription);
        }
        if (state.thumbnailUrl !== undefined) {
            app.thumbnailUrl = state.thumbnailUrl;
            if (app.trackPanel) app.trackPanel.setThumbnail(state.thumbnailUrl);
        }
        if (state.trackSkill !== undefined) {
            app.trackSkill = state.trackSkill;
        }

        // Apply patterns
        if (state.patterns) {
            app.patterns = JSON.parse(JSON.stringify(state.patterns));
            if (app.updatePatternIndicators) app.updatePatternIndicators();
        }
        if (state.currentPatternId) {
            app.currentPatternId = state.currentPatternId;
            if (app.patternBank) app.patternBank.setActivePattern(state.currentPatternId);
        }

        if (state.steps) {
            pianoRoll.setSteps(state.steps);
        }

        if (state.numKeys !== undefined && [12, 25, 49, 61, 88].includes(state.numKeys)) {
            elements.keyboardSizeSelect.value = state.numKeys;
            app.setKeyboardSize(state.numKeys);
        }

        if (state.rootKey !== undefined) {
            elements.rootKeySelect.value = state.rootKey;
        }
        if (state.rootOctave !== undefined) {
            elements.octaveSelect.value = state.rootOctave;
        }
        app.updateKeyboardRange();

        if (state.globalParams) {
            if (state.globalParams.bpm !== undefined) {
                elements.bpmInput.value = state.globalParams.bpm;
                engine.updateParam('bpm', state.globalParams.bpm);
                pianoRoll.setBPM(state.globalParams.bpm);
            }
            if (state.globalParams.masterVolume !== undefined) {
                app.knobs.masterVolume?.setValue(state.globalParams.masterVolume);
                engine.updateParam('masterVolume', state.globalParams.masterVolume / 100);
            }
        }

        if (state.trackParams) {
            if (Array.isArray(state.trackParams)) {
                state.trackParams.forEach((params, tIdx) => {
                    for (const [key, val] of Object.entries(params)) {
                        engine.updateParam(key, val, tIdx);
                    }
                });
            } else {
                for (const [idx, params] of Object.entries(state.trackParams)) {
                    const tIdx = parseInt(idx);
                    for (const [key, val] of Object.entries(params)) {
                        engine.updateParam(key, val, tIdx);
                    }
                }
            }
            app.refreshUIForTrack(pianoRoll.selectedTrackIdx);
        }

        if (state.trackNames) {
            pianoRoll.setTrackNames(state.trackNames);
        }

        if (state.tracks) {
            pianoRoll.setTracksFromTracker(state.tracks);
        }
    }

    // Update save button state
    function updateSaveButtonState() {
        if (!elements.saveBtn) return;

        const currentData = getCurrentState();
        const { hasChanges: canSave } = store.checkForChanges(currentData);

        elements.saveBtn.disabled = !canSave && store.lastCommitData !== null;
        elements.saveBtn.classList.toggle('no-changes', !canSave && store.lastCommitData !== null);
    }

    // Perform commit
    async function performCommit() {
        let title = app.trackName?.trim() || '';

        if (!title) {
            try {
                const suggested = await websim.chat.completions.create({
                    messages: [{ role: "system", content: "Suggest a 2-word cool neon/synth name for a track. Respond with only the name." }]
                });
                title = suggested.content.trim();
                app.trackName = title;
                if (app.trackPanel) app.trackPanel.setTitle(title);
            } catch (e) {
                title = "Untitled";
            }
        }

        const currentData = getCurrentState();

        const { hasChanges: canSave } = store.checkForChanges(currentData);
        if (store.lastCommitData && !canSave) {
            showToast("NO CHANGES TO SAVE", "info");
            return;
        }

        try {
            elements.saveBtn.disabled = true;

            const result = await store.commit(currentData, {
                name: title,
                stats: { bpm: engine.globalParams.bpm, steps: pianoRoll.steps }
            });

            if (result.error) {
                showToast(result.message.toUpperCase(), "info");
            } else {
                showToast(`COMMITTED: ${result.message.toUpperCase()}`, "success");
            }

        } catch (e) {
            console.error("Commit error:", e);
            showToast("COMMIT FAILED", "error");
        } finally {
            elements.saveBtn.disabled = false;
        }
    }

    // Handle like toggle
    async function handleLike(trackId, e) {
        e.stopPropagation();
        const result = await store.toggleLike(trackId);
        showToast(result.liked ? "ADDED TO LIKES" : "REMOVED FROM LIKES", result.liked ? "success" : "info");
    }

    // Handle track deletion
    async function handleDelete(trackId, e) {
        e.stopPropagation();
        if (confirm("Delete this track and all its history forever?")) {
            await store.deleteTrack(trackId);
            showToast("TRACK DELETED", "info");
        }
    }

    // Handle visibility toggle
    async function toggleVisibility(trackId, currentVisibility, e) {
        e.stopPropagation();
        const newVisibility = currentVisibility === 'private' ? 'public' : 'private';
        await store.setVisibility(trackId, newVisibility);
        showToast(`TRACK IS NOW ${newVisibility.toUpperCase()}`, "info");
    }

    // Record play
    async function recordPlay(trackId) {
        await store.recordPlay(trackId);
    }

    // Load a commit
    async function loadCommit(commitId, autoPlay = false) {
        if (pianoRoll.isPlaying) pianoRoll.toggle();

        const result = await store.loadCommit(commitId);
        if (result.error) return false;

        applyState(result.data);
        updateHistoryIndicator();

        elements.communitySidebar.classList.remove('open');
        elements.communityToggleBtn.classList.remove('active');

        const msgPrefix = result.isHistory ? `VIEWING: ${result.commit.message}` : `LOADED: ${result.track.name}`;
        showToast(msgPrefix.toUpperCase(), "info");

        if (autoPlay) {
            setTimeout(() => {
                if (!pianoRoll.isPlaying) pianoRoll.toggle();
            }, 150);
        }

        return true;
    }

    // Load latest version of a track
    async function loadTrack(trackId, autoPlay = false) {
        const result = await store.loadTrack(trackId);
        if (result.error) return false;

        if (pianoRoll.isPlaying) pianoRoll.toggle();

        applyState(result.data);
        updateHistoryIndicator();

        elements.communitySidebar.classList.remove('open');
        elements.communityToggleBtn.classList.remove('active');

        showToast(`LOADED: ${result.track.name}`.toUpperCase(), "info");

        if (autoPlay) {
            setTimeout(() => {
                if (!pianoRoll.isPlaying) pianoRoll.toggle();
            }, 150);
        }

        return true;
    }

    // Update history indicator
    function updateHistoryIndicator() {
        const indicator = el('history-indicator');
        if (indicator) {
            if (store.isViewingHistory && store.currentCommitId) {
                const commit = store.commits.find(c => c.id === store.currentCommitId);
                indicator.classList.add('visible');
                indicator.innerHTML = `<i data-lucide="history"></i> VIEWING: ${commit?.message || 'Historical version'}`;
                if (window.lucide) window.lucide.createIcons();
            } else {
                indicator.classList.remove('visible');
            }
        }
    }

    // Render inline history for a track
    function renderInlineHistory(trackId, container) {
        const history = store.getTrackHistory(trackId);
        const track = store.findTrack(trackId);

        if (history.length === 0) {
            container.innerHTML = '<div class="history-empty">No commits</div>';
            return;
        }

        container.innerHTML = history.map(commit => `
            <div class="inline-history-item ${commit.id === store.currentCommitId ? 'current' : ''}" data-commit-id="${commit.id}">
                <span class="history-bullet">${commit.id === track?.head_commit_id ? '●' : '○'}</span>
                <span class="history-message">${commit.message || 'No message'}</span>
                <span class="history-time">${timeAgo(commit.created_at)}</span>
            </div>
        `).join('');

        container.querySelectorAll('.inline-history-item').forEach(item => {
            item.onclick = (e) => {
                e.stopPropagation();
                loadCommit(item.dataset.commitId, false);
            };
        });
    }

    // Render the feed
    async function renderFeed() {
        const feed = el('project-feed');
        const pagination = el('feed-pagination');

        const feedData = await store.getFeed({
            filter: currentFilter,
            page: currentPage,
            pageSize
        });

        if (feedData.items.length === 0) {
            feed.innerHTML = `<div class="feed-loading">${currentFilter === 'all' ? 'NO PUBLIC TRACKS YET' : 'YOU HAVE NO SAVED TRACKS'}</div>`;
            pagination.innerHTML = '';
            return;
        }

        feed.innerHTML = feedData.items.map(track => {
            const thumbHtml = track.thumbnail_url
                ? `<div class="feed-item-thumb"><img src="${track.thumbnail_url}"></div>`
                : `<div class="feed-item-thumb"><i data-lucide="music"></i></div>`;

            const remixInfo = track.remixed_from
                ? `<div class="remix-lineage">Remixed from @${track.remixed_from.owner}/${track.remixed_from.name}</div>`
                : '';

            return `
            <div class="feed-item" data-track-id="${track.id}">
                <div class="feed-item-header">
                    ${thumbHtml}
                    <div class="feed-item-title-group">
                        <div class="feed-item-title">${track.name || "Untitled"}</div>
                        ${remixInfo}
                        <div class="track-meta-stats">
                            <span class="meta-stat" data-tooltip="TEMPO"><i data-lucide="gauge"></i> ${track.stats?.bpm || 120}</span>
                            <span class="meta-stat" data-tooltip="STEPS"><i data-lucide="rows-3"></i> ${track.stats?.steps || 16}</span>
                            <span class="meta-stat" data-tooltip="COMMITS"><i data-lucide="git-commit"></i> ${track.stats?.commits || 0}</span>
                        </div>
                    </div>
                    <div class="feed-item-user">
                        <img class="feed-item-avatar" src="https://images.websim.com/avatar/${track.owner}">
                        <span>${track.owner}</span>
                    </div>
                </div>

                ${track.latestCommit?.message ? `<div class="feed-item-commit-msg">${track.latestCommit.message}</div>` : ''}

                <div class="feed-item-stats-row">
                    <div class="feed-stats">
                        <span class="stat-unit btn-play-trigger" data-tooltip="PLAY TRACK" data-track-id="${track.id}">
                            <i data-lucide="play-circle"></i> ${track.stats?.plays || 0}
                        </span>
                        <span class="stat-unit" data-tooltip="REMIXES"><i data-lucide="git-branch"></i> ${track.stats?.remixes || 0}</span>
                        <span class="stat-unit btn-like-trigger ${track.isLiked ? 'liked' : ''}" data-tooltip="${track.isLiked ? 'UNLIKE' : 'LIKE'}" data-track-id="${track.id}">
                            <i data-lucide="heart" class="${track.isLiked ? 'liked-icon' : ''}"></i> ${track.stats?.likes || 0}
                        </span>
                    </div>
                    <div class="feed-item-actions">
                        <button class="btn-icon-action btn-history" data-tooltip="HISTORY" data-track-id="${track.id}">
                            <i data-lucide="history"></i>
                        </button>
                        <button class="btn-icon-action btn-remix" data-tooltip="REMIX TRACK" data-track-id="${track.id}">
                            <i data-lucide="disc-3"></i>
                        </button>
                        ${track.isOwner ? `
                            <button class="btn-icon-action btn-visibility" data-tooltip="${track.visibility === 'private' ? 'MAKE PUBLIC' : 'MAKE PRIVATE'}" data-track-id="${track.id}" data-visibility="${track.visibility || 'public'}">
                                <i data-lucide="${track.visibility === 'private' ? 'eye-off' : 'eye'}"></i>
                            </button>
                            <button class="btn-icon-action btn-delete" data-tooltip="DELETE TRACK" data-track-id="${track.id}">
                                <i data-lucide="trash-2"></i>
                            </button>
                        ` : ''}
                    </div>
                </div>

                <div class="feed-item-history" id="history-${track.id}" style="display: none;"></div>
            </div>
            `;
        }).join('');

        // Pagination
        if (feedData.totalPages > 1) {
            pagination.innerHTML = `
                <button class="pagination-btn" id="prev-page" ${currentPage === 1 ? 'disabled' : ''}>PREV</button>
                <span class="pagination-info">${currentPage} / ${feedData.totalPages}</span>
                <button class="pagination-btn" id="next-page" ${currentPage === feedData.totalPages ? 'disabled' : ''}>NEXT</button>
            `;

            el('prev-page').onclick = () => { currentPage--; renderFeed(); feed.scrollTop = 0; };
            el('next-page').onclick = () => { currentPage++; renderFeed(); feed.scrollTop = 0; };
        } else {
            pagination.innerHTML = '';
        }

        if (window.lucide) window.lucide.createIcons();

        bindFeedEventHandlers();
    }

    // Bind feed event handlers
    function bindFeedEventHandlers() {
        queryAll('.feed-item').forEach(item => {
            item.onclick = async (e) => {
                if (e.target.closest('.btn-icon-action') || e.target.closest('.btn-like-trigger') || e.target.closest('.btn-play-trigger') || e.target.closest('.feed-item-history')) return;
                loadTrack(item.dataset.trackId, false);
            };
        });

        queryAll('.btn-play-trigger').forEach(btn => {
            btn.onclick = async (e) => {
                e.stopPropagation();
                const success = await loadTrack(btn.dataset.trackId, true);
                if (success) recordPlay(btn.dataset.trackId);
            };
        });

        queryAll('.btn-remix').forEach(btn => {
            btn.onclick = async (e) => {
                e.stopPropagation();
                const success = await loadTrack(btn.dataset.trackId, false);
                if (success) {
                    showToast("REMIXING TRACK...", "info");
                    setTimeout(() => performCommit(), 500);
                }
            };
        });

        queryAll('.btn-like-trigger').forEach(btn => {
            btn.onclick = (e) => handleLike(btn.dataset.trackId, e);
        });

        queryAll('.btn-delete').forEach(btn => {
            btn.onclick = (e) => handleDelete(btn.dataset.trackId, e);
        });

        queryAll('.btn-visibility').forEach(btn => {
            btn.onclick = (e) => toggleVisibility(btn.dataset.trackId, btn.dataset.visibility, e);
        });

        queryAll('.btn-history').forEach(btn => {
            btn.onclick = (e) => {
                e.stopPropagation();
                const trackId = btn.dataset.trackId;
                const historyEl = el(`history-${trackId}`);
                if (historyEl) {
                    const isVisible = historyEl.style.display !== 'none';
                    historyEl.style.display = isVisible ? 'none' : 'block';
                    if (!isVisible) {
                        renderInlineHistory(trackId, historyEl);
                    }
                }
            };
        });
    }

    // Setup UI event handlers
    elements.saveBtn.onclick = performCommit;

    elements.loadBtn.onclick = () => {
        elements.feedFilterMine.click();
        if (!elements.communitySidebar.classList.contains('open')) {
            elements.communitySidebar.classList.add('open');
            elements.communityToggleBtn.classList.add('active');
        }
    };

    elements.feedFilterAll.onclick = () => {
        currentFilter = 'all';
        currentPage = 1;
        elements.feedFilterAll.classList.add('active');
        elements.feedFilterMine.classList.remove('active');
        renderFeed();
    };

    elements.feedFilterMine.onclick = () => {
        currentFilter = 'mine';
        currentPage = 1;
        elements.feedFilterMine.classList.add('active');
        elements.feedFilterAll.classList.remove('active');
        renderFeed();
    };

    elements.communityToggleBtn.onclick = () => {
        const wasOpen = elements.communitySidebar.classList.contains('open');
        elements.communitySidebar.classList.toggle('open');
        elements.communityToggleBtn.classList.toggle('active', !wasOpen);
        // Default to All Tracks when opening via Activity button
        if (!wasOpen) {
            elements.feedFilterAll.click();
        }
    };

    elements.closeCommunityBtn.onclick = () => {
        elements.communitySidebar.classList.remove('open');
        elements.communityToggleBtn.classList.remove('active');
    };

    // Listen to store events
    store.on('change', () => renderFeed());

    store.on('message', async (data) => {
        const me = await websim.getCurrentUser();
        if (data.targetUsername === me.username && data.senderUsername !== me.username) {
            const track = (data.trackName || "YOUR TRACK").toUpperCase();
            if (data.type === 'track_liked') showToast(`${data.senderUsername} LIKED "${track}"`, 'success');
            if (data.type === 'track_played') showToast(`${data.senderUsername} IS PLAYING "${track}"`, 'info');
            if (data.type === 'track_remixed') showToast(`${data.senderUsername} REMIXED "${track}"`, 'success');
        }
    });

    return {
        performCommit,
        renderFeed,
        recordPlay,
        loadTrack,
        loadCommit,
        updateSaveButtonState,
        getCurrentState,
        applyState,
        get currentTrack() { return store.currentTrack; },
        get currentCommitId() { return store.currentCommitId; },
        get isViewingHistory() { return store.isViewingHistory; }
    };
}
