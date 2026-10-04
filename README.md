# JINDA Previz Lab

A procedural simulator for developing the look of *JINDA*: characters, locations, sets, props and effects, anything that can be filmed. It runs in the browser.

Every generator reads its rules from the writers' room documents (encoded in `src/canon/canon.js`). Every view goes through a real lens on a Super 35 gauge at a delivery aspect ratio. Every result comes from a seed, so a look that works can be reproduced exactly and shared as a link.

## Run it

```bash
npm install
npm run dev        # http://localhost:5173
```

`npm run build` produces a static site in `dist/` that can be hosted anywhere.

## What's in it

| Generator | Category | Built from |
| --- | --- | --- |
| **Jinda, Manifested** | Character + VFX | POWER §2, §3, §5, §7, §10, §19, §21 |
| **Jinda Core** | Prop | POWER §1, §2, §5, §9A |
| **The Asylum** | Location | BIBLE: The Asylum; GLOSSARY: Amargosa Valley, Ground Zero; The Halo |
| **The Promises** | Set | GLOSSARY: The Promises; BIBLE: Ep. 6 |
| **The Adytum** | Set | BIBLE: The Adytum; GLOSSARY: The Sander Home |

**Jinda, Manifested.** A body built from motes: truncated-octahedron (Kelvin) cells packed on a body-centred-cubic lattice, with surface cells relaxed onto the skin. The core sits at centre mass. Packing modes cover dense, open, conductive and transitional. Actions:

- **Spin aura:** stillness, core pulse, first ring, successive rings, then the humanoid plexus reveals outward and holds.
- **Ground target:** light runs the strands toward the target and converges from several sides. The charge holds, then the aura collapses.
- **Blur-step:** traces bloom, all but one go dark, partial dispersal, transit, re-cohere.
- **Instance ×2 / ×3:** motes divided, not copied.
- **Dormancy / Manifest.**

The **Spend** slider is the exhaustion meter. It sets trace count (6 → 3 → 1 → none), translucency, stutter and lag. Character conditions:

- **Juri:** aura dead zones, fragment intrusions, severed from the JindaNet.
- **Chiron:** animated frame rate, coherence failing in bands, spikes that are seizures, cannot instance.
- **Owned / governed:** a quarter-second hitch before every action, and grounding capped at subdue.

All motion follows POWER §21: linear ramps only, no easing, no inertia, no breath.

**Jinda Core.** M-carbon truncated icosahedron. Growth-ring filigree is a seeded 3D contour field whose colours are a life history (violet-blue meditative, green integrated, yellow-orange intense). The rings show only under polarised magnification. Point level sets recursion (nested Matryoshka lattices, patterns inside patterns). Thermal stress saturates, pulses, then flashes chaotically. Damage draws spiderweb microfractures that leak heat past threshold. **Diviner sense** shows the core as presence: the field, not the object.

**The Asylum.** Basin-and-range terrain shaped by uncontained tears:

- twists (the ground's coordinates rotate)
- seams (spatial discontinuities)
- folds (ground inverted and hung overhead)
- shard columns (rates that disagree)
- lenses (space that bends light)

Also temporal flora (sprout, bloom and husk in one place, out of phase), spore drifts, the Shaft Five headframe at the rim, the column at ground zero on the horizon, and an optional faint Halo around the sun. **Depth** moves you from the rim toward ground zero.

**The Promises.** Kovar's 20 × 20 × 20 Relicrete lattice: 7,920 dwellings, a DivCorps testing station at the centre of every level, and twenty projected skies with honest projector seams. One level's sky program can be failing. The HUD shows the canonical address (`Prom-K7-12-13-08`) of wherever the camera is looking. **Jinda perception** turns the Relicrete hum into pressure fronts crawling through every panel.

**The Adytum.** A Farnsworth / Case Study glass pavilion in four states: Paradise, Corruption, Wasteland, and the final study with relic cores on the shelves. In Corruption and Wasteland the family turns to face the camera wherever you put it. At the edge of the world the construct gives up pretending and resolves into a grid.

## The lab

- **Seed + parameters** for every generator; **presets** for canon characters and places.
- **Camera:** focal length in mm (S35), aspect (2.39 scope, 1.85 flat, 16:9, 4:3), named camera setups per generator, bloom, grain, exposure.
- **Capture still:** renders a 3840-wide PNG with the slate burned in.
- **Copy link:** the URL hash holds the generator, every parameter, lens and aspect.
- **Canon flags** (rail footer): inconsistencies found in the documents while encoding them. Resolve them in the docs, then update `canon.js`.

### Contact sheets

With the dev server running:

```bash
npm run stills -- --presets          # every generator and preset → ./stills/
npm run stills -- --only jinda --action jinda:activate --wait 4000
```

In code, `window.__jinda.advance(seconds)` steps simulated time without waiting for the renderer. Use it to land on an exact moment, such as 0.38 s into a grounding.

## Architecture

```
src/
  canon/canon.js        rules from the documents, with sources; open questions
  engine/stage.js       renderer, S35 lens, aspect framing, bloom + film pass, capture
  engine/rng.js         seeded RNG with independent forked streams
  lib/polyhedra.js      truncated icosahedron (core), truncated octahedron (mote)
  lib/body.js           capsule humanoid: depth field, surface lattice, BCC packing, mannequin
  lib/aura.js           tactical aura graph, activation, grounding (Dijkstra along strands)
  lib/noise.js          seeded Perlin / fBm, GLSL simplex
  generators/*.js       one module per filmable thing
  main.js               UI: rail, auto-built parameter panel, URL state, HUD
```

### Writing a generator

A generator is a module that default-exports:

```js
export default {
  id: 'drift', title: 'The Drift', category: 'Locations',
  blurb: 'one line for the rail',
  canon: ['BIBLE Hedron — Global Reach (The Drift)'],   // where the rules come from
  params: [
    { key: 'seed', type: 'seed', default: 'DRIFT' },
    { key: 'age', label: 'Generations grown', type: 'range', min: 1, max: 40, step: 1, default: 12 },
    { key: 'night', label: 'Night', type: 'toggle', default: false, live: true }, // live: no rebuild
  ],
  presets: { 'Harbour at dusk': { age: 30 } },
  camera: { position: [x, y, z], target: [x, y, z], lens: 35 },
  build({ stage, rng, params }) {
    // rng is seeded from id + seed; use rng.fork('label') per subsystem
    return {
      object,                  // THREE.Object3D added to the scene
      update(t, dt) {},        // per frame
      set(key, value) {},      // for live params
      action(id) {}, actions: [{ id, label }],
      cameras: { 'Name': { position, target, lens } },
      hud() { return ['lines', 'under the frame'] },
      exposure, bloomScale, dispose() {},
    };
  },
};
```

Then add it to `src/generators/index.js`. The panel, presets, URL state, capture and stills script pick it up automatically.

## Honest limits of this first pass

- Human figures are capsule mannequins, for blocking only. Costume is on the roadmap.
- The aura uses 1-px WebGL lines. They read well on screen and thin at 4K capture; fat-line rendering is a later upgrade.
- Some values are previz interpretations of verbal ranges in the docs (aura metres per Point, core diameter, Promises unit sizes, Asylum tear types). Each one is labelled in the code and in the panel notes.
- "Finish" options for the Jinda surface are explorations: the documents don't yet say what a manifested Jinda looks like.
