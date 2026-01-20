/**
 * NEON SYNTH 2 - Waveform Visualizer
 * Canvas-based oscilloscope display
 */

export class Visualizer {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  analyser: AnalyserNode;
  animationId: number | null = null;
  resizeHandler: () => void;

  // Performance optimizations
  private dataArray: Uint8Array<ArrayBuffer>;
  private accentColor: string = '#00ffff';
  private lastFrameTime: number = 0;
  private readonly frameInterval: number = 1000 / 30; // Cap at 30fps

  constructor(canvas: HTMLCanvasElement, analyser: AnalyserNode) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d')!;
    this.analyser = analyser;
    this.resizeHandler = () => this.resize();

    // Pre-allocate buffer for audio data
    this.dataArray = new Uint8Array(analyser.frequencyBinCount);

    this.init();
  }

  init(): void {
    // Set up resize handling
    this.resize();
    window.addEventListener('resize', this.resizeHandler);

    // Cache accent color (update on resize in case of theme change)
    this.updateAccentColor();

    // Start the draw loop
    this.start();
  }

  private updateAccentColor(): void {
    const style = getComputedStyle(document.documentElement);
    this.accentColor = style.getPropertyValue('--nc').trim() || '#00ffff';
  }

  resize(): void {
    this.canvas.width = this.canvas.clientWidth * window.devicePixelRatio;
    this.canvas.height = this.canvas.clientHeight * window.devicePixelRatio;
    this.updateAccentColor();
  }

  start(): void {
    const draw = (timestamp: number): void => {
      this.animationId = requestAnimationFrame(draw);

      // Throttle to 30fps
      const elapsed = timestamp - this.lastFrameTime;
      if (elapsed < this.frameInterval) return;
      this.lastFrameTime = timestamp - (elapsed % this.frameInterval);

      this.draw();
    };
    requestAnimationFrame(draw);
  }

  stop(): void {
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }
  }

  draw(): void {
    // Reuse pre-allocated buffer
    this.analyser.getByteTimeDomainData(this.dataArray);

    const width = this.canvas.width;
    const height = this.canvas.height;
    const bufferLength = this.dataArray.length;
    const ctx = this.ctx;

    // Clear background
    ctx.fillStyle = '#0a0014';
    ctx.fillRect(0, 0, width, height);

    // Draw waveform (no shadow for performance)
    ctx.lineWidth = 2;
    ctx.strokeStyle = this.accentColor;
    ctx.beginPath();

    const sliceWidth = width / bufferLength;
    const halfHeight = height / 2;
    let x = 0;

    for (let i = 0; i < bufferLength; i++) {
      const v = this.dataArray[i] / 128.0;
      const y = v * halfHeight;

      if (i === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }

      x += sliceWidth;
    }

    ctx.lineTo(width, halfHeight);
    ctx.stroke();
  }

  destroy(): void {
    this.stop();
    window.removeEventListener('resize', this.resizeHandler);
  }
}

/**
 * Create a visualizer instance
 * @param canvas - The canvas element
 * @param analyser - Web Audio analyser node
 * @returns Visualizer instance
 */
export function createVisualizer(canvas: HTMLCanvasElement, analyser: AnalyserNode): Visualizer {
  return new Visualizer(canvas, analyser);
}
