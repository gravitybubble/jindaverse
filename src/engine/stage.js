// The Stage is the camera department: one renderer, one lens, one frame.
// Everything a generator builds is seen through a real focal length on a
// Super 35 gauge and framed at a delivery aspect ratio, so what you develop
// here is a shot, not a viewport.
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';

export const ASPECTS = {
  '2.39': 2.39,
  '1.85': 1.85,
  '16:9': 16 / 9,
  '4:3': 4 / 3,
};

const SUPER35_WIDTH_MM = 24.89;

const FilmShader = {
  uniforms: {
    tDiffuse: { value: null },
    uTime: { value: 0 },
    uGrain: { value: 0.06 },
    uVignette: { value: 0.35 },
    uAberration: { value: 0.0007 },
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }
  `,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse; uniform float uTime, uGrain, uVignette, uAberration;
    varying vec2 vUv;
    float hash(vec2 p){ vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
    void main(){
      vec2 d = vUv - 0.5;
      float r2 = dot(d,d);
      vec2 off = d * r2 * uAberration * 40.0;
      vec3 c;
      c.r = texture2D(tDiffuse, vUv + off).r;
      c.g = texture2D(tDiffuse, vUv).g;
      c.b = texture2D(tDiffuse, vUv - off).b;
      c *= 1.0 - uVignette * smoothstep(0.08, 0.55, r2);
      float g = hash(gl_FragCoord.xy + floor(uTime * 24.0) * 97.0) - 0.5;
      float lum = dot(c, vec3(0.299,0.587,0.114));
      c += g * uGrain * (1.0 - lum * 0.6);
      gl_FragColor = vec4(c, 1.0);
    }
  `,
};

export class Stage {
  constructor(host) {
    this.host = host;
    this.aspectName = '2.39';
    this.lensMm = 40;
    this.renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.0;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    host.appendChild(this.renderer.domElement);

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(30, 2.39, 0.01, 4000);
    this.camera.filmGauge = SUPER35_WIDTH_MM;
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.08;

    this.composer = new EffectComposer(this.renderer);
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    this.bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.6, 0.5, 0.82);
    this.composer.addPass(this.bloom);
    this.composer.addPass(new OutputPass());
    this.film = new ShaderPass(FilmShader);
    this.composer.addPass(this.film);

    this.updaters = new Set();
    this.clock = new THREE.Clock();
    this.time = 0;
    this.paused = false;
    this.onFrame = null;

    new ResizeObserver(() => this.resize()).observe(host);
    this.resize();
    this.renderer.setAnimationLoop(() => this.tick());
  }

  setAspect(name) {
    this.aspectName = name;
    this.resize();
  }

  setLens(mm) {
    this.lensMm = mm;
    this.camera.setFocalLength(mm);
  }

  setLook({ bloom, grain, vignette, exposure } = {}) {
    if (bloom !== undefined) this.bloom.strength = bloom;
    if (grain !== undefined) this.film.uniforms.uGrain.value = grain;
    if (vignette !== undefined) this.film.uniforms.uVignette.value = vignette;
    if (exposure !== undefined) this.renderer.toneMappingExposure = exposure;
  }

  // Fit the frame inside the host at the chosen aspect. The canvas *is* the
  // frame, so a captured still is exactly what was composed.
  resize() {
    const { clientWidth: W, clientHeight: H } = this.host;
    if (!W || !H) return;
    const a = ASPECTS[this.aspectName];
    let w = W;
    let h = Math.round(W / a);
    if (h > H) {
      h = H;
      w = Math.round(H * a);
    }
    this.renderer.setSize(w, h);
    this.composer.setSize(w, h);
    this.bloom.resolution.set(w, h);
    this.camera.aspect = a;
    this.camera.setFocalLength(this.lensMm);
    this.camera.updateProjectionMatrix();
    this.frameRect = { w, h };
    this.renderer.domElement.style.width = `${w}px`;
    this.renderer.domElement.style.height = `${h}px`;
  }

  // A generator's suggested camera: position, look-at target, focal length.
  frame({ position, target, lens }) {
    if (lens) this.setLens(lens);
    this.camera.position.set(...position);
    this.controls.target.set(...target);
    this.camera.near = Math.max(0.005, this.camera.position.distanceTo(this.controls.target) / 500);
    this.camera.updateProjectionMatrix();
    this.controls.update();
  }

  clear() {
    for (const child of [...this.scene.children]) {
      this.scene.remove(child);
      disposeDeep(child);
    }
    this.updaters.clear();
    this.scene.background = new THREE.Color(0x0b0c0e);
    this.scene.fog = null;
    this.scene.environment = null;
    this.time = 0;
  }

  tick() {
    const dt = Math.min(this.clock.getDelta(), 1 / 20);
    if (!this.paused) {
      this.time += dt;
      for (const fn of this.updaters) fn(this.time, dt);
    }
    this.film.uniforms.uTime.value = this.time;
    this.controls.update();
    this.composer.render();
    if (this.onFrame) this.onFrame();
  }

  // Render a still at delivery width (default 3840 px wide) with the slate
  // burned into the lower edge.
  capture(slateLines, filename, width = 3840) {
    const a = ASPECTS[this.aspectName];
    const w = width;
    const h = Math.round(width / a);
    const prev = { ...this.frameRect, pr: this.renderer.getPixelRatio() };
    this.renderer.setPixelRatio(1);
    this.renderer.setSize(w, h, false);
    this.composer.setPixelRatio?.(1);
    this.composer.setSize(w, h);
    this.bloom.resolution.set(w, h);
    this.composer.render();
    const src = this.renderer.domElement;
    const out = document.createElement('canvas');
    out.width = w;
    out.height = h;
    const g = out.getContext('2d');
    g.drawImage(src, 0, 0, w, h);
    if (slateLines) burnSlate(g, w, h, slateLines);
    this.renderer.setPixelRatio(prev.pr);
    this.composer.setPixelRatio?.(prev.pr);
    this.resize();
    const url = out.toDataURL('image/png');
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    return url;
  }
}

function burnSlate(g, w, h, lines) {
  const s = w / 1920;
  g.save();
  g.font = `${Math.round(13 * s)}px ui-monospace, Menlo, monospace`;
  g.textBaseline = 'bottom';
  g.fillStyle = 'rgba(236,231,220,0.82)';
  const pad = 22 * s;
  g.fillText(lines.join('   ·   '), pad, h - pad);
  g.restore();
}

export function disposeDeep(obj) {
  obj.traverse?.((o) => {
    o.geometry?.dispose?.();
    const m = o.material;
    if (m) {
      for (const mat of Array.isArray(m) ? m : [m]) {
        for (const v of Object.values(mat)) if (v && v.isTexture) v.dispose();
        if (mat.uniforms) for (const u of Object.values(mat.uniforms)) if (u.value && u.value.isTexture) u.value.dispose();
        mat.dispose();
      }
    }
  });
}
