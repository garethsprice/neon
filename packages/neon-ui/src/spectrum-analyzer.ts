/**
 * Neon UI Kit - Spectrum Analyzer Component
 * A real-time audio frequency visualizer with CSS-in-JS
 */

import type { NeonSize } from './types';

let stylesInjected = false;

function injectStyles(): void {
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

/** Gradient stop definition */
export interface GradientStop {
  /** Position from 0 to 1 */
  stop: number;
  /** CSS color string */
  color: string;
}

/** Predefined color gradients */
const GRADIENTS: Record<string, GradientStop[]> = {
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

/** Spectrum analyzer color options */
export type SpectrumColor = 'cyan' | 'magenta' | 'purple' | 'green' | 'orange' | 'neon';

/** Visualization mode */
export type SpectrumMode = 'bars' | 'line' | 'mirror';

/** Options for creating a spectrum analyzer */
export interface SpectrumAnalyzerOptions {
  /** Label text displayed in corner */
  label?: string;
  /** Color theme */
  color?: SpectrumColor;
  /** Size: small, medium, large */
  size?: NeonSize;
  /** Visualization mode */
  mode?: SpectrumMode;
  /** Gap between bars in pixels */
  barGap?: number;
  /** Smoothing factor (0-1) */
  smoothing?: number;
  /** Custom gradient stops */
  gradient?: GradientStop[] | null;
}

/** Spectrum analyzer component interface */
export interface SpectrumAnalyzerComponent {
  /** The spectrum analyzer element */
  element: HTMLElement;
  /** The canvas element */
  canvas: HTMLCanvasElement;
  /** The 2D rendering context */
  ctx: CanvasRenderingContext2D;
  /** Update the visualization with new frequency data */
  update: (dataArray: Uint8Array) => void;
  /** Clear the visualization */
  clear: () => void;
  /** Handle resize */
  resize: () => void;
  /** Set the label text */
  setLabel: (text: string) => void;
  /** Destroy the component and clean up */
  destroy: () => void;
}

/**
 * Create a spectrum analyzer visualization
 */
export function createSpectrumAnalyzer(options: SpectrumAnalyzerOptions = {}): SpectrumAnalyzerComponent {
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

  const canvas = element.querySelector('canvas') as HTMLCanvasElement;
  const ctx = canvas.getContext('2d') as CanvasRenderingContext2D;

  let cachedGradient: CanvasGradient | null = null;
  let lastWidth = 0;
  let lastHeight = 0;
  let previousData: Uint8Array | null = null;

  const gradientStops = gradient || GRADIENTS[color] || GRADIENTS.neon;

  const resize = (): void => {
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

  const getGradient = (height: number): CanvasGradient => {
    if (cachedGradient) return cachedGradient;

    cachedGradient = ctx.createLinearGradient(0, height, 0, 0);
    gradientStops.forEach(({ stop, color }) => {
      cachedGradient!.addColorStop(stop, color);
    });
    return cachedGradient;
  };

  const drawBars = (data: Uint8Array, width: number, height: number): void => {
    const barWidth = width / data.length;
    let x = 0;

    ctx.fillStyle = getGradient(height);

    for (let i = 0; i < data.length; i++) {
      const barHeight = (data[i] / 255) * height;
      ctx.fillRect(x, height - barHeight, barWidth - barGap, barHeight);
      x += barWidth;
    }
  };

  const drawLine = (data: Uint8Array, width: number, height: number): void => {
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

  const drawMirror = (data: Uint8Array, width: number, height: number): void => {
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
   */
  const update = (dataArray: Uint8Array): void => {
    const rect = element.getBoundingClientRect();
    const width = rect.width;
    const height = rect.height;

    if (width === 0 || height === 0) return;

    // Apply smoothing
    let smoothedData: Uint8Array;
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
  const clear = (): void => {
    const rect = element.getBoundingClientRect();
    ctx.clearRect(0, 0, rect.width, rect.height);
    previousData = null;
  };

  // Handle resize
  let resizeObserver: ResizeObserver | null = null;
  if (typeof ResizeObserver !== 'undefined') {
    resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(element);
  }
  window.addEventListener('resize', resize);

  // Initial resize after element is in DOM
  requestAnimationFrame(resize);

  const destroy = (): void => {
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
    setLabel: (text: string): void => {
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
