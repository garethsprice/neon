/**
 * Neon App - Cloud Integration
 *
 * Uses neon-cloud library for collaboration, with app-specific UI rendering.
 *
 * This template demonstrates the standard patterns for cloud save/load functionality:
 * - CloudStore for data persistence
 * - Shared event handlers for like/delete/visibility
 * - History indicator for version viewing
 * - Commit message generation
 */

import { showToast, el, queryAll } from '../../packages/neon-ui/index.js';
import {
    CloudStore,
    timeAgo,
    createCommitMessageGenerator,
    createCloudEventHandlers,
    createHistoryIndicator
} from '../../packages/neon-cloud/index.js';

// Create app-specific commit message generator
// Options: 'drums', 'synth', 'noise', or 'generic'
const generateCommitMessage = createCommitMessageGenerator('generic');

export function setupCloud(room, ctx) {
    // Destructure context - customize based on your app's needs
    const { engine, elements, renderAll, syncUI } = ctx;

    // Create cloud store with app-specific configuration
    const store = new CloudStore({
        room,
        getCurrentUser: () => websim.getCurrentUser(),
        generateCommitMessage,
        // Optional: prefix for collection names (useful for multi-app setups)
        // collectionPrefix: 'myapp_',
        diffConfig: {
            // Fields that are simple values (strings, numbers, booleans)
            scalarFields: ['name', 'description', 'thumbnailUrl', 'bpm'],
            // Fields that are objects (will deep-diff)
            objectFields: ['params', 'settings'],
            // Fields that are arrays
            arrayFields: ['tracks', 'patterns'],
            // Fields to ignore when checking for changes
            ignoreFields: ['_id', 'id', 'createdAt', 'updatedAt']
        }
    });

    // Create reusable event handlers
    const cloudHandlers = createCloudEventHandlers(store, {
        deleteConfirmMessage: 'Delete this project and all its history forever?'
    });

    // Create history indicator manager
    const historyIndicator = createHistoryIndicator({
        store,
        indicator: el('history-indicator')
    });

    // UI state for feed pagination
    let currentFilter = 'all';
    let currentPage = 1;
    const pageSize = 10;

    // -------------------------------------------------------------------------
    // STATE SERIALIZATION - Customize for your app
    // -------------------------------------------------------------------------

    /**
     * Get current app state for saving
     * Customize this to capture all relevant state from your app
     */
    function getCurrentState() {
        return {
            name: engine.name || 'Untitled',
            description: engine.description || '',
            thumbnailUrl: engine.thumbnailUrl || null,
            // Add your app-specific state here:
            params: engine.serialize?.() || {},
            // bpm: engine.bpm,
            // tracks: engine.tracks,
        };
    }

    /**
     * Apply loaded state to your app
     * Customize this to restore all relevant state
     */
    function applyState(state) {
        if (state.name !== undefined) {
            engine.name = state.name;
        }
        if (state.description !== undefined) {
            engine.description = state.description;
        }
        if (state.thumbnailUrl !== undefined) {
            engine.thumbnailUrl = state.thumbnailUrl;
        }

        // Restore app-specific state
        if (state.params && engine.deserialize) {
            engine.deserialize(state.params);
        }

        // Refresh UI after loading
        if (syncUI) syncUI();
        if (renderAll) renderAll();
    }

    // -------------------------------------------------------------------------
    // SAVE BUTTON STATE
    // -------------------------------------------------------------------------

    function updateSaveButtonState() {
        if (!elements.saveBtn) return;

        const currentData = getCurrentState();
        const { hasChanges: canSave } = store.checkForChanges(currentData);

        elements.saveBtn.disabled = !canSave && store.lastCommitData !== null;
        elements.saveBtn.classList.toggle('no-changes', !canSave && store.lastCommitData !== null);
    }

    // -------------------------------------------------------------------------
    // COMMIT (SAVE)
    // -------------------------------------------------------------------------

    async function performCommit() {
        // Generate name if needed
        let name = engine.name?.trim() || '';

        if (!name) {
            try {
                const suggested = await websim.chat.completions.create({
                    messages: [{
                        role: "system",
                        content: "Suggest a 2-word cool name for a creative project. Respond with only the name."
                    }]
                });
                name = suggested.content.trim();
                engine.name = name;
            } catch (e) {
                name = "Untitled";
            }
        }

        const currentData = getCurrentState();

        // Check for changes
        const { hasChanges: canSave } = store.checkForChanges(currentData);
        if (store.lastCommitData && !canSave) {
            showToast("NO CHANGES TO SAVE", "info");
            return;
        }

        try {
            elements.saveBtn.disabled = true;

            const result = await store.commit(currentData, {
                name,
                description: engine.description || '',
                stats: {
                    // Add app-specific stats for the feed display
                    // bpm: engine.bpm,
                }
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

    // -------------------------------------------------------------------------
    // SHARED EVENT HANDLERS
    // -------------------------------------------------------------------------

    const handleLike = (trackId, e) => cloudHandlers.handleLike(trackId, e);
    const handleDelete = (trackId, e) => cloudHandlers.handleDelete(trackId, e, renderFeed);
    const toggleVisibility = (trackId, currentVisibility, e) => cloudHandlers.toggleVisibility(trackId, currentVisibility, e);
    const recordPlay = (trackId) => cloudHandlers.recordPlay(trackId);

    // -------------------------------------------------------------------------
    // LOAD FUNCTIONS
    // -------------------------------------------------------------------------

    async function loadCommit(commitId, autoPlay = false) {
        const result = await store.loadCommit(commitId);
        if (result.error) return false;

        applyState(result.data);
        historyIndicator.update();

        elements.communitySidebar?.classList.remove('open');
        elements.communityToggleBtn?.classList.remove('active');

        const msgPrefix = result.isHistory
            ? `VIEWING: ${result.commit.message}`
            : `LOADED: ${result.track.name}`;
        showToast(msgPrefix.toUpperCase(), "info");

        return true;
    }

    async function loadTrack(trackId, autoPlay = false) {
        const result = await store.loadTrack(trackId);
        if (result.error) return false;

        applyState(result.data);
        historyIndicator.update();

        elements.communitySidebar?.classList.remove('open');
        elements.communityToggleBtn?.classList.remove('active');

        showToast(`LOADED: ${result.track.name}`.toUpperCase(), "info");

        return true;
    }

    // -------------------------------------------------------------------------
    // INLINE HISTORY
    // -------------------------------------------------------------------------

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

    // -------------------------------------------------------------------------
    // FEED RENDERING
    // -------------------------------------------------------------------------

    async function renderFeed() {
        const feed = el('project-feed');
        const pagination = el('feed-pagination');

        if (!feed) return;

        const feedData = await store.getFeed({
            filter: currentFilter,
            page: currentPage,
            pageSize
        });

        if (feedData.items.length === 0) {
            feed.innerHTML = `<div class="feed-loading">${currentFilter === 'all' ? 'NO PUBLIC PROJECTS YET' : 'YOU HAVE NO SAVED PROJECTS'}</div>`;
            if (pagination) pagination.innerHTML = '';
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
                        <span class="stat-unit btn-play-trigger" data-tooltip="LOAD" data-track-id="${track.id}">
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
                        <button class="btn-icon-action btn-remix" data-tooltip="REMIX" data-track-id="${track.id}">
                            <i data-lucide="disc-3"></i>
                        </button>
                        ${track.isOwner ? `
                            <button class="btn-icon-action btn-visibility" data-tooltip="${track.visibility === 'private' ? 'MAKE PUBLIC' : 'MAKE PRIVATE'}" data-track-id="${track.id}" data-visibility="${track.visibility || 'public'}">
                                <i data-lucide="${track.visibility === 'private' ? 'eye-off' : 'eye'}"></i>
                            </button>
                            <button class="btn-icon-action btn-delete" data-tooltip="DELETE" data-track-id="${track.id}">
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
        if (pagination && feedData.totalPages > 1) {
            pagination.innerHTML = `
                <button class="pagination-btn" id="prev-page" ${currentPage === 1 ? 'disabled' : ''}>PREV</button>
                <span class="pagination-info">${currentPage} / ${feedData.totalPages}</span>
                <button class="pagination-btn" id="next-page" ${currentPage === feedData.totalPages ? 'disabled' : ''}>NEXT</button>
            `;

            el('prev-page').onclick = () => { currentPage--; renderFeed(); feed.scrollTop = 0; };
            el('next-page').onclick = () => { currentPage++; renderFeed(); feed.scrollTop = 0; };
        } else if (pagination) {
            pagination.innerHTML = '';
        }

        if (window.lucide) window.lucide.createIcons();

        bindFeedEventHandlers();
    }

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
                    showToast("REMIXING...", "info");
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

    // -------------------------------------------------------------------------
    // UI EVENT HANDLERS
    // -------------------------------------------------------------------------

    if (elements.saveBtn) {
        elements.saveBtn.onclick = performCommit;
    }

    if (elements.loadBtn) {
        elements.loadBtn.onclick = () => {
            elements.feedFilterMine?.click();
            if (elements.communitySidebar && !elements.communitySidebar.classList.contains('open')) {
                elements.communitySidebar.classList.add('open');
                elements.communityToggleBtn?.classList.add('active');
            }
        };
    }

    if (elements.feedFilterAll) {
        elements.feedFilterAll.onclick = () => {
            currentFilter = 'all';
            currentPage = 1;
            elements.feedFilterAll.classList.add('active');
            elements.feedFilterMine?.classList.remove('active');
            renderFeed();
        };
    }

    if (elements.feedFilterMine) {
        elements.feedFilterMine.onclick = () => {
            currentFilter = 'mine';
            currentPage = 1;
            elements.feedFilterMine.classList.add('active');
            elements.feedFilterAll?.classList.remove('active');
            renderFeed();
        };
    }

    if (elements.communityToggleBtn) {
        elements.communityToggleBtn.onclick = () => {
            const wasOpen = elements.communitySidebar?.classList.contains('open');
            elements.communitySidebar?.classList.toggle('open');
            elements.communityToggleBtn.classList.toggle('active', !wasOpen);
            if (!wasOpen) {
                elements.feedFilterAll?.click();
            }
        };
    }

    if (elements.closeCommunityBtn) {
        elements.closeCommunityBtn.onclick = () => {
            elements.communitySidebar?.classList.remove('open');
            elements.communityToggleBtn?.classList.remove('active');
        };
    }

    // -------------------------------------------------------------------------
    // STORE EVENTS
    // -------------------------------------------------------------------------

    store.on('change', () => renderFeed());

    store.on('committed', () => {
        updateSaveButtonState();
    });

    store.on('message', async (data) => {
        const me = await websim.getCurrentUser();
        if (data.targetUsername === me.username && data.senderUsername !== me.username) {
            const name = (data.trackName || "YOUR PROJECT").toUpperCase();
            if (data.type === 'track_liked') showToast(`${data.senderUsername} LIKED "${name}"`, 'success');
            if (data.type === 'track_played') showToast(`${data.senderUsername} IS VIEWING "${name}"`, 'info');
            if (data.type === 'track_remixed') showToast(`${data.senderUsername} REMIXED "${name}"`, 'success');
        }
    });

    // -------------------------------------------------------------------------
    // PUBLIC API
    // -------------------------------------------------------------------------

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
