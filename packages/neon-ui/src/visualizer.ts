/**
 * Neon UI - WebGL Visualizer
 *
 * Mesh gradient background that reacts to audio/events.
 * Apps can configure color channels and trigger them based on their own events.
 *
 * @example
 * import { createVisualizer } from '@neon/ui';
 *
 * const visualizer = createVisualizer(canvas, {
 *   channels: ['kick', 'snare', 'hats'],
 *   colors: {
 *     kick: '#00ffff',
 *     snare: '#ff00ff',
 *     hats: '#39ff14'
 *   }
 * });
 *
 * visualizer.play();
 * visualizer.trigger('kick');
 * visualizer.setBpm(128);
 */

// =============================================================================
// TYPES
// =============================================================================

export interface VisualizerConfig {
  /** Named color channels for triggering (default: cyan, magenta, purple, lime, orange) */
  channels?: string[];
  /** Hex colors for each channel (default: neon vaporwave palette) */
  colors?: Record<string, string>;
  /** Grid resolution for mesh (default: 32x24) */
  resolution?: [number, number];
}

export interface VisualizerComponent {
  /** Trigger a color channel (e.g., on drum hit) */
  trigger: (channel: string, intensity?: number) => void;
  /** Set current BPM for animation speed */
  setBpm: (bpm: number) => void;
  /** Start animation */
  play: () => void;
  /** Stop animation */
  pause: () => void;
  /** Handle resize (usually automatic) */
  resize: () => void;
  /** Get canvas element */
  getCanvas: () => HTMLCanvasElement;
  /** Check if currently playing */
  isPlaying: () => boolean;
  /** Destroy and clean up */
  destroy: () => void;
}

// =============================================================================
// INTERNAL TYPES (MiniGL)
// =============================================================================

interface UniformValue {
  type: 'float' | 'vec2' | 'vec3' | 'vec4' | 'mat4';
  value: number | number[];
}

interface GeometryAttribute {
  buffer: WebGLBuffer;
  values: Float32Array | Uint16Array;
  size: number;
}

interface PlaneGeometry {
  xSeg: number;
  ySeg: number;
  vertCount: number;
  position: GeometryAttribute;
  uv: GeometryAttribute;
  uvNorm: GeometryAttribute;
  index: GeometryAttribute;
  setSize: (w: number, h: number) => void;
}

interface UniformInstance {
  uniform: UniformValue;
  location: WebGLUniformLocation | null;
}

interface Material {
  uniforms: Record<string, UniformValue>;
  uniformInstances: UniformInstance[];
  vertexShader: WebGLShader;
  fragmentShader: WebGLShader;
  program: WebGLProgram;
}

interface MeshAttribute {
  attr: GeometryAttribute;
  loc: number;
}

interface Mesh {
  geo: PlaneGeometry;
  mat: Material;
  attrs: MeshAttribute[];
  draw: () => void;
}

// =============================================================================
// COLOR UTILITIES
// =============================================================================

/** Convert hex color to RGB array [0-1] */
function hexToRgb(hex: string): number[] {
  const h = hex.replace('#', '');
  const n = parseInt(h, 16);
  return [(n >> 16 & 255) / 255, (n >> 8 & 255) / 255, (255 & n) / 255];
}

/** Default neon vaporwave colors */
const DEFAULT_COLORS: Record<string, string> = {
  cyan: '#00ffff',
  magenta: '#ff00ff',
  purple: '#bf5fff',
  lime: '#39ff14',
  orange: '#ff6600',
  pink: '#ff3366',
  blue: '#0066ff',
  red: '#ff0033',
  yellow: '#ffff00',
  white: '#ffffff'
};

const DEFAULT_CHANNELS = ['cyan', 'magenta', 'purple', 'lime', 'orange'];

// =============================================================================
// MINIGL - Compact WebGL wrapper
// =============================================================================

class MiniGl {
  canvas: HTMLCanvasElement;
  gl: WebGLRenderingContext;
  meshes: Mesh[] = [];
  commonUniforms: {
    projectionMatrix: UniformValue;
    modelViewMatrix: UniformValue;
    resolution: UniformValue;
    aspectRatio: UniformValue;
  };
  width = 0;
  height = 0;
  Material: new (vert: string, frag: string, uniforms?: Record<string, UniformValue>) => Material;
  PlaneGeometry: new (w: number, h: number, xSeg: number, ySeg: number) => PlaneGeometry;
  Mesh: new (geo: PlaneGeometry, mat: Material) => Mesh;

  constructor(canvas: HTMLCanvasElement, w?: number, h?: number) {
    this.canvas = canvas;
    const glContext = canvas.getContext('webgl', { antialias: true, alpha: true });
    if (!glContext) throw new Error('WebGL not supported');
    this.gl = glContext;

    const identity = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
    this.commonUniforms = {
      projectionMatrix: { type: 'mat4', value: identity },
      modelViewMatrix: { type: 'mat4', value: identity },
      resolution: { type: 'vec2', value: [1, 1] },
      aspectRatio: { type: 'float', value: 1 }
    };

    if (w && h) this.setSize(w, h);

    const gl = this.gl;
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    const _miniGl = this;

    this.Material = class implements Material {
      uniforms: Record<string, UniformValue>;
      uniformInstances: UniformInstance[] = [];
      vertexShader: WebGLShader;
      fragmentShader: WebGLShader;
      program: WebGLProgram;

      constructor(vert: string, frag: string, uniforms: Record<string, UniformValue> = {}) {
        const getShader = (type: number, src: string): WebGLShader => {
          const s = gl.createShader(type)!;
          gl.shaderSource(s, src);
          gl.compileShader(s);
          if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
            console.error('Shader compile error:', gl.getShaderInfoLog(s));
          }
          return s;
        };
        const getDecl = (u: Record<string, UniformValue>): string =>
          Object.entries(u).map(([k, v]) => `uniform ${v.type} ${k};`).join('\n');

        this.uniforms = uniforms;
        const prefix = 'precision highp float;\n';

        this.vertexShader = getShader(gl.VERTEX_SHADER,
          `${prefix}attribute vec4 position;\nattribute vec2 uv;\nattribute vec2 uvNorm;\n` +
          `uniform mat4 projectionMatrix;\nuniform mat4 modelViewMatrix;\nuniform vec2 resolution;\nuniform float aspectRatio;\n` +
          `${getDecl(uniforms)}\n${vert}`);
        this.fragmentShader = getShader(gl.FRAGMENT_SHADER,
          `${prefix}uniform vec2 resolution;\n${getDecl(uniforms)}\n${frag}`);

        this.program = gl.createProgram()!;
        gl.attachShader(this.program, this.vertexShader);
        gl.attachShader(this.program, this.fragmentShader);
        gl.linkProgram(this.program);

        if (!gl.getProgramParameter(this.program, gl.LINK_STATUS)) {
          console.error('Program link error:', gl.getProgramInfoLog(this.program));
          return;
        }

        gl.useProgram(this.program);

        this.uniformInstances.push(
          { uniform: _miniGl.commonUniforms.projectionMatrix, location: gl.getUniformLocation(this.program, 'projectionMatrix') },
          { uniform: _miniGl.commonUniforms.modelViewMatrix, location: gl.getUniformLocation(this.program, 'modelViewMatrix') },
          { uniform: _miniGl.commonUniforms.resolution, location: gl.getUniformLocation(this.program, 'resolution') },
          { uniform: _miniGl.commonUniforms.aspectRatio, location: gl.getUniformLocation(this.program, 'aspectRatio') }
        );

        Object.entries(uniforms).forEach(([k, v]) => {
          this.uniformInstances.push({ uniform: v, location: gl.getUniformLocation(this.program, k) });
        });
      }
    };

    this.PlaneGeometry = class implements PlaneGeometry {
      xSeg: number;
      ySeg: number;
      vertCount: number;
      position: GeometryAttribute;
      uv: GeometryAttribute;
      uvNorm: GeometryAttribute;
      index: GeometryAttribute;

      constructor(w: number, h: number, xSeg: number, ySeg: number) {
        this.xSeg = xSeg;
        this.ySeg = ySeg;
        this.vertCount = (xSeg + 1) * (ySeg + 1);
        this.position = { buffer: gl.createBuffer()!, values: new Float32Array(3 * this.vertCount), size: 3 };
        this.uv = { buffer: gl.createBuffer()!, values: new Float32Array(2 * this.vertCount), size: 2 };
        this.uvNorm = { buffer: gl.createBuffer()!, values: new Float32Array(2 * this.vertCount), size: 2 };
        this.index = { buffer: gl.createBuffer()!, values: new Uint16Array(6 * xSeg * ySeg), size: 3 };

        for (let y = 0; y <= ySeg; y++) {
          for (let x = 0; x <= xSeg; x++) {
            const i = y * (xSeg + 1) + x;
            (this.uv.values as Float32Array)[2 * i] = x / xSeg;
            (this.uv.values as Float32Array)[2 * i + 1] = 1 - y / ySeg;
            (this.uvNorm.values as Float32Array)[2 * i] = x / xSeg * 2 - 1;
            (this.uvNorm.values as Float32Array)[2 * i + 1] = 1 - y / ySeg * 2;
            if (x < xSeg && y < ySeg) {
              const q = y * xSeg + x;
              (this.index.values as Uint16Array)[6 * q] = i;
              (this.index.values as Uint16Array)[6 * q + 1] = i + 1 + xSeg;
              (this.index.values as Uint16Array)[6 * q + 2] = i + 1;
              (this.index.values as Uint16Array)[6 * q + 3] = i + 1;
              (this.index.values as Uint16Array)[6 * q + 4] = i + 1 + xSeg;
              (this.index.values as Uint16Array)[6 * q + 5] = i + 2 + xSeg;
            }
          }
        }
        this.setSize(w, h);
        [this.uv, this.uvNorm, this.index].forEach(a => {
          gl.bindBuffer(a === this.index ? gl.ELEMENT_ARRAY_BUFFER : gl.ARRAY_BUFFER, a.buffer);
          gl.bufferData(a === this.index ? gl.ELEMENT_ARRAY_BUFFER : gl.ARRAY_BUFFER, a.values, gl.STATIC_DRAW);
        });
      }

      setSize(w: number, h: number): void {
        const ox = w / -2, oy = h / -2, sw = w / this.xSeg, sh = h / this.ySeg;
        for (let y = 0; y <= this.ySeg; y++) {
          for (let x = 0; x <= this.xSeg; x++) {
            const i = y * (this.xSeg + 1) + x;
            (this.position.values as Float32Array)[3 * i] = ox + x * sw;
            (this.position.values as Float32Array)[3 * i + 1] = -(oy + y * sh);
            (this.position.values as Float32Array)[3 * i + 2] = 0;
          }
        }
        gl.bindBuffer(gl.ARRAY_BUFFER, this.position.buffer);
        gl.bufferData(gl.ARRAY_BUFFER, this.position.values, gl.STATIC_DRAW);
      }
    };

    this.Mesh = class implements Mesh {
      geo: PlaneGeometry;
      mat: Material;
      attrs: MeshAttribute[];

      constructor(geo: PlaneGeometry, mat: Material) {
        this.geo = geo;
        this.mat = mat;
        this.attrs = ['position', 'uv', 'uvNorm'].map(name => ({
          attr: geo[name as keyof PlaneGeometry] as GeometryAttribute,
          loc: gl.getAttribLocation(mat.program, name)
        }));
      }

      draw(): void {
        gl.useProgram(this.mat.program);
        this.mat.uniformInstances.forEach(({ uniform: u, location: l }) => {
          if (!l) return;
          if (u.type === 'float') gl.uniform1f(l, u.value as number);
          else if (u.type === 'vec2') gl.uniform2fv(l, u.value as number[]);
          else if (u.type === 'vec3') gl.uniform3fv(l, u.value as number[]);
          else if (u.type === 'vec4') gl.uniform4fv(l, u.value as number[]);
          else if (u.type === 'mat4') gl.uniformMatrix4fv(l, false, u.value as number[]);
        });
        this.attrs.forEach(({ attr, loc }) => {
          gl.bindBuffer(gl.ARRAY_BUFFER, attr.buffer);
          gl.enableVertexAttribArray(loc);
          gl.vertexAttribPointer(loc, attr.size, gl.FLOAT, false, 0, 0);
        });
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.geo.index.buffer);
        gl.drawElements(gl.TRIANGLES, this.geo.index.values.length, gl.UNSIGNED_SHORT, 0);
      }
    };
  }

  setSize(w: number, h: number): void {
    this.width = w;
    this.height = h;
    this.canvas.width = w;
    this.canvas.height = h;
    this.gl.viewport(0, 0, w, h);
    this.commonUniforms.resolution.value = [w, h];
    this.commonUniforms.aspectRatio.value = w / h;
    this.commonUniforms.projectionMatrix.value = [2 / w, 0, 0, 0, 0, 2 / h, 0, 0, 0, 0, -0.001, 0, 0, 0, 0, 1];
  }

  render(): void {
    this.gl.clearColor(0, 0, 0, 0);
    this.gl.clear(this.gl.COLOR_BUFFER_BIT);
    this.meshes.forEach(m => m.draw());
  }
}

// =============================================================================
// SHADER CODE
// =============================================================================

function buildVertexShader(channelCount: number): string {
  const channelUniforms = Array.from({ length: channelCount }, (_, i) => `u_ch${i}`);
  const channelSum = channelUniforms.join(' + ');

  return `
    varying vec2 vUv;
    varying vec3 vColor;

    vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
    vec4 mod289(vec4 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
    vec4 permute(vec4 x) { return mod289(((x*34.0)+1.0)*x); }
    vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }

    float snoise(vec3 v) {
      const vec2 C = vec2(1.0/6.0, 1.0/3.0);
      const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);
      vec3 i = floor(v + dot(v, C.yyy));
      vec3 x0 = v - i + dot(i, C.xxx);
      vec3 g = step(x0.yzx, x0.xyz);
      vec3 l = 1.0 - g;
      vec3 i1 = min(g.xyz, l.zxy);
      vec3 i2 = max(g.xyz, l.zxy);
      vec3 x1 = x0 - i1 + C.xxx;
      vec3 x2 = x0 - i2 + C.yyy;
      vec3 x3 = x0 - D.yyy;
      i = mod289(i);
      vec4 p = permute(permute(permute(i.z + vec4(0.0, i1.z, i2.z, 1.0)) + i.y + vec4(0.0, i1.y, i2.y, 1.0)) + i.x + vec4(0.0, i1.x, i2.x, 1.0));
      float n_ = 0.142857142857;
      vec3 ns = n_ * D.wyz - D.xzx;
      vec4 j = p - 49.0 * floor(p * ns.z * ns.z);
      vec4 x_ = floor(j * ns.z);
      vec4 y_ = floor(j - 7.0 * x_);
      vec4 x = x_ * ns.x + ns.yyyy;
      vec4 y = y_ * ns.x + ns.yyyy;
      vec4 h = 1.0 - abs(x) - abs(y);
      vec4 b0 = vec4(x.xy, y.xy);
      vec4 b1 = vec4(x.zw, y.zw);
      vec4 s0 = floor(b0) * 2.0 + 1.0;
      vec4 s1 = floor(b1) * 2.0 + 1.0;
      vec4 sh = -step(h, vec4(0.0));
      vec4 a0 = b0.xzyw + s0.xzyw * sh.xxyy;
      vec4 a1 = b1.xzyw + s1.xzyw * sh.zzww;
      vec3 p0 = vec3(a0.xy, h.x);
      vec3 p1 = vec3(a0.zw, h.y);
      vec3 p2 = vec3(a1.xy, h.z);
      vec3 p3 = vec3(a1.zw, h.w);
      vec4 norm = taylorInvSqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2,p2), dot(p3,p3)));
      p0 *= norm.x; p1 *= norm.y; p2 *= norm.z; p3 *= norm.w;
      vec4 m = max(0.6 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0);
      m = m * m;
      return 42.0 * dot(m*m, vec4(dot(p0,x0), dot(p1,x1), dot(p2,x2), dot(p3,x3)));
    }

    void main() {
      vUv = uv;
      float time = u_time * 0.00002;
      float energy = u_bpm / 120.0;
      vec2 noiseCoord = uvNorm * 2.0;

      float wave = snoise(vec3(noiseCoord.x + time, noiseCoord.y * 0.5, time * 3.0)) * 30.0;
      wave += (${channelSum}) * 15.0;
      wave *= 1.0 - pow(abs(uvNorm.y), 1.5);

      vec3 pos = vec3(position.x, position.y + wave, position.z);

      float n1 = snoise(vec3(noiseCoord * 1.5 + time * 0.5, time * 4.0)) * 0.5 + 0.5;
      float n2 = snoise(vec3(noiseCoord * 1.2 - time * 0.3, time * 3.0 + 5.0)) * 0.5 + 0.5;
      float n3 = snoise(vec3(noiseCoord * 1.8 + time * 0.2, time * 3.5 + 10.0)) * 0.5 + 0.5;

      vec3 col = vec3(0.04, 0.0, 0.06);
      float brightness = 0.6 + energy * 0.4;

      // Mix colors based on noise and channel intensities
      ${channelUniforms.map((ch, i) => {
        const noiseVar = i % 3 === 0 ? 'n1' : i % 3 === 1 ? 'n2' : 'n3';
        const noiseMix = i >= 3 ? `${noiseVar} * n${(i % 2) + 1}` : noiseVar;
        return `col = mix(col, u_col${i} * brightness, ${noiseMix} * (0.0${8 - Math.min(i, 5)} + ${ch} * 0.${4 - Math.floor(i / 2)}));`;
      }).join('\n      ')}

      vColor = col;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
    }
  `;
}

const FRAGMENT_SHADER = `
  varying vec2 vUv;
  varying vec3 vColor;

  void main() {
    vec3 col = vColor;
    col *= 0.9 + 0.1 * (1.0 - vUv.y);

    float screenY = gl_FragCoord.y;

    float scanline = sin(screenY * 3.14159) * 0.5 + 0.5;
    scanline = pow(scanline, 0.8);
    col *= 0.85 + 0.15 * scanline;

    float band = sin(screenY * 0.8) * 0.5 + 0.5;
    col *= 0.92 + 0.08 * band;

    float r = col.r;
    float g = col.g;
    float b = col.b;
    r *= 1.0 + sin(vUv.x * 6.28318 + screenY * 0.01) * 0.03;
    b *= 1.0 + cos(vUv.x * 6.28318 - screenY * 0.01) * 0.03;
    col = vec3(r, g, b);

    vec2 center = vUv - 0.5;
    float vignette = 1.0 - dot(center, center) * 0.5;
    vignette = smoothstep(0.2, 1.0, vignette);
    col *= vignette;

    float luma = dot(col, vec3(0.299, 0.587, 0.114));
    col = mix(vec3(luma), col, 0.92);

    gl_FragColor = vec4(col, 1.0);
  }
`;

// =============================================================================
// CREATE VISUALIZER
// =============================================================================

/**
 * Create a WebGL mesh gradient visualizer
 */
export function createVisualizer(
  canvas: HTMLCanvasElement,
  config: VisualizerConfig = {}
): VisualizerComponent {
  const channels = config.channels ?? DEFAULT_CHANNELS;
  const colors = { ...DEFAULT_COLORS, ...config.colors };
  const [xSeg, ySeg] = config.resolution ?? [32, 24];

  // State
  let playing = false;
  let bpm = 120;
  let t = 0;
  const intensity: Record<string, number> = {};
  channels.forEach(ch => { intensity[ch] = 0; });

  // Initialize
  const w = window.innerWidth;
  const h = window.innerHeight;
  canvas.width = w;
  canvas.height = h;

  const minigl = new MiniGl(canvas, w, h);

  // Build uniforms
  const uniforms: Record<string, UniformValue> = {
    u_time: { type: 'float', value: 0 },
    u_bpm: { type: 'float', value: 120 }
  };

  // Add channel uniforms
  channels.forEach((ch, i) => {
    uniforms[`u_ch${i}`] = { type: 'float', value: 0 };
    const rgb = hexToRgb(colors[ch] ?? DEFAULT_COLORS.cyan);
    uniforms[`u_col${i}`] = { type: 'vec3', value: rgb };
  });

  const vertexShader = buildVertexShader(channels.length);
  const material = new minigl.Material(vertexShader, FRAGMENT_SHADER, uniforms);
  const geometry = new minigl.PlaneGeometry(canvas.width, canvas.height, xSeg, ySeg);
  const mesh = new minigl.Mesh(geometry, material);
  minigl.meshes.push(mesh);

  // Resize handler
  const handleResize = (): void => {
    const newW = window.innerWidth;
    const newH = window.innerHeight;
    minigl.setSize(newW, newH);
    geometry.setSize(newW, newH);
  };

  window.addEventListener('resize', handleResize);

  // Animation loop
  const animate = (time: number): void => {
    t = time;

    // Decay intensities
    channels.forEach(ch => {
      intensity[ch] *= 0.85;
    });

    // Update uniforms
    material.uniforms.u_time.value = t;
    material.uniforms.u_bpm.value = bpm;
    channels.forEach((ch, i) => {
      material.uniforms[`u_ch${i}`].value = intensity[ch];
    });

    minigl.render();

    if (playing) requestAnimationFrame(animate);
  };

  return {
    trigger(channel: string, amount = 0.4): void {
      if (intensity[channel] !== undefined) {
        intensity[channel] = Math.min(1, intensity[channel] + amount);
      }
    },

    setBpm(newBpm: number): void {
      bpm = newBpm;
    },

    play(): void {
      if (!playing) {
        playing = true;
        requestAnimationFrame(animate);
      }
    },

    pause(): void {
      playing = false;
    },

    resize(): void {
      handleResize();
    },

    getCanvas(): HTMLCanvasElement {
      return canvas;
    },

    isPlaying(): boolean {
      return playing;
    },

    destroy(): void {
      playing = false;
      window.removeEventListener('resize', handleResize);
    }
  };
}
