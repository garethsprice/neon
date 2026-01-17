// Neon Drums WebGL Visualizer - Compact mesh gradient that reacts to instruments
const nc = e => [(e >> 16 & 255) / 255, (e >> 8 & 255) / 255, (255 & e) / 255];

class MiniGl {
    constructor(c, w, h) {
        this.canvas = c;
        this.gl = c.getContext("webgl", { antialias: true, alpha: true });
        this.meshes = [];
        const gl = this.gl;

        const identity = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
        this.commonUniforms = {
            projectionMatrix: { type: "mat4", value: identity },
            modelViewMatrix: { type: "mat4", value: identity },
            resolution: { type: "vec2", value: [1, 1] },
            aspectRatio: { type: "float", value: 1 }
        };

        if (w && h) this.setSize(w, h);

        const _miniGl = this;
        this.Material = class {
            constructor(vert, frag, uniforms = {}) {
                const getShader = (type, src) => {
                    const s = gl.createShader(type);
                    gl.shaderSource(s, src);
                    gl.compileShader(s);
                    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
                        console.error('Shader compile error:', gl.getShaderInfoLog(s));
                    }
                    return s;
                };
                const getDecl = (u) => Object.entries(u).map(([k, v]) =>
                    `uniform ${v.type} ${k};`
                ).join('\n');

                this.uniforms = uniforms;
                this.uniformInstances = [];
                const prefix = "precision highp float;\n";

                this.vertexShader = getShader(gl.VERTEX_SHADER,
                    `${prefix}attribute vec4 position;\nattribute vec2 uv;\nattribute vec2 uvNorm;\n` +
                    `uniform mat4 projectionMatrix;\nuniform mat4 modelViewMatrix;\nuniform vec2 resolution;\nuniform float aspectRatio;\n` +
                    `${getDecl(uniforms)}\n${vert}`);
                this.fragmentShader = getShader(gl.FRAGMENT_SHADER,
                    `${prefix}uniform vec2 resolution;\n${getDecl(uniforms)}\n${frag}`);

                this.program = gl.createProgram();
                gl.attachShader(this.program, this.vertexShader);
                gl.attachShader(this.program, this.fragmentShader);
                gl.linkProgram(this.program);

                if (!gl.getProgramParameter(this.program, gl.LINK_STATUS)) {
                    console.error('Program link error:', gl.getProgramInfoLog(this.program));
                    return;
                }

                gl.useProgram(this.program);

                // Add common uniforms
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

        this.PlaneGeometry = class {
            constructor(w, h, xSeg, ySeg) {
                this.xSeg = xSeg; this.ySeg = ySeg;
                this.vertCount = (xSeg + 1) * (ySeg + 1);
                this.position = { buffer: gl.createBuffer(), values: new Float32Array(3 * this.vertCount), size: 3 };
                this.uv = { buffer: gl.createBuffer(), values: new Float32Array(2 * this.vertCount), size: 2 };
                this.uvNorm = { buffer: gl.createBuffer(), values: new Float32Array(2 * this.vertCount), size: 2 };
                this.index = { buffer: gl.createBuffer(), values: new Uint16Array(6 * xSeg * ySeg), size: 3 };

                for (let y = 0; y <= ySeg; y++) {
                    for (let x = 0; x <= xSeg; x++) {
                        const i = y * (xSeg + 1) + x;
                        this.uv.values[2 * i] = x / xSeg;
                        this.uv.values[2 * i + 1] = 1 - y / ySeg;
                        this.uvNorm.values[2 * i] = x / xSeg * 2 - 1;
                        this.uvNorm.values[2 * i + 1] = 1 - y / ySeg * 2;
                        if (x < xSeg && y < ySeg) {
                            const q = y * xSeg + x;
                            this.index.values[6 * q] = i;
                            this.index.values[6 * q + 1] = i + 1 + xSeg;
                            this.index.values[6 * q + 2] = i + 1;
                            this.index.values[6 * q + 3] = i + 1;
                            this.index.values[6 * q + 4] = i + 1 + xSeg;
                            this.index.values[6 * q + 5] = i + 2 + xSeg;
                        }
                    }
                }
                this.setSize(w, h);
                [this.uv, this.uvNorm, this.index].forEach(a => {
                    gl.bindBuffer(a === this.index ? gl.ELEMENT_ARRAY_BUFFER : gl.ARRAY_BUFFER, a.buffer);
                    gl.bufferData(a === this.index ? gl.ELEMENT_ARRAY_BUFFER : gl.ARRAY_BUFFER, a.values, gl.STATIC_DRAW);
                });
            }
            setSize(w, h) {
                const ox = w / -2, oy = h / -2, sw = w / this.xSeg, sh = h / this.ySeg;
                for (let y = 0; y <= this.ySeg; y++) {
                    for (let x = 0; x <= this.xSeg; x++) {
                        const i = y * (this.xSeg + 1) + x;
                        this.position.values[3 * i] = ox + x * sw;
                        this.position.values[3 * i + 1] = -(oy + y * sh);
                        this.position.values[3 * i + 2] = 0;
                    }
                }
                gl.bindBuffer(gl.ARRAY_BUFFER, this.position.buffer);
                gl.bufferData(gl.ARRAY_BUFFER, this.position.values, gl.STATIC_DRAW);
            }
        };

        this.Mesh = class {
            constructor(geo, mat) {
                this.geo = geo; this.mat = mat;
                this.attrs = ['position', 'uv', 'uvNorm'].map(name => ({
                    attr: geo[name],
                    loc: gl.getAttribLocation(mat.program, name)
                }));
            }
            draw() {
                gl.useProgram(this.mat.program);
                this.mat.uniformInstances.forEach(({ uniform: u, location: l }) => {
                    if (u.type === 'float') gl.uniform1f(l, u.value);
                    else if (u.type === 'vec2') gl.uniform2fv(l, u.value);
                    else if (u.type === 'vec3') gl.uniform3fv(l, u.value);
                    else if (u.type === 'vec4') gl.uniform4fv(l, u.value);
                    else if (u.type === 'mat4') gl.uniformMatrix4fv(l, false, u.value);
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
    setSize(w, h) {
        this.width = w; this.height = h;
        this.canvas.width = w; this.canvas.height = h;
        this.gl.viewport(0, 0, w, h);
        this.commonUniforms.resolution.value = [w, h];
        this.commonUniforms.aspectRatio.value = w / h;
        this.commonUniforms.projectionMatrix.value = [2 / w, 0, 0, 0, 0, 2 / h, 0, 0, 0, 0, -0.001, 0, 0, 0, 0, 1];
    }
    render() {
        this.gl.clearColor(0, 0, 0, 0);
        this.gl.clear(this.gl.COLOR_BUFFER_BIT);
        this.meshes.forEach(m => m.draw());
    }
}

// Neon vaporwave colors
const COLORS = {
    base: nc(0x0a0014),      // Dark purple bg
    cyan: nc(0x00ffff),      // Kick, snare
    magenta: nc(0xff00ff),   // Toms
    purple: nc(0xbf5fff),    // Rimshot, clap
    lime: nc(0x39ff14),      // Hats
    orange: nc(0xff6600),    // Cymbals
    pink: nc(0xff3366)       // Accent
};

const INST_COLORS = {
    bassDrum: 'cyan', snareDrum: 'cyan',
    lowTom: 'magenta', midTom: 'magenta', highTom: 'magenta',
    rimshot: 'purple', handclap: 'purple',
    closedHiHat: 'lime', openHiHat: 'lime',
    crashCymbal: 'orange', rideCymbal: 'orange'
};

export class NeonVisualizer {
    constructor(canvas) {
        this.canvas = canvas;
        const w = window.innerWidth, h = window.innerHeight;
        canvas.width = w;
        canvas.height = h;
        this.minigl = new MiniGl(canvas, w, h);
        this.t = 0;
        this.triggers = {};
        this.intensity = { cyan: 0, magenta: 0, purple: 0, lime: 0, orange: 0 };
        this.bpm = 120;
        this.playing = false;
        this.init();
    }

    init() {
        // Flatter, subtler vaporwave gradient shader
        const vert = `
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
                float energy = u_bpm / 120.0; // Normalize around 120 BPM
                vec2 noiseCoord = uvNorm * 2.0;

                // Subtle wave displacement - flatter design
                float wave = snoise(vec3(noiseCoord.x + time, noiseCoord.y * 0.5, time * 3.0)) * 30.0;
                wave += (u_cyan + u_magenta + u_purple + u_lime + u_orange) * 15.0;
                wave *= 1.0 - pow(abs(uvNorm.y), 1.5);

                vec3 pos = vec3(position.x, position.y + wave, position.z);

                // Soft gradient color bands - vaporwave aesthetic
                float n1 = snoise(vec3(noiseCoord * 1.5 + time * 0.5, time * 4.0)) * 0.5 + 0.5;
                float n2 = snoise(vec3(noiseCoord * 1.2 - time * 0.3, time * 3.0 + 5.0)) * 0.5 + 0.5;
                float n3 = snoise(vec3(noiseCoord * 1.8 + time * 0.2, time * 3.5 + 10.0)) * 0.5 + 0.5;

                // Base dark purple
                vec3 col = vec3(0.04, 0.0, 0.06);

                // BPM affects overall brightness
                float brightness = 0.6 + energy * 0.4;

                // Subtle color layers with neon accents on triggers
                col = mix(col, vec3(0.0, 0.8, 0.8) * brightness, n1 * (0.08 + u_cyan * 0.4));
                col = mix(col, vec3(0.8, 0.0, 0.8) * brightness, n2 * (0.06 + u_magenta * 0.35));
                col = mix(col, vec3(0.6, 0.3, 0.9) * brightness, n3 * (0.05 + u_purple * 0.3));
                col = mix(col, vec3(0.2, 0.9, 0.1) * brightness, n1 * n2 * (0.04 + u_lime * 0.35));
                col = mix(col, vec3(1.0, 0.4, 0.1) * brightness, n2 * n3 * (0.03 + u_orange * 0.3));

                vColor = col;
                gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
            }
        `;

        const frag = `
            varying vec2 vUv;
            varying vec3 vColor;

            void main() {
                vec3 col = vColor;

                // Subtle vertical fade
                col *= 0.9 + 0.1 * (1.0 - vUv.y);

                // === 80s VHS/CRT Interlacing Effect ===
                float screenY = gl_FragCoord.y;

                // Primary scanlines - every 2 pixels
                float scanline = sin(screenY * 3.14159) * 0.5 + 0.5;
                scanline = pow(scanline, 0.8);
                col *= 0.85 + 0.15 * scanline;

                // Thicker scanline bands every ~4 pixels for that CRT phosphor look
                float band = sin(screenY * 0.8) * 0.5 + 0.5;
                col *= 0.92 + 0.08 * band;

                // Subtle RGB color separation (chromatic aberration)
                float shift = 0.001;
                float r = col.r;
                float g = col.g;
                float b = col.b;
                // Shift red slightly based on position
                r *= 1.0 + sin(vUv.x * 6.28318 + screenY * 0.01) * 0.03;
                b *= 1.0 + cos(vUv.x * 6.28318 - screenY * 0.01) * 0.03;
                col = vec3(r, g, b);

                // CRT vignette - darker edges
                vec2 center = vUv - 0.5;
                float vignette = 1.0 - dot(center, center) * 0.5;
                vignette = smoothstep(0.2, 1.0, vignette);
                col *= vignette;

                // Slight overall desaturation for that aged VHS look
                float luma = dot(col, vec3(0.299, 0.587, 0.114));
                col = mix(vec3(luma), col, 0.92);

                gl_FragColor = vec4(col, 1.0);
            }
        `;

        const uniforms = {
            u_time: { type: 'float', value: 0 },
            u_bpm: { type: 'float', value: 120 },
            u_cyan: { type: 'float', value: 0 },
            u_magenta: { type: 'float', value: 0 },
            u_purple: { type: 'float', value: 0 },
            u_lime: { type: 'float', value: 0 },
            u_orange: { type: 'float', value: 0 }
        };

        this.material = new this.minigl.Material(vert, frag, uniforms);
        this.geometry = new this.minigl.PlaneGeometry(this.canvas.width, this.canvas.height, 32, 24);
        this.mesh = new this.minigl.Mesh(this.geometry, this.material);
        this.minigl.meshes.push(this.mesh);

        this.resize();
        window.addEventListener('resize', () => this.resize());
    }

    resize() {
        const w = window.innerWidth, h = window.innerHeight;
        this.minigl.setSize(w, h);
        this.geometry.setSize(w, h);
    }

    trigger(instrument) {
        const color = INST_COLORS[instrument];
        // Smooth ramp up - add to current value instead of snapping to 1
        if (color) this.intensity[color] = Math.min(1, this.intensity[color] + 0.4);
    }

    setBpm(bpm) {
        this.bpm = bpm;
    }

    animate = (time) => {
        this.t = time;

        // Fast decay for clearer instrument visualization
        Object.keys(this.intensity).forEach(k => {
            this.intensity[k] *= 0.85; // Faster decay (was 0.92)
        });

        // Update uniforms
        this.material.uniforms.u_time.value = this.t;
        this.material.uniforms.u_bpm.value = this.bpm;
        this.material.uniforms.u_cyan.value = this.intensity.cyan;
        this.material.uniforms.u_magenta.value = this.intensity.magenta;
        this.material.uniforms.u_purple.value = this.intensity.purple;
        this.material.uniforms.u_lime.value = this.intensity.lime;
        this.material.uniforms.u_orange.value = this.intensity.orange;

        this.minigl.render();

        if (this.playing) requestAnimationFrame(this.animate);
    }

    play() {
        if (!this.playing) {
            this.playing = true;
            requestAnimationFrame(this.animate);
        }
    }

    pause() {
        this.playing = false;
    }
}
