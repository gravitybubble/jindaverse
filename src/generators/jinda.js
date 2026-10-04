// JINDA, MANIFESTED: character + VFX.
//
// The body is motes: field-bounded cells that pack as truncated octahedra
// (Kelvin cells) on a body-centred-cubic lattice inside a humanoid volume.
// The core sits at centre mass. Everything that moves obeys the combat
// doctrine: no easing, no inertia, no breath, no casting. The Jinda occupies
// positions rather than flowing between them.
import * as THREE from 'three';
import { Body } from '../lib/body.js';
import { Aura } from '../lib/aura.js';
import { truncatedOctahedron, polyhedronGeometry } from '../lib/polyhedra.js';
import { makeNoise3 } from '../lib/noise.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { buildCore } from './core.js';
import { POINT, AURA, FILIGREE } from '../canon/canon.js';

// Linear ramp. The only interpolation a Jinda gets: no ease-in, no ease-out.
const lin = (t0, t1, t) => Math.max(0, Math.min(1, (t - t0) / (t1 - t0)));

// Finishes are design explorations, not canon: the documents do not yet
// specify what a manifested Jinda's surface looks like.
const FINISHES = {
  Obsidian: { color: 0x0f1013, metalness: 0.3, roughness: 0.22, iridescence: 0.8, clearcoat: 0.8, aura: '#b7b0ff' },
  Graphite: { color: 0x2b2c30, metalness: 0.65, roughness: 0.38, iridescence: 0.15, clearcoat: 0.2, aura: '#c8d6ff' },
  Ceramic: { color: 0x9c978e, metalness: 0.0, roughness: 0.5, iridescence: 0.0, clearcoat: 0.6, aura: '#ffd9a8' },
  Pearl: { color: 0xbfc4cc, metalness: 0.1, roughness: 0.18, iridescence: 1.0, clearcoat: 1.0, aura: '#d8f2ff' },
};

const SETTINGS = ['Black stage', 'Salt flat'];

function buildSetting(name, root, extent) {
  const scene = {};
  if (name === 'Salt flat') {
    // "A Jinda on a salt flat is nearly disarmed": nothing to borrow.
    scene.background = new THREE.Color(0xc9c4ba);
    scene.fog = new THREE.Fog(0xc9c4ba, 30, 220);
    const ground = new THREE.Mesh(
      new THREE.CircleGeometry(400, 64).rotateX(-Math.PI / 2),
      new THREE.MeshStandardMaterial({ color: 0xe8e2d6, roughness: 0.95 }),
    );
    ground.receiveShadow = true;
    root.add(ground);
    const sun = new THREE.DirectionalLight(0xffe2bd, 3.2);
    sun.position.set(-18, 9, 6);
    shadowed(sun, Math.max(8, extent * 0.6));
    root.add(sun, new THREE.HemisphereLight(0xdfe6f0, 0xb8ae9c, 1.2));
  } else {
    scene.background = new THREE.Color(0x070708);
    scene.fog = new THREE.Fog(0x070708, 18, 80);
    const ground = new THREE.Mesh(
      new THREE.CircleGeometry(200, 64).rotateX(-Math.PI / 2),
      new THREE.MeshStandardMaterial({ color: 0x141416, roughness: 0.85, metalness: 0.0 }),
    );
    ground.receiveShadow = true;
    root.add(ground);
    const key = new THREE.SpotLight(0xfff0dd, 140, 40, 0.55, 0.7, 1.6);
    key.position.set(4, 9, 6);
    key.target.position.set(0, 0.8, 1);
    shadowed(key, 8);
    root.add(key, key.target);
    const rim = new THREE.DirectionalLight(0x9aa8ff, 1.6);
    rim.position.set(-5, 4, -7);
    root.add(rim, new THREE.AmbientLight(0x404050, 0.4));
  }
  return scene;
}

function shadowed(light, half) {
  light.castShadow = true;
  light.shadow.mapSize.set(2048, 2048);
  light.shadow.bias = -0.0004;
  if (light.isDirectionalLight) {
    Object.assign(light.shadow.camera, { left: -half, right: half, top: half, bottom: -half, near: 0.5, far: 80 });
  }
}

export default {
  id: 'jinda',
  title: 'Jinda, Manifested',
  category: 'Characters',
  blurb: 'Mote body, tactical aura, traces, grounding, blur-step. Doctrine-locked motion.',
  doctrine: true,
  canon: ['POWER §2 Manifestation, Dormancy, Field topology', 'POWER §3 Mote Composition (Kelvin cells)', 'POWER §5 Point Rating', 'POWER §7 Grounding', 'POWER §10 Tactical Aura (traces, instancing)', 'POWER §19 Juri, Chiron', 'POWER §21 Combat Doctrine'],
  notes: [
    'Finishes are design explorations: the documents do not yet say what a manifested Jinda\'s surface looks like.',
    '"Inspect traces" holds the ghost permutations on screen for design review. In the cut they are half a frame at the edge of the aura (POWER §10).',
  ],
  params: [
    { key: 'seed', type: 'seed', default: 'JURI' },
    { key: 'point', label: 'Point', type: 'range', min: 1, max: 9, step: 1, default: 7 },
    { key: 'condition', label: 'Condition', type: 'select', options: ['Whole', 'Fragmented (Juri)', 'Damaged lattice (Chiron)'], default: 'Fragmented (Juri)' },
    { key: 'governed', label: 'Owned (Hedron governors)', type: 'toggle', default: false },
    { key: 'height', label: 'Height (m)', type: 'range', min: 1.5, max: 2.1, step: 0.01, default: 1.74 },
    { key: 'build', label: 'Build', type: 'range', min: 0, max: 1, step: 0.01, default: 0.3 },
    { key: 'shoulder', label: 'Shoulder : hip', type: 'range', min: 0, max: 1, step: 0.01, default: 0.35 },
    { key: 'mote', label: 'Mote size (cm)', type: 'range', min: 1.6, max: 9, step: 0.1, default: 2.3, hint: 'fine reads as surface, coarse reads as cells' },
    { key: 'finish', label: 'Finish (exploration)', type: 'select', options: Object.keys(FINISHES), default: 'Obsidian' },
    { key: 'packing', label: 'Packing mode', type: 'select', options: ['Dense (armour)', 'Open (sensory)', 'Conductive (energy)', 'Transitional (cycling)'], default: 'Dense (armour)' },
    { key: 'setting', label: 'Setting', type: 'select', options: SETTINGS, default: 'Black stage' },
    { key: 'spend', label: 'Spend (exhaustion)', type: 'range', min: 0, max: 1, step: 0.01, default: 0.1, live: true, hint: 'traces, translucency, stutter' },
    { key: 'intensity', label: 'Grounding dial', type: 'range', min: 0, max: 1, step: 0.01, default: 0.3, live: true, hint: 'seizure → cooks' },
    { key: 'inspect', label: 'Inspect traces (review only)', type: 'toggle', default: false, live: true },
    { key: 'autoAura', label: 'Spin aura on load', type: 'toggle', default: true },
  ],
  presets: {
    Juri: { seed: 'JURI', point: 7, condition: 'Fragmented (Juri)', governed: false, height: 1.72, build: 0.3, shoulder: 0.3, finish: 'Obsidian', packing: 'Dense (armour)', spend: 0.15 },
    Chiron: { seed: 'CHIRON', point: 8, condition: 'Damaged lattice (Chiron)', governed: false, height: 1.95, build: 0.1, shoulder: 0.6, finish: 'Graphite', packing: 'Open (sensory)', spend: 0.45 },
    'Hedron guard (P5)': { seed: 'SYN-GUARD', point: 5, condition: 'Whole', governed: true, height: 1.85, build: 0.7, shoulder: 0.8, finish: 'Ceramic', packing: 'Dense (armour)', spend: 0.05 },
    'Extractor (P2)': { seed: 'PERDITION-5', point: 2, condition: 'Whole', governed: true, height: 1.6, build: 0.2, shoulder: 0.5, mote: 5.5, finish: 'Graphite', packing: 'Dense (armour)', spend: 0.6 },
    'Running out': { seed: 'JURI', point: 7, condition: 'Fragmented (Juri)', spend: 0.9, packing: 'Dense (armour)' },
  },
  camera: { position: [6.5, 2.4, 7.5], target: [0, 1.1, 1.8], lens: 35 },

  build({ stage, rng, params }) {
    const root = new THREE.Group();
    const P = params.point;
    const extent = POINT.levels[P].aura;
    const isChiron = params.condition.startsWith('Damaged');
    const isJuri = params.condition.startsWith('Fragmented');
    const finish = FINISHES[params.finish];
    Object.assign(stage.scene, buildSetting(params.setting, root, extent));
    const pmrem = new THREE.PMREMGenerator(stage.renderer);
    const env = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    pmrem.dispose();
    stage.scene.environment = env;
    stage.scene.environmentIntensity = params.setting === 'Salt flat' ? 0.8 : 0.35;
    const saltFlat = params.setting === 'Salt flat';

    // ---------- body and motes ----------
    const body = new Body({ height: params.height, build: params.build, shoulder: params.shoulder });
    const a = params.mote / 100;
    const cells = body.bccLattice(a);
    const N = cells.length;
    const kelvin = polyhedronGeometry(truncatedOctahedron());
    // Scale so square faces sit at a/2: a BCC lattice's Voronoi cell.
    const cellScale = (a * Math.sqrt(5)) / 4;

    const jinda = new THREE.Group(); // moves as a whole (blur-step)
    root.add(jinda);

    const mat = new THREE.MeshPhysicalMaterial({
      color: finish.color,
      metalness: finish.metalness,
      roughness: finish.roughness,
      iridescence: finish.iridescence,
      iridescenceIOR: 1.6,
      clearcoat: finish.clearcoat,
      flatShading: true,
      alphaHash: true,
      envMapIntensity: 1,
    });
    const glowUniforms = {
      uGlowColor: { value: new THREE.Color(finish.aura) },
      uFragColor: { value: new THREE.Color('#ff8a5c') },
    };
    mat.onBeforeCompile = (sh) => {
      Object.assign(sh.uniforms, glowUniforms);
      sh.vertexShader = sh.vertexShader
        .replace('#include <common>', '#include <common>\nattribute float aGlow; attribute float aFrag; varying float vGlow; varying float vFrag;')
        .replace('#include <begin_vertex>', '#include <begin_vertex>\nvGlow = aGlow; vFrag = aFrag;');
      sh.fragmentShader = sh.fragmentShader
        .replace('#include <common>', '#include <common>\nuniform vec3 uGlowColor, uFragColor; varying float vGlow; varying float vFrag;')
        .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance += uGlowColor * vGlow + uFragColor * vFrag;');
    };
    const motes = new THREE.InstancedMesh(kelvin, mat, N);
    motes.castShadow = true;
    motes.receiveShadow = true;
    motes.frustumCulled = false;
    const aGlow = new THREE.InstancedBufferAttribute(new Float32Array(N), 1);
    const aFrag = new THREE.InstancedBufferAttribute(new Float32Array(N), 1);
    kelvin.setAttribute('aGlow', aGlow);
    kelvin.setAttribute('aFrag', aFrag);
    jinda.add(motes);

    const mr = rng.fork('motes');
    const core = body.corePos;
    let maxD = 0;
    const M = cells.map((c) => {
      // Foam conforms to its container: surface cells relax onto the skin so
      // the silhouette reads as a body, not a staircase.
      if (c.depth < a * 0.75) {
        const n = body.normal(c.pos);
        c.pos.addScaledVector(n, c.depth - a * 0.38);
      }
      const d = c.pos.distanceTo(core);
      maxD = Math.max(maxD, d);
      return {
        base: c.pos,
        depth: c.depth,
        d,
        scatter: new THREE.Vector3(...mr.unitVector()).multiplyScalar(mr.float(0.3, 1)),
        jitter: mr.float(0, 1),
        rot: mr.float(-0.25, 0.25),
        inst: 0,
      };
    });
    const perm = mr.shuffle([...Array(N).keys()]);
    perm.forEach((i, k) => (M[i].inst = k));

    // Conductive channels: lines from the core to the extremities.
    const ends = ['handL', 'handR', 'footL', 'footR', 'head'].map((n) => body.limbs.find((l) => l.name === n).b);
    const channelOf = (p) => {
      let best = Infinity;
      for (const e of ends) {
        const ab = e.clone().sub(core);
        const t = Math.max(0, Math.min(1, p.clone().sub(core).dot(ab) / ab.lengthSq()));
        best = Math.min(best, p.distanceTo(core.clone().addScaledVector(ab, t)));
      }
      return best;
    };
    for (const m of M) m.channel = channelOf(m.base);

    // ---------- core ----------
    const coreApi = buildCore(rng.fork('core'), { point: P, thermal: params.spend * 0.8, damage: isChiron ? 0.8 : isJuri ? 0.3 : 0, temperament: isJuri ? 0.6 : 0.35, polarized: 1 });
    coreApi.group.scale.setScalar(FILIGREE.coreDiameterMm / 2000);
    coreApi.group.position.copy(core);
    jinda.add(coreApi.group);
    const coreLight = new THREE.PointLight(finish.aura, 0.4, 1.2, 2);
    coreLight.position.copy(core);
    jinda.add(coreLight);

    // ---------- aura ----------
    const shells = P <= 3 ? 2 : P <= 6 ? 3 : 4;
    const aura = new Aura({
      body,
      rng: rng.fork('aura'),
      extent,
      shells,
      nodesPerShell: P <= 3 ? 90 : 150,
      color: saltFlat ? '#3a3560' : finish.aura,
      deadZones: isJuri ? 0.8 : 0,
      fragments: isJuri ? 0.9 : 0,
    });
    if (saltFlat) aura.material.blending = THREE.NormalBlending;
    jinda.add(aura.group);
    let pulse = 0;
    aura.onCorePulse = (k) => (pulse = 1 - k);

    // ---------- target (a human, ConSec or otherwise) ----------
    const targetDist = Math.max(0.9, Math.min(4.2, extent * 0.3));
    const humanBody = new Body({ height: 1.78, build: 0.55, shoulder: 0.65 });
    const humanMat = new THREE.MeshStandardMaterial({ color: saltFlat ? 0x5d5a55 : 0x6b6862, roughness: 0.8, emissive: 0x000000 });
    const target = humanBody.mannequin(humanMat);
    target.position.set(0, 0, targetDist);
    target.rotation.y = Math.PI;
    root.add(target);
    const targetRest = target.children.map((c) => c.position.clone());
    const targetChest = () => target.localToWorld(new THREE.Vector3(0, 1.25, 0));

    // ---------- traces (ghost permutations) ----------
    const surface = M.filter((m) => m.depth < a * 1.1).map((m) => m.base);
    const ghostGeo = new THREE.BufferGeometry().setFromPoints(surface);
    const ghosts = [];
    for (let i = 0; i < 8; i++) {
      const g = new THREE.Points(
        ghostGeo,
        new THREE.PointsMaterial({ color: saltFlat ? 0x25223f : finish.aura, size: a * 0.9, transparent: true, opacity: 0, depthWrite: false, blending: saltFlat ? THREE.NormalBlending : THREE.AdditiveBlending }),
      );
      g.visible = false;
      root.add(g);
      ghosts.push(g);
    }

    // ---------- state ----------
    const S = {
      t: 0,
      manifest: 1, // 0 dormant ... 1 manifest
      manifestFrom: 1,
      manifestTo: 1,
      manifestT0: -10,
      disperse: 0,
      instances: 1,
      instanceK: 0,
      instanceOffsets: [new THREE.Vector3()],
      step: null, // active blur-step
      queue: [], // governed actions wait out the hitch
      hitchUntil: -1,
      spend: params.spend,
      intensity: params.intensity,
      inspect: params.inspect,
      packing: params.packing,
      nextSpike: 3,
      spike: 0,
      message: '',
      seize: 0,
    };

    const traceCount = () => (isChiron ? Math.min(2, AURA.traces(S.spend)) : AURA.traces(S.spend));

    function faceTarget() {
      const tp = target.position;
      jinda.rotation.y = Math.atan2(tp.x - jinda.position.x, tp.z - jinda.position.z);
    }

    // Blur-step: traces bloom, all but one go dark, partial dispersal,
    // transit with no curve, re-cohere. The half-beat of arrival is the
    // exploitable window (POWER §21).
    function blurStep(t) {
      const n = traceCount();
      if (n === 0) {
        S.message = 'No permutations left: cannot afford the move.';
        return;
      }
      const from = jinda.position.clone();
      const cands = [];
      for (let i = 0; i < Math.max(n, 1); i++) {
        const ang = rng.float(-Math.PI, Math.PI);
        const r = rng.float(1.6, 3.8);
        const p = from.clone().add(new THREE.Vector3(Math.sin(ang) * r, 0, Math.cos(ang) * r));
        p.x = Math.max(-6, Math.min(6, p.x));
        p.z = Math.max(-4, Math.min(targetDist - 1.2, p.z));
        cands.push(p);
      }
      S.step = { t0: t, from, to: cands[0], cands };
      ghosts.forEach((g, i) => {
        g.visible = i < cands.length;
        if (g.visible) {
          g.position.copy(cands[i]);
          g.rotation.y = Math.atan2(target.position.x - cands[i].x, target.position.z - cands[i].z);
        }
      });
      S.message = '';
    }

    function setManifest(t, to) {
      S.manifestFrom = S.manifest;
      S.manifestTo = to;
      S.manifestT0 = t;
      if (to === 0 && aura.state !== 'off') aura.collapse(t);
    }

    function instance(t, k) {
      if (isChiron && k > 1) {
        S.message = 'Chiron cannot instance: division would scatter a coherence he can barely hold.';
        return;
      }
      S.instances = k;
      S.instanceOffsets = [new THREE.Vector3()];
      for (let i = 1; i < k; i++) {
        const side = i % 2 ? 1 : -1;
        S.instanceOffsets.push(new THREE.Vector3(side * (1.3 + 0.9 * Math.ceil(i / 2)), 0, -0.4 * Math.ceil(i / 2)));
      }
      S.instanceT0 = t;
      S.instanceDir = 1;
    }

    const run = {
      manifest: (t) => setManifest(t, 1),
      dormancy: (t) => setManifest(t, 0),
      activate: (t) => {
        if (S.manifest < 1) setManifest(t, 1);
        aura.activate(t + (S.manifest < 1 ? 1 : 0));
      },
      ground: (t) => {
        jinda.updateMatrixWorld(true);
        if (aura.state === 'held') {
          aura.ground(t, targetChest());
        } else {
          if (aura.state === 'off') aura.activate(t);
          S.pendingGround = true;
        }
      },
      blurstep: (t) => blurStep(t),
      instance2: (t) => instance(t, 2),
      instance3: (t) => instance(t, 3),
      reconsolidate: (t) => {
        S.instanceT0 = t;
        S.instanceDir = -1;
      },
    };

    function action(id) {
      const t = S.t;
      // Combat as jurisdiction: an owned Jinda carries a hitch before any
      // response. Not weakness. Paperwork.
      if (params.governed) {
        S.hitchUntil = t + 0.25;
        S.queue.push(id);
        return;
      }
      // Exhaustion: movement lags behind intention.
      const lag = S.spend > 0.6 ? (S.spend - 0.6) * 0.3 : 0;
      if (lag > 0) {
        S.hitchUntil = t + lag;
        S.queue.push(id);
      } else run[id](t);
    }

    if (params.autoAura) aura.activate(0.6);

    // ---------- per-frame ----------
    const m4 = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const e = new THREE.Euler();
    const v = new THREE.Vector3();
    const sc = new THREE.Vector3();
    const noise = makeNoise3(rng.fork('frag'));
    let lastStepT = -1;

    function update(tReal) {
      // Chiron renders on an animated frame rate: a figure struggling to hold
      // his own rendering. Healthy Jinda are perfectly rendered.
      const t = isChiron ? Math.floor(tReal * 10) / 10 : tReal;
      S.t = tReal;
      if (isChiron && t === lastStepT) return;
      lastStepT = t;

      if (S.queue.length && tReal >= S.hitchUntil) {
        const id = S.queue.shift();
        run[id](tReal);
      }

      // manifest / dormancy: motes leave and return through the core
      const mk = lin(S.manifestT0, S.manifestT0 + 0.9, t);
      S.manifest = S.manifestFrom + (S.manifestTo - S.manifestFrom) * mk;

      // blur-step
      let disperse = 0;
      if (S.step) {
        const e2 = t - S.step.t0;
        const traceHold = S.inspect ? 1.4 : 0.06;
        ghosts.forEach((g, i) => {
          if (!g.visible) return;
          const alive = i === 0 ? e2 < traceHold + 0.05 : e2 < traceHold;
          g.material.opacity = alive ? (i === 0 && e2 > traceHold ? 0.5 : 0.16) : 0;
          if (!alive) g.visible = false;
        });
        const d0 = traceHold + 0.03;
        disperse = lin(d0, d0 + 0.05, e2) * (1 - lin(d0 + 0.13, d0 + 0.26, e2));
        jinda.position.lerpVectors(S.step.from, S.step.to, lin(d0 + 0.05, d0 + 0.13, e2));
        if (e2 > d0 + 0.26) S.step = null;
      }
      faceTarget();

      // instancing transition: same grammar as the blur-step
      if (S.instanceT0 !== undefined) {
        const e3 = t - S.instanceT0;
        disperse = Math.max(disperse, lin(0, 0.05, e3) * (1 - lin(0.12, 0.24, e3)));
        const k = lin(0.05, 0.12, e3);
        S.instanceK = S.instanceDir > 0 ? k : 1 - k;
        if (S.instanceDir < 0 && e3 > 0.24) {
          S.instances = 1;
          S.instanceT0 = undefined;
        }
      }
      S.disperse = disperse;

      // Chiron's spikes: seizures, not power.
      if (isChiron && tReal > S.nextSpike) {
        S.spike = 1;
        S.nextSpike = tReal + 2.5 + Math.random() * 4;
      }
      S.spike = Math.max(0, S.spike - 0.12);
      aura.uniforms.uSpike.value = S.spike;

      // packing mode
      let packing = S.packing;
      if (packing.startsWith('Transitional')) {
        packing = ['Dense', 'Open', 'Conductive'][Math.floor(t / 1.6) % 3];
      }
      const open = packing.startsWith('Open');
      const conductive = packing.startsWith('Conductive');

      const opacity = 1 - S.spend * 0.45;
      mat.opacity = opacity;
      const flicker = S.spend > 0.5 || isChiron;
      const flickSeed = Math.floor(t * 24);
      const fragOn = isJuri && Math.floor(t * 12) % 7 !== 0; // fragments surface and recede

      for (let i = 0; i < N; i++) {
        const m = M[i];
        const dn = m.d / maxD;
        // Inner motes emerge first, outer last; retraction is the reverse.
        const present = lin(dn * 0.7, dn * 0.7 + 0.3, S.manifest);
        let s = cellScale * present;
        v.copy(core).lerp(m.base, present);
        if (open) {
          s *= 0.55;
          v.addScaledVector(m.scatter, 0.012);
        } else {
          s *= 0.97;
        }
        // instancing: each instance is the whole form with a share of the motes
        if (S.instances > 1) {
          const inst = m.inst % S.instances;
          v.addScaledVector(S.instanceOffsets[inst], S.instanceK);
        }
        if (disperse > 0) {
          v.addScaledVector(m.scatter, disperse * 0.35);
          s *= 1 - 0.55 * disperse;
        }
        if (flicker) {
          const h = Math.sin((i * 12.9898 + flickSeed * 78.233)) * 43758.5453;
          const r = h - Math.floor(h);
          const p = isChiron ? 0.12 + S.spike * 0.4 : (S.spend - 0.5) * 0.5;
          if (r < p) s = 0;
          // Chiron: coherence fails in bands.
          if (isChiron && Math.abs(Math.sin(m.base.y * 9 + t * 3)) > 0.985) s = 0;
        }
        q.setFromEuler(e.set(m.rot * disperse * 6, m.rot * disperse * 6, 0));
        m4.compose(v, q, sc.setScalar(s));
        motes.setMatrixAt(i, m4);

        let glow = 0;
        if (conductive && m.channel < a * 1.2) glow = 0.9;
        if (m.d < 0.14) glow = Math.max(glow, (0.14 - m.d) * 4 * (0.6 + pulse * 3));
        glow += S.spike * 0.6 * (m.jitter > 0.6 ? 1 : 0);
        aGlow.array[i] = glow;
        if (isJuri) {
          // Splinters of other minds: small, warm, surfacing and receding.
          const f = noise(m.base.x * 7 + t * 0.5, m.base.y * 7, m.base.z * 7 + t * 0.3);
          aFrag.array[i] = fragOn ? Math.max(0, f - 0.42) * 2.2 : 0;
        }
      }
      motes.instanceMatrix.needsUpdate = true;
      aGlow.needsUpdate = true;
      aFrag.needsUpdate = true;

      // core
      coreApi.update(tReal);
      coreApi.set('thermal', Math.min(1, S.spend * 0.8 + (aura.state === 'grounding' || aura.state === 'discharging' ? 0.25 : 0)));
      coreLight.intensity = (0.3 + pulse * 6 + S.spike * 3) * S.manifest;
      pulse = Math.max(0, pulse - 0.06);

      // aura
      aura.group.visible = S.manifest > 0.98;
      aura.update(tReal, { spend: S.spend });
      if (S.pendingGround && aura.state === 'held') {
        S.pendingGround = false;
        jinda.updateMatrixWorld(true);
        aura.ground(tReal, targetChest());
      }

      // target: the circuit completes and stays completed
      const seizing = aura.state === 'discharging';
      const cap = params.governed ? Math.min(S.intensity, 0.35) : S.intensity;
      if (seizing) S.seize = Math.min(1, S.seize + 0.2);
      else S.seize = Math.max(0, S.seize - 0.05);
      target.children.forEach((c, i) => {
        c.position.copy(targetRest[i]);
        if (seizing) c.position.add(v.set(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).multiplyScalar(0.012 * (0.4 + cap)));
      });
      humanMat.emissive.setRGB(1, 0.92, 0.8).multiplyScalar(S.seize * (0.25 + cap * 0.9) * (0.6 + 0.4 * Math.random()));
      if (seizing && cap > 0.7) humanMat.color.lerp(new THREE.Color(0x1a1512), 0.01);
    }

    return {
      object: root,
      dispose: () => env.dispose(),
      // Profile two-shot of the standoff, slightly favouring the Jinda.
      camera: {
        position: [targetDist * 1.6 + 3.5, 1.4, targetDist * 0.42],
        target: [0, 1.05, targetDist * 0.5],
        lens: 40,
      },
      cameras: {
        'Two-shot': { position: [targetDist * 1.6 + 3.5, 1.4, targetDist * 0.42], target: [0, 1.05, targetDist * 0.5], lens: 40 },
        'Wide: full aura': { position: [extent * 1.5 + 4, extent * 0.35 + 1.5, extent * 0.9 + 3], target: [0, Math.max(1, extent * 0.15), targetDist * 0.4], lens: 24 },
        'Medium close': { position: [1.3, 1.55, 2.1], target: [0, 1.3, 0], lens: 50 },
        'Low, regard': { position: [-0.9, 0.55, 2.6], target: [0, 1.45, 0], lens: 32 },
      },
      actions: [
        { id: 'activate', label: 'Spin aura' },
        { id: 'ground', label: 'Ground target' },
        { id: 'blurstep', label: 'Blur-step' },
        { id: 'instance2', label: 'Instance ×2' },
        { id: 'instance3', label: 'Instance ×3' },
        { id: 'reconsolidate', label: 'Reconsolidate' },
        { id: 'dormancy', label: 'Dormancy' },
        { id: 'manifest', label: 'Manifest' },
      ],
      action,
      update,
      set(key, value) {
        if (key === 'spend') S.spend = value;
        if (key === 'intensity') S.intensity = value;
        if (key === 'inspect') S.inspect = value;
      },
      hud() {
        const lines = [
          `Point ${P} · aura ${extent} m · ${N} motes · ${params.mote} cm cells`,
          `aura: ${aura.state} · traces available: ${traceCount()}`,
        ];
        if (params.governed) lines.push(S.t < S.hitchUntil ? 'governor: verifying…' : 'governed: grounding capped at subdue');
        if (isJuri) lines.push('severed from JindaNet · dead zones · fragment intrusions');
        if (isChiron) lines.push('unscaffolded · animated frame rate · spikes are seizures');
        if (S.message) lines.push(S.message);
        return lines;
      },
    };
  },
};
