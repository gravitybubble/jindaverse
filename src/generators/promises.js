// THE PROMISES ("the Crates"): set.
// Underground DivCorps breeding facility, built by Domo Kovar. A 20×20×20
// lattice: twenty levels, each a 20×20 grid of dwellings, each level under its
// own projected sky. Residents know they are underground; the sky is an
// amenity, not a deception, so the projector seams are honest and visible.
// Everything is Relicrete: Asylum tailings pressed into panels, which Jinda
// hear as a continuous hum (Juri: "a continuous low-grade scream").
import * as THREE from 'three';
import { mergeGeometries } from '../lib/polyhedra.js';
import { GLSL_NOISE } from '../lib/noise.js';
import { PROMISES, MATERIALS } from '../canon/canon.js';

const N = 20; // matrix dimension (canon)
const UNIT = 6; // dwelling footprint, metres (previz)
const PITCH = 10.5; // unit + street (4.5 m lanes)
const CRATE_H = 3.4;
const LEVEL_H = 11; // slab to slab: room for a sky
const SLAB = 1.2;
const SPAN = N * PITCH;

const SKIES = {
  Morning: { top: '#7fa6d6', low: '#e8d6c0', sun: [0.3, 0.4], cloud: 0.5, stars: 0, k: 1 },
  Midday: { top: '#5b8fd1', low: '#cfe0f0', sun: [0.0, 0.0], cloud: 0.35, stars: 0, k: 1.15 },
  'Golden hour': { top: '#5d6a9a', low: '#f0a46a', sun: [-0.4, 0.3], cloud: 0.6, stars: 0, k: 0.9 },
  Overcast: { top: '#9aa3ab', low: '#c2c4c2', sun: [0.0, 0.0], cloud: 1.0, stars: 0, k: 0.75 },
  'Night program': { top: '#0b1024', low: '#1b2140', sun: [0.0, 0.0], cloud: 0.15, stars: 1, k: 0.25 },
};

function relicreteTexture(rng) {
  const S = 256;
  const c = document.createElement('canvas');
  c.width = c.height = S;
  const g = c.getContext('2d');
  g.fillStyle = '#7d766b';
  g.fillRect(0, 0, S, S);
  // pressed tailings: dense aggregate speckle
  for (let i = 0; i < 9000; i++) {
    const v = rng.float(80, 160);
    const w = rng.float(0, 1);
    g.fillStyle = `rgba(${v + w * 18},${v + w * 8},${v - w * 6},${rng.float(0.15, 0.6)})`;
    g.fillRect(rng.float(0, S), rng.float(0, S), rng.float(0.6, 2.4), rng.float(0.6, 2.4));
  }
  // flecks of dimensional mineral: faint, iridescent
  for (let i = 0; i < 140; i++) {
    const h = rng.float(200, 300);
    g.fillStyle = `hsla(${h},70%,70%,${rng.float(0.25, 0.55)})`;
    g.fillRect(rng.float(0, S), rng.float(0, S), 1.2, 1.2);
  }
  // panel seams
  g.strokeStyle = 'rgba(30,28,25,0.55)';
  g.lineWidth = 2;
  g.strokeRect(1, 1, S - 2, S - 2);
  g.beginPath();
  g.moveTo(S / 2, 0);
  g.lineTo(S / 2, S);
  g.stroke();
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

// World-space box mapping so the panel texture tiles at real scale.
const BOX_UV_GLSL = {
  vert: 'varying vec3 vWPos; varying vec3 vWNorm;',
  vertMain: `
    #ifdef USE_INSTANCING
      vWPos = (modelMatrix * instanceMatrix * vec4(transformed, 1.0)).xyz;
      vWNorm = normalize(mat3(modelMatrix * instanceMatrix) * objectNormal);
    #else
      vWPos = (modelMatrix * vec4(transformed, 1.0)).xyz;
      vWNorm = normalize(mat3(modelMatrix) * objectNormal);
    #endif`,
};

export default {
  id: 'promises',
  title: 'The Promises',
  category: 'Sets',
  blurb: 'Kovar\'s 20×20×20 Relicrete lattice. Projected skies. Jinda hear the walls.',
  canon: ['GLOSSARY The Promises (structure, Relicrete, address format)', 'BIBLE Episode 6 "Promises"'],
  notes: [
    'Unit size, street width and level height are previz values. Canon fixes only the 20×20×20 matrix, the projected skies and the Relicrete.',
    'The white block at each level\'s centre is a DivCorps testing station (children are tested at five or six). An interpretation, not canon.',
  ],
  params: [
    { key: 'seed', type: 'seed', default: 'KOVAR' },
    { key: 'site', label: 'Site code', type: 'select', options: ['K1', 'K4', 'K7', 'B2', 'H9'], default: 'K7' },
    { key: 'level', label: 'Street level', type: 'range', min: 1, max: 20, step: 1, default: 12 },
    { key: 'sky', label: 'Sky program', type: 'select', options: Object.keys(SKIES), default: 'Morning' },
    { key: 'broken', label: 'One level\'s sky failing', type: 'toggle', default: true },
    { key: 'perception', label: 'Perception', type: 'select', options: ['Human', 'Jinda (Relicrete hum)'], default: 'Human', live: true },
    { key: 'occupancy', label: 'Occupancy (lit windows)', type: 'range', min: 0, max: 1, step: 0.01, default: 0.7 },
    { key: 'residents', label: 'Residents', type: 'toggle', default: true },
  ],
  presets: {
    'Section, morning': { seed: 'KOVAR', sky: 'Morning', perception: 'Human' },
    'Night program': { seed: 'KOVAR', sky: 'Night program', occupancy: 0.85 },
    'Juri reads the walls': { seed: 'KOVAR', sky: 'Golden hour', perception: 'Jinda (Relicrete hum)' },
  },
  camera: { position: [SPAN * 1.7, LEVEL_H * N * 0.62, SPAN * 2.2], target: [SPAN * 0.45, LEVEL_H * N * 0.47, SPAN * 0.5], lens: 28 },

  build({ stage, rng, params }) {
    const root = new THREE.Group();
    const sky = SKIES[params.sky];
    const tex = relicreteTexture(rng.fork('relicrete'));
    const hum = { value: params.perception.startsWith('Jinda') ? 1 : 0 };
    const time = { value: 0 };
    const skyTop = new THREE.Color(sky.top);

    const relicrete = new THREE.MeshStandardMaterial({ map: tex, color: 0xffffff, roughness: 0.92, metalness: 0 });
    relicrete.onBeforeCompile = (sh) => {
      sh.uniforms.uHum = hum;
      sh.uniforms.uTime = time;
      sh.uniforms.uSkyCol = { value: skyTop };
      sh.uniforms.uSkyK = { value: sky.k };
      sh.vertexShader = sh.vertexShader
        .replace('#include <common>', `#include <common>\n${BOX_UV_GLSL.vert}`)
        .replace('#include <worldpos_vertex>', `#include <worldpos_vertex>\n${BOX_UV_GLSL.vertMain}`);
      sh.fragmentShader = sh.fragmentShader
        .replace('#include <common>', `#include <common>\nuniform float uHum, uTime, uSkyK; uniform vec3 uSkyCol; ${BOX_UV_GLSL.vert}\n${GLSL_NOISE}`)
        .replace(
          '#include <map_fragment>',
          `vec3 an = abs(vWNorm);
           vec2 buv = an.y > 0.5 ? vWPos.xz : (an.x > 0.5 ? vWPos.zy : vWPos.xy);
           vec4 texelColor = texture2D(map, buv / 3.0);
           diffuseColor *= texelColor;`,
        )
        .replace(
          '#include <emissivemap_fragment>',
          `#include <emissivemap_fragment>
           // Sky fill: each level is lit by the panel above it.
           totalEmissiveRadiance += diffuseColor.rgb * uSkyCol * uSkyK * (0.22 + 0.4 * max(vWNorm.y, 0.0)) * (1.0 - uHum);
           // The hum: Relicrete as Jinda perceive it. Continuous, low,
           // everywhere: thin pressure fronts crawling through every panel.
           diffuseColor.rgb *= 1.0 - 0.75 * uHum;
           float ph = vWPos.y * 2.3 + dot(vWPos.xz, vec2(0.11, 0.07)) - uTime * 1.6 + snoise(vWPos * 0.04) * 2.0;
           float fronts = pow(0.5 + 0.5 * sin(ph), 14.0);
           float under = 0.5 + 0.5 * sin(ph * 0.27 + 1.7);
           totalEmissiveRadiance += vec3(0.5, 0.38, 1.0) * uHum * (0.05 + 0.9 * fronts * (0.4 + 0.6 * under));`,
        );
    };

    // ---------- crates ----------
    const cr = rng.fork('crates');
    const crateGeo = new THREE.BoxGeometry(UNIT, CRATE_H, UNIT).translate(0, CRATE_H / 2, 0);
    const units = [];
    for (let lv = 0; lv < N; lv++) {
      for (let c = 0; c < N; c++) {
        for (let r = 0; r < N; r++) {
          // The centre 2×2 of each level is the testing station.
          if (c >= 9 && c <= 10 && r >= 9 && r <= 10) continue;
          units.push({ lv, c, r });
        }
      }
    }
    const crates = new THREE.InstancedMesh(crateGeo, relicrete, units.length);
    const winGeo = new THREE.PlaneGeometry(1.6, 1.1);
    const doorGeo = new THREE.PlaneGeometry(1.1, 2.2);
    const winMat = new THREE.MeshBasicMaterial({ color: 0xffd9a3, toneMapped: false });
    const winOff = new THREE.MeshStandardMaterial({ color: 0x1a1a1c, roughness: 0.3, metalness: 0.4 });
    const doorMat = new THREE.MeshStandardMaterial({ color: 0x2a2724, roughness: 0.8 });
    const lit = units.filter(() => cr.chance(params.occupancy));
    const winsOn = new THREE.InstancedMesh(winGeo, winMat, lit.length);
    const litSet = new Set(lit);
    const winsOffArr = units.filter((u) => !litSet.has(u));
    const winsOff = new THREE.InstancedMesh(winGeo, winOff, Math.max(1, winsOffArr.length));
    const doors = new THREE.InstancedMesh(doorGeo, doorMat, units.length);
    const addOns = [];
    const m4 = new THREE.Matrix4();
    const tint = new THREE.Color();
    const place = (u) => new THREE.Vector3(u.c * PITCH + PITCH / 2, u.lv * LEVEL_H + SLAB, u.r * PITCH + PITCH / 2);
    units.forEach((u, i) => {
      const p = place(u);
      // Rows pair up across a front street (doors and windows facing each
      // other); the lanes between pairs are back alleys.
      u.face = u.r % 2 ? -1 : 1;
      m4.makeRotationY(u.face > 0 ? 0 : Math.PI).setPosition(p);
      crates.setMatrixAt(i, m4);
      // panel batches differ slightly: tailings from different shafts
      tint.setHSL(0.08 + cr.float(-0.02, 0.02), cr.float(0.04, 0.12), cr.float(0.42, 0.56));
      crates.setColorAt(i, tint);
      m4.makeRotationY(u.face > 0 ? 0 : Math.PI).setPosition(p.x - 1.3 * u.face, p.y + 1.1, p.z + (UNIT / 2 + 0.02) * u.face);
      doors.setMatrixAt(i, m4);
      // Residents personalise: rooftop add-ons on about a third of units.
      if (cr.chance(0.32)) addOns.push({ p, w: cr.float(1.2, 3), h: cr.float(0.8, 2.2), d: cr.float(1.2, 3), x: cr.float(-1.4, 1.4), z: cr.float(-1.4, 1.4), green: cr.chance(0.4) });
    });
    const winM = (u) => {
      const p = place(u);
      return new THREE.Matrix4().makeRotationY(u.face > 0 ? 0 : Math.PI).setPosition(p.x + 1.2 * u.face, p.y + 2.0, p.z + (UNIT / 2 + 0.02) * u.face);
    };
    lit.forEach((u, i) => winsOn.setMatrixAt(i, winM(u)));
    winsOffArr.forEach((u, i) => winsOff.setMatrixAt(i, winM(u)));
    for (const m of [crates, winsOn, winsOff, doors]) {
      m.castShadow = m === crates;
      m.receiveShadow = true;
      root.add(m);
    }
    if (addOns.length) {
      const plantMat = new THREE.MeshStandardMaterial({ color: 0x4f6b3a, roughness: 0.9 });
      const boxG = new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0);
      for (const [mat, list] of [[relicrete, addOns.filter((a) => !a.green)], [plantMat, addOns.filter((a) => a.green)]]) {
        const im = new THREE.InstancedMesh(boxG, mat, Math.max(1, list.length));
        list.forEach((a, i) => {
          m4.compose(new THREE.Vector3(a.p.x + a.x, a.p.y + CRATE_H, a.p.z + a.z), new THREE.Quaternion(), new THREE.Vector3(a.w, a.green ? 0.5 : a.h, a.d));
          im.setMatrixAt(i, m4);
        });
        root.add(im);
      }
    }

    // ---------- slabs, columns, testing stations, outer walls ----------
    const struct = [];
    for (let lv = 0; lv <= N; lv++) {
      struct.push(new THREE.BoxGeometry(SPAN, SLAB, SPAN).translate(SPAN / 2, lv * LEVEL_H + SLAB / 2 - (lv === N ? 0 : 0), SPAN / 2));
    }
    // Service cores every five units: stair and lift shafts.
    for (let c = 0; c <= N; c += 5) {
      for (let r = 0; r <= N; r += 5) {
        struct.push(new THREE.BoxGeometry(2.4, LEVEL_H * N, 2.4).translate(c * PITCH, (LEVEL_H * N) / 2, r * PITCH));
      }
    }
    // Back and side walls of the excavation. The front and the near side are
    // left open: this is a section.
    struct.push(new THREE.BoxGeometry(SPAN + 20, LEVEL_H * N + 30, 6).translate(SPAN / 2, (LEVEL_H * N) / 2, -3));
    struct.push(new THREE.BoxGeometry(6, LEVEL_H * N + 30, SPAN + 20).translate(-3, (LEVEL_H * N) / 2, SPAN / 2));
    const structure = new THREE.Mesh(mergeGeometries(struct.map((g) => g.toNonIndexed())), relicrete);
    structure.receiveShadow = true;
    structure.castShadow = true;
    root.add(structure);

    const testMat = new THREE.MeshStandardMaterial({ color: 0xe9e7e1, roughness: 0.35, metalness: 0.05 });
    const stationGeo = new THREE.BoxGeometry(PITCH * 2 - 1, CRATE_H * 1.8, PITCH * 2 - 1).translate(0, (CRATE_H * 1.8) / 2, 0);
    const stations = new THREE.InstancedMesh(stationGeo, testMat, N);
    for (let lv = 0; lv < N; lv++) {
      m4.makeTranslation(10 * PITCH, lv * LEVEL_H + SLAB, 10 * PITCH);
      stations.setMatrixAt(lv, m4);
    }
    root.add(stations);
    // Hedron mark on the station: the call-and-response hands, abstracted to
    // two converging bars.
    const markMat = new THREE.MeshBasicMaterial({ color: 0xd9a441, toneMapped: false });
    const mark = new THREE.InstancedMesh(new THREE.PlaneGeometry(0.35, 2.4), markMat, N * 2);
    for (let lv = 0; lv < N; lv++) {
      for (const s of [-1, 1]) {
        m4.compose(
          new THREE.Vector3(10 * PITCH + s * 0.45, lv * LEVEL_H + SLAB + CRATE_H * 1.1, 10 * PITCH + PITCH - 0.48),
          new THREE.Quaternion().setFromEuler(new THREE.Euler(0, 0, s * 0.28)),
          new THREE.Vector3(1, 1, 1),
        );
        mark.setMatrixAt(lv * 2 + (s > 0 ? 1 : 0), m4);
      }
    }
    root.add(mark);

    // ---------- projected skies ----------
    const brokenLevel = params.broken ? rng.fork('broken').int(3, N - 3) : -1;
    const skyMat = new THREE.ShaderMaterial({
      uniforms: {
        uTime: time,
        uTop: { value: new THREE.Color(sky.top) },
        uLow: { value: new THREE.Color(sky.low) },
        uSun: { value: new THREE.Vector2(...sky.sun) },
        uCloud: { value: sky.cloud },
        uStars: { value: sky.stars },
        uK: { value: sky.k },
        uHum: hum,
        uBroken: { value: brokenLevel },
      },
      side: THREE.DoubleSide,
      toneMapped: false,
      vertexShader: /* glsl */ `
        attribute float aLevel; varying vec2 vUv; varying float vLevel;
        void main(){ vUv = uv; vLevel = aLevel; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
      fragmentShader: /* glsl */ `
        uniform float uTime, uCloud, uStars, uK, uHum, uBroken; uniform vec3 uTop, uLow; uniform vec2 uSun;
        varying vec2 vUv; varying float vLevel;
        ${GLSL_NOISE}
        void main(){
          vec2 p = vUv * 2.0 - 1.0;
          float r = length(p);
          // A ceiling pretending to be a dome: zenith in the middle, horizon at the edges.
          vec3 c = mix(uTop, uLow, smoothstep(0.2, 1.25, r));
          float sd = length(p - uSun);
          c += vec3(1.0, 0.95, 0.85) * (exp(-sd * 18.0) * 2.0 + exp(-sd * 3.0) * 0.18) * (1.0 - uStars);
          float cl = fbm3(vec3(p * 2.2 + vec2(uTime * 0.01, 0.0), vLevel * 3.1));
          c = mix(c, mix(vec3(1.0), uLow, 0.3), smoothstep(0.05, 0.55, cl) * uCloud * 0.8);
          float st = step(0.996, fract(sin(dot(floor(vUv * 900.0), vec2(12.9898, 78.233))) * 43758.5453));
          c += st * uStars * 0.9;
          // Projector seams: an amenity, honestly built.
          vec2 g = abs(fract(vUv * 6.0) - 0.5);
          float seam = 1.0 - smoothstep(0.0, 0.004, 0.5 - max(g.x, g.y));
          c *= 1.0 - seam * 0.35;
          c *= uK;
          // One level's program is failing: banding, dropouts, a stuck frame.
          if (abs(vLevel - uBroken) < 0.5) {
            float band = step(0.5, fract(vUv.y * 40.0 + floor(uTime * 3.0) * 0.37));
            float drop = step(0.65, snoise(vec3(floor(vUv * 6.0), floor(uTime * 2.0))));
            c = mix(c, vec3(0.05), drop);
            c = mix(c, c.bgr * 1.2, band * 0.4);
          }
          c *= 1.0 - 0.85 * uHum;
          gl_FragColor = vec4(c, 1.0);
        }`,
    });
    const skyParts = [];
    for (let lv = 0; lv < N; lv++) {
      const g = new THREE.PlaneGeometry(SPAN, SPAN).rotateX(Math.PI / 2).translate(SPAN / 2, (lv + 1) * LEVEL_H - 0.02, SPAN / 2);
      g.setAttribute('aLevel', new THREE.Float32BufferAttribute(new Array(g.attributes.position.count).fill(lv), 1));
      skyParts.push(g);
    }
    const skyGeo = new THREE.BufferGeometry();
    {
      const pos = [];
      const uv = [];
      const lvA = [];
      for (const g of skyParts) {
        const ng = g.toNonIndexed();
        pos.push(...ng.attributes.position.array);
        uv.push(...ng.attributes.uv.array);
        lvA.push(...ng.attributes.aLevel.array);
      }
      skyGeo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      skyGeo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
      skyGeo.setAttribute('aLevel', new THREE.Float32BufferAttribute(lvA, 1));
    }
    const skies = new THREE.Mesh(skyGeo, skyMat);
    root.add(skies);

    // ---------- residents ----------
    if (params.residents) {
      const rr = rng.fork('residents');
      const figs = [];
      for (let lv = 0; lv < N; lv++) {
        for (let i = 0; i < 70; i++) {
          // in the streets, never inside a unit
          const alongX = rr.chance(0.5);
          const lane = rr.int(0, N) * PITCH + rr.float(-1.2, 1.2);
          const t = rr.float(4, SPAN - 4);
          figs.push(new THREE.Vector3(alongX ? t : lane, lv * LEVEL_H + SLAB, alongX ? lane : t));
        }
      }
      const fg = new THREE.CapsuleGeometry(0.19, 1.3, 4, 10).translate(0, 0.84, 0);
      const fm = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.85 });
      const people = new THREE.InstancedMesh(fg, fm, figs.length);
      // Labour-class workwear: muted, washed, a little variation.
      const cloth = [0x6d665c, 0x5a6168, 0x7a6f61, 0x4f5550, 0x8a8174, 0x6a5c55].map((h) => new THREE.Color(h));
      figs.forEach((p, i) => {
        const s = rr.chance(0.25) ? rr.float(0.55, 0.7) : rr.float(0.92, 1.08); // children among them
        m4.compose(p, new THREE.Quaternion(), new THREE.Vector3(1, s, 1));
        people.setMatrixAt(i, m4);
        people.setColorAt(i, rr.pick(cloth));
      });
      people.castShadow = true;
      root.add(people);
    }

    // ---------- light ----------
    const amb = new THREE.HemisphereLight(sky.top, 0x2a2622, 0.55 * sky.k + 0.1);
    root.add(amb);
    // The panel overhead, standing in for twenty skies' worth of light.
    const overhead = new THREE.DirectionalLight(sky.low, 1.3 * sky.k);
    // Soft bounce off the street so walls and people are not black.
    const bounce = new THREE.DirectionalLight(sky.low, 0.55 * sky.k + 0.1);
    bounce.position.set(-SPAN, LEVEL_H * N * 0.3, -SPAN * 0.4);
    root.add(bounce);
    overhead.position.set(SPAN * 0.4, LEVEL_H * N * 2, SPAN * 0.7);
    overhead.target.position.set(SPAN / 2, 0, SPAN / 2);
    root.add(overhead, overhead.target);
    const work = new THREE.DirectionalLight(0xfff2e0, 0.8);
    work.position.set(SPAN * 1.4, LEVEL_H * N * 1.2, SPAN * 1.6);
    work.target.position.set(SPAN / 2, (LEVEL_H * N) / 2, SPAN / 2);
    root.add(work, work.target);
    stage.scene.background = new THREE.Color(0x050505);
    stage.scene.fog = new THREE.Fog(0x050505, 300, 900);

    const L = params.level - 1;
    const streetY = L * LEVEL_H + SLAB + 1.6;
    const streetZ = 7 * PITCH; // a street lane (between rows)
    const site = params.site;
    const camFor = (lv) => ({ position: [1.5 * PITCH, lv * LEVEL_H + SLAB + 1.6, streetZ], target: [12 * PITCH, lv * LEVEL_H + SLAB + 3.2, streetZ + 0.5], lens: 24 });

    return {
      object: root,
      bloomScale: 0.7,
      camera: this.camera,
      cameras: {
        Section: { position: [SPAN * 1.7, LEVEL_H * N * 0.62, SPAN * 2.2], target: [SPAN * 0.45, LEVEL_H * N * 0.47, SPAN * 0.5], lens: 28 },
        'Section, long lens': { position: [SPAN * 2.6, LEVEL_H * N * 0.5, SPAN * 2.2], target: [SPAN * 0.5, LEVEL_H * N * 0.5, SPAN * 0.5], lens: 85 },
        [`Street, level ${params.level}`]: camFor(L),
        'Station forecourt': { position: [10 * PITCH + 1, streetY, 12.6 * PITCH], target: [10 * PITCH, streetY + 2, 10 * PITCH], lens: 32 },
        Rooftops: { position: [2.5 * PITCH, streetY + CRATE_H + 0.4, 2.5 * PITCH], target: [13 * PITCH, streetY + 3.5, 15 * PITCH], lens: 24 },
      },
      update(t) {
        time.value = t;
      },
      set(key, value) {
        if (key === 'perception') hum.value = value.startsWith('Jinda') ? 1 : 0;
      },
      hud() {
        const cam = stage.controls.target;
        const lv = Math.max(0, Math.min(N - 1, Math.floor(cam.y / LEVEL_H)));
        const col = Math.max(0, Math.min(N - 1, Math.floor(cam.x / PITCH)));
        const row = Math.max(0, Math.min(N - 1, Math.floor(cam.z / PITCH)));
        const lines = [`${PROMISES.address(site, lv + 1, col + 1, row + 1)} · ${N}×${N}×${N} · ${units.length.toLocaleString()} dwellings · built by ${PROMISES.builder}`];
        if (brokenLevel >= 0) lines.push(`level ${brokenLevel + 1}: sky program failing`);
        if (hum.value) lines.push(MATERIALS.relicrete.text);
        return lines;
      },
    };
  },
};
