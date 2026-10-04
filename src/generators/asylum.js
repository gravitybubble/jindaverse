// THE ASYLUM: location.
// Uncontained spacetime damage at continental scale. Not an explosion; a
// containment failure, and this is the scar tissue. Each tear is raw fold
// physics acting on the environment with no organising geometry.
//
// Tear phenomena (previz vocabulary; the documents name the physics, these
// are interpretations of it):
//   Twist  — the ground's coordinates rotate about a point; dunes swirl.
//   Seam   — a spatial discontinuity: one side of a line is displaced.
//   Fold   — a disc of terrain duplicated, inverted, and hung in the air.
//   Shards — rock slabs suspended in a column, some turning at different rates.
//   Lens   — a bubble of space that bends the light passing through it.
// The rim (Amargosa, Domo Syn's sector) is survivable; depth toward ground
// zero increases tear density and severity.
import * as THREE from 'three';
import { makeNoise3, fbm, ridged, GLSL_NOISE } from '../lib/noise.js';
import { mergeGeometries } from '../lib/polyhedra.js';
import { ASYLUM } from '../canon/canon.js';

const TIMES = {
  Dawn: { sun: [0.6, 0.12, -0.8], sunCol: 0xffb98a, sky: [0x2a3550, 0xe9a47a], fog: 0xc89a80, int: 2.0, hemi: 0.5 },
  Noon: { sun: [0.2, 0.95, -0.25], sunCol: 0xfff3e2, sky: [0x5b7fae, 0xd9d2c4], fog: 0xd5ccbb, int: 3.2, hemi: 1.0 },
  Dusk: { sun: [-0.5, 0.08, -0.85], sunCol: 0xff8e5a, sky: [0x1c1f3a, 0xd9774e], fog: 0x8a5a4c, int: 1.8, hemi: 0.45 },
  Night: { sun: [-0.3, 0.6, -0.7], sunCol: 0x7f93c9, sky: [0x03040a, 0x111628], fog: 0x0b0d16, int: 0.35, hemi: 0.18 },
};

function strataTexture(rng) {
  const c = document.createElement('canvas');
  c.width = 64;
  c.height = 512;
  const g = c.getContext('2d');
  let y = 0;
  while (y < 512) {
    const h = rng.int(3, 28);
    const v = rng.float(0.32, 0.72);
    const warm = rng.float(0, 1);
    const r = Math.round(255 * v * (0.95 + warm * 0.12));
    const gg = Math.round(255 * v * (0.86 + warm * 0.04));
    const b = Math.round(255 * v * (0.74 - warm * 0.08));
    g.fillStyle = `rgb(${r},${gg},${b})`;
    g.fillRect(0, y, 64, h);
    y += h;
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export default {
  id: 'asylum',
  title: 'The Asylum',
  category: 'Locations',
  blurb: 'Rim to ground zero. Tears, temporal flora, spore fields, Shaft Five.',
  canon: ['BIBLE The Asylum — Scale, Physics and Structure', 'BIBLE The Asylum — Dangerous Ecology', 'BIBLE Hedron — The Halo', 'GLOSSARY Amargosa Valley, Ground Zero'],
  notes: [
    'Tear types (twist, seam, fold, shards, lens) are previz interpretations of "uncontained tear" physics, not canon terms.',
    'Scale: the terrain tile is 1.2 km across. The Asylum itself is a 600–700 mile radius.',
  ],
  params: [
    { key: 'seed', type: 'seed', default: 'AMARGOSA' },
    { key: 'depth', label: 'Depth: rim → ground zero', type: 'range', min: 0, max: 1, step: 0.01, default: 0.35 },
    { key: 'tears', label: 'Tear density', type: 'range', min: 0, max: 2, step: 0.05, default: 1 },
    { key: 'time', label: 'Time of day', type: 'select', options: Object.keys(TIMES), default: 'Dusk' },
    { key: 'flora', label: 'Temporal flora', type: 'toggle', default: true },
    { key: 'spores', label: 'Spore fields', type: 'range', min: 0, max: 1, step: 0.01, default: 0.5 },
    { key: 'shaft', label: 'Shaft Five headframe (rim only)', type: 'toggle', default: true },
    { key: 'halo', label: 'The Halo (faint, in orbit)', type: 'toggle', default: false },
  ],
  presets: {
    'Amargosa rim': { seed: 'AMARGOSA', depth: 0.12, tears: 0.7, time: 'Dusk', shaft: true, spores: 0.2 },
    'Perdition at night': { seed: 'PERDITION', depth: 0.2, tears: 0.9, time: 'Night', shaft: true, spores: 0.6 },
    'Deep zone': { seed: 'TERNARY', depth: 0.75, tears: 1.4, time: 'Noon', shaft: false, spores: 0.8 },
    'Approach to Virtue': { seed: 'VIRTUE', depth: 1, tears: 1.8, time: 'Dawn', shaft: false, spores: 1, halo: true },
  },
  camera: { position: [0, 2.2, 40], target: [0, 8, -120], lens: 32 },

  build({ stage, rng, params }) {
    const root = new THREE.Group();
    const T = TIMES[params.time];
    const depth = params.depth;
    const noise = makeNoise3(rng.fork('terrain'));
    const tr = rng.fork('tears');
    const sunDir = new THREE.Vector3(...T.sun).normalize();

    // ---------- tears: placed first, the terrain is shaped by them ----------
    const count = Math.round((3 + depth * 14) * params.tears);
    const tears = [];
    // The first few cover every phenomenon; after that, the readable ones
    // (fold, shards, lens) are favoured.
    const kinds = ['fold', 'shards', 'lens', 'twist', 'seam'];
    const weighted = ['fold', 'shards', 'shards', 'lens', 'fold', 'twist', 'seam'];
    for (let i = 0; i < count; i++) {
      const kind = i < kinds.length ? kinds[i] : tr.pick(weighted);
      // Most tears sit in the hero eyeline (toward ground zero, -z); the
      // rest scatter so other angles have something to find.
      const inView = i < 3 || tr.chance(0.65);
      const ang = Math.PI + (inView ? tr.float(-0.5, 0.5) : tr.float(-Math.PI, Math.PI));
      const dist = inView ? tr.float(90 + i * 15, 420) : tr.float(60, 520);
      const c = new THREE.Vector2(Math.sin(ang) * dist, Math.cos(ang) * dist - 40);
      tears.push({
        kind,
        c,
        R: tr.float(18, 60) * (0.7 + depth * 0.8),
        strength: tr.float(0.5, 1) * (0.5 + depth),
        dir: tr.float(0, Math.PI),
        lift: tr.float(14, 45) * (0.6 + depth),
        offset: tr.float(4, 14) * (0.6 + depth) * (tr.chance(0.5) ? 1 : -1),
      });
    }

    // Height field with tears applied as domain warps and discontinuities.
    const baseHeight = (x, z) => {
      // Basin floor, alluvial fans, and the ranges framing the valley.
      const across = Math.abs(x) / 600;
      const range = Math.pow(Math.max(0, across - 0.35), 1.6) * 260 * (0.6 + ridged(noise, x / 380, 0.3, z / 380, 5));
      const far = Math.max(0, -z - 380) / 300;
      const farRange = far * far * 120 * ridged(noise, x / 260, 1.7, z / 260, 4);
      const dunes = fbm(noise, x / 70, 2.1, z / 70, 4) * 2.2 + fbm(noise, x / 14, 5.3, z / 14, 3) * 0.35;
      const playa = Math.max(0, 1 - Math.hypot(x + 60, z + 160) / 220);
      return range + farRange + dunes * (1 - playa * 0.85);
    };
    const height = (x, z) => {
      let sx = x;
      let sz = z;
      let h = 0;
      for (const t of tears) {
        const dx = x - t.c.x;
        const dz = z - t.c.y;
        const r = Math.hypot(dx, dz);
        if (r > t.R * 1.6) continue;
        const f = Math.max(0, 1 - r / (t.R * 1.6));
        if (t.kind === 'twist') {
          const th = t.strength * 2.6 * f * f;
          const cs = Math.cos(th);
          const sn = Math.sin(th);
          sx = t.c.x + dx * cs - dz * sn;
          sz = t.c.y + dx * sn + dz * cs;
        } else if (t.kind === 'seam') {
          // signed distance to the seam line through the centre
          const side = dx * Math.cos(t.dir) + dz * Math.sin(t.dir);
          h += (side > 0 ? t.offset : 0) * Math.min(1, f * 2.2);
        } else if (t.kind === 'fold') {
          // the ground where the fold was taken from is scooped out
          h -= t.lift * 0.08 * f * f;
        }
      }
      return baseHeight(sx, sz) + h;
    };

    // ---------- terrain mesh ----------
    const SIZE = 1200;
    const SEG = 360;
    const geo = new THREE.PlaneGeometry(SIZE, SIZE, SEG, SEG).rotateX(-Math.PI / 2);
    const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) pos.setY(i, height(pos.getX(i), pos.getZ(i)));
    geo.computeVertexNormals();
    const col = new Float32Array(pos.count * 3);
    const sand = new THREE.Color(0xb59a7a);
    const playaC = new THREE.Color(0xd8d0c2);
    const rock = new THREE.Color(0x6e5b4c);
    const glass = new THREE.Color(0x2a2f3a);
    const nrm = geo.attributes.normal;
    const cc = new THREE.Color();
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const z = pos.getZ(i);
      const y = pos.getY(i);
      const slope = 1 - nrm.getY(i);
      const playa = Math.max(0, 1 - Math.hypot(x + 60, z + 160) / 220);
      cc.copy(sand).lerp(playaC, Math.min(1, playa * 1.6));
      cc.lerp(rock, Math.min(1, slope * 3.2 + Math.max(0, y - 40) / 120));
      // banding on steep faces reads as strata
      if (slope > 0.25) cc.multiplyScalar(0.85 + 0.25 * Math.sin(y * 1.7 + noise(x / 30, z / 30, 1) * 3));
      // fused, glassy ground near tears: dimensional bleed
      for (const t of tears) {
        const r = Math.hypot(x - t.c.x, z - t.c.y);
        if (r < t.R * 1.1) cc.lerp(glass, (1 - r / (t.R * 1.1)) * 0.55 * Math.min(1, t.strength));
      }
      cc.multiplyScalar(0.92 + 0.16 * noise(x / 6, z / 6, 7));
      col.set([cc.r, cc.g, cc.b], i * 3);
    }
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    const terrain = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.93, metalness: 0.0 }));
    terrain.receiveShadow = true;
    root.add(terrain);

    // ---------- tear set pieces ----------
    const strata = strataTexture(rng.fork('strata'));
    const rockMat = new THREE.MeshStandardMaterial({ map: strata, color: 0xb8a48e, roughness: 0.9, flatShading: true });
    const animated = [];
    for (const t of tears) {
      const y0 = height(t.c.x, t.c.y);
      if (t.kind === 'fold') {
        // A disc of ground, inverted and hung overhead: its mesas point down.
        const disc = new THREE.CircleGeometry(t.R * 0.55, 48, 0, Math.PI * 2).rotateX(-Math.PI / 2);
        const dp = disc.attributes.position;
        const fx = t.c.x + 300;
        const fz = t.c.y - 200;
        for (let i = 0; i < dp.count; i++) {
          const x = dp.getX(i);
          const z = dp.getZ(i);
          const rim = Math.hypot(x, z) / (t.R * 0.55);
          dp.setY(i, (baseHeight(fx + x, fz + z) - baseHeight(fx, fz)) + (1 - rim) * t.R * 0.12);
        }
        disc.computeVertexNormals();
        const top = new THREE.Mesh(disc, new THREE.MeshStandardMaterial({ color: 0xa48c70, roughness: 0.95, side: THREE.DoubleSide, flatShading: true }));
        // The underside is torn rock, not a cone: displace it with noise so
        // it reads as ground ripped out of place.
        const ug = new THREE.ConeGeometry(t.R * 0.55, t.R * 0.6, 40, 10, true).rotateX(Math.PI);
        const up = ug.attributes.position;
        for (let i = 0; i < up.count; i++) {
          const x = up.getX(i);
          const y = up.getY(i);
          const z = up.getZ(i);
          const k = 1 + 0.38 * noise(x / 6 + t.c.x, y / 4, z / 6) + 0.18 * noise(x / 2, y / 1.5, z / 2 + 9);
          const rim = Math.min(1, (t.R * 0.3 - y) / (t.R * 0.1));
          up.setXYZ(i, x * (rim < 1 ? 1 : k), y * (1 + 0.25 * noise(x / 5, 3, z / 5)), z * (rim < 1 ? 1 : k));
        }
        ug.computeVertexNormals();
        const under = new THREE.Mesh(ug, rockMat);
        under.position.y = -t.R * 0.3;
        const fold = new THREE.Group();
        fold.add(top, under);
        fold.rotation.set(Math.PI + tr.float(-0.25, 0.25), tr.float(0, 6.28), tr.float(-0.2, 0.2));
        fold.position.set(t.c.x, y0 + t.lift + t.R * 0.4, t.c.y);
        fold.traverse((o) => (o.castShadow = true));
        root.add(fold);
        animated.push({ obj: fold, rate: tr.float(-0.004, 0.004), axis: 'y' });
      } else if (t.kind === 'shards') {
        const parts = [];
        const n = Math.round(10 + t.strength * 26);
        for (let i = 0; i < n; i++) {
          const w = tr.float(1.5, 9) * (0.6 + depth);
          const g = new THREE.BoxGeometry(w, tr.float(0.6, 3.5), w * tr.float(0.3, 1.2));
          const a = tr.float(0, Math.PI * 2);
          const r = tr.float(0, t.R * 0.45);
          const shard = new THREE.Mesh(g, rockMat);
          shard.position.set(t.c.x + Math.cos(a) * r, y0 + tr.float(2, t.lift * 1.4), t.c.y + Math.sin(a) * r);
          shard.rotation.set(tr.float(-0.6, 0.6), tr.float(0, 6.28), tr.float(-0.6, 0.6));
          shard.castShadow = true;
          shard.receiveShadow = true;
          root.add(shard);
          // Time is broken here: some shards are still, some turn, at
          // rates that do not agree with each other.
          if (tr.chance(0.55)) animated.push({ obj: shard, rate: tr.float(-0.25, 0.25), axis: tr.pick(['x', 'y', 'z']) });
          parts.push(shard);
        }
        // An echo: one shard appears twice (dimensional duplication).
        const src = parts[0];
        const echo = src.clone();
        echo.position.y += t.lift * 0.3;
        echo.material = new THREE.MeshStandardMaterial({ map: strata, color: 0xb8a48e, transparent: true, opacity: 0.45, roughness: 0.9 });
        root.add(echo);
      } else if (t.kind === 'lens') {
        const r = t.R * 0.35;
        const lens = new THREE.Mesh(
          new THREE.SphereGeometry(r, 48, 24),
          new THREE.MeshPhysicalMaterial({ color: 0xffffff, transmission: 1, thickness: r * 1.8, ior: 1.33 + depth * 0.5, roughness: 0.02, metalness: 0, iridescence: 0.4, transparent: true }),
        );
        lens.position.set(t.c.x, y0 + r * 1.1 + tr.float(0, 10), t.c.y);
        root.add(lens);
        animated.push({ obj: lens, bob: tr.float(0.2, 0.6), y: lens.position.y });
      } else if (t.kind === 'seam') {
        // The seam's face catches light as a hairline of bleed.
        const L = t.R * 2.8;
        const g = new THREE.PlaneGeometry(L, Math.abs(t.offset) + 2);
        const m = new THREE.MeshBasicMaterial({ color: 0x9fb2ff, transparent: true, opacity: 0.06 + depth * 0.08, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false });
        const face = new THREE.Mesh(g, m);
        face.position.set(t.c.x, y0 + t.offset * 0.5, t.c.y);
        face.rotation.y = -t.dir + Math.PI / 2;
        root.add(face);
      }
    }

    // ---------- temporal flora ----------
    // Each plant exists across several timeframes at once: sprout, bloom and
    // husk occupy the same place, fading through one another out of phase.
    if (params.flora) {
      const fr = rng.fork('flora');
      const plant = (seed, scale) => {
        const r2 = fr.fork(seed);
        const parts = [];
        const branch = (p, dir, len, rad, depthLeft) => {
          const end = p.clone().addScaledVector(dir, len);
          const g = new THREE.CylinderGeometry(rad * 0.7, rad, len, 5, 1, true);
          g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir));
          g.translate((p.x + end.x) / 2, (p.y + end.y) / 2, (p.z + end.z) / 2);
          parts.push(g);
          if (depthLeft === 0) return;
          const n = r2.int(2, 3);
          for (let i = 0; i < n; i++) {
            const d2 = dir.clone().add(new THREE.Vector3(r2.float(-0.7, 0.7), r2.float(0.1, 0.5), r2.float(-0.7, 0.7))).normalize();
            branch(end, d2, len * r2.float(0.6, 0.78), rad * 0.62, depthLeft - 1);
          }
        };
        branch(new THREE.Vector3(), new THREE.Vector3(0, 1, 0), 0.9 * scale, 0.07 * scale, 4);
        return mergeGeometries(parts);
      };
      const stages = [
        { name: 'sprout', color: 0x6f8f4e, scale: 0.35, emissive: 0x000000 },
        { name: 'bloom', color: 0x7b6a9a, scale: 1, emissive: 0x2b1f4a },
        { name: 'husk', color: 0x8a8378, scale: 0.95, emissive: 0x000000 },
      ];
      const nearTears = tears.slice(0, Math.max(2, Math.round(tears.length * 0.6)));
      let k = 0;
      for (const t of [{ c: new THREE.Vector2(16, -22), R: 10 }, ...nearTears]) {
        const n = 4 + Math.round(depth * 6);
        for (let i = 0; i < n; i++) {
          const a = fr.float(0, 6.28);
          const r = fr.float(t.R * 0.6, t.R * 1.3);
          const x = t.c.x + Math.cos(a) * r;
          const z = t.c.y + Math.sin(a) * r;
          const s = fr.float(1.0, 2.6) * (t.R === 10 ? 0.9 : 1 + depth);
          const group = new THREE.Group();
          group.position.set(x, height(x, z) - 0.1, z);
          group.rotation.y = fr.float(0, 6.28);
          const phase = fr.float(0, 1);
          for (const [si, st] of stages.entries()) {
            const m = new THREE.Mesh(
              plant(`p${k}`, s * st.scale),
              new THREE.MeshStandardMaterial({ color: st.color, emissive: st.emissive, roughness: 0.7, transparent: true, opacity: 1, depthWrite: si === 1 }),
            );
            m.castShadow = si === 1;
            group.add(m);
            animated.push({ obj: m, cycle: true, phase: phase + si / 3, rate: fr.float(0.05, 0.12) });
          }
          root.add(group);
          k++;
        }
      }
    }

    // ---------- spore fields ----------
    let spores = null;
    if (params.spores > 0) {
      const sp = rng.fork('spores');
      const n = Math.round(4000 + params.spores * 16000);
      const arr = new Float32Array(n * 3);
      const seed = new Float32Array(n);
      for (let i = 0; i < n; i++) {
        // Spores cluster in drifts rather than filling the air evenly.
        const t = sp.pick(tears.length ? tears : [{ c: new THREE.Vector2(0, -60), R: 40 }]);
        const a = sp.float(0, 6.28);
        const r = Math.abs(sp.gauss()) * t.R * 1.3;
        const x = t.c.x + Math.cos(a) * r;
        const z = t.c.y + Math.sin(a) * r;
        arr.set([x, height(x, z) + Math.abs(sp.gauss()) * 4 + 0.3, z], i * 3);
        seed[i] = sp.float(0, 100);
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.BufferAttribute(arr, 3));
      g.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1));
      spores = new THREE.Points(
        g,
        new THREE.ShaderMaterial({
          uniforms: { uTime: { value: 0 }, uNight: { value: params.time === 'Night' ? 1 : 0 } },
          transparent: true,
          depthWrite: false,
          blending: THREE.AdditiveBlending,
          vertexShader: /* glsl */ `
            attribute float aSeed; uniform float uTime; varying float vA;
            void main(){
              vec3 p = position;
              p.x += sin(uTime*0.3 + aSeed) * 1.2; p.z += cos(uTime*0.23 + aSeed*1.3) * 1.2;
              p.y += sin(uTime*0.5 + aSeed*2.1) * 0.6;
              vec4 mv = modelViewMatrix * vec4(p, 1.0);
              gl_PointSize = clamp(90.0 / -mv.z, 1.0, 5.0);
              vA = 0.5 + 0.5 * sin(uTime * 1.7 + aSeed * 5.0);
              gl_Position = projectionMatrix * mv; }`,
          fragmentShader: /* glsl */ `
            uniform float uNight; varying float vA;
            void main(){ vec2 d = gl_PointCoord - 0.5; float a = smoothstep(0.5, 0.0, length(d)) * vA;
              vec3 c = mix(vec3(0.95,0.88,0.6), vec3(0.55,1.0,0.75), uNight);
              gl_FragColor = vec4(c * a * (0.35 + uNight*0.9), a); }`,
        }),
      );
      root.add(spores);
    }

    // ---------- Shaft Five headframe (Amargosa, Domo Syn) ----------
    if (params.shaft && depth < 0.4) {
      const hf = new THREE.Group();
      const steel = new THREE.MeshStandardMaterial({ color: 0x3b3936, roughness: 0.6, metalness: 0.7 });
      const relicrete = new THREE.MeshStandardMaterial({ color: 0x8c8478, roughness: 0.95 });
      const H = 38;
      const legs = [[-5, -5], [5, -5], [-5, 5], [5, 5]];
      const parts = [];
      for (const [x, z] of legs) {
        const g = new THREE.CylinderGeometry(0.35, 0.45, H, 6);
        g.translate(0, H / 2, 0);
        g.applyMatrix4(new THREE.Matrix4().makeShear(0, 0, -x * 0.006, 0, -z * 0.006, 0).setPosition(x, 0, z));
        parts.push(g);
      }
      for (let y = 6; y < H; y += 6) {
        const inset = 5 - y * 0.03;
        for (const [ax, az, len, ry] of [[0, -inset, inset * 2, 0], [0, inset, inset * 2, 0], [-inset, 0, inset * 2, Math.PI / 2], [inset, 0, inset * 2, Math.PI / 2]]) {
          const g = new THREE.BoxGeometry(len, 0.25, 0.25).rotateY(ry);
          g.translate(ax, y, az);
          parts.push(g);
        }
        // cross bracing
        for (const s of [-1, 1]) {
          const g = new THREE.BoxGeometry(0.15, 8.5, 0.15).rotateZ(s * 0.78);
          g.translate(0, y - 3, -inset);
          parts.push(g);
        }
      }
      const frame = new THREE.Mesh(mergeGeometries(parts.map((g) => g.toNonIndexed())), steel);
      frame.castShadow = true;
      hf.add(frame);
      const wheel = new THREE.Mesh(new THREE.TorusGeometry(3.2, 0.3, 8, 32), steel);
      wheel.position.set(0, H + 1, 0);
      hf.add(wheel);
      animated.push({ obj: wheel, rate: 0.4, axis: 'z' });
      const pad = new THREE.Mesh(new THREE.BoxGeometry(26, 1.2, 26), relicrete);
      pad.position.y = 0.4;
      pad.receiveShadow = true;
      hf.add(pad);
      const shed = new THREE.Mesh(new THREE.BoxGeometry(16, 7, 9), relicrete);
      shed.position.set(16, 3.5, 4);
      shed.castShadow = true;
      hf.add(shed);
      // floodlights
      for (const [x, z] of legs) {
        const l = new THREE.PointLight(0xffd8a0, params.time === 'Night' || params.time === 'Dusk' ? 900 : 0, 90, 2);
        l.position.set(x * 1.4, 12, z * 1.4);
        hf.add(l);
        const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.35, 8, 8), new THREE.MeshBasicMaterial({ color: 0xfff0d0 }));
        bulb.position.copy(l.position);
        hf.add(bulb);
      }
      const hx = -42;
      const hz = -175;
      hf.position.set(hx, height(hx, hz), hz);
      hf.rotation.y = 0.4;
      root.add(hf);
    }

    // ---------- sky, sun, the column at ground zero, the Halo ----------
    const sky = new THREE.Mesh(
      new THREE.SphereGeometry(3000, 48, 24),
      new THREE.ShaderMaterial({
        side: THREE.BackSide,
        depthWrite: false,
        fog: false,
        uniforms: {
          uTop: { value: new THREE.Color(T.sky[0]) },
          uHorizon: { value: new THREE.Color(T.sky[1]) },
          uSun: { value: sunDir },
          uSunCol: { value: new THREE.Color(T.sunCol) },
          uDepth: { value: depth },
          uHalo: { value: params.halo ? 1 : 0 },
          uTime: { value: 0 },
        },
        vertexShader: `varying vec3 vDir; void main(){ vDir = normalize(position); gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
        fragmentShader: /* glsl */ `
          uniform vec3 uTop, uHorizon, uSun, uSunCol; uniform float uDepth, uHalo, uTime; varying vec3 vDir;
          ${GLSL_NOISE}
          void main(){
            float h = max(vDir.y, 0.0);
            vec3 c = mix(uHorizon, uTop, pow(h, 0.55));
            float sd = max(dot(vDir, uSun), 0.0);
            c += uSunCol * (pow(sd, 900.0) * 6.0 + pow(sd, 12.0) * 0.35);
            // Dimensional bleed: slow sheets of interference across the sky.
            float b = fbm3(vec3(vDir.xz * 3.0 / (vDir.y + 0.25), uTime * 0.02));
            c += vec3(0.45, 0.5, 1.0) * smoothstep(0.15, 0.6, b) * uDepth * 0.25 * h;
            // The Halo: a faint geometric pattern of nodes around the sun.
            if (uHalo > 0.5) {
              float ang = acos(clamp(dot(vDir, uSun), -1.0, 1.0));
              float ring = exp(-pow((ang - 0.21) * 90.0, 2.0)) + exp(-pow((ang - 0.27) * 120.0, 2.0)) * 0.6;
              vec3 t1 = normalize(cross(uSun, vec3(0.0, 1.0, 0.0)));
              vec3 t2 = cross(uSun, t1);
              float az = atan(dot(vDir, t2), dot(vDir, t1));
              float nodes = pow(abs(cos(az * 18.0)), 40.0);
              c += uSunCol * ring * (0.06 + nodes * 0.35);
            }
            gl_FragColor = vec4(c, 1.0);
          }`,
      }),
    );
    root.add(sky);

    // Ground zero: where Virtue touches physical reality. Always on the
    // horizon; it grows nearer and brighter with depth.
    const column = new THREE.Mesh(
      new THREE.CylinderGeometry(1, 1, 1, 48, 1, true),
      new THREE.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        fog: false,
        uniforms: { uTime: { value: 0 }, uK: { value: 0.3 + depth * 1.3 } },
        vertexShader: `varying vec2 vUv; varying vec3 vN; varying vec3 vV; void main(){ vUv = uv; vN = normalize(normalMatrix*normal); vec4 mv = modelViewMatrix*vec4(position,1.0); vV = normalize(-mv.xyz); gl_Position = projectionMatrix*mv; }`,
        fragmentShader: /* glsl */ `
          uniform float uTime, uK; varying vec2 vUv; varying vec3 vN; varying vec3 vV;
          ${GLSL_NOISE}
          void main(){
            float edge = pow(1.0 - abs(dot(vN, vV)), 1.5);
            float core = pow(abs(dot(vN, vV)), 6.0);
            float n = fbm3(vec3(vUv.x * 6.0, vUv.y * 3.0 - uTime * 0.05, uTime * 0.03));
            float fade = smoothstep(0.0, 0.08, vUv.y) * (1.0 - smoothstep(0.6, 1.0, vUv.y));
            float a = (edge * 0.5 + core * 0.4) * (0.6 + 0.6 * n) * fade * uK;
            gl_FragColor = vec4(vec3(0.85, 0.9, 1.0) * a, a);
          }`,
      }),
    );
    const gzDist = 2600 - depth * 1500;
    column.scale.set(60 + depth * 160, 2400, 60 + depth * 160);
    column.position.set(-120, 900, -gzDist);
    root.add(column);

    // ---------- light and air ----------
    const sun = new THREE.DirectionalLight(T.sunCol, T.int);
    sun.position.copy(sunDir).multiplyScalar(400);
    sun.castShadow = true;
    sun.shadow.mapSize.set(4096, 4096);
    Object.assign(sun.shadow.camera, { left: -300, right: 300, top: 300, bottom: -300, near: 10, far: 1200 });
    sun.shadow.bias = -0.0005;
    root.add(sun, sun.target);
    root.add(new THREE.HemisphereLight(T.sky[0], 0x6b5a48, T.hemi));
    stage.scene.background = new THREE.Color(T.fog);
    stage.scene.fog = new THREE.FogExp2(T.fog, 0.0007 + depth * 0.0007);

    return {
      object: root,
      exposure: params.time === 'Night' ? 1.6 : 1,
      bloomScale: 0.8,
      cameras: {
        'Eye level': { position: [0, 2.2, 40], target: [0, 8, -120], lens: 32 },
        'Long lens to ground zero': { position: [0, 6, 60], target: [-60, 60, -900], lens: 135 },
        'Aerial': { position: [220, 140, 260], target: [0, 0, -100], lens: 28 },
        'Under the fold': { position: [tears[2]?.c.x + 30 || 0, (tears[2] ? height(tears[2].c.x + 30, tears[2].c.y + 30) : 0) + 2, (tears[2]?.c.y || 0) + 30], target: [tears[2]?.c.x || 0, 40, tears[2]?.c.y || 0], lens: 24 },
      },
      update(t) {
        for (const a of animated) {
          if (a.cycle) {
            // lifecycle states fading through one another
            const k = (t * a.rate + a.phase) % 1;
            a.obj.material.opacity = Math.max(0, Math.sin(k * Math.PI)) ** 1.5;
            a.obj.visible = a.obj.material.opacity > 0.02;
          } else if (a.bob) {
            a.obj.position.y = a.y + Math.sin(t * a.bob) * 1.5;
          } else {
            a.obj.rotation[a.axis] += a.rate * 0.016;
          }
        }
        sky.material.uniforms.uTime.value = t;
        column.material.uniforms.uTime.value = t;
        if (spores) spores.material.uniforms.uTime.value = t;
      },
      hud() {
        return [`depth ${Math.round(depth * 100)}% toward ground zero · ${tears.length} tears · ${ASYLUM.rimSector.split('.')[0]}`];
      },
    };
  },
};
