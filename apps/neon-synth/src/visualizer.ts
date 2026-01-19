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

  constructor(canvas: HTMLCanvasElement, analyser: AnalyserNode) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d')!;
    this.analyser = analyser;
    this.resizeHandler = () => this.resize();

    this.init();
  }

  init(): void {
    // Set up resize handling
    this.resize();
    window.addEventListener('resize', this.resizeHandler);

    // Start the draw loop
    this.start();
  }

  resize(): void {
    this.canvas.width = this.canvas.clientWidth * window.devicePixelRatio;
    this.canvas.height = this.canvas.clientHeight * window.devicePixelRatio;
  }

  start(): void {
    const draw = (): void => {
      this.animationId = requestAnimationFrame(draw);
      this.draw();
    };
    draw();
  }

  stop(): void {
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }
  }

  draw(): void {
    const bufferLength = this.analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    this.analyser.getByteTimeDomainData(dataArray);

    const width = this.canvas.width;
    const height = this.canvas.height;

    // Get accent color from CSS variables
    const style = getComputedStyle(document.documentElement);
    const accentColor = style.getPropertyValue('--nc').trim() || '#00ffff';

    // Clear background
    this.ctx.fillStyle = '#0a0014';
    this.ctx.fillRect(0, 0, width, height);

    // Draw waveform
    this.ctx.lineWidth = 2;
    this.ctx.strokeStyle = accentColor;
    this.ctx.shadowColor = accentColor;
    this.ctx.shadowBlur = 10;
    this.ctx.beginPath();

    const sliceWidth = width / bufferLength;
    let x = 0;

    for (let i = 0; i < bufferLength; i++) {
      const v = dataArray[i] / 128.0;
      const y = v * height / 2;

      if (i === 0) {
        this.ctx.moveTo(x, y);
      } else {
        this.ctx.lineTo(x, y);
      }

      x += sliceWidth;
    }

    this.ctx.lineTo(width, height / 2);
    this.ctx.stroke();
    this.ctx.shadowBlur = 0;
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
