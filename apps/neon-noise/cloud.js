/**
 * Neon Noise - Cloud Integration
 *
 * Uses neon-cloud library for saving and loading noise presets.
 */

import { showToast, el } from '../../packages/neon-ui/index.js';
import {
    CloudStore,
    timeAgo,
    generateSimpleCommitMessage,
    createCloudEventHandlers
} from '../../packages/neon-cloud/index.js';

export function setupCloud(room, ctx) {
    const { engine, syncKnobs, saveBtn, loadBtn, getVinylEffect, getChannelEnabled, setChannelEnabled } = ctx;

    // Helper to get combined state (engine + vinyl + channel enabled)
    function getCombinedState() {
        const state = engine.serialize();
        const vinylEffect = getVinylEffect?.();
        if (vinylEffect) {
            state.vinyl = vinylEffect.serialize();
        }
        if (getChannelEnabled) {
            state.channelEnabled = getChannelEnabled();
        }
        return state;
    }

    // Helper to apply combined state
    function applyCombinedState(data) {
        engine.deserialize(data);
        const vinylEffect = getVinylEffect?.();
        if (vinylEffect && data.vinyl) {
            vinylEffect.deserialize(data.vinyl);
        }
        if (setChannelEnabled && data.channelEnabled) {
            setChannelEnabled(data.channelEnabled);
        }
    }

    // Create cloud store
    const store = new CloudStore({
        room,
        getCurrentUser: () => websim.getCurrentUser(),
        generateCommitMessage: generateSimpleCommitMessage,
        collectionPrefix: 'noise_',
        diffConfig: {
            scalarFields: ['name', 'description', 'sensitivity'],
            objectFields: ['volumes', 'vinyl', 'channelEnabled'],
            arrayFields: [],
            ignoreFields: ['_id', 'id', 'createdAt', 'updatedAt']
        }
    });

    // Create reusable event handlers
    const cloudHandlers = createCloudEventHandlers(store, {
        deleteConfirmMessage: 'Delete this preset forever?'
    });

    // UI state
    let currentFilter = 'all';
    let currentPage = 1;
    const pageSize = 10;

    // Elements
    const sidebar = el('presets-sidebar');
    const closeSidebarBtn = el('close-sidebar-btn');
    const feedContainer = el('preset-feed');
    const pagination = el('feed-pagination');
    const filterAll = el('filter-all');
    const filterMine = el('filter-mine');

    // Update save button state
    function updateSaveButtonState() {
        if (!saveBtn) return;
        const currentData = getCombinedState();
        const { hasChanges: canSave } = store.checkForChanges(currentData);
        saveBtn.disabled = !canSave && store.lastCommitData !== null;
    }

    // Perform commit
    async function performCommit() {
        // Generate preset name if needed
        if (!engine.name) {
            const noiseTypes = [];
            if (engine.volumes.white > 0.3) noiseTypes.push('White');
            if (engine.volumes.pink > 0.3) noiseTypes.push('Pink');
            if (engine.volumes.brown > 0.3) noiseTypes.push('Brown');
            if (engine.volumes.green > 0.3) noiseTypes.push('Green');
            const vinylEffect = getVinylEffect?.();
            if (vinylEffect && vinylEffect.params.hissLevel > 0.3) noiseTypes.push('Vinyl');

            engine.name = noiseTypes.length > 0
                ? `${noiseTypes.join(' + ')} Mix`
                : 'Custom Noise';
        }

        const currentData = getCombinedState();
        const { hasChanges: canSave } = store.checkForChanges(currentData);

        if (store.lastCommitData && !canSave) {
            showToast("NO CHANGES TO SAVE", "info");
            return;
        }

        try {
            saveBtn.disabled = true;

            const result = await store.commit(currentData, {
                name: engine.name,
                description: engine.description || '',
                stats: {
                    channels: Object.keys(engine.volumes).filter(k => k !== 'master' && engine.volumes[k] > 0.1).length
                }
            });

            if (result.error) {
                showToast(result.message.toUpperCase(), "info");
            } else {
                showToast(`SAVED: ${result.message.toUpperCase()}`, "success");
            }

        } catch (e) {
            console.error("Save error:", e);
            showToast("SAVE FAILED", "error");
        } finally {
            saveBtn.disabled = false;
        }
    }

    // Load a preset
    async function loadPreset(trackId) {
        const result = await store.loadTrack(trackId);
        if (result.error) return false;

        applyCombinedState(result.data);
        syncKnobs();

        sidebar.classList.remove('open');
        loadBtn.classList.remove('active');

        showToast(`LOADED: ${result.track.name}`.toUpperCase(), "info");
        return true;
    }

    // Use shared event handlers
    const handleLike = (trackId, e) => cloudHandlers.handleLike(trackId, e);
    const handleDelete = (trackId, e) => cloudHandlers.handleDelete(trackId, e, renderFeed);

    // Render the feed
    async function renderFeed() {
        const feedData = await store.getFeed({
            filter: currentFilter,
            page: currentPage,
            pageSize
        });

        if (feedData.items.length === 0) {
            feedContainer.innerHTML = `<div class="feed-empty">${currentFilter === 'all' ? 'NO PRESETS YET' : 'YOU HAVE NO SAVED PRESETS'}</div>`;
            pagination.innerHTML = '';
            return;
        }

        feedContainer.innerHTML = feedData.items.map(track => {
            const volumes = track.latestCommit?.data?.volumes || {};
            const colorBars = `
                <div class="preset-colors">
                    <span class="color-bar white" style="opacity: ${volumes.white || 0}"></span>
                    <span class="color-bar pink" style="opacity: ${volumes.pink || 0}"></span>
                    <span class="color-bar brown" style="opacity: ${volumes.brown || 0}"></span>
                    <span class="color-bar green" style="opacity: ${volumes.green || 0}"></span>
                </div>
            `;

            return `
            <div class="feed-item" data-track-id="${track.id}">
                <div class="feed-item-header">
                    ${colorBars}
                    <div class="feed-item-info">
                        <div class="feed-item-title">${track.name || "Untitled"}</div>
                        <div class="feed-item-meta">
                            <span class="feed-item-user">@${track.owner}</span>
                            <span class="feed-item-time">${timeAgo(track.updated_at)}</span>
                        </div>
                    </div>
                </div>
                <div class="feed-item-actions">
                    <button class="feed-action btn-like ${track.isLiked ? 'liked' : ''}" data-track-id="${track.id}">
                        ♥ ${track.stats?.likes || 0}
                    </button>
                    ${track.isOwner ? `
                        <button class="feed-action btn-delete" data-track-id="${track.id}">✕</button>
                    ` : ''}
                </div>
            </div>
            `;
        }).join('');

        // Pagination
        if (feedData.totalPages > 1) {
            pagination.innerHTML = `
                <button class="pagination-btn" id="prev-page" ${currentPage === 1 ? 'disabled' : ''}>◀</button>
                <span class="pagination-info">${currentPage} / ${feedData.totalPages}</span>
                <button class="pagination-btn" id="next-page" ${currentPage === feedData.totalPages ? 'disabled' : ''}>▶</button>
            `;
            el('prev-page').onclick = () => { currentPage--; renderFeed(); };
            el('next-page').onclick = () => { currentPage++; renderFeed(); };
        } else {
            pagination.innerHTML = '';
        }

        bindFeedEventHandlers();
    }

    // Bind feed event handlers
    function bindFeedEventHandlers() {
        feedContainer.querySelectorAll('.feed-item').forEach(item => {
            item.onclick = (e) => {
                if (e.target.closest('.feed-action')) return;
                loadPreset(item.dataset.trackId);
            };
        });

        feedContainer.querySelectorAll('.btn-like').forEach(btn => {
            btn.onclick = (e) => handleLike(btn.dataset.trackId, e);
        });

        feedContainer.querySelectorAll('.btn-delete').forEach(btn => {
            btn.onclick = (e) => handleDelete(btn.dataset.trackId, e);
        });
    }

    // Setup UI event handlers
    if (saveBtn) {
        saveBtn.onclick = performCommit;
    }

    if (loadBtn) {
        loadBtn.onclick = () => {
            const isOpen = sidebar.classList.toggle('open');
            loadBtn.classList.toggle('active', isOpen);
            if (isOpen) renderFeed();
        };
    }

    if (closeSidebarBtn) {
        closeSidebarBtn.onclick = () => {
            sidebar.classList.remove('open');
            loadBtn.classList.remove('active');
        };
    }

    if (filterAll) {
        filterAll.onclick = () => {
            currentFilter = 'all';
            currentPage = 1;
            filterAll.classList.add('active');
            filterMine.classList.remove('active');
            renderFeed();
        };
    }

    if (filterMine) {
        filterMine.onclick = () => {
            currentFilter = 'mine';
            currentPage = 1;
            filterMine.classList.add('active');
            filterAll.classList.remove('active');
            renderFeed();
        };
    }

    // Listen to store events
    store.on('change', () => {
        if (sidebar.classList.contains('open')) renderFeed();
    });

    store.on('committed', () => {
        updateSaveButtonState();
    });

    return {
        performCommit,
        renderFeed,
        loadPreset,
        updateSaveButtonState,
        get currentTrack() { return store.currentTrack; }
    };
}
