/* ==========================================================================
   NEON SYNTH 2 - Waveform Visualizer
   Canvas-based oscilloscope display
   ========================================================================== */

export class Visualizer {
    constructor(canvas, analyser) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.analyser = analyser;
        this.animationId = null;

        this.init();
    }

    init() {
        // Set up resize handling
        this.resize();
        window.addEventListener('resize', () => this.resize());

        // Start the draw loop
        this.start();
    }

    resize() {
        this.canvas.width = this.canvas.clientWidth * window.devicePixelRatio;
        this.canvas.height = this.canvas.clientHeight * window.devicePixelRatio;
    }

    start() {
        const draw = () => {
            this.animationId = requestAnimationFrame(draw);
            this.draw();
        };
        draw();
    }

    stop() {
        if (this.animationId) {
            cancelAnimationFrame(this.animationId);
            this.animationId = null;
        }
    }

    draw() {
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

    destroy() {
        this.stop();
        window.removeEventListener('resize', () => this.resize());
    }
}

/**
 * Create a visualizer instance
 * @param {HTMLCanvasElement} canvas - The canvas element
 * @param {AnalyserNode} analyser - Web Audio analyser node
 * @returns {Visualizer}
 */
export function createVisualizer(canvas, analyser) {
    return new Visualizer(canvas, analyser);
}
