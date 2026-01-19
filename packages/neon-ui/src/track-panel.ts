/**
 * Neon UI Kit - Track Panel Component
 * Track metadata panel with thumbnail, title, and description
 */

let stylesInjected = false;

function injectStyles(): void {
    if (stylesInjected) return;
    const style = document.createElement('style');
    style.textContent = `
        .neon-track-panel {
            display: flex;
            gap: 12px;
            padding: 10px;
            background: linear-gradient(180deg, rgba(191,95,255,0.08) 0%, rgba(0,0,0,0.2) 100%);
            border: 1px solid rgba(191,95,255,0.2);
            border-radius: 4px;
        }

        /* Thumbnail Container */
        .neon-track-thumbnail {
            width: 80px;
            height: 80px;
            background: linear-gradient(135deg, rgba(0,0,0,0.4) 0%, rgba(191,95,255,0.1) 100%);
            border: 1px solid rgba(191,95,255,0.3);
            border-radius: 4px;
            flex-shrink: 0;
            cursor: pointer;
            position: relative;
            overflow: hidden;
            transition: all 0.2s;
            display: flex;
            align-items: center;
            justify-content: center;
        }

        .neon-track-thumbnail:hover {
            border-color: var(--nc, #00ffff);
            box-shadow: 0 0 15px rgba(0,255,255,0.3);
        }

        .neon-track-thumbnail img {
            width: 100%;
            height: 100%;
            object-fit: cover;
        }

        .neon-track-thumbnail-placeholder {
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            gap: 4px;
            color: rgba(191,95,255,0.5);
            font-size: 0.5em;
            font-weight: 900;
            letter-spacing: 1px;
            text-align: center;
            padding: 8px;
        }

        .neon-track-thumbnail-placeholder svg {
            width: 24px;
            height: 24px;
            opacity: 0.6;
        }

        /* Loading state */
        .neon-track-thumbnail.loading {
            pointer-events: none;
        }

        .neon-track-thumbnail.loading::after {
            content: '';
            position: absolute;
            inset: 0;
            background: linear-gradient(90deg, transparent, rgba(168,85,247,0.3), transparent);
            background-size: 200% 100%;
            animation: thumbnail-shimmer 1.5s ease-in-out infinite;
        }

        @keyframes thumbnail-shimmer {
            0% { background-position: -200% 0; }
            100% { background-position: 200% 0; }
        }

        .neon-track-thumbnail-spinner {
            width: 24px;
            height: 24px;
            border: 2px solid rgba(168,85,247,0.3);
            border-top-color: #a855f7;
            border-radius: 50%;
            animation: thumbnail-spin 0.8s linear infinite;
        }

        @keyframes thumbnail-spin {
            to { transform: rotate(360deg); }
        }

        /* Meta Container */
        .neon-track-meta {
            flex: 1;
            display: flex;
            flex-direction: column;
            gap: 8px;
            min-width: 0;
        }

        /* Title Row (input + info button) */
        .neon-track-title-row {
            display: flex;
            gap: 6px;
            align-items: center;
        }

        /* Title Input */
        .neon-track-title-input {
            flex: 1;
            background: rgba(0,0,0,0.4);
            border: 1px solid rgba(0,255,255,0.3);
            color: #00ffff;
            font-family: inherit;
            font-size: 0.85em;
            font-weight: 900;
            letter-spacing: 2px;
            padding: 8px 10px;
            border-radius: 4px;
            text-shadow: 0 0 8px rgba(0,255,255,0.6);
            transition: all 0.2s;
            outline: none;
            min-width: 0;
        }

        .neon-track-title-input::placeholder {
            color: rgba(0,255,255,0.3);
            text-transform: uppercase;
        }

        .neon-track-title-input:focus {
            border-color: #00ffff;
            box-shadow: 0 0 15px rgba(0,255,255,0.4), inset 0 0 10px rgba(0,0,0,0.5);
        }

        /* Info Toggle Button */
        .neon-track-info-btn {
            width: 32px;
            height: 32px;
            padding: 0;
            background: rgba(0,0,0,0.4);
            border: 1px solid rgba(57,255,20,0.3);
            border-radius: 4px;
            color: rgba(57,255,20,0.5);
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            transition: all 0.2s;
            flex-shrink: 0;
        }

        .neon-track-info-btn:hover {
            border-color: rgba(57,255,20,0.6);
            color: rgba(57,255,20,0.8);
            background: rgba(57,255,20,0.1);
        }

        .neon-track-info-btn.active {
            border-color: #39ff14;
            color: #39ff14;
            background: rgba(57,255,20,0.15);
            box-shadow: 0 0 10px rgba(57,255,20,0.3);
        }

        .neon-track-info-btn svg {
            width: 16px;
            height: 16px;
        }

        /* Description Container */
        .neon-track-description-container {
            background: rgba(0,0,0,0.3);
            border: 1px solid rgba(57,255,20,0.2);
            border-radius: 4px;
            padding: 6px 8px;
            min-height: 50px;
            transition: all 0.2s;
        }

        .neon-track-description-container.hidden {
            display: none;
        }

        .neon-track-description-container:focus-within {
            border-color: rgba(57,255,20,0.5);
            box-shadow: 0 0 10px rgba(57,255,20,0.2);
        }

        .neon-track-description {
            background: transparent;
            border: none;
            color: #39ff14;
            font-family: inherit;
            font-size: 0.65em;
            line-height: 1.4;
            resize: none;
            outline: none;
            text-shadow: 0 0 6px rgba(57,255,20,0.4);
            width: 100%;
            height: 100%;
            min-height: 40px;
            box-sizing: border-box;
        }

        .neon-track-description::placeholder {
            color: rgba(57,255,20,0.3);
        }

        /* Compact variant */
        .neon-track-panel.compact {
            padding: 8px;
            gap: 10px;
        }

        .neon-track-panel.compact .neon-track-thumbnail {
            width: 60px;
            height: 60px;
        }

        .neon-track-panel.compact .neon-track-title-input {
            font-size: 0.75em;
            padding: 6px 8px;
        }

        .neon-track-panel.compact .neon-track-info-btn {
            width: 28px;
            height: 28px;
        }
    `;
    document.head.appendChild(style);
    stylesInjected = true;
}

// Simple image icon SVG
const IMAGE_ICON = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="18" x="3" y="3" rx="2" ry="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/></svg>`;

// Info icon SVG
const INFO_ICON = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>`;

/** Track panel options */
export interface TrackPanelOptions {
    title?: string;
    description?: string;
    thumbnailUrl?: string | null;
    compact?: boolean;
    descriptionVisible?: boolean;
    titlePlaceholder?: string;
    descriptionPlaceholder?: string;
    onTitleChange?: (title: string) => void;
    onDescriptionChange?: (description: string) => void;
    onThumbnailClick?: () => void;
    onBriefToggle?: (visible: boolean) => void;
}

/** Track panel component interface */
export interface TrackPanelComponent {
    element: HTMLElement;
    setTitle: (value: string) => void;
    setDescription: (value: string) => void;
    setThumbnail: (url: string | null) => void;
    setThumbnailLoading: (loading: boolean) => void;
    showDescription: (show: boolean) => void;
    getTitle: () => string;
    getDescription: () => string;
    destroy: () => void;
}

/**
 * Create a track metadata panel
 */
export function createTrackPanel(options: TrackPanelOptions = {}): TrackPanelComponent {
    injectStyles();

    const {
        title = '',
        description = '',
        thumbnailUrl = null,
        compact = false,
        descriptionVisible = false,
        titlePlaceholder = 'TRACK TITLE',
        descriptionPlaceholder = 'Creative brief: describe the vibe, mood, and vision...',
        onTitleChange = null,
        onDescriptionChange = null,
        onThumbnailClick = null,
        onBriefToggle = null
    } = options;

    let briefVisible = descriptionVisible;

    // Container
    const container = document.createElement('div');
    container.className = `neon-track-panel${compact ? ' compact' : ''}`;

    // Thumbnail
    const thumbnail = document.createElement('div');
    thumbnail.className = 'neon-track-thumbnail';
    thumbnail.title = 'Click to generate album art';

    const thumbnailContent = document.createElement('div');
    thumbnailContent.className = 'neon-track-thumbnail-placeholder';
    thumbnailContent.innerHTML = `${IMAGE_ICON}<span>GEN ART</span>`;
    thumbnail.appendChild(thumbnailContent);

    thumbnail.addEventListener('click', () => {
        if (!thumbnail.classList.contains('loading')) {
            onThumbnailClick?.();
        }
    });

    container.appendChild(thumbnail);

    // Meta container
    const meta = document.createElement('div');
    meta.className = 'neon-track-meta';

    // Title row (input + info button)
    const titleRow = document.createElement('div');
    titleRow.className = 'neon-track-title-row';

    // Title input
    const titleInput = document.createElement('input');
    titleInput.type = 'text';
    titleInput.className = 'neon-track-title-input';
    titleInput.placeholder = titlePlaceholder;
    titleInput.value = title;
    titleInput.maxLength = 64;

    titleInput.addEventListener('input', () => {
        onTitleChange?.(titleInput.value);
    });

    titleRow.appendChild(titleInput);

    // Info toggle button
    const infoBtn = document.createElement('button');
    infoBtn.type = 'button';
    infoBtn.className = 'neon-track-info-btn';
    infoBtn.title = 'Toggle creative brief';
    infoBtn.innerHTML = INFO_ICON;
    if (briefVisible) {
        infoBtn.classList.add('active');
    }

    infoBtn.addEventListener('click', () => {
        briefVisible = !briefVisible;
        descContainer.classList.toggle('hidden', !briefVisible);
        infoBtn.classList.toggle('active', briefVisible);
        onBriefToggle?.(briefVisible);
    });

    titleRow.appendChild(infoBtn);
    meta.appendChild(titleRow);

    // Description container (hidden by default)
    const descContainer = document.createElement('div');
    descContainer.className = `neon-track-description-container${briefVisible ? '' : ' hidden'}`;

    const descTextarea = document.createElement('textarea');
    descTextarea.className = 'neon-track-description';
    descTextarea.placeholder = descriptionPlaceholder;
    descTextarea.value = description;
    descTextarea.maxLength = 500;

    descTextarea.addEventListener('input', () => {
        onDescriptionChange?.(descTextarea.value);
    });

    descContainer.appendChild(descTextarea);
    meta.appendChild(descContainer);

    container.appendChild(meta);

    // Methods
    function setTitle(value: string): void {
        titleInput.value = value || '';
    }

    function setDescription(value: string): void {
        descTextarea.value = value || '';
    }

    function setThumbnail(url: string | null): void {
        thumbnail.classList.remove('loading');

        if (url) {
            thumbnail.innerHTML = '';
            const img = document.createElement('img');
            img.src = url;
            img.alt = 'Track thumbnail';
            img.onerror = () => {
                // Revert to placeholder on error
                thumbnail.innerHTML = '';
                const placeholder = document.createElement('div');
                placeholder.className = 'neon-track-thumbnail-placeholder';
                placeholder.innerHTML = `${IMAGE_ICON}<span>GEN ART</span>`;
                thumbnail.appendChild(placeholder);
            };
            thumbnail.appendChild(img);
        } else {
            thumbnail.innerHTML = '';
            const placeholder = document.createElement('div');
            placeholder.className = 'neon-track-thumbnail-placeholder';
            placeholder.innerHTML = `${IMAGE_ICON}<span>GEN ART</span>`;
            thumbnail.appendChild(placeholder);
        }
    }

    function setThumbnailLoading(loading: boolean): void {
        thumbnail.classList.toggle('loading', loading);
        if (loading) {
            thumbnail.innerHTML = '';
            const spinner = document.createElement('div');
            spinner.className = 'neon-track-thumbnail-spinner';
            thumbnail.appendChild(spinner);
        }
    }

    function showDescription(show: boolean): void {
        briefVisible = show;
        descContainer.classList.toggle('hidden', !show);
        infoBtn.classList.toggle('active', show);
    }

    function getTitle(): string {
        return titleInput.value;
    }

    function getDescription(): string {
        return descTextarea.value;
    }

    function destroy(): void {
        titleInput.replaceWith(titleInput.cloneNode(true));
        descTextarea.replaceWith(descTextarea.cloneNode(true));
        thumbnail.replaceWith(thumbnail.cloneNode(true));
        infoBtn.replaceWith(infoBtn.cloneNode(true));
    }

    // Set initial thumbnail if provided
    if (thumbnailUrl) {
        setThumbnail(thumbnailUrl);
    }

    return {
        element: container,
        setTitle,
        setDescription,
        setThumbnail,
        setThumbnailLoading,
        showDescription,
        getTitle,
        getDescription,
        destroy
    };
}
