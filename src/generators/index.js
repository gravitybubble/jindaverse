// Generator registry. To add a generator: write a module that default-exports
// { id, title, category, blurb, canon, params, presets?, camera, build() }
// and add it here. See README.md, "Writing a generator".
import core from './core.js';
import jinda from './jinda.js';
import asylum from './asylum.js';
import promises from './promises.js';
import adytum from './adytum.js';

export const GENERATORS = [jinda, core, asylum, promises, adytum];

// On the board, not built yet. Listed in the rail so the lab shows the whole
// production, not just what exists.
export const PLANNED = [
  { title: 'Skarn', category: 'Characters', note: 'ablative volcanic skin, shed and regrown (BIBLE Four Peoples)' },
  { title: 'Omai', category: 'Characters', note: 'involuntary empathic morphing toward a nearby mind' },
  { title: 'Geist', category: 'Characters', note: 'rate-offset phasing; micro-tears as byproduct' },
  { title: 'Rax', category: 'Characters', note: 'volumetric perception; weaving tears shut' },
  { title: 'Humans & costume', category: 'Characters', note: 'four Hedron tiers, Echo, ConSec, DivCorps' },
  { title: 'Slate · Dermic · Tok', category: 'Props', note: 'Hedron device, Echo interface, fringe currency' },
  { title: 'Epox · Taffy', category: 'Props', note: 'Echo countermeasures (POWER §14)' },
  { title: 'The Drift', category: 'Locations', note: 'reef-boat cities, bioluminescent, curves not angles' },
  { title: 'Domo Syn compound', category: 'Sets', note: 'campus × feudal estate × military installation' },
  { title: 'Psi-net: under', category: 'VFX', note: 'shared construct vs. the person alone in a container' },
  { title: 'Virtue', category: 'Locations', note: 'overlapping bubbles of the Jindaverse' },
];
