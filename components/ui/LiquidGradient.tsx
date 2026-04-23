'use client';
import { useEffect, useRef } from 'react';
import * as THREE from 'three';

// ── TouchTexture ──────────────────────────────────────────────────
class TouchTexture {
    size = 64; width = 64; height = 64; maxAge = 64; radius = 0.1; speed = 1 / 64;
    trail: { x: number; y: number; age: number; force: number; vx: number; vy: number }[] = [];
    last: { x: number; y: number } | null = null;
    canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D; texture: THREE.Texture;

    constructor() {
        this.canvas = document.createElement('canvas');
        this.canvas.width = this.width; this.canvas.height = this.height;
        this.ctx = this.canvas.getContext('2d')!;
        this.ctx.fillStyle = 'black';
        this.ctx.fillRect(0, 0, this.width, this.height);
        this.texture = new THREE.Texture(this.canvas);
    }

    update() {
        this.ctx.fillStyle = 'black';
        this.ctx.fillRect(0, 0, this.width, this.height);
        for (let i = this.trail.length - 1; i >= 0; i--) {
            const p = this.trail[i];
            const f = p.force * this.speed * (1 - p.age / this.maxAge);
            p.x += p.vx * f; p.y += p.vy * f; p.age++;
            if (p.age > this.maxAge) this.trail.splice(i, 1);
            else this.drawPoint(p);
        }
        this.texture.needsUpdate = true;
    }

    addTouch(point: { x: number; y: number }) {
        let force = 0, vx = 0, vy = 0;
        if (this.last) {
            const dx = point.x - this.last.x, dy = point.y - this.last.y;
            if (dx === 0 && dy === 0) return;
            const d = Math.sqrt(dx * dx + dy * dy);
            vx = dx / d; vy = dy / d;
            force = Math.min((dx * dx + dy * dy) * 20000, 2.0);
        }
        this.last = { x: point.x, y: point.y };
        this.trail.push({ x: point.x, y: point.y, age: 0, force, vx, vy });
    }

    drawPoint(p: { x: number; y: number; age: number; force: number; vx: number; vy: number }) {
        const pos = { x: p.x * this.width, y: (1 - p.y) * this.height };
        let intensity = p.age < this.maxAge * 0.3
            ? Math.sin((p.age / (this.maxAge * 0.3)) * (Math.PI / 2))
            : -((1 - (p.age - this.maxAge * 0.3) / (this.maxAge * 0.7)) * ((1 - (p.age - this.maxAge * 0.3) / (this.maxAge * 0.7)) - 2));
        intensity *= p.force;
        const color = `${((p.vx + 1) / 2) * 255}, ${((p.vy + 1) / 2) * 255}, ${intensity * 255}`;
        const radius = this.radius * this.width;
        this.ctx.shadowOffsetX = this.size * 5; this.ctx.shadowOffsetY = this.size * 5;
        this.ctx.shadowBlur = radius;
        this.ctx.shadowColor = `rgba(${color},${0.2 * intensity})`;
        this.ctx.beginPath();
        this.ctx.fillStyle = 'rgba(255,0,0,1)';
        this.ctx.arc(pos.x - this.size * 5, pos.y - this.size * 5, radius, 0, Math.PI * 2);
        this.ctx.fill();
    }
}

// ── Three.js App ──────────────────────────────────────────────────
class LiquidApp {
    renderer: THREE.WebGLRenderer; camera: THREE.PerspectiveCamera;
    scene: THREE.Scene; clock: THREE.Clock;
    touchTexture: TouchTexture; mesh: THREE.Mesh | null = null;
    uniforms: Record<string, { value: unknown }>; animId: number | null = null;
    container: HTMLElement;

    constructor(container: HTMLElement) {
        this.container = container;
        this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
        this.renderer.setSize(container.clientWidth, container.clientHeight);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        container.appendChild(this.renderer.domElement);

        this.camera = new THREE.PerspectiveCamera(45, container.clientWidth / container.clientHeight, 0.1, 10000);
        this.camera.position.z = 50;
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0xb5c0a3); // Soft Feminine Sage Green Base
        this.clock = new THREE.Clock();
        this.touchTexture = new TouchTexture();

        this.uniforms = {
            uTime: { value: 0 },
            uResolution: { value: new THREE.Vector2(container.clientWidth, container.clientHeight) },
            uColor1: { value: new THREE.Vector3(0.819, 0.533, 0.466) }, // Brand Pink Base (#D18877)
            uColor2: { value: new THREE.Vector3(0.709, 0.752, 0.639) }, // Feminine Green Base
            uColor3: { value: new THREE.Vector3(0.784, 0.494, 0.431) }, // Brand Pink darker (#C87E6E)
            uColor4: { value: new THREE.Vector3(0.709, 0.752, 0.639) }, // Feminine Green Base
            uColor5: { value: new THREE.Vector3(0.819, 0.533, 0.466) }, // Brand Pink Base
            uColor6: { value: new THREE.Vector3(0.709, 0.752, 0.639) }, // Feminine Green Base
            uSpeed: { value: 0.8 }, uIntensity: { value: 1.0 }, // Slower speed and drastically lower intensity for "painted" non-glowing look
            uTouchTexture: { value: this.touchTexture.texture },
            uGrainIntensity: { value: 0.04 }, // Reduced grain for softer paint look
            uDarkNavy: { value: new THREE.Vector3(0.709, 0.752, 0.639) }, // Feminine Green Base
            uGradientSize: { value: 0.55 }, uGradientCount: { value: 12.0 },
            uColor1Weight: { value: 0.4 }, uColor2Weight: { value: 1.2 }, // Balanced weights
        };

        this.init();
    }

    getViewSize() {
        const fov = (this.camera.fov * Math.PI) / 180;
        const height = Math.abs(this.camera.position.z * Math.tan(fov / 2) * 2);
        return { width: height * this.camera.aspect, height };
    }

    init() {
        const viewSize = this.getViewSize();
        const geometry = new THREE.PlaneGeometry(viewSize.width, viewSize.height, 1, 1);
        const material = new THREE.ShaderMaterial({
            uniforms: this.uniforms,
            vertexShader: `varying vec2 vUv; void main() { gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); vUv = uv; }`,
            fragmentShader: `
        uniform float uTime, uSpeed, uIntensity, uGrainIntensity, uGradientSize, uGradientCount, uColor1Weight, uColor2Weight;
        uniform vec2 uResolution;
        uniform vec3 uColor1, uColor2, uColor3, uColor4, uColor5, uColor6, uDarkNavy;
        uniform sampler2D uTouchTexture;
        varying vec2 vUv;
        float grain(vec2 uv, float t) { return fract(sin(dot(uv * uResolution * 0.5 + t, vec2(12.9898, 78.233))) * 43758.5453) * 2.0 - 1.0; }
        vec3 getGradientColor(vec2 uv, float time) {
          vec2 c1 = vec2(0.5 + sin(time*uSpeed*0.4)*0.4, 0.5+cos(time*uSpeed*0.5)*0.4);
          vec2 c2 = vec2(0.5 + cos(time*uSpeed*0.6)*0.5, 0.5+sin(time*uSpeed*0.45)*0.5);
          vec2 c3 = vec2(0.5 + sin(time*uSpeed*0.35)*0.45, 0.5+cos(time*uSpeed*0.55)*0.45);
          vec2 c4 = vec2(0.5 + cos(time*uSpeed*0.5)*0.4, 0.5+sin(time*uSpeed*0.4)*0.4);
          vec2 c5 = vec2(0.5 + sin(time*uSpeed*0.7)*0.35, 0.5+cos(time*uSpeed*0.6)*0.35);
          vec2 c6 = vec2(0.5 + cos(time*uSpeed*0.45)*0.5, 0.5+sin(time*uSpeed*0.65)*0.5);
          float i1=1.0-smoothstep(0.0,uGradientSize,length(uv-c1));
          float i2=1.0-smoothstep(0.0,uGradientSize,length(uv-c2));
          float i3=1.0-smoothstep(0.0,uGradientSize,length(uv-c3));
          float i4=1.0-smoothstep(0.0,uGradientSize,length(uv-c4));
          float i5=1.0-smoothstep(0.0,uGradientSize,length(uv-c5));
          float i6=1.0-smoothstep(0.0,uGradientSize,length(uv-c6));
          vec3 color = vec3(0.0);
          color += uColor1*i1*(0.55+0.45*sin(time*uSpeed))*uColor1Weight;
          color += uColor2*i2*(0.55+0.45*cos(time*uSpeed*1.2))*uColor2Weight;
          color += uColor3*i3*(0.55+0.45*sin(time*uSpeed*0.8))*uColor1Weight;
          color += uColor4*i4*(0.55+0.45*cos(time*uSpeed*1.3))*uColor2Weight;
          color += uColor5*i5*(0.55+0.45*sin(time*uSpeed*1.1))*uColor1Weight;
          color += uColor6*i6*(0.55+0.45*cos(time*uSpeed*0.9))*uColor2Weight;
          color = clamp(color, vec3(0.0), vec3(1.0)) * uIntensity;
          float lum = dot(color, vec3(0.299, 0.587, 0.114));
          color = mix(vec3(lum), color, 1.35);
          color = pow(color, vec3(0.92));
          float brightness = length(color);
          color = mix(uDarkNavy, color, max(brightness*1.2, 0.15));
          return color;
        }
        void main() {
          vec2 uv = vUv;
          vec4 t = texture2D(uTouchTexture, uv);
          uv.x -= (t.r*2.0-1.0)*0.8*t.b;
          uv.y -= (t.g*2.0-1.0)*0.8*t.b;
          float dist = length(uv - vec2(0.5));
          float ripple = sin(dist*20.0 - uTime*3.0)*0.04*t.b;
          uv += vec2(ripple);
          vec3 color = getGradientColor(uv, uTime);
          color += grain(uv, uTime)*uGrainIntensity;
          gl_FragColor = vec4(clamp(color,vec3(0.0),vec3(1.0)), 1.0);
        }`,
        });
        this.mesh = new THREE.Mesh(geometry, material);
        this.scene.add(this.mesh);

        // Mouse interaction
        const c = this.container;
        c.addEventListener('mousemove', (e) => {
            this.touchTexture.addTouch({ x: e.offsetX / c.clientWidth, y: 1 - e.offsetY / c.clientHeight });
        });
        c.addEventListener('touchmove', (e) => {
            const rect = c.getBoundingClientRect();
            this.touchTexture.addTouch({ x: (e.touches[0].clientX - rect.left) / c.clientWidth, y: 1 - (e.touches[0].clientY - rect.top) / c.clientHeight });
        });
        window.addEventListener('resize', () => this.onResize());
        this.tick();
    }

    onResize() {
        const c = this.container;
        this.camera.aspect = c.clientWidth / c.clientHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(c.clientWidth, c.clientHeight);
        (this.uniforms.uResolution.value as THREE.Vector2).set(c.clientWidth, c.clientHeight);
        if (this.mesh) {
            const vs = this.getViewSize();
            this.mesh.geometry.dispose();
            this.mesh.geometry = new THREE.PlaneGeometry(vs.width, vs.height, 1, 1);
        }
    }

    tick() {
        const delta = Math.min(this.clock.getDelta(), 0.1);
        this.touchTexture.update();
        (this.uniforms.uTime.value as number);
        this.uniforms.uTime.value = (this.uniforms.uTime.value as number) + delta;
        this.renderer.render(this.scene, this.camera);
        this.animId = requestAnimationFrame(() => this.tick());
    }

    cleanup() {
        if (this.animId) cancelAnimationFrame(this.animId);
        this.renderer.dispose();
        if (this.container.contains(this.renderer.domElement)) {
            this.container.removeChild(this.renderer.domElement);
        }
    }
}

// ── React Component (canvas only — put your own UI on top) ────────
export default function LiquidGradient({ className }: { className?: string }) {
    const containerRef = useRef<HTMLDivElement>(null);
    const appRef = useRef<LiquidApp | null>(null);

    useEffect(() => {
        const container = containerRef.current;
        if (!container) return;
        if (appRef.current) appRef.current.cleanup();
        appRef.current = new LiquidApp(container);
        return () => { appRef.current?.cleanup(); };
    }, []);

    return (
        <div
            ref={containerRef}
            className={className}
            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}
        />
    );
}
