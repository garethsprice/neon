// Neon UI Kit - Panel Component
// Container panels with neon styling

let stylesInjected = false;

function injectStyles() {
    if (stylesInjected) return;
    const style = document.createElement('style');
    style.textContent = `
        .neon-panel {
            background: linear-gradient(180deg, rgba(191,95,255,0.05) 0%, rgba(0,0,0,0.2) 100%);
            padding: 10px;
            border: 1px solid rgba(191,95,255,0.2);
            margin-bottom: 10px;
            display: flex;
            flex-direction: column;
            gap: 8px;
            border-radius: 2px;
        }

        /* Color variants */
        .neon-panel.color-purple {
            background: linear-gradient(180deg, rgba(136,68,255,0.12) 0%, rgba(136,68,255,0.03) 100%);
            border-color: rgba(136,68,255,0.4);
            box-shadow: 0 0 30px rgba(136,68,255,0.1);
        }
        .neon-panel.color-green {
            background: linear-gradient(180deg, rgba(57,255,20,0.06) 0%, rgba(0,0,0,0.2) 100%);
            border-color: rgba(57,255,20,0.2);
        }
        .neon-panel.color-cyan {
            background: linear-gradient(180deg, rgba(0,255,255,0.06) 0%, rgba(0,0,0,0.2) 100%);
            border-color: rgba(0,255,255,0.2);
        }
        .neon-panel.color-orange {
            background: linear-gradient(180deg, rgba(255,102,0,0.06) 0%, rgba(0,0,0,0.2) 100%);
            border-color: rgba(255,102,0,0.2);
        }
        .neon-panel.color-magenta {
            background: linear-gradient(180deg, rgba(255,0,255,0.08) 0%, rgba(0,0,0,0.3) 100%);
            border-color: rgba(255,0,255,0.2);
        }

        /* Section tag */
        .neon-panel-tag {
            font-size: 0.6em;
            font-weight: 900;
            letter-spacing: 3px;
            color: #bf5fff;
            text-shadow: 0 0 8px rgba(191,95,255,0.5);
            margin-bottom: 0;
            text-transform: uppercase;
        }
        .neon-panel.color-purple .neon-panel-tag { color: #a855f7; text-shadow: 0 0 10px rgba(168,85,247,0.6); }
        .neon-panel.color-green .neon-panel-tag { color: #39ff14; text-shadow: 0 0 10px rgba(57,255,20,0.6); }
        .neon-panel.color-cyan .neon-panel-tag { color: #00ffff; text-shadow: 0 0 10px rgba(0,255,255,0.6); }
        .neon-panel.color-orange .neon-panel-tag { color: #ff6600; text-shadow: 0 0 10px rgba(255,102,0,0.6); }

        /* AI Focus state */
        .neon-panel.ai-focus {
            outline: 3px solid #00ffff !important;
            outline-offset: 3px;
            box-shadow: 0 0 30px rgba(0,255,255,0.5), 0 0 60px rgba(0,255,255,0.2) !important;
            z-index: 100;
        }

        /* Loading state */
        .neon-panel.loading {
            position: relative;
            pointer-events: none;
        }
        .neon-panel.loading::after {
            content: '';
            position: absolute;
            inset: 0;
            background: rgba(0,0,0,0.5);
            border-radius: inherit;
        }
        .neon-panel.loading::before {
            content: '';
            position: absolute;
            top: 50%;
            left: 50%;
            width: 24px;
            height: 24px;
            margin: -12px 0 0 -12px;
            border: 2px solid rgba(0,255,255,0.3);
            border-top-color: #00ffff;
            border-radius: 50%;
            animation: neon-panel-spin 0.8s linear infinite;
            z-index: 2;
        }
        @keyframes neon-panel-spin { to { transform: rotate(360deg); } }
    `;
    document.head.appendChild(style);
    stylesInjected = true;
}

/**
 * Create a panel container
 * @param {Object} options
 * @param {string} [options.tag] - Section tag text
 * @param {string} [options.color='default'] - Color: default, purple, green, cyan, orange, magenta
 * @param {HTMLElement|string} [options.content] - Content to append (element or HTML string)
 * @returns {Object} { element, setTag, setContent, setLoading, setFocus, destroy }
 */
export function createPanel(options = {}) {
    injectStyles();

    const {
        tag = '',
        color = 'default',
        content = null
    } = options;

    const element = document.createElement('section');
    element.className = `neon-panel${color !== 'default' ? ` color-${color}` : ''}`;

    let tagEl = null;
    if (tag) {
        tagEl = document.createElement('div');
        tagEl.className = 'neon-panel-tag';
        tagEl.textContent = tag;
        element.appendChild(tagEl);
    }

    const contentContainer = document.createElement('div');
    contentContainer.className = 'neon-panel-content';
    element.appendChild(contentContainer);

    if (content) {
        if (typeof content === 'string') {
            contentContainer.innerHTML = content;
        } else {
            contentContainer.appendChild(content);
        }
    }

    return {
        element,
        contentContainer,
        setTag: (newTag) => {
            if (!tagEl && newTag) {
                tagEl = document.createElement('div');
                tagEl.className = 'neon-panel-tag';
                element.insertBefore(tagEl, element.firstChild);
            }
            if (tagEl) tagEl.textContent = newTag;
        },
        setContent: (newContent) => {
            contentContainer.innerHTML = '';
            if (typeof newContent === 'string') {
                contentContainer.innerHTML = newContent;
            } else if (newContent) {
                contentContainer.appendChild(newContent);
            }
        },
        appendChild: (child) => {
            contentContainer.appendChild(child);
        },
        setLoading: (loading) => {
            element.classList.toggle('loading', loading);
        },
        setFocus: (focused) => {
            element.classList.toggle('ai-focus', focused);
        },
        setColor: (newColor) => {
            element.className = `neon-panel${newColor !== 'default' ? ` color-${newColor}` : ''}`;
        },
        destroy: () => {}
    };
}
