// JINDA CORE: prop.
// A hollow truncated icosahedron of M-carbon, about the size of a large coin.
// Growth rings in the lattice are a fingerprint of one consciousness: violet-blue
// for meditative crystallisation, green for integration, yellow-orange for
// intensity. They show only under polarised magnification. Heat makes them
// saturate, pulse, then flash chaotically. Damage reads as dark spiderweb
// fractures that break the ring geometry. Higher Point means deeper recursion:
// patterns inside patterns.
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { truncatedIcosahedron, polyhedronGeometry, edgeTubesGeometry } from '../lib/polyhedra.js';
import { GLSL_NOISE } from '../lib/noise.js';
import { FILIGREE, POINT } from '../canon/canon.js';

export const RING_GLSL = /* glsl */ `
uniform float uTime, uPoint, uThermal, uDamage, uPolarized, uRecursion, uSpokes;
uniform vec3 uNucleus, uSeedVec, uImpactA, uImpactB;
uniform sampler2D uHistory;
varying vec3 vObjPos;
${GLSL_NOISE}

// Growth rings: concentric shells around an off-centre nucleation point,
// warped by noise so each core is a unique contour map.
vec4 rings(vec3 p){
  vec3 q = p - uNucleus;
  q += 0.07 * vec3(fbm3(p*1.3+uSeedVec), fbm3(p*1.3+uSeedVec.yzx+7.1), fbm3(p*1.3+uSeedVec.zxy+3.3));
  q += 0.012 * vec3(snoise(p*11.0+uSeedVec));
  float freq = 16.0 + uPoint * 3.0;
  float rc = length(q) * freq;
  float idx = floor(rc);
  float f = fract(rc);
  // Early/late wood: soft rise, hard edge at the ring boundary.
  float band = smoothstep(0.0, 0.85, f) * (1.0 - smoothstep(0.9, 1.0, f));
  float edge = 1.0 - smoothstep(0.0, max(fwidth(rc)*1.5, 0.02), min(f, 1.0-f));
  vec3 col = texture2D(uHistory, vec2((mod(idx, 64.0)+0.5)/64.0, 0.5)).rgb;
  // Thin bright growth lines over dark carbon; colour lives in the lines.
  float lum = 0.03 + 0.12*band + 1.1*edge;
  // Recursion: patterns that reference patterns (Point 4+ and 8+).
  if (uRecursion > 1.5) {
    float rc2 = rc * 5.0 + snoise(p*9.0+uSeedVec)*1.2;
    float e2 = 1.0 - smoothstep(0.0, max(fwidth(rc2)*1.2, 0.02), min(fract(rc2), 1.0-fract(rc2)));
    lum += 0.22 * e2 * band;
  }
  if (uRecursion > 2.5) {
    float rc3 = length(p - uNucleus*-0.6) * freq * 3.1 + snoise(p*14.0)*0.6;
    float e3 = 1.0 - smoothstep(0.0, max(fwidth(rc3)*1.2, 0.02), min(fract(rc3), 1.0-fract(rc3)));
    lum += 0.12 * e3;
  }
  if (uRecursion > 3.5) {
    float rc4 = (length(q.xy)+length(q.yz)+length(q.zx)) * freq * 1.3;
    float e4 = 1.0 - smoothstep(0.0, max(fwidth(rc4)*1.2, 0.02), min(fract(rc4), 1.0-fract(rc4)));
    lum += 0.1 * e4;
  }
  return vec4(col, lum);
}

// Microfractures: spokes and partial concentric arcs radiating from an impact.
float crackWeb(vec3 p, vec3 impact, float extent){
  vec3 n = normalize(p);
  float d = acos(clamp(dot(n, impact), -1.0, 1.0));
  vec3 t1 = normalize(cross(impact, abs(impact.y) < 0.9 ? vec3(0,1,0) : vec3(1,0,0)));
  vec3 t2 = cross(impact, t1);
  float ang = atan(dot(n, t2), dot(n, t1));
  // Mostly straight spokes with a little jag, tapering with distance.
  float wob = snoise(n*3.0 + uSeedVec) * 0.12 + snoise(n*23.0) * 0.025;
  float s = abs(sin((ang + wob) * uSpokes * 0.5));
  float w = fwidth(s) * (1.2 + 2.5 * (1.0 - d / max(extent, 0.001)));
  float spoke = 1.0 - smoothstep(0.0, w + 0.002, s);
  // Concentric arcs only between some spokes, like a struck windscreen.
  float c = abs(sin(d * 26.0 + snoise(n*5.0+uSeedVec)*0.6));
  float arcs = (1.0 - smoothstep(0.0, fwidth(c)*1.4 + 0.002, c)) * step(0.35, snoise(n*6.0 + 11.0)) * step(d, extent*0.7);
  float fade = (1.0 - smoothstep(extent * 0.5, extent, d)) * step(0.001, extent);
  return max(spoke, arcs * 0.85) * fade;
}

float cracks(vec3 p){
  if (uDamage <= 0.001) return 0.0;
  float grow = uDamage * (1.0 + 0.6 * uThermal);
  float c = crackWeb(p, uImpactA, grow * 1.4);
  c = max(c, crackWeb(p, uImpactB, max(0.0, grow - 0.45) * 1.6));
  return clamp(c, 0.0, 1.0);
}

// Thermal signal: rhythmic pulse that accelerates into chaotic flashing.
float thermalPulse(){
  float rate = 0.8 + uThermal * 6.0;
  float rhythm = 0.5 + 0.5 * sin(uTime * rate * 6.2831);
  float chaos = step(0.5, snoise(vec3(uTime * 14.0, 0.0, 0.0)) * 0.5 + 0.5);
  float k = smoothstep(0.7, 0.95, uThermal);
  return mix(1.0 + uThermal * rhythm * 1.4, 0.3 + 2.4 * chaos, k);
}
`;

function historyTexture(rng, temperament) {
  // A life written in rings: a random walk between states, biased by
  // temperament (0 = meditative, 1 = intense).
  const cols = [FILIGREE.states.meditative.hex, FILIGREE.states.integrated.hex, FILIGREE.states.intense.hex].map((h) => new THREE.Color(h));
  const data = new Uint8Array(64 * 4);
  let s = rng.float(0, 2);
  for (let i = 0; i < 64; i++) {
    s += rng.gauss() * 0.45 + (temperament * 2 - s) * 0.18;
    s = Math.max(0, Math.min(2, s));
    const lo = Math.floor(s);
    const c = cols[lo].clone().lerp(cols[Math.min(2, lo + 1)], s - lo);
    data[i * 4] = c.r * 255;
    data[i * 4 + 1] = c.g * 255;
    data[i * 4 + 2] = c.b * 255;
    data[i * 4 + 3] = 255;
  }
  const t = new THREE.DataTexture(data, 64, 1, THREE.RGBAFormat);
  t.colorSpace = THREE.SRGBColorSpace;
  t.needsUpdate = true;
  return t;
}

// Shared by any generator that needs a core (the Jinda carries one).
export function buildCore(rng, { point = 7, thermal = 0, damage = 0, temperament = 0.4, polarized = 0 } = {}) {
  const poly = truncatedIcosahedron();
  const group = new THREE.Group();
  const v = (r) => new THREE.Vector3(...r.unitVector());
  const uniforms = {
    uTime: { value: 0 },
    uPoint: { value: point },
    uThermal: { value: thermal },
    uDamage: { value: damage },
    uPolarized: { value: polarized },
    uRecursion: { value: POINT.recursion(point) },
    uSpokes: { value: rng.int(5, 9) },
    uNucleus: { value: v(rng).multiplyScalar(rng.float(0.1, 0.45)) },
    uSeedVec: { value: new THREE.Vector3(rng.float(0, 100), rng.float(0, 100), rng.float(0, 100)) },
    // Bias the first impact toward camera so damage reads in the hero angle.
    uImpactA: { value: v(rng).add(new THREE.Vector3(0.3, 0.2, 1.4)).normalize() },
    uImpactB: { value: v(rng) },
    uHistory: { value: historyTexture(rng.fork('history'), temperament) },
  };

  const shellMat = new THREE.MeshPhysicalMaterial({
    color: 0x17181c,
    metalness: 0.35,
    roughness: 0.16,
    clearcoat: 1,
    clearcoatRoughness: 0.06,
    iridescence: 0.75,
    iridescenceIOR: 1.7,
    iridescenceThicknessRange: [180, 520],
    flatShading: true,
    transparent: true,
    opacity: 0.94 - 0.28 * polarized,
  });
  shellMat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, uniforms);
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vObjPos;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvObjPos = position;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>\n${RING_GLSL}`)
      .replace(
        '#include <color_fragment>',
        `#include <color_fragment>
        vec4 rg = rings(vObjPos);
        float ck = cracks(vObjPos);
        // In natural light the rings are a faint tonal grain in the carbon.
        diffuseColor.rgb *= 0.85 + 0.3 * rg.a * (1.0 - uPolarized);
        diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.0), ck * 0.92);`,
      )
      .replace(
        '#include <emissivemap_fragment>',
        `#include <emissivemap_fragment>
        float pol = uPolarized;
        float th = thermalPulse();
        vec3 hue = rg.rgb;
        float sat = 1.0 + uThermal * 0.9;
        float l = dot(hue, vec3(0.333));
        hue = clamp(mix(vec3(l), hue, sat), 0.0, 4.0);
        vec3 ringGlow = hue * rg.a * (0.04 + 1.6 * pol) * th;
        ringGlow *= 1.0 - ck;
        // Past the threshold, heat leaks through fractures (POWER §9A).
        ringGlow += vec3(1.0, 0.42, 0.12) * ck * smoothstep(0.6, 0.95, uThermal) * 2.0;
        totalEmissiveRadiance += ringGlow;`,
      );
  };
  const shell = new THREE.Mesh(polyhedronGeometry(poly), shellMat);
  shell.castShadow = true;
  shell.renderOrder = 2;
  group.add(shell);

  const edgeMat = new THREE.MeshPhysicalMaterial({
    color: 0x2a2b30,
    metalness: 0.9,
    roughness: 0.22,
    emissive: new THREE.Color(FILIGREE.states.integrated.hex),
    emissiveIntensity: 0.0,
  });
  const edges = new THREE.Mesh(edgeTubesGeometry(poly, 0.012, 1.004), edgeMat);
  group.add(edges);

  // Matryoshka recursion: nested lattices inside the hollow, one per level.
  const nested = [];
  const depth = POINT.recursion(point);
  const innerMat = new THREE.MeshBasicMaterial({
    color: new THREE.Color(FILIGREE.states.meditative.hex),
    transparent: true,
    opacity: 0.3,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  for (let k = 1; k <= depth; k++) {
    const s = Math.pow(0.62, k);
    const m = new THREE.Mesh(edgeTubesGeometry(poly, 0.0045 / s, 1), innerMat);
    m.scale.setScalar(s);
    m.rotation.set(rng.float(0, 6.28), rng.float(0, 6.28), rng.float(0, 6.28));
    nested.push(m);
    group.add(m);
  }

  // The fold itself: the interface the walls are holding open.
  const foldMat = new THREE.ShaderMaterial({
    uniforms: { uTime: uniforms.uTime, uThermal: uniforms.uThermal, uPolarized: uniforms.uPolarized },
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    vertexShader: /* glsl */ `
      varying vec3 vN; varying vec3 vP;
      void main(){ vN = normalize(normalMatrix*normal); vP = position;
        gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
    fragmentShader: /* glsl */ `
      uniform float uTime, uThermal, uPolarized; varying vec3 vN; varying vec3 vP;
      ${GLSL_NOISE}
      void main(){
        float facing = abs(vN.z);
        float swirl = fbm3(vP*3.0 + vec3(0.0, uTime*0.15, uTime*0.07));
        vec3 c = mix(vec3(0.22,0.18,0.55), vec3(0.75,0.9,1.0), smoothstep(-0.2,0.6,swirl));
        float a = pow(facing, 2.5) * (0.25 + 0.5*uPolarized) * (1.0 + uThermal*1.5);
        gl_FragColor = vec4(c*a, a);
      }`,
  });
  const fold = new THREE.Mesh(new THREE.IcosahedronGeometry(0.42, 4), foldMat);
  group.add(fold);

  const api = {
    group,
    uniforms,
    set(key, value) {
      if (key === 'thermal') uniforms.uThermal.value = value;
      if (key === 'damage') uniforms.uDamage.value = value;
      if (key === 'polarized') uniforms.uPolarized.value = value;
    },
    update(t) {
      uniforms.uTime.value = t;
      const pol = uniforms.uPolarized.value;
      const th = uniforms.uThermal.value;
      innerMat.opacity = (0.05 + 0.3 * pol) * (1 + th * Math.max(0, Math.sin(t * (2 + th * 18))) * 0.8);
      edgeMat.emissiveIntensity = 0.15 * pol;
      nested.forEach((m, i) => {
        m.rotation.y += 0.0008 * (i + 1);
      });
    },
  };
  return api;
}

export default {
  id: 'core',
  title: 'Jinda Core',
  category: 'Props',
  blurb: 'M-carbon buckyball. Growth-ring filigree, thermal signal, fractures, Point recursion.',
  canon: ['POWER §1 Core Composition', 'POWER §2 Core Filigree', 'POWER §5 Point Rating', 'POWER §9A Thermal Limitation'],
  params: [
    { key: 'seed', type: 'seed', default: 'JURI' },
    { key: 'point', label: 'Point', type: 'range', min: 1, max: 9, step: 1, default: 7 },
    { key: 'temperament', label: 'Ring history', type: 'range', min: 0, max: 1, step: 0.01, default: 0.45, hint: 'meditative → intense' },
    { key: 'light', label: 'Light', type: 'select', options: ['Natural', 'Polarised magnification', 'Diviner sense'], default: 'Polarised magnification' },
    { key: 'thermal', label: 'Thermal stress', type: 'range', min: 0, max: 1, step: 0.01, default: 0.1, live: true },
    { key: 'damage', label: 'Lattice damage', type: 'range', min: 0, max: 1, step: 0.01, default: 0.0, live: true },
    { key: 'turn', label: 'Turntable', type: 'toggle', default: true, live: true },
  ],
  presets: {
    Juri: { seed: 'JURI', point: 7, temperament: 0.62, damage: 0.28, thermal: 0.2 },
    Chiron: { seed: 'CHIRON', point: 8, temperament: 0.2, damage: 0.8, thermal: 0.55 },
    'Extractor (P2)': { seed: 'PERDITION-5', point: 2, temperament: 0.5, damage: 0.1, thermal: 0.05 },
    'Virtuous (P9)': { seed: 'RHEA', point: 9, temperament: 0.05, damage: 0, thermal: 0 },
    'Thermal overload': { seed: 'JURI', point: 7, temperament: 0.62, damage: 0.45, thermal: 0.96 },
  },
  camera: { position: [0.2, 0.09, 0.42], target: [0, -0.002, 0], lens: 100 },

  build({ stage, rng, params }) {
    const { scene, renderer } = stage;
    const pmrem = new THREE.PMREMGenerator(renderer);
    const env = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    pmrem.dispose();
    const root = new THREE.Group();
    const pol = params.light === 'Polarised magnification' ? 1 : 0;
    const diviner = params.light === 'Diviner sense';
    scene.environment = diviner ? null : env;
    scene.background = new THREE.Color(pol ? 0x050507 : diviner ? 0x020203 : 0x121316);

    const core = buildCore(rng.fork('core'), { ...params, polarized: pol });
    const R = FILIGREE.coreDiameterMm / 2000; // metres
    core.group.scale.setScalar(R);
    root.add(core.group);

    // Product-shot lighting for natural; near-darkness under polarisation.
    const key = new THREE.DirectionalLight(0xfff1dc, pol ? 0.15 : diviner ? 0 : 2.2);
    key.position.set(0.3, 0.5, 0.4);
    const rim = new THREE.DirectionalLight(0x9fb4ff, pol ? 0.3 : diviner ? 0 : 1.4);
    rim.position.set(-0.4, 0.2, -0.5);
    root.add(key, rim, new THREE.AmbientLight(0xffffff, diviner ? 0 : 0.05));

    // Plinth so the prop has a world to sit in.
    const plinth = new THREE.Mesh(
      new THREE.CylinderGeometry(0.022, 0.024, 0.006, 64),
      new THREE.MeshPhysicalMaterial({ color: 0x0c0c0e, roughness: pol ? 0.8 : 0.4, metalness: 0.0, envMapIntensity: pol ? 0.05 : 0.6 }),
    );
    plinth.position.y = -R - 0.003;
    plinth.receiveShadow = true;
    if (!diviner) root.add(plinth);

    // Diviner sense: not the object but its presence. The field radiates
    // spherically from the core with decreasing coherence (POWER §2.5).
    let halo = null;
    if (diviner) {
      core.group.visible = true;
      halo = new THREE.Mesh(
        new THREE.SphereGeometry(1, 64, 32),
        new THREE.ShaderMaterial({
          uniforms: { uTime: { value: 0 }, uPoint: { value: params.point } },
          transparent: true,
          depthWrite: false,
          blending: THREE.AdditiveBlending,
          side: THREE.BackSide,
          vertexShader: `varying vec3 vN; varying vec3 vV; void main(){ vec4 mv = modelViewMatrix*vec4(position,1.0); vN = normalize(normalMatrix*normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix*mv; }`,
          fragmentShader: `uniform float uTime, uPoint; varying vec3 vN; varying vec3 vV;
            void main(){ float f = pow(abs(dot(vN, vV)), 3.0);
              float beat = 0.75 + 0.25*sin(uTime*1.3);
              float shells = 0.5 + 0.5*sin(f*uPoint*6.0 - uTime*2.0);
              vec3 c = mix(vec3(0.35,0.3,0.7), vec3(0.85,0.95,1.0), f);
              float a = f * beat * (0.35 + 0.25*shells);
              gl_FragColor = vec4(c*a, a); }`,
        }),
      );
      halo.scale.setScalar(0.03 + params.point * 0.006);
      root.add(halo);
    }

    let spin = params.turn;
    return {
      object: root,
      update(t) {
        core.update(t);
        if (spin) core.group.rotation.y = t * 0.25;
        if (halo) halo.material.uniforms.uTime.value = t;
      },
      set(key, value) {
        if (key === 'turn') spin = value;
        else core.set(key, value);
      },
      hud() {
        const p = params.point;
        return [`Point ${p} · ${POINT.levels[p].band} · recursion ${POINT.recursion(p)}`, `Ø ${FILIGREE.coreDiameterMm} mm (previz)`];
      },
      dispose() {
        env.dispose();
      },
    };
  },
};
