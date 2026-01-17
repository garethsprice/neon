// Neon UI Kit - Feed Item Component
// Activity feed card for displaying track/content items

let stylesInjected = false;

function injectStyles() {
    if (stylesInjected) return;
    const style = document.createElement('style');
    style.textContent = `
        .neon-feed-item {
            background: #120022;
            border: 1px solid rgba(191,95,255,0.2);
            padding: 10px;
            border-radius: 6px;
            cursor: pointer;
            transition: all 0.2s;
            display: flex;
            flex-direction: column;
            gap: 8px;
            position: relative;
        }
        .neon-feed-item:hover {
            background: #1a0033;
            border-color: #00ffff;
            transform: translateY(-2px);
            box-shadow: 0 4px 15px rgba(0,0,0,0.4);
        }

        .neon-feed-item-header {
            display: flex;
            gap: 10px;
            align-items: center;
        }
        .neon-feed-item-thumb {
            width: 32px;
            height: 32px;
            background: rgba(0,0,0,0.3);
            border: 1px solid rgba(191,95,255,0.2);
            border-radius: 4px;
            overflow: hidden;
            flex-shrink: 0;
            display: flex;
            align-items: center;
            justify-content: center;
            color: #bf5fff;
        }
        .neon-feed-item-thumb img {
            width: 100%;
            height: 100%;
            object-fit: cover;
        }
        .neon-feed-item-thumb svg {
            width: 16px;
            height: 16px;
            opacity: 0.5;
        }

        .neon-feed-item-title-group {
            display: flex;
            flex-direction: column;
            flex: 1;
            min-width: 0;
        }
        .neon-feed-item-title {
            font-size: 0.85em;
            font-weight: 900;
            color: #00ffff;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
            text-shadow: 0 0 10px rgba(0,255,255,0.3);
            display: flex;
            align-items: center;
            gap: 6px;
        }
        .neon-feed-item-version {
            font-size: 0.65em;
            color: #ff00ff;
            opacity: 0.8;
            font-family: monospace;
        }

        .neon-feed-item-meta {
            display: flex;
            gap: 8px;
            margin-top: 2px;
        }
        .neon-feed-item-meta-stat {
            font-size: 0.55em;
            color: rgba(191,95,255,0.4);
            display: flex;
            align-items: center;
            gap: 3px;
            font-weight: 900;
        }
        .neon-feed-item-meta-stat svg {
            width: 10px;
            height: 10px;
        }

        .neon-feed-item-user {
            display: flex;
            align-items: center;
            gap: 6px;
            font-size: 0.65em;
            color: rgba(191,95,255,0.6);
            font-weight: 900;
        }
        .neon-feed-item-avatar {
            width: 14px;
            height: 14px;
            border-radius: 50%;
            background: linear-gradient(135deg, #00ffff, #ff00ff);
        }

        .neon-feed-item-description {
            font-size: 0.65em;
            color: rgba(57,255,20,0.7);
            padding: 6px 10px;
            background: rgba(57,255,20,0.05);
            border-left: 2px solid rgba(57,255,20,0.3);
            font-style: italic;
            letter-spacing: 0.5px;
        }

        .neon-feed-item-stats-row {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-top: 8px;
            gap: 4px;
        }
        .neon-feed-item-stats {
            display: flex;
            gap: 8px;
            align-items: center;
            flex: 1;
            min-width: 0;
        }
        .neon-feed-stat {
            font-size: 0.6em;
            color: rgba(191,95,255,0.6);
            display: flex;
            align-items: center;
            gap: 4px;
            font-weight: 900;
        }
        .neon-feed-stat svg {
            width: 12px;
            height: 12px;
        }
        .neon-feed-stat.clickable {
            cursor: pointer;
            transition: color 0.2s, transform 0.2s;
            padding: 2px 4px;
            border-radius: 4px;
        }
        .neon-feed-stat.clickable:hover {
            color: #fff;
            background: rgba(191,95,255,0.1);
            transform: scale(1.05);
        }
        .neon-feed-stat.liked {
            color: #ff3366;
        }
        .neon-feed-stat.liked svg {
            fill: #ff3366;
            filter: drop-shadow(0 0 4px #ff3366);
        }

        .neon-feed-item-actions {
            display: flex;
            gap: 4px;
            align-items: center;
            flex-shrink: 0;
        }
        .neon-feed-action-btn {
            background: rgba(191,95,255,0.1);
            border: 1px solid rgba(191,95,255,0.2);
            color: rgba(191,95,255,0.8);
            width: 28px;
            height: 28px;
            display: flex;
            align-items: center;
            justify-content: center;
            border-radius: 4px;
            cursor: pointer;
            transition: all 0.2s;
            padding: 0;
        }
        .neon-feed-action-btn svg {
            width: 14px;
            height: 14px;
        }
        .neon-feed-action-btn:hover {
            background: rgba(191,95,255,0.2);
            color: #fff;
        }
        .neon-feed-action-btn.delete:hover {
            color: #ff3366;
            border-color: #ff3366;
            background: rgba(255,51,102,0.1);
        }
        .neon-feed-action-btn.visibility:hover {
            color: #00ffff;
            border-color: #00ffff;
        }

        /* Feed container */
        .neon-feed-container {
            display: flex;
            flex-direction: column;
            gap: 10px;
            flex: 1;
        }
        .neon-feed-loading {
            font-size: 0.6em;
            color: rgba(191,95,255,0.5);
            text-align: center;
            padding: 20px 0;
        }
        .neon-feed-empty {
            font-size: 0.65em;
            color: rgba(191,95,255,0.4);
            text-align: center;
            padding: 30px 10px;
            letter-spacing: 1px;
        }

        /* Pagination */
        .neon-feed-pagination {
            display: flex;
            justify-content: center;
            align-items: center;
            gap: 15px;
            padding: 15px 0;
            margin-top: auto;
            border-top: 1px solid rgba(191,95,255,0.1);
        }
        .neon-feed-pagination-btn {
            background: rgba(191,95,255,0.1);
            border: 1px solid rgba(191,95,255,0.3);
            color: #bf5fff;
            padding: 6px 12px;
            border-radius: 4px;
            font-size: 0.6em;
            font-weight: 900;
            cursor: pointer;
            transition: all 0.2s;
            text-transform: uppercase;
            letter-spacing: 1px;
        }
        .neon-feed-pagination-btn:hover:not(:disabled) {
            background: rgba(191,95,255,0.2);
            color: #fff;
            border-color: #00ffff;
            box-shadow: 0 0 10px rgba(0,255,255,0.2);
        }
        .neon-feed-pagination-btn:disabled {
            opacity: 0.3;
            cursor: not-allowed;
            filter: grayscale(1);
        }
        .neon-feed-pagination-info {
            font-size: 0.65em;
            font-weight: 900;
            color: rgba(191,95,255,0.6);
            font-family: monospace;
        }
    `;
    document.head.appendChild(style);
    stylesInjected = true;
}

// Simple SVG icons
const icons = {
    music: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>',
    play: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="5 3 19 12 5 21 5 3"/></svg>',
    heart: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/></svg>',
    gitBranch: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="6" x2="6" y1="3" y2="15"/><circle cx="18" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><path d="M18 9a9 9 0 0 1-9 9"/></svg>',
    history: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/><path d="M12 7v5l4 2"/></svg>',
    trash: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>',
    eye: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>',
    eyeOff: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9.88 9.88a3 3 0 1 0 4.24 4.24"/><path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68"/><path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61"/><line x1="2" x2="22" y1="2" y2="22"/></svg>',
    activity: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>'
};

/**
 * Create a feed item card
 * @param {Object} options
 * @param {string} [options.title] - Item title
 * @param {string} [options.thumbnail] - Thumbnail image URL
 * @param {string} [options.version] - Version tag text
 * @param {string} [options.description] - Description/commit message
 * @param {string} [options.username] - Author username
 * @param {number} [options.bpm] - BPM value
 * @param {number} [options.commits] - Number of commits/versions
 * @param {number} [options.plays=0] - Play count
 * @param {number} [options.remixes=0] - Remix count
 * @param {number} [options.likes=0] - Like count
 * @param {boolean} [options.liked=false] - Whether current user liked it
 * @param {boolean} [options.isOwner=false] - Whether current user owns it
 * @param {boolean} [options.isPrivate=false] - Whether item is private
 * @param {Function} [options.onClick] - Click handler for the card
 * @param {Function} [options.onPlay] - Play button click handler
 * @param {Function} [options.onLike] - Like button click handler
 * @param {Function} [options.onRemix] - Remix button click handler
 * @param {Function} [options.onHistory] - History button click handler
 * @param {Function} [options.onDelete] - Delete button click handler
 * @param {Function} [options.onVisibility] - Visibility toggle handler
 * @returns {Object} { element, setLiked, setLikes, destroy }
 */
export function createFeedItem(options = {}) {
    injectStyles();

    const {
        title = 'Untitled',
        thumbnail = null,
        version = null,
        description = null,
        username = 'Anonymous',
        bpm = null,
        commits = null,
        plays = 0,
        remixes = 0,
        likes = 0,
        liked = false,
        isOwner = false,
        isPrivate = false,
        onClick = null,
        onPlay = null,
        onLike = null,
        onRemix = null,
        onHistory = null,
        onDelete = null,
        onVisibility = null
    } = options;

    let isLiked = liked;
    let likeCount = likes;

    const element = document.createElement('div');
    element.className = 'neon-feed-item';

    // Header
    const header = document.createElement('div');
    header.className = 'neon-feed-item-header';

    // Thumbnail
    const thumb = document.createElement('div');
    thumb.className = 'neon-feed-item-thumb';
    thumb.innerHTML = thumbnail
        ? `<img src="${thumbnail}" alt="">`
        : icons.music;
    header.appendChild(thumb);

    // Title group
    const titleGroup = document.createElement('div');
    titleGroup.className = 'neon-feed-item-title-group';

    const titleEl = document.createElement('div');
    titleEl.className = 'neon-feed-item-title';
    titleEl.innerHTML = title + (version ? `<span class="neon-feed-item-version">${version}</span>` : '');
    titleGroup.appendChild(titleEl);

    // Meta stats (BPM, commits)
    if (bpm || commits) {
        const meta = document.createElement('div');
        meta.className = 'neon-feed-item-meta';
        if (bpm) {
            meta.innerHTML += `<span class="neon-feed-item-meta-stat">${icons.activity} ${bpm} BPM</span>`;
        }
        if (commits) {
            meta.innerHTML += `<span class="neon-feed-item-meta-stat">${icons.gitBranch} ${commits}</span>`;
        }
        titleGroup.appendChild(meta);
    }

    header.appendChild(titleGroup);

    // User info
    const user = document.createElement('div');
    user.className = 'neon-feed-item-user';
    user.innerHTML = `<div class="neon-feed-item-avatar"></div>${username}`;
    header.appendChild(user);

    element.appendChild(header);

    // Description
    if (description) {
        const desc = document.createElement('div');
        desc.className = 'neon-feed-item-description';
        desc.textContent = description;
        element.appendChild(desc);
    }

    // Stats row
    const statsRow = document.createElement('div');
    statsRow.className = 'neon-feed-item-stats-row';

    const stats = document.createElement('div');
    stats.className = 'neon-feed-item-stats';

    // Play stat
    const playStat = document.createElement('div');
    playStat.className = 'neon-feed-stat clickable';
    playStat.innerHTML = `${icons.play} ${plays}`;
    if (onPlay) {
        playStat.addEventListener('click', (e) => {
            e.stopPropagation();
            onPlay();
        });
    }
    stats.appendChild(playStat);

    // Remix stat
    const remixStat = document.createElement('div');
    remixStat.className = 'neon-feed-stat';
    remixStat.innerHTML = `${icons.gitBranch} ${remixes}`;
    stats.appendChild(remixStat);

    // Like stat
    const likeStat = document.createElement('div');
    likeStat.className = `neon-feed-stat clickable${isLiked ? ' liked' : ''}`;
    likeStat.innerHTML = `${icons.heart} <span class="like-count">${likeCount}</span>`;
    if (onLike) {
        likeStat.addEventListener('click', (e) => {
            e.stopPropagation();
            onLike(!isLiked);
        });
    }
    stats.appendChild(likeStat);

    statsRow.appendChild(stats);

    // Action buttons
    const actions = document.createElement('div');
    actions.className = 'neon-feed-item-actions';

    if (onHistory) {
        const historyBtn = document.createElement('button');
        historyBtn.className = 'neon-feed-action-btn';
        historyBtn.innerHTML = icons.history;
        historyBtn.title = 'History';
        historyBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            onHistory();
        });
        actions.appendChild(historyBtn);
    }

    if (onRemix) {
        const remixBtn = document.createElement('button');
        remixBtn.className = 'neon-feed-action-btn';
        remixBtn.innerHTML = icons.gitBranch;
        remixBtn.title = 'Remix';
        remixBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            onRemix();
        });
        actions.appendChild(remixBtn);
    }

    if (isOwner) {
        if (onVisibility) {
            const visBtn = document.createElement('button');
            visBtn.className = 'neon-feed-action-btn visibility';
            visBtn.innerHTML = isPrivate ? icons.eyeOff : icons.eye;
            visBtn.title = isPrivate ? 'Make Public' : 'Make Private';
            visBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                onVisibility();
            });
            actions.appendChild(visBtn);
        }

        if (onDelete) {
            const deleteBtn = document.createElement('button');
            deleteBtn.className = 'neon-feed-action-btn delete';
            deleteBtn.innerHTML = icons.trash;
            deleteBtn.title = 'Delete';
            deleteBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                onDelete();
            });
            actions.appendChild(deleteBtn);
        }
    }

    statsRow.appendChild(actions);
    element.appendChild(statsRow);

    // Main click handler
    if (onClick) {
        element.addEventListener('click', onClick);
    }

    return {
        element,
        setLiked: (value) => {
            isLiked = value;
            likeStat.classList.toggle('liked', isLiked);
        },
        setLikes: (count) => {
            likeCount = count;
            likeStat.querySelector('.like-count').textContent = count;
        },
        destroy: () => {
            if (onClick) element.removeEventListener('click', onClick);
        }
    };
}

/**
 * Create a feed container with pagination
 * @param {Object} options
 * @param {Array} [options.items=[]] - Array of feed item configs
 * @param {number} [options.page=1] - Current page
 * @param {number} [options.totalPages=1] - Total pages
 * @param {boolean} [options.loading=false] - Show loading state
 * @param {string} [options.emptyMessage='No items found'] - Empty state message
 * @param {Function} [options.onPageChange] - Page change handler
 * @returns {Object} { element, setItems, setLoading, setPage, destroy }
 */
export function createFeed(options = {}) {
    injectStyles();

    const {
        items = [],
        page = 1,
        totalPages = 1,
        loading = false,
        emptyMessage = 'No items found',
        onPageChange = null
    } = options;

    let currentPage = page;
    let itemRefs = [];

    const element = document.createElement('div');

    const container = document.createElement('div');
    container.className = 'neon-feed-container';

    const pagination = document.createElement('div');
    pagination.className = 'neon-feed-pagination';
    pagination.innerHTML = `
        <button class="neon-feed-pagination-btn prev">PREV</button>
        <span class="neon-feed-pagination-info">${currentPage} / ${totalPages}</span>
        <button class="neon-feed-pagination-btn next">NEXT</button>
    `;

    element.appendChild(container);
    element.appendChild(pagination);

    const prevBtn = pagination.querySelector('.prev');
    const nextBtn = pagination.querySelector('.next');
    const pageInfo = pagination.querySelector('.neon-feed-pagination-info');

    function renderItems(itemsArray) {
        itemRefs.forEach(i => i.destroy?.());
        itemRefs = [];
        container.innerHTML = '';

        if (loading) {
            container.innerHTML = '<div class="neon-feed-loading">LOADING...</div>';
            return;
        }

        if (!itemsArray.length) {
            container.innerHTML = `<div class="neon-feed-empty">${emptyMessage}</div>`;
            return;
        }

        itemsArray.forEach(config => {
            const item = createFeedItem(config);
            itemRefs.push(item);
            container.appendChild(item.element);
        });
    }

    function updatePagination() {
        pageInfo.textContent = `${currentPage} / ${totalPages}`;
        prevBtn.disabled = currentPage <= 1;
        nextBtn.disabled = currentPage >= totalPages;
    }

    prevBtn.addEventListener('click', () => {
        if (currentPage > 1) {
            currentPage--;
            updatePagination();
            onPageChange?.(currentPage);
        }
    });

    nextBtn.addEventListener('click', () => {
        if (currentPage < totalPages) {
            currentPage++;
            updatePagination();
            onPageChange?.(currentPage);
        }
    });

    renderItems(items);
    updatePagination();

    return {
        element,
        container,
        setItems: (newItems) => {
            renderItems(newItems);
        },
        setLoading: (isLoading) => {
            if (isLoading) {
                container.innerHTML = '<div class="neon-feed-loading">LOADING...</div>';
            }
        },
        setPage: (newPage, newTotal = totalPages) => {
            currentPage = newPage;
            totalPages = newTotal;
            updatePagination();
        },
        getItems: () => itemRefs,
        destroy: () => {
            itemRefs.forEach(i => i.destroy?.());
        }
    };
}
