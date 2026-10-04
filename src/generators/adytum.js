// THE ADYTUM / THE SANDER HOME: set.
// "Not to be entered." The Exarch's residence: a virtual, liminal construct, a
// mid-century modern glass-and-steel paradise where Sander has existed for two
// thousand years inside the infrastructure he built. In Season 5 the same
// house is his fortification inside Vex. Prisons disguised as paradises.
//
// States (GLOSSARY, The Sander Home):
//   Paradise   — light, idealised family, the life Sander imagined.
//   Corruption — shadows lengthening, accusatory gazes, industry on the horizon.
//   Wasteland  — night, Asylum ruins beyond the glass, family as accusers.
//   Final      — Sander as an old man in his study, among relics. Powerless, present.
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { Body } from '../lib/body.js';
import { makeNoise3, fbm } from '../lib/noise.js';
import { mergeGeometries, truncatedIcosahedron, edgeTubesGeometry } from '../lib/polyhedra.js';
import { ADYTUM } from '../canon/canon.js';

const STATES = {
  Paradise: { sun: [0.5, 0.75, 0.45], sunCol: 0xfff1d8, sunI: 2.1, sky: 0x9cc3e6, horizon: 0xe9e4d6, fog: [0xdfe3e2, 90, 420], interior: 0.4, lawn: 0x6f8f4a, exposure: 1 },
  Corruption: { sun: [-0.85, 0.16, 0.3], sunCol: 0xffb37a, sunI: 2.2, sky: 0x6d6f86, horizon: 0xc99a76, fog: [0xa88a74, 60, 360], interior: 0.6, lawn: 0x5b6a3e, exposure: 1 },
  Wasteland: { sun: [-0.3, 0.5, -0.6], sunCol: 0x8094c4, sunI: 0.35, sky: 0x05060c, horizon: 0x141826, fog: [0x0a0c14, 30, 260], interior: 0.7, lawn: 0x1d1f1c, exposure: 1.3 },
  'Final: the study': { sun: [-0.3, 0.5, -0.6], sunCol: 0x8094c4, sunI: 0.15, sky: 0x020203, horizon: 0x07080c, fog: [0x050608, 20, 120], interior: 0.5, lawn: 0x111210, exposure: 1.4 },
};

// House dimensions (metres). A Farnsworth-like floating slab, Case Study glass.
const W = 26; // length (x)
const D = 11; // depth (z)
const FLOOR_Y = 1.4;
const CEIL = 3.1;

export default {
  id: 'adytum',
  title: 'The Adytum',
  category: 'Sets',
  blurb: 'Sander\'s mid-century glass paradise. Paradise, Corruption, Wasteland, the study.',
  canon: ['BIBLE Hedron — The Adytum', 'GLOSSARY Adytum; The Sander Home (visual states, references)'],
  notes: [
    'References in the glossary: Dave Bowman\'s room in 2001; Norman Bates in Psycho. Architecture here leans Farnsworth House and Case Study #22.',
    'In Corruption the family turns to face the camera wherever it goes. Orbit the camera to see it.',
  ],
  params: [
    { key: 'seed', type: 'seed', default: 'SANDER' },
    { key: 'state', label: 'State', type: 'select', options: Object.keys(STATES), default: 'Paradise' },
    { key: 'construct', label: 'Show the construct\'s edge', type: 'toggle', default: true },
    { key: 'family', label: 'Family', type: 'toggle', default: true },
    { key: 'relics', label: 'Relic cores on the shelves', type: 'range', min: 0, max: 40, step: 1, default: 14 },
  ],
  presets: {
    Paradise: { state: 'Paradise' },
    Corruption: { state: 'Corruption' },
    Wasteland: { state: 'Wasteland' },
    'The study': { state: 'Final: the study' },
  },
  camera: { position: [34, 5.5, 30], target: [0, 2.6, 0], lens: 35 },

  build({ stage, rng, params }) {
    const root = new THREE.Group();
    const S = STATES[params.state];
    const final = params.state.startsWith('Final');
    const waste = params.state === 'Wasteland' || final;
    const corrupt = params.state === 'Corruption';
    const noise = makeNoise3(rng.fork('land'));

    const pmrem = new THREE.PMREMGenerator(stage.renderer);
    const env = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    pmrem.dispose();
    stage.scene.environment = env;
    stage.scene.environmentIntensity = waste ? 0.12 : 0.25;

    // ---------- materials ----------
    const steel = new THREE.MeshStandardMaterial({ color: 0xd8d5ce, roughness: 0.4, metalness: 0.15 });
    const terrazzo = new THREE.MeshStandardMaterial({ color: 0xcdc6b8, roughness: 0.3, metalness: 0.0 });
    const walnut = new THREE.MeshStandardMaterial({ color: 0x5a3a24, roughness: 0.45 });
    const primavera = new THREE.MeshStandardMaterial({ color: 0xb9925f, roughness: 0.5 });
    const leather = new THREE.MeshStandardMaterial({ color: 0x15130f, roughness: 0.5 });
    const chrome = new THREE.MeshStandardMaterial({ color: 0xdedede, roughness: 0.08, metalness: 1 });
    const wool = new THREE.MeshStandardMaterial({ color: 0xc9b48c, roughness: 0.95 });
    // Plate glass: mostly clear, catching the sky at grazing angles.
    const glass = new THREE.MeshPhysicalMaterial({
      color: 0x9fb0b4, roughness: 0.03, metalness: 0, transparent: true, opacity: 0.08,
      envMapIntensity: 0.3, side: THREE.DoubleSide, depthWrite: false,
    });

    const box = (w, h, d, mat, x, y, z, cast = true) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
      m.position.set(x, y, z);
      m.castShadow = cast;
      m.receiveShadow = true;
      root.add(m);
      return m;
    };

    // ---------- the house ----------
    // Floating floor and roof slabs on exterior white I-columns.
    box(W, 0.35, D, terrazzo, 0, FLOOR_Y - 0.175, 0);
    box(W + 0.2, 0.42, D + 0.2, steel, 0, FLOOR_Y + CEIL + 0.21, 0);
    // Terrace slab, a step down, and the floating stairs.
    box(10, 0.3, 6.5, terrazzo, -W / 2 + 4, 0.75, D / 2 + 3.5);
    for (let i = 0; i < 3; i++) box(3, 0.12, 0.45, terrazzo, -W / 2 + 6.5, 0.18 + i * 0.24, D / 2 + 7.1 - i * 0.45);
    for (let i = 0; i < 2; i++) box(3, 0.12, 0.45, terrazzo, -W / 2 + 6.5, 0.92 + i * 0.24, D / 2 + 0.6 - i * 0.45);
    const colGeo = new THREE.BoxGeometry(0.22, FLOOR_Y + CEIL + 0.6, 0.22);
    for (let i = 0; i <= 5; i++) {
      const x = -W / 2 + 1 + (i * (W - 2)) / 5;
      for (const z of [-D / 2 - 0.15, D / 2 + 0.15]) {
        const c = new THREE.Mesh(colGeo, steel);
        c.position.set(x, (FLOOR_Y + CEIL + 0.6) / 2 - 0.2, z);
        c.castShadow = true;
        root.add(c);
      }
    }
    // Glass curtain walls, set back from the slab edge, with thin mullions.
    const gw = W - 3;
    const gd = D - 1.6;
    for (const [w, x, z, ry] of [[gw, 0, gd / 2, 0], [gw, 0, -gd / 2, 0], [gd, gw / 2, 0, Math.PI / 2], [gd, -gw / 2, 0, Math.PI / 2]]) {
      const pane = new THREE.Mesh(new THREE.PlaneGeometry(w, CEIL), glass);
      pane.position.set(x, FLOOR_Y + CEIL / 2, z);
      pane.rotation.y = ry;
      root.add(pane);
      const n = Math.round(w / 2.6);
      for (let i = 0; i <= n; i++) {
        const t = -w / 2 + (i * w) / n;
        const m = box(0.05, CEIL, 0.08, steel, 0, FLOOR_Y + CEIL / 2, 0, false);
        if (ry) m.position.set(x, FLOOR_Y + CEIL / 2, t);
        else m.position.set(t, FLOOR_Y + CEIL / 2, z);
      }
    }
    // Service core: a free-standing primavera-panelled box, hearth on one side.
    box(7.5, CEIL - 0.6, 3.2, primavera, 2.5, FLOOR_Y + (CEIL - 0.6) / 2, -0.6);
    box(2.2, 0.9, 0.5, new THREE.MeshStandardMaterial({ color: 0x1a1918, roughness: 0.9 }), 2.5, FLOOR_Y + 0.45, 1.05);

    // ---------- furniture (living, dining, study) ----------
    // Living: two lounge chairs, a low sofa, a rug, a long credenza.
    box(5.5, 0.02, 3.6, wool, -6.5, FLOOR_Y + 0.01, 1.4, false);
    const lounge = (x, z, ry) => {
      const g = new THREE.Group();
      const seat = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.12, 0.75), leather);
      seat.position.set(0, 0.42, 0);
      seat.rotation.x = -0.12;
      const back = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.75, 0.12), leather);
      back.position.set(0, 0.75, -0.38);
      back.rotation.x = -0.25;
      const shell = new THREE.Mesh(new THREE.BoxGeometry(0.86, 0.78, 0.08), walnut);
      shell.position.set(0, 0.74, -0.46);
      shell.rotation.x = -0.25;
      const base = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.3, 0.32, 5), chrome);
      base.position.y = 0.17;
      const ott = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.38, 0.5), leather);
      ott.position.set(0, 0.2, 0.85);
      g.add(seat, back, shell, base, ott);
      g.traverse((o) => (o.castShadow = true));
      g.position.set(x, FLOOR_Y, z);
      g.rotation.y = ry;
      root.add(g);
    };
    lounge(-8, 2.2, 0.6);
    lounge(-5, 2.5, -0.5);
    box(2.8, 0.38, 0.85, new THREE.MeshStandardMaterial({ color: 0x3c4a56, roughness: 0.9 }), -6.5, FLOOR_Y + 0.38, -0.3);
    box(4.5, 0.62, 0.48, walnut, -7.5, FLOOR_Y + 0.31, -gd / 2 + 0.4);
    // Dining: a long walnut table under a sputnik pendant.
    box(3.4, 0.05, 1.1, walnut, 7.5, FLOOR_Y + 0.74, 2.2);
    for (const x of [6.1, 8.9]) box(0.06, 0.72, 0.9, chrome, x, FLOOR_Y + 0.36, 2.2);
    for (let i = 0; i < 6; i++) {
      const x = 6.4 + (i % 3) * 1.1;
      const z = i < 3 ? 1.3 : 3.1;
      box(0.45, 0.04, 0.45, walnut, x, FLOOR_Y + 0.45, z);
      box(0.45, 0.4, 0.04, walnut, x, FLOOR_Y + 0.7, z + (i < 3 ? -0.21 : 0.21));
    }
    const sputnik = new THREE.Group();
    const hub = new THREE.Mesh(new THREE.SphereGeometry(0.1, 16, 12), chrome);
    sputnik.add(hub);
    const bulbMat = new THREE.MeshBasicMaterial({ color: 0xfff1d6, toneMapped: false });
    for (const v of truncatedIcosahedron().vertices.filter((_, i) => i % 5 === 0)) {
      const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.45, 4), chrome);
      arm.position.copy(v).multiplyScalar(0.22);
      arm.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), v.clone().normalize());
      const b = new THREE.Mesh(new THREE.SphereGeometry(0.03, 8, 6), bulbMat);
      b.position.copy(v).multiplyScalar(0.45);
      sputnik.add(arm, b);
    }
    sputnik.position.set(7.5, FLOOR_Y + 2.15, 2.2);
    root.add(sputnik);
    const pendant = new THREE.PointLight(0xffe2b8, 12 * S.interior, 9, 2);
    pendant.position.copy(sputnik.position);
    pendant.castShadow = true;
    root.add(pendant);

    // Study (east end): desk, chair, and shelves of relics.
    const studyX = W / 2 - 3.2;
    box(1.8, 0.05, 0.8, walnut, studyX, FLOOR_Y + 0.74, -2.2);
    box(0.05, 0.72, 0.7, walnut, studyX - 0.85, FLOOR_Y + 0.37, -2.2);
    box(0.5, 0.72, 0.7, walnut, studyX + 0.6, FLOOR_Y + 0.37, -2.2);
    const lamp = new THREE.PointLight(0xffd9a0, 8 * S.interior, 6, 2);
    lamp.position.set(studyX + 0.6, FLOOR_Y + 1.35, -2.2);
    root.add(lamp);
    box(0.05, 0.55, 0.05, chrome, studyX + 0.6, FLOOR_Y + 1.03, -2.2);
    box(0.32, 0.18, 0.32, new THREE.MeshBasicMaterial({ color: 0xffe9c4, toneMapped: false }), studyX + 0.6, FLOOR_Y + 1.35, -2.2);
    const shelfX = W / 2 - 1.75;
    for (let i = 0; i < 5; i++) box(0.35, 0.03, 4.2, walnut, shelfX, FLOOR_Y + 0.3 + i * 0.52, -2.2);
    box(0.35, 2.4, 0.04, walnut, shelfX, FLOOR_Y + 1.2, -4.3);
    box(0.35, 2.4, 0.04, walnut, shelfX, FLOOR_Y + 1.2, -0.1);
    // Relics: cores. In the study's final state they are the only light he has.
    const poly = truncatedIcosahedron();
    const relicGeo = edgeTubesGeometry(poly, 0.06, 1);
    const relicMat = new THREE.MeshBasicMaterial({ color: 0x8f86ff, toneMapped: false, transparent: true, opacity: final ? 1 : 0.6 });
    const relics = new THREE.InstancedMesh(relicGeo, relicMat, Math.max(1, params.relics));
    const rr = rng.fork('relics');
    const m4 = new THREE.Matrix4();
    for (let i = 0; i < params.relics; i++) {
      const shelf = rr.int(0, 3);
      m4.compose(
        new THREE.Vector3(shelfX, FLOOR_Y + 0.38 + shelf * 0.52, -4.0 + rr.float(0, 3.6)),
        new THREE.Quaternion().setFromEuler(new THREE.Euler(rr.float(0, 6), rr.float(0, 6), 0)),
        new THREE.Vector3().setScalar(rr.float(0.035, 0.06)),
      );
      relics.setMatrixAt(i, m4);
    }
    if (params.relics > 0) root.add(relics);

    // ---------- the family ----------
    const figures = [];
    const skin = new THREE.MeshStandardMaterial({ color: 0xd8cbb8, roughness: 0.6 });
    const shadowSkin = new THREE.MeshStandardMaterial({ color: 0x0c0c0e, roughness: 0.9 });
    const addFigure = (opts, x, z, ry, mat = skin) => {
      const b = new Body(opts);
      const g = b.mannequin(mat);
      g.position.set(x, opts.y ?? FLOOR_Y, z);
      g.rotation.y = ry;
      root.add(g);
      figures.push(g);
      return g;
    };
    let sander = null;
    if (final) {
      // Sander, old, at his desk among the relics. Seated: lowered, stooped.
      sander = addFigure({ height: 1.72, build: 0.15, shoulder: 0.45 }, studyX - 0.1, -1.35, Math.PI, skin);
      sander.scale.set(1, 0.72, 1);
      sander.rotation.x = 0.12;
      box(0.55, 0.45, 0.55, leather, studyX - 0.1, FLOOR_Y + 0.22, -1.25);
    } else if (params.family) {
      const fam = [
        [{ height: 1.84, build: 0.45, shoulder: 0.7 }, -6.2, 0.6, 0.3],
        [{ height: 1.69, build: 0.25, shoulder: 0.3 }, -7.6, 1.2, 0.9],
        [{ height: 1.22, build: 0.2, shoulder: 0.5 }, -5.2, 3.6, -0.6],
        [{ height: 1.02, build: 0.2, shoulder: 0.5 }, -4.6, 3.2, -1.2],
      ];
      for (const [o, x, z, ry] of fam) {
        if (params.state === 'Wasteland') {
          // Outside in the dark, facing the glass.
          addFigure({ ...o, y: 0 }, x * 1.3, D / 2 + 6 + Math.abs(x) * 0.3, Math.PI, shadowSkin);
        } else {
          addFigure(o, x, z, ry);
        }
      }
    }

    // ---------- landscape ----------
    const land = new THREE.PlaneGeometry(900, 900, 200, 200).rotateX(-Math.PI / 2);
    const lp = land.attributes.position;
    for (let i = 0; i < lp.count; i++) {
      const x = lp.getX(i);
      const z = lp.getZ(i);
      const r = Math.hypot(x, z);
      let y = fbm(noise, x / 90, 0, z / 90, 4) * 3 * Math.min(1, r / 60);
      if (waste) y += Math.max(0, r - 40) / 60 * fbm(noise, x / 25, 3, z / 25, 4) * 9;
      lp.setY(i, Math.max(-0.2, y) - 0.02);
    }
    land.computeVertexNormals();
    const ground = new THREE.Mesh(land, new THREE.MeshStandardMaterial({ color: S.lawn, roughness: 0.95, flatShading: waste }));
    ground.receiveShadow = true;
    root.add(ground);

    if (!waste) {
      // Mid-century landscaping: a reflecting pool, a few sculpted trees.
      const pool = new THREE.Mesh(new THREE.PlaneGeometry(14, 4.5).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0x2c5a6e, roughness: 0.02, metalness: 0.6 }));
      pool.position.set(4, 0.02, D / 2 + 6);
      root.add(pool);
      box(14.6, 0.08, 5.1, terrazzo, 4, 0, D / 2 + 6).material = terrazzo;
      pool.position.y = 0.05;
      const tr = rng.fork('trees');
      for (let i = 0; i < 14; i++) {
        const a = tr.float(0, Math.PI * 2);
        const r = tr.float(22, 70);
        const x = Math.cos(a) * r;
        const z = Math.sin(a) * r - 10;
        // keep the hero approach (the +x,+z quadrant) clear
        if (x > 0 && z > 0) continue;
        const h = tr.float(4, 9);
        box(0.25, h, 0.25, new THREE.MeshStandardMaterial({ color: 0x3b2f26 }), x, h / 2, z);
        const crown = new THREE.Mesh(new THREE.SphereGeometry(tr.float(1.8, 3.4), 16, 12), new THREE.MeshStandardMaterial({ color: corrupt ? 0x4f5235 : 0x4a6b36, roughness: 0.9 }));
        crown.scale.y = tr.float(0.6, 1.1);
        crown.position.set(x, h, z);
        crown.castShadow = true;
        root.add(crown);
      }
    }

    // Corruption: the industry the paradise was built on, on the horizon.
    if (corrupt) {
      const ind = new THREE.MeshStandardMaterial({ color: 0x4a4440, roughness: 0.9 });
      const ir = rng.fork('industry');
      for (let i = 0; i < 9; i++) {
        const x = ir.float(-260, 260);
        const z = ir.float(-320, -200);
        const tower = ir.chance(0.4);
        if (tower) {
          const t = new THREE.Mesh(new THREE.CylinderGeometry(9, 14, 45, 24, 1, true), ind);
          t.position.set(x, 22, z);
          root.add(t);
        } else {
          const h = ir.float(40, 90);
          const s = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 2.4, h, 10), ind);
          s.position.set(x, h / 2, z);
          root.add(s);
          box(ir.float(20, 50), ir.float(10, 22), ir.float(14, 30), ind, x + 10, 6, z + 8, false);
        }
      }
    }

    // Wasteland: Asylum ruins beyond the glass. Broken slabs, a leaning frame.
    if (waste) {
      const ruin = new THREE.MeshStandardMaterial({ color: 0x2a2a2e, roughness: 0.95, flatShading: true });
      const wr = rng.fork('ruins');
      for (let i = 0; i < 40; i++) {
        const a = wr.float(-Math.PI, Math.PI);
        const r = wr.float(35, 180);
        const g = new THREE.BoxGeometry(wr.float(3, 18), wr.float(0.6, 4), wr.float(3, 14));
        const m = new THREE.Mesh(g, ruin);
        m.position.set(Math.cos(a) * r, wr.float(-1, 6) + (wr.chance(0.2) ? wr.float(8, 25) : 0), Math.sin(a) * r);
        m.rotation.set(wr.float(-0.6, 0.6), wr.float(0, 6), wr.float(-0.6, 0.6));
        m.castShadow = true;
        root.add(m);
      }
    }

    // ---------- the construct's edge ----------
    // The Adytum is virtual. Past a certain radius the world stops pretending.
    if (params.construct) {
      const grid = new THREE.Mesh(
        new THREE.RingGeometry(150, 900, 128, 1).rotateX(-Math.PI / 2),
        new THREE.ShaderMaterial({
          transparent: true,
          depthWrite: false,
          uniforms: { uCol: { value: new THREE.Color(waste ? 0x3a3f6a : 0x9aa3b8) } },
          vertexShader: `varying vec3 vW; void main(){ vec4 w = modelMatrix*vec4(position,1.0); vW = w.xyz; gl_Position = projectionMatrix*viewMatrix*w; }`,
          fragmentShader: `uniform vec3 uCol; varying vec3 vW;
            void main(){ vec2 g = abs(fract(vW.xz / 6.0) - 0.5) / fwidth(vW.xz / 6.0);
              float line = 1.0 - min(min(g.x, g.y), 1.0);
              float r = length(vW.xz);
              float fade = smoothstep(150.0, 230.0, r) * (1.0 - smoothstep(500.0, 900.0, r));
              gl_FragColor = vec4(uCol, line * fade * 0.55); }`,
        }),
      );
      grid.position.y = 0.3;
      root.add(grid);
    }

    // ---------- light and sky ----------
    const sunDir = new THREE.Vector3(...S.sun).normalize();
    const sun = new THREE.DirectionalLight(S.sunCol, S.sunI);
    sun.position.copy(sunDir).multiplyScalar(80);
    sun.castShadow = true;
    sun.shadow.mapSize.set(4096, 4096);
    Object.assign(sun.shadow.camera, { left: -40, right: 40, top: 40, bottom: -40, near: 1, far: 250 });
    sun.shadow.bias = -0.0003;
    root.add(sun, new THREE.HemisphereLight(S.sky, S.lawn, waste ? 0.15 : 0.45));
    const interiorFill = new THREE.PointLight(0xffe6c4, 18 * S.interior, 18, 2);
    interiorFill.position.set(-5, FLOOR_Y + 2.6, 0.5);
    root.add(interiorFill);

    const sky = new THREE.Mesh(
      new THREE.SphereGeometry(1500, 32, 16),
      new THREE.ShaderMaterial({
        side: THREE.BackSide,
        fog: false,
        depthWrite: false,
        uniforms: { uTop: { value: new THREE.Color(S.sky) }, uH: { value: new THREE.Color(S.horizon) }, uSun: { value: sunDir }, uSunCol: { value: new THREE.Color(S.sunCol) }, uNight: { value: waste ? 1 : 0 } },
        vertexShader: `varying vec3 vD; void main(){ vD = normalize(position); gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
        fragmentShader: `uniform vec3 uTop, uH, uSun, uSunCol; uniform float uNight; varying vec3 vD;
          void main(){ float h = max(vD.y, 0.0); vec3 c = mix(uH, uTop, pow(h, 0.5));
            float sd = max(dot(vD, uSun), 0.0); c += uSunCol * (pow(sd, 600.0) * 4.0 + pow(sd, 8.0) * 0.25) * (1.0 - uNight * 0.6);
            gl_FragColor = vec4(c, 1.0); }`,
      }),
    );
    root.add(sky);
    stage.scene.background = new THREE.Color(S.horizon);
    stage.scene.fog = new THREE.Fog(...S.fog);

    const camPos = new THREE.Vector3();
    return {
      object: root,
      exposure: S.exposure,
      bloomScale: 0.35,
      dispose: () => env.dispose(),
      cameras: {
        'Exterior, three-quarter': { position: [34, 5.5, 30], target: [0, 2.6, 0], lens: 35 },
        'Through the glass': { position: [-2, FLOOR_Y + 1.5, D / 2 + 14], target: [-6, FLOOR_Y + 1.1, 0], lens: 50 },
        'Interior, living': { position: [5, FLOOR_Y + 1.45, 3.2], target: [-8, FLOOR_Y + 1.1, 1.2], lens: 24 },
        'The study': { position: [studyX - 2.4, FLOOR_Y + 1.5, 2.9], target: [studyX + 0.2, FLOOR_Y + 0.95, -2.3], lens: 32 },
        'From outside, at night': { position: [-4, 1.6, D / 2 + 22], target: [-4, FLOOR_Y + 1.3, 0], lens: 32 },
      },
      update() {
        // Accusatory gazes: in Corruption and Wasteland the family turns to
        // face the camera wherever it is.
        if (corrupt || params.state === 'Wasteland') {
          camPos.copy(stage.camera.position);
          for (const f of figures) f.rotation.y = Math.atan2(camPos.x - f.position.x, camPos.z - f.position.z);
        }
      },
      hud() {
        return [`${params.state}: ${final ? 'Sander as an old man in his study, among relics. Powerless, present.' : ADYTUM.states[params.state.toLowerCase()]}`];
      },
    };
  },
};
