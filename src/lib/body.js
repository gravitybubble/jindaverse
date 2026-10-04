// A humanoid built from tapered capsules. Used as:
//   - the volume a Jinda's motes pack into,
//   - the surface the tactical aura's humanoid wireframe is sampled from,
//   - a plain mannequin for human figures (targets, stand-ins, crowd).
// Units are metres, feet on y = 0, facing +z.
import * as THREE from 'three';

// Proportions as fractions of height. Each limb: [ax, ay, az, bx, by, bz, ra, rb, zScale]
function skeleton(H, build, shoulder) {
  const w = 0.85 + build * 0.3; // girth multiplier
  const sw = 0.11 + shoulder * 0.05; // half shoulder width
  const hw = 0.055 + (1 - shoulder) * 0.018; // half hip width
  const L = [
    // head and neck
    ['head', 0, 0.9, 0.008, 0, 0.952, 0.0, 0.05, 0.047, 1.12],
    ['neck', 0, 0.83, 0, 0, 0.9, 0.005, 0.028 * w, 0.026 * w, 1],
    // torso
    ['chest', -sw * 0.45, 0.765, 0, sw * 0.45, 0.765, 0, 0.068 * w, 0.068 * w, 0.75],
    ['ribs', 0, 0.66, 0, 0, 0.76, 0, 0.075 * w, 0.072 * w, 0.72],
    ['waist', 0, 0.56, 0, 0, 0.66, 0, 0.066 * w, 0.074 * w, 0.72],
    ['pelvis', -hw * 0.55, 0.53, 0, hw * 0.55, 0.53, 0, 0.068 * w, 0.068 * w, 0.75],
    // arms (slight A-pose)
    ['uarmL', sw, 0.8, 0, sw + 0.025, 0.635, -0.005, 0.029 * w, 0.024 * w, 1],
    ['farmL', sw + 0.025, 0.635, -0.005, sw + 0.045, 0.48, 0.02, 0.024 * w, 0.018 * w, 1],
    ['handL', sw + 0.045, 0.48, 0.02, sw + 0.05, 0.4, 0.025, 0.021, 0.017, 0.6],
    ['uarmR', -sw, 0.8, 0, -sw - 0.025, 0.635, -0.005, 0.029 * w, 0.024 * w, 1],
    ['farmR', -sw - 0.025, 0.635, -0.005, -sw - 0.045, 0.48, 0.02, 0.024 * w, 0.018 * w, 1],
    ['handR', -sw - 0.045, 0.48, 0.02, -sw - 0.05, 0.4, 0.025, 0.021, 0.017, 0.6],
    // legs
    ['thighL', hw, 0.5, 0, hw + 0.005, 0.28, 0.005, 0.052 * w, 0.036 * w, 1],
    ['shinL', hw + 0.005, 0.28, 0.005, hw + 0.008, 0.045, -0.005, 0.036 * w, 0.024 * w, 1],
    ['footL', hw + 0.008, 0.03, -0.01, hw + 0.012, 0.018, 0.075, 0.022, 0.019, 0.8],
    ['thighR', -hw, 0.5, 0, -hw - 0.005, 0.28, 0.005, 0.052 * w, 0.036 * w, 1],
    ['shinR', -hw - 0.005, 0.28, 0.005, -hw - 0.008, 0.045, -0.005, 0.036 * w, 0.024 * w, 1],
    ['footR', -hw - 0.008, 0.03, -0.01, -hw - 0.012, 0.018, 0.075, 0.022, 0.019, 0.8],
  ];
  return L.map(([name, ax, ay, az, bx, by, bz, ra, rb, zs]) => ({
    name,
    a: new THREE.Vector3(ax * H, ay * H, az * H),
    b: new THREE.Vector3(bx * H, by * H, bz * H),
    ra: ra * H,
    rb: rb * H,
    zs,
  }));
}

export class Body {
  constructor({ height = 1.75, build = 0.4, shoulder = 0.5 } = {}) {
    this.height = height;
    this.limbs = skeleton(height, build, shoulder);
    // Core sits at centre mass, behind the sternum (POWER §2 Manifestation).
    this.corePos = new THREE.Vector3(0, height * 0.735, 0.01 * height);
    this.box = new THREE.Box3();
    for (const l of this.limbs) {
      this.box.expandByPoint(l.a.clone().addScalar(-l.ra));
      this.box.expandByPoint(l.b.clone().addScalar(l.rb));
      this.box.expandByPoint(l.a.clone().addScalar(l.ra));
      this.box.expandByPoint(l.b.clone().addScalar(-l.rb));
    }
  }

  // Signed depth: > 0 inside (how far below the surface), < 0 outside.
  depth(p) {
    let best = -Infinity;
    const ab = new THREE.Vector3();
    const ap = new THREE.Vector3();
    for (const l of this.limbs) {
      ab.subVectors(l.b, l.a);
      ap.subVectors(p, l.a);
      const t = Math.max(0, Math.min(1, ap.dot(ab) / ab.lengthSq()));
      const cx = l.a.x + ab.x * t;
      const cy = l.a.y + ab.y * t;
      const cz = l.a.z + ab.z * t;
      const dx = p.x - cx;
      const dy = p.y - cy;
      const dz = (p.z - cz) / l.zs;
      const d = Math.sqrt(dx * dx + dy * dy + dz * dz);
      const r = l.ra + (l.rb - l.ra) * t;
      best = Math.max(best, r - d);
    }
    return best;
  }

  // Outward surface normal by central differences of the depth field.
  normal(p, h = 0.004) {
    const d = (x, y, z) => this.depth(new THREE.Vector3(p.x + x, p.y + y, p.z + z));
    return new THREE.Vector3(d(-h, 0, 0) - d(h, 0, 0), d(0, -h, 0) - d(0, h, 0), d(0, 0, -h) - d(0, 0, h)).normalize();
  }

  // Random points on the body surface, area-weighted. Returns
  // { points: Vector3[], normals: Vector3[], limb: index[] }.
  sampleSurface(rng, n) {
    const areas = this.limbs.map((l) => (l.ra + l.rb) * Math.PI * (l.a.distanceTo(l.b) + (l.ra + l.rb)));
    const total = areas.reduce((a, b) => a + b, 0);
    const points = [];
    const normals = [];
    const limb = [];
    const tries = n * 8;
    for (let i = 0; i < tries && points.length < n; i++) {
      let r = rng.float(0, total);
      let k = 0;
      while (r > areas[k]) r -= areas[k++];
      const l = this.limbs[k];
      const t = rng.float(-0.15, 1.15);
      const tc = Math.max(0, Math.min(1, t));
      const axis = new THREE.Vector3().subVectors(l.b, l.a);
      const c = l.a.clone().addScaledVector(axis, tc);
      const [x, y, z] = rng.unitVector();
      const dir = new THREE.Vector3(x, y, z);
      // remove axial component except at the caps
      if (t >= 0 && t <= 1) {
        const an = axis.clone().normalize();
        dir.addScaledVector(an, -dir.dot(an)).normalize();
      }
      const rad = l.ra + (l.rb - l.ra) * tc;
      const p = c.addScaledVector(dir, rad);
      p.z = c.z + (p.z - c.z) * l.zs;
      // keep only points actually on the outer union surface
      if (Math.abs(this.depth(p)) < rad * 0.08 + 0.004) {
        points.push(p);
        normals.push(this.normal(p));
        limb.push(k);
      }
    }
    return { points, normals, limb };
  }

  // A structured surface lattice: rings around every limb, staggered so the
  // strands triangulate, with points buried inside another limb dropped so
  // only the outer silhouette remains. Returns { points, normals, edges }.
  surfaceLattice(spacing) {
    const points = [];
    const normals = [];
    const edges = [];
    const up = new THREE.Vector3(0, 1, 0);
    for (const l of this.limbs) {
      const axis = new THREE.Vector3().subVectors(l.b, l.a);
      const L = axis.length();
      const an = axis.clone().normalize();
      const u = new THREE.Vector3().crossVectors(an, Math.abs(an.y) > 0.9 ? new THREE.Vector3(1, 0, 0) : up).normalize();
      const w = new THREE.Vector3().crossVectors(an, u);
      const rMax = Math.max(l.ra, l.rb);
      const m = Math.max(7, Math.round((2 * Math.PI * rMax) / spacing));
      // Rings run over the shaft plus a domed cap at each end.
      const capA = l.ra * 0.8;
      const capB = l.rb * 0.8;
      const span = L + capA + capB;
      const R = Math.max(2, Math.round(span / spacing) + 1);
      const ids = [];
      for (let i = 0; i < R; i++) {
        const sAlong = -capA + (span * i) / (R - 1);
        const t = Math.max(0, Math.min(1, sAlong / L));
        let r = l.ra + (l.rb - l.ra) * t;
        if (sAlong < 0) r *= Math.sqrt(Math.max(0, 1 - (sAlong / l.ra) ** 2));
        if (sAlong > L) r *= Math.sqrt(Math.max(0, 1 - ((sAlong - L) / l.rb) ** 2));
        const c = l.a.clone().addScaledVector(an, sAlong);
        const row = [];
        for (let j = 0; j < m; j++) {
          const th = ((j + (i % 2) * 0.5) / m) * Math.PI * 2;
          const off = u.clone().multiplyScalar(Math.cos(th) * r).addScaledVector(w, Math.sin(th) * r);
          off.z *= l.zs;
          const p = c.clone().add(off);
          if (r < 1e-4 || Math.abs(this.depth(p)) > Math.max(0.006, r * 0.06)) {
            row.push(-1);
            continue;
          }
          row.push(points.length);
          points.push(p);
          normals.push(this.normal(p));
        }
        ids.push(row);
      }
      for (let i = 0; i < R; i++) {
        for (let j = 0; j < m; j++) {
          const A = ids[i][j];
          if (A < 0) continue;
          const B = ids[i][(j + 1) % m];
          if (B >= 0) edges.push([A, B]);
          if (i + 1 < R) {
            // staggered rows: connect to the two nearest on the next ring
            const C = ids[i + 1][j];
            const D = ids[i + 1][(j + (i % 2 ? 1 : m - 1)) % m];
            if (C >= 0) edges.push([A, C]);
            if (D >= 0) edges.push([A, D]);
          }
        }
      }
    }
    return { points, normals, edges };
  }

  // Body-centred-cubic lattice inside the body: the packing that makes
  // truncated-octahedron (Kelvin) cells tile space.
  bccLattice(a) {
    const out = [];
    const { min, max } = this.box;
    const p = new THREE.Vector3();
    for (let x = min.x; x <= max.x; x += a) {
      for (let y = min.y; y <= max.y; y += a) {
        for (let z = min.z; z <= max.z; z += a) {
          for (const o of [0, 0.5]) {
            p.set(x + o * a, y + o * a, z + o * a);
            const d = this.depth(p);
            if (d > -a * 0.18) out.push({ pos: p.clone(), depth: d });
          }
        }
      }
    }
    return out;
  }

  // A plain human stand-in: matte capsules.
  mannequin(material) {
    const g = new THREE.Group();
    for (const l of this.limbs) {
      const len = l.a.distanceTo(l.b);
      const geo = new THREE.CapsuleGeometry((l.ra + l.rb) / 2, len, 6, 14);
      const m = new THREE.Mesh(geo, material);
      m.position.copy(l.a).lerp(l.b, 0.5);
      m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3().subVectors(l.b, l.a).normalize());
      m.scale.z = l.zs;
      m.castShadow = true;
      m.receiveShadow = true;
      g.add(m);
    }
    return g;
  }
}
