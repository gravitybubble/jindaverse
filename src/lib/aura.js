// TACTICAL AURA (POWER §10) and GROUNDING (POWER §7).
//
// The aura is the Jinda's form echoed outward as a plexus: nested humanoid
// shells scaled up from the core, dense near the body and sparse at the edge,
// with a small buckyball cage around the core echoing its geometry.
//
// Activation: stillness → core pulse → first ring → successive rings, going
// three-dimensional → the humanoid web reveals outward from the core and holds.
//
// Grounding: nothing travels from Jinda to target. Light runs outward along
// the strands that already touch the target, arriving from several directions
// at once over about half a second. Discharging collapses the aura.
import * as THREE from 'three';
import { truncatedIcosahedron } from './polyhedra.js';
import { GLSL_NOISE } from './noise.js';

const lin = (t0, t1, t) => Math.max(0, Math.min(1, (t - t0) / (t1 - t0)));

export class Aura {
  constructor({ body, rng, extent, shells, nodesPerShell = 150, color = '#b9b4ff', deadZones = 0, fragments = 0 }) {
    this.body = body;
    this.extent = extent;
    this.core = body.corePos.clone();
    this.group = new THREE.Group();

    // ---- nodes ----
    // Shell scale factors grow geometrically from just outside the skin to
    // the full extent, so density falls off with distance from the body.
    // Each shell is the body scaled from the core *and* inflated along its
    // normals: humanoid near the body (the aura-arm reaches past the arm),
    // rounding toward the spherical field further out (POWER §2.5).
    const reach = this.core.y; // core-to-feet distance: the body's longest arm from the core
    const inflate = 0.3; // metres of offset per unit of scale
    const sMax = Math.max(1.25, extent / (reach + inflate));
    const scales = [];
    for (let k = 0; k < shells; k++) scales.push(1.08 * Math.pow(sMax / 1.08, shells === 1 ? 1 : k / (shells - 1)));
    const nodes = [{ p: this.core.clone(), shell: -1 }];
    const shellNodes = [];
    const edges = [];
    const addEdge = (i, j) => {
      if (i !== j) edges.push([Math.min(i, j), Math.max(i, j)]);
    };
    for (let k = 0; k < shells; k++) {
      // Sparser at the edges: lattice spacing (measured on the body) widens
      // with each shell, on top of the geometric scale-up.
      const spacing = 0.06 * (1 + 0.3 * k) * (nodesPerShell < 120 ? 1.3 : 1);
      const lat = body.surfaceLattice(spacing);
      const ids = [];
      for (let i = 0; i < lat.points.length; i++) {
        const s = lat.points[i];
        const p = this.core.clone().add(s.clone().sub(this.core).multiplyScalar(scales[k]));
        p.addScaledVector(lat.normals[i], (scales[k] - 1) * inflate);
        ids.push(nodes.length);
        nodes.push({ p, shell: k, s });
      }
      for (const [i, j] of lat.edges) addEdge(ids[i], ids[j]);
      shellNodes.push(ids);
    }
    // Between shells: sparse radial strands, the web's spokes.
    const sr = rng.fork('radial');
    for (let k = 0; k + 1 < shells; k++) {
      const next = shellNodes[k + 1];
      for (const i of shellNodes[k]) {
        if (!sr.chance(0.12)) continue;
        let best = -1;
        let bd = Infinity;
        for (const j of next) {
          const d = nodes[i].s.distanceToSquared(nodes[j].s);
          if (d < bd) { bd = d; best = j; }
        }
        addEdge(i, best);
      }
    }
    // Core to the first shell.
    for (const i of rng.fork('spokes').shuffle([...shellNodes[0]]).slice(0, 18)) addEdge(0, i);

    // Buckyball cage around the core, part of the same graph.
    const bucky = truncatedIcosahedron();
    const cageR = 0.16;
    const base = nodes.length;
    for (const v of bucky.vertices) nodes.push({ p: this.core.clone().addScaledVector(v, cageR), shell: -0.5 });
    for (const [i, j] of bucky.edges) addEdge(base + i, base + j);
    for (let i = 0; i < 12; i++) addEdge(0, base + i * 5);

    // dedupe
    const seen = new Set();
    this.edges = edges.filter(([i, j]) => {
      const key = i * 100000 + j;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
    this.nodes = nodes;

    // adjacency for grounding paths
    this.adj = nodes.map(() => []);
    for (const [i, j] of this.edges) {
      const w = nodes[i].p.distanceTo(nodes[j].p);
      this.adj[i].push([j, w]);
      this.adj[j].push([i, w]);
    }

    // ---- geometry ----
    const pos = new Float32Array(this.edges.length * 6);
    const dist = new Float32Array(this.edges.length * 2);
    const charge = new Float32Array(this.edges.length * 2).fill(-1);
    const shell = new Float32Array(this.edges.length * 2);
    this.edges.forEach(([i, j], e) => {
      for (const [k, n] of [[0, i], [1, j]]) {
        const p = nodes[n].p;
        pos.set([p.x, p.y, p.z], e * 6 + k * 3);
        dist[e * 2 + k] = p.distanceTo(this.core) / extent;
        shell[e * 2 + k] = nodes[n].shell;
      }
    });
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('aDist', new THREE.BufferAttribute(dist, 1));
    geo.setAttribute('aCharge', new THREE.BufferAttribute(charge, 1));
    geo.setAttribute('aShell', new THREE.BufferAttribute(shell, 1));
    this.geo = geo;

    this.uniforms = {
      uTime: { value: 0 },
      uReveal: { value: 0 },
      uCharge: { value: -1 },
      uColor: { value: new THREE.Color(color) },
      uChargeColor: { value: new THREE.Color('#fff4e0') },
      uSpend: { value: 0 },
      uDead: { value: deadZones },
      uFragments: { value: fragments },
      uSpike: { value: 0 },
      uCore: { value: this.core },
    };
    this.material = new THREE.ShaderMaterial({
      uniforms: this.uniforms,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      vertexShader: /* glsl */ `
        attribute float aDist; attribute float aCharge; attribute float aShell;
        varying float vDist; varying float vCharge; varying float vShell; varying vec3 vPos;
        void main(){ vDist = aDist; vCharge = aCharge; vShell = aShell; vPos = position;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
      fragmentShader: /* glsl */ `
        uniform float uTime, uReveal, uCharge, uSpend, uDead, uFragments, uSpike;
        uniform vec3 uColor, uChargeColor;
        varying float vDist; varying float vCharge; varying float vShell; varying vec3 vPos;
        ${GLSL_NOISE}
        void main(){
          // Reveal front travels outward from the core.
          float front = uReveal * 1.15;
          float shown = 1.0 - smoothstep(front - 0.04, front, vDist);
          float edgeFlash = smoothstep(front - 0.12, front, vDist) * shown;
          // Dense near the body, sparse at the edge.
          float density = mix(1.0, 0.28, smoothstep(0.0, 1.0, vDist));
          float a = shown * density * (0.55 + 1.2 * edgeFlash);
          // Exhaustion: the web thins and stutters.
          float stutter = step(uSpend * 0.85, fract(sin(dot(floor(vPos*3.0), vec3(12.9,78.2,37.7)) + floor(uTime*12.0)) * 43758.5));
          a *= mix(1.0, stutter, uSpend);
          // Dead zones (a damaged scaffold): holes in the field.
          float dz = snoise(vPos * 0.35 + vec3(0.0, uTime*0.05, 0.0));
          a *= 1.0 - uDead * smoothstep(0.15, 0.35, dz);
          vec3 col = uColor;
          // Fragment intrusions: warm, foreign patches drifting through the web.
          float fr = smoothstep(0.55, 0.75, snoise(vPos * 0.6 + vec3(uTime*0.3, 0.0, uTime*0.17)));
          col = mix(col, vec3(1.0, 0.55, 0.35), fr * uFragments);
          // Grounding: the charge runs the strands toward the target.
          if (vCharge >= 0.0 && uCharge >= 0.0) {
            float lit = 1.0 - smoothstep(uCharge - 0.02, uCharge, vCharge);
            float head = exp(-pow((vCharge - uCharge) * 18.0, 2.0));
            col = mix(col, uChargeColor, lit);
            // Light travelling the geometry, not lightning: a modest lit
            // trail with a brighter leading edge.
            a = max(a, lit * 0.75 + head * 1.3);
          }
          a *= 1.0 + uSpike * 2.5;
          gl_FragColor = vec4(col * a, a);
        }`,
    });
    this.lines = new THREE.LineSegments(geo, this.material);
    this.lines.frustumCulled = false;
    this.group.add(this.lines);

    this.convergence = new THREE.LineSegments(
      new THREE.BufferGeometry(),
      new THREE.LineBasicMaterial({ color: '#fff4e0', transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }),
    );
    this.convergence.frustumCulled = false;
    this.group.add(this.convergence);

    // Activation rings: first in the horizontal plane, then tilting into 3D.
    this.rings = [];
    const ringGeo = new THREE.BufferGeometry().setFromPoints(
      Array.from({ length: 129 }, (_, i) => new THREE.Vector3(Math.cos((i / 128) * Math.PI * 2), 0, Math.sin((i / 128) * Math.PI * 2))),
    );
    for (let i = 0; i < 5; i++) {
      const m = new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false });
      const ring = new THREE.Line(ringGeo, m);
      ring.position.copy(this.core);
      ring.rotation.set(i === 0 ? 0 : (i * 0.7) % Math.PI, i * 1.1, i === 0 ? 0 : 0.35 * i);
      ring.visible = false;
      this.rings.push(ring);
      this.group.add(ring);
    }

    this.state = 'off';
    this.t0 = 0;
    this.onCorePulse = null;
  }

  // ---- sequences ----
  activate(t) {
    this.state = 'activating';
    this.t0 = t;
    this.uniforms.uCharge.value = -1;
  }

  collapse(t) {
    this.state = 'collapsing';
    this.t0 = t;
    this.collapseFrom = this.uniforms.uReveal.value;
  }

  // Compute and arm the grounding paths to a world-space target point.
  ground(t, target, { directions = 6 } = {}) {
    if (this.state !== 'held') return false;
    const local = this.group.worldToLocal(target.clone());
    // Dijkstra from the core node.
    const n = this.nodes.length;
    const d = new Float32Array(n).fill(Infinity);
    const prev = new Int32Array(n).fill(-1);
    const done = new Uint8Array(n);
    d[0] = 0;
    for (let it = 0; it < n; it++) {
      let u = -1;
      let best = Infinity;
      for (let i = 0; i < n; i++) if (!done[i] && d[i] < best) { best = d[i]; u = i; }
      if (u < 0) break;
      done[u] = 1;
      for (const [v, w] of this.adj[u]) if (d[u] + w < d[v]) { d[v] = d[u] + w; prev[v] = u; }
    }
    // Candidate endpoints: reachable nodes near the target, picked for
    // spread of approach direction so the charge converges from several sides.
    const near = this.nodes
      .map((nd, i) => ({ i, r: nd.p.distanceTo(local) }))
      .filter((x) => isFinite(d[x.i]) && x.r < Math.max(1.6, this.extent * 0.22))
      .sort((a, b) => a.r - b.r)
      .slice(0, 60);
    if (!near.length) return false;
    const picked = [near[0].i];
    const dirOf = (i) => this.nodes[i].p.clone().sub(local).normalize();
    while (picked.length < Math.min(directions, near.length)) {
      let best = null;
      let bestScore = -Infinity;
      for (const { i } of near) {
        if (picked.includes(i)) continue;
        const di = dirOf(i);
        const score = Math.min(...picked.map((j) => 1 - di.dot(dirOf(j))));
        if (score > bestScore) { bestScore = score; best = i; }
      }
      picked.push(best);
    }
    const onPath = new Map();
    let maxD = 0;
    for (const end of picked) {
      for (let v = end; v > 0; v = prev[v]) {
        const u = prev[v];
        if (u < 0) break;
        onPath.set(u < v ? u * 100000 + v : v * 100000 + u, true);
      }
      maxD = Math.max(maxD, d[end]);
    }
    const charge = this.geo.attributes.aCharge;
    this.edges.forEach(([i, j], e) => {
      const hit = onPath.has(i * 100000 + j);
      charge.array[e * 2] = hit ? d[i] / maxD : -1;
      charge.array[e * 2 + 1] = hit ? d[j] / maxD : -1;
    });
    charge.needsUpdate = true;
    // Final strands from each endpoint into the target: where the web
    // already touches it. The charge arrives along these from several sides.
    const conv = [];
    for (const i of picked) {
      const p = this.nodes[i].p;
      conv.push(p.x, p.y, p.z, local.x, local.y, local.z);
    }
    this.convergence.geometry.setAttribute('position', new THREE.Float32BufferAttribute(conv, 3));
    this.convergence.geometry.computeBoundingSphere();
    this.state = 'grounding';
    this.t0 = t;
    return true;
  }

  update(t, { spend = 0 } = {}) {
    const u = this.uniforms;
    u.uTime.value = t;
    u.uSpend.value = spend;
    const e = t - this.t0;
    for (const r of this.rings) r.visible = false;
    this.convergence.material.opacity = 0;
    if (this.state === 'activating') {
      // 0.00–0.25 decision (stillness) · 0.25–0.37 core pulse ·
      // 0.37–0.62 first ring · 0.5–0.9 successive rings · 0.6–1.15 web reveal
      if (e > 0.25 && e < 0.37 && this.onCorePulse) this.onCorePulse((e - 0.25) / 0.12);
      this.rings.forEach((r, i) => {
        const s0 = 0.37 + i * 0.09;
        const k = lin(s0, s0 + 0.22, e);
        if (k > 0 && k < 1) {
          r.visible = true;
          const R = this.extent * (0.15 + 0.35 * k) * (i === 0 ? 0.8 : 1);
          r.scale.setScalar(R);
          r.material.opacity = (1 - k) * 0.9;
        }
      });
      u.uReveal.value = lin(0.6, 1.15, e);
      if (e > 1.15) this.state = 'held';
    } else if (this.state === 'held') {
      u.uReveal.value = 1;
    } else if (this.state === 'grounding') {
      u.uCharge.value = lin(0, 0.5, e) * 1.02;
      this.convergence.material.opacity = lin(0.4, 0.5, e);
      if (e > 0.5) {
        this.state = 'discharging';
        this.t0 = t;
      }
    } else if (this.state === 'discharging') {
      // The charge closes and holds (duration, not impact), then the web
      // collapses: discharging the structure costs the structure.
      u.uCharge.value = 1.02;
      this.convergence.material.opacity = 0.7 + 0.3 * Math.random();
      if (e > 1.1) this.collapse(t);
    } else if (this.state === 'collapsing') {
      u.uReveal.value = this.collapseFrom * (1 - lin(0, 0.14, e));
      if (e > 0.14) {
        this.state = 'off';
        u.uCharge.value = -1;
      }
    } else {
      u.uReveal.value = 0;
    }
  }
}
