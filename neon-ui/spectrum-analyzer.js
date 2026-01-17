// Neon UI Kit - Spectrum Analyzer Component
// A real-time audio frequency visualizer with CSS-in-JS

let stylesInjected = false;

function injectStyles() {
    if (stylesInjected) return;
    const style = document.createElement('style');
    style.textContent = `
        .neon-spectrum {
            position: relative;
            width: 100%;
            height: 80px;
            background: rgba(0, 0, 0, 0.3);
            border-radius: 8px;
            overflow: hidden;
            border: 1px solid rgba(0, 255, 255, 0.2);
        }

        .neon-spectrum-label {
            position: absolute;
            top: 8px;
            left: 12px;
            font-size: 0.6rem;
            font-weight: 700;
            letter-spacing: 2px;
            text-transform: uppercase;
            color: rgba(255, 255, 255, 0.4);
            pointer-events: none;
            z-index: 1;
        }

        .neon-spectrum canvas {
            width: 100%;
            height: 100%;
            display: block;
        }

        /* Color variants */
        .neon-spectrum.color-cyan {
            border-color: rgba(0, 255, 255, 0.2);
        }

        .neon-spectrum.color-magenta {
            border-color: rgba(255, 0, 255, 0.2);
        }

        .neon-spectrum.color-purple {
            border-color: rgba(191, 95, 255, 0.2);
        }

        .neon-spectrum.color-green {
            border-color: rgba(57, 255, 20, 0.2);
        }

        .neon-spectrum.color-orange {
            border-color: rgba(255, 102, 0, 0.2);
        }

        /* Size variants */
        .neon-spectrum.size-small {
            height: 40px;
        }

        .neon-spectrum.size-large {
            height: 120px;
        }
    `;
    document.head.appendChild(style);
    stylesInjected = true;
}

// Predefined color gradients
const GRADIENTS = {
    cyan: [
        { stop: 0, color: 'rgba(0, 255, 255, 0.3)' },
        { stop: 0.5, color: 'rgba(0, 255, 255, 0.5)' },
        { stop: 1, color: 'rgba(0, 255, 255, 0.7)' }
    ],
    magenta: [
        { stop: 0, color: 'rgba(255, 0, 255, 0.3)' },
        { stop: 0.5, color: 'rgba(255, 0, 255, 0.5)' },
        { stop: 1, color: 'rgba(255, 0, 255, 0.7)' }
    ],
    purple: [
        { stop: 0, color: 'rgba(191, 95, 255, 0.2)' },
        { stop: 0.5, color: 'rgba(191, 95, 255, 0.4)' },
        { stop: 1, color: 'rgba(191, 95, 255, 0.6)' }
    ],
    green: [
        { stop: 0, color: 'rgba(57, 255, 20, 0.3)' },
        { stop: 0.5, color: 'rgba(57, 255, 20, 0.5)' },
        { stop: 1, color: 'rgba(57, 255, 20, 0.7)' }
    ],
    orange: [
        { stop: 0, color: 'rgba(255, 102, 0, 0.3)' },
        { stop: 0.5, color: 'rgba(255, 102, 0, 0.5)' },
        { stop: 1, color: 'rgba(255, 102, 0, 0.7)' }
    ],
    neon: [
        { stop: 0, color: 'rgba(0, 255, 255, 0.3)' },
        { stop: 0.5, color: 'rgba(191, 95, 255, 0.5)' },
        { stop: 1, color: 'rgba(255, 0, 255, 0.7)' }
    ]
};

/**
 * Create a spectrum analyzer visualization
 * @param {Object} options
 * @param {string} [options.label] - Label text displayed in corner
 * @param {string} [options.color='neon'] - Color theme: cyan, magenta, purple, green, orange, neon
 * @param {string} [options.size='medium'] - Size: small, medium, large
 * @param {string} [options.mode='bars'] - Visualization mode: bars, line, mirror
 * @param {number} [options.barGap=1] - Gap between bars in pixels
 * @param {number} [options.smoothing=0.8] - Smoothing factor (0-1)
 * @param {Array} [options.gradient] - Custom gradient stops: [{ stop: 0-1, color: 'rgba(...)' }]
 * @returns {Object} { element, update, clear, resize, destroy }
 */
export function createSpectrumAnalyzer(options = {}) {
    injectStyles();

    const {
        label = '',
        color = 'neon',
        size = 'medium',
        mode = 'bars',
        barGap = 1,
        smoothing = 0.8,
        gradient = null
    } = options;

    const element = document.createElement('div');
    element.className = `neon-spectrum color-${color}${size !== 'medium' ? ` size-${size}` : ''}`;
    element.innerHTML = `
        ${label ? `<span class="neon-spectrum-label">${label}</span>` : ''}
        <canvas></canvas>
    `;

    const canvas = element.querySelector('canvas');
    const ctx = canvas.getContext('2d');

    let cachedGradient = null;
    let lastWidth = 0;
    let lastHeight = 0;
    let previousData = null;

    const gradientStops = gradient || GRADIENTS[color] || GRADIENTS.neon;

    const resize = () => {
        const rect = element.getBoundingClientRect();
        const dpr = window.devicePixelRatio || 1;
        canvas.width = rect.width * dpr;
        canvas.height = rect.height * dpr;
        ctx.scale(dpr, dpr);

        // Invalidate cached gradient on resize
        if (rect.width !== lastWidth || rect.height !== lastHeight) {
            cachedGradient = null;
            lastWidth = rect.width;
            lastHeight = rect.height;
        }
    };

    const getGradient = (height) => {
        if (cachedGradient) return cachedGradient;

        cachedGradient = ctx.createLinearGradient(0, height, 0, 0);
        gradientStops.forEach(({ stop, color }) => {
            cachedGradient.addColorStop(stop, color);
        });
        return cachedGradient;
    };

    const drawBars = (data, width, height) => {
        const barWidth = width / data.length;
        let x = 0;

        ctx.fillStyle = getGradient(height);

        for (let i = 0; i < data.length; i++) {
            const barHeight = (data[i] / 255) * height;
            ctx.fillRect(x, height - barHeight, barWidth - barGap, barHeight);
            x += barWidth;
        }
    };

    const drawLine = (data, width, height) => {
        ctx.beginPath();
        ctx.strokeStyle = gradientStops[gradientStops.length - 1].color;
        ctx.lineWidth = 2;

        const sliceWidth = width / (data.length - 1);

        for (let i = 0; i < data.length; i++) {
            const x = i * sliceWidth;
            const y = height - (data[i] / 255) * height;

            if (i === 0) {
                ctx.moveTo(x, y);
            } else {
                ctx.lineTo(x, y);
            }
        }

        ctx.stroke();

        // Fill under the line
        ctx.lineTo(width, height);
        ctx.lineTo(0, height);
        ctx.closePath();
        ctx.fillStyle = getGradient(height);
        ctx.globalAlpha = 0.3;
        ctx.fill();
        ctx.globalAlpha = 1;
    };

    const drawMirror = (data, width, height) => {
        const barWidth = width / data.length;
        const halfHeight = height / 2;
        let x = 0;

        ctx.fillStyle = getGradient(halfHeight);

        for (let i = 0; i < data.length; i++) {
            const barHeight = (data[i] / 255) * halfHeight;
            // Draw top half
            ctx.fillRect(x, halfHeight - barHeight, barWidth - barGap, barHeight);
            // Draw bottom half (mirrored)
            ctx.fillRect(x, halfHeight, barWidth - barGap, barHeight);
            x += barWidth;
        }
    };

    /**
     * Update the visualization with new frequency data
     * @param {Uint8Array} dataArray - Frequency data from analyser.getByteFrequencyData()
     */
    const update = (dataArray) => {
        const rect = element.getBoundingClientRect();
        const width = rect.width;
        const height = rect.height;

        if (width === 0 || height === 0) return;

        // Apply smoothing
        let smoothedData;
        if (previousData && smoothing > 0) {
            smoothedData = new Uint8Array(dataArray.length);
            for (let i = 0; i < dataArray.length; i++) {
                smoothedData[i] = Math.round(
                    previousData[i] * smoothing + dataArray[i] * (1 - smoothing)
                );
            }
        } else {
            smoothedData = dataArray;
        }
        previousData = new Uint8Array(smoothedData);

        ctx.clearRect(0, 0, width, height);

        switch (mode) {
            case 'line':
                drawLine(smoothedData, width, height);
                break;
            case 'mirror':
                drawMirror(smoothedData, width, height);
                break;
            case 'bars':
            default:
                drawBars(smoothedData, width, height);
                break;
        }
    };

    /**
     * Clear the visualization
     */
    const clear = () => {
        const rect = element.getBoundingClientRect();
        ctx.clearRect(0, 0, rect.width, rect.height);
        previousData = null;
    };

    // Handle resize
    let resizeObserver = null;
    if (typeof ResizeObserver !== 'undefined') {
        resizeObserver = new ResizeObserver(resize);
        resizeObserver.observe(element);
    }
    window.addEventListener('resize', resize);

    // Initial resize after element is in DOM
    requestAnimationFrame(resize);

    const destroy = () => {
        if (resizeObserver) {
            resizeObserver.disconnect();
        }
        window.removeEventListener('resize', resize);
    };

    return {
        element,
        canvas,
        ctx,
        update,
        clear,
        resize,
        destroy,
        setLabel: (text) => {
            const labelEl = element.querySelector('.neon-spectrum-label');
            if (labelEl) {
                labelEl.textContent = text;
            } else if (text) {
                const newLabel = document.createElement('span');
                newLabel.className = 'neon-spectrum-label';
                newLabel.textContent = text;
                element.insertBefore(newLabel, canvas);
            }
        }
    };
}
