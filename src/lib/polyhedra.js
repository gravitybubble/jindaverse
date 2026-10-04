// The two shapes JINDA's physics is built on.
//   Truncated icosahedron — the core (Power Systems §1, "buckyball sphere").
//   Truncated octahedron  — the mote's packed form (§3, "Kelvin cell").
import * as THREE from 'three';

const PHI = (1 + Math.sqrt(5)) / 2;

function icosahedron() {
  const v = [
    [-1, PHI, 0], [1, PHI, 0], [-1, -PHI, 0], [1, -PHI, 0],
    [0, -1, PHI], [0, 1, PHI], [0, -1, -PHI], [0, 1, -PHI],
    [PHI, 0, -1], [PHI, 0, 1], [-PHI, 0, -1], [-PHI, 0, 1],
  ].map((p) => new THREE.Vector3(...p));
  const f = [
    [0, 11, 5], [0, 5, 1], [0, 1, 7], [0, 7, 10], [0, 10, 11],
    [1, 5, 9], [5, 11, 4], [11, 10, 2], [10, 7, 6], [7, 1, 8],
    [3, 9, 4], [3, 4, 2], [3, 2, 6], [3, 6, 8], [3, 8, 9],
    [4, 9, 5], [2, 4, 11], [6, 2, 10], [8, 6, 7], [9, 8, 1],
  ];
  return { v, f };
}

// Returns { vertices: Vector3[], faces: number[][] (CCW from outside),
// edges: [i,j][] } for a truncated icosahedron of circumradius 1.
export function truncatedIcosahedron() {
  const { v, f } = icosahedron();
  const vertices = [];
  const key = new Map();
  // Point on edge a->b, one third of the way from a.
  const third = (a, b) => {
    const k = `${a}>${b}`;
    if (!key.has(k)) {
      key.set(k, vertices.length);
      vertices.push(v[a].clone().lerp(v[b], 1 / 3));
    }
    return key.get(k);
  };
  const faces = [];
  // Hexagons: one per icosahedron face.
  for (const [a, b, c] of f) {
    faces.push([third(a, b), third(b, a), third(b, c), third(c, b), third(c, a), third(a, c)]);
  }
  // Pentagons: one per icosahedron vertex, ring of its neighbours sorted by angle.
  for (let i = 0; i < v.length; i++) {
    const nbrs = new Set();
    for (const tri of f) if (tri.includes(i)) tri.forEach((j) => j !== i && nbrs.add(j));
    const n = v[i].clone().normalize();
    const ref = new THREE.Vector3().subVectors([...nbrs].map((j) => v[j])[0], v[i]);
    ref.sub(n.clone().multiplyScalar(ref.dot(n))).normalize();
    const ref2 = new THREE.Vector3().crossVectors(n, ref);
    const ring = [...nbrs]
      .map((j) => {
        const d = new THREE.Vector3().subVectors(v[j], v[i]);
        return { j, ang: Math.atan2(d.dot(ref2), d.dot(ref)) };
      })
      .sort((p, q) => p.ang - q.ang)
      .map(({ j }) => third(i, j));
    faces.push(ring);
  }
  const r = vertices[0].length();
  vertices.forEach((p) => p.divideScalar(r));
  for (const face of faces) orientOutward(vertices, face);
  return { vertices, faces, edges: edgesOf(faces) };
}

// Truncated octahedron: all permutations of (0, ±1, ±2). Circumradius sqrt(5).
export function truncatedOctahedron() {
  const vertices = [];
  const seen = new Set();
  const perms = [[0, 1, 2], [0, 2, 1], [1, 0, 2], [1, 2, 0], [2, 0, 1], [2, 1, 0]];
  for (const s1 of [-1, 1]) {
    for (const s2 of [-1, 1]) {
      const base = [0, s1 * 1, s2 * 2];
      for (const p of perms) {
        const c = [base[p[0]], base[p[1]], base[p[2]]];
        const k = c.join(',');
        if (!seen.has(k)) {
          seen.add(k);
          vertices.push(new THREE.Vector3(...c));
        }
      }
    }
  }
  // Faces: group vertices by supporting plane. Square faces have normals along
  // axes (|n|=2 plane), hexagons along (±1,±1,±1) (plane at 3).
  const faces = [];
  const normals = [];
  for (const a of [0, 1, 2]) for (const s of [-1, 1]) {
    const n = [0, 0, 0];
    n[a] = s;
    normals.push({ n: new THREE.Vector3(...n), d: 2 });
  }
  for (const x of [-1, 1]) for (const y of [-1, 1]) for (const z of [-1, 1]) {
    normals.push({ n: new THREE.Vector3(x, y, z), d: 3 });
  }
  for (const { n, d } of normals) {
    const idx = vertices.map((p, i) => [p.dot(n), i]).filter(([dot]) => Math.abs(dot - d) < 1e-6).map(([, i]) => i);
    const c = idx.reduce((acc, i) => acc.add(vertices[i]), new THREE.Vector3()).divideScalar(idx.length);
    const u = new THREE.Vector3().subVectors(vertices[idx[0]], c).normalize();
    const w = new THREE.Vector3().crossVectors(n.clone().normalize(), u);
    idx.sort((i, j) => {
      const a = vertices[i].clone().sub(c);
      const b = vertices[j].clone().sub(c);
      return Math.atan2(a.dot(w), a.dot(u)) - Math.atan2(b.dot(w), b.dot(u));
    });
    faces.push(idx);
  }
  const r = Math.sqrt(5);
  vertices.forEach((p) => p.divideScalar(r));
  for (const face of faces) orientOutward(vertices, face);
  return { vertices, faces, edges: edgesOf(faces) };
}

function orientOutward(vertices, face) {
  const [a, b, c] = face.map((i) => vertices[i]);
  const n = new THREE.Vector3().subVectors(b, a).cross(new THREE.Vector3().subVectors(c, a));
  const centroid = face.reduce((acc, i) => acc.add(vertices[i]), new THREE.Vector3());
  if (n.dot(centroid) < 0) face.reverse();
}

function edgesOf(faces) {
  const set = new Map();
  for (const face of faces) {
    for (let i = 0; i < face.length; i++) {
      const a = face[i];
      const b = face[(i + 1) % face.length];
      const k = a < b ? `${a}-${b}` : `${b}-${a}`;
      if (!set.has(k)) set.set(k, [Math.min(a, b), Math.max(a, b)]);
    }
  }
  return [...set.values()];
}

// Flat-shaded BufferGeometry from a polyhedron. Each face is fan-triangulated
// and carries a `faceId` attribute plus planar UVs centred on the face.
export function polyhedronGeometry({ vertices, faces }, scale = 1) {
  const pos = [];
  const nor = [];
  const uv = [];
  const fid = [];
  faces.forEach((face, fi) => {
    const pts = face.map((i) => vertices[i].clone().multiplyScalar(scale));
    const c = pts.reduce((a, p) => a.add(p), new THREE.Vector3()).divideScalar(pts.length);
    const n = new THREE.Vector3().subVectors(pts[1], pts[0]).cross(new THREE.Vector3().subVectors(pts[2], pts[0])).normalize();
    const u = new THREE.Vector3().subVectors(pts[0], c).normalize();
    const w = new THREE.Vector3().crossVectors(n, u);
    const rad = pts[0].distanceTo(c);
    const toUv = (p) => {
      const d = p.clone().sub(c);
      return [0.5 + d.dot(u) / (2 * rad), 0.5 + d.dot(w) / (2 * rad)];
    };
    for (let i = 0; i < pts.length; i++) {
      const a = pts[i];
      const b = pts[(i + 1) % pts.length];
      for (const p of [c, a, b]) {
        pos.push(p.x, p.y, p.z);
        nor.push(n.x, n.y, n.z);
        uv.push(...toUv(p));
        fid.push(fi);
      }
    }
  });
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setAttribute('faceId', new THREE.Float32BufferAttribute(fid, 1));
  return g;
}

// Thin cylinders along every edge, as one merged geometry. WebGL line width
// is fixed at 1px, which reads as a wire diagram rather than a crystal edge.
export function edgeTubesGeometry({ vertices, edges }, radius, scale = 1) {
  const parts = [];
  const up = new THREE.Vector3(0, 1, 0);
  for (const [i, j] of edges) {
    const a = vertices[i].clone().multiplyScalar(scale);
    const b = vertices[j].clone().multiplyScalar(scale);
    const len = a.distanceTo(b);
    const g = new THREE.CylinderGeometry(radius, radius, len, 6, 1, true);
    const q = new THREE.Quaternion().setFromUnitVectors(up, b.clone().sub(a).normalize());
    g.applyQuaternion(q);
    g.translate((a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2);
    parts.push(g);
  }
  return mergeGeometries(parts);
}

export function mergeGeometries(parts) {
  let total = 0;
  for (const g of parts) total += (g.index ? g.index.count : g.attributes.position.count);
  const pos = new Float32Array(total * 3);
  const nor = new Float32Array(total * 3);
  let o = 0;
  for (const g0 of parts) {
    const g = g0.index ? g0.toNonIndexed() : g0;
    pos.set(g.attributes.position.array, o * 3);
    nor.set(g.attributes.normal.array, o * 3);
    o += g.attributes.position.count;
    g.dispose();
    if (g !== g0) g0.dispose();
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  out.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  return out;
}
