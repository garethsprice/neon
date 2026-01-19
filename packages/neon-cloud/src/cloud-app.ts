/**
 * Neon Cloud - High-Level App Integration
 *
 * Provides a simple, declarative API for integrating cloud features into neon apps.
 * Handles all the boilerplate: feed rendering, pagination, event binding, save/load.
 */

import { CloudStore } from './store';
import { timeAgo } from './utils';
import { createCloudEventHandlers, createHistoryIndicator } from './components/event-handlers';
import { createCommitMessageGenerator, generateSimpleCommitMessage } from './commit-generator';
import type { Track, Commit, DiffConfig, EnrichedTrack } from './types';

// Element query helper
const el = (id: string): HTMLElement | null => document.getElementById(id);
const queryAll = (selector: string): NodeListOf<Element> => document.querySelectorAll(selector);

/** Toast notification function type */
type ToastFn = (message: string, type: 'success' | 'error' | 'info') => void;

/** App type for commit message generation */
export type AppType = 'drums' | 'synth' | 'noise' | 'generic';

/** Feed item template customization */
export interface FeedItemTemplate {
  /** Render custom thumbnail/preview */
  renderPreview?: (track: EnrichedTrack) => string;
  /** Render custom stats */
  renderStats?: (track: EnrichedTrack) => string;
  /** Additional CSS class for feed items */
  itemClass?: string;
}

/** Element selectors for cloud UI */
export interface CloudElements {
  saveBtn?: string;
  loadBtn?: string;
  sidebar?: string;
  closeSidebarBtn?: string;
  feedContainer?: string;
  pagination?: string;
  filterAll?: string;
  filterMine?: string;
  historyIndicator?: string;
  playBtn?: string;
}

/** Cloud app configuration */
export interface CloudAppConfig {
  /** WebsimSocket room instance */
  room: WebsimSocketInstance;

  /** App type for commit messages ('drums', 'synth', 'noise', 'generic') */
  appType: AppType;

  /** Get current app state for saving */
  getState: () => Record<string, unknown>;

  /** Apply loaded state to app */
  setState: (state: Record<string, unknown>) => void;

  /** Re-render app UI after state changes */
  renderUI?: () => void;

  /** Track visibility ('public' or 'private') */
  visibility?: 'public' | 'private';

  /** Toast notification function */
  showToast?: ToastFn;

  /** Element selectors (uses defaults if not provided) */
  elements?: CloudElements;

  /** Diff configuration for change detection */
  diffConfig?: Partial<DiffConfig>;

  /** Custom feed item template */
  feedTemplate?: FeedItemTemplate;

  /** Collection prefix for namespacing (e.g., 'noise_') */
  collectionPrefix?: string;

  /** Generate track name if empty */
  generateTrackName?: () => Promise<string> | string;

  /** Get track metadata for commits */
  getTrackMeta?: () => { name: string; description?: string; thumbnailUrl?: string | null; stats?: Record<string, unknown> };

  /** Called after successful load */
  onLoad?: (track: Track | null) => void;

  /** Called after successful commit */
  onCommit?: (track: Track) => void;

  /** Enable history navigation */
  enableHistory?: boolean;

  /** Include Lucide icons in feed */
  useLucideIcons?: boolean;

  /** Page size for feed pagination */
  pageSize?: number;
}

/** Return type for createCloudApp */
export interface CloudAppInstance {
  /** Save current state */
  save: () => Promise<void>;

  /** Render the feed */
  renderFeed: () => Promise<void>;

  /** Load a track by ID */
  loadTrack: (trackId: string, autoPlay?: boolean) => Promise<boolean>;

  /** Load a specific commit */
  loadCommit: (commitId: string) => Promise<boolean>;

  /** Record a play for analytics */
  recordPlay: (trackId: string) => void;

  /** Update save button enabled/disabled state */
  updateSaveButton: () => void;

  /** Get current track info */
  readonly currentTrack: Track | null;

  /** Get current commit ID */
  readonly currentCommitId: string | null;

  /** Check if viewing history */
  readonly isViewingHistory: boolean;

  /** Get the underlying store */
  readonly store: CloudStore;
}

/** Default element selectors */
const DEFAULT_ELEMENTS: Required<CloudElements> = {
  saveBtn: 'global-save-btn',
  loadBtn: 'global-load-btn',
  sidebar: 'community-sidebar',
  closeSidebarBtn: 'close-community-btn',
  feedContainer: 'project-feed',
  pagination: 'feed-pagination',
  filterAll: 'feed-filter-all',
  filterMine: 'feed-filter-mine',
  historyIndicator: 'history-indicator',
  playBtn: 'play-btn'
};

/** Default diff config */
const DEFAULT_DIFF: DiffConfig = {
  scalarFields: ['trackName', 'trackDescription', 'thumbnailUrl', 'bpm'],
  objectFields: ['patterns', 'params'],
  arrayFields: ['tracks'],
  ignoreFields: ['_id', 'id', 'createdAt', 'updatedAt']
};

/** Stub toast if none provided */
// eslint-disable-next-line no-console
const stubToast: ToastFn = (msg, type) => console.warn(`[${type}] ${msg}`);

/**
 * Create a fully-integrated cloud app with minimal configuration.
 *
 * @example
 * ```typescript
 * const cloud = createCloudApp({
 *   room: new WebsimSocket(),
 *   appType: 'drums',
 *   getState: () => sequencer.serialize(),
 *   setState: (data) => sequencer.deserialize(data),
 *   renderUI: () => renderAll(),
 *   showToast,
 *   getTrackMeta: () => ({
 *     name: sequencer.trackName,
 *     description: sequencer.trackDescription,
 *     stats: { bpm: sequencer.bpm }
 *   })
 * });
 * ```
 */
export function createCloudApp(config: CloudAppConfig): CloudAppInstance {
  const {
    room,
    appType,
    getState,
    setState,
    renderUI = () => {},
    visibility = 'public',
    showToast = stubToast,
    elements: elementIds = {},
    diffConfig = {},
    feedTemplate = {},
    collectionPrefix,
    generateTrackName,
    getTrackMeta,
    onLoad,
    onCommit,
    enableHistory = true,
    useLucideIcons = true,
    pageSize = 10
  } = config;

  // Merge element selectors with defaults
  const elIds = { ...DEFAULT_ELEMENTS, ...elementIds };

  // Get elements
  const elements = {
    saveBtn: el(elIds.saveBtn),
    loadBtn: el(elIds.loadBtn),
    sidebar: el(elIds.sidebar),
    closeSidebarBtn: el(elIds.closeSidebarBtn),
    feedContainer: el(elIds.feedContainer),
    pagination: el(elIds.pagination),
    filterAll: el(elIds.filterAll),
    filterMine: el(elIds.filterMine),
    historyIndicator: el(elIds.historyIndicator),
    playBtn: el(elIds.playBtn)
  };

  // Create commit message generator
  const commitMsgGen = appType === 'generic'
    ? generateSimpleCommitMessage
    : createCommitMessageGenerator(appType);

  // Create cloud store
  const store = new CloudStore({
    room,
    getCurrentUser: () => websim.getCurrentUser() as unknown as Promise<{ username: string }>,
    generateCommitMessage: commitMsgGen,
    collectionPrefix,
    diffConfig: { ...DEFAULT_DIFF, ...diffConfig }
  });

  // Create event handlers
  const handlers = createCloudEventHandlers(store, {
    deleteConfirmMessage: 'Delete this track and all its history forever?'
  });

  // Create history indicator if enabled
  const historyIndicator = enableHistory && elements.historyIndicator
    ? createHistoryIndicator({ store, indicator: elements.historyIndicator })
    : null;

  // Feed state
  let currentFilter: 'all' | 'mine' = 'all';
  let currentPage = 1;

  // Update save button state
  function updateSaveButton(): void {
    if (!elements.saveBtn) return;

    const { hasChanges } = store.checkForChanges(getState());
    const btn = elements.saveBtn as HTMLButtonElement;

    btn.disabled = !hasChanges && store.lastCommitData !== null;
    btn.classList.toggle('no-changes', !hasChanges && store.lastCommitData !== null);
    btn.innerText = (!hasChanges && store.lastCommitData) ? 'SAVED' : 'SAVE';
  }

  // Perform commit/save
  async function save(): Promise<void> {
    let meta = getTrackMeta?.() || { name: '' };

    // Generate name if needed
    if (!meta.name && generateTrackName) {
      meta = { ...meta, name: await generateTrackName() };
    }
    if (!meta.name) {
      meta = { ...meta, name: 'Untitled' };
    }

    const currentData = getState();
    const { hasChanges } = store.checkForChanges(currentData);

    if (store.lastCommitData && !hasChanges) {
      showToast('NO CHANGES TO SAVE', 'info');
      return;
    }

    try {
      if (elements.saveBtn) {
        (elements.saveBtn as HTMLButtonElement).disabled = true;
        elements.saveBtn.innerText = '...';
      }

      const result = await store.commit(currentData, {
        name: meta.name,
        description: meta.description || '',
        thumbnailUrl: meta.thumbnailUrl || undefined,
        stats: meta.stats
      }, { visibility });

      if (result.error) {
        showToast((result.message || 'Error').toUpperCase(), 'info');
      } else {
        showToast(`SAVED: ${(result.message || meta.name).toUpperCase()}`, 'success');
        onCommit?.(result.track!);
      }
    } catch (e) {
      console.error('Save error:', e);
      showToast('SAVE FAILED', 'error');
    } finally {
      if (elements.saveBtn) {
        (elements.saveBtn as HTMLButtonElement).disabled = false;
        elements.saveBtn.innerText = 'SAVE';
      }
    }
  }

  // Load a track
  async function loadTrack(trackId: string, autoPlay = false): Promise<boolean> {
    const result = await store.loadTrack(trackId);
    if (result.error) return false;

    setState((result.data || {}) as Record<string, unknown>);
    renderUI();
    historyIndicator?.update();

    closeSidebar();
    showToast(`LOADED: ${result.track?.name || 'Track'}`.toUpperCase(), 'info');
    onLoad?.(result.track || null);

    if (autoPlay && elements.playBtn) {
      setTimeout(() => elements.playBtn?.click(), 150);
    }

    return true;
  }

  // Load a specific commit
  async function loadCommit(commitId: string): Promise<boolean> {
    const result = await store.loadCommit(commitId);
    if (result.error) return false;

    setState((result.data || {}) as Record<string, unknown>);
    renderUI();
    historyIndicator?.update();

    closeSidebar();
    const msg = result.isHistory
      ? `VIEWING: ${result.commit?.message}`
      : `LOADED: ${result.track?.name}`;
    showToast(msg.toUpperCase(), 'info');
    onLoad?.(result.track || null);

    return true;
  }

  // Close sidebar
  function closeSidebar(): void {
    elements.sidebar?.classList.remove('open');
    elements.loadBtn?.classList.remove('active');
  }

  // Open sidebar
  function openSidebar(): void {
    elements.sidebar?.classList.add('open');
    elements.loadBtn?.classList.add('active');
  }

  // Render feed item
  function renderFeedItem(track: EnrichedTrack): string {
    const preview = feedTemplate.renderPreview?.(track) || renderDefaultPreview(track);
    const stats = feedTemplate.renderStats?.(track) || renderDefaultStats(track);
    const itemClass = feedTemplate.itemClass || '';

    const remixInfo = track.remixed_from
      ? `<div class="remix-lineage">Remixed from @${track.remixed_from.owner}/${track.remixed_from.name}</div>`
      : '';

    return `
      <div class="feed-item ${itemClass}" data-track-id="${track.id}">
        <div class="feed-item-header">
          ${preview}
          <div class="feed-item-title-group">
            <div class="feed-item-title">${track.name || 'Untitled'}</div>
            ${remixInfo}
            ${stats}
          </div>
          <div class="feed-item-user">
            <img class="feed-item-avatar" src="https://images.websim.com/avatar/${track.owner}">
            <span>${track.owner}</span>
          </div>
        </div>
        ${track.latestCommit?.message ? `<div class="feed-item-commit-msg">${track.latestCommit.message}</div>` : ''}
        <div class="feed-item-stats-row">
          <div class="feed-stats">
            <span class="stat-unit btn-play-trigger" data-tooltip="PLAY" data-track-id="${track.id}">
              ${useLucideIcons ? '<i data-lucide="play-circle"></i>' : '▶'} ${track.stats?.plays || 0}
            </span>
            <span class="stat-unit" data-tooltip="REMIXES">
              ${useLucideIcons ? '<i data-lucide="git-branch"></i>' : '⑂'} ${track.stats?.remixes || 0}
            </span>
            <span class="stat-unit btn-like-trigger ${track.isLiked ? 'liked' : ''}" data-tooltip="${track.isLiked ? 'UNLIKE' : 'LIKE'}" data-track-id="${track.id}">
              ${useLucideIcons ? `<i data-lucide="heart" class="${track.isLiked ? 'liked-icon' : ''}"></i>` : '♥'} ${track.stats?.likes || 0}
            </span>
          </div>
          <div class="feed-item-actions">
            ${enableHistory ? `
              <button class="btn-icon-action btn-history" data-tooltip="HISTORY" data-track-id="${track.id}">
                ${useLucideIcons ? '<i data-lucide="history"></i>' : '↺'}
              </button>
            ` : ''}
            <button class="btn-icon-action btn-remix" data-tooltip="REMIX" data-track-id="${track.id}">
              ${useLucideIcons ? '<i data-lucide="disc-3"></i>' : '◎'}
            </button>
            ${track.isOwner ? `
              <button class="btn-icon-action btn-visibility" data-tooltip="${track.visibility === 'private' ? 'MAKE PUBLIC' : 'MAKE PRIVATE'}" data-track-id="${track.id}" data-visibility="${track.visibility || 'public'}">
                ${useLucideIcons ? `<i data-lucide="${track.visibility === 'private' ? 'eye-off' : 'eye'}"></i>` : (track.visibility === 'private' ? '◯' : '◉')}
              </button>
              <button class="btn-icon-action btn-delete" data-tooltip="DELETE" data-track-id="${track.id}">
                ${useLucideIcons ? '<i data-lucide="trash-2"></i>' : '✕'}
              </button>
            ` : ''}
          </div>
        </div>
        ${enableHistory ? `<div class="feed-item-history" id="history-${track.id}" style="display: none;"></div>` : ''}
      </div>
    `;
  }

  // Default preview renderer
  function renderDefaultPreview(track: EnrichedTrack): string {
    if (track.thumbnail_url) {
      return `<div class="feed-item-thumb"><img src="${track.thumbnail_url}"></div>`;
    }
    return `<div class="feed-item-thumb">${useLucideIcons ? '<i data-lucide="music"></i>' : '♪'}</div>`;
  }

  // Default stats renderer
  function renderDefaultStats(track: EnrichedTrack): string {
    const bpm = track.stats?.bpm;
    const commits = track.stats?.commits || 0;
    return `
      <div class="track-meta-stats">
        ${bpm ? `<span class="meta-stat" data-tooltip="TEMPO">${useLucideIcons ? '<i data-lucide="gauge"></i>' : '♩'} ${bpm}</span>` : ''}
        <span class="meta-stat" data-tooltip="COMMITS">${useLucideIcons ? '<i data-lucide="git-commit"></i>' : '●'} ${commits}</span>
      </div>
    `;
  }

  // Render inline history
  function renderInlineHistory(trackId: string, container: HTMLElement): void {
    const history = store.getTrackHistory(trackId) as Commit[];
    const track = store.findTrack(trackId) as Track | undefined;

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
      (item as HTMLElement).onclick = (e) => {
        e.stopPropagation();
        loadCommit((item as HTMLElement).dataset.commitId!);
      };
    });
  }

  // Render feed
  async function renderFeed(): Promise<void> {
    const { feedContainer, pagination: paginationEl } = elements;
    if (!feedContainer) return;

    const feedData = await store.getFeed({
      filter: currentFilter,
      page: currentPage,
      pageSize
    });

    if (feedData.items.length === 0) {
      feedContainer.innerHTML = `<div class="feed-loading">${
        currentFilter === 'all' ? 'NO PUBLIC TRACKS YET' : 'YOU HAVE NO SAVED TRACKS'
      }</div>`;
      if (paginationEl) paginationEl.innerHTML = '';
      return;
    }

    feedContainer.innerHTML = feedData.items.map(renderFeedItem).join('');

    // Pagination
    if (paginationEl) {
      if (feedData.totalPages > 1) {
        paginationEl.innerHTML = `
          <button class="pagination-btn" id="prev-page" ${currentPage === 1 ? 'disabled' : ''}>PREV</button>
          <span class="pagination-info">${currentPage} / ${feedData.totalPages}</span>
          <button class="pagination-btn" id="next-page" ${currentPage === feedData.totalPages ? 'disabled' : ''}>NEXT</button>
        `;
        el('prev-page')!.onclick = () => { currentPage--; renderFeed(); feedContainer.scrollTo(0, 0); };
        el('next-page')!.onclick = () => { currentPage++; renderFeed(); feedContainer.scrollTo(0, 0); };
      } else {
        paginationEl.innerHTML = '';
      }
    }

    // Refresh Lucide icons
    if (useLucideIcons && (window as unknown as { lucide?: { createIcons: () => void } }).lucide) {
      (window as unknown as { lucide: { createIcons: () => void } }).lucide.createIcons();
    }

    // Bind event handlers
    bindFeedEvents();
  }

  // Bind feed event handlers
  function bindFeedEvents(): void {
    // Click on item to load
    queryAll('.feed-item').forEach(item => {
      (item as HTMLElement).onclick = (e) => {
        const target = e.target as HTMLElement;
        if (target.closest('.btn-icon-action') || target.closest('.btn-like-trigger') ||
            target.closest('.btn-play-trigger') || target.closest('.feed-item-history')) return;
        loadTrack((item as HTMLElement).dataset.trackId!, false);
      };
    });

    // Play button
    queryAll('.btn-play-trigger').forEach(btn => {
      (btn as HTMLElement).onclick = async (e) => {
        e.stopPropagation();
        const trackId = (btn as HTMLElement).dataset.trackId!;
        const success = await loadTrack(trackId, true);
        if (success) handlers.recordPlay(trackId);
      };
    });

    // Remix button
    queryAll('.btn-remix').forEach(btn => {
      (btn as HTMLElement).onclick = async (e) => {
        e.stopPropagation();
        const success = await loadTrack((btn as HTMLElement).dataset.trackId!, false);
        if (success) {
          showToast('REMIXING...', 'info');
          setTimeout(() => save(), 500);
        }
      };
    });

    // Like button
    queryAll('.btn-like-trigger').forEach(btn => {
      (btn as HTMLElement).onclick = (e) => handlers.handleLike((btn as HTMLElement).dataset.trackId!, e);
    });

    // Delete button
    queryAll('.btn-delete').forEach(btn => {
      (btn as HTMLElement).onclick = (e) => handlers.handleDelete((btn as HTMLElement).dataset.trackId!, e, renderFeed);
    });

    // Visibility toggle
    queryAll('.btn-visibility').forEach(btn => {
      (btn as HTMLElement).onclick = (e) => handlers.toggleVisibility(
        (btn as HTMLElement).dataset.trackId!,
        (btn as HTMLElement).dataset.visibility!,
        e
      );
    });

    // History toggle
    queryAll('.btn-history').forEach(btn => {
      (btn as HTMLElement).onclick = (e) => {
        e.stopPropagation();
        const trackId = (btn as HTMLElement).dataset.trackId!;
        const historyEl = el(`history-${trackId}`);
        if (historyEl) {
          const isVisible = historyEl.style.display !== 'none';
          historyEl.style.display = isVisible ? 'none' : 'block';
          if (!isVisible) renderInlineHistory(trackId, historyEl);
        }
      };
    });
  }

  // Setup UI event handlers
  if (elements.saveBtn) {
    elements.saveBtn.onclick = save;
  }

  if (elements.loadBtn) {
    elements.loadBtn.onclick = () => {
      if (elements.filterMine) elements.filterMine.click();
      if (!elements.sidebar?.classList.contains('open')) {
        openSidebar();
      }
    };
  }

  if (elements.filterAll) {
    elements.filterAll.onclick = () => {
      currentFilter = 'all';
      currentPage = 1;
      elements.filterAll?.classList.add('active');
      elements.filterMine?.classList.remove('active');
      renderFeed();
    };
  }

  if (elements.filterMine) {
    elements.filterMine.onclick = () => {
      currentFilter = 'mine';
      currentPage = 1;
      elements.filterMine?.classList.add('active');
      elements.filterAll?.classList.remove('active');
      renderFeed();
    };
  }

  if (elements.closeSidebarBtn) {
    elements.closeSidebarBtn.onclick = closeSidebar;
  }

  // Also support toggle button that wasn't in loadBtn
  const communityToggleBtn = el('community-toggle-btn');
  if (communityToggleBtn) {
    communityToggleBtn.onclick = () => {
      const wasOpen = elements.sidebar?.classList.contains('open');
      elements.sidebar?.classList.toggle('open');
      communityToggleBtn.classList.toggle('active', !wasOpen);
      if (!wasOpen) {
        elements.filterAll?.click();
      }
    };
  }

  // Store events
  store.on('change', () => renderFeed());

  store.on('message', async (data) => {
    const msgData = data as {
      targetUsername: string;
      senderUsername: string;
      type: string;
      trackName?: string;
    };
    const me = await websim.getCurrentUser() as unknown as { username: string };
    if (msgData.targetUsername === me.username && msgData.senderUsername !== me.username) {
      const track = (msgData.trackName || 'YOUR TRACK').toUpperCase();
      if (msgData.type === 'track_liked') showToast(`${msgData.senderUsername} LIKED "${track}"`, 'success');
      if (msgData.type === 'track_played') showToast(`${msgData.senderUsername} IS PLAYING "${track}"`, 'info');
      if (msgData.type === 'track_remixed') showToast(`${msgData.senderUsername} REMIXED "${track}"`, 'success');
    }
  });

  return {
    save,
    renderFeed,
    loadTrack,
    loadCommit,
    recordPlay: handlers.recordPlay,
    updateSaveButton,
    get currentTrack() { return store.currentTrack as Track | null; },
    get currentCommitId() { return store.currentCommitId; },
    get isViewingHistory() { return store.isViewingHistory; },
    get store() { return store; }
  };
}
