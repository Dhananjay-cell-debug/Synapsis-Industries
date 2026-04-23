"use client";

import React, { useRef, useEffect } from 'react';

// WebGL Renderer class
class WebGLRenderer {
    private canvas: HTMLCanvasElement;
    private gl: WebGL2RenderingContext;
    private program: WebGLProgram | null = null;
    private vs: WebGLShader | null = null;
    private fs: WebGLShader | null = null;
    private buffer: WebGLBuffer | null = null;
    private scale: number;
    private shaderSource: string;
    private mouseMove: [number, number] = [0, 0];
    private mouseCoords: [number, number] = [0, 0];
    private pointerCoords: number[] = [0, 0];
    private nbrOfPointers = 0;

    private vertexSrc = `#version 300 es
precision highp float;
in vec4 position;
void main(){gl_Position=position;}`;

    private vertices = [-1, 1, -1, -1, 1, 1, 1, -1];

    private destroyed = false;

    constructor(canvas: HTMLCanvasElement, scale: number, defaultShader: string) {
        this.canvas = canvas;
        this.scale = scale;
        const gl = canvas.getContext('webgl2') || canvas.getContext('webgl') as any;
        if (!gl) {
            console.warn('[OrbitalBackground] WebGL not available — skipping shader background');
            this.gl = null as any;
            this.destroyed = true;
            this.shaderSource = '';
            return;
        }
        this.gl = gl;
        this.gl.viewport(0, 0, canvas.width * scale, canvas.height * scale);
        this.shaderSource = defaultShader;
    }

    updateShader(source: string) {
        if (this.destroyed) return;
        this.reset();
        this.shaderSource = source;
        this.setup();
        this.init();
    }

    updateMove(deltas: [number, number]) {
        this.mouseMove = deltas;
    }

    updateMouse(coords: [number, number]) {
        this.mouseCoords = coords;
    }

    updatePointerCoords(coords: number[]) {
        this.pointerCoords = coords;
    }

    updatePointerCount(nbr: number) {
        this.nbrOfPointers = nbr;
    }

    updateScale(scale: number) {
        if (this.destroyed) return;
        this.scale = scale;
        this.gl.viewport(0, 0, this.canvas.width * scale, this.canvas.height * scale);
    }

    compile(shader: WebGLShader, source: string) {
        const gl = this.gl;
        gl.shaderSource(shader, source);
        gl.compileShader(shader);

        if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
            const error = gl.getShaderInfoLog(shader);
            console.error('Shader compilation error:', error);
        }
    }

    test(source: string) {
        let result = null;
        const gl = this.gl;
        const shader = gl.createShader(gl.FRAGMENT_SHADER)!;
        gl.shaderSource(shader, source);
        gl.compileShader(shader);

        if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
            result = gl.getShaderInfoLog(shader);
        }
        gl.deleteShader(shader);
        return result;
    }

    reset() {
        const gl = this.gl;
        if (this.program && !gl.getProgramParameter(this.program, gl.DELETE_STATUS)) {
            if (this.vs) {
                gl.detachShader(this.program, this.vs);
                gl.deleteShader(this.vs);
            }
            if (this.fs) {
                gl.detachShader(this.program, this.fs);
                gl.deleteShader(this.fs);
            }
            gl.deleteProgram(this.program);
        }
    }

    setup() {
        const gl = this.gl;
        this.vs = gl.createShader(gl.VERTEX_SHADER)!;
        this.fs = gl.createShader(gl.FRAGMENT_SHADER)!;
        this.compile(this.vs, this.vertexSrc);
        this.compile(this.fs, this.shaderSource);
        this.program = gl.createProgram()!;
        gl.attachShader(this.program, this.vs);
        gl.attachShader(this.program, this.fs);
        gl.linkProgram(this.program);

        if (!gl.getProgramParameter(this.program, gl.LINK_STATUS)) {
            console.error(gl.getProgramInfoLog(this.program));
        }
    }

    init() {
        const gl = this.gl;
        const program = this.program!;

        this.buffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, this.buffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(this.vertices), gl.STATIC_DRAW);

        const position = gl.getAttribLocation(program, 'position');
        gl.enableVertexAttribArray(position);
        gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);

        (program as any).resolution = gl.getUniformLocation(program, 'resolution');
        (program as any).time = gl.getUniformLocation(program, 'time');
        (program as any).move = gl.getUniformLocation(program, 'move');
        (program as any).touch = gl.getUniformLocation(program, 'touch');
        (program as any).pointerCount = gl.getUniformLocation(program, 'pointerCount');
        (program as any).pointers = gl.getUniformLocation(program, 'pointers');
    }

    render(now = 0) {
        if (this.destroyed || !this.gl) return;
        const gl = this.gl;
        const program = this.program;

        if (!program || gl.getProgramParameter(program, gl.DELETE_STATUS)) return;

        gl.clearColor(0, 0, 0, 1);
        gl.clear(gl.COLOR_BUFFER_BIT);
        gl.useProgram(program);
        gl.bindBuffer(gl.ARRAY_BUFFER, this.buffer);

        gl.uniform2f((program as any).resolution, this.canvas.width, this.canvas.height);
        gl.uniform1f((program as any).time, now * 1e-3);
        gl.uniform2f((program as any).move, this.mouseMove[0], this.mouseMove[1]);
        gl.uniform2f((program as any).touch, this.mouseCoords[0], this.mouseCoords[1]);
        gl.uniform1i((program as any).pointerCount, this.nbrOfPointers);
        gl.uniform2fv((program as any).pointers, this.pointerCoords);
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    }
}

// Pointer Handler class
class PointerHandler {
    private scale: number;
    private active = false;
    private pointers = new Map<number, [number, number]>();
    private lastCoords: [number, number] = [0, 0];
    private moves: [number, number] = [0, 0];

    constructor(element: HTMLCanvasElement, scale: number) {
        this.scale = scale;

        const map = (element: HTMLCanvasElement, scale: number, x: number, y: number): [number, number] =>
            [x * scale, element.height - y * scale];

        element.addEventListener('pointerdown', (e) => {
            this.active = true;
            this.pointers.set(e.pointerId, map(element, this.getScale(), e.clientX, e.clientY));
        });

        element.addEventListener('pointerup', (e) => {
            if (this.count === 1) {
                this.lastCoords = this.first;
            }
            this.pointers.delete(e.pointerId);
            this.active = this.pointers.size > 0;
        });

        element.addEventListener('pointerleave', (e) => {
            if (this.count === 1) {
                this.lastCoords = this.first;
            }
            this.pointers.delete(e.pointerId);
            this.active = this.pointers.size > 0;
        });

        element.addEventListener('pointermove', (e) => {
            if (!this.active) return;
            this.lastCoords = [e.clientX, e.clientY];
            this.pointers.set(e.pointerId, map(element, this.getScale(), e.clientX, e.clientY));
            this.moves = [this.moves[0] + e.movementX, this.moves[1] + e.movementY];
        });
    }

    getScale() {
        return this.scale;
    }

    updateScale(scale: number) {
        this.scale = scale;
    }

    get count() {
        return this.pointers.size;
    }

    get move() {
        return this.moves;
    }

    get coords() {
        return this.pointers.size > 0
            ? Array.from(this.pointers.values()).flat()
            : [0, 0];
    }

    get first() {
        return this.pointers.values().next().value || this.lastCoords;
    }
}

const defaultShaderSource = `#version 300 es
/*********
* made by Matthias Hurrle (@atzedent)
*
*	To explore strange new worlds, to seek out new life
*	and new civilizations, to boldly go where no man has
*	gone before.
*/
precision highp float;
out vec4 O;
uniform vec2 resolution;
uniform float time;
#define FC gl_FragCoord.xy
#define T time
#define R resolution
#define MN min(R.x,R.y)
// Returns a pseudo random number for a given point (white noise)
float rnd(vec2 p) {
  p=fract(p*vec2(12.9898,78.233));
  p+=dot(p,p+34.56);
  return fract(p.x*p.y);
}
// Returns a pseudo random number for a given point (value noise)
float noise(in vec2 p) {
  vec2 i=floor(p), f=fract(p), u=f*f*(3.-2.*f);
  float
  a=rnd(i),
  b=rnd(i+vec2(1,0)),
  c=rnd(i+vec2(0,1)),
  d=rnd(i+1.);
  return mix(mix(a,b,u.x),mix(c,d,u.x),u.y);
}
// Returns a pseudo random number for a given point (fractal noise)
float fbm(vec2 p) {
  float t=.0, a=1.; mat2 m=mat2(1.,-.5,.2,1.2);
  for (int i=0; i<5; i++) {
    t+=a*noise(p);
    p*=2.*m;
    a*=.5;
  }
  return t;
}
float clouds(vec2 p) {
	float d=1., t=.0;
	for (float i=.0; i<3.; i++) {
		float a=d*fbm(i*10.+p.x*.2+.2*(1.+i)*p.y+d+i*i+p);
		t=mix(t,d,a);
		d=a;
		p*=2./(i+1.);
	}
	return t;
}
void main(void) {
	vec2 uv=(FC-.5*R)/MN,st=uv*vec2(2,1);
	vec3 col=vec3(0);

	// "Linish" and Dreamy clouds: stretching x-axis a bit for a painted sky look
	float bg=clouds(vec2(st.x*0.8 + T*.15, -st.y + T*.05)); 
	uv*=1.-.3*(sin(T*.1)*.5+.5);
	
	// User's Custom Palette 
	vec3 verandaBlue = vec3(0.42, 0.69, 0.68); // #6BB1AD - galaxy feel
	vec3 darkGalaxy = vec3(0.05, 0.08, 0.25); // Dark depth behind blue
	vec3 cupidPink = vec3(0.90, 0.45, 0.56); // #E6748E
	vec3 rosePink = vec3(0.96, 0.55, 0.65); // Irregular pink mix
	vec3 lychee = vec3(0.93, 0.93, 0.86); // #EDECDB
	vec3 melon = vec3(0.90, 0.66, 0.66); // #E5A9A9
	
	// Irregular Galaxy gradients mixed with noise
	float nPattern = noise(st*2.0 + T*0.1);
	vec3 mixedBlue = mix(darkGalaxy, verandaBlue, nPattern * 0.7 + 0.3);
	vec3 mixedPink = mix(cupidPink, rosePink, nPattern);
	
	// Vertical sky grading + irregular noise wave for a dreamy linish blend
	float skyGradient = smoothstep(-0.6, 0.6, st.y + (nPattern * 0.4 - 0.2));
	vec3 baseSky = mix(mixedBlue, mixedPink, skyGradient);
	
	// Cloud shaping and density (reduced to ~10% coverage for very sparse clouds)
	float cloudMaskRaw = smoothstep(0.75, 1.0, bg); 
	
	// Irregular 20% to 85% transparency using a low-frequency noise
	float alphaVariation = mix(0.2, 0.85, noise(st*1.5 - T*0.2));
	float cloudMask = cloudMaskRaw * alphaVariation;
	
	// Cloud colors: Mix from Melon (edges/shadows) to Lychee (dense peaks)
    // Darkened slightly so they don't overpower white overlay text
	vec3 cloudColor = mix(melon * 0.8, lychee * 0.85, smoothstep(0.8, 1.0, bg));
	
	// Final Background mixing base sky with the translucent irregular clouds
	vec3 bgColor = mix(baseSky, cloudColor, cloudMask);
	
	for (float i=1.; i<12.; i++) {
		// Strict Right to Left motion:
		// We subtract time (T*.3) from the X axis and keep Y axis stable 
		// to enforce right-to-left horizontal wind.
		uv += .1 * cos(i * vec2(.1 + .01*i, .8) + i*i + vec2(-T*.3, 0.0) + vec2(.1*uv.x, 0.0));
		
		vec2 p=uv;
		float d=length(p);
		
		// Asteroids / Line lights explicitly changed to vibrant Cupid Pink / Rose glow
		// Cosine math simplified to ensure they stay pink and don't wash out to white
		vec3 streakColor = mix(cupidPink, rosePink, max(0.0, sin(i)));
		col += .001/d*(streakColor * 1.5 + 0.2);
		
		float b=noise(i+p+bg*1.731);
		col+=.001*b/length(max(p,vec2(b*p.x*.02,p.y)));
		
		// Mix lines softly into the dreamy environment
		col=mix(col, bgColor, d);
	}

	// Clamp the brightest spots to 0.85 instead of 1.0 to ensure 
    // foreground white text (#FFFFFF) stays 100% visible against the shader
	O=vec4(clamp(col, 0.0, 0.85),1);
}`;

// Reusable Shader Background Hook
const useShaderBackground = () => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const animationFrameRef = useRef<number>();
    const rendererRef = useRef<WebGLRenderer | null>(null);
    const pointersRef = useRef<PointerHandler | null>(null);

    const resize = () => {
        if (!canvasRef.current) return;

        const canvas = canvasRef.current;
        const dpr = Math.max(1, 0.5 * window.devicePixelRatio);

        canvas.width = window.innerWidth * dpr;
        canvas.height = window.innerHeight * dpr;

        if (rendererRef.current) {
            rendererRef.current.updateScale(dpr);
        }
    };

    const loop = (now: number) => {
        if (!rendererRef.current || !pointersRef.current) return;

        rendererRef.current.updateMouse(pointersRef.current.first);
        rendererRef.current.updatePointerCount(pointersRef.current.count);
        rendererRef.current.updatePointerCoords(pointersRef.current.coords);
        rendererRef.current.updateMove(pointersRef.current.move);
        rendererRef.current.render(now);
        animationFrameRef.current = requestAnimationFrame(loop);
    };

    useEffect(() => {
        if (!canvasRef.current) return;

        const canvas = canvasRef.current;
        const dpr = Math.max(1, 0.5 * window.devicePixelRatio);

        rendererRef.current = new WebGLRenderer(canvas, dpr, defaultShaderSource);
        pointersRef.current = new PointerHandler(canvas, dpr);

        rendererRef.current.setup();
        rendererRef.current.init();

        resize();

        if (rendererRef.current.test(defaultShaderSource) === null) {
            rendererRef.current.updateShader(defaultShaderSource);
        }

        loop(0);

        window.addEventListener('resize', resize);

        return () => {
            window.removeEventListener('resize', resize);
            if (animationFrameRef.current) {
                cancelAnimationFrame(animationFrameRef.current);
            }
            if (rendererRef.current) {
                rendererRef.current.reset();
            }
        };
    }, []);

    return canvasRef;
};

export default function OrbitalBackground({ className = "" }: { className?: string }) {
    const canvasRef = useShaderBackground();
    return (
        <canvas
            ref={canvasRef}
            className={`absolute inset-0 w-full h-full object-cover touch-none ${className}`}
            style={{ background: 'black', zIndex: 0 }}
        />
    );
}
